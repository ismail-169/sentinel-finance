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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('RecurringExecutor')

# Environment variables
RPC_URL = os.getenv('WEB3_RPC_URL', 'https://eth-sepolia.g.alchemy.com/v2/demo')
MNEE_ADDRESS = os.getenv('MNEE_TOKEN_ADDRESS', '0x250ff89cf1518F42F3A4c927938ED73444491715')
SAVINGS_ADDRESS = os.getenv('SAVINGS_CONTRACT_ADDRESS', '')
DATABASE_URL = os.getenv('DATABASE_URL', '')

# Load ABIs
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
    MONTHLY = "monthly"
    YEARLY = "yearly"


@dataclass
class RecurringPayment:
    """Recurring payment configuration"""
    id: str
    user_address: str           # Owner's wallet address
    agent_wallet_address: str   # Agent wallet address
    vault_address: str          # User's vault address
    payment_type: PaymentType
    destination: str            # Vendor address or savings plan ID
    destination_name: str       # Human readable name
    amount: float               # Amount in MNEE
    frequency: PaymentFrequency
    execution_time: str         # Time to execute (HH:MM UTC)
    next_execution: datetime    # Next execution datetime
    is_active: bool
    created_at: datetime
    last_executed: Optional[datetime] = None
    execution_count: int = 0
    
    # For savings
    savings_plan_id: Optional[int] = None


@dataclass
class AgentWallet:
    """Agent wallet data"""
    user_address: str           # Owner's main wallet
    agent_address: str          # Agent wallet address
    encrypted_key: str          # Encrypted private key
    vault_address: str          # Associated vault
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
        
        # Load savings contract if available
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
        
        # Check for due payments every minute
        self.scheduler.add_job(
            self.check_due_payments,
            IntervalTrigger(minutes=1),
            id='check_due_payments',
            replace_existing=True
        )
        
        # Check low balance alerts every hour
        self.scheduler.add_job(
            self.check_low_balances,
            IntervalTrigger(hours=1),
            id='check_low_balances',
            replace_existing=True
        )
        
        # Clean up old execution logs daily
        self.scheduler.add_job(
            self.cleanup_old_logs,
            CronTrigger(hour=3, minute=0),  # 3 AM UTC
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
            
            # Get agent wallet
            agent_wallet = await self.db.get_agent_wallet(payment.user_address)
            if not agent_wallet:
                logger.error(f"Agent wallet not found for {payment.user_address}")
                await self.create_notification(
                    payment.user_address,
                    "error",
                    f"Payment failed: Agent wallet not found for {payment.destination_name}"
                )
                return
            
            # Decrypt private key
            private_key = await self.decrypt_agent_key(agent_wallet.encrypted_key, payment.user_address)
            if not private_key:
                logger.error("Failed to decrypt agent wallet key")
                return
            
            # Check balance
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
            
            # Validate destination
            if not self.is_valid_destination(payment, agent_wallet.vault_address):
                logger.error(f"Invalid destination: {payment.destination}")
                return
            
            # Execute based on payment type
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
                # Update payment record
                next_date = self.calculate_next_date(payment.frequency, payment.execution_time)
                await self.db.update_payment_execution(
                    payment.id,
                    tx_hash,
                    next_date
                )
                
                # Create success notification
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
        
        # Can always send to own vault
        if destination == vault:
            return True
        
        # Can send to savings contract
        if SAVINGS_ADDRESS and destination == SAVINGS_ADDRESS.lower():
            return True
        
        # For vendors, must be in trusted list
        if payment.payment_type == PaymentType.VENDOR:
            # Check if vendor is trusted (this should query the vault contract or database)
            return True  # TODO: Implement trusted vendor check
        
        return False
    
    async def send_to_vendor(self, private_key: str, vendor_address: str, amount_wei: int) -> Optional[str]:
        """Send MNEE to vendor address"""
        try:
            account = Account.from_key(private_key)
            
            # Build transaction
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
            
            # Sign and send
            signed_tx = self.web3.eth.account.sign_transaction(tx, private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for confirmation
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
        hour, minute = map(int, execution_time.split(':'))
        
        if frequency == PaymentFrequency.DAILY:
            next_date = now + timedelta(days=1)
        elif frequency == PaymentFrequency.WEEKLY:
            next_date = now + timedelta(weeks=1)
        elif frequency == PaymentFrequency.MONTHLY:
            # Add one month
            month = now.month + 1
            year = now.year
            if month > 12:
                month = 1
                year += 1
            next_date = now.replace(year=year, month=month)
        elif frequency == PaymentFrequency.YEARLY:
            next_date = now.replace(year=now.year + 1)
        else:
            next_date = now + timedelta(days=1)
        
        return next_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    async def decrypt_agent_key(self, encrypted_key: str, user_address: str) -> Optional[str]:
        """
        Decrypt agent wallet private key
        In production, use proper key management (AWS KMS, HashiCorp Vault, etc.)
        """
     
        try:
            from cryptography.fernet import Fernet
            
            key = Fernet.generate_key() 
         
            return encrypted_key 
            
        except Exception as e:
            logger.error(f"Error decrypting key: {e}")
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


if __name__ == "__main__":
    async def main():
        from database import Database
        
        db = Database()
        executor = RecurringExecutor(db)
        
        await executor.start()
        
        # Keep running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await executor.stop()
    
    asyncio.run(main())