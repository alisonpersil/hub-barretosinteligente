# 📘 BRANDBOOK & DESIGN SYSTEM EXECUTIVO
## Padrão Oficial do Ecossistema Barretos Inteligente • PMO / CCO
### Central HUB • Consulta de Ofícios • Monitor Exati

> **Como acionar em novos projetos ou solicitações:**  
> Ao iniciar qualquer nova página, módulo ou automação, declare:  
> *"Aplique rigorosamente o **Brandbook Executivo do PMO** em modo claro/escuro, mantendo a topbar limpa, sidebar compartilhada, endbar com LinkedIn, ícones FontAwesome e sem emojis de sistema."*

---

## 1. 🎯 Filosofia e Diretrizes de Design

O ecossistema **Barretos Inteligente** foi concebido para entregar portais e ferramentas de nível executivo C-Level e diretoria técnica. Todas as interfaces devem seguir princípios inegociáveis de excelência:

1. **Visão Executiva & Foco em Decisão:** Interfaces limpas, organizadas e sofisticadas. Nenhum elemento de ruído ou informação desnecessária na navegação.
2. **Iconografia Profissional Estrita:** **Proibição absoluta de emojis nativos de sistema operacional (Windows/Segoe UI Emoji)**. 100% dos ícones devem ser vetoriais via **FontAwesome 6**, transmitindo acabamento profissional de alto padrão.
3. **Harmonia Estrutural Unificada:** Todas as aplicações do ecossistema compartilham a mesma Top Navbar, a mesma Barra Lateral Executiva (`.hub-sidebar`) e a mesma Endbar (`.hub-footer`).
4. **Bimodalidade Perfeita (Light & Dark):** Alternância instantânea entre modo claro (corporativo diurno) e modo escuro (azul-noturno profundo estilo Centro de Controle Operacional - CCO), com persistência em `localStorage`.
5. **Ergonomia e Portabilidade:** Vanilla HTML/CSS/JS ultrarrápido, sem dependência de builds pesados, com funcionamento bimodal (servidor Flask/Python e cliente estático).

---

## 2. 🏛️ Arquitetura e Navegação do Ecossistema

### 2.1 Central HUB (`00 - HUB`)
* **Página Inicial:** A tela inicial do portal (`/`) exibe os 3 módulos estratégicos do sistema:
  * **Relatórios:** Porta de entrada para *Consulta de Ofícios* e *Monitor Exati*.
  * **Automações:** Módulo dedicado a rotinas automatizadas (mantido vazio com placeholder "Em desenvolvimento", sem gerar falsas expectativas).
  * **Book:** Módulo dedicado aos livros e acervos operacionais (mantido vazio com placeholder "Em desenvolvimento").
* **Sem Redirecionamento Compulsório:** A primeira página abre na visão dos 3 módulos, permitindo ao usuário decidir para qual área navegar.

### 2.2 Top Navigation Bar (Navbar) Padronizada e Despoluída
* **Altura Padrão:** `62px`, com `backdrop-filter: blur(8px)` e `position: sticky; top: 0; z-index: 100` (sempre no topo absoluto, nunca sendo sobreposta por elementos do corpo ou barra lateral).
* **Lado Esquerdo (Anatomia do Brand & Título):**
  1. Botão de alternância da barra lateral (`.sidebar-toggle-btn` com ícone `fa-bars`).
  2. Logo institucional em alta definição (`.brand-logo-img`) envolvido exclusivamente pelo link (`.brand-logo-link`) para retornar ao HUB Central quando clicado.
  3. Divisor vertical sutil (`.brand-divider`).
  4. Nome da aplicação (`.brand-title` dentro de `.brand-text`): **Elemento estático não clicável** (`cursor: default; user-select: none;`). O clique no título **nunca deve redirecionar** o usuário ou tirá-lo da página atual.
* **Regras de Visibilidade Mobile (Mandatórias):**
  * ✅ **O título da aplicação deve SEMPRE permanecer visível no celular:** É proibido ocultar o título em telas de smartphones. No modo mobile (`max-width: 768px`), o título `.brand-title` permanece visível ao lado do logo redimensionado (`height: 24px, max-width: 95px`) e divisor, com tipografia adaptada (`font-size: 13px`) e truncamento elegante (`text-overflow: ellipsis`), garantindo que o usuário sempre saiba em qual página está.
* **Regras de Despoluição Visual (Obrigatórias):**
  * ❌ **Proibido itens no meio da navbar:** Não colocar botões ou links soltos no centro da barra superior (como "Monitor Exati" ou "Consulta de Ofícios"). O meio da barra deve permanecer limpo.
  * ❌ **Proibido subtítulos de ruído:** Removidos terminantemente textos como *"PMO • Acervo Digital"* e *"PMO • Gestão Operacional"*. Apenas o nome funcional e direto da aplicação.
