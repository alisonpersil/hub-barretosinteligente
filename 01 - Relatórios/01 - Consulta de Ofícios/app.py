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
import re
from datetime import datetime
import json
import urllib.request
import urllib.parse
import urllib.error

try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        PdfReader = None

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
OFICIOS_DIR = BASE_DIR
DOCS_DIR = os.path.join(BASE_DIR, "Base de dados Ofícios")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "alisonpersil/hub-barretosinteligente")

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

MONTHS_PT = {
    'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'março': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9,
    'outubro': 10, 'novembro': 11, 'dezembro': 12,
    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
}

def parse_date_parts(d, m, y):
    try:
        day = int(d)
        if isinstance(m, str):
            m_clean = m.lower().replace('ç', 'c').strip()
            month = MONTHS_PT.get(m_clean, None)
            if not month:
                month = int(m)
        else:
            month = int(m)
        year = int(y)
        if 1 <= day <= 31 and 1 <= month <= 12 and 2020 <= year <= 2035:
            return datetime(year, month, day)
    except Exception:
        pass
    return None

def extract_date_from_filename(filename):
    # Match DD-MM-YYYY or DD_MM_YYYY or DD.MM.YYYY
    m = re.search(r'\b(\d{2})[-_.](\d{2})[-_.](202\d)\b', filename)
    if m:
        dt = parse_date_parts(m.group(1), m.group(2), m.group(3))
        if dt:
            return dt, f"nome do arquivo ({m.group(0)})"
    # Match YYYY-MM-DD or YYYYMMDD
    m2 = re.search(r'\b(202\d)[-_.](\d{2})[-_.](\d{2})\b', filename)
    if m2:
        dt = parse_date_parts(m2.group(3), m2.group(2), m2.group(1))
        if dt:
            return dt, f"nome do arquivo ({m2.group(0)})"
    return None, None

def clean_pdf_text_for_dates(text):
    if not text:
        return ""
    # Fix split numbers often produced by pdf kerning (e.g. '202 6' -> '2026')
    cleaned = re.sub(r'(?<=\b202)\s+(?=\d\b)', '', text)
    cleaned = re.sub(r'(\d)\s+(\d)', r'\1\2', cleaned)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    return cleaned

def extract_date_from_pdf_text(file_path):
    if not PdfReader:
        return None, None
    try:
        abs_p = os.path.abspath(file_path)
        if os.name == 'nt' and not abs_p.startswith('\\\\?\\'):
            abs_p = '\\\\?\\' + abs_p
            
        reader = PdfReader(abs_p)
        raw_text = ""
        num_pages = min(len(reader.pages), 3)
        for i in range(num_pages):
            raw_text += (reader.pages[i].extract_text() or "") + "\n"
            
        text = clean_pdf_text_for_dates(raw_text)
        
        # 1. Barretos, 28 de abril de 2026 / Barretos-SP, 28 de abril de 2026
        m = re.search(r'Barretos\s*(?:-\s*SP|/\s*SP)?[,\s]+(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(202\d)', text, re.IGNORECASE)
        if m:
            dt = parse_date_parts(m.group(1), m.group(2), m.group(3))
            if dt:
                return dt, f"texto PDF ({m.group(0).strip()})"
                
        # 2. General DD de Mês de YYYY
        m = re.search(r'\b(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(202\d)', text, re.IGNORECASE)
        if m:
            dt = parse_date_parts(m.group(1), m.group(2), m.group(3))
            if dt:
                return dt, f"texto PDF ({m.group(0).strip()})"

        # 3. YYYY-MM-DD
        m = re.search(r'\b(202\d)-(\d{2})-(\d{2})\b', text)
        if m:
            dt = parse_date_parts(m.group(3), m.group(2), m.group(1))
            if dt:
                return dt, f"texto PDF ({m.group(0)})"

        # 4. Standard DD/MM/YYYY
        m = re.search(r'\b(\d{2})/(\d{2})/(202\d)\b', text)
        if m:
            dt = parse_date_parts(m.group(1), m.group(2), m.group(3))
            if dt:
                return dt, f"texto PDF ({m.group(0)})"
    except Exception:
        pass
    return None, None

_PROTOCOL_DATE_CACHE = {}

