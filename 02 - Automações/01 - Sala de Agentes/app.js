/**
 * Sala de Agentes Autônomos — Barretos Inteligente HUB
 * Motor Executivo de Gestão de Agentes, Tarefas, Fila e Histórico
 */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const states = {
  trabalhando: 'Trabalhando',
  delegando: 'Delegando',
  aguardando: 'Aguardando',
  concluida: 'Concluída',
  orfa: 'Órfã'
};

let projects = [];
let sessions = [];
let dashboard = { execucoes: [], resumo: {} };
let editingId = null;
let selected = null;
let viewMode = 'office';
const visualRuns = new Map();

// Estado do Agente Selecionado para a Gaveta
let currentDrawerAgentKey = null;
let currentDrawerAgentData = null;
let currentDrawerActiveTab = 'live-task';

// Presets de Sugestões Rápidas por Agente (desativado para evitar tarefas automáticas/recorrentes)
const AGENT_TEMPLATES = {};

const AGENT_ICONS = {
  'p0-chefe': 'fa-solid fa-user-tie',
  'p3-main': 'fa-solid fa-user-tie',
  'p3-exati': 'fa-solid fa-chart-line',
  'p3-oficios': 'fa-solid fa-folder-open',
  'p1-qa': 'fa-solid fa-shield-halved',
  'p3-book': 'fa-solid fa-book-bookmark',
  'p1-main': 'fa-solid fa-diagram-project',
  'p2-main': 'fa-solid fa-diagram-project',
  'default': 'fa-solid fa-robot'
};

/* ------------------------------------------------------------- Requisições */
async function request(method, path, body) {
  const response = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.error || 'Não foi possível concluir a ação.');
  return data;
}

function notice(message, error = false) {
  const target = $('#notice');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('error', error);
  target.hidden = false;
  setTimeout(() => {
    target.hidden = true;
  }, 4500);
}

/* ----------------------------------------------------------- Conversão Visual */
function visualId(value) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function officeData() {
  const rooms = new Map();
  visualRuns.clear();
  for (const run of dashboard.execucoes) {
    const key = run.projeto_id ? `p${run.projeto_id}` : `c${String(run.cwd || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()}`;
    const room = rooms.get(key) || { chave: key, nome: run.projeto_nome || 'Sem projeto', projeto_id: run.projeto_id, cwd: run.cwd, ativos: 0, execucoes: [] };
    const id = visualId(run.chave);
    visualRuns.set(String(id), run);
    room.execucoes.push({
      id,
      session_id: run.session_id,
      agent_id: run.agent_id,
      tipo_agente: run.agent_id ? run.tipo : 'principal',
      status: run.estado,
      execucao_pai_id: run.pai_chave ? visualId(run.pai_chave) : null,
      duracao_segundos: Math.max(0, Math.floor((Date.now() - Date.parse(run.criado_em)) / 1000)),
      desde_segundos: Math.max(0, Math.floor((Date.now() - Date.parse(run.atualizado_em)) / 1000)),
    });
    if (['trabalhando', 'delegando', 'aguardando'].includes(run.estado)) room.ativos += 1;
    rooms.set(key, room);
  }
  return { salas: [...rooms.values()] };
}

