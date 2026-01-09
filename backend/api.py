import os
import json
import secrets
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Annotated
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from jose import JWTError, jwt
from passlib.context import CryptContext
from web3 import Web3
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import structlog

from database import (
    init_db,
    get_pending_transactions,
    get_transaction_history,
    get_transaction_by_id,
    get_agent_profile,
    get_alerts,
    acknowledge_alert,
    insert_audit_log,
    verify_transaction_integrity,
    get_stats,
    get_vendors,
    upsert_vendor,
    get_vendor_by_name,
    register_vault,
    get_vault_by_wallet,
    get_all_vaults
)

load_dotenv()

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

class Settings(BaseSettings):
    api_secret: str = Field(default_factory=lambda: secrets.token_hex(32))
    jwt_secret: str = Field(default_factory=lambda: secrets.token_hex(32))
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    rpc_url: str = "https://rpc.sepolia.org"
    allowed_origins: str = "https://sentinelfinance.xyz,https://www.sentinelfinance.xyz,http://localhost:3000"
    rate_limit: str = "100/minute"
    debug: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

DEPLOYMENT_PATH = Path(__file__).parent.parent / "deployment.json"
ABI_PATH = Path(__file__).parent.parent / "artifacts" / "contracts" / "SentinelVault.sol" / "SentinelVault.json"

REQUEST_COUNT = Counter("sentinel_requests_total", "Total requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("sentinel_request_latency_seconds", "Request latency", ["endpoint"])
ERROR_COUNT = Counter("sentinel_errors_total", "Total errors", ["type"])

limiter = Limiter(key_func=get_remote_address)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
vault = None

def load_contract():
    global vault
    if not DEPLOYMENT_PATH.exists():
        logger.warning("deployment.json not found - running without contract")
        return None
    if not ABI_PATH.exists():
        logger.warning("Contract ABI not found - running without contract")
        return None
    
    try:
        deployment = json.loads(DEPLOYMENT_PATH.read_text())
        abi = json.loads(ABI_PATH.read_text())["abi"]
        
        vault_address = deployment.get("vaultAddress") or deployment.get("vaultFactory")
        if not vault_address:
            logger.warning("No vault address in deployment.json - running without contract")
            return None
            
        vault = w3.eth.contract(
            address=Web3.to_checksum_address(vault_address),
            abi=abi
        )
        logger.info("contract_loaded", address=vault_address)
        return vault
    except Exception as e:
        logger.warning(f"Contract loading failed: {e} - running without contract")
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    load_contract()
    logger.info("application_started", api_secret_preview=settings.api_secret[:8] + "...")
    yield
    logger.info("application_shutdown")

app = FastAPI(
    title="Sentinel Finance API",
    version="2.0.0",
    description="AI-powered security infrastructure for MNEE stablecoin",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"]
)

class RevokeRequest(BaseModel):
    tx_id: int = Field(..., ge=0)
    reason: str = Field(..., min_length=1, max_length=500)
    private_key: str = Field(..., min_length=64, max_length=66)

    @field_validator("private_key")
    @classmethod
    def validate_private_key(cls, v):
        v = v.lower().replace("0x", "")
        if len(v) != 64 or not all(c in "0123456789abcdef" for c in v):
            raise ValueError("Invalid private key format")
        return v

class AlertAckRequest(BaseModel):
    alert_id: int = Field(..., ge=0)

class LimitsRequest(BaseModel):
    daily_limit: str = Field(..., pattern=r"^\d+$")
    transaction_limit: str = Field(..., pattern=r"^\d+$")
    private_key: str

class VendorRequest(BaseModel):
    vendor: str = Field(..., min_length=42, max_length=42)
    trusted: bool
    private_key: str

    @field_validator("vendor")
    @classmethod
    def validate_address(cls, v):
        if not Web3.is_address(v):
            raise ValueError("Invalid Ethereum address")
        return Web3.to_checksum_address(v)


class VendorWithNameRequest(BaseModel):
    """Request to add a vendor with a name for AI agent recognition"""
    address: str = Field(..., min_length=42, max_length=42)
    name: str = Field(..., min_length=1, max_length=100)
    trusted: bool = True
    private_key: str  # Still needed to update blockchain

    @field_validator("address")
    @classmethod
    def validate_address(cls, v):
        if not Web3.is_address(v):
            raise ValueError("Invalid Ethereum address")
        return Web3.to_checksum_address(v)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authentication")
    
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError as e:
        logger.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_api_key(x_api_key: Annotated[Optional[str], Header()] = None) -> bool:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    if not secrets.compare_digest(x_api_key, settings.api_secret):
        logger.warning("invalid_api_key_attempt")
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True

async def get_wallet_context(
    x_wallet_address: Annotated[Optional[str], Header()] = None,
    x_vault_address: Annotated[Optional[str], Header()] = None
) -> dict:
    return {
        "wallet_address": x_wallet_address.lower() if x_wallet_address else None,
        "vault_address": x_vault_address.lower() if x_vault_address else None
    }

async def get_client_info(request: Request) -> dict:
    return {
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown")
    }

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = secrets.token_hex(8)
    start_time = datetime.utcnow()
    
    response = await call_next(request)
    
    duration = (datetime.utcnow() - start_time).total_seconds()
    
    logger.info(
        "request_completed",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration=duration,
        client_ip=request.client.host if request.client else "unknown"
    )
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    REQUEST_LATENCY.labels(endpoint=request.url.path).observe(duration)
    
    response.headers["X-Request-ID"] = request_id
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    ERROR_COUNT.labels(type=type(exc).__name__).inc()
    logger.error("unhandled_exception", error=str(exc), path=request.url.path)
    
    if settings.debug:
        detail = str(exc)
    else:
        detail = "Internal server error"
    
    return JSONResponse(
        status_code=500,
        content={"detail": detail, "type": type(exc).__name__}
    )

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
        "blockchain_connected": w3.is_connected(),
        "contract_loaded": vault is not None
    }

