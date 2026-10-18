
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints import wallet
from app.api.v1.endpoints import deposits
from app.db.session import engine
from app.api.v1.endpoints import withdrawals
from app.api.v1.endpoints import transfers


app = FastAPI(
    title="Wallet System API",
    description="REST API for a double-entry wallet and ledger system.",
    version="1.0.0",
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1",)
app.include_router(deposits.router, prefix="/api/v1")
app.include_router(withdrawals.router, prefix="/api/v1")
app.include_router(transfers.router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "wallet-system-api",
    }


@app.get("/db-health")
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"database": "connected"}
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed.",
        )