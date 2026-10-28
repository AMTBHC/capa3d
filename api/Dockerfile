# API de cotización con PrusaSlicer para laminar.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CAPA3D_DATA_DIR=/data

RUN apt-get update \
 && apt-get install -y --no-install-recommends prusa-slicer openscad fonts-liberation python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY capa3d_api ./capa3d_api
RUN python3 -m venv /venv && /venv/bin/pip install --no-cache-dir .
COPY config ./config

RUN useradd --system --home /app capa3d && mkdir -p /data && chown capa3d /data
USER capa3d
VOLUME /data
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD /venv/bin/python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"
CMD ["/venv/bin/uvicorn", "capa3d_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