@app.get("/metrics")
async def metrics():
    from starlette.responses import Response
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/api/v1/auth/token", response_model=TokenResponse)
@limiter.limit("10/minute")
async def get_token(request: Request, x_api_key: Annotated[str, Header()]):
    if not secrets.compare_digest(x_api_key, settings.api_secret):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    token = create_access_token({"sub": "api_client", "type": "access"})
    
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60
    )

class VaultRegistration(BaseModel):
    wallet_address: str
    vault_address: str
    network: str = "sepolia"

    @field_validator("wallet_address", "vault_address")
    @classmethod
    def validate_address(cls, v):
        if not Web3.is_address(v):
            raise ValueError("Invalid Ethereum address")
        return v.lower()

@app.post("/api/v1/vault/register")
@limiter.limit("10/minute")
async def register_user_vault(
    request: Request,
    req: VaultRegistration,
    auth: bool = Depends(verify_api_key)
):
    try:
        register_vault(req.wallet_address, req.vault_address, req.network)
        logger.info("vault_registered", wallet=req.wallet_address, vault=req.vault_address)
        return {"success": True, "vault_address": req.vault_address}
    except Exception as e:
        logger.error("vault_registration_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/vault/lookup")
@limiter.limit(settings.rate_limit)
async def lookup_vault(
    request: Request,
    wallet_address: str,
    auth: bool = Depends(verify_api_key)
):
    if not Web3.is_address(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid address format")
    
    vault_info = get_vault_by_wallet(wallet_address)
    if not vault_info:
        raise HTTPException(status_code=404, detail="Vault not found for wallet")
    return vault_info

@app.get("/api/v1/vault/balance")
@limiter.limit(settings.rate_limit)
async def get_balance(request: Request, auth: bool = Depends(verify_api_key)):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")
    
    try:
        balance = vault.functions.getVaultBalance().call()
        return {
            "balance_wei": str(balance),
            "balance_formatted": str(balance / 10**18),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error("balance_fetch_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch balance")

@app.get("/api/v1/vault/limits")
@limiter.limit(settings.rate_limit)
async def get_limits(request: Request, auth: bool = Depends(verify_api_key)):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")
    
    daily = vault.functions.dailyLimit().call()
    tx_limit = vault.functions.transactionLimit().call()
    timelock = vault.functions.timeLockDuration().call()
    
    return {
        "daily_limit_wei": str(daily),
        "daily_limit_formatted": str(daily / 10**18),
        "transaction_limit_wei": str(tx_limit),
        "transaction_limit_formatted": str(tx_limit / 10**18),
        "timelock_duration_seconds": timelock
    }

@app.get("/api/v1/transactions/pending")
@limiter.limit(settings.rate_limit)
async def pending_transactions(
    request: Request, 
    auth: bool = Depends(verify_api_key),
    context: dict = Depends(get_wallet_context)
):
    txs = get_pending_transactions(vault_address=context.get("vault_address"))
    return {"transactions": txs, "count": len(txs)}

@app.get("/api/v1/transactions/history")
@limiter.limit(settings.rate_limit)
async def transaction_history(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    auth: bool = Depends(verify_api_key),
    context: dict = Depends(get_wallet_context)
):
    limit = min(limit, 500)
    txs = get_transaction_history(limit, offset, vault_address=context.get("vault_address"))
    return {"transactions": txs, "count": len(txs), "limit": limit, "offset": offset}

@app.get("/api/v1/transactions/{tx_id}")
@limiter.limit(settings.rate_limit)
async def get_transaction(
    request: Request, 
    tx_id: int, 
    auth: bool = Depends(verify_api_key),
    context: dict = Depends(get_wallet_context)
):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")
    
    try:
        txn = vault.functions.getTransaction(tx_id).call()
        db_tx = get_transaction_by_id(tx_id, vault_address=context.get("vault_address"))
        integrity = verify_transaction_integrity(tx_id)
        
        return {
            "agent": txn[0],
            "vendor": txn[1],
            "amount_wei": str(txn[2]),
            "amount_formatted": str(txn[2] / 10**18),
            "timestamp": txn[3],
            "execute_after": txn[4],
            "executed": txn[5],
            "revoked": txn[6],
            "reason": txn[7],
            "integrity_verified": integrity,
            "risk_score": db_tx.get("risk_score") if db_tx else None,
            "risk_factors": json.loads(db_tx.get("risk_factors", "[]")) if db_tx else []
        }
    except Exception as e:
        logger.error("transaction_fetch_failed", tx_id=tx_id, error=str(e))
        raise HTTPException(status_code=404, detail="Transaction not found")

@app.get("/api/v1/agents/{address}")
@limiter.limit(settings.rate_limit)
async def get_agent(request: Request, address: str, auth: bool = Depends(verify_api_key)):
    if not Web3.is_address(address):
        raise HTTPException(status_code=400, detail="Invalid address format")
    
    profile = get_agent_profile(Web3.to_checksum_address(address))
    if not profile:
        raise HTTPException(status_code=404, detail="Agent not found")
    return profile

@app.get("/api/v1/vendors")
@limiter.limit(settings.rate_limit)
async def list_vendors(
    request: Request,
    trusted_only: bool = False,
    auth: bool = Depends(verify_api_key),
    context: dict = Depends(get_wallet_context)
):
    vendors = get_vendors(trusted_only, wallet_address=context.get("wallet_address"))
    return {"vendors": vendors, "count": len(vendors)}


class SimpleVendorRequest(BaseModel):
    address: str
    name: str
    trusted: bool = True

    @field_validator("address")
    @classmethod
    def validate_address(cls, v):
        if not Web3.is_address(v):
            raise ValueError("Invalid Ethereum address")
        return Web3.to_checksum_address(v)


@app.post("/api/v1/vendors")
@limiter.limit("30/minute")
async def save_vendor_name(
    request: Request,
    req: SimpleVendorRequest,
    auth: bool = Depends(verify_api_key),
    context: dict = Depends(get_wallet_context)
):
    try:
        upsert_vendor(req.address, req.name, req.trusted, wallet_address=context.get("wallet_address"))
        
        logger.info(
            "vendor_name_saved",
            address=req.address,
            name=req.name,
            trusted=req.trusted,
            wallet=context.get("wallet_address")
        )

        return {
            "success": True,
            "vendor": {
                "address": req.address,
                "name": req.name,
                "trusted": req.trusted
            }
        }
    except Exception as e:
        logger.error("save_vendor_name_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/vendors/{address}")
@limiter.limit(settings.rate_limit)
async def check_vendor(request: Request, address: str, auth: bool = Depends(verify_api_key)):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")
    
    if not Web3.is_address(address):
        raise HTTPException(status_code=400, detail="Invalid address format")
    
    checksum_addr = Web3.to_checksum_address(address)
    trusted = vault.functions.trustedVendors(checksum_addr).call()
    return {"address": checksum_addr, "trusted": trusted}

@app.get("/api/v1/alerts")
@limiter.limit(settings.rate_limit)
async def list_alerts(
    request: Request,
    acknowledged: Optional[bool] = None,
    limit: int = 100,
    auth: bool = Depends(verify_api_key)
):
    ack_filter = None if acknowledged is None else (1 if acknowledged else 0)
    alerts = get_alerts(ack_filter, min(limit, 500))
    return {"alerts": alerts, "count": len(alerts)}

@app.post("/api/v1/alerts/acknowledge")
@limiter.limit("30/minute")
async def ack_alert(
    request: Request,
    req: AlertAckRequest,
    auth: bool = Depends(verify_api_key)
):
    client_info = await get_client_info(request)
    
    success = acknowledge_alert(req.alert_id, "api_client")
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    insert_audit_log(
        "alert_acknowledged",
        "alert",
        str(req.alert_id),
        None,
        None,
        "api_client",
        client_info["ip"],
        client_info["user_agent"]
    )
    
    return {"success": True, "alert_id": req.alert_id}

@app.post("/api/v1/transactions/revoke")
@limiter.limit("10/minute")
async def revoke_transaction(
    request: Request,
    req: RevokeRequest,
    auth: bool = Depends(verify_api_key)
):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")
    
    client_info = await get_client_info(request)

    try:
        private_key = req.private_key if req.private_key.startswith("0x") else f"0x{req.private_key}"
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)
        
        gas_price = w3.eth.gas_price
        gas_estimate = vault.functions.revokeTransaction(req.tx_id, req.reason).estimate_gas({
            "from": account.address
        })
        
        gas_limit = int(gas_estimate * 1.2)

        tx = vault.functions.revokeTransaction(req.tx_id, req.reason).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": gas_price
        })

        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        insert_audit_log(
            "revoke_submitted",
            "transaction",
            str(req.tx_id),
            None,
            req.reason,
            account.address,
            client_info["ip"],
            client_info["user_agent"]
        )

        logger.info("transaction_revoked", tx_id=req.tx_id, tx_hash=tx_hash.hex())

        return {
            "success": True,
            "tx_hash": tx_hash.hex(),
            "gas_used": gas_limit,
            "revoked_tx_id": req.tx_id
        }

    except ValueError as e:
        logger.warning("revoke_validation_error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("revoke_failed", tx_id=req.tx_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Revoke failed: {str(e)}")

