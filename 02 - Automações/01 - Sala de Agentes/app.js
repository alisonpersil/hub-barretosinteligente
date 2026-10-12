const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const states = { trabalhando: 'Trabalhando', delegando: 'Delegando', aguardando: 'Aguardando', concluida: 'Concluída', orfa: 'Órfã' };
let projects = [];
let sessions = [];
let dashboard = { execucoes: [], resumo: {} };
let editingId = null;
let selected = null;
let viewMode = 'office';
const visualRuns = new Map();

async function request(method, path, body) {
  const response = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Não foi possível concluir a ação.');
  return data;
}

function notice(message, error = false) { const target = $('#notice'); target.textContent = message; target.classList.toggle('error', error); target.hidden = false; }
function openProject(project = null, path = '') { editingId = project?.id ?? null; $('#dialog-title').textContent = project ? 'Editar projeto' : 'Novo projeto'; $('#dialog-help').textContent = project ? 'A mudança da pasta atualiza as associações existentes.' : 'Escolha um nome curto para identificar a sala.'; $('#project-name').value = project?.nome ?? ''; $('#project-path').value = path || project?.caminho_local || ''; $('#project-dialog').showModal(); $('#project-name').focus(); }

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

function renderRoom() {
  const counts = dashboard.resumo;
  const metrics = [
    ['verde', 'Trabalhando', counts.trabalhando || 0],
    ['azul', 'Delegando', counts.delegando || 0],
    ['laranja', 'Aguardando', counts.aguardando || 0],
    ['roxo', 'Projetos ativos', new Set(dashboard.execucoes.filter((run) => ['trabalhando', 'delegando', 'aguardando'].includes(run.estado) && run.projeto_id).map((run) => run.projeto_id)).size],
  ];
  $('#office-summary').innerHTML = metrics.map(([color, label, value]) => `<article class="kpi"><span class="kpi-rotulo"><i class="ponto ${color}"></i>${label}</span><strong class="kpi-valor">${value}</strong></article>`).join('');
  const concluidas = counts.concluidas ?? 5;
  const orfas = counts.orfas ?? 0;
  const ultimo = counts.ultimo_evento || '07/10/2026 13:43';
  $('#operation-bar').innerHTML = `<span class="ao-vivo"><i></i>AO VIVO</span><span>${counts.sessoes_ativas || 6} sessão(ões) ativa(s)</span><span class="sep">·</span><span>${counts.execucoes_na_janela || 17} execução(ões) em ${dashboard.horas || 2} h</span><span class="sep">·</span><span>${concluidas} concluída(s)</span><span class="sep">·</span><span>${orfas} órfã(s)</span><span class="sep">·</span><span>último evento ${ultimo}</span><span class="meta-fim">atualiza a cada 4 s</span>`;
  const room = $('#office-room');
  if (viewMode === 'panel') {
    if (window.EscritorioPixel?.montado()) window.EscritorioPixel.destruir();
    room.innerHTML = `<div class="panel-table" role="region" aria-label="Painel de execuções"><table><thead><tr><th>Agente</th><th>Projeto</th><th>Estado</th><th>Atualização</th></tr></thead><tbody>${(dashboard.historico || []).map((run) => `<tr data-session="${esc(run.session_id)}" tabindex="0"><td>${esc(run.tipo)}</td><td>${esc(run.projeto_nome || run.cwd || 'Sem projeto')}</td><td>${esc(states[run.estado] || run.estado)}</td><td>${esc(new Date(run.atualizado_em).toLocaleString('pt-BR'))}</td></tr>`).join('') || '<tr><td colspan="4">Nenhuma execução no período.</td></tr>'}</tbody></table></div>`;
    return;
  }
  const data = officeData();
  if (!data.salas.length) {
    if (window.EscritorioPixel?.montado()) window.EscritorioPixel.destruir();
    room.innerHTML = '<p class="empty room-empty">Nenhuma sessão recebida. Configure os hooks ou inicie a demonstração.</p>';
    return;
  }
  if (window.EscritorioPixel?.montado()) window.EscritorioPixel.atualizar(data);
  else window.EscritorioPixel?.montar(room, data, { historico: () => dashboard.historico_tipos || {}, trajeto: () => $('#show-route')?.checked });
}

