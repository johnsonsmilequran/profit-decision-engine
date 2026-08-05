from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import router
from app.config import get_settings

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(
    title="趣然 AI 商品经营与利润决策助手 API",
    version="0.1.0",
    docs_url=None if settings.app_env == "production" else "/api/docs",
    redoc_url=None,
)
if settings.app_env != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(settings.frontend_base_url).rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
app.include_router(router)

static_root = Path(__file__).resolve().parent / "static"
if static_root.is_dir():
    app.mount("/assets", StaticFiles(directory=static_root / "assets"), name="assets")

    @app.get("/{frontend_path:path}", include_in_schema=False)
    def frontend(frontend_path: str) -> FileResponse:
        if frontend_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(static_root / "index.html")


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    logging.getLogger("app").exception(
        "request_failed path=%s type=%s", request.url.path, type(exc).__name__
    )
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "服务暂时不可用，请稍后重试。"}},
    )
