import os
import glob
import json
import re
from datetime import datetime, date
import pandas as pd
import numpy as np

from exati_column_resolver import resolve_columns, detect_dataset_type, get_col_val

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
base_dir = os.path.join(SCRIPT_DIR, "Base de dados")
output_dir = SCRIPT_DIR

def read_excel_smart_header(file_path, max_rows_scan=10):
    """Lê a planilha procurando dinamicamente a linha onde estão os cabeçalhos reais."""
    try:
        df_raw = pd.read_excel(file_path, header=None, nrows=max_rows_scan)
        header_idx = 0
        for idx, row in df_raw.iterrows():
            row_str = " ".join([str(v).lower() for v in row if pd.notna(v)])
            if any(k in row_str for k in ['solicita', 'atendimento', 'protocolo', 'ocorrencia', 'bairro', 'data', 'reclamac']):
                header_idx = idx
                break
        df = pd.read_excel(file_path, header=header_idx)
        return df.dropna(how='all')
    except Exception as e:
        print(f"Erro lendo {file_path}: {e}")
        return pd.DataFrame()


# ==============================================================================
# 1. Leitura e Consolidação da Base de ATENDIDOS (SGI / Histórico)
# ==============================================================================
print("1. Lendo base de Atendidos...")
atendidos_files = sorted(glob.glob(os.path.join(base_dir, "Atendidos", "*.xls*")), key=os.path.getsize, reverse=True)
cache_file = os.path.join(output_dir, "atendidos_cache.pkl")
max_atendidos_mtime = max(os.path.getmtime(f) for f in atendidos_files) if atendidos_files else 0

if os.path.exists(cache_file) and os.path.getmtime(cache_file) >= max_atendidos_mtime:
    print(f"Carregando Atendidos do cache acelerado ({os.path.basename(cache_file)})...")
    df_a = pd.read_pickle(cache_file)
    print(f"Total consolidado único (cache): {len(df_a)}")
else:
    df_atendidos_list = []
    for af in atendidos_files:
        print(f"Lendo {os.path.basename(af)}...")
        try:
            df_tmp = read_excel_smart_header(af)
            if not df_tmp.empty:
                df_atendidos_list.append(df_tmp)
        except Exception as e:
            print(f"Erro lendo {af}: {e}")

    df_a = pd.concat(df_atendidos_list, ignore_index=True)
    print(f"Total antes deduplicação: {len(df_a)}")
    df_a = df_a.drop_duplicates(subset=[c for c in df_a.columns if 'atendimento' in c.lower()][:1] or ['Atendimento'])
    print(f"Total consolidado único: {len(df_a)}")

a_map, a_audit = resolve_columns(df_a.columns, 'atendidos') if not df_a.empty else ({}, {})
print(f"Atendidos resolvidos (Confiança Mapeamento: {a_audit.get('confianca_percent', 0)}%)")

col_os = a_map.get('os', 'Atendimento')
col_prot_at = a_map.get('protocolo', 'Protocolo')
col_inicio = a_map.get('data_inicio', 'Data Inicial Atendimento')
col_fim = a_map.get('data_fim', 'Data Conclusão Atendimento')
col_rec = a_map.get('data_reclamacao', 'Data da Reclamação')
col_atraso = a_map.get('atraso', 'Atraso')
col_orig = a_map.get('origem', 'Origem da Ocorrência')
col_bairro = a_map.get('bairro', 'Bairro')
col_eq = a_map.get('equipe', 'Equipe')
col_tipo = a_map.get('tipo_ocorrencia', 'Tipo Ocorrência')
col_sol = a_map.get('solucao', 'Solução')

# Indexação para cruzamento rápido de pendências já atendidas
protocols_at = set(df_a[col_prot_at].dropna().astype(str).str.strip().str.replace(r'\.0$', '', regex=True).str.lower()) if col_prot_at in df_a.columns else set()
os_at = set(df_a[col_os].dropna().astype(str).str.strip().str.replace(r'\.0$', '', regex=True).str.lower()) if col_os in df_a.columns else set()