@app.post("/api/v1/vault/limits")
@limiter.limit("5/minute")
async def set_limits(
    request: Request,
    req: LimitsRequest,
    auth: bool = Depends(verify_api_key)
):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")

    client_info = await get_client_info(request)

    try:
        private_key = req.private_key if req.private_key.startswith("0x") else f"0x{req.private_key}"
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)

        daily = int(req.daily_limit)
        tx_limit = int(req.transaction_limit)

        gas_estimate = vault.functions.setLimits(daily, tx_limit).estimate_gas({
            "from": account.address
        })

        tx = vault.functions.setLimits(daily, tx_limit).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": int(gas_estimate * 1.2),
            "gasPrice": w3.eth.gas_price
        })

        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        insert_audit_log(
            "limits_updated",
            "vault",
            "limits",
            None,
            f"daily:{daily},tx:{tx_limit}",
            account.address,
            client_info["ip"],
            client_info["user_agent"]
        )

        return {"success": True, "tx_hash": tx_hash.hex()}

    except Exception as e:
        logger.error("set_limits_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vendors/set")
@limiter.limit("10/minute")
async def set_vendor(
    request: Request,
    req: VendorRequest,
    auth: bool = Depends(verify_api_key)
):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")

    client_info = await get_client_info(request)

    try:
        private_key = req.private_key if req.private_key.startswith("0x") else f"0x{req.private_key}"
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)

        gas_estimate = vault.functions.setTrustedVendor(req.vendor, req.trusted).estimate_gas({
            "from": account.address
        })

        tx = vault.functions.setTrustedVendor(req.vendor, req.trusted).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": int(gas_estimate * 1.2),
            "gasPrice": w3.eth.gas_price
        })

        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        insert_audit_log(
            "vendor_updated",
            "vendor",
            req.vendor,
            None,
            str(req.trusted),
            account.address,
            client_info["ip"],
            client_info["user_agent"]
        )

        return {"success": True, "tx_hash": tx_hash.hex(), "vendor": req.vendor, "trusted": req.trusted}

    except Exception as e:
        logger.error("set_vendor_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/vendors/add")
