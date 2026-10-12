import os
import sys
import socket
import subprocess
import threading
import webbrowser
import mimetypes
from datetime import datetime

# Windows Console UTF-8 encoding support
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from flask import Flask, render_template, jsonify, send_file, send_from_directory, request, abort, redirect

# Base Directories with Dynamic Resolution
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def resolve_dir(*candidates):
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

HUB_DIR = resolve_dir(
    os.path.join(BASE_DIR, "00 - HUB"),
    os.path.join(BASE_DIR, "HUB")
)
OFICIOS_DIR = resolve_dir(
    os.path.join(BASE_DIR, "Relatórios", "01 - Consulta de Ofícios"),
    os.path.join(BASE_DIR, "Relatorios", "01 - Consulta de Ofícios"),
    os.path.join(BASE_DIR, "01 - Consulta de Ofícios")
)
EXATI_DIR = resolve_dir(
    os.path.join(BASE_DIR, "Relatórios", "02 - Monitor Exati"),
    os.path.join(BASE_DIR, "Relatorios", "02 - Monitor Exati"),
    os.path.join(BASE_DIR, "02 - Monitor Exati")
)

DOCS_DIR = os.path.join(OFICIOS_DIR, "Base de dados Ofícios")
OFICIOS_STATIC_DIR = os.path.join(OFICIOS_DIR, "static")
OFICIOS_TEMPLATES_DIR = os.path.join(OFICIOS_DIR, "templates")