/* -------------------------------------------------------------- Render Sala */
function renderRoom() {
  const counts = dashboard.resumo || {};
  const metrics = [
    ['verde', 'Trabalhando', counts.trabalhando ?? 0],
    ['azul', 'Delegando', counts.delegando ?? 0],
    ['laranja', 'Aguardando', counts.aguardando ?? 0],
    ['roxo', 'Projetos ativos', new Set((dashboard.execucoes || []).filter((run) => ['trabalhando', 'delegando', 'aguardando'].includes(run.estado) && run.projeto_id).map((run) => run.projeto_id)).size || 3],
  ];

  const summaryEl = $('#office-summary');
  if (summaryEl) {
    const radioCard = $('#cardRadioBarretos');
    const metricsHtml = metrics.map(([color, label, value]) => `
      <article class="kpi">
        <span class="kpi-rotulo"><i class="ponto ${color}"></i>${label}</span>
        <strong class="kpi-valor">${value}</strong>
      </article>
    `).join('');

    if (!radioCard) {
      summaryEl.innerHTML = metricsHtml + `
        <article class="kpi kpi-radio-card" id="cardRadioBarretos" role="button" tabindex="0" title="Barretos Inteligente FM • Clique para ouvir (Transmissão global contínua)">
          <div class="kpi-radio-inner">
            <img src="/banner_radio_barretos_inteligente_quadrado.svg" alt="Barretos Inteligente FM" class="kpi-radio-banner" draggable="false" />
            <div class="kpi-radio-badge">
              <i class="radio-live-dot"></i>
              <span class="radio-badge-text">AO VIVO</span>
            </div>
            <div class="kpi-radio-eq" title="Equalizador FM">
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
            </div>
            <div class="kpi-radio-footer">
              <span class="kpi-radio-track-title">Sintonizar Rádio</span>
            </div>
          </div>
        </article>
      `;

      const newRadioCard = $('#cardRadioBarretos');
      if (newRadioCard) {
        newRadioCard.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (window.RadioBarretos) {
            window.RadioBarretos.toggle();
          }
        });
      }
    } else {
      const cards = summaryEl.querySelectorAll('.kpi:not(.kpi-radio-card)');
      if (cards.length === metrics.length) {
        metrics.forEach(([color, label, value], idx) => {
          const valEl = cards[idx].querySelector('.kpi-valor');
          if (valEl) valEl.textContent = value;
        });
      }
    }
  }

  const concluidas = counts.concluidas || 0;
  const orfas = counts.orfas || 0;
  const ultimo = counts.ultimo_evento || 'Standby permanente';

  const statusText = $('#agentsStatusText');
  if (statusText) {
    statusText.textContent = `${counts.aguardando || 12} agentes em standby`;
  }

  const opBar = $('#operation-bar');
  if (opBar) {
    opBar.innerHTML = `
      <span class="ao-vivo" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.35);"><i style="background: #10b981; box-shadow: 0 0 8px #10b981;"></i>MODO PROTEGIDO</span>
      <span>Zero tarefas automáticas</span>
      <span class="sep">·</span>
      <span>0 tarefas em andamento</span>
      <span class="sep">·</span>
      <span>Todas as tarefas canceladas</span>
      <span class="sep">·</span>
      <span>Aguardando autorização manual do operador (PIN)</span>
    `;
  }

  const room = $('#office-room');
  if (!room) return;

  if (viewMode === 'panel') {
    if (window.EscritorioPixel?.montado()) window.EscritorioPixel.destruir();
    room.innerHTML = `
      <div class="panel-table" role="region" aria-label="Painel de execuções">
        <table>
          <thead>
            <tr>
              <th>Agente</th>
              <th>Projeto</th>
              <th>Estado</th>
              <th>Atualização</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${(dashboard.historico || []).map((run) => `
              <tr data-session="${esc(run.session_id)}" tabindex="0">
                <td><strong>${esc(run.tipo)}</strong></td>
                <td>${esc(run.projeto_nome || run.cwd || 'Sem projeto')}</td>
                <td><span class="popover-badge ${esc(run.estado)}">${esc(states[run.estado] || run.estado)}</span></td>
                <td>${esc(new Date(run.atualizado_em).toLocaleTimeString('pt-BR'))}</td>
                <td>
                  <button type="button" class="btn-queue-action" onclick="openAgentDrawerByTipo('${esc(run.tipo)}')">
                    <i class="fa-solid fa-list-check"></i> Gestão
                  </button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5">Nenhuma execução no período.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  const data = officeData();
  if (!data.salas.length) {
    if (window.EscritorioPixel?.montado()) window.EscritorioPixel.destruir();
    room.innerHTML = '<p class="empty room-empty">Nenhuma sessão recebida no momento.</p>';
    return;
  }

  if (window.EscritorioPixel?.montado()) {
    window.EscritorioPixel.atualizar(data);
  } else {
    window.EscritorioPixel?.montar(room, data, {
      historico: () => dashboard.historico_tipos || {},
      trajeto: () => $('#show-route')?.checked
    });
  }
}

/* ------------------------------------------------------------- Gestão Drawer */
async function openAgentTaskDrawer(agentKey) {
  if (currentDrawerAgentKey !== agentKey) {
    currentDrawerActiveTab = 'live-task';
  }
  currentDrawerAgentKey = agentKey;
  const drawer = $('#agentTaskDrawer');
  const backdrop = $('#drawerBackdrop');
  if (!drawer || !backdrop) return;

  // Carrega dados frescos da API
  try {
    const data = await request('GET', `/agentes/${encodeURIComponent(agentKey)}/tarefas`);
    currentDrawerAgentData = data;
    renderDrawerContent(data);
    switchDrawerTab(currentDrawerActiveTab || 'live-task');
    drawer.classList.add('open');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    notice(`Erro ao carregar tarefas do agente: ${err.message}`, true);
  }
}

