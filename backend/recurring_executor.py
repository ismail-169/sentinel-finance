"""
recurring_executor.py
Background service for executing recurring payments from Agent Wallets

This service:
1. Checks for due recurring payments every minute
2. Validates agent wallet balance
3. Executes payments to trusted vendors or savings contract
4. Updates next payment dates
5. Sends notifications for low balance / execution status
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


RPC_URL = os.getenv('WEB3_RPC_URL', 'https://eth-sepolia.g.alchemy.com/v2/demo')
MNEE_ADDRESS = os.getenv('MNEE_TOKEN_ADDRESS', '0x250ff89cf1518F42F3A4c927938ED73444491715')
SAVINGS_ADDRESS = os.getenv('SAVINGS_CONTRACT_ADDRESS', '')
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
        """Handle unknown frequency values gracefully"""
        return cls.MONTHLY


@dataclass
class RecurringPayment:
    """Recurring payment configuration"""
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
    last_executed: Optional[datetime] = None
    execution_count: int = 0
    
   
    savings_plan_id: Optional[int] = None


@dataclass
class AgentWallet:
    """Agent wallet data"""
    user_address: str          
    agent_address: str         
    encrypted_key: str          
    vault_address: str         
    created_at: datetime


class RecurringExecutor:
    """Main executor service"""
    
    def __init__(self, database):
        self.db = database
        self.web3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.scheduler = AsyncIOScheduler()
        self.mnee_contract = self.web3.eth.contract(
            address=Web3.to_checksum_address(MNEE_ADDRESS),
            abi=MNEE_ABI
        )
        
       
        self.savings_contract = None
        if SAVINGS_ADDRESS:
            savings_abi = load_abi('SentinelSavings.json')
            if savings_abi:
                self.savings_contract = self.web3.eth.contract(
                    address=Web3.to_checksum_address(SAVINGS_ADDRESS),
                    abi=savings_abi
                )
    
    async def start(self):
        """Start the scheduler"""
        logger.info("🚀 Starting Recurring Payment Executor...")
        
       
        self.scheduler.add_job(
            self.check_due_payments,
            IntervalTrigger(minutes=1),
            id='check_due_payments',
            replace_existing=True
        )
        
       
        self.scheduler.add_job(
            self.check_low_balances,
            IntervalTrigger(hours=1),
            id='check_low_balances',
            replace_existing=True
        )
        
       
        self.scheduler.add_job(
            self.cleanup_old_logs,
            CronTrigger(hour=3, minute=0), 
            id='cleanup_logs',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("✅ Scheduler started")
    
    async def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("🛑 Scheduler stopped")
    
    async def check_due_payments(self):
        """Check and execute due payments"""
        try:
            now = datetime.utcnow()
            due_payments = await self.db.get_due_payments(now)
            
            if not due_payments:
                return
            
            logger.info(f"📋 Found {len(due_payments)} due payments")
            
            for payment in due_payments:
                await self.execute_payment(payment)
                
        except Exception as e:
            logger.error(f"Error checking due payments: {e}")
    
    async def execute_payment(self, payment: RecurringPayment):
        """Execute a single recurring payment"""
        try:
            logger.info(f"💸 Executing payment {payment.id}: {payment.amount} MNEE to {payment.destination_name}")
            
           
            agent_wallet = await self.db.get_agent_wallet(payment.user_address)
            if not agent_wallet:
                logger.error(f"Agent wallet not found for {payment.user_address}")
                await self.create_notification(
                    payment.user_address,
                    "error",
                    f"Payment failed: Agent wallet not found for {payment.destination_name}"
                )
                return
            
            
            private_key = await self.decrypt_agent_key(agent_wallet.encrypted_key, payment.user_address)
            if not private_key:
                logger.error("Failed to decrypt agent wallet key")
                return
            
            
            balance = self.get_agent_balance(agent_wallet.agent_address)
            amount_wei = self.web3.to_wei(payment.amount, 'ether')
            
            if balance < amount_wei:
                logger.warning(f"Insufficient balance: {balance} < {amount_wei}")
                await self.create_notification(
                    payment.user_address,
                    "low_balance",
                    f"Insufficient balance for {payment.destination_name}. Need {payment.amount} MNEE, have {self.web3.from_wei(balance, 'ether')} MNEE"
                )
                return
            
           
            if not self.is_valid_destination(payment, agent_wallet.vault_address):
                logger.error(f"Invalid destination: {payment.destination}")
                return
            
           
            tx_hash = None
            if payment.payment_type == PaymentType.VENDOR:
                tx_hash = await self.send_to_vendor(
                    private_key,
                    payment.destination,
                    amount_wei
                )
            elif payment.payment_type == PaymentType.SAVINGS:
                tx_hash = await self.deposit_to_savings(
                    private_key,
                    payment.savings_plan_id,
                    amount_wei,
                    agent_wallet.agent_address
                )
            
            if tx_hash:
              
                next_date = self.calculate_next_date(payment.frequency, payment.execution_time)
                await self.db.update_payment_execution(
                    payment.id,
                    tx_hash,
                    next_date
                )
                
               
                await self.create_notification(
                    payment.user_address,
                    "success",
                    f"✅ Paid {payment.amount} MNEE to {payment.destination_name}",
                    tx_hash
                )
                
                logger.info(f"✅ Payment executed: {tx_hash}")
            else:
                logger.error("Payment execution failed - no tx hash")
                
        except Exception as e:
            logger.error(f"Error executing payment {payment.id}: {e}")
            await self.create_notification(
                payment.user_address,
                "error",
                f"Payment failed for {payment.destination_name}: {str(e)}"
            )
    
    def get_agent_balance(self, agent_address: str) -> int:
        """Get MNEE balance of agent wallet"""
        try:
            return self.mnee_contract.functions.balanceOf(
                Web3.to_checksum_address(agent_address)
            ).call()
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
            return 0
    
    def is_valid_destination(self, payment: RecurringPayment, vault_address: str) -> bool:
        """
        Validate payment destination
        Agent wallet can ONLY send to:
        - User's own vault
        - Trusted vendors (verified in database)
        - Savings contract
        """
        destination = payment.destination.lower()
        vault = vault_address.lower()
        
       
        if destination == vault:
            return True
        
       
        if SAVINGS_ADDRESS and destination == SAVINGS_ADDRESS.lower():
            return True
        
       
        if payment.payment_type == PaymentType.VENDOR:
           
            return True  # TODO: Implement trusted vendor check
        
        return False
    
    async def send_to_vendor(self, private_key: str, vendor_address: str, amount_wei: int) -> Optional[str]:
        """Send MNEE to vendor address"""
        try:
            account = Account.from_key(private_key)
            
            
            nonce = self.web3.eth.get_transaction_count(account.address)
            gas_price = self.web3.eth.gas_price
            
            tx = self.mnee_contract.functions.transfer(
                Web3.to_checksum_address(vendor_address),
                amount_wei
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 100000,
                'gasPrice': gas_price
            })
            
           
            signed_tx = self.web3.eth.account.sign_transaction(tx, private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
           
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                return tx_hash.hex()
            else:
                logger.error("Transaction failed")
                return None
                
        except Exception as e:
            logger.error(f"Error sending to vendor: {e}")
            return None
    
    async def deposit_to_savings(
        self, 
        private_key: str, 
        plan_id: int, 
        amount_wei: int,
        agent_address: str
    ) -> Optional[str]:
        """Deposit MNEE to savings contract"""
        if not self.savings_contract:
            logger.error("Savings contract not configured")
            return None
            
        try:
            account = Account.from_key(private_key)
            nonce = self.web3.eth.get_transaction_count(account.address)
            gas_price = self.web3.eth.gas_price
            
            approve_tx = self.mnee_contract.functions.approve(
                SAVINGS_ADDRESS,
                amount_wei
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 60000,
                'gasPrice': gas_price
            })
            
            signed_approve = self.web3.eth.account.sign_transaction(approve_tx, private_key)
            approve_hash = self.web3.eth.send_raw_transaction(signed_approve.rawTransaction)
            self.web3.eth.wait_for_transaction_receipt(approve_hash, timeout=120)
            
            nonce += 1
            deposit_tx = self.savings_contract.functions.depositFromAgent(
                plan_id,
                amount_wei,
                Web3.to_checksum_address(agent_address)
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 150000,
                'gasPrice': gas_price
            })
            
            signed_deposit = self.web3.eth.account.sign_transaction(deposit_tx, private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_deposit.rawTransaction)
            
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                return tx_hash.hex()
            else:
                logger.error("Savings deposit failed")
                return None
                
        except Exception as e:
            logger.error(f"Error depositing to savings: {e}")
            return None
    
   def calculate_next_date(self, frequency: PaymentFrequency, execution_time: str) -> datetime:
        """Calculate next execution date based on frequency"""
        now = datetime.utcnow()
        
       
        try:
            hour, minute = map(int, execution_time.split(':'))
        except (ValueError, AttributeError):
            hour, minute = 9, 0  
        
        if frequency == PaymentFrequency.DAILY:
            next_date = now + timedelta(days=1)
        elif frequency == PaymentFrequency.WEEKLY:
            next_date = now + timedelta(weeks=1)
        elif frequency == PaymentFrequency.BIWEEKLY:
            next_date = now + timedelta(weeks=2)
        elif frequency == PaymentFrequency.MONTHLY:
            
            month = now.month + 1
            year = now.year
            day = min(now.day, 28) 
            if month > 12:
                month = 1
                year += 1
            next_date = now.replace(year=year, month=month, day=day)
        elif frequency == PaymentFrequency.YEARLY:
            next_date = now.replace(year=now.year + 1)
        else:
            next_date = now + timedelta(days=1)
        
        return next_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
   async def decrypt_agent_key(self, encrypted_key: str, user_address: str) -> Optional[str]:
        """
        Decrypt agent wallet private key
        
     
        """
        try:
           
            if encrypted_key.startswith('0x') or len(encrypted_key) == 64:
                return encrypted_key
            
            
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
        """Check for agent wallets with low balance relative to upcoming payments"""
        try:
          
            users = await self.db.get_users_with_recurring_payments()
            
            for user_address in users:
                agent_wallet = await self.db.get_agent_wallet(user_address)
                if not agent_wallet:
                    continue
                
                upcoming = await self.db.get_upcoming_payments(user_address, days=7)
                total_needed = sum(p.amount for p in upcoming)
                
              
                balance_wei = self.get_agent_balance(agent_wallet.agent_address)
                balance = float(self.web3.from_wei(balance_wei, 'ether'))
                
                if balance < total_needed:
                    shortfall = total_needed - balance
                    await self.create_notification(
                        user_address,
                        "low_balance_warning",
                        f"⚠️ Agent wallet needs {shortfall:.2f} MNEE more for upcoming payments"
                    )
                    
        except Exception as e:
            logger.error(f"Error checking low balances: {e}")
    
    async def create_notification(
        self, 
        user_address: str, 
        notification_type: str, 
        message: str,
        tx_hash: Optional[str] = None
    ):
        """Create notification for user"""
        try:
            await self.db.create_notification({
                'user_address': user_address,
                'type': notification_type,
                'message': message,
                'tx_hash': tx_hash,
                'created_at': datetime.utcnow(),
                'read': False
            })
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
    
    async def cleanup_old_logs(self):
        """Clean up execution logs older than 90 days"""
        try:
            cutoff = datetime.utcnow() - timedelta(days=90)
            deleted = await self.db.delete_old_execution_logs(cutoff)
            logger.info(f"🧹 Cleaned up {deleted} old execution logs")
        except Exception as e:
            logger.error(f"Error cleaning up logs: {e}")

class RecurringDatabase:
    """Database interface for recurring payments"""
    
    async def get_due_payments(self, now: datetime) -> List[RecurringPayment]:
        """Get all payments due for execution"""
        raise NotImplementedError
    
    async def get_agent_wallet(self, user_address: str) -> Optional[AgentWallet]:
        """Get agent wallet for user"""
        raise NotImplementedError
    
    async def update_payment_execution(self, payment_id: str, tx_hash: str, next_date: datetime):
        """Update payment after execution"""
        raise NotImplementedError
    
    async def get_users_with_recurring_payments(self) -> List[str]:
        """Get all users with active recurring payments"""
        raise NotImplementedError
    
    async def get_upcoming_payments(self, user_address: str, days: int) -> List[RecurringPayment]:
        """Get upcoming payments for user"""
        raise NotImplementedError
    
    async def create_notification(self, data: Dict[str, Any]):
        """Create notification"""
        raise NotImplementedError
    
    async def delete_old_execution_logs(self, before: datetime) -> int:
        """Delete old execution logs"""
        raise NotImplementedError



class SQLiteRecurringDatabase(RecurringDatabase):
    """SQLite implementation of RecurringDatabase interface"""
    
    def __init__(self):
        from database import init_db
        init_db()
    
    async def get_due_payments(self, now: datetime) -> List[RecurringPayment]:
        from database import get_due_schedules, get_due_savings_deposits
        
        payments = []
        
       
        schedules = get_due_schedules(now)
        for s in schedules:
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
                next_execution=datetime.fromisoformat(s['next_execution']),
                is_active=bool(s['is_active']),
                created_at=datetime.fromisoformat(s['created_at']),
                last_executed=datetime.fromisoformat(s['last_executed']) if s.get('last_executed') else None,
                execution_count=s.get('execution_count', 0)
            ))
        
       
        deposits = get_due_savings_deposits(now)
        for d in deposits:
            payments.append(RecurringPayment(
                id=d['id'],
                user_address=d['user_address'],
                agent_wallet_address=d.get('agent_address', ''),
                vault_address=d['vault_address'],
                payment_type=PaymentType.SAVINGS,
                destination=str(d.get('contract_plan_id', '')),
                destination_name=d['name'],
                amount=d['amount'],
                frequency=PaymentFrequency(d.get('frequency', 'monthly')),
                execution_time=d.get('execution_time', '09:00'),
                next_execution=datetime.fromisoformat(d['next_deposit']) if d.get('next_deposit') else datetime.utcnow(),
                is_active=bool(d['is_active']),
                created_at=datetime.fromisoformat(d['created_at']),
                savings_plan_id=d.get('contract_plan_id')
            ))
        
        return payments
    
    async def get_agent_wallet(self, user_address: str) -> Optional[AgentWallet]:
        from database import get_agent_wallet
        
        wallet = get_agent_wallet(user_address)
        if not wallet:
            return None
        
        return AgentWallet(
            user_address=wallet['user_address'],
            agent_address=wallet['agent_address'],
            encrypted_key=wallet['encrypted_key'],
            vault_address=wallet['vault_address'],
            created_at=datetime.fromisoformat(wallet['created_at'])
        )
    
    async def update_payment_execution(self, payment_id: str, tx_hash: str, next_date: datetime):
        from database import update_schedule_execution, update_savings_deposit, log_execution
        
        
        if payment_id.startswith('sched_'):
            update_schedule_execution(payment_id, tx_hash, next_date.isoformat())
        else:
           
            update_savings_deposit(payment_id, tx_hash)
        
       
        log_execution({
            'schedule_id': payment_id if payment_id.startswith('sched_') else None,
            'savings_plan_id': payment_id if not payment_id.startswith('sched_') else None,
            'user_address': '', 
            'execution_type': 'auto',
            'amount': 0,  
            'destination': '',
            'tx_hash': tx_hash,
            'status': 'success'
        })
    
    async def update_payment_failure(self, payment_id: str, error: str):
        from database import update_schedule_failure, log_execution
        
        if payment_id.startswith('sched_'):
            update_schedule_failure(payment_id, error)
        
        log_execution({
            'schedule_id': payment_id if payment_id.startswith('sched_') else None,
            'savings_plan_id': payment_id if not payment_id.startswith('sched_') else None,
            'user_address': '',
            'execution_type': 'auto',
            'amount': 0,
            'destination': '',
            'tx_hash': None,
            'status': 'failed',
            'error_message': error
        })
    
    async def get_users_with_recurring_payments(self) -> List[str]:
        from database import get_connection
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT DISTINCT user_address FROM recurring_schedules WHERE is_active = 1
                UNION
                SELECT DISTINCT user_address FROM savings_plans WHERE is_active = 1 AND withdrawn = 0
            """)
            return [row[0] for row in cursor.fetchall()]
    
    async def get_upcoming_payments(self, user_address: str, days: int) -> List[RecurringPayment]:
        from database import get_recurring_schedules, get_savings_plans
        
        payments = []
        cutoff = datetime.utcnow() + timedelta(days=days)
        
        schedules = get_recurring_schedules(user_address, active_only=True)
        for s in schedules:
            next_exec = datetime.fromisoformat(s['next_execution'])
            if next_exec <= cutoff:
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
                    created_at=datetime.fromisoformat(s['created_at'])
                ))
        
        return payments
    
    async def create_notification(self, data: Dict[str, Any]):
        from database import create_notification
        create_notification(
            user_address=data['user_address'],
            notification_type=data['type'],
            message=data['message'],
            tx_hash=data.get('tx_hash')
        )
    
    async def delete_old_execution_logs(self, before: datetime) -> int:
        from database import get_connection
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM execution_log WHERE executed_at < ?",
                (before.isoformat(),)
            )
            conn.commit()
            return cursor.rowcount


if __name__ == "__main__":
    async def main():
        logger.info("🚀 Initializing Recurring Payment Executor...")
        
        db = SQLiteRecurringDatabase()
        executor = RecurringExecutor(db)
        
        await executor.start()
        
        logger.info("✅ Executor running. Press Ctrl+C to stop.")
        
       
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down...")
            await executor.stop()
    
    asyncio.run(main())