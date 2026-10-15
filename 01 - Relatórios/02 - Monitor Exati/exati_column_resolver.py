"""
Sistema Inteligente de Identificação e Resolução Dinâmica de Colunas do Exati
PMO - Barretos Inteligente

Este módulo garante resiliência total a:
1. Mudanças na ordem/posição física das colunas nas planilhas exportadas do Exati.
2. Variações ortográficas, maiúsculas/minúsculas, espaços e pontuações.
3. Corrupção de codificação de acentos (ex: 'Solicitao', 'Incio', 'Concluso', 'Ocorrncia').
4. Variações de termos de cabeçalho entre versões do Exati.
"""

import unicodedata
import re
from typing import Dict, List, Tuple, Optional, Any
import pandas as pd


def normalize_header(h: Any) -> str:
    """Normaliza qualquer cabeçalho de coluna removendo acentos, caracteres corrompidos e pontuação."""
    if h is None:
        return ""
    h = str(h).strip().lower()
    # Decompor caracteres acentuados
    h = unicodedata.normalize('NFKD', h)
    h = ''.join(c for c in h if not unicodedata.combining(c))
    # Tratar artefatos de encoding corrompidos comuns em exportações do Exati
    h = re.sub(r'solicita[\ufffd\?\_\s]*o', 'solicitacao', h, flags=re.I)
    h = re.sub(r'ocorren[\ufffd\?\_\s]*a', 'ocorrencia', h, flags=re.I)
    h = re.sub(r'munic[\ufffd\?\_\s]*pio', 'municipio', h, flags=re.I)
    h = re.sub(r'conclus[\ufffd\?\_\s]*o', 'conclusao', h, flags=re.I)
    h = re.sub(r'situa[\ufffd\?\_\s]*o', 'situacao', h, flags=re.I)
    h = re.sub(r'servi[\ufffd\?\_\s]*o', 'servico', h, flags=re.I)
    h = re.sub(r'reclamac[\ufffd\?\_\s]*o', 'reclamacao', h, flags=re.I)
    # Tratar caracteres corrompidos e pontuação (\ufffd, ?, etc.)
    h = re.sub(r'[\ufffd\?\_\-\.\:\/\\\,\(\)\[\]]', ' ', h)
    # Remover múltiplos espaços
    h = re.sub(r'\s+', ' ', h).strip()
    return h


