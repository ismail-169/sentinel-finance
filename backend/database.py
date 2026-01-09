import sqlite3
import hashlib
import json
import threading
from datetime import datetime
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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)")

        conn.commit()

def compute_hash(data: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

def register_vault(wallet_address: str, vault_address: str, network: str = 'sepolia') -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO vaults (wallet_address, vault_address, network)
            VALUES (?, ?, ?)
        """, (wallet_address.lower(), vault_address.lower(), network))
        conn.commit()
        return cursor.lastrowid

def get_vault_by_wallet(wallet_address: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM vaults WHERE wallet_address = ?
        """, (wallet_address.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_all_vaults() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vaults")
        return [dict(row) for row in cursor.fetchall()]

def insert_transaction(tx_data: Dict[str, Any]) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()

        tx_hash = compute_hash({
            "tx_id": tx_data["tx_id"],
            "vault_address": tx_data.get("vault_address", ""),
            "agent": tx_data["agent"],
            "vendor": tx_data["vendor"],
            "amount": tx_data["amount"],
            "timestamp": tx_data["timestamp"]
        })

        now = datetime.utcnow().isoformat()

        cursor.execute("""
            INSERT OR REPLACE INTO transactions 
            (tx_id, vault_address, agent, vendor, amount_wei, timestamp, execute_after, executed, revoked, reason, risk_score, risk_factors, hash, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tx_data["tx_id"],
            tx_data.get("vault_address", "").lower(),
            tx_data["agent"],
            tx_data["vendor"],
            str(tx_data["amount"]),
            tx_data["timestamp"],
            tx_data["execute_after"],
            tx_data.get("executed", 0),
            tx_data.get("revoked", 0),
            tx_data.get("reason", ""),
            tx_data.get("risk_score", 0),
            json.dumps(tx_data.get("risk_factors", [])),
            tx_hash,
            now
        ))

        conn.commit()
        return cursor.lastrowid

def update_transaction_status(tx_id: int, executed: bool = None, revoked: bool = None, reason: str = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if executed is not None:
            updates.append("executed = ?")
            params.append(1 if executed else 0)
        if revoked is not None:
            updates.append("revoked = ?")
            params.append(1 if revoked else 0)
        if reason is not None:
            updates.append("reason = ?")
            params.append(reason)
        
        updates.append("updated_at = ?")
        params.append(datetime.utcnow().isoformat())
        params.append(tx_id)

        cursor.execute(f"UPDATE transactions SET {', '.join(updates)} WHERE tx_id = ?", params)
        conn.commit()
        return cursor.rowcount > 0

def update_agent_stats(agent_address: str, amount: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM agents WHERE address = ?", (agent_address,))
        row = cursor.fetchone()

        now = int(datetime.utcnow().timestamp())
        now_iso = datetime.utcnow().isoformat()
        amount_int = int(amount)

        if row:
            total_tx = row["total_transactions"] + 1
            total_vol = str(int(row["total_volume_wei"]) + amount_int)
            avg = str(int(total_vol) // total_tx)
            cursor.execute("""
                UPDATE agents SET total_transactions = ?, total_volume_wei = ?, avg_amount_wei = ?, last_active = ?, updated_at = ?
                WHERE address = ?
            """, (total_tx, total_vol, avg, now, now_iso, agent_address))
        else:
            cursor.execute("""
                INSERT INTO agents (address, total_transactions, total_volume_wei, avg_amount_wei, last_active, updated_at)
                VALUES (?, 1, ?, ?, ?, ?)
            """, (agent_address, str(amount_int), str(amount_int), now, now_iso))

        conn.commit()

def update_vendor_stats(vendor_address: str, amount: str, trusted: bool, wallet_address: Optional[str] = None) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        wallet = wallet_address.lower() if wallet_address else ""

        cursor.execute("SELECT * FROM vendors WHERE address = ? AND wallet_address = ?", (vendor_address.lower(), wallet))
        row = cursor.fetchone()

        now_iso = datetime.utcnow().isoformat()
        amount_int = int(amount)

        if row:
            total = str(int(row["total_received_wei"]) + amount_int)
            count = row["transaction_count"] + 1
            cursor.execute("""
                UPDATE vendors SET total_received_wei = ?, transaction_count = ?, trusted = ?, updated_at = ?
                WHERE address = ? AND wallet_address = ?
            """, (total, count, 1 if trusted else 0, now_iso, vendor_address.lower(), wallet))
        else:
            cursor.execute("""
                INSERT INTO vendors (wallet_address, address, trusted, total_received_wei, transaction_count, updated_at)
                VALUES (?, ?, ?, ?, 1, ?)
            """, (wallet, vendor_address.lower(), 1 if trusted else 0, str(amount_int), now_iso))

        conn.commit()

def insert_alert(tx_id: int, alert_type: str, severity: str, message: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO alerts (tx_id, alert_type, severity, message)
            VALUES (?, ?, ?, ?)
        """, (tx_id, alert_type, severity, message))

        conn.commit()
        return cursor.lastrowid

def insert_audit_log(
    action: str,
    entity_type: str,
    entity_id: str,
    old_value: Optional[str],
    new_value: Optional[str],
    performed_by: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()

        log_hash = compute_hash({
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "old_value": old_value,
            "new_value": new_value,
            "performed_by": performed_by,
            "timestamp": datetime.utcnow().isoformat()
        })

        cursor.execute("""
            INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, performed_by, ip_address, user_agent, hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (action, entity_type, entity_id, old_value, new_value, performed_by, ip_address, user_agent, log_hash))

        conn.commit()
        return cursor.lastrowid

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

        return {
            "total_transactions": total_tx,
            "pending_count": pending,
            "high_risk_pending": high_risk,
            "unacknowledged_alerts": unack_alerts,
            "total_volume_wei": str(total_volume),
            "total_agents": total_agents,
            "trusted_vendors": trusted_vendors
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