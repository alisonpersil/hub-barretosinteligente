@echo off
chcp 65001 > nul
title Sistema de Consulta de Oficios - PMO
color 0B

echo ======================================================================
echo            SISTEMA DE CONSULTA DE OFICIOS - PMO
echo ======================================================================
echo.

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [+] Iniciando servidor Python...
    python "%~dp0app.py"
    goto :fim
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [+] Iniciando servidor Python (py)...
    py "%~dp0app.py"
    goto :fim
)

echo.
echo ======================================================================
echo [ERRO] O Python não foi encontrado no PATH deste computador.
echo Por favor, instale o Python ou adicione-o às variáveis de ambiente.
echo ======================================================================
echo.
pause

:fim
