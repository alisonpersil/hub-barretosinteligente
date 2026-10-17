/**
 * Barretos Inteligente - Central HUB PMO & CCO
 * Gerenciador de Tema, Navegação por Módulos e Resolução Dinâmica de Links
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. Gerenciamento do Tema Claro / Escuro (Sincronizado entre todos os módulos)
    // =========================================================================
    const rootEl = document.documentElement;
    const btnThemeToggle = document.getElementById('btnThemeToggle');

    function initTheme() {
        const savedTheme = localStorage.getItem('pmo_theme') || localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        rootEl.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('pmo_theme', theme);
            localStorage.setItem('theme', theme);
        } catch (_) {}

        if (btnThemeToggle) {
            const icon = btnThemeToggle.querySelector('i');
            if (icon) {
                if (theme === 'dark') {
                    icon.className = 'fa-solid fa-sun';
                    btnThemeToggle.title = 'Alternar para tema claro';
                } else {
                    icon.className = 'fa-solid fa-moon';
                    btnThemeToggle.title = 'Alternar para tema escuro';
                }
            }
        }
    }

    function toggleTheme() {
        const currentTheme = rootEl.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', toggleTheme);
    }

    window.addEventListener('storage', function (e) {
        if (e.key === 'pmo_theme' || e.key === 'theme') {
            if (e.newValue && (e.newValue === 'light' || e.newValue === 'dark')) {
                applyTheme(e.newValue);
            }
        }
    });

    initTheme();

    // =========================================================================
    // 2. Controle da Barra Lateral & Backdrop Mobile
    // =========================================================================
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const hubSidebar = document.getElementById('hubSidebar');
    const SIDEBAR_STATE_KEY = 'hub_sidebar_collapsed';

    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }

    function closeMobileSidebar() {
        if (hubSidebar) hubSidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openMobileSidebar() {
        if (hubSidebar) hubSidebar.classList.add('mobile-open');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function initSidebarState() {
        if (window.innerWidth > 860) {
            const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
            if (isCollapsed && hubSidebar) {
                hubSidebar.classList.add('collapsed');
            }
        }
    }

    if (btnToggleSidebar && hubSidebar) {
        btnToggleSidebar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 860) {
                const isCurrentlyOpen = hubSidebar.classList.contains('mobile-open');
                if (isCurrentlyOpen) {
                    closeMobileSidebar();
                } else {
                    openMobileSidebar();
                }
            } else {
                hubSidebar.classList.toggle('collapsed');
                const isCollapsed = hubSidebar.classList.contains('collapsed');
                try {
                    localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'true' : 'false');
                } catch (_) {}
            }
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeMobileSidebar);
    }

    // Fecha sidebar no mobile se clicar fora
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 860 && hubSidebar && hubSidebar.classList.contains('mobile-open')) {
            if (!hubSidebar.contains(e.target) && btnToggleSidebar && !btnToggleSidebar.contains(e.target)) {
                closeMobileSidebar();
            }
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 860) {
            closeMobileSidebar();
        }
    });

    initSidebarState();

    // =========================================================================
    // 3. Navegação por Abas (Home, Relatórios, Automações, Book)
    // =========================================================================
    // 3. Navegação por Abas e Módulos Integrados (Shell Contínuo Sem Recarregamento)
    // =========================================================================
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-tab]');
    const tabPanels = {
        home: document.getElementById('panelHome'),
        relatorios: document.getElementById('panelRelatorios'),
        automacoes: document.getElementById('panelAutomacoes'),
        book: document.getElementById('panelBook')
    };
    const subRelatorios = document.getElementById('subRelatorios');
    const subAutomacoes = document.getElementById('subAutomacoes');

    const TAB_INFO = {
        home: {
            title: 'Central HUB',
            docTitle: 'Central HUB • Barretos Inteligente'
        },
        relatorios: {
            title: 'Relatórios',
            docTitle: 'Relatórios • Barretos Inteligente'
        },
        automacoes: {
            title: 'Automações',
            docTitle: 'Automações • Barretos Inteligente'
        },
        book: {
            title: 'Book',
            docTitle: 'Book • Barretos Inteligente'
        }
    };

    const MODULE_ROUTES = {
        '/oficios': { title: 'Consulta de Ofícios', tab: 'relatorios' },
        '/exati': { title: 'Monitor Exati', tab: 'relatorios' },
        '/sala-agentes': { title: 'Sala de Agentes', tab: 'automacoes' },
        '/qa': { title: 'QA do Site', tab: 'relatorios' },
        '/painel-alison': { title: 'Painel Alison', tab: 'relatorios' },
        '/book': { title: 'Book de Governança', tab: 'book' }
    };

    function switchTab(tabId, updateUrl = true) {
        if (!tabPanels[tabId]) tabId = 'home';

        // Oculta o painel de módulos embutidos e reexibe o rodapé padrão
        const viewportPanel = document.getElementById('panelModuleViewport');
        if (viewportPanel) {
            viewportPanel.classList.remove('active');
            viewportPanel.style.display = 'none';
        }
        const hubFooter = document.querySelector('.hub-footer');
        if (hubFooter) {
            hubFooter.style.display = '';
        }

        // Desmarca links ativos dos submenus
        document.querySelectorAll('.sidebar-subitem').forEach(sub => {
            sub.classList.remove('active');
        });

        // Atualiza estado ativo dos botões da sidebar
        sidebarItems.forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Atualiza o título na barra superior (Topbar) e no título da página
        const brandTitleEl = document.getElementById('hubBrandTitle') || document.querySelector('.brand-title');
        const tabInfo = TAB_INFO[tabId] || TAB_INFO.home;
        if (brandTitleEl) {
            brandTitleEl.textContent = tabInfo.title;
        }
        document.title = tabInfo.docTitle;

        // Alterna os painéis de conteúdo
        Object.keys(tabPanels).forEach(key => {
            const panel = tabPanels[key];
            if (panel) {
                if (key === tabId) {
                    panel.classList.add('active');
                    panel.style.display = 'block';
                } else {
                    panel.classList.remove('active');
                    panel.style.display = 'none';
                }
            }
        });

        // Controla exibição dos submenus de relatórios e automações
        if (subRelatorios) {
            subRelatorios.style.display = (tabId === 'relatorios') ? 'flex' : 'none';
        }
        if (subAutomacoes) {
            subAutomacoes.style.display = (tabId === 'automacoes') ? 'flex' : 'none';
        }

        // Sincroniza a URL do navegador em tempo real com a tela visível
        if (updateUrl && window.history && window.history.pushState) {
            try {
                if (tabId === 'home') {
                    window.history.pushState(null, '', '/');
                } else {
                    window.history.pushState(null, '', `/?tab=${tabId}`);
                }
            } catch (_) {}
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (window.innerWidth <= 860) {
            closeMobileSidebar();
        }
    }

    /**
     * Abre um módulo operacional diretamente dentro do Shell do HUB sem recarregar o navegador.
     * Isso garante que a Rádio e todos os estados de áudio continuem tocando 100% ininterruptamente.
     */
    function openModule(urlPath, updateHistory = true) {
        const cleanPath = urlPath.split('?')[0].replace(/\/$/, '') || urlPath;
        const info = MODULE_ROUTES[cleanPath] || { title: 'Módulo Operacional', tab: 'home' };

        // Oculta abas tradicionais
        Object.keys(tabPanels).forEach(key => {
            const panel = tabPanels[key];
            if (panel) {
                panel.classList.remove('active');
                panel.style.display = 'none';
            }
        });

        const viewportPanel = document.getElementById('panelModuleViewport');
        const moduleFrame = document.getElementById('hubModuleFrame');
        const hubFooter = document.querySelector('.hub-footer');

        if (viewportPanel && moduleFrame) {
            viewportPanel.classList.add('active');
            viewportPanel.style.display = 'flex';

            if (hubFooter) {
                hubFooter.style.display = 'none';
            }

            // Atualiza src apenas se diferente para evitar recarregamento desnecessário
            let currentIframePath = '';
            try {
                currentIframePath = moduleFrame.contentWindow ? moduleFrame.contentWindow.location.pathname.replace(/\/$/, '') : '';
            } catch (_) {}

            // Garante parâmetro ?embedded=1 no iframe para que app.py entregue o módulo sem loop de shell
            let iframeSrc = urlPath;
            if (!iframeSrc.includes('embedded=1')) {
                iframeSrc += (iframeSrc.includes('?') ? '&' : '?') + 'embedded=1';
            }

            if (currentIframePath !== cleanPath) {
                moduleFrame.src = iframeSrc;
            }

            // Atualiza barra de topo e título da aba
            const brandTitleEl = document.getElementById('hubBrandTitle') || document.querySelector('.brand-title');
            if (brandTitleEl) {
                brandTitleEl.textContent = info.title;
            }
            document.title = `${info.title} • Barretos Inteligente`;

            // Atualiza botão correspondente na barra lateral
            sidebarItems.forEach(item => {
                if (item.getAttribute('data-tab') === info.tab) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            // Abre o submenu relevante
            if (subRelatorios) subRelatorios.style.display = (info.tab === 'relatorios') ? 'flex' : 'none';
            if (subAutomacoes) subAutomacoes.style.display = (info.tab === 'automacoes') ? 'flex' : 'none';

            // Destaca link ativo no submenu
            document.querySelectorAll('.sidebar-subitem').forEach(sub => {
                const subHref = sub.getAttribute('href');
                if (subHref && cleanPath.startsWith(subHref.replace(/\/$/, ''))) {
                    sub.classList.add('active');
                } else {
                    sub.classList.remove('active');
                }
            });

            // Atualiza URL no navegador sem recarregar a página
            if (updateHistory && window.history && window.history.pushState) {
                try {
                    window.history.pushState({ modulePath: urlPath }, '', urlPath);
                } catch (_) {}
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (window.innerWidth <= 860) {
                closeMobileSidebar();
            }
        }
    }

    // Intercepta cliques nos links de módulos para abrir no Shell Contínuo
    function bindModuleLinks() {
        document.querySelectorAll('a[href^="/oficios"], a[href^="/exati"], a[href^="/sala-agentes"], a[href^="/qa"], a[href^="/painel-alison"], a[href^="/book"]').forEach(link => {
            if (link.dataset.boundShell) return;
            link.dataset.boundShell = '1';
            link.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || link.target === '_blank') return;
                e.preventDefault();
                const href = link.getAttribute('href');
                openModule(href);
            });
        });
    }

    // Comunicação bidirecional com os módulos embutidos (ex: navegação iniciada de dentro do iframe)
    window.addEventListener('message', (e) => {
        if (!e.data) return;

        if (e.data.type === 'USER_INTERACTION') {
            if (window.RadioBarretos && window.RadioBarretos.isPlaying()) {
                window.RadioBarretos.resync();
            }
            return;
        }

        if (e.data.type === 'NAVIGATE_HUB' && e.data.url) {
            const target = e.data.url;
            let targetPath = target;
            let tabParam = null;
            try {
                const dummyUrl = new URL(target, window.location.origin);
                targetPath = dummyUrl.pathname;
                tabParam = dummyUrl.searchParams.get('tab');
            } catch (_) {
                targetPath = target.split('?')[0];
            }

            const cleanTarget = targetPath.replace(/\/$/, '') || '/';

            if (tabParam && tabPanels[tabParam]) {
                switchTab(tabParam);
            } else if (cleanTarget === '' || cleanTarget === '/' || cleanTarget === '/hub') {
                switchTab('home');
            } else if (MODULE_ROUTES[cleanTarget]) {
                openModule(target);
            } else {
                openModule(target);
            }
        }
    });

    // Event listeners para botões da sidebar
    sidebarItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Event listeners para os cards da tela inicial
    document.querySelectorAll('[data-tab-target]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = card.getAttribute('data-tab-target');
            switchTab(targetTab);
        });
    });

    // Event listeners para botões de voltar
    document.querySelectorAll('[data-tab-back]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const backTab = btn.getAttribute('data-tab-back') || 'home';
            switchTab(backTab);
        });
    });

    // =========================================================================
    // 4. Clique na Logo: Retorna sempre para o Início do HUB
    // =========================================================================
    const mainBrandLogo = document.getElementById('mainBrandLogo');
    if (mainBrandLogo) {
        mainBrandLogo.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Suporte ao botão voltar/avançar do navegador (Histórico)
    window.addEventListener('popstate', () => {
        const cleanPath = window.location.pathname.replace(/\/$/, '') || '/';
        if (MODULE_ROUTES[cleanPath]) {
            openModule(window.location.pathname + window.location.search, false);
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab') || 'home';
            switchTab(tabParam, false);
        }
    });

    function initNavigationOnLoad() {
        bindModuleLinks();

        const urlParams = new URLSearchParams(window.location.search);
        const moduleParam = urlParams.get('module');
        if (moduleParam) {
            const decoded = decodeURIComponent(moduleParam);
            openModule(decoded, true);
            return;
        }

        const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
        if (MODULE_ROUTES[currentPath]) {
            openModule(window.location.pathname + window.location.search, false);
        } else {
            try {
                const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
                if (tabParam && tabPanels[tabParam] && tabParam !== 'home') {
                    switchTab(tabParam, false);
                } else {
                    switchTab('home', false);
                }
            } catch (_) {
                switchTab('home', false);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigationOnLoad);
    } else {
        initNavigationOnLoad();
    }
})();
