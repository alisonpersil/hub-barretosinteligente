@echo off
chcp 65001 > nul
echo ========================================================
echo   MONITOR EXATI - ATUALIZADOR DO COCKPIT EXECUTIVO
echo ========================================================
echo Processando arquivos das pastas Atendidos e Pendentes...
echo.

python "build_dashboard_data.py"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [SUCESSO] Base atualizada e sincronizada!
    echo   - dashboard_data.json atualizado
    echo   - base_consolidada_powerbi.xlsx atualizada
    echo.
    echo   Abrindo o painel executivo no seu navegador...
    echo ========================================================
    start index.html
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao processar os arquivos.
    echo Verifique se o Python esta instalado e se as planilhas estao fechadas.
)

pause
