@echo off
chcp 65001 >nul
title Sincronização Cidadão Online -> Hub Barretos Inteligente

echo ==============================================================================
echo   ⚡ PMO / CCO - BARRETOS INTELIGENTE
echo   Sincronização de Protocolos e Anexos (Cidadão Online Barretos)
echo ==============================================================================
echo.

cd /d "%~dp0\.."

echo [*] Iniciando rotina de sincronização...
python "02 - Automações\sync_cidadao_online.py" %*

echo.
echo ==============================================================================
echo [*] Processo finalizado. Pressione qualquer tecla para fechar...
pause >nul
