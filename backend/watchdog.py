import os
import json
import time
import asyncio
import signal
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

from dotenv import load_dotenv
from web3 import Web3
from web3.exceptions import BlockNotFound
import aiohttp
import structlog

from database import (
    init_db,
    insert_transaction,
    update_transaction_status,
    update_agent_stats,
    update_vendor_stats,
    insert_alert,
    insert_audit_log,
    get_agent_profile,
    get_pending_transactions
)

load_dotenv()

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

RPC_URL = os.getenv("SEPOLIA_RPC_URL", "https://rpc.sepolia.org")
DEPLOYMENT_PATH = Path(__file__).parent.parent / "deployment.json"
ABI_PATH = Path(__file__).parent.parent / "artifacts" / "contracts" / "SentinelVault.sol" / "SentinelVault.json"

WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL")
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK_URL")
EMAIL_ALERTS = os.getenv("EMAIL_ALERTS_ENABLED", "false").lower() == "true"

@dataclass
class RiskConfig:
    high_amount_multiplier: float = 5.0
    rapid_tx_window: int = 300
    rapid_tx_count: int = 5
    new_agent_threshold: int = 3
    high_risk_score: float = 0.7
    medium_risk_score: float = 0.4
    
    amount_anomaly_weight: float = 0.3
    new_agent_weight: float = 0.2
    unknown_agent_weight: float = 0.25
    untrusted_vendor_weight: float = 0.3
    rapid_tx_weight: float = 0.25

RISK_CONFIG = RiskConfig()

@dataclass
class RecentTransaction:
    tx_id: int
    agent: str
    timestamp: float
    amount: int