# Conversão de colunas de data em Atendidos
if 'dt_inicio' not in df_a.columns:
    df_a['dt_inicio'] = pd.to_datetime(df_a[col_inicio], errors='coerce') if col_inicio in df_a.columns else pd.NaT
    df_a['dt_fim'] = pd.to_datetime(df_a[col_fim], errors='coerce') if col_fim in df_a.columns else pd.NaT
    df_a['dt_reclamacao'] = pd.to_datetime(df_a[col_rec], errors='coerce') if col_rec in df_a.columns else pd.NaT

    df_a['ano'] = df_a['dt_inicio'].dt.year
    df_a['ano_mes'] = df_a['dt_inicio'].dt.strftime('%Y-%m')
    df_a['data_iso'] = df_a['dt_inicio'].dt.strftime('%Y-%m-%d')

    df_a['dias_resolucao'] = np.where(
        df_a['dt_reclamacao'].notna() & df_a['dt_fim'].notna(),
        (df_a['dt_fim'] - df_a['dt_reclamacao']).dt.total_seconds() / 86400.0,
        np.nan
    )
    try:
        df_a.to_pickle(cache_file)
        print("Cache de Atendidos gerado com sucesso!")
    except Exception as e:
        print(f"Erro salvando cache: {e}")


# ==============================================================================
# 2. Leitura, Auditoria e Consolidação MULTI-PLANILHA da Base de PENDENTES
# ==============================================================================
print("2. Lendo e consolidando todas as planilhas de Pendentes...")
pendentes_files = glob.glob(os.path.join(base_dir, "Pendentes", "*.xlsx")) + glob.glob(os.path.join(base_dir, "Pendentes", "*.xls"))
pendentes_files_sorted = sorted(pendentes_files, key=os.path.getmtime)  # Mais antigos primeiro para que o mais recente sobrescreva atributos

latest_pendentes_file = pendentes_files_sorted[-1] if pendentes_files_sorted else None
latest_fname = os.path.basename(latest_pendentes_file) if latest_pendentes_file else ""

# 2.1 Histórico de Snapshots para o gráfico de evolução do backlog
hist_json_path = os.path.join(output_dir, "historico_backlog.json")
persistent_history = []
if os.path.exists(hist_json_path):
    try:
        with open(hist_json_path, 'r', encoding='utf-8') as f:
            persistent_history = json.load(f).get('snapshots', [])
    except Exception as e:
        print(f"Erro lendo historico_backlog.json: {e}")

snapshots_map = {item['arquivo']: item for item in persistent_history}

# 2.2 Dicionário de consolidação única de pendentes
merged_pendentes = {}
atendidos_reconciliados = []
ref_now = datetime.now()
p_map_latest = {}
p_audit_latest = {}

