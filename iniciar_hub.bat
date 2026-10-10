@echo off
chcp 65001 > nul
title Barretos Inteligente • Central HUB (PMO)
color 0A

echo ======================================================================
echo           BARRETOS INTELIGENTE • CENTRAL HUB (PMO & CCO)
echo ======================================================================
echo.
echo  [*] Iniciando Servidor Web Integrado...
echo  [*] HUB Central:        http://localhost:5000/
echo  [*] Consulta Ofícios:   http://localhost:5000/oficios
echo  [*] Monitor Exati:      http://localhost:5000/exati
echo.
echo  [x] Para encerrar: Pressione Ctrl+C ou feche esta janela.
echo ======================================================================
echo.

python app.py

pause