* **Lado Direito:**
  * Indicadores de sincronia / contadores contextuais (se aplicável).
  * Botão de alternância de tema Claro/Escuro (Sol/Lua).

### 2.3 Barra Lateral Compartilhada (Shared Sidebar • `.hub-sidebar`)
* **Presença Obrigatória:** Integrada em todas as páginas do ecossistema através de `/css/sidebar.css` e `/js/sidebar.js`.
* **Dimensões:**
  * Aberta: `270px` de largura.
  * Colapsada: `78px` de largura (ícones centralizados, rótulos e submenus ocultados com animação fluida).
* **Comportamento Fixo / Travado (Sticky Lock):**
  * A barra lateral permanece **100% visível e travada na tela** (`position: sticky; top: 62px; height: calc(100vh - 62px); max-height: calc(100vh - 62px); align-self: flex-start; z-index: 40;`) durante toda a rolagem da página.
  * O usuário pode rolar a página livremente até o rodapé sem que a sidebar desapareça ou se desloque para fora da tela.
  * A sidebar nunca invade ou cobre a navbar (`z-index: 40` vs `z-index: 100` da navbar).
  * Possui `overflow-y: auto` com scrollbar ultrafina e discreta para telas de notebooks menores.
* **Estrutura de Menus:**
  * `Início` (`fa-house`): Redireciona para `/` (Central HUB).
  * `Relatórios` (`fa-chart-pie`): Com badge indicativa e submenu contendo:
    * `Consulta de Ofícios` (`fa-folder-open`, acento verde).
    * `Monitor Exati` (`fa-chart-line`, acento azul).
    * `BI Financeiro` (`fa-coins`, acento âmbar, redireciona para Power BI).
    * `BI Estoque` (`fa-chart-column`, acento âmbar, redireciona para Power BI).
    * `BI PMO` (`fa-diagram-project`, acento âmbar, redireciona para Power BI).
    * `BI Energia` (`fa-bolt`, acento âmbar, redireciona para Power BI).
    * `QA do Site` (`fa-shield-halved`, acento roxo).
    * `Painel Alison` (`fa-user-shield`, acento verde).
  * `Automações` (`fa-bolt`): Badge *"Sala de Agentes"*.
  * `Book` (`fa-book-bookmark`): Badge *"Governança"*.
* **✨ Etiquetas Temporárias [NOVO] (Ciclo de Vida de 14 Dias):**
  * Novos relatórios e ferramentas recebem o atributo `data-created-at="AAAA-MM-DD"`.
  * A tag `.sub-badge-novo` (na barra lateral) e `.portal-badge-novo` (nos cards da HUB) exibem visual executivo verde esmeralda com ponto pulsante.
  * O motor autônomo em `sidebar.js` e `hub.js` compara a data atual com a de lançamento e oculta a tag automaticamente após 14 dias (`diffDays >= 14`).
* **✅ Regra Obrigatória de Navegação por Módulo:**
  * Clicar no item de um **módulo** na sidebar SEMPRE leva à **aba do módulo na Central HUB**, nunca direto para uma página interna, independentemente da página em que o usuário esteja:
    * `Relatórios` → `/?tab=relatorios`
    * `Automações` → `/?tab=automacoes`
    * `Book` → `/?tab=book`
  * O acesso direto às páginas internas (ex.: `/oficios`, `/sala-agentes`) acontece apenas pelos **subitens** do submenu ou pelos cards dentro da aba do módulo.
  * ❌ Proibido usar `<button>` sem destino ou interceptar o clique do item de módulo com `preventDefault()` fora da HUB.
* **Persistência de Estado:** Gravada automaticamente no `localStorage ('hub_sidebar_collapsed')`. Ao navegar entre HUB, Ofícios e Exati, o estado escolhido é mantido.
* **Modo Mobile (≤ 860px) & Safe Area:** Transforma-se em gaveta deslizante (`drawer`) com backdrop escurecido (`.sidebar-backdrop`), abrindo via botão hamburguer e fechando ao clicar fora.
  * **Prevenção de Corte de Texto:** A gaveta ocupa altura total (`top: 0; bottom: 0; height: 100dvh;`) com preenchimento superior seguro `padding-top: calc(62px + env(safe-area-inset-top, 0px))` e `z-index: 90` sob a navbar (`z-index: 100`).
  * O rótulo "MÓDULOS" e todos os itens permanecem 100% visíveis, legíveis e com espaçamento executivo em qualquer smartphone (iOS com Dynamic Island/notch e Android).
  * Enquanto aberta, a rolagem da página de fundo é bloqueada (`overflow: hidden`), impedindo descompassos visuais.

