import os
import sys
import socket
import subprocess
import threading
import webbrowser
import mimetypes
from datetime import datetime, timedelta

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
    os.path.join(BASE_DIR, "01 - Relatórios", "01 - Consulta de Ofícios"),
    os.path.join(BASE_DIR, "01 - Relatorios", "01 - Consulta de Ofícios"),
    os.path.join(BASE_DIR, "Relatórios", "01 - Consulta de Ofícios"),
    os.path.join(BASE_DIR, "Relatorios", "01 - Consulta de Ofícios"),
    os.path.join(BASE_DIR, "01 - Consulta de Ofícios")
)
EXATI_DIR = resolve_dir(
    os.path.join(BASE_DIR, "01 - Relatórios", "02 - Monitor Exati"),
    os.path.join(BASE_DIR, "01 - Relatorios", "02 - Monitor Exati"),
    os.path.join(BASE_DIR, "Relatórios", "02 - Monitor Exati"),
    os.path.join(BASE_DIR, "Relatorios", "02 - Monitor Exati"),
    os.path.join(BASE_DIR, "02 - Monitor Exati")
)
QA_DIR = resolve_dir(
    os.path.join(BASE_DIR, "01 - Relatórios", "03 - QA do Site"),
    os.path.join(BASE_DIR, "01 - Relatorios", "03 - QA do Site"),
    os.path.join(BASE_DIR, "Relatórios", "03 - QA do Site")
)
SALA_DIR = resolve_dir(
    os.path.join(BASE_DIR, "02 - Automações", "01 - Sala de Agentes"),
    os.path.join(BASE_DIR, "02 - Automacoes", "01 - Sala de Agentes"),
    os.path.join(BASE_DIR, "Automações", "01 - Sala de Agentes")
)
BOOK_DIR = resolve_dir(
    os.path.join(BASE_DIR, "03 - Book"),
    os.path.join(BASE_DIR, "Book")
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
# Rotas: 03 - QA do Site (/qa)
# ==============================================================================
@app.route("/qa")
@app.route("/qa/")
def qa_index():
    """Serve a página de Auditoria & QA do Site."""
    index_path = os.path.join(QA_DIR, "index.html")
    if os.path.exists(index_path):
        return send_file(index_path)
    return "Página de QA em configuração.", 404

@app.route("/qa/<path:filename>")
def serve_qa_file(filename):
    """Serve assets da página de QA."""
    return send_from_directory(QA_DIR, filename)

# ==============================================================================
# Rotas: 02 - Automações / Sala de Agentes (/sala-agentes, /automacoes)
# ==============================================================================
@app.route("/sala-agentes")
@app.route("/sala-agentes/")
@app.route("/automacoes")
@app.route("/automacoes/")
def sala_agentes_index():
    """Serve o painel executivo da Sala de Agentes Autônomos."""
    index_path = os.path.join(SALA_DIR, "index.html")
    if os.path.exists(index_path):
        return send_file(index_path)
    return "Sala de Agentes em configuração.", 404

@app.route("/sala-agentes/<path:filename>")
def serve_sala_file(filename):
    """Serve assets da Sala de Agentes."""
    return send_from_directory(SALA_DIR, filename)

# ==============================================================================
# Endpoints da Sala de Agentes (AI Operations Room API)
# ==============================================================================
@app.route("/api/projetos", methods=["GET", "POST"])
def api_projetos():
    return jsonify([
        {"id": 1, "nome": "Nova Insights", "caminho_local": "C:\\Barretos\\NovaInsights", "arquivado": False},
        {"id": 2, "nome": "Orion Flow", "caminho_local": "C:\\Barretos\\OrionFlow", "arquivado": False},
        {"id": 3, "nome": "Barretos Inteligente • CCO", "caminho_local": "C:\\Barretos\\CCO", "arquivado": False}
    ])

# ==============================================================================
# Sistema Dinâmico de Tarefas e Gestão de Agentes Autônomos
# ==============================================================================
AGENTS_TASKS = {
    "p3-main": {
        "chave": "p3-main",
        "tipo": "Claude principal",
        "nome": "Supervisor Geral CCO",
        "session_id": "sess-cco",
        "projeto_id": 3,
        "projeto_nome": "Barretos Inteligente • CCO",
        "cwd": "C:\\Barretos\\CCO",
        "estado": "delegando",
        "pai_chave": None,
        "agent_id": None,
        "tarefa_atual": {
            "id": "tsk-cco-01",
            "titulo": "Supervisão e despacho autônomo da sala de operações",
            "descricao": "Monitoramento central de fluxos, delegação de auditorias de dados para Exati e Ofícios, e governança de alertas municipais.",
            "progresso": 82,
            "iniciado_em": "2026-10-11T22:39:00",
            "duracao_min": 28,
            "previsao_min": 5,
            "prioridade": "Alta"
        },
        "fila": [
            {
                "id": "tsk-cco-f1",
                "titulo": "Auditar sincronização das réplicas de leitura com o banco cloud",
                "descricao": "Garantir consistência entre os dados locais e a nuvem Vercel.",
                "adicionado_em": "23:05",
                "prioridade": "Normal"
            }
        ],
        "historico": [
            {
                "id": "tsk-cco-h1",
                "titulo": "Inicialização da malha de telemetria e agentes do CCO",
                "concluido_em": "22:38",
                "duracao": "3 min",
                "status": "concluido",
                "resultado": "Todos os 5 agentes operacionais conectados com sucesso."
            }
        ]
    },
    "p3-exati": {
        "chave": "p3-exati",
        "tipo": "Monitor Exati",
        "nome": "Agente Operacional Exati",
        "session_id": "sess-cco",
        "projeto_id": 3,
        "projeto_nome": "Barretos Inteligente • CCO",
        "cwd": "C:\\Barretos\\CCO",
        "estado": "trabalhando",
        "pai_chave": "p3-main",
        "agent_id": "sub-exati",
        "tarefa_atual": {
            "id": "tsk-exati-01",
            "titulo": "Auditoria de chamados pendentes com SLA excedido (>7 dias)",
            "descricao": "Identificação de 6 ordens pendentes críticas da Ronda Própria abertas desde Agosto/Setembro e geração de matriz de criticidade.",
            "progresso": 75,
            "iniciado_em": "2026-10-11T22:57:00",
            "duracao_min": 10,
            "previsao_min": 3,
            "prioridade": "Crítica"
        },
        "fila": [
            {
                "id": "tsk-exati-f1",
                "titulo": "Cruzamento de reincidência de lâmpadas no bairro Cristiano de Carvalho",
                "descricao": "Verificação de histórico de trocas de luminárias nos últimos 90 dias.",
                "adicionado_em": "23:10",
                "prioridade": "Alta"
            },
            {
                "id": "tsk-exati-f2",
                "titulo": "Simulação de capacidade preditiva para queima de backlog em 48h",
                "descricao": "Execução do modelo de regressão linear para dimensionamento de equipes.",
                "adicionado_em": "23:18",
                "prioridade": "Normal"
            }
        ],
        "historico": [
            {
                "id": "tsk-exati-h1",
                "titulo": "Importação e consolidação da planilha ExportacaoConsulta (1).xlsx",
                "concluido_em": "22:55",
                "duracao": "4 min",
                "status": "concluido",
                "resultado": "2.804 atendimentos processados e indicadores atualizados."
            },
            {
                "id": "tsk-exati-h2",
                "titulo": "Cálculo de produtividade diária por equipe (Equipe 6 vs Equipe 01)",
                "concluido_em": "22:40",
                "duracao": "2 min",
                "status": "concluido",
                "resultado": "Média de 15 ordens/dia validada sem desvios operacionais."
            }
        ]
    },
    "p3-oficios": {
        "chave": "p3-oficios",
        "tipo": "Consulta de Ofícios",
        "nome": "Agente Auditor de Ofícios",
        "session_id": "sess-cco",
        "projeto_id": 3,
        "projeto_nome": "Barretos Inteligente • CCO",
        "cwd": "C:\\Barretos\\CCO",
        "estado": "trabalhando",
        "pai_chave": "p3-main",
        "agent_id": "sub-oficios",
        "tarefa_atual": {
            "id": "tsk-oficios-01",
            "titulo": "Auditoria de prazos de resposta de documentos e ofícios de 2026",
            "descricao": "Varredura na base de dados indexada de 454 ofícios para detectar termos de garantia e respostas vencendo nos próximos 15 dias.",
            "progresso": 88,
            "iniciado_em": "2026-10-11T22:55:00",
            "duracao_min": 12,
            "previsao_min": 2,
            "prioridade": "Alta"
        },
        "fila": [
            {
                "id": "tsk-oficios-f1",
                "titulo": "Indexação e extração OCR de novos anexos adicionados ao repositório",
                "descricao": "Extração de metadados de páginas escaneadas e conferência de numeração.",
                "adicionado_em": "23:12",
                "prioridade": "Normal"
            }
        ],
        "historico": [
            {
                "id": "tsk-oficios-h1",
                "titulo": "Checagem de integridade de links e busca textual sem acentos",
                "concluido_em": "22:50",
                "duracao": "5 min",
                "status": "concluido",
                "resultado": "Zero PDFs corrompidos encontrados; 454 arquivos validados."
            }
        ]
    },
    "p1-qa": {
        "chave": "p1-qa",
        "tipo": "QA",
        "nome": "Agente Sentinela de QA & Rotas",
        "session_id": "sess-nova",
        "projeto_id": 1,
        "projeto_nome": "Nova Insights",
        "cwd": "C:\\Barretos\\NovaInsights",
        "estado": "trabalhando",
        "pai_chave": "p1-main",
        "agent_id": "sub-qa",
        "tarefa_atual": {
            "id": "tsk-qa-01",
            "titulo": "Varredura de responsividade mobile, gaveta lateral e rotas",
            "descricao": "Testes automatizados simulando viewport de smartphones (360x640 até 412x915) e verificação de corte de texto e sombras laterais.",
            "progresso": 64,
            "iniciado_em": "2026-10-11T22:58:00",
            "duracao_min": 9,
            "previsao_min": 5,
            "prioridade": "Normal"
        },
        "fila": [
            {
                "id": "tsk-qa-f1",
                "titulo": "Checkup de renderização da tabela analítica do Monitor Exati",
                "descricao": "Conferência de scroll horizontal e renderização de badges em celulares.",
                "adicionado_em": "23:14",
                "prioridade": "Normal"
            }
        ],
        "historico": [
            {
                "id": "tsk-qa-h1",
                "titulo": "Inspeção do corte de texto na barra lateral sob a navbar",
                "concluido_em": "22:45",
                "duracao": "3 min",
                "status": "concluido",
                "resultado": "Aprovado: padding-top adicionado, texto 100% legível."
            }
        ]
    },
    "p3-book": {
        "chave": "p3-book",
        "tipo": "Curador do Book",
        "nome": "Agente Curador do Book",
        "session_id": "sess-cco",
        "projeto_id": 3,
        "projeto_nome": "Barretos Inteligente • CCO",
        "cwd": "C:\\Barretos\\CCO",
        "estado": "aguardando",
        "pai_chave": "p3-main",
        "agent_id": "sub-book",
        "tarefa_atual": None,
        "fila": [
            {
                "id": "tsk-book-f1",
                "titulo": "Catalogação do marco da Sala de Agentes Autônomos no Book de Governança",
                "descricao": "Registro da entrega com fotos, arquitetura e impacto operacional no Livro de Inovações.",
                "adicionado_em": "23:15",
                "prioridade": "Alta"
            }
        ],
        "historico": [
            {
                "id": "tsk-book-h1",
                "titulo": "Registro executivo dos 2.804 atendimentos de iluminação pública",
                "concluido_em": "22:30",
                "duracao": "4 min",
                "status": "concluido",
                "resultado": "Capítulo de Eficiência Operacional atualizado no Book."
            }
        ]
    },
    "p1-main": {
        "chave": "p1-main",
        "tipo": "Claude principal",
        "nome": "Líder Nova Insights",
        "session_id": "sess-nova",
        "projeto_id": 1,
        "projeto_nome": "Nova Insights",
        "cwd": "C:\\Barretos\\NovaInsights",
        "estado": "delegando",
        "pai_chave": None,
        "agent_id": None,
        "tarefa_atual": {
            "id": "tsk-nov-01",
            "titulo": "Coordenação de testes e mapeamento de contexto da concessão",
            "descricao": "Distribuição de sub-rotinas de checagem para QA e pesquisa semântica.",
            "progresso": 78,
            "iniciado_em": "2026-10-11T22:39:00",
            "duracao_min": 23,
            "previsao_min": 6,
            "prioridade": "Alta"
        },
        "fila": [],
        "historico": []
    },
    "p1-context": {
        "chave": "p1-context",
        "tipo": "Pesquisador de contexto",
        "nome": "Pesquisador de Contexto",
        "session_id": "sess-nova",
        "projeto_id": 1,
        "projeto_nome": "Nova Insights",
        "cwd": "C:\\Barretos\\NovaInsights",
        "estado": "trabalhando",
        "pai_chave": "p1-main",
        "agent_id": "sub-context",
        "tarefa_atual": {
            "id": "tsk-ctx-01",
            "titulo": "Mapeamento semântico de contratos de concessão e aditivos",
            "descricao": "Cruzamento de cláusulas contratuais de modernização luminotécnica com relatórios de entrega.",
            "progresso": 70,
            "iniciado_em": "2026-10-11T22:56:00",
            "duracao_min": 12,
            "previsao_min": 4,
            "prioridade": "Normal"
        },
        "fila": [],
        "historico": [
            {
                "id": "tsk-ctx-h1",
                "titulo": "Análise de aditivo do parque luminotécnico de Barretos",
                "concluido_em": "22:10",
                "duracao": "6 min",
                "status": "concluido",
                "resultado": "Cláusulas de garantia e metas de telegestão mapeadas."
            }
        ]
    },
    "p1-obsidian": {
        "chave": "p1-obsidian",
        "tipo": "Obsidian",
        "nome": "Agente Obsidian Notas",
        "session_id": "sess-nova",
        "projeto_id": 1,
        "projeto_nome": "Nova Insights",
        "cwd": "C:\\Barretos\\NovaInsights",
        "estado": "aguardando",
        "pai_chave": "p1-main",
        "agent_id": "sub-obsidian",
        "tarefa_atual": None,
        "fila": [],
        "historico": []
    },
    "p2-main": {
        "chave": "p2-main",
        "tipo": "Claude principal",
        "nome": "Líder Orion Flow",
        "session_id": "sess-orion",
        "projeto_id": 2,
        "projeto_nome": "Orion Flow",
        "cwd": "C:\\Barretos\\OrionFlow",
        "estado": "delegando",
        "pai_chave": None,
        "agent_id": None,
        "tarefa_atual": {
            "id": "tsk-orn-01",
            "titulo": "Gestão de filas assíncronas e handoff de tarefas",
            "descricao": "Orquestração contínua dos processos em segundo plano da infraestrutura.",
            "progresso": 90,
            "iniciado_em": "2026-10-11T22:34:00",
            "duracao_min": 28,
            "previsao_min": 2,
            "prioridade": "Alta"
        },
        "fila": [],
        "historico": []
    },
    "p2-context": {
        "chave": "p2-context",
        "tipo": "Pesquisador de contexto",
        "nome": "Pesquisador Orion",
        "session_id": "sess-orion",
        "projeto_id": 2,
        "projeto_nome": "Orion Flow",
        "cwd": "C:\\Barretos\\OrionFlow",
        "estado": "trabalhando",
        "pai_chave": "p2-main",
        "agent_id": "sub-context2",
        "tarefa_atual": {
            "id": "tsk-ctx2-01",
            "titulo": "Varredura de dependências e atualização de bibliotecas",
            "descricao": "Auditoria de integridade de pacotes e tempos de resposta de rede.",
            "progresso": 55,
            "iniciado_em": "2026-10-11T22:58:00",
            "duracao_min": 10,
            "previsao_min": 6,
            "prioridade": "Normal"
        },
        "fila": [],
        "historico": []
    },
    "p2-bug": {
        "chave": "p2-bug",
        "tipo": "Bug Hunter",
        "nome": "Agente Bug Hunter",
        "session_id": "sess-orion",
        "projeto_id": 2,
        "projeto_nome": "Orion Flow",
        "cwd": "C:\\Barretos\\OrionFlow",
        "estado": "aguardando",
        "pai_chave": "p2-main",
        "agent_id": "sub-bug",
        "tarefa_atual": None,
        "fila": [],
        "historico": []
    },
    "p2-handoff": {
        "chave": "p2-handoff",
        "tipo": "Handoff",
        "nome": "Agente Handoff",
        "session_id": "sess-orion",
        "projeto_id": 2,
        "projeto_nome": "Orion Flow",
        "cwd": "C:\\Barretos\\OrionFlow",
        "estado": "trabalhando",
        "pai_chave": "p2-main",
        "agent_id": "sub-handoff",
        "tarefa_atual": {
            "id": "tsk-hnd-01",
            "titulo": "Sincronização de relatórios de campo com o painel do CCO",
            "descricao": "Transmissão segura de dados de ronda e fechamento de ordens de serviço.",
            "progresso": 85,
            "iniciado_em": "2026-10-11T22:55:00",
            "duracao_min": 12,
            "previsao_min": 2,
            "prioridade": "Alta"
        },
        "fila": [],
        "historico": []
    }
}

@app.route("/api/painel")
def api_painel():
    now_dt = datetime.now()
    now_iso = now_dt.isoformat()

    execucoes = []
    trabalhando_cnt = 0
    delegando_cnt = 0
    aguardando_cnt = 0

    for chave, ag in AGENTS_TASKS.items():
        dur_min = (ag["tarefa_atual"]["duracao_min"] if ag["tarefa_atual"] else 20)
        criado_em = (now_dt - timedelta(minutes=dur_min)).isoformat()
        estado = ag["estado"]
        
        if estado == "trabalhando":
            trabalhando_cnt += 1
        elif estado == "delegando":
            delegando_cnt += 1
        else:
            aguardando_cnt += 1

        execucoes.append({
            "chave": chave,
            "session_id": ag["session_id"],
            "agent_id": ag["agent_id"],
            "pai_chave": ag["pai_chave"],
            "tipo": ag["tipo"],
            "projeto_id": ag["projeto_id"],
            "projeto_nome": ag["projeto_nome"],
            "cwd": ag["cwd"],
            "estado": estado,
            "criado_em": criado_em,
            "atualizado_em": now_iso
        })

    historico = [
        {"session_id": "sess-nova", "tipo": "QA", "projeto_nome": "Nova Insights", "estado": "trabalhando", "atualizado_em": now_iso},
        {"session_id": "sess-nova", "tipo": "Pesquisador de contexto", "projeto_nome": "Nova Insights", "estado": "trabalhando", "atualizado_em": now_iso},
        {"session_id": "sess-orion", "tipo": "Pesquisador de contexto", "projeto_nome": "Orion Flow", "estado": "trabalhando", "atualizado_em": now_iso},
        {"session_id": "sess-orion", "tipo": "Handoff", "projeto_nome": "Orion Flow", "estado": "trabalhando", "atualizado_em": now_iso},
        {"session_id": "sess-cco", "tipo": "Monitor Exati", "projeto_nome": "Barretos Inteligente • CCO", "estado": "trabalhando", "atualizado_em": now_iso},
        {"session_id": "sess-cco", "tipo": "Consulta de Ofícios", "projeto_nome": "Barretos Inteligente • CCO", "estado": "trabalhando", "atualizado_em": now_iso}
    ]

    historico_tipos = {
        "Pesquisador de contexto": [
            {"projeto_nome": "Nova Insights", "ocorrido_em": "13:31", "em_andamento": True},
            {"projeto_nome": "Orion Flow", "ocorrido_em": "13:43", "em_andamento": True}
        ],
        "QA": [
            {"projeto_nome": "Nova Insights", "ocorrido_em": "13:30", "em_andamento": True}
        ],
        "Monitor Exati": [
            {"projeto_nome": "Barretos Inteligente • CCO", "ocorrido_em": "13:35", "em_andamento": True}
        ],
        "Consulta de Ofícios": [
            {"projeto_nome": "Barretos Inteligente • CCO", "ocorrido_em": "13:36", "em_andamento": True}
        ]
    }

    return jsonify({
        "horas": 2,
        "resumo": {
            "trabalhando": trabalhando_cnt,
            "delegando": delegando_cnt,
            "aguardando": aguardando_cnt,
            "sessoes_ativas": 6,
            "execucoes_na_janela": 17,
            "concluidas": 5,
            "orfas": 0,
            "ultimo_evento": "07/10/2026 13:43"
        },
        "execucoes": execucoes,
        "historico": historico,
        "historico_tipos": historico_tipos
    })

# ==============================================================================
# Endpoints de Gestão Interativa de Tarefas dos Agentes
# ==============================================================================
@app.route("/api/agentes/tarefas")
def api_agentes_todas_tarefas():
    """Retorna todas as tarefas, filas e históricos de todos os agentes."""
    return jsonify(AGENTS_TASKS)

@app.route("/api/agentes/<chave>/tarefas")
def api_agente_tarefas(chave):
    """Retorna a tarefa atual, fila e histórico de um agente específico."""
    ag = AGENTS_TASKS.get(chave)
    if not ag:
        # Fallback de busca por tipo
        for k, a in AGENTS_TASKS.items():
            if a["tipo"].lower() == chave.lower():
                return jsonify(a)
        return jsonify({"error": "Agente não encontrado"}), 404
    return jsonify(ag)

@app.route("/api/agentes/tarefas/criar", methods=["POST"])
def api_criar_tarefa():
    """Cria uma nova tarefa para um agente (executar agora ou enfileirar)."""
    data = request.get_json(force=True, silent=True) or {}
    agente_chave = data.get("agente_chave")
    titulo = data.get("titulo", "").strip()
    descricao = data.get("descricao", "").strip()
    modo = data.get("modo", "agora")  # 'agora' ou 'fila'
    prioridade = data.get("prioridade", "Alta")

    if not agente_chave or not titulo:
        return jsonify({"success": False, "error": "Agente e título são obrigatórios."}), 400

    ag = AGENTS_TASKS.get(agente_chave)
    if not ag:
        for k, a in AGENTS_TASKS.items():
            if a["tipo"].lower() == agente_chave.lower():
                ag = a
                agente_chave = k
                break
    if not ag:
        return jsonify({"success": False, "error": "Agente não encontrado."}), 404

    now = datetime.now()
    task_id = f"tsk-{int(now.timestamp())}"
    nova_tarefa = {
        "id": task_id,
        "titulo": titulo,
        "descricao": descricao or f"Instrução personalizada despachada via sala de operações.",
        "progresso": 5,
        "iniciado_em": now.isoformat(),
        "duracao_min": 1,
        "previsao_min": 5,
        "prioridade": prioridade
    }

    if modo == "agora":
        # Se já tiver tarefa em andamento, empurra para o histórico ou fila
        if ag["tarefa_atual"]:
            ag["fila"].insert(0, {
                "id": ag["tarefa_atual"]["id"],
                "titulo": ag["tarefa_atual"]["titulo"],
                "descricao": ag["tarefa_atual"]["descricao"],
                "adicionado_em": now.strftime("%H:%M"),
                "prioridade": ag["tarefa_atual"]["prioridade"]
            })
        ag["tarefa_atual"] = nova_tarefa
        ag["estado"] = "trabalhando"
    else:
        # Enfileira
        ag["fila"].append({
            "id": task_id,
            "titulo": titulo,
            "descricao": descricao,
            "adicionado_em": now.strftime("%H:%M"),
            "prioridade": prioridade
        })

    return jsonify({"success": True, "agente": ag, "mensagem": f"Tarefa {'iniciada imediatamente' if modo == 'agora' else 'adicionada à fila'} com sucesso!"})

@app.route("/api/agentes/tarefas/pausar", methods=["POST"])
def api_pausar_tarefa():
    """Pausa a tarefa do agente e o coloca em estado aguardando."""
    data = request.get_json(force=True, silent=True) or {}
    agente_chave = data.get("agente_chave")
    ag = AGENTS_TASKS.get(agente_chave)
    if not ag:
        return jsonify({"success": False, "error": "Agente não encontrado."}), 404

    ag["estado"] = "aguardando"
    return jsonify({"success": True, "agente": ag, "mensagem": "Agente pausado com sucesso."})

@app.route("/api/agentes/tarefas/concluir", methods=["POST"])
def api_concluir_tarefa():
    """Conclui a tarefa atual, move para o histórico e puxa a próxima da fila."""
    data = request.get_json(force=True, silent=True) or {}
    agente_chave = data.get("agente_chave")
    ag = AGENTS_TASKS.get(agente_chave)
    if not ag:
        return jsonify({"success": False, "error": "Agente não encontrado."}), 404

    now = datetime.now()
    if ag["tarefa_atual"]:
        concluida = ag["tarefa_atual"]
        ag["historico"].insert(0, {
            "id": concluida["id"],
            "titulo": concluida["titulo"],
            "concluido_em": now.strftime("%H:%M"),
            "duracao": f"{concluida.get('duracao_min', 5)} min",
            "status": "concluido",
            "resultado": "Execução concluída e homologada pelo CCO."
        })
        ag["tarefa_atual"] = None

    # Se tiver fila, assume a próxima
    if ag["fila"]:
        prox = ag["fila"].pop(0)
        ag["tarefa_atual"] = {
            "id": prox["id"],
            "titulo": prox["titulo"],
            "descricao": prox["descricao"],
            "progresso": 10,
            "iniciado_em": now.isoformat(),
            "duracao_min": 1,
            "previsao_min": 4,
            "prioridade": prox.get("prioridade", "Normal")
        }
        ag["estado"] = "trabalhando"
    else:
        ag["estado"] = "aguardando"

    return jsonify({"success": True, "agente": ag, "mensagem": "Tarefa concluída com sucesso!"})

@app.route("/api/agentes/tarefas/remover-fila", methods=["POST"])
def api_remover_fila():
    data = request.get_json(force=True, silent=True) or {}
    agente_chave = data.get("agente_chave")
    task_id = data.get("task_id")
    ag = AGENTS_TASKS.get(agente_chave)
    if not ag:
        return jsonify({"success": False, "error": "Agente não encontrado."}), 404

    ag["fila"] = [t for t in ag["fila"] if t["id"] != task_id]
    return jsonify({"success": True, "agente": ag})

@app.route("/api/agentes/tarefas/promover-fila", methods=["POST"])
def api_promover_fila():
    data = request.get_json(force=True, silent=True) or {}
    agente_chave = data.get("agente_chave")
    task_id = data.get("task_id")
    ag = AGENTS_TASKS.get(agente_chave)
    if not ag:
        return jsonify({"success": False, "error": "Agente não encontrado."}), 404

    target = None
    nova_fila = []
    for t in ag["fila"]:
        if t["id"] == task_id:
            target = t
        else:
            nova_fila.append(t)
    ag["fila"] = nova_fila

    if target:
        now = datetime.now()
        if ag["tarefa_atual"]:
            ag["fila"].insert(0, {
                "id": ag["tarefa_atual"]["id"],
                "titulo": ag["tarefa_atual"]["titulo"],
                "descricao": ag["tarefa_atual"]["descricao"],
                "adicionado_em": now.strftime("%H:%M"),
                "prioridade": ag["tarefa_atual"]["prioridade"]
            })
        ag["tarefa_atual"] = {
            "id": target["id"],
            "titulo": target["titulo"],
            "descricao": target["descricao"],
            "progresso": 10,
            "iniciado_em": now.isoformat(),
            "duracao_min": 1,
            "previsao_min": 4,
            "prioridade": target.get("prioridade", "Alta")
        }
        ag["estado"] = "trabalhando"

    return jsonify({"success": True, "agente": ag})

@app.route("/api/sessoes")
def api_sessoes():
    return jsonify({
        "sessoes": [
            {"id": "sess-cco", "projeto_id": 3, "cwd": "C:\\Barretos\\CCO"},
            {"id": "sess-nova", "projeto_id": 1, "cwd": "C:\\Barretos\\NovaInsights"},
            {"id": "sess-orion", "projeto_id": 2, "cwd": "C:\\Barretos\\OrionFlow"}
        ]
    })

@app.route("/api/sessoes/<session_id>/agentes")
def api_sessao_agentes(session_id):
    agentes = []
    for chave, ag in AGENTS_TASKS.items():
        if ag["session_id"] == session_id:
            agentes.append({
                "chave": chave,
                "tipo": ag["tipo"],
                "estado": ag["estado"],
                "cwd": ag["cwd"],
                "pai_chave": ag["pai_chave"]
            })
    return jsonify({"agentes": agentes})

@app.route("/api/sessoes/<session_id>/historico")
def api_sessao_historico(session_id):
    now = datetime.now()
    return jsonify({
        "eventos": [
            {"nome": "SessionStart", "ocorrido_em": (now - timedelta(minutes=25)).isoformat()},
            {"nome": "UserPromptSubmit", "ocorrido_em": (now - timedelta(minutes=20)).isoformat()},
            {"nome": "SubagentStart", "ocorrido_em": (now - timedelta(minutes=15)).isoformat()},
            {"nome": "SubagentStart", "ocorrido_em": (now - timedelta(minutes=10)).isoformat()}
        ]
    })

# ==============================================================================
# Rotas: 03 - Book de Governança (/book)
# ==============================================================================
@app.route("/book")
@app.route("/book/")
def book_index():
    """Serve o Livro de Governança & Inovações (Book)."""
    index_path = os.path.join(BOOK_DIR, "index.html")
    if os.path.exists(index_path):
        return send_file(index_path)
    return "Book de Governança em configuração.", 404

@app.route("/book/<path:filename>")
def serve_book_file(filename):
    """Serve assets do Book de Governança."""
    return send_from_directory(BOOK_DIR, filename)

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