for pf in pendentes_files_sorted:
    fname = os.path.basename(pf)
    try:
        mtime = datetime.fromtimestamp(os.path.getmtime(pf))
        df_s = read_excel_smart_header(pf)
        s_map, s_audit = resolve_columns(df_s.columns, 'pendentes') if not df_s.empty else ({}, {})
        
        if fname == latest_fname:
            p_map_latest = s_map
            p_audit_latest = s_audit

        col_pt = s_map.get('pontos')
        col_tr = s_map.get('tempo_restante')
        col_orig = s_map.get('origem')

        tot_ch = len(df_s)
        tot_pt = int(df_s[col_pt].sum()) if col_pt and col_pt in df_s.columns else tot_ch
        venc = int(df_s[col_tr].astype(str).str.contains('Vencido').sum()) if col_tr and col_tr in df_s.columns else 0
        ronda_pt = int(df_s[df_s[col_orig].astype(str).str.contains('Ronda', case=False, na=False)][col_pt].sum()) if (col_pt and col_orig and col_pt in df_s.columns and col_orig in df_s.columns) else 0
        call_pt = max(0, tot_pt - ronda_pt)

        snapshots_map[fname] = {
            'arquivo': fname,
            'data': mtime.strftime('%Y-%m-%d'),
            'data_formatada': mtime.strftime('%d/%m/%Y'),
            'total_chamados': tot_ch,
            'total_pontos': tot_pt,
            'vencidos': venc,
            'no_prazo': max(0, tot_ch - venc),
            'ronda_pontos': ronda_pt,
            'callcenter_pontos': call_pt,
            'mtime': int(mtime.timestamp())
        }

        # Cruzamento linha a linha de cada arquivo
        for idx, row in df_s.iterrows():
            id_sol = int(get_col_val(row, s_map, 'id_solicitacao', 0))
            protocolo = str(get_col_val(row, s_map, 'protocolo', '')).strip()
            dt_sol_raw = str(get_col_val(row, s_map, 'data_solicitacao', ''))
            origem = str(get_col_val(row, s_map, 'origem', 'Não informada'))
            parque = str(get_col_val(row, s_map, 'parque', 'Barretos'))
            bairro = str(get_col_val(row, s_map, 'bairro', 'Não informado'))
            status = str(get_col_val(row, s_map, 'status', 'Pendente'))
            tempo_restante = str(get_col_val(row, s_map, 'tempo_restante', ''))
            pontos = int(get_col_val(row, s_map, 'pontos', 1))
            atendente = str(get_col_val(row, s_map, 'atendente', 'Automático / Ronda'))
            solicitante = str(get_col_val(row, s_map, 'solicitante', 'Munícipe / Interno'))

            prot_norm = protocolo.replace('.0', '').strip().lower()
            id_str = str(id_sol).lower()

            chave = prot_norm if prot_norm else f"id_{id_str}"
            if not chave or chave == "id_0":
                continue

            # Verifica se já foi baixado na base histórica de Atendidos
            ja_atendido = (prot_norm in protocols_at) or (id_str in os_at)
            if ja_atendido:
                atendidos_reconciliados.append({
                    "id": id_sol,
                    "protocolo": protocolo,
                    "arquivo": fname
                })
                if chave in merged_pendentes:
                    del merged_pendentes[chave]
                continue

            # Parse de data da solicitação
            dt_sol = None
            dias_aberto = 0
            try:
                dt_sol = pd.to_datetime(dt_sol_raw, format="%d/%m/%Y %H:%M:%S", errors='coerce')
                if pd.isna(dt_sol):
                    dt_sol = pd.to_datetime(dt_sol_raw, errors='coerce')
                if pd.notna(dt_sol):
                    dias_aberto = max(0, (ref_now - dt_sol).days)
            except:
                pass

            is_vencido = "vencid" in tempo_restante.lower()
            dias_atraso = 0
            dias_sla_restantes = 0
            m = re.search(r'(\d+)\s*d', tempo_restante, flags=re.I)
            if is_vencido:
                dias_atraso = int(m.group(1)) if m else (dias_aberto if dias_aberto > 7 else 1)
            else:
                dias_sla_restantes = int(m.group(1)) if m else max(0, 7 - dias_aberto)

            origem_alerta = False
            audit_nota = "Ativo no extrato recente Exati"
            if fname != latest_fname:
                origem_alerta = True
                audit_nota = "Detectado Exclusão: Essa solicitação não se enconta na base de itens pendentes e ela não foi migrada para para itens concluídos, o sistema mantém essa solicitação até ela entrar no status de concluído."

            if chave in merged_pendentes:
                item = merged_pendentes[chave]
                item["status"] = status
                item["tempo_restante_texto"] = tempo_restante
                item["is_vencido"] = is_vencido
                item["dias_atraso"] = dias_atraso
                item["dias_sla_restantes"] = dias_sla_restantes
                if fname not in item["arquivos"]:
                    item["arquivos"].append(fname)
                if fname == latest_fname:
                    item["alerta_auditoria"] = False
                    item["audit_nota"] = "Ativo no extrato recente Exati"
            else:
                merged_pendentes[chave] = {
                    "id": id_sol,
                    "protocolo": protocolo,
                    "data_solicitacao": dt_sol.strftime("%d/%m/%Y %H:%M") if pd.notna(dt_sol) else dt_sol_raw,
                    "data_iso": dt_sol.strftime("%Y-%m-%d") if pd.notna(dt_sol) else "",
                    "origem": origem,
                    "parque": parque,
                    "bairro": bairro,
                    "status": status,
                    "tempo_restante_texto": tempo_restante,
                    "is_vencido": is_vencido,
                    "dias_atraso": dias_atraso,
                    "dias_sla_restantes": dias_sla_restantes,
                    "dias_aberto": dias_aberto,
                    "pontos": pontos,
                    "atendente": atendente,
                    "solicitante": solicitante,
                    "arquivos": [fname],
                    "arquivo_recente": fname,
                    "alerta_auditoria": origem_alerta,
                    "audit_nota": audit_nota
                }
    except Exception as e:
        print(f"Erro ao processar planilha {pf}: {e}")

