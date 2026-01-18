import sqlite3
import hashlib
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from cryptography.fernet import Fernet
import os

DB_PATH = Path(__file__).parent.parent / "data" / "sentinel.db"
ENCRYPTION_KEY = os.getenv("DB_ENCRYPTION_KEY")

_local = threading.local()

def get_cipher():
    if ENCRYPTION_KEY:
        return Fernet(ENCRYPTION_KEY.encode())
    return None

def encrypt_sensitive(value: str) -> str:
    cipher = get_cipher()
    if cipher and value:
        return cipher.encrypt(value.encode()).decode()
    return value

def decrypt_sensitive(value: str) -> str:
    cipher = get_cipher()
    if cipher and value:
        try:
            return cipher.decrypt(value.encode()).decode()
        except:
            return value
    return value

@contextmanager
def get_connection():
    if not hasattr(_local, "connection") or _local.connection is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _local.connection = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30.0)
        _local.connection.row_factory = sqlite3.Row
        _local.connection.execute("PRAGMA foreign_keys = ON")
        _local.connection.execute("PRAGMA journal_mode = WAL")
        _local.connection.execute("PRAGMA synchronous = NORMAL")
        _local.connection.execute("PRAGMA cache_size = -64000")
        _local.connection.execute("PRAGMA temp_store = MEMORY")
    try:
        yield _local.connection
    except Exception as e:
        _local.connection.rollback()
        raise e

