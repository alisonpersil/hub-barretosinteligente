@echo off
chcp 65001 > nul
title Enviar HUB para o GitHub (alisonpersil)
color 0A

echo ======================================================================
echo           ENVIANDO PROJETO CENTRAL HUB PARA O GITHUB (PMO)
echo ======================================================================
echo Repositorio: https://github.com/alisonpersil/hub-barretosinteligente
echo.

echo [+] Verificando status dos arquivos...
git status
echo.

echo [+] Registrando alteracoes locais...
git add -A
git commit -m "feat: Central HUB Barretos Inteligente - Oficios e Exati integrados"

echo.
echo [+] Enviando atualizacoes para o GitHub (branch main)...
echo     Aguarde alguns instantes enquanto os arquivos sao transmitidos...
echo.

git branch -M main
git push -u origin main

echo.
echo ======================================================================
echo Processo concluido! Verifique as mensagens acima.
echo ======================================================================
echo.
pause