def extract_protocol_date(folder_path, files):
    """
    Extract real official date for protocol folder based on user priority:
    1. Check files in numerical order (01, 02, etc.):
       - Check PDF text for date (e.g. Barretos, 28 de abril de 2026)
       - Check filename for date pattern (e.g. Tramite 28-04-2026)
    2. Check folder name for month indicator (e.g. 'Pagamento Abr-2026' -> 01/04/2026)
    3. Fallback to folder mtime
    Cached in-memory to ensure sub-millisecond execution after initial load.
    """
    cache_key = (folder_path, len(files))
    if cache_key in _PROTOCOL_DATE_CACHE:
        return _PROTOCOL_DATE_CACHE[cache_key]

    sorted_files = sorted(files)
    
    # Priority 1: Check files in numerical order
    for f in sorted_files:
        f_lower = f.lower()
        full_p = os.path.join(folder_path, f)
        
        # Check PDF text if it's a PDF
        if f_lower.endswith('.pdf'):
            dt, src = extract_date_from_pdf_text(full_p)
            if dt:
                _PROTOCOL_DATE_CACHE[cache_key] = (dt, f"{f} -> {src}")
                return dt, f"{f} -> {src}"
                
        # Check filename for date pattern
        dt, src = extract_date_from_filename(f)
        if dt:
            _PROTOCOL_DATE_CACHE[cache_key] = (dt, f"{f} -> {src}")
            return dt, f"{f} -> {src}"
            
    # Priority 2: Check folder name for month indicator (e.g. 'Pagamento Abr-2026')
    folder_name = os.path.basename(folder_path)
    m = re.search(r'(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[-_ ]?(202\d)', folder_name, re.IGNORECASE)
    if m:
        dt = parse_date_parts(1, m.group(1), m.group(2))
        if dt:
            _PROTOCOL_DATE_CACHE[cache_key] = (dt, f"pasta -> {m.group(0)}")
            return dt, f"pasta -> {m.group(0)}"
            
    # Priority 3: Fallback to folder stats
    try:
        st = os.stat(folder_path)
        dt = datetime.fromtimestamp(st.st_mtime)
        _PROTOCOL_DATE_CACHE[cache_key] = (dt, "mtime da pasta")
        return dt, "mtime da pasta"
    except Exception:
        dt = datetime.now()
        return dt, "data atual"

def load_docs_index():
    candidates = [
        os.path.join(DOCS_DIR, "docs_index.json"),
        os.path.join(OFICIOS_DIR, "docs_index.json"),
        os.path.join(BASE_DIR, "docs_index.json")
    ]
    for c in candidates:
        if os.path.isfile(c):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print("Erro ao carregar docs_index.json:", e, file=sys.stderr)
    return None

def normalize_repo_docs_path(subpath):
    subpath = urllib.parse.unquote(subpath).replace("\\", "/").strip("/")
    prefix = "01 - Relatórios/01 - Consulta de Ofícios/Base de dados Ofícios"
    if subpath.startswith("01 - Relatórios") or subpath.startswith("01 - Relatorios"):
        return subpath
    if subpath.startswith("Base de dados"):
        return f"01 - Relatórios/01 - Consulta de Ofícios/{subpath}"
    return f"{prefix}/{subpath}"

