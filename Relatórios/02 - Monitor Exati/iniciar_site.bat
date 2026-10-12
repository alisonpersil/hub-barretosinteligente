@echo off
chcp 65001 > nul
title Monitor Exati - Servidor Web PMO

echo ========================================================
echo       MONITOR EXATI &bull; COCKPIT EXECUTIVO WEB
echo ========================================================
echo.
echo Iniciando servidor web local e abrindo o site no navegador...
echo.

python "servidor.py"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Servidor Python nao iniciado. Abrindo o site diretamente via arquivo...
    start index.html
)

pause
