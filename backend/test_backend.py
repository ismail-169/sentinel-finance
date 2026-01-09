import pytest
import asyncio
import json
import os
import tempfile
from pathlib import Path
from datetime import datetime

os.environ["SEPOLIA_RPC_URL"] = "https://rpc.sepolia.org"
os.environ["API_SECRET"] = "test_secret_key_for_testing_purposes_only"
os.environ["JWT_SECRET"] = "test_jwt_secret_for_testing_purposes_only"

import database
from database import (
    init_db,
    insert_transaction,
    update_transaction_status,
    update_agent_stats,
    update_vendor_stats,
    insert_alert,
    insert_audit_log,
    get_pending_transactions,
    get_agent_profile,
    get_transaction_history,
    get_alerts,
    acknowledge_alert,
    verify_transaction_integrity,
    get_stats,
    compute_hash
)

@pytest.fixture(scope="function")
def test_db(tmp_path):
    db_path = tmp_path / "test_sentinel.db"
    database.DB_PATH = db_path
    init_db()
    yield db_path
    if db_path.exists():
        db_path.unlink()

class TestDatabase:
    def test_init_db(self, test_db):
        assert test_db.exists()
    
    def test_compute_hash_deterministic(self):
        data = {"key": "value", "number": 42}
        hash1 = compute_hash(data)
        hash2 = compute_hash(data)
        assert hash1 == hash2
        assert len(hash1) == 64
    
    def test_compute_hash_different_data(self):
        hash1 = compute_hash({"a": 1})
        hash2 = compute_hash({"a": 2})
        assert hash1 != hash2
    
    def test_insert_transaction(self, test_db):
        tx_data = {
            "tx_id": 1,
            "agent": "0x1234567890123456789012345678901234567890",
            "vendor": "0x0987654321098765432109876543210987654321",
            "amount": "1000000000000000000",
            "timestamp": int(datetime.utcnow().timestamp()),
            "execute_after": int(datetime.utcnow().timestamp()) + 3600,
            "risk_score": 0.5,
            "risk_factors": ["new_agent"]
        }
        
        row_id = insert_transaction(tx_data)
        assert row_id > 0
        
        pending = get_pending_transactions()
        assert len(pending) == 1
        assert pending[0]["tx_id"] == 1
    
    def test_update_transaction_status(self, test_db):
        tx_data = {
            "tx_id": 2,
            "agent": "0x1234567890123456789012345678901234567890",
            "vendor": "0x0987654321098765432109876543210987654321",
            "amount": "1000000000000000000",
            "timestamp": int(datetime.utcnow().timestamp()),
            "execute_after": int(datetime.utcnow().timestamp()),
        }
        insert_transaction(tx_data)
        
        success = update_transaction_status(2, executed=True)
        assert success
        
        pending = get_pending_transactions()
        assert len(pending) == 0
    
    def test_update_agent_stats_new(self, test_db):
        agent = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        amount = "1000000000000000000"
        
        update_agent_stats(agent, amount)
        
        profile = get_agent_profile(agent)
        assert profile is not None
        assert profile["total_transactions"] == 1
        assert profile["total_volume_wei"] == amount
    
    def test_update_agent_stats_existing(self, test_db):
        agent = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        
        update_agent_stats(agent, "1000")
        update_agent_stats(agent, "2000")
        
        profile = get_agent_profile(agent)
        assert profile["total_transactions"] == 2
        assert profile["total_volume_wei"] == "3000"
        assert profile["avg_amount_wei"] == "1500"
    
    def test_update_vendor_stats(self, test_db):
        vendor = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        
        update_vendor_stats(vendor, "5000", True)
        update_vendor_stats(vendor, "3000", True)
        
        from database import get_vendors
        vendors = get_vendors(trusted_only=True)
        
        vendor_data = next((v for v in vendors if v["address"] == vendor), None)
        assert vendor_data is not None
        assert vendor_data["transaction_count"] == 2
        assert vendor_data["total_received_wei"] == "8000"
    
    def test_insert_alert(self, test_db):
        tx_data = {
            "tx_id": 10,
            "agent": "0x1111111111111111111111111111111111111111",
            "vendor": "0x2222222222222222222222222222222222222222",
            "amount": "1000",
            "timestamp": int(datetime.utcnow().timestamp()),
            "execute_after": int(datetime.utcnow().timestamp()),
        }
        insert_transaction(tx_data)
        
        alert_id = insert_alert(10, "high_risk", "critical", "Test alert message")
        assert alert_id > 0
        
        alerts = get_alerts(acknowledged=0)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "critical"
    
    def test_acknowledge_alert(self, test_db):
        tx_data = {
            "tx_id": 11,
            "agent": "0x1111111111111111111111111111111111111111",
            "vendor": "0x2222222222222222222222222222222222222222",
            "amount": "1000",
            "timestamp": int(datetime.utcnow().timestamp()),
            "execute_after": int(datetime.utcnow().timestamp()),
        }
        insert_transaction(tx_data)
        
        alert_id = insert_alert(11, "test", "warning", "Test")
        
        success = acknowledge_alert(alert_id, "test_user")
        assert success
        
        alerts = get_alerts(acknowledged=0)
        assert len(alerts) == 0
        
        all_alerts = get_alerts(acknowledged=1)
        assert len(all_alerts) == 1
        assert all_alerts[0]["acknowledged_by"] == "test_user"
    
    def test_insert_audit_log(self, test_db):
        log_id = insert_audit_log(
            action="test_action",
            entity_type="test",
            entity_id="1",
            old_value="old",
            new_value="new",
            performed_by="tester",
            ip_address="127.0.0.1"
        )
        assert log_id > 0
    
    def test_verify_transaction_integrity_valid(self, test_db):
        tx_data = {
            "tx_id": 100,
            "agent": "0x1234567890123456789012345678901234567890",
            "vendor": "0x0987654321098765432109876543210987654321",
            "amount": "1000000000000000000",
            "timestamp": 1704067200,
            "execute_after": 1704070800,
        }
        insert_transaction(tx_data)
        
        assert verify_transaction_integrity(100) == True
    
    def test_verify_transaction_integrity_not_found(self, test_db):
        assert verify_transaction_integrity(9999) == False
    
    def test_get_stats(self, test_db):
        for i in range(5):
            tx_data = {
                "tx_id": 200 + i,
                "agent": f"0x{'A' * 40}",
                "vendor": f"0x{'B' * 40}",
                "amount": "1000",
                "timestamp": int(datetime.utcnow().timestamp()),
                "execute_after": int(datetime.utcnow().timestamp()),
                "risk_score": 0.8 if i == 0 else 0.3
            }
            insert_transaction(tx_data)
        
        stats = get_stats()
        assert stats["total_transactions"] == 5
        assert stats["pending_count"] == 5
        assert stats["high_risk_pending"] == 1
    
    def test_get_transaction_history_pagination(self, test_db):
        for i in range(25):
            tx_data = {
                "tx_id": 300 + i,
                "agent": f"0x{'D' * 40}",
                "vendor": f"0x{'E' * 40}",
                "amount": str(i * 1000),
                "timestamp": int(datetime.utcnow().timestamp()) + i,
                "execute_after": int(datetime.utcnow().timestamp()) + i + 3600,
            }
            insert_transaction(tx_data)
        
        page1 = get_transaction_history(limit=10, offset=0)
        page2 = get_transaction_history(limit=10, offset=10)
        page3 = get_transaction_history(limit=10, offset=20)
        
        assert len(page1) == 10
        assert len(page2) == 10
        assert len(page3) == 5

