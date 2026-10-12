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

                res_data = {
                    "success": proc.returncode == 0,
                    "filename": filename,
                    "category": target_category,
                    "folder": subfolder,
                    "audit": audit,
                    "message": f"Planilha '{filename}' identificada ({target_category.upper()}) com {audit.get('confianca_percent', 100)}% de correspondência e sincronizada!",
                    "stdout": proc.stdout[-300:] if proc.stdout else "",
                    "stderr": proc.stderr[-300:] if proc.stderr else ""
                }

                self.send_response(200 if proc.returncode == 0 else 500)
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
