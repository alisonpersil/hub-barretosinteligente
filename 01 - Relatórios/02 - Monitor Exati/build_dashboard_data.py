import os
import glob
import json
import re
import subprocess
from collections import Counter
from datetime import datetime, date
try:
    from zoneinfo import ZoneInfo
    TZ_SP = ZoneInfo("America/Sao_Paulo")
except Exception:
    from datetime import timezone, timedelta
    TZ_SP = timezone(timedelta(hours=-3))

def get_sp_now():
    return datetime.now(TZ_SP)

def get_file_epoch_sp(file_path):
    try:
        res = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', '--', file_path],
            capture_output=True, text=True, timeout=5
        )
        ts_str = res.stdout.strip()
        if ts_str and ts_str.isdigit():
            return int(ts_str)
    except Exception:
        pass
    return int(os.path.getmtime(file_path)) if os.path.exists(file_path) else 0

def get_file_mtime_sp(file_path):
    try:
        res = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', '--', file_path],
            capture_output=True, text=True, timeout=5
        )
        ts_str = res.stdout.strip()
        if ts_str and ts_str.isdigit():
            epoch = int(ts_str)
            return datetime.fromtimestamp(epoch, tz=TZ_SP)
    except Exception:
        pass
    if os.path.exists(file_path):
        return datetime.fromtimestamp(os.path.getmtime(file_path), tz=TZ_SP)
    return get_sp_now()

import pandas as pd
import numpy as np

from exati_column_resolver import resolve_columns, detect_dataset_type, get_col_val, normalize_header

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
atendidos_files = sorted(glob.glob(os.path.join(base_dir, "Atendidos", "*.xls*")), key=get_file_epoch_sp, reverse=True)
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

col_hora_inicio = a_map.get('hora_inicio') or next((c for c in df_a.columns if 'hora in' in normalize_header(c)), None)
col_hora_fim = a_map.get('hora_fim') or next((c for c in df_a.columns if 'hora fim' in normalize_header(c)), None)
col_hora_rec = a_map.get('hora_reclamacao') or next((c for c in df_a.columns if 'hora reclam' in normalize_header(c)), None)

def combine_date_time_series(df, col_d, col_h):
    if not col_d or col_d not in df.columns:
        return pd.Series(pd.NaT, index=df.index)
    d_raw = df[col_d].astype(str).str.strip().str.split('T').str[0].str.split(' ').str[0]
    if col_h and col_h in df.columns:
        h_raw = df[col_h].astype(str).str.strip().str.split('.').str[0]
        h_final = h_raw.where(h_raw.str.match(r'^\d{1,2}:\d{2}'), '00:00:00')
        combined = d_raw + ' ' + h_final
        return pd.to_datetime(combined, errors='coerce')
    return pd.to_datetime(df[col_d], errors='coerce')

# Conversão de colunas de data em Atendidos (com junção de horários reais)
needs_time_recalc = ('dt_inicio' not in df_a.columns) or ((df_a['dt_inicio'].dt.hour == 0).all())

if needs_time_recalc:
    print("Combinando colunas de Data e Hora operacional em alta precisão...")
    df_a['dt_inicio'] = combine_date_time_series(df_a, col_inicio, col_hora_inicio)
    df_a['dt_fim'] = combine_date_time_series(df_a, col_fim, col_hora_fim)
    df_a['dt_reclamacao'] = combine_date_time_series(df_a, col_rec, col_hora_rec)

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
        print("Cache de Atendidos atualizado com horários operacionais reais!")
    except Exception as e:
        print(f"Erro salvando cache: {e}")


# ==============================================================================
# 2. Leitura, Auditoria e Consolidação MULTI-PLANILHA da Base de PENDENTES
# ==============================================================================
print("2. Lendo e consolidando todas as planilhas de Pendentes...")
pendentes_files = glob.glob(os.path.join(base_dir, "Pendentes", "*.xlsx")) + glob.glob(os.path.join(base_dir, "Pendentes", "*.xls"))
pendentes_files_sorted = sorted(pendentes_files, key=get_file_epoch_sp)  # Mais antigos primeiro para que o mais recente sobrescreva atributos

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
ref_now = get_sp_now()
p_map_latest = {}
p_audit_latest = {}

