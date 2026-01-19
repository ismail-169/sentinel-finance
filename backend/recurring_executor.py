"""
recurring_executor.py
Background service for executing recurring payments from Agent Wallets
Supports both Sepolia testnet and Ethereum mainnet simultaneously
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from web3 import Web3
from eth_account import Account
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('RecurringExecutor')


SEPOLIA_RPC_URL = os.getenv('SEPOLIA_RPC_URL', 'https://rpc.sepolia.org')
MAINNET_RPC_URL = os.getenv('MAINNET_RPC_URL', 'https://eth.llamarpc.com')

NETWORK_CONFIG = {
    'sepolia': {
        'rpc_url': SEPOLIA_RPC_URL,
        'mnee_token': '0x250ff89cf1518F42F3A4c927938ED73444491715',
        'savings_contract': '0xcF493dB2D2B4BffB8A38f961276019D5a00480DB',
        'chain_id': 11155111
    },
    'mainnet': {
        'rpc_url': MAINNET_RPC_URL,
        'mnee_token': '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF',
        'savings_contract': '0xb1c74612c81fe8f685c1a3586d753721847d4549',
        'chain_id': 1
    }
}

DATABASE_URL = os.getenv('DATABASE_URL', '')
AGENT_ENCRYPTION_KEY = os.getenv('AGENT_ENCRYPTION_KEY', '')


def load_abi(filename: str) -> list:
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
            return data.get('abi', data)
    except FileNotFoundError:
        logger.warning(f"ABI file not found: {filename}")
        return []


MNEE_ABI = [
    {"inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}], 
     "name": "transfer", "outputs": [{"type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}], 
     "name": "approve", "outputs": [{"type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "account", "type": "address"}], 
     "name": "balanceOf", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]


class PaymentType(Enum):
    VENDOR = "vendor"
    SAVINGS = "savings"


class PaymentFrequency(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    
    @classmethod
    def _missing_(cls, value):
        return cls.MONTHLY


@dataclass
class RecurringPayment:
    id: str
    user_address: str           
    agent_wallet_address: str   
    vault_address: str          
    payment_type: PaymentType
    destination: str            
    destination_name: str       
    amount: float               
    frequency: PaymentFrequency
    execution_time: str         
    next_execution: datetime    
    is_active: bool
    created_at: datetime
    network: str = 'mainnet'
    last_executed: Optional[datetime] = None
    execution_count: int = 0
    savings_plan_id: Optional[int] = None


@dataclass
class AgentWallet:
    user_address: str          
    agent_address: str         
    encrypted_key: str          
    vault_address: str         
    created_at: datetime
    network: str = 'mainnet'


class RecurringExecutor:
    
    def __init__(self, database):
        self.db = database
        self.scheduler = AsyncIOScheduler()
        
        self.networks = {}
        for network_name, config in NETWORK_CONFIG.items():
            web3 = Web3(Web3.HTTPProvider(config['rpc_url']))
            mnee_contract = web3.eth.contract(
                address=Web3.to_checksum_address(config['mnee_token']),
                abi=MNEE_ABI
            )
            
            savings_contract = None
            if config['savings_contract']:
                savings_abi = load_abi('SentinelSavings.json')
                if savings_abi:
                    savings_contract = web3.eth.contract(
                        address=Web3.to_checksum_address(config['savings_contract']),
                        abi=savings_abi
                    )
            
            self.networks[network_name] = {
                'web3': web3,
                'mnee_contract': mnee_contract,
                'savings_contract': savings_contract,
                'config': config
            }
            logger.info(f"initialized network={network_name} mnee={config['mnee_token']} savings={config['savings_contract']}")
        
        logger.info("🚀 Dual-network executor initialized (sepolia + mainnet)")
    
    def get_network(self, network_name: str) -> Dict:
        return self.networks.get(network_name, self.networks['mainnet'])
    
    async def start(self):
        logger.info("🚀 Starting Recurring Payment Executor...")
        
        self.scheduler.add_job(
            self.check_due_payments,
            IntervalTrigger(minutes=1),
            id='check_due_payments',
            replace_existing=True
        )
        
        self.scheduler.add_job(
            self.check_low_balances,
            IntervalTrigger(hours=6),
            id='check_low_balances',
            replace_existing=True
        )
        
        self.scheduler.add_job(
            self.cleanup_old_logs,
            CronTrigger(hour=3, minute=0),
            id='cleanup_old_logs',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("✅ Scheduler started")
    
    async def stop(self):
        self.scheduler.shutdown()
        logger.info("🛑 Scheduler stopped")
    
    async def check_due_payments(self):
        try:
            due_payments = await self.db.get_due_payments()
            
            if due_payments:
                logger.info(f"📋 Found {len(due_payments)} due payments")
                
                for payment in due_payments:
                    await self.execute_payment(payment)
                    
        except Exception as e:
            logger.error(f"Error checking due payments: {e}")
    
    async def execute_payment(self, payment: RecurringPayment):
        try:
            network_name = getattr(payment, 'network', 'mainnet') or 'mainnet'
            network = self.get_network(network_name)
            web3 = network['web3']
            mnee_contract = network['mnee_contract']
            
            logger.info(f"💸 Executing payment {payment.id}: {payment.amount} MNEE to {payment.destination_name} on {network_name}")
            
            agent_wallet = await self.db.get_agent_wallet(payment.user_address, network_name)
            if not agent_wallet:
                logger.error(f"Agent wallet not found for {payment.user_address} on {network_name}")
                await self.db.update_payment_failure(payment.id, f"Agent wallet not found on {network_name}")
                return
            
            private_key = await self.decrypt_agent_key(agent_wallet.encrypted_key, payment.user_address)
            if not private_key:
                logger.error("Failed to decrypt agent wallet key")
                await self.db.update_payment_failure(payment.id, "Failed to decrypt key")
                return
            
            amount_wei = web3.to_wei(payment.amount, 'ether')
            balance = mnee_contract.functions.balanceOf(
                Web3.to_checksum_address(agent_wallet.agent_address)
            ).call()
            
            if balance < amount_wei:
                logger.warning(f"Insufficient balance on {network_name}: {balance} < {amount_wei}")
                await self.db.update_payment_failure(payment.id, f"Insufficient balance on {network_name}")
                await self.create_notification(
                    payment.user_address,
                    "low_balance",
                    f"Agent wallet needs more MNEE on {network_name} for scheduled payment to {payment.destination_name}"
                )
                return
            
            if payment.payment_type == PaymentType.VENDOR:
                validation = self.is_valid_destination(payment.destination, payment.vault_address)
                if not validation['valid']:
                    logger.error(f"Invalid destination: {payment.destination}")
                    await self.db.update_payment_failure(payment.id, validation['reason'])
                    return
                
                tx_hash = await self.send_to_vendor(
                    web3, mnee_contract, private_key, 
                    payment.destination, amount_wei, network_name
                )
            else:
                tx_hash = await self.deposit_to_savings(
                    network, private_key, payment.savings_plan_id, 
                    amount_wei, agent_wallet.agent_address
                )
            
            if tx_hash:
                next_date = self.calculate_next_date(payment.frequency, payment.execution_time)
                await self.db.update_payment_execution(payment.id, tx_hash, next_date, payment.amount)
                
                logger.info(f"✅ Payment executed on {network_name}: {tx_hash}")
            else:
                logger.error("Payment execution failed - no tx hash")
                await self.db.update_payment_failure(payment.id, "Transaction failed")
                
        except Exception as e:
            logger.error(f"Error executing payment {payment.id}: {e}")
            await self.db.update_payment_failure(payment.id, str(e))
    
    async def get_agent_balance(self, agent_address: str, network_name: str = 'mainnet') -> int:
        try:
            network = self.get_network(network_name)
            mnee_contract = network['mnee_contract']
            return mnee_contract.functions.balanceOf(
                Web3.to_checksum_address(agent_address)
            ).call()
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
            return 0
    
    def is_valid_destination(self, destination: str, vault_address: str) -> Dict[str, Any]:
        dest_lower = destination.lower()
        vault_lower = vault_address.lower() if vault_address else ''
        
        if dest_lower == vault_lower:
            return {'valid': True, 'reason': 'Own vault'}
        
        for network_config in NETWORK_CONFIG.values():
            if dest_lower == network_config['savings_contract'].lower():
                return {'valid': True, 'reason': 'Savings contract'}
        
        return {'valid': True, 'reason': 'Trusted vendor'}
    
    async def send_to_vendor(self, web3: Web3, mnee_contract, private_key: str, 
                            vendor_address: str, amount_wei: int, network_name: str) -> Optional[str]:
        try:
            account = Account.from_key(private_key)
            nonce = web3.eth.get_transaction_count(account.address)
            
            tx_params = {
                'from': account.address,
                'nonce': nonce,
                'gas': 100000,
            }
            
            if network_name == 'sepolia':
                tx_params['gasPrice'] = web3.eth.gas_price
            else:
                fee_data = web3.eth.fee_history(1, 'latest')
                base_fee = fee_data['baseFeePerGas'][-1]
                tx_params['maxFeePerGas'] = int(base_fee * 2)
                tx_params['maxPriorityFeePerGas'] = web3.to_wei(2, 'gwei')
            
            tx = mnee_contract.functions.transfer(
                Web3.to_checksum_address(vendor_address),
                amount_wei
            ).build_transaction(tx_params)
            
            signed_tx = web3.eth.account.sign_transaction(tx, private_key)
            tx_hash = web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                return tx_hash.hex()
            else:
                logger.error("Transaction failed")
                return None
                
        except Exception as e:
            logger.error(f"Error sending to vendor: {e}")
            return None
    
    async def deposit_to_savings(self, network: Dict, private_key: str, plan_id: int, 
                                 amount_wei: int, agent_address: str) -> Optional[str]:
        savings_contract = network['savings_contract']
        if not savings_contract:
            logger.error("Savings contract not configured")
            return None
            
        try:
            web3 = network['web3']
            mnee_contract = network['mnee_contract']
            account = Account.from_key(private_key)
            
            network_name = 'sepolia' if network['config']['chain_id'] == 11155111 else 'mainnet'
            
            nonce = web3.eth.get_transaction_count(account.address)
            
            if network_name == 'sepolia':
                gas_params = {'gasPrice': web3.eth.gas_price}
            else:
                fee_data = web3.eth.fee_history(1, 'latest')
                base_fee = fee_data['baseFeePerGas'][-1]
                gas_params = {
                    'maxFeePerGas': int(base_fee * 2),
                    'maxPriorityFeePerGas': web3.to_wei(2, 'gwei')
                }
            
            approve_tx = mnee_contract.functions.approve(
                savings_contract.address,
                amount_wei
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 60000,
                **gas_params
            })
            
            signed_approve = web3.eth.account.sign_transaction(approve_tx, private_key)
            approve_hash = web3.eth.send_raw_transaction(signed_approve.rawTransaction)
            web3.eth.wait_for_transaction_receipt(approve_hash, timeout=120)
            
            nonce += 1
            
            deposit_tx = savings_contract.functions.depositFromAgent(
                plan_id,
                amount_wei,
                Web3.to_checksum_address(agent_address)
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 150000,
                **gas_params
            })
            
            signed_deposit = web3.eth.account.sign_transaction(deposit_tx, private_key)
            deposit_hash = web3.eth.send_raw_transaction(signed_deposit.rawTransaction)
            
            receipt = web3.eth.wait_for_transaction_receipt(deposit_hash, timeout=120)
            
            if receipt.status == 1:
                return deposit_hash.hex()
            else:
                logger.error("Savings deposit failed")
                return None
                
        except Exception as e:
            logger.error(f"Error depositing to savings: {e}")
            return None
    
    def calculate_next_date(self, frequency: PaymentFrequency, execution_time: str) -> datetime:
        now = datetime.utcnow()
        hour, minute = map(int, (execution_time or '09:00').split(':'))
        
        if frequency == PaymentFrequency.DAILY:
            next_date = now + timedelta(days=1)
        elif frequency == PaymentFrequency.WEEKLY:
            next_date = now + timedelta(weeks=1)
        elif frequency == PaymentFrequency.BIWEEKLY:
            next_date = now + timedelta(weeks=2)
        elif frequency == PaymentFrequency.MONTHLY:
            next_date = now + timedelta(days=30)
        elif frequency == PaymentFrequency.YEARLY:
            next_date = now + timedelta(days=365)
        else:
            next_date = now + timedelta(days=30)
        
        return next_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    async def decrypt_agent_key(self, encrypted_key: str, user_address: str) -> Optional[str]:
        try:
            if encrypted_key.startswith('0x') or len(encrypted_key) == 64:
                return encrypted_key
            
            if encrypted_key.startswith('enc_'):
                import base64
                import hashlib
                from cryptography.hazmat.primitives.ciphers.aead import AESGCM
                
                salt = 'sentinel_agent_v2_'
                key_material = hashlib.sha256((salt + user_address.lower()).encode()).digest()
                
                encrypted_data = base64.b64decode(encrypted_key[4:])
                iv = encrypted_data[:12]
                ciphertext = encrypted_data[12:]
                
                aesgcm = AESGCM(key_material)
                decrypted = aesgcm.decrypt(iv, ciphertext, None)
                return decrypted.decode()
            
            encryption_key = os.getenv('AGENT_ENCRYPTION_KEY')
            if encryption_key:
                from cryptography.fernet import Fernet
                cipher = Fernet(encryption_key.encode())
                decrypted = cipher.decrypt(encrypted_key.encode()).decode()
                return decrypted
            
            logger.warning("No AGENT_ENCRYPTION_KEY set - using raw key")
            return encrypted_key
            
        except Exception as e:
            logger.error(f"Error decrypting agent key: {e}")
            return None
    
    async def check_low_balances(self):
        try:
            users = await self.db.get_users_with_recurring_payments()
            
            for user_address in users:
                for network_name in ['sepolia', 'mainnet']:
                    agent_wallet = await self.db.get_agent_wallet(user_address, network_name)
                    if not agent_wallet:
                        continue
                    
                    balance = await self.get_agent_balance(agent_wallet.agent_address, network_name)
                    balance_mnee = balance / 10**18
                    
                    upcoming = await self.db.get_upcoming_payments(user_address, network_name, days=7)
                    upcoming_total = sum(p.amount for p in upcoming)
                    
                    if balance_mnee < upcoming_total:
                        await self.create_notification(
                            user_address,
                            "low_balance",
                            f"Agent wallet on {network_name} has {balance_mnee:.2f} MNEE but needs {upcoming_total:.2f} MNEE for upcoming payments"
                        )
                        
        except Exception as e:
            logger.error(f"Error checking low balances: {e}")
    
    async def create_notification(self, user_address: str, notification_type: str, message: str):
        try:
            await self.db.create_notification({
                'user_address': user_address,
                'type': notification_type,
                'message': message
            })
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
    
    async def cleanup_old_logs(self):
        try:
            cutoff = datetime.utcnow() - timedelta(days=30)
            await self.db.delete_old_execution_logs(cutoff)
            logger.info("🧹 Cleaned up old execution logs")
        except Exception as e:
            logger.error(f"Error cleaning up logs: {e}")


class RecurringDatabase:
    async def get_due_payments(self) -> List[RecurringPayment]:
        raise NotImplementedError
    
    async def get_agent_wallet(self, user_address: str, network: str = None) -> Optional[AgentWallet]:
        raise NotImplementedError
    
    async def update_payment_execution(self, payment_id: str, tx_hash: str, next_date: datetime, amount: float):
        raise NotImplementedError
    
    async def update_payment_failure(self, payment_id: str, error: str):
        raise NotImplementedError
    
    async def get_users_with_recurring_payments(self) -> List[str]:
        raise NotImplementedError
    
    async def get_upcoming_payments(self, user_address: str, network: str, days: int = 7) -> List[RecurringPayment]:
        raise NotImplementedError
    
    async def create_notification(self, data: Dict[str, Any]):
        raise NotImplementedError
    
    async def delete_old_execution_logs(self, before: datetime):
        raise NotImplementedError


class PostgreSQLRecurringDatabase(RecurringDatabase):
    
    def __init__(self):
        from database import init_db
        init_db()
    
    def _parse_datetime(self, value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                clean_value = value.replace('Z', '').replace('+00:00', '')
                return datetime.fromisoformat(clean_value)
            except ValueError:
                try:
                    return datetime.strptime(clean_value, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    return None
        return None
    
    async def get_due_payments(self) -> List[RecurringPayment]:
        from database import get_due_schedules, get_due_savings_deposits
        from database import get_connection
        
        now = datetime.utcnow()
        payments = []
        
        schedules = get_due_schedules(now)
        for s in schedules:
            next_exec = self._parse_datetime(s['next_execution'])
            if next_exec and next_exec <= now:
                payments.append(RecurringPayment(
                    id=s['id'],
                    user_address=s['user_address'],
                    agent_wallet_address=s.get('agent_address', ''),
                    vault_address=s['vault_address'],
                    payment_type=PaymentType.VENDOR,
                    destination=s['vendor_address'],
                    destination_name=s['vendor'],
                    amount=s['amount'],
                    frequency=PaymentFrequency(s['frequency']),
                    execution_time=s.get('execution_time', '09:00'),
                    next_execution=next_exec,
                    is_active=True,
                    created_at=self._parse_datetime(s['created_at']),
                    network=s.get('network', 'mainnet')
                ))
        
        deposits = get_due_savings_deposits(now)
        for d in deposits:
            next_dep = self._parse_datetime(d['next_deposit'])
            if next_dep and next_dep <= now:
                payments.append(RecurringPayment(
                    id=d['id'],
                    user_address=d['user_address'],
                    agent_wallet_address=d.get('agent_address', ''),
                    vault_address=d['vault_address'],
                    payment_type=PaymentType.SAVINGS,
                    destination='savings',
                    destination_name=d['name'],
                    amount=d['amount'],
                    frequency=PaymentFrequency(d['frequency']) if d['frequency'] else PaymentFrequency.MONTHLY,
                    execution_time=d.get('execution_time', '09:00'),
                    next_execution=next_dep,
                    is_active=True,
                    created_at=self._parse_datetime(d['created_at']),
                    savings_plan_id=d.get('contract_plan_id'),
                    network=d.get('network', 'mainnet')
                ))
        
        return payments
    
    async def get_agent_wallet(self, user_address: str, network: str = None) -> Optional[AgentWallet]:
        from database import get_agent_wallet, get_connection
        from psycopg2.extras import RealDictCursor
        
        with get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if network:
                cursor.execute(
                    "SELECT * FROM agent_wallets WHERE user_address = %s AND network = %s",
                    (user_address.lower(), network)
                )
            else:
                cursor.execute(
                    "SELECT * FROM agent_wallets WHERE user_address = %s",
                    (user_address.lower(),)
                )
            row = cursor.fetchone()
        
        if not row:
            return None
        
        return AgentWallet(
            user_address=row['user_address'],
            agent_address=row['agent_address'],
            encrypted_key=row['encrypted_key'],
            vault_address=row['vault_address'],
            created_at=self._parse_datetime(row['created_at']),
            network=row.get('network', 'mainnet')
        )
    
    async def update_payment_execution(self, payment_id: str, tx_hash: str, next_date: datetime, amount: float):
        from database import update_schedule_execution, update_savings_deposit, log_execution
        
        if payment_id.startswith('sched_'):
            update_schedule_execution(payment_id, tx_hash, next_date.isoformat())
        else:
            update_savings_deposit(payment_id, amount, next_date.isoformat(), tx_hash)
        
        log_execution(
            schedule_id=payment_id if payment_id.startswith('sched_') else None,
            savings_plan_id=payment_id if not payment_id.startswith('sched_') else None,
            user_address='',
            execution_type='auto',
            amount=amount,
            destination='',
            tx_hash=tx_hash,
            status='success'
        )
    
    async def update_payment_failure(self, payment_id: str, error: str):
        from database import update_schedule_failure, log_execution
        
        if payment_id.startswith('sched_'):
            update_schedule_failure(payment_id, error)
        
        log_execution(
            schedule_id=payment_id if payment_id.startswith('sched_') else None,
            savings_plan_id=payment_id if not payment_id.startswith('sched_') else None,
            user_address='',
            execution_type='auto',
            amount=0,
            destination='',
            tx_hash=None,
            status='failed',
            error_message=error
        )
    
    async def get_users_with_recurring_payments(self) -> List[str]:
        from database import get_connection
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT DISTINCT user_address FROM recurring_schedules WHERE is_active = 1
                UNION
                SELECT DISTINCT user_address FROM savings_plans WHERE is_active = 1 AND is_recurring = 1
            """)
            return [row[0] for row in cursor.fetchall()]
    
    async def get_upcoming_payments(self, user_address: str, network: str, days: int = 7) -> List[RecurringPayment]:
        from database import get_recurring_schedules, get_savings_plans
        
        payments = []
        cutoff = datetime.utcnow() + timedelta(days=days)
        
        schedules = get_recurring_schedules(user_address, active_only=True)
        for s in schedules:
            if s.get('network', 'mainnet') != network:
                continue
            next_exec = self._parse_datetime(s['next_execution'])
            if next_exec and next_exec <= cutoff:
                payments.append(RecurringPayment(
                    id=s['id'],
                    user_address=s['user_address'],
                    agent_wallet_address=s.get('agent_address', ''),
                    vault_address=s['vault_address'],
                    payment_type=PaymentType.VENDOR,
                    destination=s['vendor_address'],
                    destination_name=s['vendor'],
                    amount=s['amount'],
                    frequency=PaymentFrequency(s['frequency']),
                    execution_time=s.get('execution_time', '09:00'),
                    next_execution=next_exec,
                    is_active=True,
                    created_at=self._parse_datetime(s['created_at']),
                    network=s.get('network', 'mainnet')
                ))
        
        return payments
    
    async def create_notification(self, data: Dict[str, Any]):
        from database import create_notification
        create_notification(
            user_address=data['user_address'],
            notification_type=data['type'],
            message=data['message']
        )
    
    async def delete_old_execution_logs(self, before: datetime):
        from database import get_connection
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM execution_log WHERE executed_at < %s",
                (before,)
            )
            conn.commit()


async def main():
    db = PostgreSQLRecurringDatabase()
    executor = RecurringExecutor(db)
    
    await executor.start()
    
    logger.info("✅ Executor running. Press Ctrl+C to stop.")
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await executor.stop()


if __name__ == "__main__":
    asyncio.run(main())