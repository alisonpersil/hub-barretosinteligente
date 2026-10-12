/**
 * Barretos Inteligente - Book de Governança & Inovação
 * Edição Executiva — Interatividade & Dados Vivos
 */

(function () {
    'use strict';

    // Elementos do DOM
    const timelineContainer = document.getElementById('timelineContainer');
    const totalInnovationsCount = document.getElementById('totalInnovationsCount');
    const searchInput = document.getElementById('bookSearchInput');
    const filterPills = document.querySelectorAll('.filter-pill');
    const btnOpenModal = document.getElementById('btnOpenAddModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const modalOverlay = document.getElementById('bookModalOverlay');
    const formAddInnovation = document.getElementById('formAddInnovation');
    const btnAudioToggle = document.getElementById('btnAudioToggle');

    let allEntries = [];
    let activeCategory = 'all';
    let searchQuery = '';
    let soundEnabled = true;

    // Web Audio API Synthesizer para feedback sonoro executivo CCO
    let audioCtx = null;
    function playRetroBeep(type = 'click') {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;
            if (type === 'success') {
                // Dual chord arpeggio
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else {
                // Soft cyber click
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            }
        } catch (_) {}
    }

    // Carregamento de Entradas (API ou JSON estático com Fallback)
    async function loadEntries() {
        let entries = [];
        try {
            const res = await fetch('/api/book/entries');
            if (res.ok) {
                entries = await res.json();
            }
        } catch (_) {}

        if (!entries || !entries.length) {
            try {
                const resFallback = await fetch('/book/book_entries.json');
                if (resFallback.ok) {
                    entries = await resFallback.json();
                }
            } catch (_) {}
        }

        if (!entries || !entries.length) {
            entries = [
                {
                    id: 8,
                    title: "Nossos Robôs ouvem Rádio",
                    category: "IA & Automação",
                    badge: "Notícia Oficial",
                    icon: "fa-tower-broadcast",
                    color: "pink",
                    impact: "Já está disponível a visualização dos agentes na página de Automações. É por lá que conseguimos ver eles trabalhando no site e criando automações próprias. E isso não seria possível sem uma área para tomar café e uma boa música. A rádio Barretos Inteligente toca algumas das músicas mais famosas e extraordinárias. São mais de 4h de música",
                    date: "Outubro 2026",
                    author: "Agente Sentinela & Alison Persil",
                    version: "v2.4.0"
                },
                {
                    id: 7,
                    title: "Tratamento de Falhas & Homologação de Resiliência no Ecossistema",
                    category: "Governança & Resiliência",
                    badge: "Novo Comunicado",
                    icon: "fa-shield-halved",
                    color: "pink",
                    impact: "Comunicado oficial no Book confirmando o tratamento integral e resolução de falhas no ecossistema, validação de rotas, estabilidade dos postos da Sala de Agentes e homologação contínua do sistema.",
                    date: "Outubro 2026",
                    author: "Agente Curador do Book & Alison Persil",
                    version: "v2.3.0"
                },
                {
                    id: 6,
                    title: "Redesign Cinematográfico do Book de Governança & Inovações",
                    category: "Design System & Imersão",
                    badge: "Design System",
                    icon: "fa-award",
                    color: "pink",
                    impact: "Transformação completa da interface de governança com gradientes fluidos executivos, cards em glassmorphism fosco, HUD de indicadores de alta precisão e catalogação dinâmica de entregas homologada com IA Gemini.",
                    date: "Outubro 2026",
                    author: "Agente Sentinela & Alison Persil",
                    version: "v2.2.0"
                },
                {
                    id: 5,
                    title: "Painel de Auditoria & QA do Site Contínuo",
                    category: "Qualidade & Disponibilidade",
                    badge: "Governança",
                    icon: "fa-shield-halved",
                    color: "purple",
                    impact: "Supervisão automatizada de status HTTP (200 OK), latência de carregamento na Vercel e matriz de conformidade responsiva para prestação de contas à gestão pública.",
                    date: "Outubro 2026",
                    author: "Alison Persil",
                    version: "v2.1.0"
                },
                {
                    id: 4,
                    title: "Sala de Operações com Agentes Autônomos (Pixel Art SVG)",
                    category: "Inteligência Artificial & Automação",
                    badge: "Inovação",
                    icon: "fa-robot",
                    color: "purple",
                    impact: "Criação do posto virtual com 6 agentes especializados (Hub, Exati, Ofícios, QA, Book e Sentinela), operando em motor SVG ultraleve com despacho remoto de comandos pelo smartphone e inteligência Gemini Flash.",
                    date: "Outubro 2026",
                    author: "Alison Persil",
                    version: "v2.0.0"
                },
                {
                    id: 3,
                    title: "Sentinela de Backdrop & Sincronização Mobile (History API)",
                    category: "Engenharia de Frontend",
                    badge: "Resiliência",
                    icon: "fa-mobile-screen",
                    color: "amber",
                    impact: "Resolução definitiva de travamentos em smartphones: limpeza imediata do backdrop ao alternar abas e sincronização da URL via History API, garantindo recarregamento fiel na Home.",
                    date: "Outubro 2026",
                    author: "Alison Persil",
                    version: "v1.4.0"
                },
                {
                    id: 2,
                    title: "Paginação Dinâmica de Documentos (15 por Página)",
                    category: "Performance & Dados",
                    badge: "Otimização",
                    icon: "fa-folder-open",
                    color: "green",
                    impact: "Eliminação de sobrecarga em conexões móveis através de paginação sob demanda dos mais de 1.500 ofícios catalogados, com busca instantânea e ordenação em memória.",
                    date: "Outubro 2026",
                    author: "Alison Persil",
                    version: "v1.3.0"
                },
                {
                    id: 1,
                    title: "Arquitetura Bimodal (Light/Dark Mode)",
                    category: "UX & Acessibilidade",
                    badge: "Design System",
                    icon: "fa-moon",
                    color: "cyan",
                    impact: "Alternância instantânea de tema (modo claro executivo e modo escuro noturno) com persistência no LocalStorage e sincronização entre todas as aplicações do ecossistema.",
                    date: "Outubro 2026",
                    author: "Alison Persil",
                    version: "v1.2.0"
                }
            ];
        }

        allEntries = entries;
        renderFilteredEntries();
        updateStats();
    }

    function updateStats() {
        if (totalInnovationsCount) {
            totalInnovationsCount.textContent = allEntries.length;
        }
    }

    function renderFilteredEntries() {
        if (!timelineContainer) return;

        let filtered = allEntries.filter(item => {
            const matchesCat = (activeCategory === 'all') || 
                (item.category && item.category.toLowerCase().includes(activeCategory.toLowerCase())) ||
                (item.badge && item.badge.toLowerCase().includes(activeCategory.toLowerCase()));

            const matchesSearch = !searchQuery || 
                (item.title && item.title.toLowerCase().includes(searchQuery)) ||
                (item.impact && item.impact.toLowerCase().includes(searchQuery)) ||
                (item.category && item.category.toLowerCase().includes(searchQuery)) ||
                (item.author && item.author.toLowerCase().includes(searchQuery)) ||
                (item.version && item.version.toLowerCase().includes(searchQuery));

            return matchesCat && matchesSearch;
        });

        filtered.sort((a, b) => (b.id || 0) - (a.id || 0));

        if (!filtered.length) {
            timelineContainer.innerHTML = `
                <div style="text-align: center; padding: 48px 20px; background: rgba(22, 17, 43, 0.4); border: 1px dashed rgba(255, 42, 133, 0.3); border-radius: 20px;">
                    <i class="fa-solid fa-satellite-dish" style="font-size: 38px; color: #ff2a85; margin-bottom: 14px; display: block;"></i>
                    <h3 style="color: #fff; font-size: 18px; margin: 0 0 6px;">Nenhum marco encontrado</h3>
                    <p style="color: #9f97b5; font-size: 13.5px; margin: 0;">Tente outro termo na busca ou selecione "Todas as Missões".</p>
                </div>
            `;
            return;
        }

        timelineContainer.innerHTML = filtered.map((item, index) => {
            const missionNum = String(item.id || (filtered.length - index)).padStart(2, '0');
            const colorClass = item.color || (item.category.includes('IA') ? 'purple' : item.category.includes('Design') ? 'pink' : 'cyan');
            
            return `
                <article class="book-mission-card" data-id="${item.id}">
                    <div class="card-hud-top">
                        <div class="mission-tag-group">
                            <span class="mission-number-tag">MISSÃO #${missionNum}</span>
                            <span class="mission-category-tag ${colorClass}">${item.badge || item.category}</span>
                            <div class="mission-stars" title="Avaliação de Impacto Contratual 5 Estrelas">
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                            </div>
                        </div>
                        <div class="mission-date-badge">
                            <i class="fa-regular fa-calendar-check" style="color: #ff2a85;"></i> ${item.date || 'Outubro 2026'}
                        </div>
                    </div>

                    <h2 class="book-mission-title">${item.title}</h2>
                    <p class="book-mission-desc">${item.impact}</p>

                    <div class="card-hud-bottom">
                        <div class="card-author-meta">
                            <span class="author-chip">
                                <i class="fa-solid fa-circle-check"></i> ${item.author || 'Alison Persil'}
                            </span>
                            <span class="version-chip">${item.version || 'v2.0.0'}</span>
                        </div>

                        <div class="card-actions-row">
                            <button type="button" class="btn-card-action btn-copy-summary" data-impact="${encodeURIComponent(item.impact)}" data-title="${encodeURIComponent(item.title)}">
                                <i class="fa-solid fa-copy"></i> Copiar Resumo
                            </button>
                            <span style="font-size: 11px; color: #10b981; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-shield"></i> Homologado
                            </span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Listeners para botões nos cards
        timelineContainer.querySelectorAll('.btn-copy-summary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                playRetroBeep('click');
                const title = decodeURIComponent(btn.getAttribute('data-title') || '');
                const impact = decodeURIComponent(btn.getAttribute('data-impact') || '');
                const textToCopy = `[Barretos Inteligente • Book]\nMarco: ${title}\nImpacto: ${impact}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const original = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check" style="color: #34d399;"></i> Copiado!';
                    setTimeout(() => btn.innerHTML = original, 2000);
                });
            });
        });
    }

    // Filtros por Categoria
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            playRetroBeep('click');
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeCategory = pill.getAttribute('data-category') || 'all';
            renderFilteredEntries();
        });
    });

    // Busca ao Vivo
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderFilteredEntries();
        });
    }

    // Modal de Adicionar Inovação
    if (btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            playRetroBeep('click');
            if (modalOverlay) modalOverlay.classList.add('active');
        });
    }

    function closeModal() {
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Formulário de Criação de Novo Marco
    if (formAddInnovation) {
        formAddInnovation.addEventListener('submit', async (e) => {
            e.preventDefault();
            playRetroBeep('success');

            const titleInput = document.getElementById('newMarcoTitle');
            const catSelect = document.getElementById('newMarcoCategory');
            const impactInput = document.getElementById('newMarcoImpact');
            const authorInput = document.getElementById('newMarcoAuthor');

            const payload = {
                title: titleInput ? titleInput.value.trim() : '',
                category: catSelect ? catSelect.value : 'Inovação Operacional',
                badge: catSelect ? catSelect.options[catSelect.selectedIndex].text : 'Novo Marco',
                impact: impactInput ? impactInput.value.trim() : '',
                author: authorInput && authorInput.value.trim() ? authorInput.value.trim() : 'Alison Persil'
            };

            if (!payload.title || !payload.impact) {
                alert('Por favor, preencha o título e a descrição do impacto do marco.');
                return;
            }

            try {
                const res = await fetch('/api/book/criar-marco', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success && data.entries) {
                    allEntries = data.entries;
                } else if (data.entry) {
                    allEntries.unshift(data.entry);
                }
            } catch (_) {
                // Fallback local se backend offline
                allEntries.unshift({
                    id: allEntries.length + 1,
                    title: payload.title,
                    category: payload.category,
                    badge: payload.badge,
                    impact: payload.impact,
                    date: 'Outubro 2026',
                    author: payload.author,
                    version: `v2.${allEntries.length + 1}.0`
                });
            }

            formAddInnovation.reset();
            closeModal();
            renderFilteredEntries();
            updateStats();
        });
    }

    // Toggle de Audio Retrô FX
    if (btnAudioToggle) {
        btnAudioToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            btnAudioToggle.innerHTML = soundEnabled ?
                '<i class="fa-solid fa-volume-high"></i> Audio FX: ON' :
                '<i class="fa-solid fa-volume-xmark"></i> Audio FX: OFF';
            if (soundEnabled) playRetroBeep('success');
        });
    }

    // Integração do Botão "Ouvir estação" do Banner Notícia
    const btnOuvirEstacao = document.getElementById('btnOuvirEstacaoBook');
    function syncOuvirRadioBtn() {
        if (!btnOuvirEstacao) return;
        const isPlaying = window.RadioBarretos && typeof window.RadioBarretos.isPlaying === 'function' ? window.RadioBarretos.isPlaying() : false;
        const icon = document.getElementById('btnOuvirEstacaoIcon');
        const text = document.getElementById('btnOuvirEstacaoText');

        if (isPlaying) {
            btnOuvirEstacao.classList.add('playing');
            if (icon) icon.className = 'fa-solid fa-volume-high';
            if (text) text.textContent = 'Tocando Agora (Mutar)';
        } else {
            btnOuvirEstacao.classList.remove('playing');
            if (icon) icon.className = 'fa-solid fa-play';
            if (text) text.textContent = 'Ouvir estação';
        }
    }

    if (btnOuvirEstacao) {
        btnOuvirEstacao.addEventListener('click', () => {
            playRetroBeep('success');
            if (window.RadioBarretos) {
                window.RadioBarretos.toggle();
                setTimeout(syncOuvirRadioBtn, 200);
            }
        });

        setTimeout(syncOuvirRadioBtn, 400);
        window.addEventListener('storage', (e) => {
            if (e.key === 'barretos_radio_active') {
                syncOuvirRadioBtn();
            }
        });
    }

    // Inicialização
    document.addEventListener('DOMContentLoaded', () => {
        loadEntries();
        syncOuvirRadioBtn();
    });
})();
