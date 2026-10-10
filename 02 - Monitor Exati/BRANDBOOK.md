# 📘 BRANDBOOK & DESIGN SYSTEM EXECUTIVO
## Padrão Oficial de Interfaces, Dashboards e Automações • PMO / CCO

> **Como acionar em novos projetos:**  
> Ao iniciar qualquer nova aplicação ou painel, basta dizer:  
> *"Aplique o **Brandbook Executivo do PMO** em modo claro/escuro com a mesma identidade visual, paleta de cores e ergonomia de dados."*

---

## 1. 🎯 Filosofia e Identidade Visual

O **Padrão Executivo PMO** foi concebido para entregar dashboards operacionais e gerenciais de nível C-Level e diretoria. Seus pilares essenciais são:

1. **Visão Executiva & Foco em Decisão:** Sem elementos supérfluos, sem grafismos infantis ou ilustrações poluentes. Cada pixel comunica um dado ou facilita uma ação.
2. **Dados em Primeiro Lugar (Data-First):** Números em destaque com fonte tabular (`tabular-nums`), rótulos claros e métricas semânticas que eliminam ambiguidades (ex.: **SLA sempre em Dias**, nunca em horas decimais confusas).
3. **Bimodalidade Perfeita (Light & Dark):** Alternância instantânea entre modo claro (corporativo para reuniões diurnas) e modo escuro (ultra-moderno com contraste focado para salas de comando/CCO).
4. **Ergonomia e Portabilidade:** Feito em Vanilla HTML/CSS/JS puro, ultrarrápido (carrega em < 200ms), sem dependência de builds pesados, funcionando tanto com servidor local Python quanto 100% autônomo e estático no navegador.

---

## 2. 🎨 Paleta de Cores e Tokens de Design

### 2.1 Cores Principais de Marca (Brand & Accent)

| Token CSS | Cor HEX | Amostra | Aplicação |
| :--- | :--- | :---: | :--- |
| `--primary` | `#2563eb` | 🔵 | Botões primários, links ativos, destaques principais |
| `--primary-hover` | `#1d4ed8` | 🔷 | Estado hover de botões e links ativos |
| `--primary-glow` | `rgba(37, 99, 235, 0.22)` | 🌐 | Efeito de foco, sombras de cards destacados e abas ativas |
| `--brand-dark` | `#0f172a` | ⬛ | Barra superior corporativa (Navbar), elementos estruturais |

### 2.2 Cores Semânticas de Negócio (Status e Alertas)

| Status | Token CSS | HEX | Significado / Regra de Uso |
| :--- | :--- | :--- | :--- |
| **Sucesso / No Prazo** | `--color-success` | `#10b981` | Chamados atendidos dentro do SLA, metas superadas, conformidade |
| **Atenção / Próximo do Limite** | `--color-warning` | `#f59e0b` | Chamados com SLA restante baixo (≤ 2 dias), alertas operacionais |
| **Crítico / Vencido** | `--color-danger` | `#ef4444` | Chamados em atraso (Vencidos), bairros com alto SLA, falhas |
| **Informativo / Ronda** | `--color-info` | `#6366f1` | Chamados preventivos / Ronda própria, dados de suporte |

### 2.3 Tokens Neutros por Tema (Light vs. Dark)

```css
/* ==================== MODO CLARO (Default Corporativo) ==================== */
:root[data-theme="light"], :root {
  --bg-app: #f8fafc;            /* Fundo geral da página (Slate 50) */
  --bg-card: #ffffff;           /* Fundo dos cartões e caixas */
  --bg-card-hover: #f1f5f9;     /* Hover em linhas de tabela e botões neutros */
  --border-card: #e2e8f0;       /* Bordas sutis dos cartões (Slate 200) */
  --text-main: #0f172a;         /* Título e números de KPI (Slate 900) */
  --text-muted: #475569;        /* Textos explicativos e labels (Slate 600) */
  --text-dim: #94a3b8;          /* Rótulos pequenos, datas e rodapés (Slate 400) */
  --nav-bg: #0f172a;            /* Barra superior sólida executiva */
  --nav-text: #ffffff;          /* Texto do cabeçalho */
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
}

/* ==================== MODO ESCURO (Estilo CCO / Noturno) ==================== */
:root[data-theme="dark"] {
  --bg-app: #0b1120;            /* Fundo azul-noturno profundo (Tailwind 950) */
  --bg-card: #131c31;           /* Superfície dos cartões em vidro sutil */
  --bg-card-hover: #1e293b;     /* Hover com elevação perceptível */
  --border-card: #1e2d4a;       /* Linhas de contorno discretas */
  --text-main: #f8fafc;         /* Leitura limpa e alto contraste */
  --text-muted: #94a3b8;        /* Informações secundárias */
  --text-dim: #64748b;          /* Textos de suporte e notas */
  --nav-bg: #070d19;            /* Barra superior em tom ainda mais denso */
  --nav-text: #f8fafc;          
  --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
```

