@echo off
rem Arranca Capa3D en este computador (Windows): API en :8000 y sitio en :3000.
rem La primera vez instala las dependencias; despues arranca en segundos.
rem Para cerrarlo, cierra las dos ventanas negras que se abren.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  start https://nodejs.org
  pause
  exit /b 1
)

rem Se prefiere un Python estable: las versiones recien salidas a veces no tienen todas las librerias.
set "PY="
for %%v in (3.13 3.12 3.11) do (
  if not defined PY py -%%v -c "1" >nul 2>nul && set "PY=py -%%v"
)
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  echo Falta Python 3. Instalalo desde https://www.python.org/downloads/ y marca "Add python.exe to PATH".
  start https://www.python.org/downloads/
  pause
  exit /b 1
)

rem La marca .listo solo se escribe si la instalacion termino bien; si falta, se rehace.
if not exist "api\.venv\.listo" (
  echo Preparando la API, solo la primera vez...
  if exist "api\.venv" rmdir /s /q "api\.venv"
  %PY% -m venv api\.venv || goto :error
  api\.venv\Scripts\python -m pip install --quiet --upgrade pip
  api\.venv\Scripts\python -m pip install --quiet -e api || goto :error
  echo ok> "api\.venv\.listo"
)

if not exist "web\node_modules\.listo" (
  echo Preparando el sitio, solo la primera vez...
  pushd web
  call npm install --no-audit --no-fund || goto :error
  echo ok> node_modules\.listo
  popd
)

rem La web debe saber donde esta la API.
findstr /b /c:"NEXT_PUBLIC_API_URL=http" web\.env.local >nul 2>nul || (echo NEXT_PUBLIC_API_URL=http://localhost:8000)>>web\.env.local

echo Iniciando la API y el sitio...
start "Capa3D API" cmd /k "cd /d api && .venv\Scripts\python -m uvicorn capa3d_api.main:create_app --factory --port 8000"
start "Capa3D Web" cmd /k "cd /d web && npm run dev"

echo Se abrira http://localhost:3000 en unos segundos.
echo Si no ves el precio laminado, revisa http://localhost:8000/api/health: "slicer" debe tener una version.
echo Si dice null, instala PrusaSlicer desde https://www.prusa3d.com/page/prusaslicer_424/
timeout /t 10 /nobreak >nul
start http://localhost:3000
exit /b 0

:error
echo.
echo Algo fallo al preparar Capa3D. Revisa el mensaje de arriba.
pause
exit /b 1
