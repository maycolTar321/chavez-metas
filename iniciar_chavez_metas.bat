@echo off
title CHAVEZ METAS - Sistema de Control de Metas y Ventas 24h

echo ============================================================================
echo   CHAVEZ METAS - SISTEMA PROFESIONAL DE CONTROL DE METAS Y VENTAS (24H)
echo   Conectado a Neon PostgreSQL Cloud (us-east-2)
echo ============================================================================
echo   USUARIA ADMINISTRADORA:  admin
echo   CONTRASENA:              chavez2026
echo   OTRAS PERSONAS:          Boton "Entrar en Modo Invitado (Ver Resultados)"
echo ============================================================================
echo.

cd /d "d:\appmetas"

echo [1/2] Abriendo http://localhost:3000/login en tu navegador en 4 segundos...
start "" cmd /c "timeout /t 4 >nul & explorer http://localhost:3000/login"

echo [2/2] Iniciando servidor de CHAVEZ METAS en el puerto 3000...
echo       (No cierres esta ventana mientras uses el sistema)
echo.

node "node_modules\next\dist\bin\next" dev -p 3000

echo.
echo El servidor se ha detenido.
pause
