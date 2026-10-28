import asyncio
import json
import secrets
import tempfile
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from .catalog import load_catalog
from .orders import Checkout, Lookup, OrderAction, OrderCreate, OrderError, OrderService
from .schemas import AdminQuote, FileOut, QuoteOut, QuoteRequest
from .service import QuoteService, UploadError
from .settings import Settings, get_settings
from .slicer import PrusaSlicer
from .store import Store
from .wompi import Wompi, WompiError

# Búsqueda de pedidos: máximo de intentos por IP en la ventana de tiempo.
LOOKUP_MAX = 10
LOOKUP_WINDOW_S = 600
# Cada cuánto revisa cambios una conexión en vivo.
STREAM_TICK_S = 1.0


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    catalog = load_catalog(settings.catalog_path)
    store = Store(settings.data_dir / "capa3d.db")
    slicer = PrusaSlicer(settings.slicer_path, catalog, settings.slice_timeout_s)
    service = QuoteService(settings, catalog, store, slicer)
    wompi = Wompi(
        settings.wompi_public_key,
        settings.wompi_integrity_secret,
        settings.wompi_events_secret,
        settings.wompi_private_key,
    )
    orders = OrderService(settings, catalog, store, service, wompi)

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
        allow_headers=["Content-Type", "Authorization"],
        # Para que el panel lea el nombre del zip al descargarlo.
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(UploadError)
    async def upload_error(_: Request, e: UploadError):
        return JSONResponse({"detail": str(e)}, status_code=e.status)

    @app.exception_handler(OrderError)
    async def order_error(_: Request, e: OrderError):
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
            "shipping": catalog.shipping.model_dump(),
            "payments": wompi.enabled,
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

    class OrderRequest(BaseModel):
        color: str | None = Field(default=None, max_length=40)

    @app.post("/api/quotes/{quote_id}/request", status_code=204)
    def request_order(quote_id: str, body: OrderRequest):
        """El cliente tocó "Pedir por WhatsApp": queda marcada para el panel."""
        if not quote_id.isalnum() or not store.mark_requested(quote_id, body.color):
            raise HTTPException(404, "Cotización no encontrada")

    # Pedidos del cliente: se identifican con el id y su token secreto (?t=).

    @app.post("/api/orders", status_code=201)
    def create_order(body: OrderCreate):
        o = orders.create(body)
        return {**orders.public(o), "token": o["token"]}

    @app.get("/api/orders/{order_id}")
    def get_order(order_id: str, t: str = ""):
        o = orders.get_for_customer(order_id, t)
        return orders.public(orders.refresh_payment(o))

    @app.post("/api/orders/{order_id}/checkout")
    def checkout(order_id: str, t: str = "", body: Checkout | None = None):
        url, returns = orders.checkout(order_id, t, (body or Checkout()).plan)
        # returns=False: Wompi no devolverá al cliente al sitio (sitio local); la web lo abre en otra pestaña.
        return {"url": url, "returns": returns}

    lookups: dict[str, deque] = defaultdict(deque)

    @app.post("/api/orders/lookup")
    def lookup_orders(body: Lookup, request: Request):
        """Pedidos por correo y celular. Limitado por IP para que no se pueda adivinar en masa."""
        ip = request.client.host if request.client else "?"
        now, hits = time.monotonic(), lookups[ip]
        while hits and now - hits[0] > LOOKUP_WINDOW_S:
            hits.popleft()
        if len(hits) >= LOOKUP_MAX:
            raise HTTPException(429, "Demasiados intentos; espera unos minutos")
        hits.append(now)
        return orders.lookup(body)

    def sse(event: str, data: object) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def live(request: Request, read):
        """
        Conexión en vivo (Server-Sent Events): cada segundo llama read(); si devuelve
        (versión, evento, datos) con otra versión, los envía. El navegador se reconecta solo.
        """
        yield "retry: 3000\n\n"
        last, quiet, start = None, 0, time.monotonic()
        while time.monotonic() - start < settings.stream_max_seconds:
            if await request.is_disconnected():
                break
            version, event, data = await run_in_threadpool(read)
            if version != last:
                last, quiet = version, 0
                yield sse(event, data)
            else:
                quiet += 1
                if quiet >= 15:
                    quiet = 0
                    yield ": sigue\n\n"
            await asyncio.sleep(STREAM_TICK_S)

    def streaming(gen) -> StreamingResponse:
        headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        return StreamingResponse(gen, media_type="text/event-stream", headers=headers)

    @app.get("/api/orders/{order_id}/stream")
    async def order_stream(order_id: str, request: Request, t: str = ""):
        """El pedido en vivo para la página del cliente."""
        await run_in_threadpool(orders.get_for_customer, order_id, t)

        def read():
            # De paso consulta en Wompi un pago pendiente (con llave privada; espaciado internamente).
            o = orders.refresh_payment(store.get_order(order_id))
            return o["version"], "order", orders.public(o)

        return streaming(live(request, read))

    class PaymentReturn(BaseModel):
        transaction_id: str = Field(max_length=64)

    @app.post("/api/orders/{order_id}/payment-return")
    def payment_return(order_id: str, body: PaymentReturn, t: str = ""):
        return orders.public(orders.payment_return(order_id, t, body.transaction_id))

    @app.post("/api/payments/wompi")
    async def wompi_events(request: Request):
        """Eventos de Wompi (configura esta URL en comercios.wompi.co → Desarrolladores → Eventos)."""
        try:
            tx = wompi.parse_event(await request.json())
        except (WompiError, ValueError) as e:
            raise HTTPException(401, str(e)) from None
        if tx:
            orders.apply_transaction(tx)
        return {"ok": True}

    # Administración: requiere CAPA3D_ADMIN_TOKEN y el encabezado Authorization: Bearer <clave>.

    def admin(authorization: Annotated[str | None, Header()] = None) -> None:
        token = settings.admin_token
        if not token:
            raise HTTPException(503, "Panel desactivado: define CAPA3D_ADMIN_TOKEN en la API")
        given = (authorization or "").removeprefix("Bearer ").strip()
        if not secrets.compare_digest(given.encode(), token.encode()):
            raise HTTPException(401, "Clave incorrecta")

    @app.get("/api/admin/quotes", response_model=list[AdminQuote], dependencies=[Depends(admin)])
    def admin_quotes(
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
        requested: bool = False,
    ):
        return [service.admin_quote_out(q) for q in store.list_quotes(limit, requested)]

    @app.get("/api/admin/quotes/{quote_id}/download", dependencies=[Depends(admin)])
    def admin_download(quote_id: str, background: BackgroundTasks):
        if not quote_id.isalnum() or store.get_quote(quote_id) is None:
            raise HTTPException(404, "Cotización no encontrada")
        tmp = Path(tempfile.mkstemp(suffix=".zip")[1])
        name = service.order_zip(quote_id, tmp)
        background.add_task(tmp.unlink, missing_ok=True)
        return FileResponse(tmp, media_type="application/zip", filename=name)

    @app.get("/api/admin/stream", dependencies=[Depends(admin)])
    async def admin_stream(request: Request):
        """Avisa al panel cuando llega un pedido o cambia alguno."""

        def read():
            version = store.orders_version()
            return version, "orders", {"count": version[0], "by_status": store.count_by_status()}

        return streaming(live(request, read))

    @app.get("/api/admin/orders", dependencies=[Depends(admin)])
    def admin_orders(status: str = "", limit: Annotated[int, Query(ge=1, le=500)] = 200):
        statuses = [x for x in status.split(",") if x] or None
        return [orders.admin_view(o) for o in store.list_orders(statuses, limit)]

    @app.post("/api/admin/orders/{order_id}/action", dependencies=[Depends(admin)])
    def admin_order_action(order_id: str, body: OrderAction):
        return orders.admin_view(orders.act(order_id, body))

    @app.get("/api/admin/orders/{order_id}/download", dependencies=[Depends(admin)])
    def admin_order_download(order_id: str, background: BackgroundTasks):
        tmp = Path(tempfile.mkstemp(suffix=".zip")[1])
        try:
            name = orders.order_zip(order_id, tmp)
        except OrderError:
            tmp.unlink(missing_ok=True)
            raise
        background.add_task(tmp.unlink, missing_ok=True)
        return FileResponse(tmp, media_type="application/zip", filename=name)

    return app