def strip_stopwords(text: str) -> str:
    """Remove stopwords comuns em português para comparação semântica invariante."""
    if not text:
        return ""
    stopwords = {'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'no', 'na', 'd', 'a', 'o'}
    tokens = [w for w in text.split() if w not in stopwords]
    return ' '.join(tokens).strip()


# Dicionário Canônico de Aliases para ATENDIDOS (SGI / Concluídos)
ATENDIDOS_SCHEMA = {
    'os': [
        'atendimento', 'os', 'ordem de servico', 'ordem servico', 'num atendimento',
        'numero atendimento', 'id atendimento', 'chamado', 'numero os', 'num os', 'id'
    ],
    'protocolo': [
        'protocolo', 'num protocolo', 'numero protocolo', 'cod protocolo', 'protocolo atendimento'
    ],
    'data_inicio': [
        'data inicial atendimento', 'data inicial', 'dt inicio', 'data inicio',
        'inicio atendimento', 'dt inicial', 'hora inicio', 'data abertura', 'dt abertura'
    ],
    'data_fim': [
        'data conclusao atendimento', 'data conclusao', 'dt conclusao', 'data fim',
        'dt fim', 'conclusao atendimento', 'termino atendimento', 'data termino', 'data finalizacao'
    ],
    'data_reclamacao': [
        'data da reclamacao', 'data de reclamacao', 'data reclamacao', 'dt reclamacao',
        'dt rec', 'reclamacao data', 'hora reclamacao', 'data da ocorrencia', 'data ocorrencia'
    ],
    'origem': [
        'origem da ocorrencia', 'origem de ocorrencia', 'origem ocorrencia', 'origem da solicitacao',
        'origem solicitacao', 'origem', 'canal de entrada', 'canal', 'canal reclamacao'
    ],
    'bairro': [
        'bairro', 'bairros', 'nome bairro', 'bairro atendimento', 'localidade', 'regiao'
    ],
    'equipe': [
        'equipe', 'nome equipe', 'equipe responsavel', 'equipe executora', 'turma', 'tecnico'
    ],
    'tipo_ocorrencia': [
        'tipo ocorrencia', 'tipo da ocorrencia', 'tipo de ocorrencia', 'ocorrencia', 'defeito',
        'defeito reclamado', 'motivo', 'tipo defeito', 'tipo servico', 'servico'
    ],
    'solucao': [
        'solucao', 'solucao aplicada', 'servico realizado', 'acao realizada', 'descricao solucao'
    ],
    'atraso': [
        'atraso', 'status sla', 'sla cumprido', 'no prazo', 'sla situacao'
    ],
    'latitude': [
        'latitude', 'lat'
    ],
    'longitude': [
        'longitude', 'long', 'lng'
    ],
    'distancia': [
        'distancia', 'distancia m', 'deslocamento', 'distancia metros'
    ]
}


# Dicionário Canônico de Aliases para PENDENTES (Backlog / Ordens em Aberto)
PENDENTES_SCHEMA = {
    'id_solicitacao': [
        'id solicitacao', 'id da solicitacao', 'solicitacao id', 'num solicitacao', 'chamado',
        'id', 'numero solicitacao', 'cod solicitacao'
    ],
    'protocolo': [
        'protocolo', 'num protocolo', 'numero protocolo', 'cod protocolo', 'protocolo exati'
    ],
    'data_solicitacao': [
        'data de solicitacao', 'data da solicitacao', 'data solicitacao',
        'data da ocorrencia', 'data de ocorrencia', 'data ocorrencia',
        'data de abertura', 'data da abertura', 'data abertura',
        'data do chamado', 'data chamado', 'data cadastro', 'data de cadastro',
        'data criacao', 'abertura', 'criacao',
        'dt solicitacao', 'dt da solicitacao', 'dt abertura', 'dt ocorrencia', 'dt cadastro',
        'data e hora', 'data hora', 'data/hora', 'data', 'dt'
    ],
    'origem': [
        'origem da ocorrencia', 'origem de ocorrencia', 'origem ocorrencia',
        'origem solicitacao', 'origem da solicitacao', 'origem de solicitacao',
        'origem', 'canal', 'canal de entrada', 'canal entrada', 'meio abertura'
    ],
    'pontos': [
        'pontos de solicitacao', 'pontos da solicitacao', 'pontos solicitacao',
        'pontos', 'quantidade pontos', 'quantidade de pontos', 'qtd pontos',
        'pontos fisicos', 'num pontos', 'numero pontos'
    ],
    'bairro': [
        'bairros', 'bairro', 'nome bairro', 'bairro solicitacao', 'localidade', 'regiao',
        'endereco', 'logradouro', 'municipio', 'nome municipio'
    ],
    'solicitante': [
        'nome solicitante', 'nome do solicitante', 'solicitante', 'telefone solicitante',
        'contato', 'contato solicitante', 'reclamante', 'nome reclamante', 'municipe', 'cidadao'
    ],
    'atendente': [
        'nome atendente', 'nome do atendente', 'atendente', 'operador', 'criado por', 'responsavel'
    ],
    'tempo_restante': [
        'tempo restante', 'prazo restante', 'prazo restante sla', 'tempo restante sla',
        'status sla', 'tempo sla', 'sla restante', 'tempo', 'prazo', 'sla'
    ],
    'parque': [
        'nome parque', 'parque', 'parque de servico', 'municipio', 'nome municipio', 'cidade', 'unidade'
    ],
    'status': [
        'status', 'status solicitacao', 'status atendimento', 'situacao', 'estado', 'fase'
    ]
}


def detect_dataset_type(columns: List[Any], filename: str = "") -> str:
    """
    Detecta automaticamente se o arquivo é 'pendentes' (backlog) ou 'atendidos' (histórico/SGI),
    mesmo que o nome do arquivo seja genérico ou tenha sido renomeado.
    """
    fname_lower = filename.lower()
    if 'consulta' in fname_lower or 'pendente' in fname_lower or 'backlog' in fname_lower:
        return 'pendentes'
    if 'sgi' in fname_lower or 'atendido' in fname_lower or 'historico' in fname_lower:
        return 'atendidos'

    normalized_cols = [normalize_header(c) for c in columns]

    # Indicadores fortes de Pendentes
    pendentes_hits = 0
    if any('tempo restante' in c for c in normalized_cols):
        pendentes_hits += 3
    if any('pontos de solicitacao' in c or 'pontos solicitacao' in c for c in normalized_cols):
        pendentes_hits += 3
    if any('id solicitacao' in c for c in normalized_cols):
        pendentes_hits += 2

    # Indicadores fortes de Atendidos
    atendidos_hits = 0
    if any('data conclusao' in c or 'conclusao atendimento' in c for c in normalized_cols):
        atendidos_hits += 3
    if any('data inicial atendimento' in c for c in normalized_cols):
        atendidos_hits += 3
    if any('atendimento' == c for c in normalized_cols):
        atendidos_hits += 2

    return 'pendentes' if pendentes_hits >= atendidos_hits else 'atendidos'


def resolve_columns(columns: List[Any], dataset_type: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Resolve as colunas reais do arquivo para chaves canônicas semânticas,
    independentemente da ordem/posição das colunas na planilha.
    
    Retorna:
      mapping: { 'canonical_key': 'Original Col Name', ... }
      audit: Relatório detalhado de diagnóstico para transparência
    """
    if not dataset_type:
        dataset_type = detect_dataset_type(columns)

    schema = PENDENTES_SCHEMA if dataset_type == 'pendentes' else ATENDIDOS_SCHEMA
    
    col_dict = {normalize_header(c): c for c in columns}
    normalized_list = list(col_dict.keys())

    mapping = {}
    audit_matches = {}

    for canonical_key, aliases in schema.items():
        found_orig = None
        matched_alias = None

        # 1. Correspondência exata de alias
        for alias in aliases:
            norm_alias = normalize_header(alias)
            if norm_alias in col_dict:
                found_orig = col_dict[norm_alias]
                matched_alias = alias
                break

        # 2. Correspondência sem stopwords (ex: 'data da solicitacao' == 'data de solicitacao')
        if not found_orig:
            for alias in aliases:
                s_alias = strip_stopwords(normalize_header(alias))
                for norm_col in normalized_list:
                    s_col = strip_stopwords(norm_col)
                    if s_alias and s_col and (s_alias == s_col or s_alias in s_col or s_col in s_alias):
                        found_orig = col_dict[norm_col]
                        matched_alias = f"stopwords({alias})"
                        break
                if found_orig:
                    break

        # 3. Se não encontrou, correspondência parcial (contém substring do alias principal)
        if not found_orig:
            for alias in aliases:
                norm_alias = normalize_header(alias)
                for norm_col in normalized_list:
                    if norm_alias in norm_col or (len(norm_alias) > 4 and norm_col in norm_alias):
                        found_orig = col_dict[norm_col]
                        matched_alias = f"substring({alias})"
                        break
                if found_orig:
                    break

        # 4. Heurística de resgate para colunas críticas
        if not found_orig:
            for norm_col in normalized_list:
                if canonical_key in ('data_solicitacao', 'data_inicio') and ('data' in norm_col or 'dt' in norm_col):
                    found_orig = col_dict[norm_col]
                    matched_alias = "heuristica(data)"
                    break
                elif canonical_key == 'tempo_restante' and ('prazo' in norm_col or 'sla' in norm_col or 'restante' in norm_col):
                    found_orig = col_dict[norm_col]
                    matched_alias = "heuristica(tempo_restante)"
                    break
                elif canonical_key == 'pontos' and 'ponto' in norm_col:
                    found_orig = col_dict[norm_col]
                    matched_alias = "heuristica(pontos)"
                    break
                elif canonical_key == 'origem' and ('origem' in norm_col or 'canal' in norm_col):
                    found_orig = col_dict[norm_col]
                    matched_alias = "heuristica(origem)"
                    break

        if found_orig:
            mapping[canonical_key] = found_orig
            # Descobrir índice da coluna na planilha original
            orig_idx = list(columns).index(found_orig) if found_orig in columns else -1
            audit_matches[canonical_key] = {
                'coluna_original': found_orig,
                'posicao_index': orig_idx,
                'posicao_excel': orig_idx + 1 if orig_idx >= 0 else None,
                'status': 'OK',
                'regra': matched_alias
            }
        else:
            audit_matches[canonical_key] = {
                'coluna_original': None,
                'posicao_index': None,
                'posicao_excel': None,
                'status': 'AUSENTE',
                'regra': None
            }

    matched_count = sum(1 for v in audit_matches.values() if v['status'] == 'OK')
    total_expected = len(schema)
    confidence = round((matched_count / total_expected) * 100, 1) if total_expected > 0 else 0

    audit = {
        'dataset_type': dataset_type,
        'total_colunas_arquivo': len(columns),
        'colunas_mapeadas': matched_count,
        'total_colunas_esperadas': total_expected,
        'confianca_percent': confidence,
        'detalhes': audit_matches
    }

    return mapping, audit


def get_col_val(row: Any, mapping: Dict[str, Any], canonical_key: str, default: Any = None) -> Any:
    """Obtém o valor de forma segura a partir da chave canônica, sem depender de índice físico."""
    orig_col = mapping.get(canonical_key)
    if orig_col is None:
        return default
    if hasattr(row, 'get'):
        val = row.get(orig_col, default)
    else:
        try:
            val = row[orig_col]
        except (KeyError, IndexError):
            val = default
    return default if pd.isna(val) else val