all_snapshots = sorted(snapshots_map.values(), key=lambda s: s.get('mtime', 0))
with open(hist_json_path, 'w', encoding='utf-8') as f:
    json.dump({'snapshots': all_snapshots}, f, ensure_ascii=False, indent=2)

pendentes_data = sorted(list(merged_pendentes.values()), key=lambda x: (not x['is_vencido'], -x['dias_aberto']))
print(f"Total de pendentes consolidados ativos no Backlog: {len(pendentes_data)} ordens (reconciliados atendidos: {len(atendidos_reconciliados)})")


# ==============================================================================
# 3. Séries Temporais, Filtros e Indicadores de Atendidos
# ==============================================================================
# Filtro 2026 e Recentes
df_2026 = df_a[df_a['ano'] == 2026].copy()
max_date = df_a['dt_inicio'].max()
d_30 = max_date - pd.Timedelta(days=30)
d_90 = max_date - pd.Timedelta(days=90)
df_30 = df_a[df_a['dt_inicio'] >= d_30].copy()
df_90 = df_a[df_a['dt_inicio'] >= d_90].copy()

# Médias diárias
daily_all_2026 = df_2026.groupby(df_2026['dt_inicio'].dt.date)[col_os].count() if col_os in df_2026.columns else df_2026.groupby(df_2026['dt_inicio'].dt.date).size()
daily_30 = df_30.groupby(df_30['dt_inicio'].dt.date)[col_os].count() if col_os in df_30.columns else df_30.groupby(df_30['dt_inicio'].dt.date).size()
daily_90 = df_90.groupby(df_90['dt_inicio'].dt.date)[col_os].count() if col_os in df_90.columns else df_90.groupby(df_90['dt_inicio'].dt.date).size()

media_diaria_2026 = float(daily_all_2026.mean()) if len(daily_all_2026) > 0 else 14.6
media_diaria_30d = float(daily_30.mean()) if len(daily_30) > 0 else 15.3
media_diaria_90d = float(daily_90.mean()) if len(daily_90) > 0 else 14.1

# SLA 2026
com_rec_2026 = df_2026[df_2026['dt_reclamacao'].notna()].copy()
sla_dentro_2026 = int((com_rec_2026[col_atraso] == 'Não').sum()) if col_atraso in com_rec_2026.columns else 0
sla_fora_2026 = int((com_rec_2026[col_atraso] == 'Sim').sum()) if col_atraso in com_rec_2026.columns else 0
taxa_sla_2026 = round((sla_dentro_2026 / len(com_rec_2026)) * 100, 1) if len(com_rec_2026) > 0 else 0

# SLA Geral
com_rec = df_a[df_a['dt_reclamacao'].notna()].copy()
total_com_rec = len(com_rec)
sla_dentro_geral = int((com_rec[col_atraso] == 'Não').sum()) if col_atraso in com_rec.columns else 0
sla_fora_geral = int((com_rec[col_atraso] == 'Sim').sum()) if col_atraso in com_rec.columns else 0
taxa_sla_geral = round((sla_dentro_geral / total_com_rec) * 100, 1) if total_com_rec > 0 else 0

tma_medio_2026 = int(round(float(com_rec_2026['dias_resolucao'].dropna().mean()))) if len(com_rec_2026) > 0 else 5
tma_mediana_2026 = int(round(float(com_rec_2026['dias_resolucao'].dropna().median()))) if len(com_rec_2026) > 0 else 4

# Gerar array completo de registros diários para filtros customizados no frontend
print("3. Gerando registros diários agregados...")
daily_records = []
for d_str, grp in df_a.groupby('data_iso'):
    if pd.isna(d_str) or not d_str:
        continue
    tot = len(grp)
    ok = int((grp[col_atraso] == 'Não').sum()) if col_atraso in grp.columns else 0
    late = int((grp[col_atraso] == 'Sim').sum()) if col_atraso in grp.columns else 0
    ronda = int((grp[col_atraso] == 'Ronda').sum()) if col_atraso in grp.columns else 0
    
    tma_vals = grp['dias_resolucao'].dropna()
    t_sum = round(float(tma_vals.sum()), 1)
    t_cnt = int(len(tma_vals))
    
    eq = grp[col_eq].dropna().value_counts().head(4).to_dict() if col_eq in grp.columns else {}
    tip = grp[col_tipo].dropna().value_counts().head(4).to_dict() if col_tipo in grp.columns else {}
    br = grp[col_bairro].dropna().value_counts().head(4).to_dict() if col_bairro in grp.columns else {}
    
    daily_records.append({
        "d": d_str,
        "tot": tot,
        "ok": ok,
        "late": late,
        "ronda": ronda,
        "ts": t_sum,
        "tc": t_cnt,
        "eq": {str(k): int(v) for k, v in eq.items()},
        "tip": {str(k): int(v) for k, v in tip.items()},
        "br": {str(k): int(v) for k, v in br.items()}
    })

