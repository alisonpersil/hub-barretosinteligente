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

    function switchTab(tabId, updateUrl = true) {
        if (!tabPanels[tabId]) tabId = 'home';

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
                } else {
                    panel.classList.remove('active');
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

        // Sincroniza a URL do navegador em tempo real com a tela visível:
        // - Ao estar em 'home', limpa query string (?tab=...) e hashes para evitar recarregamento em outra aba
        // - Ao estar em outra aba, reflete ?tab=nome para navegação precisa
        if (updateUrl && window.history && window.history.replaceState) {
            try {
                const cleanPath = window.location.pathname || '/';
                if (tabId === 'home') {
                    window.history.replaceState(null, '', cleanPath);
                } else {
                    window.history.replaceState(null, '', `${cleanPath}?tab=${tabId}`);
                }
            } catch (_) {}
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Fecha a gaveta mobile e limpa o backdrop imediatamente
        if (window.innerWidth <= 860) {
            closeMobileSidebar();
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

    // Suporte ao botão voltar/avançar do navegador para abas
    window.addEventListener('popstate', () => {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '') || 'home';
            switchTab(tabParam, false);
        } catch (_) {
            switchTab('home', false);
        }
    });

    // =========================================================================
    // 5. Ciclo de Vida das Tags [NOVO] (Auto-expiração em 14 dias)
    // =========================================================================
    function applyNewBadgesLifecycle() {
        try {
            const now = new Date();
            document.querySelectorAll('[data-created-at]').forEach((item) => {
                const dateStr = item.getAttribute('data-created-at');
                if (!dateStr) return;
                const parts = dateStr.split('-');
                if (parts.length !== 3) return;
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const createdDate = new Date(year, month, day, 0, 0, 0);

                const maxDays = parseInt(item.getAttribute('data-new-days') || '14', 10);
                const diffMs = now.getTime() - createdDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                const isNew = diffDays >= 0 && diffDays < maxDays;
                const badges = item.querySelectorAll('.portal-badge-novo, .sub-badge-novo');
                badges.forEach((badge) => {
                    if (!isNew) {
                        badge.style.display = 'none';
                    } else {
                        const daysLeft = Math.max(1, Math.ceil(maxDays - diffDays));
                        badge.title = 'Novo item adicionado (' + daysLeft + ' dias restantes)';
                    }
                });
            });
        } catch (err) {
            console.warn('[Badge NOVO] Erro ao calcular ciclo de vida:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        applyNewBadgesLifecycle();

        // Ativação direta de aba via parâmetro URL ou hash (ex: /?tab=relatorios)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
            if (tabParam && tabPanels[tabParam] && tabParam !== 'home') {
                switchTab(tabParam, false);
            } else {
                switchTab('home', false);
            }
        } catch (_) {
            switchTab('home', false);
        }
    });

    applyNewBadgesLifecycle();
})();