---

## 3. 🔤 Tipografia e Hierarquia de Texto

* **Família Tipográfica Principal:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
* **Import Google Fonts:**
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  ```

### 3.1 Escala Tipográfica Padronizada

| Nível | Tamanho | Peso (`font-weight`) | Aplicação |
| :--- | :--- | :---: | :--- |
| **KPI Display** | `2.25rem` (36px) | `800` | Números gigantes dos cartões de indicadores (`font-variant-numeric: tabular-nums`) |
| **Título H1** | `1.5rem` (24px) | `700` | Título principal da visão / tela |
| **Subtítulo H2** | `1.15rem` (18px) | `600` | Cabeçalho de cartões e gráficos |
| **Corpo (Body)** | `0.88rem` (14px) | `400` / `500` | Texto corrido, linhas de tabela, descrições |
| **Rótulo (Label)** | `0.75rem` (12px) | `600` | Títulos de colunas, categorias de chips (em caixa alta suave) |
| **Micro (Caption)** | `0.70rem` (11px) | `500` | Metadados, horário de sincronização, rodapé |

---

## 4. 📐 Anatomia Estrutural do Layout

A estrutura padrão de qualquer página segue 5 blocos hierárquicos verticais:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. NAVBAR SUPERIOR (Marca + Divider + Indicador de Sincronia + Ações Globais)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. FAIXA DE CONTROLE TEMPORAL (Filtro por Período: 2026, Mês, Datas, Export) │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. ABAS DE NAVEGAÇÃO EXECUTIVA (Visão Geral • Backlog • Histórico • etc.)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. GRID DE CARDS KPI (Atendidos • SLA em Dias • Backlog Ativo • Vencidos)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. ÁREA DE CONTEÚDO (Gráficos Lado a Lado • Tabelas Analíticas • Diagnóstico) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Barra Superior Corporativa & Abas Fixas (Sticky Navigation)
* **Container Unificado Sticky (`.sticky-header-wrapper`):** Fixado no topo (`position: sticky; top: 0; z-index: 1000`) unificando a Barra de Título/Ações (`.navbar`) e a Barra de Abas/Chips (`.subnav-bar`), garantindo que tanto o título quanto a navegação permaneçam fixos durante a rolagem de página, com elevação dinâmica (`.is-scrolled`).
* **Proteção Anti-Quebra do Sticky:** O `html` e `body` utilizam `overflow-x: clip` (em vez de `overflow-x: hidden`) para conter vazamentos horizontais sem quebrar o cálculo do `position: sticky` no Chromium/Safari.
* **Logomarca com Divisor Vertical:** Logo da empresa/concessionária à esquerda, linha vertical divisora em `rgba(255,255,255,0.2)` e título do painel + subtítulo de gestão.
* **Indicador de Sincronia Viva (`.topbar-sync-notice`):** Ponto verde pulsante (`.sync-pulse-dot`) mostrando os arquivos ou data/hora da base de dados ativa.
* **Ações Globais à Direita:** Botão de Troca de Tema (Sol/Lua) e Botão Principal de Upload/Importação de Dados.

### 4.2 Faixa de Filtro Temporal Dinâmico
* Botões de Atalho Rápido: `Ano Atual (2026)`, `Últimos 30 Dias`, `Últimos 90 Dias`, `Todo o Histórico`.
* Inputs de Data Inicial e Final (`<input type="date">`) com botão de confirmação e botão de **Exportar Relatório Excel**.

---

## 5. 🧩 Biblioteca de Componentes UI

### 5.1 Card de KPI Executivo
```html
<div class="kpi-card">
  <div class="kpi-header">
    <span class="kpi-label">SLA MÉDIO DE ATENDIMENTO</span>
    <span class="kpi-icon">⚡</span>
  </div>
  <div class="kpi-value">2.6 <span class="kpi-unit">dias</span></div>
  <div class="kpi-footer">
    <span class="trend-badge positive">Mediana: 1.0 dia</span>
    <span class="kpi-subtext">Meta contratual: ≤ 3 dias</span>
  </div>
