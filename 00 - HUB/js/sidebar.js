/**
 * Barretos Inteligente - Barra Lateral Executiva Compartilhada
 * Padrão Oficial para HUB Central, Consulta de Ofícios e Monitor Exati
 */

(function () {
    'use strict';

    // Se estiver embutido no Shell Contínuo da Central HUB
    if (window.self !== window.top) {
        document.documentElement.classList.add('is-embedded');
        if (document.body) document.body.classList.add('is-embedded');
        window.addEventListener('DOMContentLoaded', () => {
            document.documentElement.classList.add('is-embedded');
            if (document.body) document.body.classList.add('is-embedded');
        });

        // Intercepta cliques internos para coordenar navegação na janela mãe (Shell)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            if (link.target === '_blank' || link.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey) return;

            try {
                const targetUrl = new URL(href, window.location.href);
                if (targetUrl.origin === window.location.origin) {
                    const targetPath = targetUrl.pathname;
                    if (targetPath === '/' || targetPath === '/hub' || targetPath.startsWith('/oficios') || targetPath.startsWith('/exati') || targetPath.startsWith('/sala-agentes') || targetPath.startsWith('/qa') || targetPath.startsWith('/painel-alison') || targetPath.startsWith('/bi')) {
                        e.preventDefault();
                        window.top.postMessage({ type: 'NAVIGATE_HUB', url: targetPath + targetUrl.search }, '*');
                    }
                }
            } catch (_) {}
        });
    }

    function setupSidebar() {
        const btnToggleSidebar = document.getElementById('btnToggleSidebar');
        const hubSidebar = document.getElementById('hubSidebar');
        const SIDEBAR_STATE_KEY = 'hub_sidebar_collapsed';

        // Cria o backdrop mobile se não existir
        let backdrop = document.getElementById('sidebarBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'sidebarBackdrop';
            backdrop.className = 'sidebar-backdrop';
            document.body.appendChild(backdrop);
        }

        function initSidebarState() {
            if (window.innerWidth > 860) {
                const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
                if (isCollapsed && hubSidebar) {
                    hubSidebar.classList.add('collapsed');
                }
            }
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
                    if (backdrop) {
                        backdrop.classList.toggle('active', isOpen);
                    }
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

        if (hubSidebar) {
            hubSidebar.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 860) {
                        closeMobileSidebar();
                    }
                });
            });
        }

        // Permite navegação direta dos botões de módulos (Relatórios -> /?tab=relatorios, Automações -> /?tab=automacoes)

        // Resolução dinâmica de links caso esteja no file://
        if (window.location.protocol === 'file:') {
            const sideLinkOficios = document.getElementById('sideLinkOficios');
            const sideLinkExati = document.getElementById('sideLinkExati');
            const sideLinkSala = document.getElementById('sideLinkSala');
            const tabBtnHome = document.getElementById('tabBtnHome');
            const mainBrandLogo = document.getElementById('mainBrandLogo');

            const currentPath = window.location.pathname.replace(/\\/g, '/');
            if (currentPath.includes('01 - Consulta de Of')) {
                if (tabBtnHome) tabBtnHome.href = '../../00 - HUB/index.html';
                if (mainBrandLogo) mainBrandLogo.href = '../../00 - HUB/index.html';
                if (sideLinkOficios) sideLinkOficios.href = './index.html';
                if (sideLinkExati) sideLinkExati.href = '../../02 - Monitor Exati/index.html';
                if (sideLinkSala) sideLinkSala.href = '../../02 - Automações/01 - Sala de Agentes/index.html';
            } else if (currentPath.includes('02 - Monitor Exati')) {
                if (tabBtnHome) tabBtnHome.href = '../00 - HUB/index.html';
                if (mainBrandLogo) mainBrandLogo.href = '../00 - HUB/index.html';
                if (sideLinkOficios) sideLinkOficios.href = '../01 - Consulta de Ofícios/templates/index.html';
                if (sideLinkExati) sideLinkExati.href = './index.html';
                if (sideLinkSala) sideLinkSala.href = '../02 - Automações/01 - Sala de Agentes/index.html';
            }
        }

        // Garante carregamento da Rádio Barretos FM em todo o ecossistema
        if (!window.RadioBarretos && !document.querySelector('script[src*="radio.js"]')) {
            const radioScript = document.createElement('script');
            radioScript.src = '/js/radio.js';
            radioScript.defer = true;
            document.head.appendChild(radioScript);
        }

        initSidebarState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSidebar);
    } else {
        setupSidebar();
    }
})();
