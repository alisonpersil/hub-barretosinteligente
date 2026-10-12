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
    // 2. Navegação por Abas (Home, Relatórios, Automações, Book)
    // =========================================================================
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-tab]');
    const tabPanels = {
        home: document.getElementById('panelHome'),
        relatorios: document.getElementById('panelRelatorios'),
        automacoes: document.getElementById('panelAutomacoes'),
        book: document.getElementById('panelBook')
    };
    const subRelatorios = document.getElementById('subRelatorios');

    function switchTab(tabId) {
        if (!tabPanels[tabId]) tabId = 'home';

        // Atualiza estado ativo dos botões da sidebar
        sidebarItems.forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Alterna os painéis de conteúdo
        Object.keys(tabPanels).forEach(key => {
            const panel = tabPanels[key];
            if (panel) {
                if (key === tabId) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            }
        });

        // Controla exibição do submenu de relatórios
        if (subRelatorios) {
            subRelatorios.style.display = (tabId === 'relatorios') ? 'flex' : 'none';
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (window.innerWidth <= 860) {
            const hubSidebar = document.getElementById('hubSidebar');
            if (hubSidebar) hubSidebar.classList.remove('mobile-open');
        }
    }

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
    // 3. Controle da Barra Lateral (Toggle Recolher / Expandir)
    // =========================================================================
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const hubSidebar = document.getElementById('hubSidebar');
    const SIDEBAR_STATE_KEY = 'hub_sidebar_collapsed';

    function initSidebarState() {
        if (window.innerWidth > 860) {
            const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
            if (isCollapsed && hubSidebar) {
                hubSidebar.classList.add('collapsed');
            }
        }
    }

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

    if (btnToggleSidebar && hubSidebar) {
        btnToggleSidebar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 860) {
                const isOpen = hubSidebar.classList.toggle('mobile-open');
                if (backdrop) backdrop.classList.toggle('active', isOpen);
                document.body.style.overflow = isOpen ? 'hidden' : '';
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

    initSidebarState();

    // =========================================================================
    // 4. Clique na Logo: Retorna sempre para o Início do HUB
    // =========================================================================
    const mainBrandLogo = document.getElementById('mainBrandLogo');
    if (mainBrandLogo) {
        mainBrandLogo.addEventListener('click', (e) => {
            const isHome = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') || window.location.pathname === '/hub';
            if (isHome) {
                e.preventDefault();
                switchTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (window.history && window.history.pushState) {
                    window.history.pushState(null, '', '/');
                }
            }
        });
    }

    // =========================================================================
    // 5. Resolução Dinâmica de Links dos Módulos
    // =========================================================================
    function getModuleUrls() {
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            return {
                oficios: '../01 - Consulta de Ofícios/index.html',
                exati: '../02 - Monitor Exati/index.html',
                home: './index.html'
            };
        }
        return {
            oficios: '/oficios',
            exati: '/exati',
            home: '/'
        };
    }

    function setupModuleLinks() {
        const urls = getModuleUrls();
        
        const sideLinkOficios = document.getElementById('sideLinkOficios');
        const sideLinkExati = document.getElementById('sideLinkExati');
        const cardOficios = document.getElementById('cardOficios');
        const cardExati = document.getElementById('cardExati');
        const btnOpenOficios = document.getElementById('btnOpenOficios');
        const btnOpenExati = document.getElementById('btnOpenExati');

        if (sideLinkOficios) sideLinkOficios.href = urls.oficios;
        if (sideLinkExati) sideLinkExati.href = urls.exati;
        if (cardOficios) cardOficios.href = urls.oficios;
        if (cardExati) cardExati.href = urls.exati;
        if (btnOpenOficios) btnOpenOficios.href = urls.oficios;
        if (btnOpenExati) btnOpenExati.href = urls.exati;

        if (mainBrandLogo && !window.location.protocol.startsWith('http')) {
            mainBrandLogo.href = urls.home;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupModuleLinks();

        // Ativação direta de aba via parâmetro URL ou hash (ex: /?tab=relatorios ou /#automacoes)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
            if (tabParam && tabPanels[tabParam]) {
                switchTab(tabParam);
            }
        } catch (_) {}
    });
})();
