/**
 * Barretos Inteligente FM — Transmissão Contínua Sincronizada Globalmente
 * Player de áudio persistente em todo o ecossistema (Non Stop Pop FM & Flash FM)
 * Suporte a reprodução contínua em aba secundária / navegador minimizado e mobile
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'barretos_radio_active';
  const RADIO_EPOCH = 1700000000;
  const PLAYLIST = [
    {
      id: 'uZ3RFNMKcmg',
      name: 'Non Stop Pop FM [GTA V]',
      genre: 'Pop & Retrô Hits',
      duration: 9987
    },
    {
      id: 'ULcKRDTdUsY',
      name: 'Flash FM [GTA Vice City]',
      genre: '80s Flashback Classics',
      duration: 3350
    }
  ];
  const TOTAL_CYCLE = PLAYLIST.reduce((acc, t) => acc + t.duration, 0); // 13,337s

  let isPlaying = false;
  let currentTrackIndex = 0;
  let transitionTimer = null;
  let toastTimeout = null;
  let heartbeatTimer = null;
  let audioWakeCtx = null;
  let wakeOsc = null;

  /**
   * Mantém a aba ativa como "Media Tab" no Chrome/Edge/Safari mesmo minimizada
   * através de oscilador Web Audio inaudível (20Hz a 0.0001 de ganho).
   */
  function startAudioWakeLock() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioWakeCtx) {
        audioWakeCtx = new AudioContextClass();
      }
      if (audioWakeCtx.state === 'suspended') {
        audioWakeCtx.resume();
      }
      if (!wakeOsc) {
        wakeOsc = audioWakeCtx.createOscillator();
        const gain = audioWakeCtx.createGain();
        wakeOsc.type = 'sine';
        wakeOsc.frequency.setValueAtTime(20, audioWakeCtx.currentTime);
        gain.gain.setValueAtTime(0.0001, audioWakeCtx.currentTime);
        wakeOsc.connect(gain);
        gain.connect(audioWakeCtx.destination);
        wakeOsc.start();
      }
    } catch (_) {}
  }

  function stopAudioWakeLock() {
    try {
      if (wakeOsc) {
        wakeOsc.stop();
        wakeOsc.disconnect();
        wakeOsc = null;
      }
      if (audioWakeCtx && audioWakeCtx.state !== 'closed') {
        audioWakeCtx.suspend();
      }
    } catch (_) {}
  }

  /**
   * Integração com a API Media Session do Sistema Operacional (Windows / Android / iOS)
   */
  function updateMediaSession(track) {
    if ('mediaSession' in navigator && track) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name.split('[')[0].trim(),
          artist: 'Barretos Inteligente FM',
          album: track.genre || 'Transmissão Ao Vivo',
          artwork: [
            { src: '/banner_radio_barretos_inteligente_quadrado.svg', sizes: '512x512', type: 'image/svg+xml' }
          ]
        });
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
          play(false);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          mute();
        });
      } catch (_) {}
    }
  }

  function clearMediaSession() {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'paused';
      } catch (_) {}
    }
  }

  /**
   * Força retomada de reprodução se o navegador pausou em segundo plano
   */
  function forceResume() {
    if (!isPlaying) return;
    const iframe = document.getElementById('youtubeRadioIframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      } catch (_) {}
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (isPlaying) {
        forceResume();
      }
    }, 2500);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /**
   * Retorna o estado sincronizado em tempo real com base no relógio global.
   */
  function getGlobalState() {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = ((now - RADIO_EPOCH) % TOTAL_CYCLE + TOTAL_CYCLE) % TOTAL_CYCLE;

    let accum = 0;
    for (let i = 0; i < PLAYLIST.length; i++) {
      const track = PLAYLIST[i];
      if (elapsed < accum + track.duration) {
        const seek = elapsed - accum;
        return {
          index: i,
          track: track,
          videoId: track.id,
          trackName: track.name,
          genre: track.genre,
          seekSeconds: seek,
          remainingSeconds: track.duration - seek,
          serverTime: now
        };
      }
      accum += track.duration;
    }

    return {
      index: 0,
      track: PLAYLIST[0],
      videoId: PLAYLIST[0].id,
      trackName: PLAYLIST[0].name,
      genre: PLAYLIST[0].genre,
      seekSeconds: 0,
      remainingSeconds: PLAYLIST[0].duration,
      serverTime: now
    };
  }

  /**
   * Contêiner visível para o compositor do navegador porém discreto
   */
  function ensurePlayerContainer() {
    let wrapper = document.getElementById('youtubeRadioWrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'youtubeRadioWrapper';
      wrapper.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.0001;z-index:-9999;pointer-events:none;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);transform:translateZ(0);';
      document.body.appendChild(wrapper);
    }
    return wrapper;
  }

  /**
   * Inicia ou desmuta a transmissão contínua sincronizada.
   */
  function play(isAutoResume = false) {
    const wrapper = ensurePlayerContainer();
    const state = getGlobalState();

    currentTrackIndex = state.index ?? 0;
    const currentTrack = PLAYLIST[currentTrackIndex] || PLAYLIST[0];

    let iframe = document.getElementById('youtubeRadioIframe');
    const embedUrl = `https://www.youtube.com/embed/${currentTrack.id}?autoplay=1&start=${state.seekSeconds}&enablejsapi=1&playsinline=1&controls=0&origin=${encodeURIComponent(window.location.origin)}`;

    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'youtubeRadioIframe';
      iframe.width = '1';
      iframe.height = '1';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.style.cssText = 'width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
      iframe.src = embedUrl;
      wrapper.appendChild(iframe);
    } else {
      iframe.src = embedUrl;
    }

    // Envia handshake e comandos de desmutar e tocar
    const sendCommands = () => {
      try {
        iframe.contentWindow.postMessage('{"event":"listening","id":1,"channel":"widget"}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"addEventListener","args":["onStateChange"]}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [state.seekSeconds, true]
        }), '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      } catch (_) {}
    };

    setTimeout(sendCommands, 250);
    setTimeout(sendCommands, 700);
    setTimeout(sendCommands, 1500);

    isPlaying = true;
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}

    // Ativa travas de segundo plano
    startAudioWakeLock();
    startHeartbeat();
    updateMediaSession(currentTrack);
    updateUI(true, currentTrack);

    // Toast de notificação
    if (!isAutoResume) {
      showToast(`📻 Barretos FM: No ar — ${currentTrack.name}`);
    } else {
      showToast(`📻 Barretos FM: No ar — ${currentTrack.name}`, 3000);
    }

    // Agenda a transição contínua para a próxima estação
    if (transitionTimer) clearTimeout(transitionTimer);
    const msRemaining = Math.max(1000, (state.remainingSeconds || 60) * 1000);
    transitionTimer = setTimeout(() => {
      if (isPlaying) {
        play(true);
      }
    }, msRemaining);
  }

  /**
   * Muta a rádio.
   */
  function mute() {
    const iframe = document.getElementById('youtubeRadioIframe');
    if (iframe) {
      try {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        iframe.src = 'about:blank';
      } catch (_) {}
    }

    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }

    isPlaying = false;
    try {
      localStorage.setItem(STORAGE_KEY, '0');
    } catch (_) {}

    stopAudioWakeLock();
    stopHeartbeat();
    clearMediaSession();
    updateUI(false);
    showToast('🔇 Barretos Inteligente FM mutada');
  }

  /**
   * Alterna entre tocar e mutar.
   */
  function toggle() {
    if (isPlaying) {
      mute();
    } else {
      play(false);
    }
  }

  /**
   * Re-sincroniza com a transmissão linear ao vivo se necessário.
   */
  function resync() {
    if (isPlaying) {
      play(true);
    }
  }

  /**
   * Atualiza o visual no card (se existir) e no toast global.
   */
  function updateUI(playing, track) {
    // 1. Atualização do Card na Sala de Agentes (se presente na página)
    const cards = document.querySelectorAll('#cardRadioBarretos, .kpi-radio-card');
    cards.forEach((card) => {
      if (playing) {
        card.classList.add('tocando');
        const badgeText = card.querySelector('.radio-badge-text');
        if (badgeText) badgeText.textContent = 'NO AR';

        const trackTitle = card.querySelector('.kpi-radio-track-title');
        if (trackTitle && track) {
          trackTitle.textContent = track.name.split('[')[0].trim();
        }

        card.setAttribute('title', `Barretos Inteligente FM • Ao Vivo: ${track ? track.name : 'Música'} (Clique para mutar)`);
      } else {
        card.classList.remove('tocando');
        const badgeText = card.querySelector('.radio-badge-text');
        if (badgeText) badgeText.textContent = 'AO VIVO';

        const trackTitle = card.querySelector('.kpi-radio-track-title');
        if (trackTitle) {
          trackTitle.textContent = 'Sintonizar Rádio';
        }

        card.setAttribute('title', 'Barretos Inteligente FM • Clique para ouvir (Transmissão global contínua)');
      }
    });

    // 2. Atualização dos botões do Toast Flutuante Global
    const muteIcon = document.getElementById('radioToastMuteIcon');
    if (muteIcon) {
      muteIcon.className = playing ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    }
    const toast = document.getElementById('radioToast');
    if (toast) {
      toast.classList.toggle('mutado', !playing);
    }
  }

  /**
   * Toast Global Flutuante presente em todo o site.
   */
  function showToast(mensagem, autoDismissMs = 4500) {
    let toast = document.getElementById('radioToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'radioToast';
      toast.className = 'radio-toast';
      toast.innerHTML = `
        <span class="radio-toast-icon"><i class="fa-solid fa-tower-broadcast"></i></span>
        <span class="radio-toast-text"></span>
        <div class="radio-toast-actions">
          <button type="button" class="radio-toast-btn mute-btn" id="btnToggleRadioMute" title="Mutar/Desmutar">
            <i class="fa-solid fa-volume-high" id="radioToastMuteIcon"></i>
          </button>
        </div>
      `;
      document.body.appendChild(toast);

      const muteBtn = document.getElementById('btnToggleRadioMute');
      if (muteBtn) {
        muteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggle();
        });
      }
    }

    const textEl = toast.querySelector('.radio-toast-text');
    if (textEl) textEl.textContent = mensagem;

    const muteIcon = document.getElementById('radioToastMuteIcon');
    if (muteIcon) {
      muteIcon.className = isPlaying ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    }

    toast.classList.add('visivel');
    if (toastTimeout) clearTimeout(toastTimeout);

    const hasCard = !!document.getElementById('cardRadioBarretos');
    if (hasCard) {
      toastTimeout = setTimeout(() => {
        toast.classList.remove('visivel');
      }, autoDismissMs);
    } else {
      if (!isPlaying) {
        toastTimeout = setTimeout(() => {
          toast.classList.remove('visivel');
        }, 3000);
      }
    }
  }

  // Previne pausas do YouTube causadas pelo navegador em segundo plano ou tela minimizada
  window.addEventListener('message', (event) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data) return;

      let playerState = null;
      if (data.event === 'onStateChange') {
        playerState = data.info;
      } else if (data.event === 'infoDelivery' && data.info && typeof data.info.playerState !== 'undefined') {
        playerState = data.info.playerState;
      }

      if (playerState === 0 && isPlaying) {
        // Fim de faixa -> sincroniza linearmente a próxima música da rádio
        play(true);
      } else if (playerState === 2 && isPlaying) {
        // Pausa disparada pelo navegador ou iframe ao minimizar / alternar abas
        setTimeout(forceResume, 100);
        setTimeout(forceResume, 300);
      }
    } catch (_) {}
  });

  // Retomada instantânea ao alternar visibilidade ou foco
  document.addEventListener('visibilitychange', () => {
    if (isPlaying) {
      if (audioWakeCtx && audioWakeCtx.state === 'suspended') {
        audioWakeCtx.resume();
      }
      forceResume();
    }
  });

  window.addEventListener('blur', () => {
    if (isPlaying) {
      forceResume();
    }
  });

  window.addEventListener('focus', () => {
    if (isPlaying) {
      forceResume();
    }
  });

  // API Global
  window.RadioBarretos = {
    play: () => play(false),
    mute,
    pause: mute,
    toggle,
    resync,
    isPlaying: () => isPlaying,
    getCurrentTrack: () => PLAYLIST[currentTrackIndex],
    getGlobalState
  };

  /**
   * Inicialização automática ao carregar qualquer página do sistema.
   */
  function initOnPageLoad() {
    const card = document.getElementById('cardRadioBarretos');
    if (card) {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
    }

    let wasActive = false;
    try {
      wasActive = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {}

    if (wasActive) {
      play(true);

      const unlockOnFirstClick = () => {
        if (isPlaying) {
          startAudioWakeLock();
          forceResume();
        }
        document.removeEventListener('click', unlockOnFirstClick);
      };
      document.addEventListener('click', unlockOnFirstClick, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnPageLoad);
  } else {
    initOnPageLoad();
  }
})();
