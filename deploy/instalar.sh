#!/usr/bin/env bash
# Instala Capa3D en un servidor Ubuntu/Debian (VPS). Ejecútalo desde la carpeta del proyecto:
#   sudo bash deploy/instalar.sh
# Antes: apunta tu dominio (registro A) a la IP del servidor.
#
# Si otra app del servidor ya usa los puertos 80/443 (nginx, Apache, Caddy, Traefik…), Capa3D
# no los toca: queda en un puerto local y el proxy de esa app le pasa el dominio ("modo
# compartido"). Con nginx eso se configura solo; con otros proxies se muestra qué agregar.
set -euo pipefail
cd "$(dirname "$0")"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecútalo con sudo: sudo bash deploy/instalar.sh"; exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "▶ Instalando Docker…"
  curl -fsSL https://get.docker.com | sh
fi

# ¿Quién usa los puertos web? (antes de arrancar Capa3D)
ocupado=$(ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null || true)
if [ -n "$ocupado" ] && docker compose ps --status running 2>/dev/null | grep -q caddy; then
  ocupado=""  # es el Caddy de una instalación anterior de Capa3D
fi

if [ -f .env ]; then
  echo "▶ Ya existe deploy/.env: uso esa configuración (bórrala para empezar de nuevo)."
else
  echo
  read -rp "Tu dominio para Capa3D, sin https:// (ej. capa3d.co o tienda.midominio.com): " DOMINIO
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
  if [ "$(nproc)" -le 2 ] && [ -n "$ocupado" ]; then
    # Servidor pequeño con otras apps: la API lamina con un solo núcleo para no quitárselo a ellas.
    cat >> .env <<CONF
# Servidor pequeño con otras apps: laminar con 1 núcleo (sube o borra estas líneas si quieres más).
API_CPUS=1
API_CPUS_TRABAJOS=1
CONF
  fi
  if [ -n "$ocupado" ]; then
    # Primer puerto local libre desde 8088.
    PUERTO=8088
    while ss -ltnH "( sport = :$PUERTO )" | grep -q .; do PUERTO=$((PUERTO + 1)); done
    cat >> .env <<CONF
# Modo compartido: otra app usa los puertos 80/443.
COMPOSE_FILE=docker-compose.yml:compartido.yml
PUERTO_LOCAL=$PUERTO
CONF
  fi
fi

set -a; . ./.env; set +a
compartido=false
[[ "${COMPOSE_FILE:-}" == *compartido.yml* ]] && compartido=true

if $compartido; then
  echo
  echo "▶ Otra app ya usa los puertos web:"
  echo "${ocupado:-  (configurado antes en modo compartido)}" | sed 's/^/    /'
  echo "  Capa3D queda en el puerto local $PUERTO_LOCAL y no toca esa app."
fi

# Firewall: si ya está activo, se permiten los puertos web. No se activa aquí: en un servidor
# con otras apps podría cortar sus puertos.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
fi

echo "▶ Construyendo y arrancando (la primera vez tarda varios minutos)…"
docker compose up -d --build

proxy_listo=true
if $compartido; then
  dominios="$DOMINIO"
  getent ahostsv4 "www.$DOMINIO" >/dev/null 2>&1 && dominios="$DOMINIO www.$DOMINIO"
  if systemctl is-active --quiet nginx 2>/dev/null; then
    sitio=/etc/nginx/sites-available/capa3d
    ipv6=""
    [ -s /proc/net/if_inet6 ] && ipv6=$'\n    listen [::]:80;'
    echo "▶ Configurando nginx para $dominios → Capa3D (archivo nuevo: $sitio)…"
    cat > "$sitio" <<NGINX
# Capa3D (creado por deploy/instalar.sh): $dominios → 127.0.0.1:$PUERTO_LOCAL
server {
    listen 80;$ipv6
    server_name $dominios;
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:$PUERTO_LOCAL;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Actualizaciones en vivo de pedidos y panel.
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
NGINX
    ln -sf "$sitio" /etc/nginx/sites-enabled/capa3d
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      if ! command -v certbot >/dev/null 2>&1; then
        echo "▶ Instalando certbot para el HTTPS…"
        apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
      fi
      certificados=""
      for d in $dominios; do certificados="$certificados -d $d"; done
      # shellcheck disable=SC2086
      if certbot --nginx $certificados --redirect --agree-tos -m "$CORREO" -n; then
        echo "  ✔ HTTPS listo con certbot (se renueva solo)."
      else
        proxy_listo=false
        echo "  ✖ certbot no pudo emitir el certificado. Revisa que el dominio apunte a este servidor y repite:"
        echo "    sudo certbot --nginx$certificados --redirect"
      fi
    else
      rm -f /etc/nginx/sites-enabled/capa3d "$sitio"
      proxy_listo=false
      echo "  ✖ nginx no aceptó la configuración; la quité para no afectar tu otra app. Detalle:"
      nginx -t || true
    fi
  else
    proxy_listo=false
    echo
    echo "▶ Falta un paso: que el proxy de tu otra app mande $DOMINIO a Capa3D."
    echo "  Capa3D escucha en http://127.0.0.1:$PUERTO_LOCAL. Según el proxy que uses, agrega:"
    echo
    echo "  • Caddy (/etc/caddy/Caddyfile), y luego: sudo systemctl reload caddy"
    echo "      $DOMINIO {"
    echo "          reverse_proxy 127.0.0.1:$PUERTO_LOCAL { flush_interval -1 }"
    echo "      }"
    echo
    echo "  • Apache: un VirtualHost para $DOMINIO con"
    echo "      ProxyPreserveHost On"
    echo "      ProxyPass / http://127.0.0.1:$PUERTO_LOCAL/ flushpackets=on"
    echo "      ProxyPassReverse / http://127.0.0.1:$PUERTO_LOCAL/"
    echo "    y el HTTPS con: sudo certbot --apache -d $DOMINIO"
    echo
    echo "  • Traefik u otro proxy en Docker: una ruta para Host(\`$DOMINIO\`) hacia"
    echo "    http://host.docker.internal:$PUERTO_LOCAL (o la IP privada del servidor)."
    echo
    echo "  Acepta archivos de hasta 110 MB y no guardes en búfer las respuestas (actualizaciones en vivo)."
  fi
fi

echo
echo "✔ Capa3D está corriendo."
if $proxy_listo; then
  echo "  Sitio:  https://$DOMINIO"
else
  echo "  Sitio:  https://$DOMINIO  (cuando completes el paso del proxy de arriba)"
fi
echo "  Panel:  https://$DOMINIO/admin   Clave: $CLAVE_PANEL"
echo
echo "  Guarda la clave. Para cambiarla, edita CLAVE_PANEL en deploy/.env y ejecuta deploy/actualizar.sh."
echo "  Pagos con Wompi: llena las llaves WOMPI_* en deploy/.env, ejecuta deploy/actualizar.sh y en"
echo "  Wompi pon como URL de eventos: https://$DOMINIO/api/payments/wompi"