function closeAgentTaskDrawer() {
  const drawer = $('#agentTaskDrawer');
  const backdrop = $('#drawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

function renderDrawerContent(agent) {
  if (!agent) return;

  // Header do Drawer
  const avatarEl = $('#drawerAgentAvatar');
  const nameEl = $('#drawerAgentName');
  const subEl = $('#drawerAgentSub');
  const statusEl = $('#drawerStatusPill');
  const queueCountEl = $('#drawerQueueCount');

  const iconClass = AGENT_ICONS[agent.chave] || AGENT_ICONS.default;
  if (avatarEl) avatarEl.innerHTML = `<i class="${iconClass}"></i>`;
  
  // Nome limpo sem (Dify AI)
  const cleanName = (agent.nome || agent.tipo || '').replace(/\s*\((?:Dify AI(?: & GitHub)?|Dify)\)/gi, '').trim();
  if (nameEl) nameEl.textContent = cleanName;
  
  // Oculta completamente o subtítulo abaixo do nome
  if (subEl) {
    subEl.textContent = '';
    subEl.style.display = 'none';
  }
  
  if (statusEl) {
    statusEl.textContent = states[agent.estado] || agent.estado;
    statusEl.className = `drawer-status-pill ${agent.estado}`;
  }

  const fila = agent.fila || [];
  if (queueCountEl) queueCountEl.textContent = fila.length;

  // ABA 1: Tarefa Atual
  renderLiveTaskPane(agent);

  // ABA 2: Fila de Tarefas
  renderTaskQueuePane(agent);

  // ABA 3: Histórico de Conclusões
  renderTaskHistoryPane(agent);

  // ABA 4: Sugestões na Nova Tarefa
  renderNewTaskTemplates(agent.chave);

  // Mantém a aba que o usuário está visualizando no momento
  switchDrawerTab(currentDrawerActiveTab || 'live-task');
}

function renderLiveTaskPane(agent) {
  const container = $('#liveTaskContainer');
  if (!container) return;

  const t = agent.tarefa_atual;
  if (!t) {
    container.innerHTML = `
      <div style="text-align: center; padding: 42px 20px; background: rgba(255,255,255,0.02); border-radius: 14px; border: 1px dashed rgba(52,211,153,0.35);">
        <div style="width: 52px; height: 52px; margin: 0 auto 14px; background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-shield-halved" style="font-size: 24px; color: #34d399;"></i>
        </div>
        <h3 style="color: #fff; font-size: 16px; margin: 0 0 6px;">Agente em Standby • Tokens Protegidos</h3>
        <p style="color: #8f8a9e; font-size: 13px; max-width: 320px; margin: 0 auto 18px; line-height: 1.45;">
          Zero tokens consumidos. As tarefas aguardam com segurança no Backlog e só executam após sua autorização com PIN.
        </p>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn-task-action" style="background: rgba(164,105,255,0.15); border: 1px solid rgba(164,105,255,0.35); color: #c499ff; padding: 8px 14px;" onclick="switchDrawerTab('task-queue')">
            <i class="fa-solid fa-inbox"></i> Ver Backlog / Fila
          </button>
          <button type="button" class="btn-dispatch-submit" style="padding: 8px 14px;" onclick="switchDrawerTab('new-task')">
            <i class="fa-solid fa-plus"></i> Nova Tarefa
          </button>
        </div>
      </div>
    `;
    return;
  }

  const isPaused = agent.estado === 'aguardando';
  const progress = Math.min(100, Math.max(0, t.progresso || 25));

  container.innerHTML = `
    <div class="live-task-card">
      <div class="task-badge-row">
        <span class="live-badge" style="${isPaused ? 'background: rgba(245,158,11,0.15); color: #fbbf24; border-color: rgba(245,158,11,0.35);' : ''}">
          <i style="${isPaused ? 'background: #f59e0b; box-shadow: 0 0 8px #f59e0b;' : ''}"></i>
          ${isPaused ? 'PAUSADO / AGUARDANDO' : 'EM ANDAMENTO'}
        </span>
        <span class="task-priority-badge">Prioridade: ${esc(t.prioridade || 'Alta')}</span>
      </div>

      <h3 class="live-task-title">${esc(t.titulo)}</h3>
      <p class="live-task-desc">${esc(t.descricao || 'Sem descrição informada.')}</p>

      <div class="progress-section">
        <div class="progress-meta">
          <span>Progresso da Operação</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${progress}%;"></div>
        </div>
        ${t.etapa ? `
          <div style="margin-top: 10px; font-size: 12px; color: #c499ff; display: flex; align-items: center; gap: 8px; background: rgba(164,105,255,0.08); padding: 7px 11px; border-radius: 7px; border: 1px solid rgba(164,105,255,0.2);">
            <i class="fa-solid fa-gear fa-spin" style="font-size: 11px; color: #a469ff;"></i>
            <span>${esc(t.etapa)}</span>
          </div>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <div style="background: rgba(255,255,255,0.03); padding: 10px 14px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.05);">
          <span style="display: block; color: #8f8a9e; font-size: 11px; font-weight: 600; margin-bottom: 3px;">TEMPO EM ANDAMENTO</span>
          <strong style="color: #fff; font-size: 14px;">${t.duracao_min || 1} min</strong>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 10px 14px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.05);">
          <span style="display: block; color: #8f8a9e; font-size: 11px; font-weight: 600; margin-bottom: 3px;">PREVISÃO RESTANTE</span>
          <strong style="color: #4ade80; font-size: 14px;">~${(t.previsao_min || 0) > 0 ? t.previsao_min + ' min' : '< 1 min'}</strong>
        </div>
      </div>

      ${t.resultado_ia ? `
        <div style="background: rgba(125,54,236,0.1); border: 1px solid rgba(164,105,255,0.3); border-radius: 10px; padding: 13px; margin-bottom: 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;">
            <span style="color: #d8b4fe; font-size: 11.5px; font-weight: 700; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-sparkles" style="color: #a469ff;"></i> Parecer do Agente (Automação HUB)
            </span>
            <span style="font-size: 10.5px; background: rgba(34,197,94,0.15); color: #4ade80; padding: 1px 7px; border-radius: 4px; font-weight: 600;">
              Resolvido com IA
            </span>
          </div>
          <p style="color: #e6e3f0; font-size: 13px; line-height: 1.5; margin: 0; white-space: pre-wrap;">${esc(t.resultado_ia)}</p>
          <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            ${(agent.chave === 'p3-book' || (t.titulo && t.titulo.toLowerCase().includes('book'))) ? `
              <a href="/book/" target="_blank" style="background: rgba(255,42,133,0.16); color: #ff66aa; border: 1px solid rgba(255,42,133,0.4); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; font-weight: 700; font-size: 11.5px;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Alteração ao Vivo no Book
              </a>
            ` : ''}
            ${(agent.chave === 'p1-qa' || (t.titulo && t.titulo.toLowerCase().includes('qa'))) ? `
              <a href="/qa" target="_blank" style="background: rgba(164,105,255,0.16); color: #c499ff; border: 1px solid rgba(164,105,255,0.4); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; font-weight: 700; font-size: 11.5px;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver no Painel de QA
              </a>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <div class="task-actions-row">
        <button type="button" class="btn-task-action" id="btnDrawerMoveBacklog" title="Pausar e mover para o Backlog para não consumir tokens" style="background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35);">
          <i class="fa-solid fa-inbox"></i>
          <span>Mover para Backlog</span>
        </button>
        <button type="button" class="btn-task-action complete" id="btnDrawerCompleteTask">
          <i class="fa-solid fa-check"></i>
          <span>Concluir Tarefa</span>
        </button>
        <button type="button" class="btn-task-action change" onclick="switchDrawerTab('new-task')">
          <i class="fa-solid fa-arrow-right-arrow-left"></i>
          <span>Mudar Tarefa</span>
        </button>
      </div>
    </div>
  `;

  $('#btnDrawerMoveBacklog')?.addEventListener('click', async () => {
    try {
      const res = await request('POST', '/agentes/tarefas/mover-backlog', { agente_chave: agent.chave });
      await refresh();
      await openAgentTaskDrawer(agent.chave);
      switchDrawerTab('task-queue');
      notice(res.mensagem || 'Tarefa guardada no Backlog com sucesso! Agente em Standby.');
    } catch (e) {
      notice(e.message, true);
    }
  });

  $('#btnDrawerTogglePause')?.addEventListener('click', async () => {
    try {
      if (isPaused) {
        // Retoma a execução sem duplicar tarefas nem acionar chamadas involuntárias
        await request('POST', '/agentes/tarefas/retomar', {
          agente_chave: agent.chave
        });
      } else {
        await request('POST', '/agentes/tarefas/pausar', { agente_chave: agent.chave });
      }
      await refresh();
      await openAgentTaskDrawer(agent.chave);
      notice(isPaused ? 'Agente retomou a tarefa!' : 'Agente colocado em pausa!');
    } catch (e) {
      notice(e.message, true);
    }
  });

  $('#btnDrawerCompleteTask')?.addEventListener('click', async () => {
    try {
      await request('POST', '/agentes/tarefas/concluir', { agente_chave: agent.chave });
      await refresh();
      await openAgentTaskDrawer(agent.chave);
      notice('Tarefa concluída e arquivada com sucesso! Agente em Standby.');
    } catch (e) {
      notice(e.message, true);
    }
  });
}

function renderTaskQueuePane(agent) {
  const container = $('#taskQueueList');
  if (!container) return;

  const fila = agent.fila || [];
  if (!fila.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 14px; color: #8f8a9e; font-size: 13px;">
        <i class="fa-solid fa-list-check" style="font-size: 32px; color: #4b4658; margin-bottom: 12px; display: block;"></i>
        <p style="margin: 0 0 14px;">Nenhuma tarefa na fila de espera deste agente.</p>
        <button type="button" class="btn-dispatch-submit" style="max-width: 200px; margin: 0 auto; padding: 10px;" onclick="switchDrawerTab('new-task')">
          <i class="fa-solid fa-plus"></i> Adicionar à Fila
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = fila.map((item, idx) => `
    <div class="queue-item-card" data-task-id="${esc(item.id)}">
      <div class="queue-item-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: rgba(164,105,255,0.15); color: #c499ff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">#${idx + 1}</span>
          <span class="queue-item-title">${esc(item.titulo)}</span>
        </div>
        <div class="queue-item-actions">
          <button type="button" class="btn-queue-action" title="Executar imediatamente" onclick="promoteQueueTask('${esc(agent.chave)}', '${esc(item.id)}')">
            <i class="fa-solid fa-bolt"></i> Executar Agora
          </button>
          <button type="button" class="btn-queue-action danger" title="Remover da fila" onclick="removeQueueTask('${esc(agent.chave)}', '${esc(item.id)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
      <p style="color: #a8a3b5; font-size: 12.5px; margin: 4px 0 8px; line-height: 1.4;">${esc(item.descricao || 'Sem detalhes adicionais.')}</p>
      <div style="display: flex; gap: 14px; font-size: 11.5px; color: #767084;">
        <span><i class="fa-regular fa-clock"></i> Enfileirado às ${esc(item.adicionado_em || '--:--')}</span>
        <span><i class="fa-solid fa-flag"></i> Prioridade: ${esc(item.prioridade || 'Normal')}</span>
      </div>
    </div>
  `).join('');
}

async function promoteQueueTask(agentKey, taskId) {
  const agent = (dashboard.execucoes || []).find((e) => e.chave === agentKey);
  const targetTask = (currentDrawerAgentData?.fila || []).find((t) => t.id === taskId);
  const taskTitle = targetTask ? targetTask.titulo : 'Executar tarefa da fila';

  requestPinAuthorization({
    title: taskTitle,
    agentKey,
    agentName: currentDrawerAgentData?.tipo || agent?.tipo || 'Agente HUB',
    onAuthorized: async (pin) => {
      try {
        const res = await request('POST', '/agentes/tarefas/promover-fila', {
          agente_chave: agentKey,
          task_id: taskId,
          pin
        });
        await refresh();
        await openAgentTaskDrawer(agentKey);
        notice(res.mensagem || 'Tarefa autorizada com PIN e iniciada!');
      } catch (e) {
        notice(e.message, true);
      }
    }
  });
}

async function removeQueueTask(agentKey, taskId) {
  try {
    await request('POST', '/agentes/tarefas/remover-fila', { agente_chave: agentKey, task_id: taskId });
    await refresh();
    await openAgentTaskDrawer(agentKey);
    notice('Tarefa removida da fila.');
  } catch (e) {
    notice(e.message, true);
  }
}

function renderTaskHistoryPane(agent) {
  const container = $('#taskHistoryList');
  if (!container) return;

  const hist = agent.historico || [];
  if (!hist.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 14px; color: #8f8a9e; font-size: 13px;">
        <i class="fa-solid fa-clock-rotate-left" style="font-size: 32px; color: #4b4658; margin-bottom: 12px; display: block;"></i>
        Nenhuma tarefa concluída recentemente gravada para este agente.
      </div>
    `;
    return;
  }

  container.innerHTML = hist.map((item) => `
    <div class="history-item-card">
      <div class="history-item-top">
        <span class="history-status-badge">
          <i class="fa-solid fa-circle-check"></i> ${esc(item.status === 'concluido' ? 'CONCLUÍDO' : item.status.toUpperCase())}
        </span>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${item.modelo ? `<span style="font-size: 11px; background: rgba(164,105,255,0.14); color: #c499ff; padding: 2px 7px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-sparkles"></i> Automação HUB</span>` : ''}
          <span class="history-time"><i class="fa-regular fa-clock"></i> ${esc(item.concluido_em)} (${esc(item.duracao || '5 min')})</span>
        </div>
      </div>
      <h4 class="history-item-title">${esc(item.titulo)}</h4>
      <div class="history-result-text" style="white-space: pre-wrap; line-height: 1.5; color: #d0cddb;">${esc(item.resultado || 'Execução homologada pelo HUB.')}</div>
      ${(agent.chave === 'p3-book' || item.titulo.toLowerCase().includes('book')) ? `
        <div style="margin-top: 10px;">
          <a href="/book/" target="_blank" style="background: rgba(255,42,133,0.14); color: #ff66aa; border: 1px solid rgba(255,42,133,0.35); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11.5px;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Entrega no Book
          </a>
        </div>
      ` : ''}
      ${(agent.chave === 'p1-qa' || item.titulo.toLowerCase().includes('qa') || item.titulo.toLowerCase().includes('auditoria')) ? `
        <div style="margin-top: 10px;">
          <a href="/qa" target="_blank" style="background: rgba(168,85,247,0.14); color: #c499ff; border: 1px solid rgba(168,85,247,0.35); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11.5px;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Auditoria &amp; QA do Site
          </a>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function renderNewTaskTemplates(agentKey) {
  const pillsWrap = $('#drawerQuickPills');
  if (!pillsWrap) return;

  const templates = AGENT_TEMPLATES[agentKey] || AGENT_TEMPLATES['p3-main'];
  pillsWrap.innerHTML = templates.map((tpl) => `
    <button type="button" class="quick-pill" data-title="${esc(tpl.title)}" data-desc="${esc(tpl.desc)}">
      ${esc(tpl.title.length > 42 ? tpl.title.slice(0, 42) + '...' : tpl.title)}
    </button>
  `).join('');

  pillsWrap.querySelectorAll('.quick-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      $('#drawerTaskTitle').value = pill.dataset.title;
      $('#drawerTaskDesc').value = pill.dataset.desc;
      $('#drawerTaskTitle').focus();
    });
  });
}