@limiter.limit("10/minute")
async def add_vendor_with_name(
    request: Request,
    req: VendorWithNameRequest,
    auth: bool = Depends(verify_api_key)
):
    """
    Add a trusted vendor with a name.
    This updates both the blockchain AND the database with the vendor name.
    The name is used by AI agents to match vendor requests.
    """
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")

    client_info = await get_client_info(request)

    try:
        private_key = req.private_key if req.private_key.startswith("0x") else f"0x{req.private_key}"
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)

        # Update blockchain
        gas_estimate = vault.functions.setTrustedVendor(req.address, req.trusted).estimate_gas({
            "from": account.address
        })

        tx = vault.functions.setTrustedVendor(req.address, req.trusted).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": int(gas_estimate * 1.2),
            "gasPrice": w3.eth.gas_price
        })

        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        # Save to database with name
        upsert_vendor(req.address, req.name, req.trusted)

        insert_audit_log(
            "vendor_added_with_name",
            "vendor",
            req.address,
            None,
            f"name={req.name},trusted={req.trusted}",
            account.address,
            client_info["ip"],
            client_info["user_agent"]
        )

        logger.info(
            "vendor_added",
            address=req.address,
            name=req.name,
            trusted=req.trusted,
            tx_hash=tx_hash.hex()
        )

        return {
            "success": True,
            "tx_hash": tx_hash.hex(),
            "vendor": {
                "address": req.address,
                "name": req.name,
                "trusted": req.trusted
            }
        }

    except Exception as e:
        logger.error("add_vendor_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# AGENT API - For AI agents to request payments via REST API
# =============================================================================

class AgentPaymentRequest(BaseModel):
    vendor: str  # Can be vendor name or address
    amount: str  # Amount in MNEE (will be converted to wei)
    reason: Optional[str] = ""
    vault: Optional[str] = None  # Optional vault address override
    private_key: str  # Agent's private key to sign the request

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        try:
            amount = float(v)
            if amount <= 0:
                raise ValueError("Amount must be positive")
            return v
        except ValueError:
            raise ValueError("Invalid amount format")


@app.get("/api/v1/vendors/search")
@limiter.limit(settings.rate_limit)
async def search_vendors(
    request: Request,
    name: Optional[str] = None,
    address: Optional[str] = None,
    trusted_only: bool = True,
    auth: bool = Depends(verify_api_key)
):
    """Search vendors by name or address"""
    vendors = get_vendors(trusted_only)
    
    results = []
    for vendor in vendors:
        # Match by name (case-insensitive partial match)
        if name:
            vendor_name = (vendor.get("name") or "").lower()
            if name.lower() in vendor_name or vendor_name in name.lower():
                results.append(vendor)
                continue
        
        # Match by address
        if address:
            vendor_addr = (vendor.get("address") or "").lower()
            if vendor_addr == address.lower():
                results.append(vendor)
                continue
        
        # If no filters, return all
        if not name and not address:
            results.append(vendor)
    
    return {"vendors": results, "count": len(results)}


@app.post("/api/v1/agent/payment")
@limiter.limit("30/minute")
async def agent_request_payment(
    request: Request,
    req: AgentPaymentRequest,
    auth: bool = Depends(verify_api_key)
):
    """
    AI Agent Payment Request API
    
    Allows external AI agents to request payments through Sentinel.
    The payment goes through the same risk scoring and timelock as UI requests.
    """
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")

    client_info = await get_client_info(request)

    try:
        # Resolve vendor - could be name or address
        vendor_address = req.vendor
        vendor_name = req.vendor
        is_trusted = False
        
        # If not an address, search by name
        if not Web3.is_address(req.vendor):
            vendors = get_vendors(trusted_only=True)
            for v in vendors:
                v_name = (v.get("name") or "").lower()
                if v_name and (req.vendor.lower() in v_name or v_name in req.vendor.lower()):
                    vendor_address = v["address"]
                    vendor_name = v.get("name", req.vendor)
                    is_trusted = v.get("trusted", 0) == 1
                    break
            else:
                # Not found in trusted vendors - generate new address or reject
                raise HTTPException(
                    status_code=400, 
                    detail=f"Vendor '{req.vendor}' not found in trusted vendors. Add it in Settings first or provide a valid address."
                )
        else:
            # It's an address - check if trusted
            vendor_address = Web3.to_checksum_address(req.vendor)
            try:
                is_trusted = vault.functions.trustedVendors(vendor_address).call()
            except:
                is_trusted = False

        # Convert amount to wei
        amount_wei = int(float(req.amount) * 10**18)

        # Sign and send transaction
        private_key = req.private_key if req.private_key.startswith("0x") else f"0x{req.private_key}"
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)

        # Build requestPayment transaction
        gas_estimate = vault.functions.requestPayment(
            Web3.to_checksum_address(vendor_address),
            amount_wei,
            account.address
        ).estimate_gas({"from": account.address})

        tx = vault.functions.requestPayment(
            Web3.to_checksum_address(vendor_address),
            amount_wei,
            account.address
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": int(gas_estimate * 1.2),
            "gasPrice": w3.eth.gas_price
        })

        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        # Calculate risk score
        amount_float = float(req.amount)
        if is_trusted:
            risk_score = 0.15 if amount_float <= 500 else 0.45
        else:
            risk_score = 0.65 if amount_float <= 100 else 0.85

        # Determine status based on risk
        if risk_score > 0.7:
            status = "blocked"
        elif risk_score > 0.4:
            status = "pending"
        else:
            status = "approved"

        # Log the request
        insert_audit_log(
            "agent_payment_requested",
            "agent_api",
            vendor_address,
            None,
            f"amount={req.amount},reason={req.reason},trusted={is_trusted}",
            account.address,
            client_info["ip"],
            client_info["user_agent"]
        )

        logger.info(
            "agent_payment_requested",
            vendor=vendor_address,
            vendor_name=vendor_name,
            amount=req.amount,
            trusted=is_trusted,
            risk_score=risk_score,
            status=status,
            tx_hash=tx_hash.hex()
        )

        return {
            "success": True,
            "tx_hash": tx_hash.hex(),
            "tx_id": receipt.get("logs", [{}])[0].get("topics", [b"", b""])[1].hex() if receipt.get("logs") else None,
            "vendor": vendor_address,
            "vendor_name": vendor_name,
            "amount": req.amount,
            "amount_wei": str(amount_wei),
            "trusted": is_trusted,
            "risk_score": risk_score,
            "status": status,
            "message": f"Payment request {'approved' if status == 'approved' else 'pending review' if status == 'pending' else 'blocked - high risk'}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("agent_payment_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/agent/vendors")
@limiter.limit(settings.rate_limit)
async def agent_list_vendors(
    request: Request,
    auth: bool = Depends(verify_api_key)
):
    """
    List trusted vendors for AI agents
    Returns a simplified list with name and address
    """
    vendors = get_vendors(trusted_only=True)
    return {
        "vendors": [
            {"name": v.get("name", "Unknown"), "address": v["address"]}
            for v in vendors
        ],
        "count": len(vendors)
    }


@app.get("/api/v1/stats")
@limiter.limit(settings.rate_limit)
async def get_stats_endpoint(request: Request, auth: bool = Depends(verify_api_key)):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")

    try:
        balance = vault.functions.getVaultBalance().call()
        db_stats = get_stats()

        return {
            "vault_balance_wei": str(balance),
            "vault_balance_formatted": str(balance / 10**18),
            **db_stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error("stats_fetch_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch stats")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )