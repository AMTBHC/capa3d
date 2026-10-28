#!/usr/bin/env bash
# Instala Capa3D en un servidor Ubuntu/Debian recién creado (VPS). Ejecútalo desde la carpeta
# del proyecto:   sudo bash deploy/instalar.sh
# Antes: apunta tu dominio (registro A) a la IP del servidor.
set -euo pipefail
cd "$(dirname "$0")"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecútalo con sudo: sudo bash deploy/instalar.sh"; exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "▶ Instalando Docker…"
  curl -fsSL https://get.docker.com | sh
fi

if [ -f .env ]; then
  echo "▶ Ya existe deploy/.env: uso esa configuración (bórrala para empezar de nuevo)."
else
  echo
  read -rp "Tu dominio, sin https:// (ej. capa3d.co): " DOMINIO
  read -rp "Tu correo (para el certificado HTTPS): " CORREO
  read -rp "Número de WhatsApp con 57 (ej. 573001234567): " WHATSAPP
  read -rp "Correo de contacto que se muestra en el sitio: " CORREO_CONTACTO
  read -rsp "Clave del panel /admin (Enter = generar una segura): " CLAVE_PANEL; echo
  if [ -z "$CLAVE_PANEL" ]; then
    CLAVE_PANEL=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 24)
  elif [ ${#CLAVE_PANEL} -lt 12 ]; then
    echo "La clave debe tener al menos 12 caracteres."; exit 1
  fi
  umask 077
  cat > .env <<CONF
DOMINIO=$DOMINIO
CORREO=$CORREO
CLAVE_PANEL=$CLAVE_PANEL
WHATSAPP=$WHATSAPP
CORREO_CONTACTO=$CORREO_CONTACTO
WOMPI_PUBLIC_KEY=
WOMPI_INTEGRITY_SECRET=
WOMPI_EVENTS_SECRET=
WOMPI_PRIVATE_KEY=
CONF
fi

# Firewall: solo web (80/443) y SSH.
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
  ufw --force enable >/dev/null || true
fi

echo "▶ Construyendo y arrancando (la primera vez tarda varios minutos)…"
docker compose up -d --build

set -a; . ./.env; set +a
echo
echo "✔ Listo."
echo "  Sitio:  https://$DOMINIO"
echo "  Panel:  https://$DOMINIO/admin   Clave: $CLAVE_PANEL"
echo
echo "  Guarda la clave. Para cambiarla, edita CLAVE_PANEL en deploy/.env y ejecuta deploy/actualizar.sh."
echo "  Pagos con Wompi: llena las llaves WOMPI_* en deploy/.env, ejecuta deploy/actualizar.sh y en"
echo "  Wompi pon como URL de eventos: https://$DOMINIO/api/payments/wompi"
