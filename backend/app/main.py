from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import EvidenceImmutableError
from .routers import auth, calls, me, messages, metrics, public, staff, transfers, trusted, ws
from .seed import ensure_seeded


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_seeded()
    yield


app = FastAPI(
    title="OCBC Verify API",
    description="Student prototype for OCBC IGNITE 2026, not an official OCBC product.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_origin_regex=r"http://(192\.168|10|172\.\d+)\.\d+\.\d+(\.\d+)?:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errs = exc.errors()
    first = errs[0] if errs else {}
    loc = [str(x) for x in first.get("loc", []) if x not in ("body", "query", "path")]
    return JSONResponse(status_code=422, content={"detail": {"field": loc[-1] if loc else None,
                                                             "message": "Please check this field: " + first.get("msg", "invalid value"),
                                                             "errors": [{"loc": e.get("loc"), "msg": e.get("msg")} for e in errs]}})


@app.exception_handler(EvidenceImmutableError)
async def evidence_handler(request: Request, exc: EvidenceImmutableError):
    return JSONResponse(status_code=403, content={"detail": "Evidence records can't be changed or deleted."})


@app.get("/api/health")
def health():
    return {"ok": True}


for r in (auth, me, transfers, trusted, calls, staff, messages, metrics, public, ws):
    app.include_router(r.router)
