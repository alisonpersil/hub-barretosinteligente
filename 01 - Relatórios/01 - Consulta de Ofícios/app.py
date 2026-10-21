import os
import sys
import socket
import subprocess
import threading
import webbrowser
import mimetypes
import zipfile
import io
import shutil
import csv
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

from flask import Flask, render_template, jsonify, send_file, send_from_directory, request, abort

# Paths configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "Base de dados Ofícios")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static"
)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

def format_file_size(size_bytes):
    """Format bytes to human-readable string (KB, MB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def extract_category_and_year(name):
    """Categorize document/protocol and extract reference year if present."""
    name_lower = name.lower()
    
    year = None
    for y in ["2026", "2025", "2024", "2023", "2022", "2021", "2020"]:
        if y in name_lower:
            year = y
            break
            
    if "videomonitoramento" in name_lower or "câmera" in name_lower or "camera" in name_lower or "facial" in name_lower or "monitoramento" in name_lower:
        category = "Videomonitoramento"
    elif "carport" in name_lower or "fotovoltaico" in name_lower:
        category = "Fotovoltaico"
    elif "pagamento" in name_lower or "parcela" in name_lower or "nf" in name_lower:
        category = "Pagamento"
    elif "iluminação" in name_lower or "iluminacao" in name_lower or "dimerização" in name_lower or "dimerizacao" in name_lower or "destaque" in name_lower or "ip " in name_lower or "loteamentos" in name_lower or "avenidas" in name_lower:
        category = "Iluminação"
    elif "reajuste" in name_lower or "prm" in name_lower:
        category = "Reajuste PRM"
    elif "termo" in name_lower or "aditivo" in name_lower:
        category = "Termo Aditivo"
    elif "ofício" in name_lower or "oficio" in name_lower:
        category = "Ofício"
    elif "anexo" in name_lower:
        category = "Anexo"
    elif "relatório" in name_lower or "relatorio" in name_lower:
        category = "Relatório"
    elif "garantia" in name_lower:
        category = "Garantia"
    else:
        category = "Protocolo"
        
    return category, year

def get_all_protocolos():
    """Scan protocol folders and return detailed metadata for folders and their inner documents."""
    protocolos_dir = os.path.join(DOCS_DIR, "Protocolos")
    scan_root = protocolos_dir if os.path.isdir(protocolos_dir) else DOCS_DIR
    
    if not os.path.exists(scan_root):
        return []

    # Read _indice.csv if present
    csv_path = os.path.join(scan_root, "_indice.csv")
    indice_map = {}
    if os.path.isfile(csv_path):
        try:
            with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f, delimiter=";")
                header = next(reader, None)
                for row in reader:
                    if len(row) >= 3:
                        pasta = row[2].strip()
                        if pasta not in indice_map:
                            indice_map[pasta] = {
                                "protocolo": row[0].strip().lstrip("\ufeff"),
                                "assunto": row[1].strip()
                            }
        except Exception as e:
            print("Erro ao ler _indice.csv:", e, file=sys.stderr)

    protocolos = []
    prot_id = 1
    
    try:
        entries = sorted(os.listdir(scan_root))
    except Exception as e:
        print("Erro ao listar diretório de protocolos:", e, file=sys.stderr)
        return []

    for entry in entries:
        full_path = os.path.join(scan_root, entry)
        if not os.path.isdir(full_path) or entry.startswith("."):
            continue
            
        rel_folder = os.path.relpath(full_path, DOCS_DIR).replace("\\", "/")
        category, year = extract_category_and_year(entry)
        
        name_lower = entry.lower()
        if "(deferido)" in name_lower:
            status = "Deferido"
        elif "(indeferido)" in name_lower:
            status = "Indeferido"
        else:
            status = None
            
        parts = entry.split(" - ", 1)
        protocolo_code = parts[0].strip()
        assunto = parts[1].strip() if len(parts) > 1 else entry
        
        csv_info = indice_map.get(entry)
        if csv_info:
            protocolo_code = csv_info.get("protocolo") or protocolo_code
            assunto = csv_info.get("assunto") or assunto

        files_list = []
        folder_size = 0
        latest_mtime = 0
        earliest_ctime = float("inf")

        try:
            folder_stat = os.stat(full_path)
            latest_mtime = folder_stat.st_mtime
            earliest_ctime = folder_stat.st_ctime
        except Exception:
            pass

        file_idx = 1
        try:
            folder_items = sorted(os.listdir(full_path))
        except Exception:
            folder_items = []

        for f in folder_items:
            f_path = os.path.join(full_path, f)
            if not os.path.isfile(f_path) or f.startswith("."):
                continue
            try:
                f_stat = os.stat(f_path)
                f_size = f_stat.st_size
                folder_size += f_size
                if f_stat.st_mtime > latest_mtime:
                    latest_mtime = f_stat.st_mtime
                if f_stat.st_ctime < earliest_ctime:
                    earliest_ctime = f_stat.st_ctime
                    
                ext = os.path.splitext(f)[1].lower()
                rel_file = os.path.relpath(f_path, DOCS_DIR).replace("\\", "/")
                files_list.append({
                    "id": file_idx,
                    "name": f,
                    "relative_path": rel_file,
                    "size_bytes": f_size,
                    "size_formatted": format_file_size(f_size),
                    "mtime": f_stat.st_mtime,
                    "mtime_formatted": datetime.fromtimestamp(f_stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
                    "ctime": f_stat.st_ctime,
                    "ctime_formatted": datetime.fromtimestamp(f_stat.st_ctime).strftime("%d/%m/%Y %H:%M"),
                    "extension": ext,
                    "is_pdf": ext == ".pdf"
                })
                file_idx += 1
            except Exception as e:
                pass

        ctime_dt = datetime.fromtimestamp(earliest_ctime if earliest_ctime != float("inf") else 0)
        mtime_dt = datetime.fromtimestamp(latest_mtime if latest_mtime > 0 else 0)

        protocolos.append({
            "id": prot_id,
            "doc_type": "protocolo",
            "name": entry,
            "folder_name": entry,
            "protocolo": protocolo_code,
            "assunto": assunto,
            "status": status,
            "relative_path": rel_folder,
            "full_path": full_path,
            "is_folder": True,
            "is_pdf": False,
            "total_files": len(files_list),
            "size_bytes": folder_size,
            "size_formatted": format_file_size(folder_size),
            "ctime": earliest_ctime if earliest_ctime != float("inf") else 0,
            "ctime_formatted": ctime_dt.strftime("%d/%m/%Y %H:%M"),
            "mtime": latest_mtime,
            "mtime_formatted": mtime_dt.strftime("%d/%m/%Y %H:%M"),
            "category": category,
            "year": year or "2026",
            "files": files_list
        })
        prot_id += 1

    return protocolos

def get_all_oficios():
    """Scan and index documents in Base de dados Ofícios/Ofícios."""
    oficios_dir = os.path.join(DOCS_DIR, "Ofícios")
    if not os.path.isdir(oficios_dir):
        oficios_dir = os.path.join(DOCS_DIR, "Oficios")
        if not os.path.isdir(oficios_dir):
            return []

    documents = []
    doc_id = 1
    try:
        entries = sorted(os.listdir(oficios_dir))
    except Exception as e:
        print("Erro ao listar diretório de ofícios:", e, file=sys.stderr)
        return []

    for entry in entries:
        if entry.startswith(".") or entry.lower() == "_indice.csv":
            continue
        full_path = os.path.join(oficios_dir, entry)
        if not os.path.isfile(full_path):
            continue

        try:
            f_stat = os.stat(full_path)
            f_size = f_stat.st_size
            rel_file = os.path.relpath(full_path, DOCS_DIR).replace("\\", "/")
            ext = os.path.splitext(entry)[1].lower()
            category, year = extract_category_and_year(entry)

            documents.append({
                "id": doc_id,
                "doc_type": "oficio",
                "name": entry,
                "folder_name": None,
                "protocolo": None,
                "assunto": entry,
                "status": None,
                "relative_path": rel_file,
                "full_path": full_path,
                "is_folder": False,
                "is_pdf": ext == ".pdf",
                "total_files": 1,
                "size_bytes": f_size,
                "size_formatted": format_file_size(f_size),
                "ctime": f_stat.st_ctime,
                "ctime_formatted": datetime.fromtimestamp(f_stat.st_ctime).strftime("%d/%m/%Y %H:%M"),
                "mtime": f_stat.st_mtime,
                "mtime_formatted": datetime.fromtimestamp(f_stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
                "category": category,
                "year": year or "2024",
                "files": [{
                    "id": 1,
                    "name": entry,
                    "relative_path": rel_file,
                    "size_bytes": f_size,
                    "size_formatted": format_file_size(f_size),
                    "mtime": f_stat.st_mtime,
                    "mtime_formatted": datetime.fromtimestamp(f_stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
                    "ctime": f_stat.st_ctime,
                    "ctime_formatted": datetime.fromtimestamp(f_stat.st_ctime).strftime("%d/%m/%Y %H:%M"),
                    "extension": ext,
                    "is_pdf": ext == ".pdf"
                }]
            })
            doc_id += 1
        except Exception as e:
            continue

    return documents

def get_all_documents():
    """Return both protocolos and oficios."""
    protocolos = get_all_protocolos()
    oficios = get_all_oficios()
    return protocolos + oficios

def get_safe_file_path(relative_path):
    """Ensure relative path is safely within DOCS_DIR, supporting folders and files."""
    import urllib.parse
    import unicodedata

    decoded_path = urllib.parse.unquote(relative_path).strip("/\\")
    safe_path = os.path.abspath(os.path.join(DOCS_DIR, decoded_path))
    if safe_path.startswith(os.path.abspath(DOCS_DIR)) and (os.path.isfile(safe_path) or os.path.isdir(safe_path)):
        return safe_path

    # Robust fallback: search by normalized filename ignoring accents
    def strip_accents(text):
        return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').lower()

    target_clean = strip_accents(os.path.basename(decoded_path))
    parent_clean = strip_accents(os.path.basename(os.path.dirname(decoded_path)))
    
    for root, dirs, files in os.walk(DOCS_DIR):
        for item in dirs + files:
            if strip_accents(item) == target_clean:
                cand = os.path.join(root, item)
                if parent_clean:
                    if strip_accents(os.path.basename(os.path.dirname(cand))) == parent_clean:
                        return cand
                else:
                    return cand

    return None

@app.route("/")
@app.route("/api/index")
@app.route("/api/index.py")
def index():
    """Serve the main chat-inspired application with inlined assets for cloud compatibility."""
    css_path = os.path.join(STATIC_DIR, "css", "style.css")
    js_path = os.path.join(STATIC_DIR, "js", "app.js")
    
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
            
    protocolos = get_all_protocolos()
    oficios = get_all_oficios()
    docs = protocolos + oficios
    return render_template(
        "index.html",
        inline_css=css_content,
        inline_js=js_content,
        initial_documents=docs,
        doc_count=len(docs),
        protocolos_count=len(protocolos),
        oficios_count=len(oficios)
    )

@app.route("/logo/dark")
@app.route("/logo/light")
def logo():
    """Serve the primary high-resolution logo for both light and dark themes."""
    path = os.path.join(STATIC_DIR, "img", "logo-ipbarretos-horizontal-alta.png")
    if os.path.exists(path):
        return send_file(path, mimetype="image/png")
    fallback = os.path.join(BASE_DIR, "logo-ipbarretos-horizontal-alta.png")
    if os.path.exists(fallback):
        return send_file(fallback, mimetype="image/png")
    return ("", 404)

@app.route("/favicon.ico")
def favicon():
    """Serve site favicon."""
    fav_path = os.path.join(STATIC_DIR, "img", "favicon.png")
    if os.path.exists(fav_path):
        return send_file(fav_path, mimetype="image/png")
    return ("", 204)

@app.route("/static/<path:filename>")
def serve_static(filename):
    """Serve static files directly with correct mime types for Vercel/cloud."""
    return send_from_directory(STATIC_DIR, filename)

@app.route("/api/system/status")
def system_status():
    """Return cloud/local environment information."""
    is_vercel = bool(os.environ.get("VERCEL"))
    token = request.headers.get("X-GitHub-Token") or os.environ.get("GITHUB_TOKEN")
    return jsonify({
        "success": True,
        "is_vercel": is_vercel,
        "has_github_token": bool(token),
        "repo": os.environ.get("GITHUB_REPO", "alisonpersil/consulta-oficios")
    })

@app.route("/api/oficios")
@app.route("/api/protocolos")
def api_oficios():
    """Return all protocols and oficios with detailed counts."""
    protocolos = get_all_protocolos()
    oficios = get_all_oficios()
    docs = protocolos + oficios
    total_docs = sum(p.get("total_files", 0) for p in docs)
    return jsonify({
        "success": True,
        "count": len(docs),
        "protocolos_count": len(protocolos),
        "oficios_count": len(oficios),
        "total_documents": total_docs,
        "documents": docs
    })

@app.route("/api/pdf/preview/<path:subpath>")
def preview_pdf(subpath):
    """Stream file inline for browser preview."""
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
    """Serve file as attachment for immediate download."""
    safe_path = get_safe_file_path(subpath)
    if not safe_path:
        abort(404, description="Documento não encontrado.")
        
    return send_file(
        safe_path,
        as_attachment=True,
        download_name=os.path.basename(safe_path)
    )

@app.route("/api/protocolo/download-zip/<path:subpath>")
def download_protocolo_zip(subpath):
    """Download an entire protocol folder as a zipped archive."""
    safe_path = get_safe_file_path(subpath)
    if not safe_path or not os.path.isdir(safe_path):
        abort(404, description="Protocolo não encontrado.")
        
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(safe_path):
            for file in files:
                file_full = os.path.join(root, file)
                rel = os.path.relpath(file_full, safe_path)
                zf.write(file_full, rel)
    memory_file.seek(0)
    zip_name = f"{os.path.basename(safe_path)}.zip"
    return send_file(
        memory_file,
        mimetype="application/zip",
        as_attachment=True,
        download_name=zip_name
    )

@app.route("/api/protocolo/delete", methods=["POST", "DELETE"])
@app.route("/api/oficios/delete", methods=["POST", "DELETE"])
def delete_protocolo():
    """Remove a protocol folder permanently."""
    data = request.get_json(silent=True) or request.form
    rel_path = data.get("relative_path")
    if not rel_path:
        return jsonify({"success": False, "error": "Caminho do protocolo não fornecido."}), 400

    try:
        safe_path = get_safe_file_path(rel_path)
        if not safe_path:
            return jsonify({"success": False, "error": "Item não encontrado."}), 404
            
        if os.path.isdir(safe_path):
            folder_name = os.path.basename(safe_path)
            shutil.rmtree(safe_path)
            run_git_sync_background(f"chore: excluir protocolo {folder_name}")
            return jsonify({
                "success": True,
                "message": f"Protocolo '{folder_name}' removido com sucesso."
            })
        elif os.path.isfile(safe_path):
            file_name = os.path.basename(safe_path)
            os.remove(safe_path)
            run_git_sync_background(f"chore: excluir oficio {file_name}")
            return jsonify({
                "success": True,
                "message": f"Ofício '{file_name}' removido com sucesso."
            })
        else:
            return jsonify({"success": False, "error": "Item não encontrado."}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

GITHUB_REPO = os.environ.get("GITHUB_REPO", "alisonpersil/consulta-oficios")

def run_git_sync_background(commit_message="Atualização de ofícios"):
    """Run git add, commit, and push in background thread if local git repository."""
    def _sync():
        try:
            subprocess.run(["git", "add", "Base de dados Ofícios"], cwd=BASE_DIR, check=False)
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
        "User-Agent": "Consulta-Oficios-App"
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
        "User-Agent": "Consulta-Oficios-App"
    }, method="PUT")
    
    with urllib.request.urlopen(req_put) as response:
        return json.loads(response.read().decode("utf-8"))

def github_api_delete_file(token, repo_path, commit_message):
    """Delete a file directly on GitHub via REST API."""
    import urllib.request
    import urllib.error
    import urllib.parse
    import json

    encoded_path = "/".join(urllib.parse.quote(part) for part in repo_path.strip("/").split("/"))
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{encoded_path}"
    
    req_get = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Consulta-Oficios-App"
    })
    with urllib.request.urlopen(req_get) as response:
        data = json.loads(response.read().decode("utf-8"))
        sha = data.get("sha")
        
    if not sha:
        raise Exception("Arquivo não encontrado no GitHub")
        
    payload = {
        "message": commit_message,
        "sha": sha
    }
    data_json = json.dumps(payload).encode("utf-8")
    req_del = urllib.request.Request(url, data=data_json, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Consulta-Oficios-App"
    }, method="DELETE")
    
    with urllib.request.urlopen(req_del) as response:
        return json.loads(response.read().decode("utf-8"))

@app.route("/api/oficios/upload", methods=["POST"])
def upload_oficios():
    """Import one or multiple PDF documents into the repository."""
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

    destination = (request.form.get("destination") or "oficios").lower().strip()
    protocol_name = (request.form.get("protocol_name") or "").strip()
    webkit_rel = (request.form.get("webkit_relative_path") or "").strip().replace("\\", "/")

    saved_docs = []
    errors = []

    for file in files:
        if not file or not file.filename:
            continue
            
        filename = os.path.basename(file.filename.replace("\\", "/"))
        if not filename.lower().endswith(".pdf"):
            continue

        try:
            file_bytes = file.read()
            
            if destination in ["protocolos", "protocolo"]:
                # Determine protocol folder name
                folder_name = protocol_name
                if not folder_name and webkit_rel:
                    parts = webkit_rel.split("/")
                    if len(parts) > 1 and parts[0]:
                        folder_name = parts[0]
                if not folder_name:
                    folder_name = os.path.splitext(filename)[0]

                # Sanitize folder name
                folder_name = re.sub(r'[<>:"/\\|?*]', '_', folder_name).strip()
                target_dir = os.path.join(DOCS_DIR, "Protocolos", folder_name)
                os.makedirs(target_dir, exist_ok=True)
                save_path = os.path.join(target_dir, filename)
                rel_path = f"Protocolos/{folder_name}/{filename}"
                repo_path = f"Base de dados Ofícios/Protocolos/{folder_name}/{filename}"
                commit_msg = f"feat: importar documento em protocolo {folder_name}/{filename}"
            else:
                target_dir = os.path.join(DOCS_DIR, "Ofícios")
                os.makedirs(target_dir, exist_ok=True)
                save_path = os.path.join(target_dir, filename)
                rel_path = f"Ofícios/{filename}"
                repo_path = f"Base de dados Ofícios/Ofícios/{filename}"
                commit_msg = f"feat: importar oficio {filename}"

            if is_vercel:
                github_api_commit_file(
                    token=token,
                    repo_path=repo_path,
                    file_bytes=file_bytes,
                    commit_message=commit_msg
                )
            else:
                with open(save_path, "wb") as f:
                    f.write(file_bytes)

            size_bytes = len(file_bytes)
            now_dt = datetime.now()
            category, year = extract_category_and_year(filename)
            
            saved_docs.append({
                "id": int(now_dt.timestamp() * 1000) + len(saved_docs),
                "doc_type": "protocolo" if destination in ["protocolos", "protocolo"] else "oficio",
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
        run_git_sync_background(f"feat: importar {len(saved_docs)} documento(s) em {destination}")

    return jsonify({
        "success": len(saved_docs) > 0,
        "count": len(saved_docs),
        "destination": destination,
        "documents": saved_docs,
        "errors": errors,
        "synced": True
    })

@app.route("/api/oficios/delete", methods=["POST", "DELETE"])
def delete_oficio():
    """Remove a document permanently from the collection."""
    data = request.get_json(silent=True) or request.form
    rel_path = data.get("relative_path")
    if not rel_path:
        return jsonify({"success": False, "error": "Caminho do arquivo não fornecido."}), 400

    is_vercel = bool(os.environ.get("VERCEL"))
    token = request.headers.get("X-GitHub-Token") or os.environ.get("GITHUB_TOKEN")

    if is_vercel and not token:
        return jsonify({
            "success": False,
            "error": "github_token_required",
            "message": "Para excluir arquivos permanentemente no Vercel, informe o GitHub Token."
        }), 403

    try:
        filename = os.path.basename(rel_path)
        if is_vercel:
            repo_path = f"Base de dados Ofícios/{rel_path.strip('/')}"
            github_api_delete_file(
                token=token,
                repo_path=repo_path,
                commit_message=f"chore: excluir oficio {filename}"
            )
        else:
            safe_path = get_safe_file_path(rel_path)
            if not safe_path or not os.path.isfile(safe_path):
                return jsonify({"success": False, "error": "Arquivo não encontrado."}), 404
            os.remove(safe_path)
            run_git_sync_background(f"chore: excluir oficio {filename}")

        return jsonify({
            "success": True,
            "message": f"Ofício '{filename}' removido com sucesso."
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/git/sync", methods=["POST"])
def manual_git_sync():
    """Trigger manual git push to origin main when running locally."""
    if bool(os.environ.get("VERCEL")):
        return jsonify({"success": True, "message": "Em execução na nuvem Vercel."})
        
    try:
        subprocess.run(["git", "add", "-A"], cwd=BASE_DIR, check=False)
        subprocess.run(["git", "commit", "-m", "sync: sincronizacao manual de oficios"], cwd=BASE_DIR, check=False)
        subprocess.run(["git", "push", "origin", "main"], cwd=BASE_DIR, check=False)
        return jsonify({"success": True, "message": "Repositório sincronizado com o GitHub com sucesso!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print("=" * 70)
    print("           SISTEMA DE CONSULTA DE OFÍCIOS - PMO")
    print("=" * 70)
    print(f"\n  [*] Servidor iniciado em: http://localhost:{port}")
    print(f"  [*] Pasta de documentos: {DOCS_DIR}")
    print(f"  [*] Documentos indexados: {len(get_all_documents())}\n")
    print("=" * 70)
    app.run(host="0.0.0.0", port=port, debug=False)