### 2.4 Endbar Oficial no Rodapé (Footer Corporativo • `.hub-footer`)
* **Presença Obrigatória:** Rodapé executivo idêntico em todas as páginas do portal.
* **Layout em 3 Zonas Simétricas (Grid `1fr auto 1fr`):**
  * **Esquerda:** Copyright institucional: `© 2026 Barretos Inteligente` — sem complementos (❌ proibido acrescentar textos como *"CCO & PMO Concessão"*).
  * **Centro:** Ícone vetorial do LinkedIn (`fa-brands fa-linkedin`) com link direto para o perfil pessoal do autor:  
    👉 **`https://www.linkedin.com/in/alisonviper/`** (`target="_blank" rel="noopener noreferrer"`).  
    *Efeito Hover:* Transição suave para a cor oficial do LinkedIn (`#0a66c2`), leve elevação (`translateY(-2px)`) e halo suave.
  * **Direita:** Domínio institucional: `hub.barretosinteligente.com.br`.
* **Fixação:** Utiliza `margin-top: auto` dentro do container flexível de conteúdo (`.hub-main-area`), garantindo que o rodapé permaneça na base da página mesmo em telas com pouco conteúdo.
* **Responsividade:** Em dispositivos móveis (`≤ 768px`), adapta-se automaticamente para layout em coluna centralizada.

---

## 3. 🎨 Paleta de Cores e Tokens de Design

### 3.1 Cores Principais e Semânticas

| Token CSS | Cor HEX | Amostra | Significado / Aplicação |
| :--- | :--- | :---: | :--- |
| `--primary` | `#2563eb` | 🔵 | Botões primários, destaques principais |
| `--accent-emerald` | `#10b981` | 🟢 | Sucesso, metas atingidas, ícone de Ofícios |
| `--accent-blue` | `#2563eb` | 🔷 | Indicadores de operação, ícone de Exati |
| `--accent-warning` | `#f59e0b` | 🟡 | Alertas de prazo e atenção |
| `--accent-danger` | `#ef4444` | 🔴 | Chamados vencidos e ações destrutivas |
| `--linkedin-color` | `#0a66c2` | 🌐 | Cor oficial da marca LinkedIn no footer |

### 3.2 Tokens Neutros por Tema (Light vs. Dark)

```css
/* ==================== MODO CLARO (Default Corporativo) ==================== */
:root[data-theme="light"], :root {
    --bg-app: #f8fafc;            /* Fundo geral da página (Slate 50) */
    --bg-main: #f8fafc;
    --bg-card: #ffffff;           /* Superfície de cartões e modais */
    --bg-card-hover: #f1f5f9;     /* Hover em listas e cards */
    --bg-header: #ffffff;         /* Navbar e Endbar */
    --border-color: #e2e8f0;       /* Bordas sutis dos elementos */
    --text-primary: #0f172a;      /* Textos principais e KPIs (Slate 900) */
    --text-secondary: #475569;    /* Subtítulos e links (Slate 600) */
    --text-muted: #64748b;        /* Rótulos secundários (Slate 500) */
    --badge-bg: rgba(0, 0, 0, 0.05);
}

/* ==================== MODO ESCURO (Estilo CCO / Noturno) ==================== */
[data-theme="dark"] {
    --bg-app: #0b1120;            /* Fundo azul-noturno profundo (Tailwind 950) */
    --bg-main: #0b1120;
    --bg-card: #131c31;           /* Superfície de cartões em vidro azulado */
    --bg-card-hover: #1e293b;
    --bg-header: #0f172a;         /* Navbar e Endbar sólida escura */
    --border-color: #1e2d4a;       /* Bordas discretas em tom noturno */
    --text-primary: #f8fafc;      /* Texto de alto contraste (Slate 50) */
    --text-secondary: #94a3b8;    /* Textos complementares (Slate 400) */
    --text-muted: #64748b;
    --badge-bg: #1e293b;
}
```

---

## 4. 🔤 Tipografia e Iconografia

