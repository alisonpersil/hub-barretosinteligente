import http.server
import socketserver
import webbrowser
import os
import sys

import json
import urllib.parse
import subprocess

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Desabilitar cache para garantir que sempre carregue dados atualizados
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Category')
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/upload'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                file_bytes = self.rfile.read(content_length)

                # Obter nome do arquivo e categoria
                raw_filename = self.headers.get('X-Filename', '')
                category = self.headers.get('X-Category', 'auto').lower()

                filename = urllib.parse.unquote(raw_filename) if raw_filename else 'planilha_importada.xlsx'
                filename = os.path.basename(filename)

                # Salvar temporariamente para inspecionar colunas e detectar tipo automaticamente
                temp_dir = os.path.join(DIRECTORY, "Base de dados", "_temp")
                os.makedirs(temp_dir, exist_ok=True)
                temp_path = os.path.join(temp_dir, filename)
                with open(temp_path, 'wb') as f:
                    f.write(file_bytes)

                # Inspeção inteligente das colunas
                import pandas as pd
                from exati_column_resolver import detect_dataset_type, resolve_columns
                try:
                    df_sample = pd.read_excel(temp_path, nrows=2)
                    cols = list(df_sample.columns)
                except Exception as e:
                    cols = []

                if category == 'auto':
                    target_category = detect_dataset_type(cols, filename)
                elif category in ('atendidos', 'pendentes'):
                    target_category = category
                else:
                    target_category = detect_dataset_type(cols, filename)

                mapping, audit = resolve_columns(cols, target_category) if cols else ({}, {})

                subfolder = "Atendidos" if target_category == 'atendidos' else "Pendentes"
                dest_dir = os.path.join(DIRECTORY, "Base de dados", subfolder)
                os.makedirs(dest_dir, exist_ok=True)
                dest_path = os.path.join(dest_dir, filename)

                # Mover da pasta temporária para o destino final
                if os.path.exists(dest_path):
                    try:
                        os.remove(dest_path)
                    except:
                        pass
                import shutil
                shutil.move(temp_path, dest_path)

                # Executar build_dashboard_data.py para sincronizar tudo imediatamente
                cmd = [sys.executable, os.path.join(DIRECTORY, "build_dashboard_data.py")]
                proc = subprocess.run(cmd, cwd=DIRECTORY, capture_output=True, text=True)

                # Enfileirar tarefa de auditoria para 'O chefe' (p3-main) em agentes_estado.json
                task_info = {}
                try:
                    from datetime import datetime
                    root_dir = os.path.dirname(os.path.dirname(DIRECTORY))
                    state_file = os.path.join(root_dir, "agentes_estado.json")
                    if os.path.exists(state_file):
                        with open(state_file, "r", encoding="utf-8") as sf:
                            state_data = json.load(sf)
                        chefe = state_data.get("p3-main")
                        if chefe:
                            now_dt = datetime.now()
                            task_id = f"tsk-upload-{int(now_dt.timestamp())}"
                            sucesso = (proc.returncode == 0)
                            status_txt = "Consolidação e sincronização concluídas com sucesso" if sucesso else "Alerta: Falha na execução do construtor de dados"
                            prioridade = "Alta" if sucesso else "Crítica"
                            titulo_tarefa = f"Auditoria da planilha '{filename}' ({subfolder})"
                            desc_tarefa = (
                                f"Planilha '{filename}' enviada pelo usuário para 'Base de dados/{subfolder}'. "
                                f"Resultado da sincronização: {status_txt}. "
                                f"Auditoria multi-arquivos e reconciliação de chamados ativos registrada em backlog para validação do Chefe. "
                                f"Status IA: mantida em fila segura (Zero Tokens) aguardando ativação no painel."
                            )
                            if not sucesso and proc.stderr:
                                desc_tarefa += f" Detalhes do erro capturado: {proc.stderr[-200:].strip()}"
                            nova_tarefa = {
                                "id": task_id,
                                "titulo": titulo_tarefa,
                                "descricao": desc_tarefa,
                                "adicionado_em": now_dt.strftime("%H:%M"),
                                "prioridade": prioridade,
                                "origem_usuario": True,
                                "acionar_ia": False
                            }
                            chefe.setdefault("fila", []).append(nova_tarefa)
                            with open(state_file, "w", encoding="utf-8") as sf:
                                json.dump(state_data, sf, ensure_ascii=False, indent=2)
                            task_info = {"queued": True, "task_id": task_id, "agent": "p3-main", "title": titulo_tarefa}
                except Exception as ex_task:
                    print(f"[servidor.py Upload Task Error]: {ex_task}")

                resp_success = (proc.returncode == 0)
                msg = (
                    f"Planilha '{filename}' identificada ({target_category.upper()}) com {audit.get('confianca_percent', 100)}% de correspondência e sincronizada! "
                    f"Tarefa de auditoria enviada para o backlog do agente Chefe."
                    if resp_success else
                    f"A planilha '{filename}' foi recebida, mas ocorreu erro no processamento. "
                    f"O incidente foi capturado e enviado para o backlog do agente Chefe para tratamento."
                )

                res_data = {
                    "success": resp_success,
                    "filename": filename,
                    "category": target_category,
                    "folder": subfolder,
                    "audit": audit,
                    "task": task_info,
                    "message": msg,
                    "stdout": proc.stdout[-300:] if proc.stdout else "",
                    "stderr": proc.stderr[-300:] if proc.stderr else ""
                }

                self.send_response(200 if resp_success else 500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res_data, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    os.chdir(DIRECTORY)
    # Tenta usar a porta 8080, se ocupada tenta 8081, 8082...
    port = PORT
    server = None
    for p in range(PORT, PORT + 10):
        try:
            server = socketserver.TCPServer(("", p), Handler)
            port = p
            break
        except OSError:
            continue

    if not server:
        print("Erro: Nenhuma porta disponível entre 8080 e 8090.")
        sys.exit(1)

    url = f"http://localhost:{port}/index.html"
    print("=" * 60)
    print("  MONITOR EXATI - SERVIDOR WEB LOCAL INICIADO")
    print("=" * 60)
    print(f"  Acesse no seu navegador: {url}")
    print("  Pressione Ctrl+C para encerrar o servidor a qualquer momento.")
    print("=" * 60)

    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado pelo usuário.")
        server.server_close()

if __name__ == "__main__":
    run_server()
