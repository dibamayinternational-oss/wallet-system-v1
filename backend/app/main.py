
from fastapi import FastAPI

app = FastAPI(
    title="Wallet System API",
    description="REST API for a double-entry wallet and ledger system.",
    version="1.0.0",
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "wallet-system-api",
    }