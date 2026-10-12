/**
 * Barretos Inteligente - Painel de QA & Saúde do Sistema
 * Motor de Auditoria Autônoma de Rotas, Performance e UX Mobile
 */

(function () {
    'use strict';

    const ROUTES_TO_TEST = [
        { name: "Central HUB (Home)", path: "/", category: "Core", target: 200 },
        { name: "Consulta de Ofícios", path: "/oficios", category: "Relatórios", target: 200 },
        { name: "Monitor Exati", path: "/exati", category: "Relatórios", target: 200 },
        { name: "API Status & Nuvem", path: "/api/system/status", category: "Backend", target: 200 },
        { name: "API Ofícios Index", path: "/api/oficios", category: "Backend", target: 200 }
    ];

    const btnRunAudit = document.getElementById('btnRunAudit');
    const tableBody = document.getElementById('qaTableBody');
    const scoreVal = document.getElementById('qaScoreVal');
    const responseTimeVal = document.getElementById('qaResponseTimeVal');
    const lastAuditVal = document.getElementById('qaLastAuditVal');
    const passCountBadge = document.getElementById('qaPassCountBadge');

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
                note = ok ? "Operacional (200 OK)" : `Status HTTP ${status}`;
            } catch (err) {
                // Fallback para GET se HEAD for bloqueado
                try {
                    const resGet = await fetch(route.path, { method: 'GET', cache: 'no-cache' });
                    status = resGet.status;
                    ok = (status >= 200 && status < 400);
                    note = ok ? "Operacional (200 OK)" : `Erro de rota ${status}`;
                } catch (e2) {
                    status = 0;
                    ok = false;
                    note = "Sem resposta / Timeout";
                }
            }

            const duration = Math.round(performance.now() - start);
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

        // Atualiza UI
        renderTable(results);
        if (scoreVal) scoreVal.textContent = `${score}%`;
        if (responseTimeVal) responseTimeVal.textContent = `${avgTime}ms`;
        if (lastAuditVal) lastAuditVal.textContent = formattedDate;
        if (passCountBadge) passCountBadge.textContent = `${passCount}/${ROUTES_TO_TEST.length} Aprovadas`;

        // Salva histórico no LocalStorage
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
                <td>${res.category}</td>
                <td>
                    <span class="status-pill ${res.ok ? 'pass' : 'fail'}">
                        <span class="status-dot"></span>
                        ${res.ok ? 'Aprovado' : 'Atenção'}
                    </span>
                </td>
                <td><strong>${res.duration}ms</strong></td>
                <td>${res.note}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function loadSavedAudit() {
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
                    return;
                }
            }
        } catch (_) {}

        // Se não houver auditoria salva, roda uma automática
        runAudit();
    }

    if (btnRunAudit) {
        btnRunAudit.addEventListener('click', runAudit);
    }

    document.addEventListener('DOMContentLoaded', loadSavedAudit);
})();