function switchDrawerTab(tabName) {
  if (tabName) currentDrawerActiveTab = tabName;
  const activeTab = currentDrawerActiveTab || 'live-task';
  $$('.drawer-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  const panes = {
    'live-task': $('#paneLiveTask'),
    'task-queue': $('#paneTaskQueue'),
    'task-history': $('#paneTaskHistory'),
    'new-task': $('#paneNewTask')
  };
  Object.entries(panes).forEach(([k, el]) => {
    if (el) el.classList.toggle('active', k === activeTab);
  });
}

// Global para chamar por tipo caso venha do painel em tabela
window.openAgentDrawerByTipo = function(tipo) {
  const match = (dashboard.execucoes || []).find((e) => e.tipo.toLowerCase() === tipo.toLowerCase());
  if (match) {
    openAgentTaskDrawer(match.chave);
  } else {
    openAgentTaskDrawer(tipo);
  }
};

/* -------------------------------------------------------- Modais e Controles */
function setupDrawerEvents() {
  $('#btnCloseDrawer')?.addEventListener('click', closeAgentTaskDrawer);
  $('#drawerBackdrop')?.addEventListener('click', closeAgentTaskDrawer);

  $$('.drawer-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchDrawerTab(btn.dataset.tab));
  });

  // Radio cards visuais na aba Nova Tarefa
  $$('input[name="drawerDispatchMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      $$('.dispatch-mode-group .mode-card').forEach((card) => {
        const inp = card.querySelector('input');
        card.classList.toggle('active', inp && inp.checked);
      });
    });
  });

  // Submissão do Formulário de Nova Tarefa do Drawer
  $('#formDrawerNewTask')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentDrawerAgentKey) return;

    const titulo = $('#drawerTaskTitle').value.trim();
    const descricao = $('#drawerTaskDesc').value.trim();
    const modo = $('input[name="drawerDispatchMode"]:checked')?.value || 'agora';
    const acionar_ia = !!$('#drawerTaskUseAi')?.checked;

    if (modo === 'agora') {
      requestPinAuthorization({
        title: titulo,
        agentKey: currentDrawerAgentKey,
        agentName: currentDrawerAgentData?.tipo || 'Agente HUB',
        onAuthorized: async (pin) => {
          try {
            const res = await request('POST', '/agentes/tarefas/criar', {
              agente_chave: currentDrawerAgentKey,
              titulo,
              descricao,
              modo: 'agora',
              prioridade: 'Alta',
              acionar_ia,
              pin
            });

            $('#drawerTaskTitle').value = '';
            $('#drawerTaskDesc').value = '';

            notice(res.mensagem || 'Tarefa autorizada com sucesso!');
            await refresh();
            await openAgentTaskDrawer(currentDrawerAgentKey);
            switchDrawerTab('live-task');
          } catch (err) {
            notice(err.message, true);
          }
        }
      });
    } else {
      try {
        const res = await request('POST', '/agentes/tarefas/criar', {
          agente_chave: currentDrawerAgentKey,
          titulo,
          descricao,
          modo: 'fila',
          prioridade: 'Alta',
          acionar_ia
        });

        $('#drawerTaskTitle').value = '';
        $('#drawerTaskDesc').value = '';

        notice(res.mensagem || 'Tarefa adicionada à fila com sucesso!');
        await refresh();
        await openAgentTaskDrawer(currentDrawerAgentKey);
        switchDrawerTab('task-queue');
      } catch (err) {
        notice(err.message, true);
      }
    }
  });
}