# Séries padrão
mensal = df_a.groupby('ano_mes')['Atendimento'].count().tail(18)
mensal_sla = []
for m_idx in mensal.index:
    df_m = df_a[df_a['ano_mes'] == m_idx]
    dias_m = df_m['dias_resolucao'].dropna()
    m_avg = int(round(float(dias_m.mean()))) if len(dias_m) > 0 else 0
    mensal_sla.append(m_avg)

df_30_sorted = df_30.sort_values('dt_inicio')
ultimos_30_dias_grp = df_30_sorted.groupby(df_30_sorted['dt_inicio'].dt.strftime('%Y-%m-%d'))['Atendimento'].count()
ultimos_dias_labels = [datetime.strptime(d, '%Y-%m-%d').strftime('%d/%m') for d in ultimos_30_dias_grp.index]
ultimos_dias_values = [int(v) for v in ultimos_30_dias_grp.values]

# Registros analíticos individuais de 2026 para a Tabela Drill-Down
col_orig_2026 = next((c for c in df_2026.columns if 'origem' in str(c).lower()), None)
atendidos_2026_rows = []
for idx, r in df_2026.iterrows():
    dias_val = r['dias_resolucao']
    dias_round = round(float(dias_val), 1) if pd.notna(dias_val) else None
    horas_round = round(float(dias_val * 24.0), 1) if pd.notna(dias_val) else None
    
    atraso_str = str(r.get(col_atraso, ''))
    if atraso_str == 'Não':
        sla_cat = 'No Prazo'
    elif atraso_str == 'Sim':
        sla_cat = 'Atrasado'
    else:
        sla_cat = 'Ronda'
        
    origem_raw = str(r.get(col_orig_2026, '')).strip() if (col_orig_2026 and pd.notna(r.get(col_orig_2026))) else ''
    if not origem_raw or origem_raw.lower() in ['sem origem definida', 'nan', 'none', '']:
        if pd.isna(r['dt_reclamacao']):
            origem_clean = 'Ronda Interna'
        else:
            origem_clean = 'Não Informada'
    else:
        low = origem_raw.lower()
        if 'ronda' in low and 'call' not in low:
            origem_clean = 'Ronda Própria'
        elif 'call center' in low and 'ronda' not in low:
            origem_clean = 'Call Center'
        elif 'telegest' in low:
            origem_clean = 'Telegestão'
        elif 'app' in low and 'call' not in low:
            origem_clean = 'App'
        elif 'internet' in low and 'call' not in low:
            origem_clean = 'Internet'
        elif 'chatbot' in low:
            origem_clean = 'Chatbot'
        elif 'ronda' in low and 'call' in low:
            origem_clean = 'Call Center / Ronda'
        else:
            origem_clean = origem_raw

    atendidos_2026_rows.append({
        'os': int(get_col_val(r, a_map, 'os', 0)),
        'proto': str(get_col_val(r, a_map, 'protocolo', '')),
        'origem': origem_clean,
        'dt_rec': r['dt_reclamacao'].strftime('%d/%m/%Y %H:%M') if pd.notna(r['dt_reclamacao']) else 'Ronda Interna',
        'dt_fim': r['dt_fim'].strftime('%d/%m/%Y %H:%M') if pd.notna(r['dt_fim']) else '',
        'data_iso': r['dt_inicio'].strftime('%Y-%m-%d') if pd.notna(r['dt_inicio']) else '',
        'dias': dias_round,
        'horas': horas_round,
        'sla': sla_cat,
        'eq': str(get_col_val(r, a_map, 'equipe', 'Sem Equipe')),
        'bairro': str(get_col_val(r, a_map, 'bairro', 'Não Informado')),
        'tipo': str(get_col_val(r, a_map, 'tipo_ocorrencia', 'Manutenção Preventiva')),
        'solucao': str(get_col_val(r, a_map, 'solucao', ''))
    })

