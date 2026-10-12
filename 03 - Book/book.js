/**
 * Barretos Inteligente - Livro de Governança & Inovações (Book)
 * Renderizador Dinâmico de Marcos Tecnológicos
 */

(function () {
    'use strict';

    const timelineContainer = document.getElementById('timelineContainer');
    const totalInnovationsCount = document.getElementById('totalInnovationsCount');

    // Fallback integrado caso fetch seja bloqueado (ex: file://)
    const DEFAULT_ENTRIES = [
        {
            title: "Arquitetura Bimodal CCO & PMO (Light/Dark Mode)",
            category: "UX & Acessibilidade",
            badge: "Design System",
            impact: "Alternância instantânea de tema (modo corporativo diurno e modo escuro CCO) com persistência no LocalStorage e sincronização entre todas as aplicações do ecossistema.",
            date: "Outubro 2026",
            author: "Alison Persil",
            version: "v1.2.0"
        },
        {
            title: "Paginação Dinâmica de Documentos (15 por Página)",
            category: "Performance & Dados",
            badge: "Otimização",
            impact: "Eliminação de sobrecarga em conexões móveis através de paginação sob demanda dos mais de 1.500 ofícios catalogados, com busca instantânea e ordenação em memória.",
            date: "Outubro 2026",
            author: "Alison Persil",
            version: "v1.3.0"
        },
        {
            title: "Sentinela de Backdrop & Sincronização Mobile (History API)",
            category: "Engenharia de Frontend",
            badge: "Resiliência",
            impact: "Resolução definitiva de travamentos em smartphones: limpeza imediata do backdrop ao alternar abas e sincronização da URL via History API, garantindo recarregamento fiel na Home.",
            date: "Outubro 2026",
            author: "Alison Persil",
            version: "v1.4.0"
        },
        {
            title: "Sala de Operações com Agentes Autônomos (Pixel Art SVG)",
            category: "Inteligência Artificial & Automação",
            badge: "Inovação",
            impact: "Criação do posto virtual com 5 agentes especializados (CCO, Exati, Ofícios, QA e Book), operando em motor SVG ultraleve com despacho remoto de comandos pelo smartphone e inteligência Gemini Pro.",
            date: "Outubro 2026",
            author: "Alison Persil",
            version: "v2.0.0"
        },
        {
            title: "Painel de Auditoria & QA do Site Contínuo",
            category: "Qualidade & Disponibilidade",
            badge: "Governança",
            impact: "Supervisão automatizada de status HTTP (200 OK), latência de carregamento na Vercel e matriz de conformidade responsiva para prestação de contas à gestão pública.",
            date: "Outubro 2026",
            author: "Alison Persil",
            version: "v2.1.0"
        }
    ];

    async function loadEntries() {
        let entries = DEFAULT_ENTRIES;

        try {
            const res = await fetch('./book_entries.json');
            if (res.ok) {
                entries = await res.json();
            }
        } catch (_) {}

        renderTimeline(entries);
        if (totalInnovationsCount) {
            totalInnovationsCount.textContent = entries.length;
        }
    }

    function renderTimeline(entries) {
        if (!timelineContainer) return;
        timelineContainer.innerHTML = '';

        entries.forEach(item => {
            const el = document.createElement('div');
            el.className = 'timeline-item';
            el.innerHTML = `
                <div class="timeline-marker"></div>
                <div class="timeline-card">
                    <div class="card-top-bar">
                        <span class="card-badge">${item.badge || item.category}</span>
                        <span class="card-date">${item.date}</span>
                    </div>
                    <h2>${item.title}</h2>
                    <p>${item.impact}</p>
                    <div class="card-footer-meta">
                        <span class="author-tag">
                            <i class="fa-solid fa-user-check"></i>
                            ${item.author || 'Alison Persil'}
                        </span>
                        <span style="font-family: monospace; font-weight: 700; color: #8b5cf6;">${item.version || 'v1.0.0'}</span>
                    </div>
                </div>
            `;
            timelineContainer.appendChild(el);
        });
    }

    document.addEventListener('DOMContentLoaded', loadEntries);
})();
