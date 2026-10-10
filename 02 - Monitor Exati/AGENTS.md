# Diretrizes Permanentes de Projeto • Padrão Executivo PMO

Sempre que o usuário solicitar uma nova tela, módulo, dashboard ou automação, siga automaticamente as especificações do **BRANDBOOK.md**:

## 1. Identidade Visual e Estilo
- **Tipografia:** Fonte `'Inter', sans-serif`, pesos 400 a 800. Números de KPIs e tabelas com `font-variant-numeric: tabular-nums`.
- **Tema Bimodal:** Suporte nativo e completo a `[data-theme="light"]` e `[data-theme="dark"]`.
- **Cores Oficiais:**
  - Primária: `#2563eb` (Hover `#1d4ed8`, Glow `rgba(37,99,235,0.22)`)
  - Sucesso/No Prazo: `#10b981`
  - Alerta/Atenção: `#f59e0b`
  - Perigo/Vencido: `#ef4444`
  - Fundo Dark: `#0b1120`, Cards Dark: `#131c31`, Bordas Dark: `#1e2d4a`
  - Fundo Light: `#f8fafc`, Cards Light: `#ffffff`, Bordas Light: `#e2e8f0`

## 2. Layout & Estrutura
- **Navbar:** Estilo corporativo com logo, divider vertical, aviso de status/sincronia viva com pulso verde (`.sync-pulse-dot`), botão de tema e botão de upload.
- **Abas:** Navegação por pills com transição suave.
- **Cards KPI:** Rótulo superior em caixa alta atenuada, número em destaque grande (2rem+), rodapé com tendência ou meta.
- **Gráficos Chart.js:** Sem linhas de grade verticais, grade horizontal sutil, tooltips escuros flutuantes e cantos arredondados nas barras.

## 3. Regras de Negócio e Dados
- **SLA:** Sempre mensurado e exibido em **dias inteiros** (arredondado para número inteiro, ex.: 3 dias, 1 dia), nunca em porcentagem ou casas decimais.
- **Ritmo de Ordens (Throughput):** Sempre exibido em **números inteiros** (arredondado, ex.: 6 ordens/dia, 15 ordens/dia, -12/dia), nunca em casas decimais.
- **Backlog:** Sempre diferenciar volume de **Ordens/Chamados** do volume de **Pontos Físicos** (luminárias).
- **Planilhas Excel:** Usar o sistema de identificação dinâmica de colunas (`ExatiColumnResolver`) para tolerar variações de ordem e encodings corrompidos.
- **Persistência Híbrida:** Suportar sincronização com servidor local Python e fallback autônomo no navegador via `LocalStorage`.
- **Prevenção de Sobrescrita Diária:** Avisar o usuário se uma planilha da mesma categoria já foi importada hoje, exibindo o horário e arquivo anterior antes de autorizar a substituição.