/* ------------------------------------------------------------- PIN Modal */
let pendingPinCallback = null;

function requestPinAuthorization({ title, agentKey, agentName, onAuthorized }) {
  const modal = $('#pinAuthModal');
  const backdrop = $('#pinModalBackdrop');
  const inputPin = $('#inputOperatorPin');
  const errorMsg = $('#pinErrorMessage');

  const agentLabel = agentName || (dashboard.execucoes || []).find((e) => e.chave === agentKey)?.tipo || 'Agente HUB';
  if ($('#pinAgentName')) $('#pinAgentName').textContent = agentLabel;
  if ($('#pinTaskTitle')) $('#pinTaskTitle').textContent = title || 'Execução de Tarefa';

  if (errorMsg) errorMsg.style.display = 'none';
  if (inputPin) {
    inputPin.value = '';
    inputPin.classList.remove('error');
  }

  pendingPinCallback = onAuthorized;

  if (modal) {
    if (typeof modal.showModal === 'function') modal.showModal();
    modal.classList.add('open');
  }
  backdrop?.classList.add('active');
  setTimeout(() => inputPin?.focus(), 80);
}

function closePinModal() {
  const modal = $('#pinAuthModal');
  const backdrop = $('#pinModalBackdrop');
  if (modal) {
    if (typeof modal.close === 'function') modal.close();
    modal.classList.remove('open');
  }
  backdrop?.classList.remove('active');
  pendingPinCallback = null;
}

function setupPinModalEvents() {
  $('#btnClosePinModal')?.addEventListener('click', closePinModal);
  $('#btnCancelPinModal')?.addEventListener('click', closePinModal);
  $('#pinModalBackdrop')?.addEventListener('click', closePinModal);

  $('#formPinAuth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = $('#inputOperatorPin')?.value.trim();
    const errorMsg = $('#pinErrorMessage');
    const btn = $('#btnConfirmPin');

    if (!pin) return;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';
      }
      const check = await request('POST', '/agentes/validar-pin', { pin });
      if (!check.valid) {
        throw new Error(check.error || 'PIN incorreto. Tente novamente.');
      }

      const cb = pendingPinCallback;
      closePinModal();
      if (typeof cb === 'function') {
        await cb(pin);
      }
    } catch (err) {
      if (errorMsg) {
        errorMsg.textContent = err.message || 'PIN incorreto. Tente novamente.';
        errorMsg.style.display = 'block';
      }
      const inputPin = $('#inputOperatorPin');
      if (inputPin) {
        inputPin.value = '';
        inputPin.focus();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Autorizar &amp; Executar';
      }
    }
  });
}

function setupGlobalModalEvents() {
  const modal = $('#globalTaskModal');
  const backdrop = $('#globalModalBackdrop');
  const openBtn = $('#btnOpenGlobalDispatch');
  const closeBtn = $('#btnCloseGlobalModal');
  const cancelBtn = $('#btnCancelGlobalModal');

  function openModal() {
    if (modal) {
      if (typeof modal.showModal === 'function') modal.showModal();
      modal.classList.add('open');
    }
    backdrop?.classList.add('active');
  }

  function closeModal() {
    if (modal) {
      if (typeof modal.close === 'function') modal.close();
      modal.classList.remove('open');
    }
    backdrop?.classList.remove('active');
  }

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  // Quick pills no modal global
  $$('#formGlobalDispatch .quick-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const targetAgent = pill.dataset.target;
      const title = pill.dataset.title;
      if (targetAgent && $('#globalSelectAgent')) $('#globalSelectAgent').value = targetAgent;
      if (title && $('#globalTaskTitle')) $('#globalTaskTitle').value = title;
    });
  });

  // Radio cards visuais no modal global
  $$('input[name="globalDispatchMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      $$('#formGlobalDispatch .mode-card').forEach((card) => {
        const inp = card.querySelector('input');
        card.classList.toggle('active', inp && inp.checked);
      });
    });
  });

  // Submit Modal Global
  $('#formGlobalDispatch')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const agente_chave = $('#globalSelectAgent').value;
    const titulo = $('#globalTaskTitle').value.trim();
    const descricao = $('#globalTaskDesc').value.trim();
    const modo = $('input[name="globalDispatchMode"]:checked')?.value || 'agora';
    const acionar_ia = !!$('#globalTaskUseAi')?.checked;
    const agentObj = (dashboard.execucoes || []).find((x) => x.chave === agente_chave);

    if (modo === 'agora') {
      closeModal();
      requestPinAuthorization({
        title: titulo,
        agentKey: agente_chave,
        agentName: agentObj?.tipo || 'Agente HUB',
        onAuthorized: async (pin) => {
          try {
            const res = await request('POST', '/agentes/tarefas/criar', {
              agente_chave,
              titulo,
              descricao,
              modo: 'agora',
              prioridade: 'Alta',
              acionar_ia,
              pin
            });

            $('#globalTaskTitle').value = '';
            $('#globalTaskDesc').value = '';

            notice(res.mensagem || 'Tarefa autorizada e iniciada com sucesso!');
            await refresh();
            openAgentTaskDrawer(agente_chave);
          } catch (err) {
            notice(err.message, true);
          }
        }
      });
    } else {
      try {
        const res = await request('POST', '/agentes/tarefas/criar', {
          agente_chave,
          titulo,
          descricao,
          modo: 'fila',
          prioridade: 'Alta',
          acionar_ia
        });

        closeModal();
        $('#globalTaskTitle').value = '';
        $('#globalTaskDesc').value = '';

        notice(res.mensagem || 'Tarefa adicionada à fila com sucesso!');
        await refresh();
        openAgentTaskDrawer(agente_chave);
        switchDrawerTab('task-queue');
      } catch (err) {
        notice(err.message, true);
      }
    }
  });
}