</div>
```

```css
.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: var(--card-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.kpi-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.12);
}
.kpi-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}
.kpi-value {
  font-size: 2.1rem;
  font-weight: 800;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  margin: 6px 0 4px 0;
}
```

### 5.2 Badges & Chips Semânticos
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge.success { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
.badge.warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
.badge.danger  { background: rgba(239, 68, 68, 0.15);  color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
.badge.info    { background: rgba(99, 102, 241, 0.15); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.3); }
```

### 5.3 Gráficos Chart.js (Estilo Executivo)
Para manter todos os gráficos consistentes e elegantes:
1. **Sem linhas de grade verticais** (`x: { grid: { display: false } }`).
2. **Grade horizontal muito suave** (`y: { grid: { color: 'rgba(148, 163, 184, 0.12)' } }`).
3. **Tooltips Escuros Flutuantes:** Fundo escuro semitransparente, padding generoso, sem caixas pontudas.
4. **Barras com Cantos Arredondados:** `borderRadius: 4` a `6px`.
5. **Legendas Ocultadas** quando o título ou o eixo já tornam a leitura óbvia.
6. **Eixo X Temporal Hierárquico:** Rótulos mensais sempre formatados como array multilinha com o **Nome do Mês em cima** e o **Ano embaixo** (ex.: `['Janeiro', '2026']`), eliminando formatações técnicas como `2026-01`.
7. **Drill-Down Interativo (Padrão Power BI):** Gráficos temporais executivos devem suportar alternância de nível entre **Mês** (padrão principal) e **Dia**, permitindo clicar diretamente nas barras de um mês para descer o nível diário daquele mês, com botão de subida de nível (`Subir Nível (Mês)`).

---

## 6. ⚙️ Padrão Funcional & Regras de Negócio Obrigatórias

Em qualquer sistema ou dashboard deste padrão, adote sempre estas 5 regras:

| Regra | Especificação Padrão |
| :--- | :--- |
| **1. SLA em Dias** | Sempre exibir o prazo de resolução em **dias inteiros** (arredondado para número inteiro, ex.: `3 dias` ou `1 dia`). Nunca exibir em porcentagens em equipes, nem em horas quebradas ou casas decimais, garantindo leitura executiva imediata. |
| **2. Backlog: Chamados vs. Pontos** | Separar sempre o volume de **Ordens/Chamados** do volume de **Pontos Físicos** (ex.: uma ordem pode conter 9 luminárias). |
| **3. Linha do Tempo Comparativa** | Gráficos temporais de pendências devem exibir em paralelo as ocorrências **resolvidas no mesmo período**, para dar a perspectiva do trabalho realizado. |
| **4. Identificador Dinâmico de Excel** | Ao importar planilhas do Exati/SGI, usar o resolvedor semântico com tolerância a colunas fora de ordem e caracteres corrompidos (`\ufffd`). |
| **5. Persistência Bimodal** | Suportar upload via backend (`/api/upload`) e fallback 100% autônomo no navegador via `LocalStorage`, garantindo que o painel funcione mesmo hospedado estaticamente online. |
| **6. Alerta de Sobrescrita Diária** | Se uma planilha da mesma categoria já tiver sido importada hoje, emitir alerta visual preventivo explícito exibindo o horário e o arquivo anterior antes de autorizar a substituição. |

---

## 7. 🚀 Template Rápido de Solicitação (Copie e Cole para Novos Chats)

Quando você for iniciar um novo projeto comigo ou com outro assistente, envie apenas isto:

```markdown
Por favor, desenvolva este novo projeto utilizando rigorosamente o BRANDBOOK & DESIGN SYSTEM EXECUTIVO DO PMO (BRANDBOOK.md):
- Tema claro e escuro (data-theme com tokens de CSS)
- Fonte Inter e números em modo tabular
- Navbar executiva com logo, divisor e indicador de sincronia
- Cards de KPI com rótulo em caixa alta e números em destaque
- Regras de negócio: SLA em dias, backlog em chamados e pontos físicos
- Gráficos Chart.js sem poluição visual e tabelas analíticas com badges
- Sistema de upload de planilha com identificação dinâmica de colunas do Excel
```
Com este comando, o projeto já nascerá 100% alinhado ao padrão da empresa, sem gastar tokens explicando cores e layout novamente.