class TestRiskScoring:
    def test_risk_factors_accumulate(self, test_db):
        from watchdog import SentinelWatchdog, RISK_CONFIG
        
        watchdog = SentinelWatchdog()
        watchdog.vault = None
        
        score, factors = watchdog.calculate_risk_score(
            agent="0x" + "F" * 40,
            vendor="0x" + "E" * 40,
            amount=1000000000000000000,
            is_trusted=False
        )
        
        assert "unknown_agent" in factors
        assert "untrusted_vendor" in factors
        assert score > 0.5
    
    def test_risk_score_capped_at_one(self, test_db):
        from watchdog import SentinelWatchdog
        
        watchdog = SentinelWatchdog()
        
        update_agent_stats("0x" + "A" * 40, "100")
        
        score, factors = watchdog.calculate_risk_score(
            agent="0x" + "A" * 40,
            vendor="0x" + "B" * 40,
            amount=10000000000000000000000,
            is_trusted=False
        )
        
        assert score <= 1.0

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from api import app, settings
    
    settings.api_secret = "test_secret_key_for_testing_purposes_only"
    
    with TestClient(app) as c:
        yield c

class TestAPI:
    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
    
    def test_unauthorized_without_key(self, client):
        response = client.get("/api/v1/vault/balance")
        assert response.status_code == 401
    
    def test_unauthorized_with_wrong_key(self, client):
        response = client.get(
            "/api/v1/vault/balance",
            headers={"x-api-key": "wrong_key"}
        )
        assert response.status_code == 401
    
    def test_pending_transactions(self, client, test_db):
        response = client.get(
            "/api/v1/transactions/pending",
            headers={"x-api-key": "test_secret_key_for_testing_purposes_only"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "count" in data
    
    def test_transaction_history_limit(self, client, test_db):
        response = client.get(
            "/api/v1/transactions/history?limit=1000",
            headers={"x-api-key": "test_secret_key_for_testing_purposes_only"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 500
    
    def test_alerts_endpoint(self, client, test_db):
        response = client.get(
            "/api/v1/alerts",
            headers={"x-api-key": "test_secret_key_for_testing_purposes_only"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
    
    def test_invalid_address_format(self, client, test_db):
        response = client.get(
            "/api/v1/agents/invalid_address",
            headers={"x-api-key": "test_secret_key_for_testing_purposes_only"}
        )
        assert response.status_code == 400
    
    def test_stats_endpoint(self, client, test_db):
        response = client.get(
            "/api/v1/stats",
            headers={"x-api-key": "test_secret_key_for_testing_purposes_only"}
        )
        assert response.status_code in [200, 503]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])