def compute_hash(data: Dict[str, Any]) -> str:
    sorted_data = json.dumps(data, sort_keys=True)
    return hashlib.sha256(sorted_data.encode()).hexdigest()

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vaults (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT UNIQUE NOT NULL,
                vault_address TEXT UNIQUE NOT NULL,
                network TEXT DEFAULT 'sepolia',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_id INTEGER NOT NULL,
                vault_address TEXT NOT NULL,
                agent TEXT NOT NULL,
                vendor TEXT NOT NULL,
                amount_wei TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                execute_after INTEGER NOT NULL,
                executed INTEGER DEFAULT 0,
                revoked INTEGER DEFAULT 0,
                reason TEXT DEFAULT '',
                risk_score REAL DEFAULT 0,
                risk_factors TEXT DEFAULT '[]',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                hash TEXT NOT NULL,
                UNIQUE(tx_id, vault_address)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                address TEXT PRIMARY KEY,
                total_transactions INTEGER DEFAULT 0,
                total_volume_wei TEXT DEFAULT '0',
                avg_amount_wei TEXT DEFAULT '0',
                last_active INTEGER,
                risk_level TEXT DEFAULT 'low',
                metadata TEXT DEFAULT '{}',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vendors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT NOT NULL,
                address TEXT NOT NULL,
                trusted INTEGER DEFAULT 0,
                total_received_wei TEXT DEFAULT '0',
                transaction_count INTEGER DEFAULT 0,
                name TEXT DEFAULT '',
                metadata TEXT DEFAULT '{}',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(wallet_address, address)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_id INTEGER NOT NULL,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                acknowledged INTEGER DEFAULT 0,
                acknowledged_by TEXT,
                acknowledged_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tx_id) REFERENCES transactions (tx_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                performed_by TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                hash TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'viewer',
                is_active INTEGER DEFAULT 1,
                last_login TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rate_limits (
                key TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                window_start INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_address TEXT UNIQUE NOT NULL,
                agent_address TEXT UNIQUE NOT NULL,
                vault_address TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recurring_schedules (
                id TEXT PRIMARY KEY,
                user_address TEXT NOT NULL,
                agent_address TEXT NOT NULL,
                vault_address TEXT NOT NULL,
                payment_type TEXT DEFAULT 'vendor',
                vendor TEXT NOT NULL,
                vendor_address TEXT NOT NULL,
                amount REAL NOT NULL,
                frequency TEXT NOT NULL,
                execution_time TEXT DEFAULT '09:00',
                start_date TEXT NOT NULL,
                next_execution TEXT NOT NULL,
                reason TEXT DEFAULT '',
                is_trusted INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                execution_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                last_executed TEXT,
                last_error TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS savings_plans (
                id TEXT PRIMARY KEY,
                user_address TEXT NOT NULL,
                agent_address TEXT,
                vault_address TEXT NOT NULL,
                contract_plan_id INTEGER,
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                frequency TEXT,
                lock_days INTEGER NOT NULL,
                lock_type INTEGER DEFAULT 0,
                execution_time TEXT DEFAULT '09:00',
                start_date TEXT NOT NULL,
                next_deposit TEXT,
                unlock_date TEXT NOT NULL,
                reason TEXT DEFAULT '',
                is_recurring INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1,
                total_deposits INTEGER DEFAULT 1,
                deposits_completed INTEGER DEFAULT 0,
                total_saved REAL DEFAULT 0,
                target_amount REAL NOT NULL,
                withdrawn INTEGER DEFAULT 0,
                last_deposit TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS execution_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id TEXT,
                savings_plan_id TEXT,
                user_address TEXT NOT NULL,
                execution_type TEXT NOT NULL,
                amount REAL NOT NULL,
                destination TEXT NOT NULL,
                tx_hash TEXT,
                status TEXT NOT NULL,
                error_message TEXT,
                executed_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_address TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                message TEXT NOT NULL,
                tx_hash TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_agent ON transactions(agent)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_vendor ON transactions(vendor)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_executed ON transactions(executed)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_revoked ON transactions(revoked)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_risk ON transactions(risk_score)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_vault ON transactions(vault_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vaults_wallet ON vaults(wallet_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vendors_wallet ON vendors(wallet_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_tx ON alerts(tx_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged)")
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_wallets_user ON agent_wallets(user_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_schedules(user_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_schedules(next_execution)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_schedules(is_active)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_savings_user ON savings_plans(user_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_savings_next ON savings_plans(next_deposit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_savings_active ON savings_plans(is_active)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_execution_user ON execution_log(user_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)")

        conn.commit()

def save_agent_wallet(user_address: str, agent_address: str, vault_address: str, encrypted_key: str) -> bool:
    """Save or update agent wallet for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT * FROM agent_wallets WHERE user_address = ?", (user_address.lower(),))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE agent_wallets 
                SET agent_address = ?, vault_address = ?, encrypted_key = ?, updated_at = ?
                WHERE user_address = ?
            """, (agent_address.lower(), vault_address.lower(), encrypted_key, now_iso, user_address.lower()))
        else:
            cursor.execute("""
                INSERT INTO agent_wallets (user_address, agent_address, vault_address, encrypted_key, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_address.lower(), agent_address.lower(), vault_address.lower(), encrypted_key, now_iso, now_iso))
        
        conn.commit()
        return cursor.rowcount > 0


def get_agent_wallet(user_address: str) -> Optional[Dict[str, Any]]:
    """Get agent wallet for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM agent_wallets WHERE user_address = ?", (user_address.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_agent_wallet(user_address: str) -> bool:
    """Delete agent wallet for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM agent_wallets WHERE user_address = ?", (user_address.lower(),))
        conn.commit()
        return cursor.rowcount > 0

def save_recurring_schedule(schedule: Dict[str, Any]) -> bool:
    """Save or update recurring schedule"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT * FROM recurring_schedules WHERE id = ?", (schedule['id'],))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE recurring_schedules SET
                    vendor = ?, vendor_address = ?, amount = ?, frequency = ?,
                    execution_time = ?, next_execution = ?, reason = ?,
                    is_trusted = ?, is_active = ?, updated_at = ?
                WHERE id = ?
            """, (
                schedule.get('vendor', existing['vendor']),
                schedule.get('vendor_address', existing['vendor_address']),
                schedule.get('amount', existing['amount']),
                schedule.get('frequency', existing['frequency']),
                schedule.get('execution_time', existing['execution_time']),
                schedule.get('next_execution', existing['next_execution']),
                schedule.get('reason', existing['reason']),
                1 if schedule.get('is_trusted', existing['is_trusted']) else 0,
                1 if schedule.get('is_active', existing['is_active']) else 0,
                now_iso, schedule['id']
            ))
        else:
            cursor.execute("""
                INSERT INTO recurring_schedules (
                    id, user_address, agent_address, vault_address, payment_type,
                    vendor, vendor_address, amount, frequency, execution_time,
                    start_date, next_execution, reason, is_trusted, is_active,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                schedule['id'],
                schedule['user_address'].lower(),
                schedule.get('agent_address', '').lower(),
                schedule['vault_address'].lower(),
                schedule.get('payment_type', 'vendor'),
                schedule['vendor'],
                schedule['vendor_address'].lower(),
                schedule['amount'],
                schedule['frequency'],
                schedule.get('execution_time', '09:00'),
                schedule.get('start_date', now_iso),
                schedule['next_execution'],
                schedule.get('reason', ''),
                1 if schedule.get('is_trusted', False) else 0,
                1 if schedule.get('is_active', True) else 0,
                now_iso, now_iso
            ))
        
        conn.commit()
        return cursor.rowcount > 0


def get_recurring_schedules(user_address: str, active_only: bool = True) -> List[Dict[str, Any]]:
    """Get all recurring schedules for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        if active_only:
            cursor.execute("""
                SELECT * FROM recurring_schedules 
                WHERE user_address = ? AND is_active = 1
                ORDER BY next_execution ASC
            """, (user_address.lower(),))
        else:
            cursor.execute("""
                SELECT * FROM recurring_schedules 
                WHERE user_address = ?
                ORDER BY next_execution ASC
            """, (user_address.lower(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_due_schedules(before: datetime) -> List[Dict[str, Any]]:
    """Get all schedules due for execution"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*, a.encrypted_key, a.agent_address
            FROM recurring_schedules s
            LEFT JOIN agent_wallets a ON s.user_address = a.user_address
            WHERE s.is_active = 1 AND s.next_execution <= ?
            ORDER BY s.next_execution ASC
        """, (before.isoformat(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def update_schedule_execution(schedule_id: str, tx_hash: str, next_execution: str) -> bool:
    """Update schedule after successful execution"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute("""
            UPDATE recurring_schedules SET
                next_execution = ?,
                last_executed = ?,
                execution_count = execution_count + 1,
                failed_count = 0,
                last_error = NULL,
                updated_at = ?
            WHERE id = ?
        """, (next_execution, now_iso, now_iso, schedule_id))
        conn.commit()
        return cursor.rowcount > 0


def update_schedule_failure(schedule_id: str, error: str) -> bool:
    """Update schedule after failed execution"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT failed_count FROM recurring_schedules WHERE id = ?", (schedule_id,))
        row = cursor.fetchone()
        failed_count = (row['failed_count'] if row else 0) + 1
        
        is_active = 1 if failed_count < 3 else 0
        
        cursor.execute("""
            UPDATE recurring_schedules SET
                failed_count = ?,
                last_error = ?,
                is_active = ?,
                updated_at = ?
            WHERE id = ?
        """, (failed_count, error, is_active, now_iso, schedule_id))
        conn.commit()
        return cursor.rowcount > 0


def pause_schedule(schedule_id: str) -> bool:
    """Pause a schedule"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE recurring_schedules SET is_active = 0, updated_at = ?
            WHERE id = ?
        """, (datetime.utcnow().isoformat(), schedule_id))
        conn.commit()
        return cursor.rowcount > 0


def resume_schedule(schedule_id: str) -> bool:
    """Resume a schedule"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE recurring_schedules SET is_active = 1, failed_count = 0, updated_at = ?
            WHERE id = ?
        """, (datetime.utcnow().isoformat(), schedule_id))
        conn.commit()
        return cursor.rowcount > 0

def update_schedule(schedule_id: str, updates: Dict[str, Any]) -> bool:
    """Update specific fields of a recurring schedule"""
    if not updates:
        return False
    
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
        set_clauses = []
        values = []
        
        allowed_fields = {
            'vendor': 'vendor',
            'vendor_address': 'vendor_address',
            'amount': 'amount',
            'frequency': 'frequency',
            'execution_time': 'execution_time',
            'next_execution': 'next_execution',
            'reason': 'reason',
            'is_trusted': 'is_trusted',
            'is_active': 'is_active'
        }
        
        for key, db_field in allowed_fields.items():
            if key in updates:
                value = updates[key]
                if key in ('is_trusted', 'is_active'):
                    value = 1 if value else 0
                set_clauses.append(f"{db_field} = ?")
                values.append(value)
        
        if not set_clauses:
            return False
        
        set_clauses.append("updated_at = ?")
        values.append(now_iso)
        
        values.append(schedule_id)
        
        query = f"UPDATE recurring_schedules SET {', '.join(set_clauses)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        
        return cursor.rowcount > 0


def get_schedule_by_id(schedule_id: str) -> Optional[Dict[str, Any]]:
    """Get a single schedule by ID"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recurring_schedules WHERE id = ?", (schedule_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_schedule(schedule_id: str) -> bool:
    """Delete a schedule"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM recurring_schedules WHERE id = ?", (schedule_id,))
        conn.commit()
        return cursor.rowcount > 0


def save_savings_plan(plan: Dict[str, Any]) -> bool:
    """Save or update savings plan"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT * FROM savings_plans WHERE id = ?", (plan['id'],))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE savings_plans SET
                    name = ?, amount = ?, frequency = ?, next_deposit = ?,
                    is_active = ?, deposits_completed = ?, total_saved = ?,
                    last_deposit = ?, updated_at = ?
                WHERE id = ?
            """, (
                plan.get('name', existing['name']),
                plan.get('amount', existing['amount']),
                plan.get('frequency'),
                plan.get('next_deposit'),
                1 if plan.get('is_active', existing['is_active']) else 0,
                plan.get('deposits_completed', existing['deposits_completed']),
                plan.get('total_saved', existing['total_saved']),
                plan.get('last_deposit'),
                now_iso, plan['id']
            ))
        else:
            cursor.execute("""
                INSERT INTO savings_plans (
                    id, user_address, agent_address, vault_address, contract_plan_id,
                    name, amount, frequency, lock_days, lock_type, execution_time,
                    start_date, next_deposit, unlock_date, reason, is_recurring,
                    is_active, total_deposits, target_amount, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                plan['id'],
                plan['user_address'].lower(),
                plan.get('agent_address', '').lower() if plan.get('agent_address') else None,
                plan['vault_address'].lower(),
                plan.get('contract_plan_id'),
                plan['name'],
                plan['amount'],
                plan.get('frequency'),
                plan['lock_days'],
                plan.get('lock_type', 0),
                plan.get('execution_time', '09:00'),
                plan.get('start_date', now_iso),
                plan.get('next_deposit'),
                plan['unlock_date'],
                plan.get('reason', ''),
                1 if plan.get('is_recurring', True) else 0,
                1 if plan.get('is_active', True) else 0,
                plan.get('total_deposits', 1),
                plan['target_amount'],
                now_iso, now_iso
            ))
        
        conn.commit()
        return cursor.rowcount > 0


def get_savings_plan_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    """Get a single savings plan by ID"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM savings_plans WHERE id = ?", (plan_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_savings_plans(user_address: str, active_only: bool = False) -> List[Dict[str, Any]]:
    """Get all savings plans for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        if active_only:
            cursor.execute("""
                SELECT * FROM savings_plans 
                WHERE user_address = ? AND is_active = 1 AND withdrawn = 0
                ORDER BY unlock_date ASC
            """, (user_address.lower(),))
        else:
            cursor.execute("""
                SELECT * FROM savings_plans 
                WHERE user_address = ?
                ORDER BY unlock_date ASC
            """, (user_address.lower(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_due_savings_deposits(before: datetime) -> List[Dict[str, Any]]:
    """Get all savings deposits due"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*, a.encrypted_key, a.agent_address as wallet_agent_address
            FROM savings_plans p
            LEFT JOIN agent_wallets a ON p.user_address = a.user_address
            WHERE p.is_active = 1 AND p.is_recurring = 1 
                AND p.withdrawn = 0 AND p.next_deposit <= ?
            ORDER BY p.next_deposit ASC
        """, (before.isoformat(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def update_savings_deposit(plan_id: str, amount: float, next_deposit: Optional[str], tx_hash: str = None) -> bool:
    """Update savings plan after deposit"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute("""
            UPDATE savings_plans SET
                deposits_completed = deposits_completed + 1,
                total_saved = total_saved + ?,
                next_deposit = ?,
                last_deposit = ?,
                updated_at = ?
            WHERE id = ?
        """, (amount, next_deposit, now_iso, now_iso, plan_id))
        conn.commit()
        return cursor.rowcount > 0


def update_savings_plan(plan_id: str, updates: Dict[str, Any]) -> bool:
    """Update specific fields of a savings plan"""
    if not updates:
        return False
    
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
    
        set_clauses = []
        values = []
        
        allowed_fields = {
            'name': 'name',
            'amount': 'amount',
            'frequency': 'frequency',
            'execution_time': 'execution_time',
            'next_deposit': 'next_deposit',
            'is_active': 'is_active',
            'total_saved': 'total_saved',
            'deposits_completed': 'deposits_completed'
        }
        
        for key, db_field in allowed_fields.items():
            if key in updates:
                value = updates[key]
                if key == 'is_active':
                    value = 1 if value else 0
                set_clauses.append(f"{db_field} = ?")
                values.append(value)
        
        if not set_clauses:
            return False
        
        set_clauses.append("updated_at = ?")
        values.append(now_iso)
        values.append(plan_id)
        
        query = f"UPDATE savings_plans SET {', '.join(set_clauses)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        
        return cursor.rowcount > 0
        

def set_plan_contract_id(plan_id: str, contract_plan_id: int) -> bool:
    """Set on-chain contract plan ID"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE savings_plans SET contract_plan_id = ?, updated_at = ?
            WHERE id = ?
        """, (contract_plan_id, datetime.utcnow().isoformat(), plan_id))
        conn.commit()
        return cursor.rowcount > 0


def mark_savings_withdrawn(plan_id: str) -> bool:
    """Mark savings plan as withdrawn"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE savings_plans SET withdrawn = 1, is_active = 0, updated_at = ?
            WHERE id = ?
        """, (datetime.utcnow().isoformat(), plan_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_savings_plan(plan_id: str) -> bool:
    """Delete a savings plan"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM savings_plans WHERE id = ?", (plan_id,))
        conn.commit()
        return cursor.rowcount > 0

def log_execution(
    schedule_id: Optional[str],
    savings_plan_id: Optional[str],
    user_address: str,
    execution_type: str,
    amount: float,
    destination: str,
    tx_hash: Optional[str],
    status: str,
    error_message: Optional[str] = None
) -> int:
    """Log an execution attempt"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO execution_log (
                schedule_id, savings_plan_id, user_address, execution_type,
                amount, destination, tx_hash, status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            schedule_id, savings_plan_id, user_address.lower(),
            execution_type, amount, destination.lower(),
            tx_hash, status, error_message
        ))
        conn.commit()
        return cursor.lastrowid


def get_execution_history(user_address: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get execution history for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM execution_log 
            WHERE user_address = ?
            ORDER BY executed_at DESC
            LIMIT ?
        """, (user_address.lower(), limit))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def delete_old_execution_logs(before: datetime) -> int:
    """Delete old execution logs"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM execution_log WHERE executed_at < ?", (before.isoformat(),))
        conn.commit()
        return cursor.rowcount

def create_notification(user_address: str, notification_type: str, message: str, tx_hash: Optional[str] = None) -> int:
    """Create a notification"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (user_address, notification_type, message, tx_hash)
            VALUES (?, ?, ?, ?)
        """, (user_address.lower(), notification_type, message, tx_hash))
        conn.commit()
        return cursor.lastrowid


def get_notifications(user_address: str, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    """Get notifications for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        if unread_only:
            cursor.execute("""
                SELECT * FROM notifications 
                WHERE user_address = ? AND is_read = 0
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_address.lower(), limit))
        else:
            cursor.execute("""
                SELECT * FROM notifications 
                WHERE user_address = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_address.lower(), limit))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def mark_notification_read(notification_id: int) -> bool:
    """Mark notification as read"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
        conn.commit()
        return cursor.rowcount > 0


def mark_all_notifications_read(user_address: str) -> int:
    """Mark all notifications as read for user"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_address = ?", (user_address.lower(),))
        conn.commit()
        return cursor.rowcount

def insert_audit_log(
    action: str, entity_type: str, entity_id: str,
    old_value: Optional[str], new_value: Optional[str],
    performed_by: str, ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        audit_hash = compute_hash({
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "performed_by": performed_by,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        cursor.execute("""
            INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, performed_by, ip_address, user_agent, hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (action, entity_type, entity_id, old_value, new_value, performed_by, ip_address, user_agent, audit_hash))
        
        conn.commit()
        return cursor.lastrowid


def register_vault(wallet_address: str, vault_address: str, network: str = "sepolia") -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO vaults (wallet_address, vault_address, network)
                VALUES (?, ?, ?)
                ON CONFLICT(wallet_address) DO UPDATE SET vault_address = ?, network = ?
            """, (wallet_address.lower(), vault_address.lower(), network, vault_address.lower(), network))
            conn.commit()
            return True
        except Exception:
            return False


def get_vault_by_wallet(wallet_address: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vaults WHERE wallet_address = ?", (wallet_address.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_all_vaults() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vaults ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_pending_transactions(vault_address: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if vault_address:
            cursor.execute("""
                SELECT * FROM transactions 
                WHERE executed = 0 AND revoked = 0 AND vault_address = ?
                ORDER BY timestamp DESC
            """, (vault_address.lower(),))
        else:
            cursor.execute("SELECT * FROM transactions WHERE executed = 0 AND revoked = 0 ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_agent_profile(agent_address: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM agents WHERE address = ?", (agent_address,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_transaction_history(limit: int = 100, offset: int = 0, vault_address: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if vault_address:
            cursor.execute("""
                SELECT * FROM transactions 
                WHERE vault_address = ?
                ORDER BY timestamp DESC LIMIT ? OFFSET ?
            """, (vault_address.lower(), limit, offset))
        else:
            cursor.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?", (limit, offset))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_transaction_by_id(tx_id: int, vault_address: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if vault_address:
            cursor.execute("SELECT * FROM transactions WHERE tx_id = ? AND vault_address = ?", (tx_id, vault_address.lower()))
        else:
            cursor.execute("SELECT * FROM transactions WHERE tx_id = ?", (tx_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_alerts(acknowledged: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if acknowledged is not None:
            cursor.execute("SELECT * FROM alerts WHERE acknowledged = ? ORDER BY created_at DESC LIMIT ?", (acknowledged, limit))
        else:
            cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def acknowledge_alert(alert_id: int, acknowledged_by: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE alerts SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id = ?",
            (acknowledged_by, now_iso, alert_id)
        )
        conn.commit()
        return cursor.rowcount > 0

def verify_transaction_integrity(tx_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions WHERE tx_id = ?", (tx_id,))
        row = cursor.fetchone()

        if not row:
            return False

        expected_hash = compute_hash({
            "tx_id": row["tx_id"],
            "agent": row["agent"],
            "vendor": row["vendor"],
            "amount": row["amount_wei"],
            "timestamp": row["timestamp"]
        })

        return expected_hash == row["hash"]

def get_stats() -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM transactions")
        total_tx = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM transactions WHERE executed = 0 AND revoked = 0")
        pending = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM transactions WHERE executed = 0 AND revoked = 0 AND risk_score >= 0.7")
        high_risk = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0")
        unack_alerts = cursor.fetchone()[0]
        
        cursor.execute("SELECT COALESCE(SUM(CAST(amount_wei AS INTEGER)), 0) FROM transactions WHERE executed = 1")
        total_volume = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM agents")
        total_agents = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vendors WHERE trusted = 1")
        trusted_vendors = cursor.fetchone()[0]
        
       
        cursor.execute("SELECT COUNT(*) FROM recurring_schedules WHERE is_active = 1")
        active_schedules = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM savings_plans WHERE is_active = 1 AND withdrawn = 0")
        active_savings = cursor.fetchone()[0]
        
        cursor.execute("SELECT COALESCE(SUM(total_saved), 0) FROM savings_plans WHERE withdrawn = 0")
        total_locked = cursor.fetchone()[0]

        return {
            "total_transactions": total_tx,
            "pending_count": pending,
            "high_risk_pending": high_risk,
            "unacknowledged_alerts": unack_alerts,
            "total_volume_wei": str(total_volume),
            "total_agents": total_agents,
            "trusted_vendors": trusted_vendors,
            "active_schedules": active_schedules,
            "active_savings": active_savings,
            "total_locked_savings": total_locked
        }

def get_vendors(trusted_only: bool = False, wallet_address: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        wallet = wallet_address.lower() if wallet_address else None
        
        if wallet:
            if trusted_only:
                cursor.execute("SELECT * FROM vendors WHERE trusted = 1 AND wallet_address = ? ORDER BY transaction_count DESC", (wallet,))
            else:
                cursor.execute("SELECT * FROM vendors WHERE wallet_address = ? ORDER BY transaction_count DESC", (wallet,))
        else:
            if trusted_only:
                cursor.execute("SELECT * FROM vendors WHERE trusted = 1 ORDER BY transaction_count DESC")
            else:
                cursor.execute("SELECT * FROM vendors ORDER BY transaction_count DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def upsert_vendor(address: str, name: str = "", trusted: bool = True, wallet_address: Optional[str] = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        wallet = wallet_address.lower() if wallet_address else ""
        
        cursor.execute("SELECT * FROM vendors WHERE address = ? AND wallet_address = ?", (address.lower(), wallet))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE vendors SET name = ?, trusted = ?, updated_at = ?
                WHERE address = ? AND wallet_address = ?
            """, (name if name else existing["name"], 1 if trusted else 0, now_iso, address.lower(), wallet))
        else:
            cursor.execute("""
                INSERT INTO vendors (wallet_address, address, name, trusted, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (wallet, address.lower(), name, 1 if trusted else 0, now_iso, now_iso))
        
        conn.commit()
        return cursor.rowcount > 0


def get_vendor_by_name(name: str, wallet_address: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        wallet = wallet_address.lower() if wallet_address else None
        
        if wallet:
            cursor.execute("""
                SELECT * FROM vendors 
                WHERE LOWER(name) LIKE ? AND trusted = 1 AND wallet_address = ?
                ORDER BY transaction_count DESC
                LIMIT 1
            """, (f"%{name.lower()}%", wallet))
        else:
            cursor.execute("""
                SELECT * FROM vendors 
                WHERE LOWER(name) LIKE ? AND trusted = 1
                ORDER BY transaction_count DESC
                LIMIT 1
            """, (f"%{name.lower()}%",))
        row = cursor.fetchone()
        return dict(row) if row else None
def bulk_upsert_schedules(schedules: List[Dict[str, Any]]) -> int:
    """Bulk upsert multiple schedules"""
    count = 0
    for schedule in schedules:
        if save_recurring_schedule(schedule):
            count += 1
    return count


def bulk_upsert_savings_plans(plans: List[Dict[str, Any]]) -> int:
    """Bulk upsert multiple savings plans"""
    count = 0
    for plan in plans:
        if save_savings_plan(plan):
            count += 1
    return count


def get_all_user_recurring_data(user_address: str) -> Dict[str, Any]:
    """Get all recurring data for a user in one call"""
    return {
        'schedules': get_recurring_schedules(user_address, active_only=False),
        'savings_plans': get_savings_plans(user_address, active_only=False),
        'agent_wallet': get_agent_wallet(user_address)
    }

def cleanup_expired_sessions() -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute("DELETE FROM sessions WHERE expires_at < ?", (now_iso,))
        conn.commit()
        return cursor.rowcount

def backup_database(backup_path: str) -> bool:
    import shutil
    try:
        shutil.copy2(str(DB_PATH), backup_path)
        return True
    except Exception:
        return False

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully")