import os
import json
import secrets
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Annotated, List
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
    get_all_vaults,
    save_agent_wallet,
    get_agent_wallet,
    delete_agent_wallet,
    save_recurring_schedule,
    get_recurring_schedules,
    get_due_schedules,
    update_schedule_execution,
    update_schedule_failure,
    pause_schedule,
    resume_schedule,
    delete_schedule,
    save_savings_plan,
    get_savings_plans,
    get_due_savings_deposits,
    update_savings_deposit,
    set_plan_contract_id,
    mark_savings_withdrawn,
    delete_savings_plan,
    log_execution,
    get_execution_history,
    create_notification,
    get_notifications,
    mark_notification_read,
    mark_all_notifications_read
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
    savings_contract_address: str = ""
    mnee_token_address: str = "0x250ff89cf1518F42F3A4c927938ED73444491715"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Check backend folder first, then repo root
DEPLOYMENT_PATH = Path(__file__).parent / "deployment.json"
if not DEPLOYMENT_PATH.exists():
    DEPLOYMENT_PATH = Path(__file__).parent.parent / "deployment.json"
# Check backend folder first for ABI
ABI_PATH = Path(__file__).parent / "SentinelVault.json"
if not ABI_PATH.exists():
    ABI_PATH = Path(__file__).parent.parent / "artifacts" / "contracts" / "SentinelVault.sol" / "SentinelVault.json"

# Savings contract ABI
SAVINGS_ABI_PATH = Path(__file__).parent / "SentinelSavings.json"

REQUEST_COUNT = Counter("sentinel_requests_total", "Total requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("sentinel_request_latency_seconds", "Request latency", ["endpoint"])
ERROR_COUNT = Counter("sentinel_errors_total", "Total errors", ["type"])

limiter = Limiter(key_func=get_remote_address)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
vault = None
savings_contract = None

def load_contract():
    global vault, savings_contract
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
        
        # Load savings contract if available
        savings_address = deployment.get("savingsContract") or settings.savings_contract_address
        if savings_address and SAVINGS_ABI_PATH.exists():
            savings_abi = json.loads(SAVINGS_ABI_PATH.read_text())["abi"]
            savings_contract = w3.eth.contract(
                address=Web3.to_checksum_address(savings_address),
                abi=savings_abi
            )
            logger.info("savings_contract_loaded", address=savings_address)
        
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
    version="2.1.0",
    description="AI-powered security infrastructure for MNEE stablecoin with Agent Wallet support",
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
    address: str = Field(..., min_length=42, max_length=42)
    name: str = Field(..., min_length=1, max_length=100)
    trusted: bool = True
    private_key: str

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

class AgentPaymentRequest(BaseModel):
    vendor: str
    amount: str
    reason: Optional[str] = ""
    vault: Optional[str] = None
    private_key: str

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

# New models for Agent Wallet system
class AgentWalletRegister(BaseModel):
    user_address: str
    agent_address: str
    vault_address: str
    encrypted_key: str

    @field_validator("user_address", "agent_address", "vault_address")
    @classmethod
    def validate_address(cls, v):
        if not Web3.is_address(v):
            raise ValueError("Invalid Ethereum address")
        return v.lower()

class RecurringScheduleCreate(BaseModel):
    id: str
    user_address: str
    vault_address: str
    agent_address: Optional[str] = None
    vendor: str
    vendor_address: str
    amount: float
    frequency: str
    execution_time: str = "09:00"
    start_date: Optional[str] = None
    next_execution: str
    reason: Optional[str] = ""
    is_trusted: bool = False

class RecurringScheduleUpdate(BaseModel):
    amount: Optional[float] = None
    frequency: Optional[str] = None
    execution_time: Optional[str] = None
    next_execution: Optional[str] = None
    is_active: Optional[bool] = None

class SavingsPlanCreate(BaseModel):
    id: str
    user_address: str
    vault_address: str
    agent_address: Optional[str] = None
    name: str
    amount: float
    frequency: Optional[str] = None
    lock_days: int
    execution_time: str = "09:00"
    start_date: Optional[str] = None
    next_deposit: Optional[str] = None
    unlock_date: str
    reason: Optional[str] = ""
    is_recurring: bool = True
    total_deposits: int = 1
    target_amount: float

class SyncRequest(BaseModel):
    user_address: str
    schedules: List[dict]
    savings_plans: List[dict]


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
        "version": "2.1.0",
        "blockchain_connected": w3.is_connected(),
        "contract_loaded": vault is not None,
        "savings_contract_loaded": savings_contract is not None
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
async def get_pending(
    request: Request,
    auth: bool = Depends(verify_api_key),
    wallet: dict = Depends(get_wallet_context)
):
    return {"transactions": get_pending_transactions(wallet.get("vault_address"))}

@app.get("/api/v1/transactions/history")
@limiter.limit(settings.rate_limit)
async def get_history(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    auth: bool = Depends(verify_api_key),
    wallet: dict = Depends(get_wallet_context)
):
    return {
        "transactions": get_transaction_history(limit, offset, wallet.get("vault_address")),
        "limit": limit,
        "offset": offset
    }

@app.get("/api/v1/transactions/{tx_id}")
@limiter.limit(settings.rate_limit)
async def get_transaction(
    request: Request,
    tx_id: int,
    auth: bool = Depends(verify_api_key),
    wallet: dict = Depends(get_wallet_context)
):
    tx = get_transaction_by_id(tx_id, wallet.get("vault_address"))
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@app.get("/api/v1/vendors")
@limiter.limit(settings.rate_limit)
async def list_vendors(
    request: Request,
    trusted_only: bool = False,
    auth: bool = Depends(verify_api_key),
    wallet: dict = Depends(get_wallet_context)
):
    return {"vendors": get_vendors(trusted_only, wallet.get("wallet_address"))}

@app.get("/api/v1/vendors/search")
@limiter.limit(settings.rate_limit)
async def search_vendors(
    request: Request,
    name: Optional[str] = None,
    address: Optional[str] = None,
    trusted_only: bool = True,
    auth: bool = Depends(verify_api_key)
):
    vendors = get_vendors(trusted_only)
    
    results = []
    for vendor in vendors:
        if name:
            vendor_name = (vendor.get("name") or "").lower()
            if name.lower() in vendor_name or vendor_name in name.lower():
                results.append(vendor)
                continue
        
        if address:
            vendor_addr = (vendor.get("address") or "").lower()
            if vendor_addr == address.lower():
                results.append(vendor)
                continue
        
        if not name and not address:
            results.append(vendor)
    
    return {"vendors": results, "count": len(results)}

@app.post("/api/v1/vendors/add")
@limiter.limit("20/minute")
async def add_vendor_with_name(
    request: Request,
    req: VendorWithNameRequest,
    auth: bool = Depends(verify_api_key),
    wallet: dict = Depends(get_wallet_context)
):
    try:
        upsert_vendor(req.address, req.name, req.trusted, wallet.get("wallet_address"))
        logger.info("vendor_added", address=req.address, name=req.name)
        return {
            "success": True,
            "vendor": {
                "address": req.address,
                "name": req.name,
                "trusted": req.trusted
            }
        }
    except Exception as e:
        logger.error("add_vendor_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/alerts")
@limiter.limit(settings.rate_limit)
async def list_alerts(
    request: Request,
    acknowledged: Optional[int] = None,
    limit: int = 100,
    auth: bool = Depends(verify_api_key)
):
    return {"alerts": get_alerts(acknowledged, limit)}

@app.post("/api/v1/alerts/acknowledge")
@limiter.limit("30/minute")
async def ack_alert(
    request: Request,
    req: AlertAckRequest,
    auth: bool = Depends(verify_api_key)
):
    success = acknowledge_alert(req.alert_id, "api_user")
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "alert_id": req.alert_id}


@app.get("/api/v1/stats")
@limiter.limit(settings.rate_limit)
async def get_stats_endpoint(request: Request, auth: bool = Depends(verify_api_key)):
    try:
        db_stats = get_stats()
        
        response = {
            **db_stats,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if vault:
            try:
                balance = vault.functions.getVaultBalance().call()
                response["vault_balance_wei"] = str(balance)
                response["vault_balance_formatted"] = str(balance / 10**18)
            except:
                pass
        
        return response
    except Exception as e:
        logger.error("stats_fetch_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@app.post("/api/v1/agent/payment")
@limiter.limit("30/minute")
async def agent_request_payment(
    request: Request,
    req: AgentPaymentRequest,
    auth: bool = Depends(verify_api_key)
):
    if not vault:
        raise HTTPException(status_code=503, detail="Contract not loaded")

    client_info = await get_client_info(request)

    try:
        vendor_address = req.vendor
        vendor_name = req.vendor
        is_trusted = False
        
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
                raise HTTPException(
                    status_code=400, 
                    detail=f"Vendor '{req.vendor}' not found in trusted vendors."
                )
        else:
            vendor_address = Web3.to_checksum_address(req.vendor)
            try:
                is_trusted = vault.functions.trustedVendors(vendor_address).call()
            except:
                is_trusted = False

        amount_wei = int(float(req.amount) * 10**18)
        private_key = req.private_key if req.private_key.startswith("0x") else f"0x{req.private_key}"
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)

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
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        amount_float = float(req.amount)
        if is_trusted:
            risk_score = 0.15 if amount_float <= 500 else 0.45
        else:
            risk_score = 0.65 if amount_float <= 100 else 0.85

        if risk_score > 0.7:
            status = "blocked"
        elif risk_score > 0.4:
            status = "pending"
        else:
            status = "approved"

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
    vendors = get_vendors(trusted_only=True)
    return {
        "vendors": [
            {"name": v.get("name", "Unknown"), "address": v["address"]}
            for v in vendors
        ],
        "count": len(vendors)
    }

@app.post("/api/v1/agent-wallet/register")
@limiter.limit("10/minute")
async def register_agent_wallet(
    request: Request,
    req: AgentWalletRegister,
    auth: bool = Depends(verify_api_key)
):
    """Register or update an agent wallet for a user"""
    try:
        save_agent_wallet(
            req.user_address,
            req.agent_address,
            req.vault_address,
            req.encrypted_key
        )
        logger.info("agent_wallet_registered", user=req.user_address, agent=req.agent_address)
        return {
            "success": True,
            "user_address": req.user_address,
            "agent_address": req.agent_address
        }
    except Exception as e:
        logger.error("agent_wallet_registration_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/agent-wallet/{user_address}")
@limiter.limit(settings.rate_limit)
async def get_agent_wallet_info(
    request: Request,
    user_address: str,
    auth: bool = Depends(verify_api_key)
):
    """Get agent wallet info for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    wallet = get_agent_wallet(user_address)
    if not wallet:
        raise HTTPException(status_code=404, detail="Agent wallet not found")
    
        return {
        "user_address": wallet["user_address"],
        "agent_address": wallet["agent_address"],
        "vault_address": wallet["vault_address"],
        "created_at": wallet["created_at"]
    }

@app.delete("/api/v1/agent-wallet/{user_address}")
@limiter.limit("10/minute")
async def remove_agent_wallet(
    request: Request,
    user_address: str,
    auth: bool = Depends(verify_api_key)
):
    """Delete agent wallet for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    success = delete_agent_wallet(user_address)
    if not success:
        raise HTTPException(status_code=404, detail="Agent wallet not found")
    
    return {"success": True, "user_address": user_address}



@app.post("/api/v1/recurring/schedule")
@limiter.limit("30/minute")
async def create_recurring_schedule(
    request: Request,
    req: RecurringScheduleCreate,
    auth: bool = Depends(verify_api_key)
):
    """Create a new recurring payment schedule"""
    try:
        save_recurring_schedule(req.dict())
        logger.info("recurring_schedule_created", id=req.id, vendor=req.vendor)
        return {"success": True, "schedule_id": req.id}
    except Exception as e:
        logger.error("recurring_schedule_creation_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/recurring/schedules/{user_address}")
@limiter.limit(settings.rate_limit)
async def list_recurring_schedules(
    request: Request,
    user_address: str,
    active_only: bool = True,
    auth: bool = Depends(verify_api_key)
):
    """List all recurring schedules for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    schedules = get_recurring_schedules(user_address, active_only)
    return {"schedules": schedules, "count": len(schedules)}

@app.put("/api/v1/recurring/schedule/{schedule_id}")
@limiter.limit("30/minute")
async def update_recurring_schedule(
    request: Request,
    schedule_id: str,
    req: RecurringScheduleUpdate,
    auth: bool = Depends(verify_api_key)
):
    """Update a recurring schedule"""
    try:
        updates = {k: v for k, v in req.dict().items() if v is not None}
        updates["id"] = schedule_id
        save_recurring_schedule(updates)
        return {"success": True, "schedule_id": schedule_id}
    except Exception as e:
        logger.error("recurring_schedule_update_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/recurring/schedule/{schedule_id}/pause")
@limiter.limit("30/minute")
async def pause_recurring_schedule(
    request: Request,
    schedule_id: str,
    auth: bool = Depends(verify_api_key)
):
    """Pause a recurring schedule"""
    success = pause_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"success": True, "schedule_id": schedule_id, "status": "paused"}

@app.post("/api/v1/recurring/schedule/{schedule_id}/resume")
@limiter.limit("30/minute")
async def resume_recurring_schedule(
    request: Request,
    schedule_id: str,
    auth: bool = Depends(verify_api_key)
):
    """Resume a paused schedule"""
    success = resume_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"success": True, "schedule_id": schedule_id, "status": "active"}

@app.delete("/api/v1/recurring/schedule/{schedule_id}")
@limiter.limit("30/minute")
async def delete_recurring_schedule(
    request: Request,
    schedule_id: str,
    auth: bool = Depends(verify_api_key)
):
    """Delete a recurring schedule"""
    success = delete_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"success": True, "schedule_id": schedule_id}

@app.post("/api/v1/savings/plan")
@limiter.limit("30/minute")
async def create_savings_plan(
    request: Request,
    req: SavingsPlanCreate,
    auth: bool = Depends(verify_api_key)
):
    """Create a new savings plan"""
    try:
        save_savings_plan(req.dict())
        logger.info("savings_plan_created", id=req.id, name=req.name)
        return {"success": True, "plan_id": req.id}
    except Exception as e:
        logger.error("savings_plan_creation_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/savings/plans/{user_address}")
@limiter.limit(settings.rate_limit)
async def list_savings_plans(
    request: Request,
    user_address: str,
    active_only: bool = False,
    auth: bool = Depends(verify_api_key)
):
    """List all savings plans for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    plans = get_savings_plans(user_address, active_only)
    return {"plans": plans, "count": len(plans)}

@app.put("/api/v1/savings/plan/{plan_id}/contract-id")
@limiter.limit("30/minute")
async def set_savings_contract_id(
    request: Request,
    plan_id: str,
    contract_plan_id: int,
    auth: bool = Depends(verify_api_key)
):
    """Set on-chain contract ID for savings plan"""
    success = set_plan_contract_id(plan_id, contract_plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"success": True, "plan_id": plan_id, "contract_plan_id": contract_plan_id}

@app.post("/api/v1/savings/plan/{plan_id}/withdraw")
@limiter.limit("30/minute")
async def withdraw_savings_plan(
    request: Request,
    plan_id: str,
    auth: bool = Depends(verify_api_key)
):
    """Mark savings plan as withdrawn"""
    success = mark_savings_withdrawn(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"success": True, "plan_id": plan_id, "status": "withdrawn"}

@app.delete("/api/v1/savings/plan/{plan_id}")
@limiter.limit("30/minute")
async def delete_savings_plan_endpoint(
    request: Request,
    plan_id: str,
    auth: bool = Depends(verify_api_key)
):
    """Delete a savings plan"""
    success = delete_savings_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"success": True, "plan_id": plan_id}

@app.post("/api/v1/recurring/sync")
@limiter.limit("10/minute")
async def sync_recurring_data(
    request: Request,
    req: SyncRequest,
    auth: bool = Depends(verify_api_key)
):
    """Sync all recurring schedules and savings plans from frontend"""
    try:
        for schedule in req.schedules:
            schedule["user_address"] = req.user_address
            save_recurring_schedule(schedule)
        
        for plan in req.savings_plans:
            plan["user_address"] = req.user_address
            save_savings_plan(plan)
        
        logger.info(
            "recurring_data_synced",
            user=req.user_address,
            schedules=len(req.schedules),
            plans=len(req.savings_plans)
        )
        
        return {
            "success": True,
            "synced_schedules": len(req.schedules),
            "synced_plans": len(req.savings_plans)
        }
    except Exception as e:
        logger.error("sync_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/recurring/{user_address}")
@limiter.limit(settings.rate_limit)
async def get_all_recurring_data(
    request: Request,
    user_address: str,
    auth: bool = Depends(verify_api_key)
):
    """Get all recurring schedules and savings plans for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    schedules = get_recurring_schedules(user_address, active_only=False)
    plans = get_savings_plans(user_address, active_only=False)
    
    return {
        "schedules": schedules,
        "savingsPlans": plans
    }

@app.get("/api/v1/notifications/{user_address}")
@limiter.limit(settings.rate_limit)
async def list_notifications(
    request: Request,
    user_address: str,
    unread_only: bool = False,
    limit: int = 50,
    auth: bool = Depends(verify_api_key)
):
    """List notifications for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    notifications = get_notifications(user_address, unread_only, limit)
    return {"notifications": notifications, "count": len(notifications)}

@app.post("/api/v1/notifications/{notification_id}/read")
@limiter.limit("60/minute")
async def mark_notification_as_read(
    request: Request,
    notification_id: int,
    auth: bool = Depends(verify_api_key)
):
    """Mark notification as read"""
    success = mark_notification_read(notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True, "notification_id": notification_id}

@app.post("/api/v1/notifications/{user_address}/read-all")
@limiter.limit("10/minute")
async def mark_all_read(
    request: Request,
    user_address: str,
    auth: bool = Depends(verify_api_key)
):
    """Mark all notifications as read for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    count = mark_all_notifications_read(user_address)
    return {"success": True, "marked_read": count}


@app.get("/api/v1/execution-history/{user_address}")
@limiter.limit(settings.rate_limit)
async def get_execution_history_endpoint(
    request: Request,
    user_address: str,
    limit: int = 50,
    auth: bool = Depends(verify_api_key)
):
    """Get execution history for user"""
    if not Web3.is_address(user_address):
        raise HTTPException(status_code=400, detail="Invalid address")
    
    history = get_execution_history(user_address, limit)
    return {"history": history, "count": len(history)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )