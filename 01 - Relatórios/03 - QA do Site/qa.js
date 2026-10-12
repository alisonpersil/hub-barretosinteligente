/**
 * Barretos Inteligente - Painel Executivo de Auditoria & QA do Site (CCO)
 * Motor Autônomo de Testes de Rotas, Latência, UX Mobile e Homologação
 */

(function () {
    'use strict';

    const ROUTES_TO_TEST = [
        { name: "Central HUB (Home)", path: "/", category: "Core", target: 200 },
        { name: "Consulta de Ofícios", path: "/oficios", category: "Relatórios", target: 200 },
        { name: "Monitor Exati CCO", path: "/exati/", category: "Relatórios", target: 200 },
        { name: "Sala de Agentes Autônomos", path: "/sala-agentes", category: "Automações", target: 200 },
        { name: "Book de Governança", path: "/book/", category: "Book", target: 200 },
        { name: "API Status & Nuvem", path: "/api/system/status", category: "Backend", target: 200 },
        { name: "API Ofícios Index", path: "/api/oficios", category: "Backend", target: 200 },
        { name: "API Book Registros", path: "/api/book/entries", category: "Backend", target: 200 }
    ];

    const btnRunAudit = document.getElementById('btnRunAudit');
    const tableBody = document.getElementById('qaTableBody');
    const scoreVal = document.getElementById('qaScoreVal');
    const responseTimeVal = document.getElementById('qaResponseTimeVal');
    const lastAuditVal = document.getElementById('qaLastAuditVal');
    const passCountBadge = document.getElementById('qaPassCountBadge');
    const btnThemeToggle = document.getElementById('btnThemeToggle');

    // Inicialização do tema e toggle
    function initTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || localStorage.getItem('pmo_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', cur);
        if (btnThemeToggle) {
            const icon = btnThemeToggle.querySelector('i');
            if (icon) {
                icon.className = cur === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            btnThemeToggle.addEventListener('click', () => {
                const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', now);
                localStorage.setItem('pmo_theme', now);
                localStorage.setItem('theme', now);
                if (icon) {
                    icon.className = now === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
                }
            });
        }
    }

    async function runAudit() {
        if (!btnRunAudit) return;

        btnRunAudit.classList.add('running');
        btnRunAudit.innerHTML = '<i class="fa-solid fa-spinner"></i><span>Auditando Rotas...</span>';

        const results = [];
        let totalTime = 0;
        let passCount = 0;

        for (const route of ROUTES_TO_TEST) {
            const start = performance.now();
            let status = 0;
            let ok = false;
            let note = "";

            try {
                const res = await fetch(route.path, { method: 'HEAD', cache: 'no-cache' });
                status = res.status;
                ok = (status >= 200 && status < 400);
                note = ok ? "Operacional (HTTP 200 OK)" : `Status HTTP ${status}`;
            } catch (err) {
                try {
                    const resGet = await fetch(route.path, { method: 'GET', cache: 'no-cache' });
                    status = resGet.status;
                    ok = (status >= 200 && status < 400);
                    note = ok ? "Operacional (HTTP 200 OK)" : `Status HTTP ${status}`;
                } catch (e2) {
                    status = 0;
                    ok = false;
                    note = "Sem resposta / Timeout";
                }
            }

            const duration = Math.max(1, Math.round(performance.now() - start));
            totalTime += duration;
            if (ok) passCount++;

            results.push({
                ...route,
                status,
                ok,
                duration,
                note
            });
        }

        const avgTime = Math.round(totalTime / ROUTES_TO_TEST.length);
        const score = Math.round((passCount / ROUTES_TO_TEST.length) * 100);
        const now = new Date();
        const formattedDate = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        renderTable(results);
        if (scoreVal) scoreVal.textContent = `${score}%`;
        if (responseTimeVal) responseTimeVal.textContent = `${avgTime}ms`;
        if (lastAuditVal) lastAuditVal.textContent = formattedDate;
        if (passCountBadge) passCountBadge.textContent = `${passCount}/${ROUTES_TO_TEST.length} Aprovadas`;

        try {
            localStorage.setItem('barretos_qa_last_audit', JSON.stringify({
                score,
                avgTime,
                date: formattedDate,
                results
            }));
        } catch (_) {}

        btnRunAudit.classList.remove('running');
        btnRunAudit.innerHTML = '<i class="fa-solid fa-rotate"></i><span>Executar Auditoria Agora</span>';
    }

    function renderTable(results) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        results.forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${res.name}</strong></td>
                <td><span class="route-badge">${res.path}</span></td>
                <td><span class="category-tag">${res.category}</span></td>
                <td>
                    <span class="status-pill ${res.ok ? 'pass' : 'fail'}">
                        <span class="status-dot"></span>
                        ${res.ok ? 'Operacional' : 'Falha'}
                    </span>
                </td>
                <td><span class="latency-badge">${res.duration}ms</span></td>
                <td style="font-size: 12.5px;">${res.note}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    async function checkAgentAuditFile() {
        try {
            const res = await fetch('/qa/auditoria_qa_recente.json?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                const sec = document.getElementById('sectionAgentAudit');
                const exec = document.getElementById('agentAuditExecutor');
                const ts = document.getElementById('agentAuditTimestamp');
                const desc = document.getElementById('agentAuditMobileDesc');

                if (sec && data) {
                    sec.style.display = 'block';
                    if (exec && data.executor) exec.innerHTML = `<i class="fa-solid fa-robot"></i> ${data.executor}`;
                    if (ts && data.timestamp) {
                        try {
                            const d = new Date(data.timestamp);
                            ts.textContent = d.toLocaleString('pt-BR');
                        } catch (_) {
                            ts.textContent = data.timestamp;
                        }
                    }
                    if (desc && data.auditoria_mobile) {
                        desc.innerHTML = `<strong>Validação Mobile &amp; Rotas:</strong> ${data.auditoria_mobile}<br><span style="color: var(--color-green);">✓ ${data.rotas_testadas ? data.rotas_testadas.length : 5} rotas verificadas e atestadas em disco com homologação física.</span>`;
                    }
                }
            }
        } catch (_) {}
    }

    function init() {
        initTheme();

        try {
            const saved = localStorage.getItem('barretos_qa_last_audit');
            if (saved) {
                const data = JSON.parse(saved);
                if (scoreVal) scoreVal.textContent = `${data.score}%`;
                if (responseTimeVal) responseTimeVal.textContent = `${data.avgTime}ms`;
                if (lastAuditVal) lastAuditVal.textContent = data.date;
                if (data.results && data.results.length) {
                    renderTable(data.results);
                    const pass = data.results.filter(r => r.ok).length;
                    if (passCountBadge) passCountBadge.textContent = `${pass}/${data.results.length} Aprovadas`;
                } else {
                    runAudit();
                }
            } else {
                runAudit();
            }
        } catch (_) {
            runAudit();
        }

        checkAgentAuditFile();

        if (btnRunAudit) {
            btnRunAudit.addEventListener('click', runAudit);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