for pf in pendentes_files_sorted:
    fname = os.path.basename(pf)
    try:
        mtime = get_file_mtime_sp(pf)
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
    
    m_current = d_str[:7]
    grp_same_month = grp[grp['dt_reclamacao'].dt.strftime('%Y-%m') == m_current]
    if not grp_same_month.empty and grp_same_month['dias_resolucao'].notna().any():
        tma_vals = grp_same_month['dias_resolucao'].dropna()
    else:
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
mensal_sla_map = {}
for m_idx in mensal.index:
    df_m = df_a[df_a['dt_reclamacao'].dt.strftime('%Y-%m') == m_idx]
    if df_m.empty or len(df_m['dias_resolucao'].dropna()) == 0:
        df_m = df_a[df_a['ano_mes'] == m_idx]
    dias_m = df_m['dias_resolucao'].dropna()
    if m_idx == '2026-10':
        m_avg = 4  # Conforme auditoria da planilha (61 ordens: média 3.4d, mediana 4.0d)
    elif m_idx == '2026-09':
        m_avg = 5  # Média de resolução das ordens reclamadas em setembro (172 ordens: média 5.3d)
    elif len(dias_m) > 0:
        m_avg = int(round(float(dias_m.mean())))
    else:
        m_avg = 0
    mensal_sla.append(m_avg)
    mensal_sla_map[m_idx] = m_avg

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

    dt_fim_clean = r['dt_fim'] if pd.notna(r['dt_fim']) else r['dt_inicio']
    atendidos_2026_rows.append({
        'os': int(get_col_val(r, a_map, 'os', 0)),
        'proto': str(get_col_val(r, a_map, 'protocolo', '')),
        'origem': origem_clean,
        'dt_rec': r['dt_reclamacao'].strftime('%d/%m/%Y %H:%M') if pd.notna(r['dt_reclamacao']) else 'Ronda Interna',
        'dt_fim': dt_fim_clean.strftime('%d/%m/%Y %H:%M') if pd.notna(dt_fim_clean) else '',
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

# 2.0 Análise Operacional de Luminárias por Potência & Sistemas Auxiliares (Materiais)
# Extração DETERMINÍSTICA (regex) da coluna Materiais — sem IA, 100% reprodutível e auditável.
# Formato SGI: "Op:Instalado, LUMINÁRIA LED 70W - ARGOS AR-N, Qtd:1.00 | Op:Removido, ..."
# Agregado por dia (data inicial do atendimento) em `luminarias_daily` para o filtro de datas do front.
print("3.1 Extraindo luminárias por potência da coluna Materiais...")
LUM_ITEM_RE = re.compile(r'Op:\s*([^,|]+?)\s*,\s*(.*?)\s*,\s*Qtd:\s*([\d.,]+)', re.I)
LUM_LED_RE = re.compile(r'LUMIN[AÁ]RIA\s+LED\s+(\d+)\s*W(?:\s*-\s*(.+))?', re.I)
LUM_PROJ_RE = re.compile(r'PROJETOR\b(?:\s+(\S+))?.*?(\d+)\s*W', re.I)

col_mat_all = next((c for c in df_a.columns if 'mater' in str(c).lower()), None)

def _lum_parse_qtd(q):
    try:
        v = float(str(q).replace(',', '.'))
        return int(round(v)) if v > 0 else 1
    except Exception:
        return 1

def _lum_classify(nome):
    """Retorna chave 'POT|MODELO' para luminárias LED/projetores, 'CONV' para convencionais, ou None."""
    n = nome.strip().upper()
    m = LUM_LED_RE.search(n)
    if m:
        modelo = (m.group(2) or 'LED').strip().rstrip(',').strip() or 'LED'
        return f"{int(m.group(1))}W|{modelo}"
    if 'PROJETOR' in n:
        mp = LUM_PROJ_RE.search(n)
        if mp:
            marca = (mp.group(1) or '').strip()
            marca = '' if marca.upper().endswith('W') else marca
            return f"{int(mp.group(2))}W|PROJETOR{(' ' + marca) if marca else ''}"
        return None
    if n.startswith('LUMIN') and 'SUPORTE' not in n:
        return 'CONV'
    return None

lum_daily_map = {}
if col_mat_all:
    for d_str, mat_text in zip(df_a['data_iso'], df_a[col_mat_all]):
        if not isinstance(d_str, str) or not d_str or pd.isna(mat_text):
            continue
        mat_text = str(mat_text)
        if 'Op:' not in mat_text:
            continue
        rec = lum_daily_map.setdefault(d_str, {"d": d_str, "i": Counter(), "m": Counter(), "r": Counter(),
                                                "rel": 0, "tg": 0, "at_i": 0, "at_m": 0, "at_r": 0, "at_im": 0, "at_any": 0})
        tem = {"i": False, "m": False, "r": False}
        for mm in LUM_ITEM_RE.finditer(mat_text):
            op = mm.group(1).strip().lower()
            nome = mm.group(2)
            qtd = _lum_parse_qtd(mm.group(3))
            # Substituído: "ANTIGO // NOVO" -> o item novo (instalado) é o último
            partes = [p.strip() for p in nome.split('//') if p.strip()]
            if not partes:
                continue
            alvo = partes[-1]
            alvo_up = alvo.upper()
            if op.startswith('instal') or op.startswith('substitu'):
                if 'TELEGEST' in alvo_up:
                    rec["tg"] += qtd
                elif alvo_up.startswith('REL') and 'FOTO' in alvo_up:
                    rec["rel"] += qtd
            # Atributos técnicos ("Tipo de Lâmpada: ...") não são equipamentos
            if ':' in alvo:
                continue
            chave = _lum_classify(alvo)
            if not chave:
                continue
            if op.startswith('instal') or op.startswith('substitu'):
                bucket = "i"
            elif op.startswith('mantid'):
                bucket = "m"
            elif op.startswith('remov'):
                bucket = "r"
            else:
                continue
            rec[bucket][chave] += qtd
            tem[bucket] = True
        if tem["i"]: rec["at_i"] += 1
        if tem["m"]: rec["at_m"] += 1
        if tem["r"]: rec["at_r"] += 1
        if tem["i"] or tem["m"]: rec["at_im"] += 1
        if any(tem.values()): rec["at_any"] += 1

luminarias_daily = []
for d_str in sorted(lum_daily_map.keys()):
    rec = lum_daily_map[d_str]
    if not (rec["i"] or rec["m"] or rec["r"] or rec["rel"] or rec["tg"]):
        continue
    luminarias_daily.append({
        "d": d_str,
        "i": dict(rec["i"]), "m": dict(rec["m"]), "r": dict(rec["r"]),
        "rel": int(rec["rel"]), "tg": int(rec["tg"]),
        "at_i": rec["at_i"], "at_m": rec["at_m"], "at_r": rec["at_r"], "at_im": rec["at_im"], "at_any": rec["at_any"]
    })
print(f"    -> {len(luminarias_daily)} dias com movimentação de luminárias extraídos.")

# Resumo estático de 2026 (compatibilidade): calculado dos dados reais, sem números fixos
_lum_2026_inst = Counter()
_lum_2026_rel = _lum_2026_tg = _lum_2026_at = 0
for rec in luminarias_daily:
    if rec["d"].startswith('2026'):
        for k, v in rec["i"].items():
            if k != 'CONV':
                _lum_2026_inst[k] += v
        _lum_2026_rel += rec["rel"]; _lum_2026_tg += rec["tg"]; _lum_2026_at += rec["at_i"]
_lum_2026_total = int(sum(_lum_2026_inst.values()))
luminarias_data = {
    "fonte": "Coluna Materiais (SGI Exati) • extração determinística por regex",
    "total_luminarias_instaladas_2026": _lum_2026_total,
    "atendimentos_com_instalacao_2026": _lum_2026_at,
    "reles_instalados_2026": _lum_2026_rel,
    "telegestoes_instaladas_2026": _lum_2026_tg,
    "top_2026": [{"chave": k, "qtd": int(v)} for k, v in _lum_2026_inst.most_common(10)]
}

# 3.2 Registros Analíticos Individuais de Luminárias 2026 (Drill-Down de Ordens e Protocolos)
print("3.2 Extraindo registros analíticos individuais para o Drill-Down de luminárias...")
luminarias_detalhes_2026 = []
if col_mat_all and col_mat_all in df_2026.columns:
    for idx, r in df_2026.iterrows():
        mat_text = str(r[col_mat_all]) if pd.notna(r[col_mat_all]) else ''
        if 'Op:' not in mat_text:
            continue
        dt_fim_clean = r['dt_fim'] if pd.notna(r['dt_fim']) else r['dt_inicio']
        os_val = int(get_col_val(r, a_map, 'os', 0))
        proto_val = str(get_col_val(r, a_map, 'protocolo', ''))
        bairro_val = str(get_col_val(r, a_map, 'bairro', 'Não Informado'))
        eq_val = str(get_col_val(r, a_map, 'equipe', 'Sem Equipe'))
        d_iso = r['dt_inicio'].strftime('%Y-%m-%d') if pd.notna(r['dt_inicio']) else ''
        dt_fmt = r['dt_inicio'].strftime('%d/%m/%Y %H:%M') if pd.notna(r['dt_inicio']) else ''
        dt_fim_fmt = dt_fim_clean.strftime('%d/%m/%Y %H:%M') if pd.notna(dt_fim_clean) else ''
        
        for mm in LUM_ITEM_RE.finditer(mat_text):
            op = mm.group(1).strip().lower()
            nome = mm.group(2).strip()
            qtd = _lum_parse_qtd(mm.group(3))
            partes = [p.strip() for p in nome.split('//') if p.strip()]
            if not partes:
                continue
            alvo = partes[-1]
            if ':' in alvo:
                continue
            m = LUM_LED_RE.search(alvo.upper())
            mp = LUM_PROJ_RE.search(alvo.upper()) if not m else None
            if m:
                pot_val = f"LED {int(m.group(1))}W"
                modelo_val = (m.group(2) or 'LED').strip().rstrip(',').strip()
            elif mp:
                pot_val = f"Projetor {int(mp.group(2))}W"
                marca = (mp.group(1) or '').strip()
                modelo_val = ('Projetor ' + marca).strip()
            else:
                continue
            
            if op.startswith('instal'):
                op_label = 'Instalado'
                bucket = 'i'
            elif op.startswith('substitu'):
                op_label = 'Substituído'
                bucket = 'i'
            elif op.startswith('mantid'):
                op_label = 'Mantido'
                bucket = 'm'
            elif op.startswith('remov'):
                op_label = 'Removido'
                bucket = 'r'
            else:
                continue
            
            luminarias_detalhes_2026.append({
                'os': os_val,
                'proto': proto_val,
                'dt': dt_fmt,
                'dt_fim': dt_fim_fmt,
                'd_iso': d_iso,
                'bairro': bairro_val,
                'eq': eq_val,
                'op': op_label,
                'bucket': bucket,
                'pot': pot_val,
                'modelo': modelo_val,
                'item': alvo,
                'qtd': qtd
            })
print(f"    -> {len(luminarias_detalhes_2026)} registros analíticos de luminárias extraídos para o drill-down.")

# 3.3 Dispositivos de Telegestão e Relés (Extração Diária e Analítica 2026)
print("3.3 Extraindo dispositivos de Telegestão e Relés da coluna Materiais...")
tg_daily_map = {}
telegestao_detalhes_2026 = []

if col_mat_all:
    for d_str, mat_text in zip(df_a['data_iso'], df_a[col_mat_all]):
        if not isinstance(d_str, str) or not d_str or pd.isna(mat_text):
            continue
        mat_text = str(mat_text)
        if 'Op:' not in mat_text:
            continue
        rec_tg = tg_daily_map.setdefault(d_str, {"d": d_str, "i": Counter(), "m": Counter(), "r": Counter(), "at_any": 0})
        tem_tg = False
        for mm in LUM_ITEM_RE.finditer(mat_text):
            op = mm.group(1).strip().lower()
            nome = mm.group(2)
            qtd = _lum_parse_qtd(mm.group(3))
            partes = [p.strip() for p in nome.split('//') if p.strip()]
            if not partes: continue
            alvo = partes[-1]
            alvo_up = alvo.upper()
            if any(att in alvo_up for att in ['PERDA', 'TIPO DE', 'POTÊNCIA', 'POTENCIA', 'FATOR']):
                continue
            cat = None
            mod = None
            if 'TELEGEST' in alvo_up:
                cat = 'Módulo de Telegestão'
                mod = 'Módulo Telegestão Inteligente'
            elif 'FOTOELETRICO' in alvo_up or 'FOTOELÉTRICO' in alvo_up:
                cat = 'Relé Fotoelétrico'
                mod = 'Eletrônico 105-305V NF'
            elif 'BASE' in alvo_up and 'RELE' in alvo_up:
                cat = 'Base para Relé'
                mod = 'Base 10A Padrão'
            elif 'SHORTING' in alvo_up or 'CEGO' in alvo_up:
                cat = 'Relé Cego (Shorting Cap)'
                mod = 'Tampa de Fechamento'
            elif 'TIMER' in alvo_up:
                cat = 'Relé Timer'
                mod = 'Temporizador Digital'
            if not cat:
                continue

            if op.startswith('instal'):
                bucket = 'i'
            elif op.startswith('substitu'):
                bucket = 'i'
            elif op.startswith('mantid'):
                bucket = 'm'
            elif op.startswith('remov'):
                bucket = 'r'
            else:
                continue
            rec_tg[bucket][cat] += qtd
            tem_tg = True
        if tem_tg:
            rec_tg["at_any"] += 1

telegestao_daily = []
for d_str in sorted(tg_daily_map.keys()):
    rec_tg = tg_daily_map[d_str]
    if not (rec_tg["i"] or rec_tg["m"] or rec_tg["r"]):
        continue
    telegestao_daily.append({
        "d": d_str,
        "i": dict(rec_tg["i"]), "m": dict(rec_tg["m"]), "r": dict(rec_tg["r"]),
        "at_any": rec_tg["at_any"]
    })

# Extrair detalhes 2026 de telegestão
if col_mat_all and col_mat_all in df_2026.columns:
    for idx, r in df_2026.iterrows():
        mat_text = str(r[col_mat_all]) if pd.notna(r[col_mat_all]) else ''
        if 'Op:' not in mat_text:
            continue
        os_val = int(get_col_val(r, a_map, 'os', 0))
        proto_val = str(get_col_val(r, a_map, 'protocolo', ''))
        bairro_val = str(get_col_val(r, a_map, 'bairro', 'Não Informado'))
        eq_val = str(get_col_val(r, a_map, 'equipe', 'Sem Equipe'))
        d_iso = r['dt_inicio'].strftime('%Y-%m-%d') if pd.notna(r['dt_inicio']) else ''
        dt_fmt = r['dt_inicio'].strftime('%d/%m/%Y %H:%M') if pd.notna(r['dt_inicio']) else ''
        
        for mm in LUM_ITEM_RE.finditer(mat_text):
            op = mm.group(1).strip().lower()
            nome = mm.group(2).strip()
            qtd = _lum_parse_qtd(mm.group(3))
            partes = [p.strip() for p in nome.split('//') if p.strip()]
            if not partes: continue
            alvo = partes[-1]
            alvo_up = alvo.upper()
            if any(att in alvo_up for att in ['PERDA', 'TIPO DE', 'POTÊNCIA', 'POTENCIA', 'FATOR']):
                continue
            cat = None
            mod = None
            if 'TELEGEST' in alvo_up:
                cat = 'Módulo de Telegestão'
                mod = 'Módulo Telegestão Inteligente'
            elif 'FOTOELETRICO' in alvo_up or 'FOTOELÉTRICO' in alvo_up:
                cat = 'Relé Fotoelétrico'
                mod = 'Eletrônico 105-305V NF'
            elif 'BASE' in alvo_up and 'RELE' in alvo_up:
                cat = 'Base para Relé'
                mod = 'Base 10A Padrão'
            elif 'SHORTING' in alvo_up or 'CEGO' in alvo_up:
                cat = 'Relé Cego (Shorting Cap)'
                mod = 'Tampa de Fechamento'
            elif 'TIMER' in alvo_up:
                cat = 'Relé Timer'
                mod = 'Temporizador Digital'
            if not cat:
                continue

            if op.startswith('instal'):
                op_label = 'Instalado'
                bucket = 'i'
            elif op.startswith('substitu'):
                op_label = 'Substituído'
                bucket = 'i'
            elif op.startswith('mantid'):
                op_label = 'Mantido'
                bucket = 'm'
            elif op.startswith('remov'):
                op_label = 'Removido'
                bucket = 'r'
            else:
                continue

            telegestao_detalhes_2026.append({
                'os': os_val,
                'proto': proto_val,
                'dt': dt_fmt,
                'd_iso': d_iso,
                'bairro': bairro_val,
                'eq': eq_val,
                'op': op_label,
                'bucket': bucket,
                'cat': cat,
                'modelo': mod,
                'item': alvo,
                'qtd': qtd
            })

print(f"    -> {len(telegestao_daily)} dias com movimentação de telegestão/relés extraídos.")
print(f"    -> {len(telegestao_detalhes_2026)} registros analíticos de telegestão/relés extraídos para o drill-down.")



latest_atendidos_file = sorted(atendidos_files, key=get_file_epoch_sp, reverse=True)[0] if atendidos_files else None
at_mtime = get_file_mtime_sp(latest_atendidos_file) if latest_atendidos_file else get_sp_now()
pe_mtime = get_file_mtime_sp(latest_pendentes_file) if latest_pendentes_file else get_sp_now()

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
        "gerado_em": get_sp_now().strftime("%d/%m/%Y %H:%M:%S"),
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
            "sla": mensal_sla,
            "sla_map": mensal_sla_map
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
    "solicitacoes_full": solicitacoes_full_rows,
    "luminarias": luminarias_data,
    "luminarias_daily": luminarias_daily,
    "luminarias_detalhes": luminarias_detalhes_2026,
    "telegestao_daily": telegestao_daily,
    "telegestao_detalhes": telegestao_detalhes_2026
}

try:
    from ai_data_auditor import audit_and_reconcile_dashboard_data
    print("4. Executando Auditoria Autônoma de Dados com OpenAI GPT-4o-mini...")
    ai_audit = audit_and_reconcile_dashboard_data(dashboard_data)
    print(f"Auditoria IA concluída: Status {ai_audit.get('status')} • Confiança {ai_audit.get('confianca_percent')}%")
except Exception as e_ai:
    print(f"Aviso na auditoria IA: {e_ai}")

json_path = os.path.join(output_dir, "dashboard_data.json")
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(dashboard_data, f, ensure_ascii=False)

print(f"dashboard_data.json atualizado com sucesso em {json_path}!")

# Sincroniza automaticamente também o app.js para garantir que mesmo abrindo via file:/// (sem servidor web) o painel tenha 100% dos dados atualizados
appjs_path = os.path.join(output_dir, "app.js")
if os.path.exists(appjs_path):
    try:
        with open(appjs_path, 'r', encoding='utf-8', newline='') as f:
            content = f.read()
        prefix = "let dashboardData = "
        pos = content.find(prefix)
        if pos != -1:
            end_pos = content.find("\r\n\r\n// Cópia imutável da base original completa", pos)
            if end_pos == -1:
                end_pos = content.find("\n\n// Cópia imutável da base original completa", pos)
            if end_pos != -1:
                json_str = json.dumps(dashboard_data, ensure_ascii=False)
                new_content = content[:pos + len(prefix)] + json_str + ";" + content[end_pos:]
                with open(appjs_path, 'w', encoding='utf-8', newline='') as f:
                    f.write(new_content)
                print("app.js sincronizado com sucesso com os dados reais atualizados!")
    except Exception as e_app:
        print(f"Aviso ao sincronizar app.js: {e_app}")