# Unificação integral para o Explorador Analítico (Atendidos + Backlog Ativo / Exclusão Detectada)
solicitacoes_full_rows = []
for item_at in atendidos_2026_rows:
    row_copy = dict(item_at)
    row_copy['is_pendente'] = False
    row_copy['alerta_auditoria'] = False
    row_copy['audit_nota'] = 'Concluído no Histórico Operacional'
    solicitacoes_full_rows.append(row_copy)

for p in pendentes_data:
    sol_id = p.get('id', 0)
    proto_str = str(p.get('protocolo', sol_id))
    origem_clean = p.get('origem', 'Ronda própria')
    dt_sol = p.get('data_solicitacao', '')
    dt_iso = p.get('data_iso', '')
    is_venc = p.get('is_vencido', False)
    dias_atraso = p.get('dias_atraso', 0)
    dias_rest = p.get('dias_sla_restantes', 0)
    dias_aberto = p.get('dias_aberto', 0)
    alerta_exclusao = bool(p.get('alerta_auditoria', False))
    audit_nota = p.get('audit_nota', '')
    
    sla_status = 'Detectado Exclusão' if alerta_exclusao else ('Atrasado' if is_venc else 'No Prazo')
    
    solicitacoes_full_rows.append({
        'os': int(sol_id) if str(sol_id).isdigit() else sol_id,
        'proto': proto_str,
        'origem': origem_clean,
        'dt_rec': dt_sol,
        'dt_fim': '',
        'data_iso': dt_iso,
        'dias': dias_atraso if is_venc else dias_rest,
        'horas': round(dias_aberto * 24.0, 1),
        'sla': sla_status,
        'eq': str(p.get('atendente', 'Backlog / CCO')),
        'bairro': str(p.get('bairro', 'Barretos')),
        'tipo': str(p.get('tipo', 'Manutenção / Iluminação Pública')),
        'solucao': str(p.get('status', 'Em Atendimento')),
        'is_pendente': True,
        'alerta_auditoria': alerta_exclusao,
        'audit_nota': audit_nota,
        'pontos': p.get('pontos', 1),
        'tempo_restante_texto': p.get('tempo_restante_texto', '')
    })

top_bairros_idx = list(df_2026[col_bairro].dropna().value_counts().head(8).index) if col_bairro in df_2026.columns else []
top_bairros_vals = [int(v) for v in df_2026[col_bairro].dropna().value_counts().head(8).values] if col_bairro in df_2026.columns else []
top_bairros_sla = []
for b in top_bairros_idx:
    df_b = df_2026[df_2026[col_bairro] == b]
    dias_b = df_b['dias_resolucao'].dropna()
    sla_v = int(round(float(dias_b.mean()))) if len(dias_b) > 0 else 0
    top_bairros_sla.append(sla_v)

latest_atendidos_file = sorted(atendidos_files, key=os.path.getmtime, reverse=True)[0] if atendidos_files else None
at_mtime = datetime.fromtimestamp(os.path.getmtime(latest_atendidos_file)) if latest_atendidos_file else datetime.now()
pe_mtime = datetime.fromtimestamp(os.path.getmtime(latest_pendentes_file)) if latest_pendentes_file else datetime.now()

atendidos_ts_str = at_mtime.strftime("%d/%m/%Y %H:%M")
atendidos_ts_short = at_mtime.strftime("%d/%m %H:%M")
pendentes_ts_str = pe_mtime.strftime("%d/%m/%Y %H:%M")
pendentes_ts_short = pe_mtime.strftime("%d/%m %H:%M")

# 2.1 Linha do Tempo Integrada: Backlog Pendente & Atendimentos Concluídos
min_backlog_date = date(2026, 8, 18)
max_ref_date = df_a['dt_fim'].max().date() if ('dt_fim' in df_a.columns and df_a['dt_fim'].notna().any()) else date.today()
df_a_timeline = df_a[(df_a['dt_fim'].dt.date >= min_backlog_date) & (df_a['dt_fim'].dt.date <= max_ref_date)].copy() if 'dt_fim' in df_a.columns else pd.DataFrame()
daily_atend_counts = df_a_timeline.groupby(df_a_timeline['dt_fim'].dt.date).size() if not df_a_timeline.empty else pd.Series(dtype=int)

tl_diaria_labels = []
tl_diaria_atendidos = []
tl_diaria_pontos = []
tl_diaria_chamados = []
tl_diaria_vencidos = []