app = Flask(
    __name__,
    template_folder=OFICIOS_TEMPLATES_DIR,
    static_folder=OFICIOS_STATIC_DIR,
    static_url_path="/static"
)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# ==============================================================================
# Helper Functions - Consulta de Ofícios
# ==============================================================================
def format_file_size(size_bytes):
    """Format bytes to human-readable string (KB, MB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def extract_category_and_year(filename):
    """Categorize document and extract reference year if present."""
    name_lower = filename.lower()
    
    year = None
    for y in ["2026", "2025", "2024", "2023", "2022", "2021", "2020"]:
        if y in name_lower:
            year = y
            break
            
    if "ofício" in name_lower or "oficio" in name_lower:
        category = "Ofício"
    elif "anexo" in name_lower:
        category = "Anexo"
    elif "relatório" in name_lower or "relatorio" in name_lower:
        category = "Relatório"
    elif "termo" in name_lower:
        category = "Termo de Referência"
    elif "garantia" in name_lower:
        category = "Garantia"
    elif "videomonitoramento" in name_lower or "câmera" in name_lower or "camera" in name_lower:
        category = "Videomonitoramento"
    elif "iluminação" in name_lower or "iluminacao" in name_lower:
        category = "Iluminação"
    elif "resposta" in name_lower:
        category = "Resposta"
    else:
        category = "Documento"
        
    return category, year

def get_all_documents():
    """Scan the documents directory recursively and return detailed metadata."""
    documents = []
    if not os.path.exists(DOCS_DIR):
        return documents

    file_id = 1
    for root, _, files in os.walk(DOCS_DIR):
        for file in files:
            full_path = os.path.abspath(os.path.join(root, file))
            rel_path = os.path.relpath(full_path, DOCS_DIR).replace("\\", "/")
            
            try:
                stat = os.stat(full_path)
                size_bytes = stat.st_size
                ctime = stat.st_ctime
                mtime = stat.st_mtime
                
                ctime_dt = datetime.fromtimestamp(ctime)
                mtime_dt = datetime.fromtimestamp(mtime)
                
                ext = os.path.splitext(file)[1].lower()
                category, year = extract_category_and_year(file)
                
                documents.append({
                    "id": file_id,
                    "name": file,
                    "relative_path": rel_path,
                    "full_path": full_path,
                    "size_bytes": size_bytes,
                    "size_formatted": format_file_size(size_bytes),
                    "ctime": ctime,
                    "ctime_formatted": ctime_dt.strftime("%d/%m/%Y %H:%M"),
                    "mtime": mtime,
                    "mtime_formatted": mtime_dt.strftime("%d/%m/%Y %H:%M"),
                    "extension": ext,
                    "is_pdf": ext == ".pdf",
                    "category": category,
                    "year": year
                })
                file_id += 1
            except Exception as e:
                print(f"Erro ao ler metadados do arquivo {file}: {e}", file=sys.stderr)
                
    return documents

def get_safe_file_path(relative_path):
    """Ensure relative path is safely within DOCS_DIR."""
    import urllib.parse
    import unicodedata

    decoded_path = urllib.parse.unquote(relative_path).strip("/\\")
    safe_path = os.path.abspath(os.path.join(DOCS_DIR, decoded_path))
    if safe_path.startswith(os.path.abspath(DOCS_DIR)) and os.path.isfile(safe_path):
        return safe_path

    # Robust fallback: search by normalized filename ignoring accents
    def strip_accents(text):
        return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').lower()

    target_clean = strip_accents(os.path.basename(decoded_path))
    for root, _, files in os.walk(DOCS_DIR):
        for f in files:
            if strip_accents(f) == target_clean:
                return os.path.join(root, f)

    return None

GITHUB_REPO = os.environ.get("GITHUB_REPO", "alisonpersil/hub-barretosinteligente")

def run_git_sync_background(commit_message="Atualização de ofícios"):
    """Run git add, commit, and push in background thread if local git repository."""
    def _sync():
        try:
            docs_rel_path = os.path.relpath(DOCS_DIR, BASE_DIR).replace("\\", "/")
            subprocess.run(["git", "add", docs_rel_path], cwd=BASE_DIR, check=False)
            subprocess.run(["git", "commit", "-m", commit_message], cwd=BASE_DIR, check=False)
            subprocess.run(["git", "push", "origin", "main"], cwd=BASE_DIR, check=False)
        except Exception as e:
            print(f"Erro no git sync: {e}", file=sys.stderr)
            
    thread = threading.Thread(target=_sync, daemon=True)
    thread.start()

def github_api_commit_file(token, repo_path, file_bytes, commit_message):
    """Commit a file directly to GitHub via REST API."""
    import base64
    import urllib.request
    import urllib.error
    import urllib.parse
    import json

    encoded_path = "/".join(urllib.parse.quote(part) for part in repo_path.strip("/").split("/"))
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{encoded_path}"
    
    sha = None
    req_get = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Hub-BarretosInteligente-App"
    })
    try:
        with urllib.request.urlopen(req_get) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                sha = data.get("sha")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    payload = {
        "message": commit_message,
        "content": base64.b64encode(file_bytes).decode("utf-8")
    }
    if sha:
        payload["sha"] = sha
        
    data_json = json.dumps(payload).encode("utf-8")
    req_put = urllib.request.Request(url, data=data_json, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Hub-BarretosInteligente-App"
    }, method="PUT")
    
    with urllib.request.urlopen(req_put) as response:
        return json.loads(response.read().decode("utf-8"))

# ==============================================================================
# Rotas Principais: 00 - HUB (Home do Portal)
# ==============================================================================
@app.route("/")
@app.route("/hub")
@app.route("/index.html")
def hub_index():
    """Serve o Portal Executivo Central (HUB)."""
    hub_index_path = os.path.join(HUB_DIR, "index.html")
    if os.path.exists(hub_index_path):
        return send_file(hub_index_path)
    return "Portal HUB em configuração.", 200

@app.route("/css/<path:filename>")
def serve_hub_css(filename):
    """Serve CSS do HUB."""
    return send_from_directory(os.path.join(HUB_DIR, "css"), filename)

@app.route("/js/<path:filename>")
def serve_hub_js(filename):
    """Serve JavaScript do HUB."""
    return send_from_directory(os.path.join(HUB_DIR, "js"), filename)

@app.route("/img/<path:filename>")
def serve_hub_img(filename):
    """Serve Imagens do HUB."""
    return send_from_directory(os.path.join(HUB_DIR, "img"), filename)

@app.route("/favicon.ico")
def hub_favicon():
    """Serve site favicon."""
    fav_path = os.path.join(HUB_DIR, "img", "favicon.png")
    if os.path.exists(fav_path):
        return send_file(fav_path, mimetype="image/png")
    fav_oficios = os.path.join(OFICIOS_STATIC_DIR, "img", "favicon.png")
    if os.path.exists(fav_oficios):
        return send_file(fav_oficios, mimetype="image/png")
    return ("", 204)

@app.route("/logo/dark")
@app.route("/logo/light")
def hub_logo():
    """Serve a logo oficial para os portais."""
    path = os.path.join(HUB_DIR, "img", "logo-ipbarretos-horizontal-alta.png")
    if os.path.exists(path):
        return send_file(path, mimetype="image/png")
    fallback = os.path.join(OFICIOS_DIR, "logo-ipbarretos-horizontal-alta.png")
    if os.path.exists(fallback):
        return send_file(fallback, mimetype="image/png")
    return ("", 404)

# ==============================================================================
# Rotas: 01 - Consulta de Ofícios (/oficios)
# ==============================================================================
@app.route("/oficios")
@app.route("/oficios/")
def oficios_index():
    """Serve o sistema Consulta de Ofícios com assets inlined."""
    css_path = os.path.join(OFICIOS_STATIC_DIR, "css", "style.css")
    js_path = os.path.join(OFICIOS_STATIC_DIR, "js", "app.js")
    
    css_content = ""
    if os.path.exists(css_path):
        try:
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()
        except Exception as e:
            print("Erro ao ler style.css:", e, file=sys.stderr)
            
    js_content = ""
    if os.path.exists(js_path):
        try:
            with open(js_path, "r", encoding="utf-8") as f:
                js_content = f.read()
        except Exception as e:
            print("Erro ao ler app.js:", e, file=sys.stderr)
            
    docs = get_all_documents()
    return render_template(
        "index.html",
        inline_css=css_content,
        inline_js=js_content,
        initial_documents=docs,
        doc_count=len(docs)
    )

@app.route("/static/<path:filename>")
def serve_oficios_static(filename):
    """Serve arquivos estáticos de Ofícios."""
    return send_from_directory(OFICIOS_STATIC_DIR, filename)

@app.route("/api/system/status")
def system_status():
    """Retorna informações do ambiente Cloud / Local."""
    is_vercel = bool(os.environ.get("VERCEL"))
    token = request.headers.get("X-GitHub-Token") or os.environ.get("GITHUB_TOKEN")
    return jsonify({
        "success": True,
        "is_vercel": is_vercel,
        "has_github_token": bool(token),
        "repo": GITHUB_REPO
    })

@app.route("/api/oficios")
def api_oficios():
    """Retorna lista de documentos indexados."""
    docs = get_all_documents()
    return jsonify({
        "success": True,
        "count": len(docs),
        "documents": docs
    })

@app.route("/api/pdf/preview/<path:subpath>")
def preview_pdf(subpath):
    """Visualizador inline de PDF no navegador."""
    safe_path = get_safe_file_path(subpath)
    if not safe_path:
        abort(404, description="Documento não encontrado.")
    
    mimetype, _ = mimetypes.guess_type(safe_path)
    if not mimetype:
        mimetype = "application/pdf" if safe_path.lower().endswith(".pdf") else "application/octet-stream"
        
    response = send_file(
        safe_path,
        mimetype=mimetype,
        as_attachment=False,
        download_name=os.path.basename(safe_path)
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

@app.route("/api/pdf/download/<path:subpath>")
def download_pdf(subpath):
    """Download direto do documento PDF."""
    safe_path = get_safe_file_path(subpath)
    if not safe_path:
        abort(404, description="Documento não encontrado.")
        
    return send_file(
        safe_path,
        as_attachment=True,
        download_name=os.path.basename(safe_path)
    )

@app.route("/api/oficios/upload", methods=["POST"])
def upload_oficios():
    """Importação individual e resiliente de documentos PDF."""
    files = request.files.getlist("files") or request.files.getlist("files[]")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"success": False, "error": "Nenhum arquivo enviado."}), 400

    is_vercel = bool(os.environ.get("VERCEL"))
    token = request.headers.get("X-GitHub-Token") or os.environ.get("GITHUB_TOKEN")
    
    if is_vercel and not token:
        return jsonify({
            "success": False,
            "error": "github_token_required",
            "message": "Para que os ofícios sejam salvos permanentemente no Vercel, informe o GitHub Token nas configurações ou variáveis de ambiente."
        }), 403

    saved_docs = []
    errors = []
    target_dir = os.path.join(DOCS_DIR, "Ofícios")
    os.makedirs(target_dir, exist_ok=True)

    for file in files:
        if not file or not file.filename:
            continue
            
        filename = os.path.basename(file.filename.replace("\\", "/"))
        if not filename.lower().endswith(".pdf"):
            continue

        try:
            file_bytes = file.read()
            if is_vercel:
                docs_rel_path = os.path.relpath(DOCS_DIR, BASE_DIR).replace("\\", "/")
                repo_path = f"{docs_rel_path}/Ofícios/{filename}"
                github_api_commit_file(
                    token=token,
                    repo_path=repo_path,
                    file_bytes=file_bytes,
                    commit_message=f"feat: importar oficio {filename}"
                )
            else:
                save_path = os.path.join(target_dir, filename)
                with open(save_path, "wb") as f:
                    f.write(file_bytes)

            size_bytes = len(file_bytes)
            now_dt = datetime.now()
            category, year = extract_category_and_year(filename)
            rel_path = f"Ofícios/{filename}"
            
            saved_docs.append({
                "id": int(now_dt.timestamp() * 1000) + len(saved_docs),
                "name": filename,
                "relative_path": rel_path,
                "size_bytes": size_bytes,
                "size_formatted": format_file_size(size_bytes),
                "ctime": now_dt.timestamp(),
                "ctime_formatted": now_dt.strftime("%d/%m/%Y %H:%M"),
                "mtime": now_dt.timestamp(),
                "mtime_formatted": now_dt.strftime("%d/%m/%Y %H:%M"),
                "extension": ".pdf",
                "is_pdf": True,
                "category": category,
                "year": year
            })
        except Exception as e:
            errors.append(f"{filename}: {str(e)}")

    if not is_vercel and saved_docs:
        run_git_sync_background(f"feat: importar {len(saved_docs)} ofício(s)")

    return jsonify({
        "success": len(saved_docs) > 0,
        "count": len(saved_docs),
        "documents": saved_docs,
        "errors": errors,
        "synced": True
    })

# ==============================================================================
# Rotas: 02 - Monitor Exati (/exati)
# ==============================================================================
@app.route("/exati")
def exati_redirect():
    """Redireciona /exati para /exati/ garantindo resolução correta de caminhos relativos."""
    return redirect("/exati/", code=301)

@app.route("/exati/")
def exati_index():
    """Serve o Painel Executivo do Monitor Exati."""
    index_path = os.path.join(EXATI_DIR, "index.html")
    if os.path.exists(index_path):
        return send_file(index_path)
    return "Painel Exati em configuração.", 404

@app.route("/exati/<path:filename>")
def serve_exati_file(filename):
    """Serve arquivos estáticos e assets do Monitor Exati."""
    return send_from_directory(EXATI_DIR, filename)

@app.route("/dashboard_data.json")
def serve_dashboard_data_root():
    """Fallback para carregar dashboard_data.json na raiz se solicitado."""
    data_path = os.path.join(EXATI_DIR, "dashboard_data.json")
    if os.path.exists(data_path):
        return send_file(data_path, mimetype="application/json")
    return jsonify({}), 404

@app.route("/app.css")
def fallback_app_css():
    """Fallback caso app.css seja solicitado na raiz."""
    return send_from_directory(EXATI_DIR, "app.css")

@app.route("/app.js")
def fallback_app_js():
    """Fallback caso app.js seja solicitado na raiz."""
    return send_from_directory(EXATI_DIR, "app.js")

@app.route("/chart.umd.min.js")
def fallback_chart_js():
    """Fallback caso chart.umd.min.js seja solicitado na raiz."""
    return send_from_directory(EXATI_DIR, "chart.umd.min.js")

@app.route("/xlsx.full.min.js")
def fallback_xlsx_js():
    """Fallback caso xlsx.full.min.js seja solicitado na raiz."""
    return send_from_directory(EXATI_DIR, "xlsx.full.min.js")

@app.route("/logo-ipbarretos-horizontal-alta.png")
def fallback_logo_horizontal():
    """Fallback caso a logo horizontal seja solicitada na raiz."""
    return send_from_directory(EXATI_DIR, "logo-ipbarretos-horizontal-alta.png")

# ==============================================================================
# Inicialização Local do Servidor
# ==============================================================================
def open_browser_delayed(port):
    import time
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{port}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    docs = get_all_documents()
    print("=" * 72)
    print("        BARRETOS INTELIGENTE • CENTRAL HUB (PMO & CCO)")
    print("=" * 72)
    print(f"\n  [*] SERVIDOR INICIADO: http://localhost:{port}")
    print(f"      - HUB Central:       http://localhost:{port}/")
    print(f"      - Consulta Ofícios:  http://localhost:{port}/oficios")
    print(f"      - Monitor Exati:     http://localhost:{port}/exati")
    print(f"\n  [*] Documentos de Ofícios indexados: {len(docs)}")
    print("  [*] Pressione Ctrl+C para encerrar o servidor.\n")
    print("=" * 72)
    
    threading.Thread(target=open_browser_delayed, args=(port,), daemon=True).start()
    app.run(host="0.0.0.0", port=port, debug=False)