class RetryConfig:
    def __init__(self, max_retries: int = 5, base_delay: float = 1.0, max_delay: float = 60.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.current_retry = 0

    def get_delay(self) -> float:
        delay = min(self.base_delay * (2 ** self.current_retry), self.max_delay)
        self.current_retry += 1
        return delay

    def reset(self):
        self.current_retry = 0

    def should_retry(self) -> bool:
        return self.current_retry < self.max_retries

class AlertNotifier:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        if self.session:
            await self.session.close()

    async def send_webhook(self, payload: Dict[str, Any]) -> bool:
        if not WEBHOOK_URL or not self.session:
            return False
        
        try:
            async with self.session.post(WEBHOOK_URL, json=payload, timeout=10) as resp:
                return resp.status == 200
        except Exception as e:
            logger.error("webhook_failed", error=str(e))
            return False

    async def send_slack(self, message: str, severity: str = "warning") -> bool:
        if not SLACK_WEBHOOK or not self.session:
            return False

        color_map = {
            "critical": "#dc3545",
            "high": "#fd7e14",
            "warning": "#ffc107",
            "info": "#17a2b8"
        }

        payload = {
            "attachments": [{
                "color": color_map.get(severity, "#6c757d"),
                "title": "🛡️ Sentinel Finance Alert",
                "text": message,
                "footer": "Sentinel Watchdog",
                "ts": int(time.time())
            }]
        }

        try:
            async with self.session.post(SLACK_WEBHOOK, json=payload, timeout=10) as resp:
                return resp.status == 200
        except Exception as e:
            logger.error("slack_notification_failed", error=str(e))
            return False

    async def notify(self, alert_type: str, severity: str, message: str, data: Dict[str, Any] = None):
        tasks = []
        
        if WEBHOOK_URL:
            payload = {
                "type": alert_type,
                "severity": severity,
                "message": message,
                "data": data or {},
                "timestamp": datetime.utcnow().isoformat()
            }
            tasks.append(self.send_webhook(payload))
        
        if SLACK_WEBHOOK:
            slack_msg = f"*{severity.upper()}*: {message}"
            if data:
                slack_msg += f"\n```{json.dumps(data, indent=2)[:500]}```"
            tasks.append(self.send_slack(slack_msg, severity))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

class SentinelWatchdog:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.vault = None
        self.recent_transactions: List[RecentTransaction] = []
        self.running = True
        self.notifier = AlertNotifier()
        self.retry_config = RetryConfig()
        self.last_processed_block = 0
        self.stats = {
            "events_processed": 0,
            "alerts_generated": 0,
            "errors": 0,
            "start_time": None
        }

    def load_contract(self):
        if not DEPLOYMENT_PATH.exists():
            raise FileNotFoundError("deployment.json not found")

        if not ABI_PATH.exists():
            raise FileNotFoundError("Contract ABI not found. Run npx hardhat compile")

        deployment = json.loads(DEPLOYMENT_PATH.read_text())
        abi = json.loads(ABI_PATH.read_text())["abi"]

        self.vault = self.w3.eth.contract(
            address=Web3.to_checksum_address(deployment["vaultAddress"]),
            abi=abi
        )
        
        self.last_processed_block = self.w3.eth.block_number
        logger.info("contract_loaded", address=deployment["vaultAddress"], block=self.last_processed_block)

    def calculate_risk_score(self, agent: str, vendor: str, amount: int, is_trusted: bool) -> tuple[float, List[str]]:
        risk_score = 0.0
        risk_factors = []

        profile = get_agent_profile(agent)

        if profile:
            avg_amount = int(profile.get("avg_amount_wei", 0))
            if avg_amount > 0 and amount > avg_amount * RISK_CONFIG.high_amount_multiplier:
                risk_score += RISK_CONFIG.amount_anomaly_weight
                risk_factors.append("amount_anomaly")

            if profile["total_transactions"] < RISK_CONFIG.new_agent_threshold:
                risk_score += RISK_CONFIG.new_agent_weight
                risk_factors.append("new_agent")
        else:
            risk_score += RISK_CONFIG.unknown_agent_weight
            risk_factors.append("unknown_agent")

        if not is_trusted:
            risk_score += RISK_CONFIG.untrusted_vendor_weight
            risk_factors.append("untrusted_vendor")

        now = time.time()
        self.recent_transactions = [
            tx for tx in self.recent_transactions 
            if now - tx.timestamp < 3600
        ]

        recent_window = [
            tx for tx in self.recent_transactions 
            if now - tx.timestamp < RISK_CONFIG.rapid_tx_window and tx.agent == agent
        ]
        
        if len(recent_window) >= RISK_CONFIG.rapid_tx_count:
            risk_score += RISK_CONFIG.rapid_tx_weight
            risk_factors.append("rapid_transactions")

        total_recent_volume = sum(tx.amount for tx in recent_window)
        if profile and total_recent_volume > int(profile.get("avg_amount_wei", 0)) * 10:
            risk_score += 0.15
            risk_factors.append("volume_spike")

        risk_score = min(risk_score, 1.0)

        return risk_score, risk_factors

    async def process_payment_request(self, event: Dict[str, Any]):
        args = event["args"]
        tx_id = args["txId"]
        agent = args["agent"]
        vendor = args["vendor"]
        amount = args["amount"]
        execute_after = args["executeAfter"]

        is_trusted = self.vault.functions.trustedVendors(vendor).call()

        risk_score, risk_factors = self.calculate_risk_score(agent, vendor, amount, is_trusted)

        tx_data = {
            "tx_id": tx_id,
            "agent": agent,
            "vendor": vendor,
            "amount": str(amount),
            "timestamp": int(time.time()),
            "execute_after": execute_after,
            "executed": 0,
            "revoked": 0,
            "risk_score": risk_score,
            "risk_factors": risk_factors
        }

        insert_transaction(tx_data)
        update_agent_stats(agent, str(amount))
        update_vendor_stats(vendor, str(amount), is_trusted)

        self.recent_transactions.append(RecentTransaction(
            tx_id=tx_id,
            agent=agent,
            timestamp=time.time(),
            amount=amount
        ))

        self.stats["events_processed"] += 1

        if risk_score >= RISK_CONFIG.high_risk_score:
            alert_msg = f"High risk transaction detected. Score: {risk_score:.2f}. Factors: {risk_factors}"
            insert_alert(tx_id, "high_risk", "critical", alert_msg)
            self.stats["alerts_generated"] += 1
            
            await self.notifier.notify(
                "high_risk_transaction",
                "critical",
                alert_msg,
                {"tx_id": tx_id, "amount": str(amount), "risk_score": risk_score, "factors": risk_factors}
            )
            
            logger.warning("high_risk_transaction", tx_id=tx_id, risk_score=risk_score, factors=risk_factors)

        elif risk_score >= RISK_CONFIG.medium_risk_score:
            alert_msg = f"Medium risk transaction. Score: {risk_score:.2f}. Factors: {risk_factors}"
            insert_alert(tx_id, "medium_risk", "warning", alert_msg)
            self.stats["alerts_generated"] += 1
            logger.info("medium_risk_transaction", tx_id=tx_id, risk_score=risk_score, factors=risk_factors)

        else:
            logger.info("transaction_processed", tx_id=tx_id, risk_score=risk_score)

        insert_audit_log("payment_requested", "transaction", str(tx_id), None, json.dumps(tx_data), "watchdog")

        return risk_score, risk_factors

    async def process_payment_executed(self, event: Dict[str, Any]):
        tx_id = event["args"]["txId"]
        update_transaction_status(tx_id, executed=True)
        insert_audit_log("payment_executed", "transaction", str(tx_id), None, None, "contract")
        self.stats["events_processed"] += 1
        logger.info("payment_executed", tx_id=tx_id)

    async def process_payment_revoked(self, event: Dict[str, Any]):
        tx_id = event["args"]["txId"]
        reason = event["args"]["reason"]
        
        update_transaction_status(tx_id, revoked=True, reason=reason)
        insert_alert(tx_id, "revoked", "info", f"Transaction revoked: {reason}")
        insert_audit_log("payment_revoked", "transaction", str(tx_id), None, reason, "owner")
        
        self.stats["events_processed"] += 1
        logger.info("payment_revoked", tx_id=tx_id, reason=reason)

    async def poll_events(self):
        logger.info("starting_event_polling")
        
        while self.running:
            try:
                current_block = self.w3.eth.block_number
                
                if current_block <= self.last_processed_block:
                    await asyncio.sleep(2)
                    continue

                from_block = self.last_processed_block + 1
                to_block = min(from_block + 100, current_block)

                request_events = self.vault.events.PaymentRequested.get_logs(
                    from_block=from_block, to_block=to_block
                )
                for event in request_events:
                    await self.process_payment_request(event)

                executed_events = self.vault.events.PaymentExecuted.get_logs(
                    from_block=from_block, to_block=to_block
                )
                for event in executed_events:
                    await self.process_payment_executed(event)

                revoked_events = self.vault.events.PaymentRevoked.get_logs(
                    from_block=from_block, to_block=to_block
                )
                for event in revoked_events:
                    await self.process_payment_revoked(event)

                self.last_processed_block = to_block
                self.retry_config.reset()

                await asyncio.sleep(2)

            except BlockNotFound as e:
                logger.warning("block_not_found", error=str(e))
                await asyncio.sleep(5)

            except Exception as e:
                self.stats["errors"] += 1
                logger.error("polling_error", error=str(e))
                
                if self.retry_config.should_retry():
                    delay = self.retry_config.get_delay()
                    logger.info("retrying", delay=delay, attempt=self.retry_config.current_retry)
                    await asyncio.sleep(delay)
                else:
                    logger.error("max_retries_exceeded")
                    self.retry_config.reset()
                    await asyncio.sleep(60)

    async def monitor_pending(self):
        logger.info("starting_pending_monitor")

        while self.running:
            try:
                pending = get_pending_transactions()
                now = int(time.time())

                for tx in pending:
                    risk_score = tx.get("risk_score", 0)
                    execute_after = tx.get("execute_after", 0)
                    time_left = execute_after - now

                    if risk_score >= RISK_CONFIG.high_risk_score and 0 < time_left < 300:
                        alert_msg = f"High risk TX {tx['tx_id']} executing in {time_left}s. Review immediately."
                        insert_alert(tx["tx_id"], "urgent_review", "critical", alert_msg)
                        
                        await self.notifier.notify(
                            "urgent_review",
                            "critical",
                            alert_msg,
                            {"tx_id": tx["tx_id"], "time_left": time_left, "risk_score": risk_score}
                        )
                        
                        logger.warning("urgent_review_needed", tx_id=tx["tx_id"], time_left=time_left)

                    elif risk_score >= RISK_CONFIG.medium_risk_score and 0 < time_left < 600:
                        logger.info("pending_review_suggested", tx_id=tx["tx_id"], time_left=time_left)

                await asyncio.sleep(30)

            except Exception as e:
                self.stats["errors"] += 1
                logger.error("monitor_error", error=str(e))
                await asyncio.sleep(10)

    async def health_reporter(self):
        while self.running:
            uptime = (datetime.utcnow() - self.stats["start_time"]).total_seconds() if self.stats["start_time"] else 0
            
            logger.info(
                "health_report",
                events_processed=self.stats["events_processed"],
                alerts_generated=self.stats["alerts_generated"],
                errors=self.stats["errors"],
                uptime_seconds=int(uptime),
                last_block=self.last_processed_block,
                recent_tx_count=len(self.recent_transactions)
            )
            
            await asyncio.sleep(300)

    def handle_shutdown(self, signum, frame):
        logger.info("shutdown_requested", signal=signum)
        self.running = False

    async def start(self):
        signal.signal(signal.SIGINT, self.handle_shutdown)
        signal.signal(signal.SIGTERM, self.handle_shutdown)

        init_db()
        self.load_contract()
        await self.notifier.start()
        
        self.stats["start_time"] = datetime.utcnow()

        logger.info("watchdog_started", rpc=RPC_URL)

        try:
            await asyncio.gather(
                self.poll_events(),
                self.monitor_pending(),
                self.health_reporter()
            )
        finally:
            await self.notifier.stop()
            logger.info("watchdog_stopped", stats=self.stats)

async def main():
    watchdog = SentinelWatchdog()
    await watchdog.start()

if __name__ == "__main__":
    asyncio.run(main())