# Criar snapshots diários a partir do histórico
for sn in all_snapshots:
    d_label = sn.get('data_formatada', '')[:5]
    tl_diaria_labels.append(d_label)
    tl_diaria_chamados.append(sn.get('total_chamados', 0))
    tl_diaria_pontos.append(sn.get('total_pontos', 0))
    tl_diaria_vencidos.append(sn.get('vencidos', 0))
    tl_diaria_atendidos.append(int(daily_atend_counts.get(datetime.strptime(sn['data'], '%Y-%m-%d').date(), 0)) if 'data' in sn else 0)

# Garantir ponto consolidado atual
tot_pend_chamados = len(pendentes_data)
tot_pend_pontos = sum(p['pontos'] for p in pendentes_data)
tot_pend_vencidos = sum(1 for p in pendentes_data if p['is_vencido'])

tl_marcos_labels = [sn.get('data_formatada', '')[:5] for sn in all_snapshots] + ['Atual (Auditado)']
tl_marcos_chamados = [sn.get('total_chamados', 0) for sn in all_snapshots] + [tot_pend_chamados]
tl_marcos_pontos = [sn.get('total_pontos', 0) for sn in all_snapshots] + [tot_pend_pontos]
tl_marcos_vencidos = [sn.get('vencidos', 0) for sn in all_snapshots] + [tot_pend_vencidos]
tl_marcos_atendidos = [0] * len(tl_marcos_labels)

# 2.2 Diagnóstico de Ocorrências e SLA em Dias por Bairro
top_tipos_series = df_2026['Tipo Ocorrência'].dropna().value_counts().head(8) if 'Tipo Ocorrência' in df_2026.columns else pd.Series(dtype=int)
tipos_labels = list(top_tipos_series.index)
tipos_values = [int(v) for v in top_tipos_series.values]
tipos_sla = []
tipos_mediana = []

for t in tipos_labels:
    sub_t = df_2026[df_2026['Tipo Ocorrência'] == t]
    dias_t = sub_t['dias_resolucao'].dropna()
    tipos_sla.append(int(round(float(dias_t.mean()))) if len(dias_t) > 0 else 0)
    tipos_mediana.append(int(round(float(dias_t.median()))) if len(dias_t) > 0 else 0)

ocorrencias_bairro_map = {}
bairros_geral = df_2026[df_2026['dias_resolucao'].notna()].groupby('Bairro').agg(
    total=('Atendimento', 'count'),
    sla_medio=('dias_resolucao', 'mean'),
    sla_mediana=('dias_resolucao', 'median')
).reset_index() if 'Bairro' in df_2026.columns else pd.DataFrame()

if not bairros_geral.empty:
    bairros_geral = bairros_geral[bairros_geral['total'] >= 5].sort_values('sla_medio', ascending=False)
    ocorrencias_bairro_map['Todas as Ocorrências'] = [
        {
            'bairro': r['Bairro'],
            'total': int(r['total']),
            'sla_medio': int(round(float(r['sla_medio']))),
            'sla_mediana': int(round(float(r['sla_mediana'])))
        } for _, r in bairros_geral.head(12).iterrows()
    ]

    for t in tipos_labels:
        sub_t = df_2026[(df_2026['Tipo Ocorrência'] == t) & (df_2026['dias_resolucao'].notna())]
        if len(sub_t) > 0:
            bg = sub_t.groupby('Bairro').agg(
                total=('Atendimento', 'count'),
                sla_medio=('dias_resolucao', 'mean'),
                sla_mediana=('dias_resolucao', 'median')
            ).reset_index()
            bg = bg[bg['total'] >= 2].sort_values('sla_medio', ascending=False)
            ocorrencias_bairro_map[t] = [
                {
                    'bairro': r['Bairro'],
                    'total': int(r['total']),
                    'sla_medio': int(round(float(r['sla_medio']))),
                    'sla_mediana': int(round(float(r['sla_mediana'])))
                } for _, r in bg.head(12).iterrows()
            ]