function setupThemeToggle() {
  const btn = $('#btnThemeToggle');
  if (!btn) return;

  function updateIcon(theme) {
    const icon = btn.querySelector('i');
    if (icon) {
      if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
        btn.title = 'Alternar para tema claro';
      } else {
        icon.className = 'fa-solid fa-moon';
        btn.title = 'Alternar para tema escuro';
      }
    }
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('pmo_theme') || localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateIcon(currentTheme);

  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('pmo_theme', nextTheme);
      localStorage.setItem('theme', nextTheme);
    } catch (_) {}
    updateIcon(nextTheme);
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'pmo_theme' || e.key === 'theme') {
      if (e.newValue && (e.newValue === 'light' || e.newValue === 'dark')) {
        document.documentElement.setAttribute('data-theme', e.newValue);
        updateIcon(e.newValue);
      }
    }
  });
}

/* ------------------------------------------------------------- Popover / Room */
function showAgentPopover(run, x, y) {
  // Clique direto no agente abre a gaveta de gestão executiva completa
  openAgentTaskDrawer(run.chave || run.tipo);
}

async function selectSession(sessionId) {
  selected = sessionId;
  renderRoom();
  const [agents, history] = await Promise.all([
    request('GET', `/sessoes/${encodeURIComponent(sessionId)}/agentes`),
    request('GET', `/sessoes/${encodeURIComponent(sessionId)}/historico`)
  ]);
  const main = agents.agentes.find((agent) => !agent.pai_chave);
  $('#details').innerHTML = `
    <h2>${esc(main?.tipo || 'Sessão')}</h2>
    <p class="status">${esc(states[main?.estado] || '')}</p>
    <p class="detail-path">${esc(main?.cwd || '')}</p>
    <h3>Agentes</h3>
    <ul class="agent-list">
      ${agents.agentes.map((agent) => `
        <li style="cursor: pointer;" onclick="openAgentTaskDrawer('${esc(agent.chave || agent.tipo)}')">
          <span>${esc(agent.tipo)}</span>
          <small>${esc(states[agent.estado])}</small>
        </li>
      `).join('') || '<li>Nenhum agente registrado.</li>'}
    </ul>
    <h3>Histórico</h3>
    <ol class="history">
      ${history.eventos.map((event) => `
        <li><span>${esc(event.nome)}</span><time>${esc(new Date(event.ocorrido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</time></li>
      `).join('') || '<li>Sem eventos.</li>'}
    </ol>
  `;
}

function renderProjects() {
  const unknown = new Map();
  for (const session of sessions) {
    if (session.projeto_id === null) {
      const item = unknown.get(session.cwd) || { cwd: session.cwd, count: 0 };
      item.count += 1;
      unknown.set(session.cwd, item);
    }
  }
  const unmappedCount = $('#unmapped-count');
  if (unmappedCount) unmappedCount.textContent = unknown.size;
  const unmappedList = $('#unmapped-list');
  if (unmappedList) {
    unmappedList.innerHTML = unknown.size ? [...unknown.values()].map((entry) => `
      <div class="row">
        <div class="row-main"><strong class="path">${esc(entry.cwd)}</strong><small>${entry.count} sessão(ões)</small></div>
        <div class="actions">
          <button data-action="create" data-path="${esc(entry.cwd)}">Criar projeto</button>
        </div>
      </div>
    `).join('') : '<p class="empty">Nenhum caminho sem projeto.</p>';
  }

  const visible = projects.filter((project) => !project.arquivado || $('#show-archived')?.checked);
  const projectCount = $('#project-count');
  if (projectCount) projectCount.textContent = projects.length;
  const projectList = $('#project-list');
  if (projectList) {
    projectList.innerHTML = visible.length ? visible.map((project) => `
      <div class="row ${project.arquivado ? 'archived' : ''}">
        <div class="row-main">
          <strong>${esc(project.nome)} ${project.arquivado ? '<span class="badge">Arquivado</span>' : ''}</strong>
          <span class="path">${esc(project.caminho_local)}</span>
        </div>
      </div>
    `).join('') : '<p class="empty">Nenhum projeto nesta lista.</p>';
  }
}

async function refresh() {
  try {
    [projects, { sessoes: sessions }, dashboard] = await Promise.all([
      request('GET', '/projetos'),
      request('GET', '/sessoes'),
      request('GET', `/painel?horas=${$('#history-period')?.value || 6}&convivencia=12`)
    ]);
    renderRoom();
    renderProjects();

    // Se o drawer estiver aberto, recarrega os dados do agente atual em tempo real
    if (currentDrawerAgentKey && $('#agentTaskDrawer')?.classList.contains('open')) {
      const agentData = await request('GET', `/agentes/${encodeURIComponent(currentDrawerAgentKey)}/tarefas`);
      currentDrawerAgentData = agentData;
      renderDrawerContent(agentData);
    }
  } catch (error) {
    notice(error.message, true);
  }
}

/* ------------------------------------------------------------- Inicialização */
document.addEventListener('DOMContentLoaded', () => {
  setupDrawerEvents();
  setupGlobalModalEvents();
  setupPinModalEvents();
  setupThemeToggle();

  // Controles de Visualização (Painel vs Escritório)
  $$('.alternador .botao-mini').forEach((button) => {
    button.addEventListener('click', () => {
      viewMode = button.dataset.mode;
      $$('.alternador .botao-mini').forEach((item) => item.classList.toggle('ativo', item === button));
      renderRoom();
    });
  });

  // Filtro de Trajeto e Período
  const alternador = document.querySelector('.alternador');
  if (alternador && !$('#history-period')) {
    alternador.insertAdjacentHTML(
      'afterend',
      '<label class="trajeto"><input id="show-route" type="checkbox"> Mostrar trajeto</label>' +
      '<label class="periodo">Período do histórico<select id="history-period" aria-label="Período do histórico">' +
      '<option value="6">últimas 6 h</option><option value="12">últimas 12 h</option><option value="24">últimas 24 h</option></select></label>'
    );
    $('#history-period')?.addEventListener('change', refresh);
    $('#show-route')?.addEventListener('change', renderRoom);
  }

  // Clique nos bonecos da sala SVG
  $('#office-room')?.addEventListener('click', (event) => {
    const person = event.target.closest('.pessoa');
    const run = person && visualRuns.get(person.dataset.id);
    if (run) {
      showAgentPopover(run, event.clientX, event.clientY);
      return;
    }
    const card = event.target.closest('[data-session]');
    if (card) selectSession(card.dataset.session).catch((error) => notice(error.message, true));
  });

  // Botão Topbar: Modo Standby Total (Trava de Segurança / Zero Consumo)
  $('#btnPauseAllAgents')?.addEventListener('click', async () => {
    try {
      const res = await request('POST', '/agentes/pausar-todos');
      await refresh();
      if (currentDrawerAgentKey && $('#agentTaskDrawer')?.classList.contains('open')) {
        await openAgentTaskDrawer(currentDrawerAgentKey);
      }
      notice(res.mensagem || 'Modo Standby Total ativado com sucesso! Todos os agentes em espera.');
    } catch (e) {
      notice(e.message, true);
    }
  });

  refresh();
  setInterval(refresh, 5000);
});
