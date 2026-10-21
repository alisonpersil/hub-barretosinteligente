#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
Módulo de Sincronização Automática: Cidadão Online (Barretos-SP) -> Hub PMO
==============================================================================
Conecta-se ao portal Cidadão Online da Prefeitura de Barretos via API REST,
autentica com as credenciais do contribuinte (IP Barretos), consulta os
protocolos e ofícios, detecta novos protocolos, atualiza os status das
tramitações (Deferido, Indeferido, Em análise) e faz o download incremental
de novos anexos em PDF para a base de dados do Hub, sem duplicar arquivos
já existentes.

Suporta:
- Execução local via terminal ou arquivo .bat (Task Scheduler)
- Sincronização direta na nuvem via GitHub REST API (branch 'storage')
- Execução integrada como endpoint da API do Hub (/api/sync/cidadao-online)
==============================================================================
"""

import os
import sys
import re
import ssl
import json
import time
import base64
import urllib.request
import urllib.parse
import urllib.error
import unicodedata
from datetime import datetime

# Credenciais e URLs padrão
DEFAULT_BASE_URL = "https://cidadaoonline.barretos.sp.gov.br"
DEFAULT_USER = "49023977000113"
DEFAULT_PASS = "1234"
DEFAULT_DATA_INICIAL = "2020-01-01"
DEFAULT_GITHUB_REPO = os.environ.get("GITHUB_REPO", "alisonpersil/hub-barretosinteligente")

# Contexto SSL permissivo para portais municipais
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def normalize_filename(name: str) -> str:
    """Normaliza o nome do arquivo para comparação estrita e deduplicação."""
    if not name:
        return ""
    n = name.strip().lower()
    n = re.sub(r'\s+', ' ', n)
    # Remove repetidos prefixos numéricos como '01 - ', '28 - ', '17 - ', '0. '
    while True:
        m = re.match(r'^(\d+[\s\-_.]+|\d+\.\s*)', n)
        if m:
            n = n[m.end():].strip()
        else:
            break
    # Remove acentos
    n = ''.join(c for c in unicodedata.normalize('NFKD', n) if not unicodedata.combining(c))
    # Mantém apenas letras, números e pontos
    return re.sub(r'[^a-z0-9.]', '', n)


def normalize_status(parecer: str, situacao: str) -> str:
    """Normaliza o status retornado pelo portal para o padrão do Hub."""
    text = (parecer or situacao or "").strip()
    norm = text.lower()
    if "deferido" in norm and "indeferido" not in norm:
        return "Deferido"
    elif "indeferido" in norm:
        return "Indeferido"
    elif "análise" in norm or "analise" in norm or "andamento" in norm:
        return "Em análise"
    elif "arquivo" in norm or "arquivado" in norm:
        return "Arquivado"
    elif text:
        return text
    return "Em análise"


def detect_category(assunto: str, servico: str) -> str:
    """Classifica a categoria do protocolo no Hub."""
    t = f"{assunto} {servico}".lower()
    if any(k in t for k in ["ilumin", "poste", "lumin", "dimeriza", "passeio", "praca", "rua"]):
        return "Iluminação"
    elif any(k in t for k in ["pagamento", "parcela", "prm", "reajuste", "nf", "nota fiscal", "bde", "faturamento"]):
        return "Faturamento / NF"
    elif any(k in t for k in ["loteamento", "diretriz", "diretrizes"]):
        return "Diretrizes"
    elif any(k in t for k in ["reconhecimento", "facial", "camera", "câmera", "videomonitoramento", "seguran"]):
        return "Segurança / CCO"
    elif any(k in t for k in ["fotovoltaico", "carport", "solar", "geracao"]):
        return "Geração Distribuída"
    return "Geral"


def format_size(bytes_num: int) -> str:
    """Formata bytes em string legível (KB, MB)."""
    if bytes_num < 1024:
        return f"{bytes_num} B"
    elif bytes_num < 1024 * 1024:
        return f"{bytes_num / 1024:.1f} KB"
    else:
        return f"{bytes_num / (1024 * 1024):.2f} MB"


class CidadaoOnlineClient:
    """Cliente para API do portal Cidadão Online de Barretos."""

    def __init__(self, base_url=DEFAULT_BASE_URL, username=DEFAULT_USER, password=DEFAULT_PASS):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.token = None
        self.cookie = None

    def login(self) -> bool:
        """Efetua login e guarda o JWT token de autorização."""
        url = f"{self.base_url}/api/auth/login?modulo=%2Fpages%2Flogin"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/plain, */*"
        }
        payload = json.dumps({"username": self.username, "password": self.password}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
                self.cookie = resp.getheader("Set-Cookie")
                data = json.loads(resp.read().decode("utf-8"))
                self.token = data.get("token")
                return bool(self.token)
        except Exception as e:
            print(f"[ERRO LOGIN] Falha ao autenticar em {url}: {e}", file=sys.stderr)
            return False

    def get_headers(self) -> dict:
        h = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json, text/plain, */*"
        }
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if self.cookie:
            h["Cookie"] = self.cookie.split(";")[0]
        return h

    def fetch_all_protocols(self, data_inicial=DEFAULT_DATA_INICIAL, data_final=None, limit_per_page=100) -> list:
        """Recupera a lista completa de protocolos para o CNPJ configurado."""
        if not self.token and not self.login():
            return []

        if not data_final:
            data_final = datetime.now().strftime("%Y-%m-%d")

        all_results = []
        offset = 0

        while True:
            params = {
                "data_inicial": data_inicial,
                "data_final": data_final,
                "documento": self.username,
                "limit": str(limit_per_page),
                "offset": str(offset),
                "order_by": "desc"
            }
            url = f"{self.base_url}/api/protocolo?" + urllib.parse.urlencode(params)
            req = urllib.request.Request(url, headers=self.get_headers(), method="GET")
            try:
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=40) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    results = data.get("results", [])
                    all_results.extend(results)
                    total = data.get("paging", {}).get("total", 0)
                    offset += len(results)
                    if offset >= total or not results:
                        break
            except Exception as e:
                print(f"[ERRO PROTOCOLOS] Falha ao consultar lista (offset {offset}): {e}", file=sys.stderr)
                break

        return all_results

    def fetch_protocol_detail(self, codigo, ano, numero) -> dict:
        """Consulta os detalhes, tramitações e anexos de um protocolo específico."""
        if not self.token and not self.login():
            return {}

        url = f"{self.base_url}/api/protocolo/consulta/{codigo}/{ano}/{numero}"
        req = urllib.request.Request(url, headers=self.get_headers(), method="GET")
        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[ERRO DETALHE] Falha ao consultar #{numero}/{ano}: {e}", file=sys.stderr)
            return {}

    def download_file(self, href: str) -> bytes:
        """Baixa o arquivo binário anexado via URL relativa ou absoluta."""
        if not href:
            return None
        if href.startswith("http"):
            url = href
        else:
            url = f"{self.base_url}{href if href.startswith('/') else '/' + href}"

        req = urllib.request.Request(url, headers=self.get_headers(), method="GET")
        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as resp:
                return resp.read()
        except Exception as e:
            print(f"[ERRO DOWNLOAD] Falha ao baixar anexo {url}: {e}", file=sys.stderr)
            return None


def sync_cidadao_online(
    docs_index_path=None,
    data_inicial=DEFAULT_DATA_INICIAL,
    ano_minimo=None,
    github_token=None,
    github_repo=DEFAULT_GITHUB_REPO,
    dry_run=False,
    logger=print
) -> dict:
    """
    Executa a sincronização completa entre Cidadão Online e o Hub.
    
    Retorna resumo da operação:
    {
      "status": "success",
      "protocols_total_portal": int,
      "protocols_processed": int,
      "protocols_added": int,
      "statuses_updated": int,
      "files_added": int,
      "files_already_existing": int,
      "details": list
    }
    """
    start_time = time.time()
    summary = {
        "status": "pending",
        "protocols_total_portal": 0,
        "protocols_processed": 0,
        "protocols_added": 0,
        "statuses_updated": 0,
        "files_added": 0,
        "files_already_existing": 0,
        "details": []
    }

    # 1. Localizar e carregar docs_index.json
    candidates = []
    if docs_index_path and os.path.exists(docs_index_path):
        candidates.append(docs_index_path)
    candidates.extend([
        os.path.join(os.getcwd(), "01 - Relatórios", "01 - Consulta de Ofícios", "docs_index.json"),
        os.path.join(os.path.dirname(__file__), "..", "01 - Relatórios", "01 - Consulta de Ofícios", "docs_index.json"),
        os.path.join(os.getcwd(), "docs_index.json"),
        "/tmp/docs_index.json"
    ])

    actual_index_path = None
    hub_data = None
    for c in candidates:
        if c and os.path.isfile(c):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    hub_data = json.load(f)
                    actual_index_path = os.path.abspath(c)
                    break
            except Exception:
                pass

    if not hub_data:
        hub_data = {"protocolos": [], "oficios": []}
        actual_index_path = candidates[1]

    logger(f"[SYNC] Arquivo docs_index.json: {actual_index_path} (protocolos atuais: {len(hub_data.get('protocolos', []))})")

    # Mapear protocolos do Hub por número numérico
    hub_by_number = {}
    max_id = 0
    for p in hub_data.get("protocolos", []):
        pid = p.get("id", 0)
        if isinstance(pid, int) and pid > max_id:
            max_id = pid
        m = re.search(r"(\d+)[-/]", p.get("protocolo", "") or p.get("name", ""))
        if m:
            hub_by_number[int(m.group(1))] = p

    # 2. Conectar à API Cidadão Online
    client = CidadaoOnlineClient()
    logger(f"[SYNC] Autenticando com usuário {client.username}...")
    if not client.login():
        summary["status"] = "error"
        summary["error"] = "Falha ao autenticar no portal Cidadão Online"
        return summary

    logger("[SYNC] Conectado com sucesso! Consultando lista de protocolos...")
    portal_protocols = client.fetch_all_protocols(data_inicial=data_inicial)
    summary["protocols_total_portal"] = len(portal_protocols)
    logger(f"[SYNC] Total de protocolos encontrados no portal: {len(portal_protocols)}")

    # Base de dados local de anexos
    parent_dir = os.path.dirname(actual_index_path)
    if os.path.basename(parent_dir).strip().lower() in ["base de dados ofícios", "base de dados oficios"]:
        base_docs_dir = os.path.join(parent_dir, "Protocolos")
    else:
        base_docs_dir = os.path.join(parent_dir, "Base de dados Ofícios", "Protocolos")

    has_changes = False

    # 3. Iterar por cada protocolo do portal
    for p_info in portal_protocols:
        ano = int(p_info.get("ano", 0))
        if ano_minimo and ano < ano_minimo:
            continue

        numero = int(p_info.get("numero", 0))
        codigo = str(p_info.get("codigo", "001"))
        sigla = p_info.get("servico", {}).get("tipo", {}).get("sigla", "GRL")
        servico_nome = p_info.get("servico", {}).get("nome", "").strip() or "GERAL"
        data_str = p_info.get("data", "")
        parecer = p_info.get("parecer") or ""
        situacao = p_info.get("situacao") or ""
        novo_status = normalize_status(parecer, situacao)

        summary["protocols_processed"] += 1
        protocol_str = f"{numero}/{ano}-{sigla}"

        # Verificar se protocolo já existe no Hub
        hub_proto = hub_by_number.get(numero)
        is_new_protocol = False

        if not hub_proto:
            # Novo protocolo no Hub!
            is_new_protocol = True
            max_id += 1
            folder_clean_name = f"{numero}-{ano}-{sigla} - {servico_nome}"
            # Sanitizar nome de pasta para Windows
            folder_clean_name = re.sub(r'[\\/*?:"<>|]', "", folder_clean_name).strip()

            # Data de emissão
            doc_date_formatted = ""
            doc_date_ts = 0.0
            if data_str:
                try:
                    dt = datetime.strptime(data_str[:19], "%Y-%m-%d %H:%M:%S")
                    doc_date_formatted = dt.strftime("%d/%m/%Y")
                    doc_date_ts = dt.timestamp()
                except Exception:
                    doc_date_formatted = datetime.now().strftime("%d/%m/%Y")
                    doc_date_ts = time.time()
            else:
                doc_date_formatted = datetime.now().strftime("%d/%m/%Y")
                doc_date_ts = time.time()

            hub_proto = {
                "id": max_id,
                "doc_type": "protocolo",
                "name": folder_clean_name,
                "folder_name": folder_clean_name,
                "protocolo": protocol_str,
                "assunto": servico_nome,
                "status": novo_status,
                "relative_path": f"Protocolos/{folder_clean_name}",
                "full_path": os.path.join(base_docs_dir, folder_clean_name),
                "is_folder": True,
                "is_pdf": False,
                "total_files": 0,
                "size_bytes": 0,
                "size_formatted": "0 B",
                "doc_date": doc_date_formatted,
                "doc_date_formatted": doc_date_formatted,
                "doc_date_ts": doc_date_ts,
                "category": detect_category(servico_nome, servico_nome),
                "year": str(ano),
                "files": []
            }
            hub_data["protocolos"].append(hub_proto)
            hub_by_number[numero] = hub_proto
            summary["protocols_added"] += 1
            has_changes = True
            logger(f"  [+ NOVO PROTOCOLO] Criado #{protocol_str}: '{folder_clean_name}'")
        else:
            # Protocolo já existe: verificar se o status foi atualizado
            if hub_proto.get("status") != novo_status:
                antigo = hub_proto.get("status")
                hub_proto["status"] = novo_status
                summary["statuses_updated"] += 1
                has_changes = True
                logger(f"  [STATUS ATUALIZADO] #{protocol_str}: de '{antigo}' para '{novo_status}'")

        # 4. Verificar anexos / arquivos do protocolo
        detalhes = client.fetch_protocol_detail(codigo, ano, numero)
        anexos_portal = []
        for tr in detalhes.get("tramites", []):
            for a in tr.get("anexos", []):
                anexos_portal.append(a)
        for doc in detalhes.get("documentos", []):
            anexos_portal.append(doc)

        # Mapear arquivos existentes no Hub normalizados
        existing_norm = {}
        for ef in hub_proto.get("files", []):
            ef_norm = normalize_filename(ef.get("name", ""))
            existing_norm[ef_norm] = ef

        # Verificar cada anexo do portal
        files_added_this_proto = 0
        folder_name = hub_proto.get("folder_name") or hub_proto.get("name")
        local_folder = os.path.join(base_docs_dir, folder_name)

        for anexo in anexos_portal:
            nome_original = anexo.get("nome", "").strip()
            if not nome_original:
                continue

            anexo_norm = normalize_filename(nome_original)
            if anexo_norm in existing_norm:
                # Arquivo já existe no Hub! Não duplicar!
                summary["files_already_existing"] += 1
                continue

            # Novo arquivo detectado!
            links = anexo.get("links", [])
            download_href = links[0].get("href") if links else None
            if not download_href:
                continue

            logger(f"    [+ NOVO ARQUIVO] Protocolo #{protocol_str}: '{nome_original}'")

            if dry_run:
                summary["files_added"] += 1
                continue

            # Baixar bytes do anexo
            file_bytes = client.download_file(download_href)
            if not file_bytes:
                logger(f"    [!] Falha no download de '{nome_original}'")
                continue

            # Nome formatado no padrão do repositório
            next_idx = len(hub_proto.get("files", [])) + 1
            # Evita prefixo duplicado se o nome original já começar com numeração
            if re.match(r'^\d+\s*-\s*', nome_original):
                final_filename = nome_original
            else:
                final_filename = f"{next_idx:02d} - {nome_original}"

            final_filename = re.sub(r'[\\/*?:"<>|]', "", final_filename)

            # Salvar localmente se não for ambiente estritamente somente-leitura (como Vercel)
            if not os.environ.get("VERCEL"):
                try:
                    os.makedirs(local_folder, exist_ok=True)
                    local_file_path = os.path.join(local_folder, final_filename)
                    with open(local_file_path, "wb") as f_out:
                        f_out.write(file_bytes)
                except Exception as e_write:
                    logger(f"    [!] Aviso ao salvar arquivo local: {e_write}")

            # Se houver token do GitHub, efetuar commit na branch 'storage'
            token = github_token or os.environ.get("GITHUB_TOKEN") or os.environ.get("PMO_GITHUB_TOKEN")
            if token:
                try:
                    from app import github_api_commit_file
                    repo_rel_path = f"01 - Relatórios/01 - Consulta de Ofícios/Base de dados Ofícios/Protocolos/{folder_name}/{final_filename}"
                    github_api_commit_file(
                        token=token,
                        repo_path=repo_rel_path,
                        file_bytes=file_bytes,
                        commit_message=f"feat(protocolo): sincronizar anexo {final_filename} do protocolo {protocol_str}"
                    )
                    logger(f"    [GitHub Storage] Commit enviado: {final_filename}")
                except Exception as e_gh:
                    logger(f"    [GitHub Storage] Erro ao enviar commit: {e_gh}")

            # Registrar novo arquivo na estrutura de dados do Hub
            agora = time.time()
            agora_fmt = datetime.now().strftime("%d/%m/%Y %H:%M")
            novo_arquivo_entry = {
                "id": next_idx,
                "name": final_filename,
                "relative_path": f"Protocolos/{folder_name}/{final_filename}",
                "size_bytes": len(file_bytes),
                "size_formatted": format_size(len(file_bytes)),
                "mtime": agora,
                "mtime_formatted": agora_fmt,
                "ctime": agora,
                "ctime_formatted": agora_fmt,
                "extension": ".pdf",
                "is_pdf": True
            }
            hub_proto["files"].append(novo_arquivo_entry)
            existing_norm[anexo_norm] = novo_arquivo_entry
            files_added_this_proto += 1
            summary["files_added"] += 1
            has_changes = True

        if files_added_this_proto > 0:
            hub_proto["total_files"] = len(hub_proto["files"])
            hub_proto["size_bytes"] = sum(f.get("size_bytes", 0) for f in hub_proto["files"])
            hub_proto["size_formatted"] = format_size(hub_proto["size_bytes"])

    # 5. Salvar docs_index.json se houver modificações
    if has_changes and not dry_run:
        logger("[SYNC] Salvando alterações em docs_index.json...")
        try:
            with open(actual_index_path, "w", encoding="utf-8") as f:
                json.dump(hub_data, f, ensure_ascii=False, indent=2)
            logger(f"[SYNC] Arquivo local salvo com sucesso: {actual_index_path}")
        except Exception as e:
            logger(f"[ERRO] Falha ao salvar arquivo local docs_index.json: {e}")

        # Também salvar nas outras localizações do repositório
        for extra_path in [
            os.path.join(os.getcwd(), "01 - Relatórios", "01 - Consulta de Ofícios", "Base de dados Ofícios", "docs_index.json"),
            os.path.join(os.getcwd(), "docs_index.json"),
            "/tmp/docs_index.json"
        ]:
            try:
                os.makedirs(os.path.dirname(extra_path), exist_ok=True)
                with open(extra_path, "w", encoding="utf-8") as f_ex:
                    json.dump(hub_data, f_ex, ensure_ascii=False, indent=2)
            except Exception:
                pass

        # Sincronizar docs_index.json no GitHub se token disponível
        token = github_token or os.environ.get("GITHUB_TOKEN") or os.environ.get("PMO_GITHUB_TOKEN")
        if token:
            try:
                from app import github_api_commit_file
                idx_bytes = json.dumps(hub_data, ensure_ascii=False, indent=2).encode("utf-8")
                github_api_commit_file(
                    token=token,
                    repo_path="01 - Relatórios/01 - Consulta de Ofícios/docs_index.json",
                    file_bytes=idx_bytes,
                    commit_message="chore(sync): sincronização automática Cidadão Online de Barretos"
                )
                logger("[SYNC] docs_index.json sincronizado no GitHub via API.")
            except Exception as e_idx_gh:
                logger(f"[ERRO] Falha ao sincronizar docs_index.json no GitHub: {e_idx_gh}")

    elapsed = time.time() - start_time
    summary["status"] = "success"
    summary["elapsed_seconds"] = round(elapsed, 2)

    logger("=" * 60)
    logger(f"[RESUMO DA SINCRONIZAÇÃO] Finalizado em {summary['elapsed_seconds']}s")
    logger(f" - Protocolos no portal:       {summary['protocols_total_portal']}")
    logger(f" - Protocolos processados:     {summary['protocols_processed']}")
    logger(f" - Novos protocolos criados:   {summary['protocols_added']}")
    logger(f" - Status atualizados:         {summary['statuses_updated']}")
    logger(f" - Novos anexos adicionados:   {summary['files_added']}")
    logger(f" - Arquivos já existentes:     {summary['files_already_existing']}")
    logger("=" * 60)

    return summary


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sincronizador Cidadão Online Barretos -> Hub PMO")
    parser.add_argument("--ano", type=int, default=2026, help="Ano mínimo dos protocolos (padrão: 2026)")
    parser.add_argument("--inicio", type=str, default=DEFAULT_DATA_INICIAL, help="Data inicial YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", help="Executar teste sem salvar arquivos ou commits")
    parser.add_argument("--index", type=str, default=None, help="Caminho personalizado de docs_index.json")
    parser.add_argument("--token", type=str, default=None, help="GitHub Personal Access Token")
    args = parser.parse_args()

    sync_cidadao_online(
        docs_index_path=args.index,
        data_inicial=args.inicio,
        ano_minimo=args.ano,
        github_token=args.token,
        dry_run=args.dry_run
    )