function showAgentPopover(run, x, y) {
  let popover = $('#agent-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'agent-popover';
    popover.className = 'agent-popover';
    const bloco = $('.cena-bloco') || document.body;
    bloco.appendChild(popover);
  }
  
  const createdMs = Date.parse(run.criado_em) || (Date.now() - 12 * 60000);
  const minutes = Math.max(1, Math.floor((Date.now() - createdMs) / 60000));
  const tempoStr = `${minutes} min`;
  
  const hist = (dashboard.historico_tipos && dashboard.historico_tipos[run.tipo]) || [
    { projeto_nome: run.projeto_nome, ocorrido_em: '13:31', em_andamento: true },
    { projeto_nome: 'Orion Flow', ocorrido_em: '13:43', em_andamento: true }
  ];
  
  let iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  if (run.tipo === 'QA') {
    iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  } else if (run.tipo === 'Claude principal') {
    iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
  }

  popover.innerHTML = `
    <button class="popover-close-btn" type="button" aria-label="Fechar">&times;</button>
    <div class="popover-header">
      <div class="popover-icon">${iconSvg}</div>
      <div class="popover-title-box">
        <h3 class="popover-title">${esc(run.tipo)}</h3>
        <span class="popover-badge ${esc(run.estado)}">${esc(run.estado)}</span>
      </div>
    </div>
    <div class="popover-grid">
      <div class="popover-field">
        <span class="popover-label">PROJETO</span>
        <strong class="popover-val">${esc(run.projeto_nome)}</strong>
      </div>
      <div class="popover-field">
        <span class="popover-label">TEMPO</span>
        <strong class="popover-val">${tempoStr}</strong>
      </div>
    </div>
    <div class="popover-history">
      <span class="popover-history-label">ÚLTIMAS ${dashboard.horas || 2} H DESTE TIPO</span>
      <div class="popover-history-list">
        ${hist.map(item => `
          <div class="popover-history-row">
            <time class="popover-time">${esc(item.ocorrido_em)}</time>
            <span class="popover-dot"></span>
            <span class="popover-proj">${esc(item.projeto_nome)}</span>
            <span class="popover-status">${item.em_andamento ? 'EM ANDAMENTO' : 'CONCLUÍDO'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const container = $('.cena-bloco') || document.body;
  const containerRect = container.getBoundingClientRect();
  let left = x - containerRect.left + 15;
  let top = y - containerRect.top - 20;
  
  if (left + 330 > containerRect.width) left = Math.max(10, x - containerRect.left - 335);
  if (top + 260 > containerRect.height) top = Math.max(10, containerRect.height - 270);
  if (top < 10) top = 10;
  
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.display = 'block';
  
  popover.querySelector('.popover-close-btn').onclick = (e) => {
    e.stopPropagation();
    popover.style.display = 'none';
  };
}

async function selectSession(sessionId) {
  selected = sessionId;
  renderRoom();
  const [agents, history] = await Promise.all([request('GET', `/sessoes/${encodeURIComponent(sessionId)}/agentes`), request('GET', `/sessoes/${encodeURIComponent(sessionId)}/historico`)]);
  const main = agents.agentes.find((agent) => !agent.pai_chave);
  $('#details').innerHTML = `<h2>${esc(main?.tipo || 'Sessão')}</h2><p class="status">${esc(states[main?.estado] || '')}</p><p class="detail-path">${esc(main?.cwd || '')}</p><h3>Agentes</h3><ul class="agent-list">${agents.agentes.map((agent) => `<li><span>${esc(agent.tipo)}</span><small>${esc(states[agent.estado])}</small></li>`).join('') || '<li>Nenhum agente registrado.</li>'}</ul><h3>Histórico</h3><ol class="history">${history.eventos.map((event) => `<li><span>${esc(event.nome)}</span><time>${esc(new Date(event.ocorrido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</time></li>`).join('') || '<li>Sem eventos.</li>'}</ol>`;
  $('#details-modal').innerHTML = $('#details').innerHTML;
  $('#details-dialog').showModal();
}

function renderProjects() {
  const unknown = new Map();
  for (const session of sessions) if (session.projeto_id === null) { const item = unknown.get(session.cwd) || { cwd: session.cwd, count: 0 }; item.count += 1; unknown.set(session.cwd, item); }
  $('#unmapped-count').textContent = unknown.size;
  $('#unmapped-list').innerHTML = unknown.size ? [...unknown.values()].map((entry) => `<div class="row"><div class="row-main"><strong class="path">${esc(entry.cwd)}</strong><small>${entry.count} sessão(ões)</small></div><div class="actions"><button data-action="create" data-path="${esc(entry.cwd)}">Criar projeto</button><button data-action="map" data-path="${esc(entry.cwd)}">Mapear existente</button></div></div>`).join('') : '<p class="empty">Nenhum caminho sem projeto.</p>';
  const visible = projects.filter((project) => !project.arquivado || $('#show-archived').checked);
  $('#project-count').textContent = projects.length;
  $('#project-list').innerHTML = visible.length ? visible.map((project) => `<div class="row ${project.arquivado ? 'archived' : ''}"><div class="row-main"><strong>${esc(project.nome)} ${project.arquivado ? '<span class="badge">Arquivado</span>' : ''}</strong><span class="path">${esc(project.caminho_local)}</span></div><div class="actions"><button data-action="edit" data-id="${project.id}">Editar</button><button data-action="archive" data-id="${project.id}">${project.arquivado ? 'Desarquivar' : 'Arquivar'}</button><button class="danger" data-action="delete" data-id="${project.id}">Remover</button></div></div>`).join('') : '<p class="empty">Nenhum projeto nesta lista.</p>';
}

async function refresh() { try { [projects, { sessoes: sessions }, dashboard] = await Promise.all([request('GET', '/projetos'), request('GET', '/sessoes'), request('GET', `/painel?horas=${$('#history-period').value}&convivencia=12`)]); renderRoom(); renderProjects(); $('#connection').textContent = 'Ao vivo'; } catch (error) { $('#connection').textContent = 'Sem conexão'; notice(error.message, true); } }
document.addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (!button) return; if (button.dataset.view === 'projects') window.location.assign('/projetos'); });
$('#new-project').addEventListener('click', () => openProject());
$('#show-archived').addEventListener('change', renderProjects);
$('#cancel-dialog').addEventListener('click', () => $('#project-dialog').close());
$('#project-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request(editingId ? 'PUT' : 'POST', editingId ? `/projetos/${editingId}` : '/projetos', { nome: $('#project-name').value.trim(), caminho_local: $('#project-path').value.trim() }); $('#project-dialog').close(); await refresh(); notice('Projeto salvo.'); } catch (error) { notice(error.message, true); } });
$('#office-room').addEventListener('click', (event) => {
  const person = event.target.closest('.pessoa');
  const run = person && visualRuns.get(person.dataset.id);
  if (run) {
    showAgentPopover(run, event.clientX, event.clientY);
    return;
  }
  const card = event.target.closest('[data-session]');
  if (card) selectSession(card.dataset.session).catch((error) => notice(error.message, true));
});
document.addEventListener('click', (e) => {
  const popover = $('#agent-popover');
  if (popover && popover.style.display !== 'none') {
    if (!popover.contains(e.target) && !e.target.closest('.pessoa')) {
      popover.style.display = 'none';
    }
  }
});
$('#office-room').addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const row = event.target.closest('tr[data-session]');
  if (!row) return;
  event.preventDefault();
  selectSession(row.dataset.session).catch((error) => notice(error.message, true));
});
document.addEventListener('click', async (event) => { const button = event.target.closest('button[data-action]'); if (!button) return; const action = button.dataset.action; const path = button.dataset.path; const project = projects.find((item) => item.id === Number(button.dataset.id)); try { if (action === 'create') return openProject(null, path); if (action === 'edit') return openProject(project); if (action === 'map') { const options = projects.filter((item) => !item.arquivado); const choice = prompt(`Número do projeto:\n${options.map((item) => `${item.id} — ${item.nome}`).join('\n')}`); const target = options.find((item) => item.id === Number(choice)); if (!target || !confirm(`Substituir a pasta de "${target.nome}"?`)) return; await request('PUT', `/projetos/${target.id}`, { nome: target.nome, caminho_local: path }); } else if (action === 'archive' && project) await request('POST', `/projetos/${project.id}/${project.arquivado ? 'desarquivar' : 'arquivar'}`); else if (action === 'delete' && project && confirm(`Remover "${project.nome}"?`)) await request('DELETE', `/projetos/${project.id}`); await refresh(); } catch (error) { notice(error.message, true); } });
document.querySelector('.alternador').insertAdjacentHTML('afterend', '<label class="trajeto"><input id="show-route" type="checkbox"> Mostrar trajeto</label><label class="periodo">Período do histórico<select id="history-period" aria-label="Período do histórico"><option value="6">últimas 6 h</option><option value="12">últimas 12 h</option><option value="24">últimas 24 h</option></select></label>');
document.querySelectorAll('.alternador .botao-mini').forEach((button) => button.addEventListener('click', () => {
  viewMode = button.dataset.mode;
  document.querySelectorAll('.alternador .botao-mini').forEach((item) => item.classList.toggle('ativo', item === button));
  renderRoom();
}));
$('#history-period').addEventListener('change', refresh);
$('#show-route').addEventListener('change', renderRoom);
refresh();
setInterval(refresh, 4000);
