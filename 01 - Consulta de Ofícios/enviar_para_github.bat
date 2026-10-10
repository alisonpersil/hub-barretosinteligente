@echo off
chcp 65001 > nul
title Enviar para o GitHub
color 0A

echo ======================================================================
echo          ENVIANDO PROJETO PARA O GITHUB (alisonpersil)
echo ======================================================================
echo.
echo Repositorio: https://github.com/alisonpersil/consulta-oficios
echo.

echo [+] Adicionando arquivos e registrando alteracoes...
git add -A
git commit -m "Atualizacao da logo, remocao de executaveis e preparacao Vercel" >nul 2>&1

echo [+] Enviando arquivos para o GitHub... Aguarde um instante...
echo.
git push origin main

echo.
echo ======================================================================
echo Fim do processo. Verifique as mensagens acima.
echo ======================================================================
echo.
pause
