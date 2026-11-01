@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js. Instalalo desde https://nodejs.org y volve a abrir este archivo.
  echo Se necesita Node.js 22 o posterior.
  pause
  popd
  exit /b 1
)
node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
if errorlevel 1 (
  echo Se necesita Node.js 22 o posterior. Actualizalo desde https://nodejs.org.
  pause
  popd
  exit /b 1
)
node herramientas/conectar-instagram.mjs
set "resultado=%errorlevel%"
popd
if not "%resultado%"=="0" (
  echo No se completo la conexion. Revisa el mensaje anterior.
)
pause
exit /b %resultado%
