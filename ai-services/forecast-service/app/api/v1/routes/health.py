from fastapi import APIRouter

from app.services.runtime_contract_service import validate_runtime_contract, validate_runtime_data_readiness

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict:
    contract = validate_runtime_contract(force=False)
    status = "ok" if contract.get("status") in {"ok", "warn"} else "error"
    return {"status": status, "runtime_contract": contract}


@router.get("/runtime-contract")
def runtime_contract(force: bool = False) -> dict:
    return validate_runtime_contract(force=force)


@router.get("/runtime-data-readiness")
def runtime_data_readiness(warehouse_id: str | None = None) -> dict:
    return validate_runtime_data_readiness(warehouse_id=warehouse_id)