def fetch_file_from_github(subpath, token=None):
    """Fetch file content from GitHub repository with token authentication."""
    repo_path = normalize_repo_docs_path(subpath)
    encoded_path = urllib.parse.quote(repo_path.replace("\\", "/"), safe="/")
    url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/{encoded_path}"
    headers = {"User-Agent": "BarretosHub"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read(), os.path.basename(repo_path)
    except Exception as e:
        try:
            api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{urllib.parse.quote(repo_path.replace('\\', '/'))}"
            api_headers = {"User-Agent": "BarretosHub", "Accept": "application/vnd.github.v3.raw"}
            if token:
                api_headers["Authorization"] = f"Bearer {token}"
            req2 = urllib.request.Request(api_url, headers=api_headers)
            with urllib.request.urlopen(req2, timeout=30) as resp2:
                return resp2.read(), os.path.basename(repo_path)
        except Exception as e2:
            print(f"Erro ao buscar '{subpath}' no GitHub: {e} / {e2}", file=sys.stderr)
            return None, os.path.basename(repo_path)

def github_api_delete_item(token, rel_path, commit_message=None):
    """Delete a file or folder from GitHub repo using GitHub REST API."""
    repo_path = normalize_repo_docs_path(rel_path)
    encoded_path = urllib.parse.quote(repo_path.replace("\\", "/"))
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{encoded_path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "BarretosHub"
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return True
        raise e

    if isinstance(data, list):
        msg = commit_message or f"chore: excluir pasta {os.path.basename(rel_path)}"
        for item in data:
            item_path = item.get("path")
            item_type = item.get("type")
            item_sha = item.get("sha")
            if item_type == "file":
                del_req = urllib.request.Request(
                    f"https://api.github.com/repos/{GITHUB_REPO}/contents/{urllib.parse.quote(item_path)}",
                    data=json.dumps({"message": msg, "sha": item_sha, "branch": "main"}).encode("utf-8"),
                    headers={**headers, "Content-Type": "application/json"},
                    method="DELETE"
                )
                try:
                    with urllib.request.urlopen(del_req, timeout=30):
                        pass
                except Exception as ed:
                    print(f"Erro ao excluir arquivo {item_path} do GitHub:", ed, file=sys.stderr)
            elif item_type == "dir":
                github_api_delete_item(token, item_path, msg)
        return True
    elif isinstance(data, dict):
        msg = commit_message or f"chore: excluir arquivo {os.path.basename(rel_path)}"
        del_req = urllib.request.Request(
            url,
            data=json.dumps({"message": msg, "sha": data["sha"], "branch": "main"}).encode("utf-8"),
            headers={**headers, "Content-Type": "application/json"},
            method="DELETE"
        )
        with urllib.request.urlopen(del_req, timeout=30):
            return True

def remove_from_docs_index(rel_path):
    target = rel_path.replace("\\", "/").strip("/")
    target_name = os.path.basename(target)
    for c in [os.path.join(DOCS_DIR, "docs_index.json"), os.path.join(OFICIOS_DIR, "docs_index.json"), os.path.join(BASE_DIR, "docs_index.json")]:
        if os.path.isfile(c):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    data = json.load(f)
                data["protocolos"] = [p for p in data.get("protocolos", []) if p.get("relative_path") != target and p.get("folder_name") != target_name and p.get("name") != target_name]
                data["oficios"] = [o for o in data.get("oficios", []) if o.get("relative_path") != target and o.get("name") != target_name]
                with open(c, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print("Erro ao atualizar docs_index.json após exclusão:", e, file=sys.stderr)

def add_to_docs_index(doc_item, is_protocol=False, protocol_name=None):
    for c in [os.path.join(DOCS_DIR, "docs_index.json"), os.path.join(OFICIOS_DIR, "docs_index.json"), os.path.join(BASE_DIR, "docs_index.json")]:
        if os.path.isfile(c):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if is_protocol and protocol_name:
                    found = False
                    for p in data.get("protocolos", []):
                        if p.get("folder_name") == protocol_name or p.get("name") == protocol_name:
                            p.setdefault("files", []).append(doc_item)
                            p["total_files"] = len(p["files"])
                            found = True
                            break
                    if not found:
                        now_dt = datetime.now()
                        data.setdefault("protocolos", []).insert(0, {
                            "id": int(now_dt.timestamp() * 1000),
                            "doc_type": "protocolo",
                            "name": protocol_name,
                            "folder_name": protocol_name,
                            "protocolo": protocol_name.split(" - ")[0],
                            "assunto": protocol_name.split(" - ")[1] if " - " in protocol_name else protocol_name,
                            "status": None,
                            "relative_path": f"Protocolos/{protocol_name}",
                            "full_path": None,
                            "is_folder": True,
                            "is_pdf": False,
                            "total_files": 1,
                            "size_bytes": doc_item.get("size_bytes", 0),
                            "size_formatted": doc_item.get("size_formatted", "0 KB"),
                            "doc_date": now_dt.strftime("%d/%m/%Y"),
                            "doc_date_formatted": now_dt.strftime("%d/%m/%Y"),
                            "doc_date_ts": now_dt.timestamp(),
                            "doc_date_source": "importação recente",
                            "ctime": now_dt.timestamp(),
                            "ctime_formatted": now_dt.strftime("%d/%m/%Y"),
                            "mtime": now_dt.timestamp(),
                            "mtime_formatted": now_dt.strftime("%d/%m/%Y"),
                            "raw_mtime": now_dt.timestamp(),
                            "category": "Protocolo",
                            "year": str(now_dt.year),
                            "files": [doc_item]
                        })
                else:
                    data.setdefault("oficios", []).insert(0, doc_item)
                with open(c, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print("Erro ao atualizar docs_index.json após upload:", e, file=sys.stderr)

def get_all_protocolos():
    """Scan protocol folders and return detailed metadata for folders and their inner documents."""
    cached = load_docs_index()
    if cached and "protocolos" in cached and len(cached["protocolos"]) > 0:
        return cached["protocolos"]

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

        # Extract real document date for the protocol
        protocol_dt, date_source = extract_protocol_date(full_path, folder_items)
        doc_date_str = protocol_dt.strftime("%d/%m/%Y")
        doc_date_ts = protocol_dt.timestamp()

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
            "doc_date": doc_date_str,
            "doc_date_formatted": doc_date_str,
            "doc_date_ts": doc_date_ts,
            "doc_date_source": date_source,
            "ctime": doc_date_ts,
            "ctime_formatted": doc_date_str,
            "mtime": doc_date_ts,
            "mtime_formatted": doc_date_str,
            "raw_mtime": latest_mtime,
            "category": category,
            "year": year or str(protocol_dt.year),
            "files": files_list
        })
        prot_id += 1

    # Sort protocols chronologically by real document date descending by default (mais recente primeiro)
    protocolos.sort(key=lambda p: p.get("doc_date_ts", 0), reverse=True)
    return protocolos


def get_all_oficios():
    """Scan and index documents in Base de dados Ofícios/Ofícios."""
    cached = load_docs_index()
    if cached and "oficios" in cached and len(cached["oficios"]) > 0:
        return cached["oficios"]

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
                "doc_date": datetime.fromtimestamp(f_stat.st_mtime).strftime("%d/%m/%Y"),
                "doc_date_formatted": datetime.fromtimestamp(f_stat.st_mtime).strftime("%d/%m/%Y"),
                "doc_date_ts": f_stat.st_mtime,
                "ctime": f_stat.st_ctime,
                "ctime_formatted": datetime.fromtimestamp(f_stat.st_ctime).strftime("%d/%m/%Y %H:%M"),
                "mtime": f_stat.st_mtime,
                "mtime_formatted": datetime.fromtimestamp(f_stat.st_mtime).strftime("%d/%m/%Y"),
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
    if safe_path and os.path.isfile(safe_path):
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

    # Fallback para GitHub (quando os arquivos estão no repositório GitHub)
    token = (
        request.headers.get("X-GitHub-Token")
        or os.environ.get("GITHUB_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("PMO_GITHUB_TOKEN")
    )
    file_bytes, filename = fetch_file_from_github(subpath, token)
    if file_bytes:
        mimetype, _ = mimetypes.guess_type(filename)
        if not mimetype:
            mimetype = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
        response = send_file(
            io.BytesIO(file_bytes),
            mimetype=mimetype,
            as_attachment=False,
            download_name=filename
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    abort(404, description="Documento não encontrado.")

@app.route("/api/pdf/download/<path:subpath>")
def download_pdf(subpath):
    """Serve file as attachment for immediate download."""
    safe_path = get_safe_file_path(subpath)
    if safe_path and os.path.isfile(safe_path):
        return send_file(
            safe_path,
            as_attachment=True,
            download_name=os.path.basename(safe_path)
        )

    # Fallback para GitHub
    token = (
        request.headers.get("X-GitHub-Token")
        or os.environ.get("GITHUB_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("PMO_GITHUB_TOKEN")
    )
    file_bytes, filename = fetch_file_from_github(subpath, token)
    if file_bytes:
        return send_file(
            io.BytesIO(file_bytes),
            as_attachment=True,
            download_name=filename
        )

    abort(404, description="Documento não encontrado.")

@app.route("/api/protocolo/download-zip/<path:subpath>")
def download_protocolo_zip(subpath):
    """Download an entire protocol folder as a zipped archive."""
    safe_path = get_safe_file_path(subpath)
    if safe_path and os.path.isdir(safe_path):
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

    # Fallback para GitHub (quando os arquivos estão no repositório GitHub)
    token = (
        request.headers.get("X-GitHub-Token")
        or os.environ.get("GITHUB_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("PMO_GITHUB_TOKEN")
    )
    folder_name = os.path.basename(subpath.replace("\\", "/").strip("/"))
    idx_data = load_docs_index() or {}
    matched_files = []
    for p in idx_data.get("protocolos", []):
        if p.get("folder_name") == folder_name or p.get("name") == folder_name or p.get("relative_path") == subpath:
            matched_files = p.get("files", [])
            break

    if matched_files:
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in matched_files:
                f_rel = f.get("relative_path")
                f_bytes, f_name = fetch_file_from_github(f_rel, token)
                if f_bytes:
                    zf.writestr(f.get("name", f_name), f_bytes)
        memory_file.seek(0)
        return send_file(
            memory_file,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"{folder_name}.zip"
        )

    abort(404, description="Protocolo não encontrado.")

@app.route("/api/protocolo/delete", methods=["POST", "DELETE"])
@app.route("/api/oficios/delete", methods=["POST", "DELETE"])
def delete_protocolo():
    """Remove uma pasta de protocolo ou ofício permanentemente (local e no GitHub)."""
    data = request.get_json(silent=True) or request.form
    rel_path = data.get("relative_path")
    if not rel_path:
        return jsonify({"success": False, "error": "Caminho do item não fornecido."}), 400

    is_vercel = bool(os.environ.get("VERCEL"))
    token = (
        request.headers.get("X-GitHub-Token")
        or os.environ.get("GITHUB_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("PMO_GITHUB_TOKEN")
    )

    deleted_locally = False
    safe_path = get_safe_file_path(rel_path)
    if safe_path and os.path.exists(safe_path):
        try:
            if os.path.isdir(safe_path):
                folder_name = os.path.basename(safe_path)
                shutil.rmtree(safe_path)
                deleted_locally = True
                if not is_vercel:
                    run_git_sync_background(f"chore: excluir protocolo {folder_name}")
            elif os.path.isfile(safe_path):
                file_name = os.path.basename(safe_path)
                os.remove(safe_path)
                deleted_locally = True
                if not is_vercel:
                    run_git_sync_background(f"chore: excluir oficio {file_name}")
        except Exception as el:
            print("Erro ao excluir localmente:", el, file=sys.stderr)

    # Exclui diretamente no repositório GitHub via API usando o Token configurado
    if token:
        try:
            github_api_delete_item(token, rel_path)
        except Exception as eg:
            print("Erro ao excluir item do GitHub via API:", eg, file=sys.stderr)

    # Remove do índice de documentos
    remove_from_docs_index(rel_path)

    return jsonify({
        "success": True,
        "message": f"'{os.path.basename(rel_path)}' removido com sucesso."
    })

GITHUB_REPO = os.environ.get("GITHUB_REPO", "alisonpersil/hub-barretosinteligente")


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
    token = (
        request.headers.get("X-GitHub-Token")
        or os.environ.get("GITHUB_TOKEN")
        or os.environ.get("GH_TOKEN")
        or os.environ.get("PMO_GITHUB_TOKEN")
    )
    
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
                repo_path = f"01 - Relatórios/01 - Consulta de Ofícios/Base de dados Ofícios/Protocolos/{folder_name}/{filename}"
                commit_msg = f"feat: importar documento em protocolo {folder_name}/{filename}"
            else:
                target_dir = os.path.join(DOCS_DIR, "Ofícios")
                os.makedirs(target_dir, exist_ok=True)
                save_path = os.path.join(target_dir, filename)
                rel_path = f"Ofícios/{filename}"
                repo_path = f"01 - Relatórios/01 - Consulta de Ofícios/Base de dados Ofícios/Ofícios/{filename}"
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
            
            doc_entry = {
                "id": int(now_dt.timestamp() * 1000) + len(saved_docs),
                "doc_type": "protocolo" if destination in ["protocolos", "protocolo"] else "oficio",
                "name": filename,
                "relative_path": rel_path,
                "size_bytes": size_bytes,
                "size_formatted": format_file_size(size_bytes),
                "ctime": now_dt.timestamp(),
                "ctime_formatted": now_dt.strftime("%d/%m/%Y %H:%M"),
                "mtime": now_dt.timestamp(),
                "mtime_formatted": now_dt.strftime("%d/%m/%Y"),
                "doc_date": now_dt.strftime("%d/%m/%Y"),
                "doc_date_formatted": now_dt.strftime("%d/%m/%Y"),
                "doc_date_ts": now_dt.timestamp(),
                "extension": ".pdf",
                "is_pdf": True,
                "category": category,
                "year": year or str(now_dt.year)
            }
            saved_docs.append(doc_entry)
            add_to_docs_index(doc_entry, is_protocol=(destination in ["protocolos", "protocolo"]), protocol_name=(folder_name if destination in ["protocolos", "protocolo"] else None))

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