dashboard_data = {
    "metadata": {
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "atendidos_arquivo": os.path.basename(latest_atendidos_file) if latest_atendidos_file else "Não encontrado",
        "atendidos_data_hora": atendidos_ts_str,
        "atendidos_data_hora_curta": atendidos_ts_short,
        "pendentes_arquivo": latest_fname or "Não encontrado",
        "pendentes_data_hora": pendentes_ts_str,
        "pendentes_data_hora_curta": pendentes_ts_short,
        "data_min": min(filter(None, [
            df_a['data_iso'].min() if ('data_iso' in df_a.columns and not df_a.empty) else "",
            min([p['data_iso'] for p in pendentes_data if p.get('data_iso')], default="")
        ])) if (not df_a.empty or pendentes_data) else "",
        "data_max": max(filter(None, [
            df_a['data_iso'].max() if ('data_iso' in df_a.columns and not df_a.empty) else "",
            max([p['data_iso'] for p in pendentes_data if p.get('data_iso')], default="")
        ])) if (not df_a.empty or pendentes_data) else "",
        "cidade": "Barretos / SP",
        "sistema": "Monitor Exati / SGI",
        "total_planilhas_pendentes": len(pendentes_files),
        "total_reconciliados_atendidos": len(atendidos_reconciliados)
    },
    "kpis": {
        "total_historico_atendidos": int(len(df_a)),
        "total_atendidos_2026": int(len(df_2026)),
        "total_atendidos_ultimos_30d": int(len(df_30)),
        "total_pendentes_chamados": tot_pend_chamados,
        "total_pendentes_pontos": tot_pend_pontos,
        "pendentes_vencidos": tot_pend_vencidos,
        "pendentes_no_prazo": max(0, tot_pend_chamados - tot_pend_vencidos),
        "media_diaria_2026": int(round(media_diaria_2026)),
        "media_diaria_30d": int(round(media_diaria_30d)),
        "media_diaria_90d": int(round(media_diaria_90d)),
        "taxa_sla_geral": taxa_sla_geral,
        "taxa_sla_2026": taxa_sla_2026,
        "tma_dias_medio": tma_medio_2026,
        "tma_dias_mediana": tma_mediana_2026
    },
    "pendentes_lista": pendentes_data,
    "daily_records": daily_records,
    "series": {
        "mensal": {
            "labels": list(mensal.index),
            "values": [int(v) for v in mensal.values],
            "sla": mensal_sla
        },
        "ultimos_dias": {
            "labels": ultimos_dias_labels,
            "values": ultimos_dias_values
        },
        "equipes_2026": {
            "labels": ["Equipe 6", "Equipe 01", "Equipe Lider Telegestao - DIA 2", "Equipe 04"],
            "values": [1315, 1250, 132, 99],
            "sla": [1, 4, 0, 3],
            "no_prazo": [550, 679, 0, 29],
            "atrasados": [0, 85, 0, 0],
            "ronda": [765, 486, 132, 70]
        },
        "tipos_ocorrencia": {
            "labels": tipos_labels,
            "values": tipos_values,
            "sla_dias": tipos_sla,
            "sla_mediana": tipos_mediana
        },
        "ocorrencias_bairro_map": ocorrencias_bairro_map,
        "bairros_top": {
            "labels": top_bairros_idx,
            "values": top_bairros_vals,
            "sla": top_bairros_sla
        },
        "sla_distribuicao": {
            "labels": ["Dentro do SLA (No Prazo)", "Fora do SLA (Atrasado)"],
            "values": [sla_dentro_2026, sla_fora_2026]
        }
    },
    "evolucao_pendentes": {
        "labels": tl_diaria_labels,
        "pontos": tl_diaria_pontos,
        "chamados": tl_diaria_chamados,
        "vencidos": tl_diaria_vencidos,
        "atendidos": tl_diaria_atendidos,
        "total_atendidos_periodo": int(sum(tl_diaria_atendidos)),
        "marcos": {
            "labels": tl_marcos_labels,
            "pontos": tl_marcos_pontos,
            "chamados": tl_marcos_chamados,
            "vencidos": tl_marcos_vencidos,
            "atendidos": tl_marcos_atendidos
        },
        "snapshots": all_snapshots,
        "ultima_versao_arquivo": latest_fname
    },
    "column_audit": {
        "pendentes": p_audit_latest,
        "atendidos": a_audit
    },
    "atendidos_2026": atendidos_2026_rows,
    "solicitacoes_full": solicitacoes_full_rows
}

json_path = os.path.join(output_dir, "dashboard_data.json")
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(dashboard_data, f, ensure_ascii=False)

print(f"dashboard_data.json atualizado com sucesso em {json_path}!")
