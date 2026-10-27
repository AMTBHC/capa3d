from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from .catalog import load_catalog
from .schemas import FileOut, QuoteOut, QuoteRequest
from .service import QuoteService, UploadError
from .settings import Settings, get_settings
from .slicer import PrusaSlicer
from .store import Store


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    catalog = load_catalog(settings.catalog_path)
    store = Store(settings.data_dir / "capa3d.db")
    slicer = PrusaSlicer(settings.slicer_path, catalog, settings.slice_timeout_s)
    service = QuoteService(settings, catalog, store, slicer)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        service.pool.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title="Capa3D API", version="0.1.0", lifespan=lifespan)
    app.state.service = service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(UploadError)
    async def upload_error(_: Request, e: UploadError):
        return JSONResponse({"detail": str(e)}, status_code=e.status)

    @app.get("/api/health")
    def health():
        return {"ok": True, "slicer": slicer.version if settings.slicer_enabled else None}

    @app.get("/api/catalog")
    def get_catalog():
        """Precios y parámetros públicos, para el estimado inmediato de la web."""
        return {
            "currency": catalog.currency,
            "pricing": catalog.pricing.model_dump(),
            "bed": catalog.printer.bed,
            "materials": {
                k: {"price_per_gram": m.price_per_gram, "density": m.density} for k, m in catalog.materials.items()
            },
            "qualities": {k: q.model_dump() for k, q in catalog.qualities.items()},
            "slicing": service.can_slice,
        }

    @app.post("/api/files", response_model=FileOut, status_code=201)
    async def upload(file: Annotated[UploadFile, File()]):
        return await run_in_threadpool(service.save_upload, file.filename or "", file.file)

    @app.get("/api/files/{file_id}", response_model=FileOut)
    def get_file(file_id: str):
        row = store.get_file(file_id) if file_id.isalnum() else None
        if row is None:
            raise HTTPException(404, "Archivo no encontrado")
        return service.file_out(row)

    @app.get("/api/files/{file_id}/plates/{plate_id}.stl")
    def plate_mesh(file_id: str, plate_id: int):
        """Malla de una cama (sin escalar). La web la usa para mostrar archivos STEP."""
        try:
            path = service.plate_stl(file_id, plate_id)
        except KeyError:
            raise HTTPException(404, "Cama no encontrada") from None
        return FileResponse(path, media_type="model/stl", filename=f"cama-{plate_id}.stl")

    @app.post("/api/quotes", response_model=QuoteOut, status_code=202)
    def create_quote(req: QuoteRequest):
        return service.quote_out(service.create_quote(req))

    @app.get("/api/quotes/{quote_id}", response_model=QuoteOut)
    def get_quote(quote_id: str):
        q = store.get_quote(quote_id) if quote_id.isalnum() else None
        if q is None:
            raise HTTPException(404, "Cotización no encontrada")
        return service.quote_out(q)

    return app
