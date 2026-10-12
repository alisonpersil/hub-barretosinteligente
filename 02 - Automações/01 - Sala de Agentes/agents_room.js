/**
 * Barretos Inteligente - Sala de Agentes Autônomos (AI Operations Room)
 * Motor Procedural SVG em Pixel Art & Sistema de Orquestração dos 5 Agentes
 */

(function () {
    'use strict';

    // Definição dos 5 Agentes
    const AGENTS_DATA = {
        cco: {
            id: 'cco',
            name: 'Agente CCO',
            role: 'Orquestrador & Supervisor',
            color: '#0ea5e9',
            deskIndex: 0,
            x: 180,
            y: 190,
            status: 'idle',
            bubbleText: 'CCO Operacional • Aguardando comandos'
        },
        exati: {
            id: 'exati',
            name: 'Agente Exati',
            role: 'Operações & Iluminação',
            color: '#f59e0b',
            deskIndex: 1,
            x: 360,
            y: 190,
            status: 'idle',
            bubbleText: 'Base Exati conectada • 0 incidentes'
        },
        oficios: {
            id: 'oficios',
            name: 'Agente Ofícios',
            role: 'Inteligência Documental',
            color: '#10b981',
            deskIndex: 2,
            x: 540,
            y: 190,
            status: 'idle',
            bubbleText: 'Base de 1.500+ ofícios auditada'
        },
        qa: {
            id: 'qa',
            name: 'Agente QA',
            role: 'Auditor do Site',
            color: '#38bdf8',
            deskIndex: 3,
            x: 270,
            y: 330,
            status: 'idle',
            bubbleText: 'Rotas Mobile & Desktop 100% OK'
        },
        book: {
            id: 'book',
            name: 'Agente Book',
            role: 'Curador de Inovações',
            color: '#a78bfa',
            deskIndex: 4,
            x: 450,
            y: 330,
            status: 'idle',
            bubbleText: 'Book de Governança atualizado'
        }
    };

    const stageEl = document.getElementById('officeStage');
    const stageSvg = document.getElementById('stageSvg');
    const terminalLogs = document.getElementById('terminalLogs');
    const cmdInput = document.getElementById('cmdInput');
    const btnSendCmd = document.getElementById('btnSendCmd');

    function logTerminal(agentKey, message) {
        if (!terminalLogs) return;
        const now = new Date().toLocaleTimeString('pt-BR');
        const agent = AGENTS_DATA[agentKey] || { name: 'Sistema', color: '#94a3b8' };

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">[${now}]</span>
            <span class="log-tag tag-${agentKey}">[${agent.name}]:</span>
            <span class="log-msg">${message}</span>
        `;
        terminalLogs.appendChild(entry);
        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }

    // Renderiza a sala em SVG puro (Grid, Mesas, Computadores e Personagens em Pixel Art)
    function renderOfficeScene() {
        if (!stageSvg) return;

        stageSvg.innerHTML = `
            <defs>
                <pattern id="pixelFloor" width="20" height="20" patternUnits="userSpaceOnUse">
                    <rect width="20" height="20" fill="transparent" />
                    <rect x="0" y="0" width="20" height="1" fill="var(--room-grid)" opacity="0.3" />
                    <rect x="0" y="0" width="1" height="20" fill="var(--room-grid)" opacity="0.3" />
                </pattern>
                <filter id="monitorGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <!-- Piso com Grid Suave -->
            <rect width="100%" height="100%" fill="url(#pixelFloor)" />

            <!-- Servidores & Máquina de Café no Fundo -->
            <g id="decorations">
                <!-- Racks de Servidores à Esquerda -->
                <rect x="30" y="30" width="55" height="110" rx="4" fill="#1e293b" stroke="#334155" stroke-width="2" />
                <rect x="36" y="40" width="43" height="6" fill="#0ea5e9" opacity="0.8" />
                <rect x="36" y="52" width="43" height="6" fill="#10b981" opacity="0.8" />
                <rect x="36" y="64" width="43" height="6" fill="#0ea5e9" opacity="0.8" />
                <circle cx="70" cy="85" r="3" fill="#10b981" />
                <circle cx="60" cy="85" r="3" fill="#38bdf8" />
                <circle cx="50" cy="85" r="3" fill="#f59e0b" />

                <!-- Máquina de Café à Direita -->
                <rect x="660" y="40" width="45" height="60" rx="4" fill="#334155" />
                <rect x="668" y="70" width="16" height="14" fill="#0f172a" />
                <circle cx="676" cy="78" r="4" fill="#f8fafc" />
                <text x="682" y="30" fill="#94a3b8" font-size="10" font-family="sans-serif">CAFÉ</text>
            </g>

            <!-- As 5 Mesas dos Agentes -->
            <g id="workstations">
                ${renderWorkstation(AGENTS_DATA.cco)}
                ${renderWorkstation(AGENTS_DATA.exati)}
                ${renderWorkstation(AGENTS_DATA.oficios)}
                ${renderWorkstation(AGENTS_DATA.qa)}
                ${renderWorkstation(AGENTS_DATA.book)}
            </g>
        `;

        renderAllBubbles();
    }

    function renderWorkstation(agent) {
        const isBusy = agent.status === 'busy';
        const monitorColor = isBusy ? '#10b981' : (agent.color || '#38bdf8');
        const screenGlow = isBusy ? 'filter="url(#monitorGlow)"' : '';

        return `
            <g id="station-${agent.id}" class="workstation-group" style="cursor: pointer;" onclick="window.selectAgent('${agent.id}')">
                <!-- Mesa de Trabalho -->
                <rect x="${agent.x - 42}" y="${agent.y - 10}" width="84" height="42" rx="6" fill="var(--room-desk)" stroke="var(--border-color)" stroke-width="1.5" />
                
                <!-- Monitor Principal -->
                <rect x="${agent.x - 18}" y="${agent.y - 28}" width="36" height="24" rx="3" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
                <rect x="${agent.x - 15}" y="${agent.y - 25}" width="30" height="18" rx="2" fill="${monitorColor}" ${screenGlow} opacity="${isBusy ? '1' : '0.6'}" />
                <!-- Suporte do Monitor -->
                <rect x="${agent.x - 3}" y="${agent.y - 4}" width="6" height="6" fill="#334155" />

                <!-- Teclado & Mouse -->
                <rect x="${agent.x - 12}" y="${agent.y + 4}" width="24" height="8" rx="2" fill="#475569" />
                <circle cx="${agent.x + 18}" cy="${agent.y + 8}" r="3" fill="#64748b" />

                <!-- Cadeira / Agente Sentado -->
                <g id="character-${agent.id}" transform="translate(${agent.x}, ${agent.y + 35})">
                    <!-- Sombra -->
                    <ellipse cx="0" cy="18" rx="14" ry="5" fill="rgba(0,0,0,0.15)" />
                    <!-- Corpo / Roupa -->
                    <rect x="-10" y="-2" width="20" height="18" rx="4" fill="${agent.color}" />
                    <!-- Cabeça / Pele -->
                    <circle cx="0" cy="-12" r="9" fill="#fbcfe8" />
                    <!-- Cabelo / Acessório -->
                    <path d="M-9 -16 C-9 -24 9 -24 9 -16 Z" fill="#1e293b" />
                    <!-- Crachá / Marcador -->
                    <rect x="-4" y="2" width="8" height="6" rx="1" fill="#ffffff" />
                </g>

                <!-- Plaquinha com Nome na Mesa -->
                <rect x="${agent.x - 34}" y="${agent.y + 22}" width="68" height="14" rx="3" fill="#0f172a" />
                <text x="${agent.x}" y="${agent.y + 32}" fill="#f8fafc" font-size="8.5" font-weight="700" text-anchor="middle" font-family="sans-serif">${agent.name}</text>
            </g>
        `;
    }

    function renderAllBubbles() {
        if (!stageEl) return;
        
        // Remove balões existentes
        stageEl.querySelectorAll('.agent-bubble').forEach(b => b.remove());

        Object.values(AGENTS_DATA).forEach(agent => {
            if (agent.bubbleText) {
                const bubble = document.createElement('div');
                bubble.id = `bubble-${agent.id}`;
                bubble.className = 'agent-bubble';
                bubble.textContent = agent.bubbleText;
                
                // Converte coordenadas do SVG para porcentagem do container
                const leftPct = (agent.x / 750) * 100;
                const topPct = ((agent.y - 35) / 480) * 100;
                bubble.style.left = `${leftPct}%`;
                bubble.style.top = `${topPct}%`;

                stageEl.appendChild(bubble);
            }
        });
    }

    // Ações do Agente (Mudança de status, digitação e logs)
    async function triggerAgentAction(agentKey, taskDescription, bubbleMsg, logMsg, durationMs = 3000) {
        const agent = AGENTS_DATA[agentKey];
        if (!agent) return;

        agent.status = 'busy';
        agent.bubbleText = bubbleMsg || 'Executando tarefa...';
        renderOfficeScene();
        logTerminal(agentKey, `Iniciando: ${taskDescription}`);

        // Atualiza pill na lista lateral
        const rosterPill = document.getElementById(`rosterStatus-${agentKey}`);
        if (rosterPill) {
            rosterPill.className = 'agent-status-pill busy';
            rosterPill.textContent = 'Processando...';
        }

        setTimeout(() => {
            agent.status = 'idle';
            agent.bubbleText = `Concluído: ${taskDescription}`;
            renderOfficeScene();
            logTerminal(agentKey, `Concluído com sucesso: ${logMsg || 'Operação finalizada.'}`);

            if (rosterPill) {
                rosterPill.className = 'agent-status-pill';
                rosterPill.textContent = 'Operacional';
            }
        }, durationMs);
    }

    // Disparo de Comandos Rápidos
    window.dispatchTask = function (type) {
        switch (type) {
            case 'qa':
                triggerAgentAction('qa', 'Auditoria de Rotas Mobile & Desktop', 'Auditando /oficios, /exati e /qa...', 'Todas as 5 rotas responderam 200 OK (Média: 42ms).');
                break;
            case 'exati':
                triggerAgentAction('exati', 'Verificação de Planilhas Exati', 'Validando estrutura das colunas...', 'Base Exati com 100% de integridade estrutural.');
                break;
            case 'oficios':
                triggerAgentAction('oficios', 'Varredura da Base de Documentos', 'Indexando novos prazos de ofícios...', '1.512 documentos validados e sincronizados.');
                break;
            case 'book':
                triggerAgentAction('book', 'Curadoria de Inovações do Contrato', 'Catalogando nova versão no Book...', 'Novo verbete arquivado: "Sala de Agentes Autônomos".');
                break;
            case 'cco':
                triggerAgentAction('cco', 'Checkup Geral do Centro de Controle', 'Sincronizando os 5 agentes...', 'Status operacional nominal em todos os 5 postos.');
                break;
        }
    };

    window.selectAgent = function (agentKey) {
        const agent = AGENTS_DATA[agentKey];
        if (!agent) return;
        logTerminal(agentKey, `Posto selecionado: ${agent.name} (${agent.role}). Aguardando instrução.`);
    };

    // Envio de Comando Customizado pelo Console
    function handleCustomCommand() {
        if (!cmdInput) return;
        const text = cmdInput.value.trim();
        if (!text) return;

        cmdInput.value = '';
        logTerminal('cco', `Comando recebido: "${text}"`);

        // Heurística de direcionamento inteligente do comando
        const lower = text.toLowerCase();
        if (lower.includes('oficio') || lower.includes('document')) {
            triggerAgentAction('oficios', text, `Tratando "${text}"...`, `Auditoria de ofício concluída.`);
        } else if (lower.includes('exati') || lower.includes('luz') || lower.includes('ilumina')) {
            triggerAgentAction('exati', text, `Processando dados operacionais...`, `Concluído para Exati.`);
        } else if (lower.includes('qa') || lower.includes('teste') || lower.includes('erro') || lower.includes('rota')) {
            triggerAgentAction('qa', text, `Executando suite de testes QA...`, `Auditoria do site concluída.`);
        } else if (lower.includes('book') || lower.includes('inova') || lower.includes('registro')) {
            triggerAgentAction('book', text, `Atualizando Book com nova entrada...`, `Catalogado no Book de Governança.`);
        } else {
            triggerAgentAction('cco', text, `Processando via Gemini Pro...`, `Instrução atendida com sucesso.`);
        }
    }

    if (btnSendCmd) btnSendCmd.addEventListener('click', handleCustomCommand);
    if (cmdInput) {
        cmdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleCustomCommand();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderOfficeScene();
        logTerminal('cco', 'Sala de Operações inicializada. 5 agentes conectados e prontos para despacho.');
    });
})();