### 4.1 Tipografia
* **Fonte Principal:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
* **Import Obrigatório:**
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  ```
* **Números de Métricas:** Sempre com `font-variant-numeric: tabular-nums` para alinhamento vertical estável em tabelas e KPIs.

### 4.2 Iconografia Vetorial FontAwesome (Regra Estrita Anti-Emoji)
* **Import Obrigatório:**
  ```html
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  ```
* **Diretriz Mandatória:**
  * ❌ **Nunca utilizar emojis do Windows ou do sistema operacional** (como 📁, 📊, ⚡, ⚙️, 🚀).
  * ✅ **Utilizar exclusivamente ícones FontAwesome 6**:
    * Home/Início: `<i class="fa-solid fa-house"></i>`
    * Relatórios: `<i class="fa-solid fa-chart-pie"></i>`
    * Ofícios: `<i class="fa-solid fa-folder-open"></i>`
    * Exati / Monitor: `<i class="fa-solid fa-chart-line"></i>`
    * Automações: `<i class="fa-solid fa-bolt"></i>`
    * Book: `<i class="fa-solid fa-book-bookmark"></i>`
    * Tema (Sol/Lua): `<i class="fa-solid fa-moon"></i>` / `<i class="fa-solid fa-sun"></i>`
    * Menu Hambúrguer: `<i class="fa-solid fa-bars"></i>`
    * LinkedIn: `<i class="fa-brands fa-linkedin"></i>`

---

## 5. 🧩 Padrão de Botões e Componentes UI

### 5.1 Botões Executivos Padronizados
* Bordas suavemente arredondadas (`border-radius: 8px` a `10px`).
* Altura confortável (`38px` a `42px`), espaçamento equilibrado (`padding: 8px 16px`).
* Efeito hover elegante com elevação (`transform: translateY(-1px)`) e sombra suave.
* Transição fluida de 200ms (`cubic-bezier(0.16, 1, 0.3, 1)`).

### 5.2 Estrutura HTML do Footer Oficial
```html
<footer class="hub-footer">
    <div class="footer-left">
        <span>&copy; 2026 Barretos Inteligente</span>
    </div>
    <div class="footer-center">
        <a href="https://www.linkedin.com/in/alisonviper/" target="_blank" rel="noopener noreferrer" class="footer-linkedin-link" title="LinkedIn • Alison Persil" aria-label="Perfil do LinkedIn de Alison Persil">
            <i class="fa-brands fa-linkedin"></i>
        </a>
    </div>
    <div class="footer-links">
        <span>hub.barretosinteligente.com.br</span>
    </div>
</footer>
```

### 5.3 Padrão de Paginação Executiva (15 Itens por Página)
* **Objetivo:** Garantir excelente ergonomia visual, alta performance de renderização e evitar barras de rolagem verticais infinitas em listagens e acervos (como a página de Consulta de Ofícios).
* **Densidade Fixa:** Exibição rigorosa de **15 em 15 registros** (`pageSize: 15`).
* **Controles e Experiência do Usuário (UX):**
  * **Contador Contextual na Toolbar:** Exibe claramente a faixa visível e o total: `Exibindo 1–15 de 47 ofícios`.
  * **Barra de Paginação Dedicada (`.pagination-wrapper`):**
    * Informação contextual à esquerda: `Página X de Y (Z ofícios no total)`.
    * Controles ergonômicos à direita: Botões `[Anterior]` e `[Próxima]` com ícones vetoriais FontAwesome, acompanhados de botões numerados (`.pagination-num`).
    * Destaque na página atual com a cor temática institucional (`.active`).
    * Reticências dinâmicas (`...`) para acervos com dezenas de páginas.
    * Ocultação automática quando a listagem totaliza apenas 1 página ou está vazia.
  * **Scroll Suave Automático:** Ao navegar entre páginas, a interface rola suavemente (`behavior: 'smooth'`) para o topo da lista de resultados, oferecendo leitura imediata sem desorientação.

---

## 6. ⚙️ Regras de Negócio e Indicadores Operacionais

| Indicador / Regra | Especificação Padrão |
| :--- | :--- |
| **SLA em Dias Inteiros** | Exibir sempre o prazo de resolução em **dias inteiros** (arredondado, ex.: `3 dias` ou `1 dia`). Nunca exibir em porcentagens em equipes, nem em horas quebradas ou casas decimais. |
| **Separação de Backlog** | Distinguir explicitamente o volume de **Chamados/Ordens** do volume de **Pontos Físicos de Iluminação**. |
| **Módulos em Desenvolvimento** | Devem ser mantidos visíveis porém vazios, com placeholder elegante de *"Módulo em desenvolvimento"* e badge *"Em breve"*, sem gerar expectativas falsas. |
| **Persistência de Dados Bimodal** | Suportar carregamento via backend Python e fallback no cliente com `SheetJS` e `LocalStorage`, permitindo operação em servidores ou estática. |
| **Alerta Preventivo de Sobrescrita** | Se um arquivo da mesma categoria já tiver sido carregado na data atual, exibir aviso antes de autorizar a substituição. |

---

## 7. 🚀 Template Rápido de Solicitação (Para Próximos Prompts)

```markdown
Por favor, desenvolva esta solicitação seguindo rigorosamente o BRANDBOOK & DESIGN SYSTEM EXECUTIVO (BRANDBOOK.md):
- Topbar limpa (sem botões no meio, sem textos decorativos "PMO • Acervo/Gestão")
- Barra lateral compartilhada (.hub-sidebar) persistida no localStorage
- Endbar oficial (.hub-footer) com copyright, link LinkedIn Alison Persil no centro e domínio à direita
- Ícones 100% vetoriais FontAwesome 6 (proibido qualquer emoji nativo do Windows)
- Bimodalidade Light / Dark sincronizada
- Botões padronizados e elegantes
```
