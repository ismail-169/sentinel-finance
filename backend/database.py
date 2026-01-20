import os
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor

try:
    from cryptography.fernet import Fernet
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

DATABASE_URL = os.getenv("DATABASE_URL")
ENCRYPTION_KEY = os.getenv("DB_ENCRYPTION_KEY")

def get_cipher():
    if HAS_CRYPTO and ENCRYPTION_KEY:
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

def parse_database_url(url: str) -> Dict[str, Any]:
    parsed = urlparse(url)
    return {
        'dbname': parsed.path[1:],
        'user': parsed.username,
        'password': parsed.password,
        'host': parsed.hostname,
        'port': parsed.port or 5432
    }

@contextmanager
def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    conn_params = parse_database_url(DATABASE_URL)
    conn = psycopg2.connect(**conn_params)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def compute_hash(data: Dict[str, Any]) -> str:
    sorted_data = json.dumps(data, sort_keys=True)
    return hashlib.sha256(sorted_data.encode()).hexdigest()

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vaults (
                id SERIAL PRIMARY KEY,
                wallet_address TEXT UNIQUE NOT NULL,
                vault_address TEXT UNIQUE NOT NULL,
                network TEXT DEFAULT 'mainnet',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vendors (
                id SERIAL PRIMARY KEY,
                wallet_address TEXT NOT NULL,
                address TEXT NOT NULL,
                trusted INTEGER DEFAULT 0,
                total_received_wei TEXT DEFAULT '0',
                transaction_count INTEGER DEFAULT 0,
                name TEXT DEFAULT '',
                metadata TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(wallet_address, address)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                tx_id INTEGER NOT NULL,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                acknowledged INTEGER DEFAULT 0,
                acknowledged_by TEXT,
                acknowledged_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                performed_by TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                hash TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'viewer',
                is_active INTEGER DEFAULT 1,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                token_hash TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rate_limits (
                key TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                window_start INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_wallets (
                id SERIAL PRIMARY KEY,
                user_address TEXT UNIQUE NOT NULL,
                agent_address TEXT UNIQUE NOT NULL,
                vault_address TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                network TEXT DEFAULT 'mainnet',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                network TEXT DEFAULT 'mainnet',
                execution_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                last_executed TEXT,
                last_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS execution_log (
                id SERIAL PRIMARY KEY,
                schedule_id TEXT,
                savings_plan_id TEXT,
                user_address TEXT NOT NULL,
                execution_type TEXT NOT NULL,
                amount REAL NOT NULL,
                destination TEXT NOT NULL,
                tx_hash TEXT,
                status TEXT NOT NULL,
                error_message TEXT,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_address TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                message TEXT NOT NULL,
                tx_hash TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

       
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_vault ON transactions(vault_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_agent ON transactions(agent)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_vendor ON transactions(vendor)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_executed ON transactions(executed)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_revoked ON transactions(revoked)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_risk ON transactions(risk_score)")
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
        print("Database initialized successfully")




def save_agent_wallet(user_address: str, agent_address: str, vault_address: str, encrypted_key: str, network: str = 'mainnet') -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT id FROM agent_wallets WHERE user_address = %s AND network = %s", (user_address.lower(), network))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE agent_wallets 
                SET agent_address = %s, vault_address = %s, encrypted_key = %s, updated_at = %s
                WHERE user_address = %s AND network = %s
            """, (agent_address.lower(), vault_address.lower(), encrypted_key, now_iso, user_address.lower(), network))
        else:
            cursor.execute("""
                INSERT INTO agent_wallets (user_address, agent_address, vault_address, encrypted_key, network, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_address.lower(), agent_address.lower(), vault_address.lower(), encrypted_key, network, now_iso, now_iso))
        
        return cursor.rowcount > 0

def get_agent_wallet(user_address: str, network: str = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if network:
            cursor.execute("SELECT * FROM agent_wallets WHERE user_address = %s AND network = %s", (user_address.lower(), network))
        else:
            cursor.execute("SELECT * FROM agent_wallets WHERE user_address = %s", (user_address.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_agent_wallet(user_address: str, network: str = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        if network:
            cursor.execute("DELETE FROM agent_wallets WHERE user_address = %s AND network = %s", (user_address.lower(), network))
        else:
            cursor.execute("DELETE FROM agent_wallets WHERE user_address = %s", (user_address.lower(),))
        return cursor.rowcount > 0




def save_recurring_schedule(schedule: Dict[str, Any]) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT * FROM recurring_schedules WHERE id = %s", (schedule['id'],))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE recurring_schedules SET
                    vendor = %s, vendor_address = %s, amount = %s, frequency = %s,
                    execution_time = %s, next_execution = %s, reason = %s,
                    is_trusted = %s, is_active = %s, updated_at = %s
                WHERE id = %s
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
                    network, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                schedule.get('network', 'mainnet'),
                now_iso, now_iso
            ))
        
        return cursor.rowcount > 0

def get_recurring_schedules(user_address: str, active_only: bool = True) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if active_only:
            cursor.execute("""
                SELECT * FROM recurring_schedules 
                WHERE user_address = %s AND is_active = 1
                ORDER BY next_execution ASC
            """, (user_address.lower(),))
        else:
            cursor.execute("""
                SELECT * FROM recurring_schedules 
                WHERE user_address = %s
                ORDER BY next_execution ASC
            """, (user_address.lower(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_due_schedules(before: datetime) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT s.*, a.encrypted_key, a.agent_address
            FROM recurring_schedules s
            LEFT JOIN agent_wallets a ON s.user_address = a.user_address AND s.network = a.network
            WHERE s.is_active = 1 AND s.next_execution <= %s
            ORDER BY s.next_execution ASC
        """, (before.isoformat(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def update_schedule_execution(schedule_id: str, tx_hash: str, next_execution: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute("""
            UPDATE recurring_schedules SET
                next_execution = %s,
                last_executed = %s,
                execution_count = execution_count + 1,
                failed_count = 0,
                last_error = NULL,
                updated_at = %s
            WHERE id = %s
        """, (next_execution, now_iso, now_iso, schedule_id))
        return cursor.rowcount > 0

def update_schedule_failure(schedule_id: str, error: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT failed_count FROM recurring_schedules WHERE id = %s", (schedule_id,))
        row = cursor.fetchone()
        failed_count = (row['failed_count'] if row else 0) + 1
        
        is_active = 1 if failed_count < 3 else 0
        
        cursor.execute("""
            UPDATE recurring_schedules SET
                failed_count = %s,
                last_error = %s,
                is_active = %s,
                updated_at = %s
            WHERE id = %s
        """, (failed_count, error, is_active, now_iso, schedule_id))
        return cursor.rowcount > 0

def pause_schedule(schedule_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE recurring_schedules SET is_active = 0, updated_at = %s
            WHERE id = %s
        """, (datetime.utcnow().isoformat(), schedule_id))
        return cursor.rowcount > 0

def resume_schedule(schedule_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE recurring_schedules SET is_active = 1, failed_count = 0, updated_at = %s
            WHERE id = %s
        """, (datetime.utcnow().isoformat(), schedule_id))
        return cursor.rowcount > 0

def update_schedule(schedule_id: str, updates: Dict[str, Any]) -> bool:
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
                set_clauses.append(f"{db_field} = %s")
                values.append(value)
        
        if not set_clauses:
            return False
        
        set_clauses.append("updated_at = %s")
        values.append(now_iso)
        values.append(schedule_id)
        
        query = f"UPDATE recurring_schedules SET {', '.join(set_clauses)} WHERE id = %s"
        cursor.execute(query, values)
        
        return cursor.rowcount > 0

def get_schedule_by_id(schedule_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM recurring_schedules WHERE id = %s", (schedule_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_schedule(schedule_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM recurring_schedules WHERE id = %s", (schedule_id,))
        return cursor.rowcount > 0




def save_savings_plan(plan: Dict[str, Any]) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        now_iso = datetime.utcnow().isoformat()
        
        cursor.execute("SELECT * FROM savings_plans WHERE id = %s", (plan['id'],))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE savings_plans SET
                    name = %s, amount = %s, frequency = %s, next_deposit = %s,
                    is_active = %s, deposits_completed = %s, total_saved = %s,
                    last_deposit = %s, updated_at = %s
                WHERE id = %s
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
                    is_active, total_deposits, target_amount, network, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                plan.get('network', 'mainnet'),
                now_iso, now_iso
            ))
        
        return cursor.rowcount > 0

def get_savings_plans(user_address: str, active_only: bool = False) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if active_only:
            cursor.execute("""
                SELECT * FROM savings_plans 
                WHERE user_address = %s AND is_active = 1 AND withdrawn = 0
                ORDER BY unlock_date ASC
            """, (user_address.lower(),))
        else:
            cursor.execute("""
                SELECT * FROM savings_plans 
                WHERE user_address = %s
                ORDER BY unlock_date ASC
            """, (user_address.lower(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_savings_plan_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM savings_plans WHERE id = %s", (plan_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_due_savings_deposits(before: datetime) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT p.*, a.encrypted_key, a.agent_address as wallet_agent_address
            FROM savings_plans p
            LEFT JOIN agent_wallets a ON p.user_address = a.user_address AND p.network = a.network
            WHERE p.is_active = 1 AND p.is_recurring = 1 
                AND p.withdrawn = 0 AND p.next_deposit <= %s
            ORDER BY p.next_deposit ASC
        """, (before.isoformat(),))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def update_savings_deposit(plan_id: str, amount: float, next_deposit: Optional[str], tx_hash: str = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute("""
            UPDATE savings_plans SET
                deposits_completed = deposits_completed + 1,
                total_saved = total_saved + %s,
                next_deposit = %s,
                last_deposit = %s,
                updated_at = %s
            WHERE id = %s
        """, (amount, next_deposit, now_iso, now_iso, plan_id))
        return cursor.rowcount > 0

def update_savings_plan(plan_id: str, updates: Dict[str, Any]) -> bool:
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
                set_clauses.append(f"{db_field} = %s")
                values.append(value)
        
        if not set_clauses:
            return False
        
        set_clauses.append("updated_at = %s")
        values.append(now_iso)
        values.append(plan_id)
        
        query = f"UPDATE savings_plans SET {', '.join(set_clauses)} WHERE id = %s"
        cursor.execute(query, values)
        
        return cursor.rowcount > 0

def set_plan_contract_id(plan_id: str, contract_plan_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE savings_plans SET contract_plan_id = %s, updated_at = %s
            WHERE id = %s
        """, (contract_plan_id, datetime.utcnow().isoformat(), plan_id))
        return cursor.rowcount > 0

def mark_savings_withdrawn(plan_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE savings_plans SET withdrawn = 1, is_active = 0, updated_at = %s
            WHERE id = %s
        """, (datetime.utcnow().isoformat(), plan_id))
        return cursor.rowcount > 0

def delete_savings_plan(plan_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM savings_plans WHERE id = %s", (plan_id,))
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
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO execution_log (
                schedule_id, savings_plan_id, user_address, execution_type,
                amount, destination, tx_hash, status, error_message
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            schedule_id, savings_plan_id, user_address.lower(),
            execution_type, amount, destination.lower(),
            tx_hash, status, error_message
        ))
        result = cursor.fetchone()
        return result[0] if result else 0

def get_execution_history(user_address: str, limit: int = 50) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT * FROM execution_log 
            WHERE user_address = %s
            ORDER BY executed_at DESC
            LIMIT %s
        """, (user_address.lower(), limit))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def delete_old_execution_logs(before: datetime) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM execution_log WHERE executed_at < %s", (before.isoformat(),))
        return cursor.rowcount




def create_notification(user_address: str, notification_type: str, message: str, tx_hash: Optional[str] = None) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (user_address, notification_type, message, tx_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (user_address.lower(), notification_type, message, tx_hash))
        result = cursor.fetchone()
        return result[0] if result else 0

def get_notifications(user_address: str, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if unread_only:
            cursor.execute("""
                SELECT * FROM notifications 
                WHERE user_address = %s AND is_read = 0
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_address.lower(), limit))
        else:
            cursor.execute("""
                SELECT * FROM notifications 
                WHERE user_address = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_address.lower(), limit))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def mark_notification_read(notification_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = %s", (notification_id,))
        return cursor.rowcount > 0

def mark_all_notifications_read(user_address: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_address = %s", (user_address.lower(),))
        return cursor.rowcount




def register_vault(wallet_address: str, vault_address: str, network: str = "mainnet") -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO vaults (wallet_address, vault_address, network)
                VALUES (%s, %s, %s)
                ON CONFLICT(wallet_address) DO UPDATE SET vault_address = %s, network = %s
            """, (wallet_address.lower(), vault_address.lower(), network, vault_address.lower(), network))
            return True
        except Exception:
            return False

def get_vault_by_wallet(wallet_address: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM vaults WHERE wallet_address = %s", (wallet_address.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_all_vaults() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM vaults ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]




def insert_transaction(tx_data: Dict[str, Any]) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        tx_hash = compute_hash({
            "tx_id": tx_data['tx_id'],
            "agent": tx_data['agent'],
            "vendor": tx_data['vendor'],
            "amount": tx_data['amount'],
            "timestamp": tx_data['timestamp']
        })
        cursor.execute("""
            INSERT INTO transactions (
                tx_id, vault_address, agent, vendor, amount_wei, timestamp,
                execute_after, executed, revoked, risk_score, risk_factors, hash
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tx_id, vault_address) DO UPDATE SET
                executed = EXCLUDED.executed,
                revoked = EXCLUDED.revoked,
                updated_at = CURRENT_TIMESTAMP
        """, (
            tx_data['tx_id'],
            tx_data.get('vault_address', ''),
            tx_data['agent'],
            tx_data['vendor'],
            tx_data['amount'],
            tx_data['timestamp'],
            tx_data['execute_after'],
            tx_data.get('executed', 0),
            tx_data.get('revoked', 0),
            tx_data.get('risk_score', 0),
            json.dumps(tx_data.get('risk_factors', [])),
            tx_hash
        ))
        return cursor.rowcount > 0

def update_transaction_status(tx_id: int, executed: bool = None, revoked: bool = None, reason: str = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        updates = ["updated_at = CURRENT_TIMESTAMP"]
        values = []
        
        if executed is not None:
            updates.append("executed = %s")
            values.append(1 if executed else 0)
        if revoked is not None:
            updates.append("revoked = %s")
            values.append(1 if revoked else 0)
        if reason is not None:
            updates.append("reason = %s")
            values.append(reason)
        
        values.append(tx_id)
        cursor.execute(f"UPDATE transactions SET {', '.join(updates)} WHERE tx_id = %s", values)
        return cursor.rowcount > 0

def get_pending_transactions(vault_address: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if vault_address:
            cursor.execute("""
                SELECT * FROM transactions 
                WHERE executed = 0 AND revoked = 0 AND vault_address = %s
                ORDER BY timestamp DESC
            """, (vault_address.lower(),))
        else:
            cursor.execute("SELECT * FROM transactions WHERE executed = 0 AND revoked = 0 ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_transaction_history(limit: int = 100, offset: int = 0, vault_address: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if vault_address:
            cursor.execute("""
                SELECT * FROM transactions 
                WHERE vault_address = %s
                ORDER BY timestamp DESC LIMIT %s OFFSET %s
            """, (vault_address.lower(), limit, offset))
        else:
            cursor.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT %s OFFSET %s", (limit, offset))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_transaction_by_id(tx_id: int, vault_address: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if vault_address:
            cursor.execute("SELECT * FROM transactions WHERE tx_id = %s AND vault_address = %s", (tx_id, vault_address.lower()))
        else:
            cursor.execute("SELECT * FROM transactions WHERE tx_id = %s", (tx_id,))
        row = cursor.fetchone()
        return dict(row) if row else None




def update_agent_stats(agent: str, amount: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM agents WHERE address = %s", (agent.lower(),))
        existing = cursor.fetchone()
        
        if existing:
            new_total = int(existing['total_volume_wei']) + int(amount)
            new_count = existing['total_transactions'] + 1
            new_avg = new_total // new_count
            cursor.execute("""
                UPDATE agents SET
                    total_transactions = %s,
                    total_volume_wei = %s,
                    avg_amount_wei = %s,
                    last_active = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE address = %s
            """, (new_count, str(new_total), str(new_avg), int(datetime.utcnow().timestamp()), agent.lower()))
        else:
            cursor.execute("""
                INSERT INTO agents (address, total_transactions, total_volume_wei, avg_amount_wei, last_active)
                VALUES (%s, 1, %s, %s, %s)
            """, (agent.lower(), amount, amount, int(datetime.utcnow().timestamp())))
        return True

def get_agent_profile(agent_address: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM agents WHERE address = %s", (agent_address.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def update_vendor_stats(vendor: str, amount: str, is_trusted: bool = False, wallet_address: str = '') -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM vendors WHERE address = %s AND wallet_address = %s", (vendor.lower(), wallet_address.lower()))
        existing = cursor.fetchone()
        
        if existing:
            new_total = int(existing['total_received_wei']) + int(amount)
            cursor.execute("""
                UPDATE vendors SET
                    total_received_wei = %s,
                    transaction_count = transaction_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE address = %s AND wallet_address = %s
            """, (str(new_total), vendor.lower(), wallet_address.lower()))
        else:
            cursor.execute("""
                INSERT INTO vendors (wallet_address, address, trusted, total_received_wei, transaction_count)
                VALUES (%s, %s, %s, %s, 1)
            """, (wallet_address.lower(), vendor.lower(), 1 if is_trusted else 0, amount))
        return True

def get_vendors(trusted_only: bool = False, wallet_address: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        wallet = wallet_address.lower() if wallet_address else None
        
        if wallet:
            if trusted_only:
                cursor.execute("SELECT * FROM vendors WHERE trusted = 1 AND wallet_address = %s ORDER BY transaction_count DESC", (wallet,))
            else:
                cursor.execute("SELECT * FROM vendors WHERE wallet_address = %s ORDER BY transaction_count DESC", (wallet,))
        else:
            if trusted_only:
                cursor.execute("SELECT * FROM vendors WHERE trusted = 1 ORDER BY transaction_count DESC")
            else:
                cursor.execute("SELECT * FROM vendors ORDER BY transaction_count DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def upsert_vendor(address: str, name: str = "", trusted: bool = True, wallet_address: Optional[str] = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        now_iso = datetime.utcnow().isoformat()
        wallet = wallet_address.lower() if wallet_address else ""
        
        cursor.execute("SELECT * FROM vendors WHERE address = %s AND wallet_address = %s", (address.lower(), wallet))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE vendors SET name = %s, trusted = %s, updated_at = %s
                WHERE address = %s AND wallet_address = %s
            """, (name if name else existing["name"], 1 if trusted else 0, now_iso, address.lower(), wallet))
        else:
            cursor.execute("""
                INSERT INTO vendors (wallet_address, address, name, trusted, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (wallet, address.lower(), name, 1 if trusted else 0, now_iso, now_iso))
        
        return cursor.rowcount > 0

def get_vendor_by_name(name: str, wallet_address: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        wallet = wallet_address.lower() if wallet_address else None
        
        if wallet:
            cursor.execute("""
                SELECT * FROM vendors 
                WHERE LOWER(name) LIKE %s AND trusted = 1 AND wallet_address = %s
                ORDER BY transaction_count DESC
                LIMIT 1
            """, (f"%{name.lower()}%", wallet))
        else:
            cursor.execute("""
                SELECT * FROM vendors 
                WHERE LOWER(name) LIKE %s AND trusted = 1
                ORDER BY transaction_count DESC
                LIMIT 1
            """, (f"%{name.lower()}%",))
        row = cursor.fetchone()
        return dict(row) if row else None




def insert_alert(tx_id: int, alert_type: str, severity: str, message: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (tx_id, alert_type, severity, message)
            VALUES (%s, %s, %s, %s)
        """, (tx_id, alert_type, severity, message))
        return cursor.rowcount > 0

def get_alerts(acknowledged: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if acknowledged is not None:
            cursor.execute("SELECT * FROM alerts WHERE acknowledged = %s ORDER BY created_at DESC LIMIT %s", (acknowledged, limit))
        else:
            cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT %s", (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def acknowledge_alert(alert_id: int, acknowledged_by: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE alerts SET acknowledged = 1, acknowledged_by = %s, acknowledged_at = %s WHERE id = %s",
            (acknowledged_by, now_iso, alert_id)
        )
        return cursor.rowcount > 0




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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (action, entity_type, entity_id, old_value, new_value, performed_by, ip_address, user_agent, audit_hash))
        
        result = cursor.fetchone()
        return result[0] if result else 0




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
        
        cursor.execute("SELECT COALESCE(SUM(CAST(amount_wei AS BIGINT)), 0) FROM transactions WHERE executed = 1")
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

def verify_transaction_integrity(tx_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM transactions WHERE tx_id = %s", (tx_id,))
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




def bulk_upsert_schedules(schedules: List[Dict[str, Any]]) -> int:
    count = 0
    for schedule in schedules:
        if save_recurring_schedule(schedule):
            count += 1
    return count

def bulk_upsert_savings_plans(plans: List[Dict[str, Any]]) -> int:
    count = 0
    for plan in plans:
        if save_savings_plan(plan):
            count += 1
    return count

def get_all_user_recurring_data(user_address: str) -> Dict[str, Any]:
    return {
        'schedules': get_recurring_schedules(user_address, active_only=False),
        'savings_plans': get_savings_plans(user_address, active_only=False),
        'agent_wallet': get_agent_wallet(user_address)
    }




def cleanup_expired_sessions() -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()
        cursor.execute("DELETE FROM sessions WHERE expires_at < %s", (now_iso,))
        return cursor.rowcount

def backup_database(backup_path: str) -> bool:
   
   
    return False


if __name__ == "__main__":
    init_db()