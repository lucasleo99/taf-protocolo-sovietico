/**
 * TAF PROTOCOLO SOVIÉTICO - SISTEMA INTELIGENTE 2.0
 * Calibração Real, Wake Lock, Calculadora de Edital, Gráficos Chart.js e Sync Instantâneo
 */

// Estado Global da Aplicação
const AppState = {
  isCalibrated: false,
  profile: {
    age: 30,
    hrRest: 55,
    barraMod: 'roxa',
    barraModLabel: 'Superband Roxa (Média)'
  },
  currentFicha: 'A',
  targets: {
    A: {
      barraReps: 1,
      barraMod: 'roxa',
      abdReps: 8,
      runMin: 20
    },
    B: {
      type: 'B1',
      duration: 52
    },
    C: {
      flexaoReps: 3,
      runMin: 40
    },
    NC: {
      mode: '20',
      troteSec: 15,
      walkSec: 45
    }
  },
  timer: {
    isRunning: false,
    intervalId: null,
    totalMinutes: 40,
    currentMinute: 1,
    secondsLeft: 60,
    currentRepsDone: 1,
    historyReps: [],
    isAmrap: false,
    soundEnabled: true,
    voiceEnabled: true
  },
  history: [],
  simulados: []
};

// Forçar Atualização Limpando Cache do Celular
function forceReloadApp() {
  const btn = document.getElementById('btn-force-reload');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
  }

  // Gera timestamp para forçar o navegador a baixar a versão mais nova do servidor
  setTimeout(() => {
    window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
  }, 250);
}

// Wake Lock API (Impede celular de desligar tela no treino)
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      const pill = document.getElementById('wake-lock-pill');
      if (pill) pill.classList.remove('hidden');
    }
  } catch (err) {
    console.log('Wake Lock não suportado ou bloqueado:', err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
    const pill = document.getElementById('wake-lock-pill');
    if (pill) pill.classList.add('hidden');
  }
}

// ============================================================
// INICIALIZAÇÃO & VERIFICAÇÃO DE SINCRONIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Checar se abriu por um link de sincronização (#sync=...)
  checkUrlSyncHash();

  // 2. Carregar do LocalStorage
  loadFromLocalStorage();

  // 3. Checar calibração inicial
  checkCalibrationStatus();

  // 4. Calcular Zonas e Atualizar Telas
  calculateHeartZones();
  renderFichaCard('A');
  updateDesmameWidget();
  renderHistoryTable();
  renderSimuladosTable();
  calculateEditalScore();
  initCharts();
  setupKeyboardShortcuts();

  if (window.lucide) {
    lucide.createIcons();
  }
});

function checkCalibrationStatus() {
  const onboardingBanner = document.getElementById('onboarding-banner');
  const levelDesc = document.getElementById('header-level-desc');

  if (!AppState.isCalibrated && AppState.simulados.length === 0) {
    // Usuário novo!
    if (onboardingBanner) onboardingBanner.classList.remove('hidden');
    if (levelDesc) levelDesc.innerText = "Nível: Não Calibrado";
  } else {
    if (onboardingBanner) onboardingBanner.classList.add('hidden');
    const latest = AppState.simulados[0];
    if (levelDesc && latest) {
      levelDesc.innerText = `Barra: ${latest.barraTarget} rep (${getAssistanceLabel(latest.barraMod)}) | Flexão: ${latest.flexaoTarget} reps`;
    }
  }
}

function saveToLocalStorage() {
  const data = {
    isCalibrated: AppState.isCalibrated,
    profile: AppState.profile,
    targets: AppState.targets,
    history: AppState.history,
    simulados: AppState.simulados
  };
  localStorage.setItem('TAF_SOVIETICO_DATA', JSON.stringify(data));
  updateStatsCounters();
  updateCharts();
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('TAF_SOVIETICO_DATA');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.isCalibrated !== undefined) AppState.isCalibrated = parsed.isCalibrated;
      if (parsed.profile) AppState.profile = parsed.profile;
      if (parsed.targets) AppState.targets = parsed.targets;
      if (parsed.history) AppState.history = parsed.history;
      if (parsed.simulados) AppState.simulados = parsed.simulados;
    } catch (e) {
      console.error("Erro ao ler dados salvos:", e);
    }
  }

  // Preencher inputs de perfil se existirem
  const ageInput = document.getElementById('fc-idade');
  const restInput = document.getElementById('fc-repouso');
  if (ageInput) ageInput.value = AppState.profile.age;
  if (restInput) restInput.value = AppState.profile.hrRest;
}

// ============================================================
// NAVEGAÇÃO DE ABAS
// ============================================================

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => {
    el.classList.remove('active', 'border-rose-500', 'text-rose-400');
    el.classList.add('border-transparent', 'text-slate-400');
  });

  const targetContent = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);

  if (targetContent) targetContent.classList.add('active');
  if (targetBtn) {
    targetBtn.classList.add('active', 'border-rose-500', 'text-rose-400');
    targetBtn.classList.remove('border-transparent', 'text-slate-400');
  }

  if (tabId === 'historico') {
    setTimeout(updateCharts, 100);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ============================================================
// CALIBRAÇÃO DIDÁTICA DO PROTOCOLO (TESTE INICIAL / SIMULADO)
// ============================================================

function saveSimulado(e) {
  e.preventDefault();
  const date = document.getElementById('sim-date').value || new Date().toISOString().split('T')[0];
  const barraMax = parseInt(document.getElementById('sim-barra').value) || 0;
  const barraMod = document.getElementById('sim-barra-mod').value;
  const flexaoMax = parseInt(document.getElementById('sim-flexao').value) || 0;
  const abdMax = parseInt(document.getElementById('sim-abd').value) || 0;
  const distCorrida = document.getElementById('sim-dist').value || "2400";
  const tempoCorrida = document.getElementById('sim-tempo').value || "12:00";

  // Regra Soviética: repetições submáximas (~20% do teste máximo)
  let barraTarget = Math.max(1, Math.floor(barraMax * 0.20));
  let flexaoTarget = Math.max(1, Math.floor(flexaoMax * 0.18));
  let abdTarget = Math.max(5, Math.floor(abdMax * 0.20));

  AppState.isCalibrated = true;
  AppState.targets.A.barraReps = barraTarget;
  AppState.targets.A.barraMod = barraMod;
  AppState.targets.A.abdReps = abdTarget;
  AppState.targets.C.flexaoReps = flexaoTarget;
  AppState.profile.barraMod = barraMod;

  const simRecord = {
    id: Date.now(),
    date,
    barraMax,
    barraMod,
    barraTarget,
    flexaoMax,
    flexaoTarget,
    abdMax,
    abdTarget,
    corrida: `${distCorrida}m em ${tempoCorrida}`
  };

  AppState.simulados.unshift(simRecord);
  saveToLocalStorage();
  checkCalibrationStatus();
  renderSimuladosTable();
  renderFichaCard(AppState.currentFicha);
  calculateEditalScore();

  alert(`🎯 PROTOCOLO CALIBRADO COM SEUS ÍNDICES!\n\nMetas calculadas para as suas 20 séries de EMOM:\n• Barra Fixa: ${barraTarget} rep/min (${getAssistanceLabel(barraMod)})\n• Flexão: ${flexaoTarget} reps/min\n• Abdominal: ${abdTarget} reps/min\n\nAgora você já pode executar a Ficha A no timer!`);
  switchTab('treino');
}

function renderSimuladosTable() {
  const tbody = document.getElementById('simulados-table-body');
  if (!tbody) return;

  if (AppState.simulados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">Nenhum teste registrado ainda. Preencha seus números acima para calibrar o sistema!</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.simulados.map(s => `
    <tr class="hover:bg-slate-900/60 transition">
      <td class="py-2.5 px-3 text-white">${s.date}</td>
      <td class="py-2.5 px-3 text-rose-400 font-bold">${s.barraMax} reps <span class="text-[10px] text-slate-400">(${getAssistanceLabel(s.barraMod)})</span></td>
      <td class="py-2.5 px-3 text-emerald-400 font-bold">${s.barraTarget} rep/min</td>
      <td class="py-2.5 px-3 text-amber-400 font-bold">${s.flexaoMax} reps</td>
      <td class="py-2.5 px-3 text-emerald-400 font-bold">${s.flexaoTarget} reps/min</td>
      <td class="py-2.5 px-3 text-sky-400 font-bold">${s.abdMax} reps</td>
      <td class="py-2.5 px-3 text-slate-300">${s.corrida}</td>
      <td class="py-2.5 px-3 text-right">
        <button onclick="deleteSimulado(${s.id})" class="text-rose-500 hover:text-rose-400 text-xs">Excluir</button>
      </td>
    </tr>
  `).join('');
}

function deleteSimulado(id) {
  if (confirm("Deseja apagar este registro de teste?")) {
    AppState.simulados = AppState.simulados.filter(s => s.id !== id);
    if (AppState.simulados.length === 0) AppState.isCalibrated = false;
    saveToLocalStorage();
    checkCalibrationStatus();
    renderSimuladosTable();
    calculateEditalScore();
  }
}

// ============================================================
// CALCULADORA DE PONTUAÇÃO DO EDITAL (CONCURSOS)
// ============================================================

function calculateEditalScore() {
  const select = document.getElementById('edital-selector');
  const editalType = select ? select.value : 'PF_AGENTE';

  const latest = AppState.simulados[0] || {
    barraMax: 1,
    flexaoMax: 0,
    abdMax: 0,
    corrida: "2400m em 12:00"
  };

  let barraPts = 0;
  let flexaoPts = 0;
  let abdPts = 0;
  let corridaPts = 0;
  let isAprovado = false;
  let tableRows = [];

  if (editalType === 'PF_AGENTE') {
    // Barra Fixa PF: Min 2 reps (2.0 pts), 3 (2.5), 4 (3.0), 5 (3.5), 6 (4.0), 7 (4.5), 8+ (5.0 pts)
    const b = latest.barraMod === 'livre' ? latest.barraMax : 0; // elástico não conta na prova
    if (b < 2) barraPts = 0;
    else if (b === 2) barraPts = 2.0;
    else if (b === 3) barraPts = 2.5;
    else if (b === 4) barraPts = 3.0;
    else if (b === 5) barraPts = 3.5;
    else if (b === 6) barraPts = 4.0;
    else if (b === 7) barraPts = 4.5;
    else barraPts = 5.0;

    // Abdominal Remador PF: Min 36 reps (2.0 pts)
    const a = latest.abdMax;
    if (a < 36) abdPts = 0;
    else if (a <= 37) abdPts = 2.0;
    else if (a <= 39) abdPts = 2.5;
    else if (a <= 41) abdPts = 3.0;
    else if (a <= 43) abdPts = 3.5;
    else if (a <= 45) abdPts = 4.0;
    else if (a <= 47) abdPts = 4.5;
    else abdPts = 5.0;

    // Corrida 12 min PF: Min 2.000m (2.0 pts), 2.350m+ (5.0 pts)
    corridaPts = 3.0; // estimativa padrão de ritmo médio

    const totalPts = barraPts + abdPts + corridaPts;
    isAprovado = barraPts >= 2.0 && abdPts >= 2.0 && corridaPts >= 2.0 && (totalPts >= 8.0);

    tableRows = [
      { nome: "Barra Fixa (Pronada)", atual: `${latest.barraMax} reps (${getAssistanceLabel(latest.barraMod)})`, min: "2 repetições livres", nota: `${barraPts.toFixed(1)} / 5.0 pts`, max: "8 reps (5.0 pts)" },
      { nome: "Abdominal Remador (1 min)", atual: `${latest.abdMax} reps`, min: "36 repetições", nota: `${abdPts.toFixed(1)} / 5.0 pts`, max: "48 reps (5.0 pts)" },
      { nome: "Corrida 12 Minutos", atual: latest.corrida, min: "2.000 metros", nota: `${corridaPts.toFixed(1)} / 5.0 pts`, max: "2.600m (5.0 pts)" }
    ];
  } else {
    // PRF / PC / PM
    const b = latest.barraMod === 'livre' ? latest.barraMax : 0;
    barraPts = b >= 3 ? 3.0 : 0;
    flexaoPts = latest.flexaoMax >= 25 ? 3.0 : 1.5;
    abdPts = latest.abdMax >= 35 ? 3.0 : 1.5;
    isAprovado = barraPts >= 3.0 && flexaoPts >= 2.5;

    tableRows = [
      { nome: "Barra Fixa", atual: `${latest.barraMax} reps (${getAssistanceLabel(latest.barraMod)})`, min: "3 repetições livres", nota: `${barraPts.toFixed(1)} pts`, max: "10 reps" },
      { nome: "Flexão de Braços", atual: `${latest.flexaoMax} reps`, min: "25 repetições", nota: `${flexaoPts.toFixed(1)} pts`, max: "40 reps" },
      { nome: "Abdominal", atual: `${latest.abdMax} reps`, min: "35 repetições", nota: `${abdPts.toFixed(1)} pts`, max: "45 reps" }
    ];
  }

  // Atualizar Placar
  const statusCard = document.getElementById('edital-status-card');
  const statusText = document.getElementById('edital-status-text');
  const statusDesc = document.getElementById('edital-status-desc');
  const pointsText = document.getElementById('edital-points-text');
  const critText = document.getElementById('edital-critical-text');
  const tableBody = document.getElementById('edital-table-body');

  if (statusText) {
    if (isAprovado) {
      statusText.innerText = "APROVADO! 🎉";
      statusText.className = "text-2xl font-black text-emerald-400 my-1";
      statusCard.className = "p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-center flex flex-col justify-center items-center";
      statusDesc.innerText = "Você atinge os índices mínimos exigidos pelo edital.";
    } else {
      statusText.innerText = "REPROVADO ⚠️";
      statusText.className = "text-2xl font-black text-rose-500 my-1";
      statusCard.className = "p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 text-center flex flex-col justify-center items-center";
      statusDesc.innerText = "Atenção: A barra fixa exige pelo menos repetições livres válidas.";
    }
  }

  if (pointsText) pointsText.innerText = `${(barraPts + abdPts + corridaPts + flexaoPts).toFixed(1)} pts`;
  if (critText) critText.innerText = latest.barraMod !== 'livre' ? "Barra Fixa (Precisa do desmame)" : "Manutenção de Ritmo";

  if (tableBody) {
    tableBody.innerHTML = tableRows.map(r => `
      <tr class="hover:bg-slate-900/60 transition">
        <td class="py-2.5 px-3 text-white font-semibold">${r.nome}</td>
        <td class="py-2.5 px-3 text-amber-300">${r.atual}</td>
        <td class="py-2.5 px-3 text-slate-300">${r.min}</td>
        <td class="py-2.5 px-3 font-bold ${r.nota.startsWith('0') ? 'text-rose-500' : 'text-emerald-400'}">${r.nota}</td>
        <td class="py-2.5 px-3 text-slate-400">${r.max}</td>
      </tr>
    `).join('');
  }
}

// ============================================================
// RENDERIZAÇÃO DAS FICHAS DE TREINO (A, B, C)
// ============================================================

function selectFicha(fichaKey) {
  AppState.currentFicha = fichaKey;
  
  document.querySelectorAll('.ficha-selector').forEach(btn => {
    btn.classList.remove('border-rose-500', 'bg-rose-950/40');
    btn.classList.add('border-slate-800', 'bg-slate-900/60');
  });
  const activeBtn = document.getElementById(`btn-ficha-${fichaKey}`);
  if (activeBtn) {
    activeBtn.classList.add('border-rose-500', 'bg-rose-950/40');
    activeBtn.classList.remove('border-slate-800', 'bg-slate-900/60');
  }

  renderFichaCard(fichaKey);
}

function renderFichaCard(fichaKey) {
  const container = document.getElementById('ficha-card-container');
  if (!container) return;

  const zones = calculateHeartZones();
  const z2Range = `${zones[1].minBpm}-${zones[1].maxBpm} bpm`;
  const z3Range = `${zones[2].minBpm}-${zones[2].maxBpm} bpm`;

  if (fichaKey === 'A') {
    const t = AppState.targets.A;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div>
          <span class="text-xs font-bold text-rose-400 uppercase tracking-wider block">Ficha do Dia</span>
          <h2 class="text-lg md:text-xl font-black text-white">Ficha A: Barra Fixa + Abdominal + Corrida</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openManualModal('A')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 transition">
            Preencher Manual
          </button>
          <button onclick="launchWorkoutTimer('A')" class="btn-pressable px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-950/50 transition">
            <i data-lucide="play" class="w-4 h-4"></i> Iniciar no EMOM Timer
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <!-- Aquecimento -->
        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-slate-400 block mb-1">1. Aquecimento</span>
          <div class="text-sm font-semibold text-white">10 a 15 reps leves</div>
          <p class="text-xs text-slate-400 mt-1">1 minuto de descanso antes de começar o EMOM.</p>
        </div>

        <!-- EMOM 40' -->
        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-rose-900/60 ring-1 ring-rose-500/30">
          <span class="text-xs font-bold text-rose-400 block mb-1">2. Bloco Principal (40' EMOM)</span>
          <div class="space-y-1 text-xs text-slate-200">
            <div class="flex justify-between items-center bg-slate-800/80 px-2 py-1 rounded">
              <span>Minutos Ímpares (Barra):</span>
              <span class="font-bold text-rose-400 font-mono">${t.barraReps} rep (${getAssistanceLabel(t.barraMod)})</span>
            </div>
            <div class="flex justify-between items-center bg-slate-800/80 px-2 py-1 rounded">
              <span>Minutos Pares (Abdominal):</span>
              <span class="font-bold text-sky-400 font-mono">${t.abdReps} reps</span>
            </div>
            <div class="text-[11px] text-amber-300 font-semibold pt-1">
              🔥 Min 39 e 40: <strong>Até a falha técnica!</strong>
            </div>
          </div>
        </div>

        <!-- Corrida 20' -->
        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-emerald-400 block mb-1">3. Corrida Contínua (20')</span>
          <div class="space-y-1 text-xs text-slate-300 font-mono">
            <div>&bull; 5' em <strong>Z2</strong> (${z2Range})</div>
            <div>&bull; 10' em <strong>Z3</strong> (${z3Range})</div>
            <div>&bull; 5' em <strong>Z2</strong> (${z2Range})</div>
          </div>
          <span class="text-[10px] text-slate-500 mt-1 block">Pronto para lançar no Garmin</span>
        </div>
      </div>

      <!-- Seletor de Elástico da Barra -->
      <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-slate-400 font-semibold">Assistência da Barra Hoje:</span>
          <select id="select-ficha-a-mod" onchange="updateFichaAMod(this.value)" class="bg-slate-800 border border-slate-700 text-amber-300 font-bold rounded-lg px-2.5 py-1 focus:outline-none">
            <option value="roxa" ${t.barraMod === 'roxa' ? 'selected' : ''}>Superband Roxa (Média)</option>
            <option value="verde" ${t.barraMod === 'verde' ? 'selected' : ''}>Superband Verde (Forte)</option>
            <option value="vermelha" ${t.barraMod === 'vermelha' ? 'selected' : ''}>Superband Vermelha (Leve)</option>
            <option value="livre" ${t.barraMod === 'livre' ? 'selected' : ''}>Sem elástico (Livre)</option>
            <option value="excentrica" ${t.barraMod === 'excentrica' ? 'selected' : ''}>Excêntrica (Descida 4s)</option>
          </select>
        </div>

        <div class="text-slate-400 font-mono">
          Volume Estimado: <strong class="text-white">${t.barraReps * 19}+ falha</strong> barras | <strong class="text-white">${t.abdReps * 19}+ falha</strong> abdominais
        </div>
      </div>
    `;
  } else if (fichaKey === 'B') {
    const t = AppState.targets.B;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div>
          <span class="text-xs font-bold text-amber-400 uppercase tracking-wider block">Treino de Tiros</span>
          <h2 class="text-lg md:text-xl font-black text-white">Ficha B: Corrida Intervalada (52 minutos)</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openManualModal('B')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 transition">
            Registrar Tiro
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs text-slate-400">Tipo de Tiro:</span>
        <div class="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
          <button onclick="setBType('B1')" class="px-3 py-1 text-xs font-bold rounded ${t.type === 'B1' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}">
            B.1 - Tiro Curto
          </button>
          <button onclick="setBType('B2')" class="px-3 py-1 text-xs font-bold rounded ${t.type === 'B2' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}">
            B.2 - Tiro Longo
          </button>
        </div>
      </div>

      <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
        <span class="font-bold text-white block">Como Executar no Garmin:</span>
        ${t.type === 'B1' ? `
          <p class="text-slate-300 leading-relaxed font-mono">
            Aquec. 5 min Z2 &rarr; 2 min Caminhada &rarr; <strong>20x [30 seg Tiro Máximo / 90 seg Caminhada]</strong> &rarr; Desaquec. 5 min Z2.
          </p>
        ` : `
          <p class="text-slate-300 leading-relaxed font-mono">
            Aquec. 5 min Z2 &rarr; 2 min Caminhada &rarr; <strong>8x [2 min Tiro Forte / 3 min Caminhada]</strong> &rarr; Desaquec. 5 min Z2.
          </p>
        `}
      </div>
    `;
  } else if (fichaKey === 'C') {
    const t = AppState.targets.C;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div>
          <span class="text-xs font-bold text-sky-400 uppercase tracking-wider block">Ficha do Dia</span>
          <h2 class="text-lg md:text-xl font-black text-white">Ficha C: Flexão de Braço + 40' Trote Z2</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openManualModal('C')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 transition">
            Preencher Manual
          </button>
          <button onclick="launchWorkoutTimer('C')" class="btn-pressable px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-950/50 transition">
            <i data-lucide="play" class="w-4 h-4"></i> Iniciar no EMOM Timer
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-slate-400 block mb-1">1. Aquecimento</span>
          <div class="text-sm font-semibold text-white">10 a 15 reps leves</div>
          <p class="text-xs text-slate-400 mt-1">1 minuto de descanso.</p>
        </div>

        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-sky-900/60 ring-1 ring-sky-500/30">
          <span class="text-xs font-bold text-sky-400 block mb-1">2. Bloco Principal (20' EMOM)</span>
          <div class="space-y-1 text-xs text-slate-200">
            <div class="flex justify-between items-center bg-slate-800/80 px-2 py-1 rounded">
              <span>Minutos 1 a 19 (Flexão):</span>
              <span class="font-bold text-sky-400 font-mono">${t.flexaoReps} reps/min</span>
            </div>
            <div class="text-[11px] text-amber-300 font-semibold pt-1">
              🔥 Minuto 20: <strong>Até a falha técnica!</strong>
            </div>
          </div>
        </div>

        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-emerald-400 block mb-1">3. Trote Longo Z2</span>
          <div class="text-sm font-bold text-emerald-300 font-mono">40 min contínuos</div>
          <div class="text-xs text-slate-400 mt-1">Faixa: <strong>${z2Range}</strong></div>
        </div>
      </div>
    `;
  } else if (fichaKey === 'NC') {
    const t = AppState.targets.NC;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div>
          <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Transição de Corrida</span>
          <h2 class="text-lg md:text-xl font-black text-white">Progressão para Não Corredores</h2>
        </div>
        <button onclick="launchWorkoutTimer('NC')" class="btn-pressable px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition">
          <i data-lucide="play" class="w-4 h-4"></i> Iniciar Timer de Corrida
        </button>
      </div>

      <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
        <div class="flex justify-between items-center">
          <span class="text-slate-300 font-bold">Estrutura do Minuto:</span>
          <span class="font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
            ${t.troteSec}" Trote / ${60 - t.troteSec}" Caminhada
          </span>
        </div>
        <p class="text-slate-400 leading-relaxed text-[11px]">
          Corra suavemente nos primeiros ${t.troteSec} segundos de cada minuto e caminhe no restante. O cronômetro apitará para você alternar!
        </p>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function updateFichaAMod(newMod) {
  AppState.targets.A.barraMod = newMod;
  AppState.profile.barraMod = newMod;
  AppState.profile.barraModLabel = getAssistanceLabel(newMod);
  saveToLocalStorage();
  checkCalibrationStatus();
  updateDesmameWidget();
}

function updateDesmameWidget() {
  const currentMod = AppState.targets.A.barraMod;
  const pill = document.getElementById('desmame-status-pill');
  const hint = document.getElementById('desmame-hint-text');

  const steps = ['verde', 'roxa', 'vermelha', 'livre'];
  steps.forEach(s => {
    const el = document.getElementById(`step-${s}`);
    if (!el) return;
    if (s === currentMod) {
      el.className = "p-2.5 rounded-xl border border-amber-500/50 bg-amber-950/30 ring-1 ring-amber-500/40";
      const badge = el.querySelector('span');
      if (badge) badge.className = "text-[10px] text-amber-400 block uppercase font-sans font-bold";
    } else {
      el.className = "p-2.5 rounded-xl border border-slate-800 bg-slate-950/60";
      const badge = el.querySelector('span');
      if (badge) badge.className = "text-[10px] text-slate-500 block uppercase font-sans";
    }
  });

  if (pill) pill.innerText = `Fase Atual: ${getAssistanceLabel(currentMod)}`;

  // Olhar último resultado de falha
  const lastA = AppState.history.find(h => h.ficha === 'A');
  if (hint && lastA && lastA.barraFalha !== undefined) {
    if (lastA.barraFalha >= 8 && currentMod !== 'livre') {
      hint.innerHTML = `🏆 <strong>HORA DO DESMAME!</strong> No seu último treino você fez <strong>${lastA.barraFalha} repetições</strong> na série da falha! Seu corpo já adaptou: reduza o elástico para o próximo nível ou faça um teste de Barra Livre!`;
    } else {
      hint.innerHTML = `📊 <strong>Seu último minuto 39 (falha):</strong> você fez <strong>${lastA.barraFalha} reps</strong> com ${getAssistanceLabel(currentMod)}. Faltam <strong>${Math.max(1, 8 - lastA.barraFalha)} reps</strong> para o sistema liberar o próximo elástico!`;
    }
  }
}

function setBType(type) {
  AppState.targets.B.type = type;
  saveToLocalStorage();
  renderFichaCard('B');
}

function getAssistanceLabel(mod) {
  const map = {
    'livre': 'Barra Livre',
    'verde': 'Superband Verde (Forte)',
    'roxa': 'Superband Roxa (Média)',
    'vermelha': 'Superband Vermelha (Leve)',
    'excentrica': 'Excêntrica Lenta'
  };
  return map[mod] || 'Superband Roxa';
}

// ============================================================
// EMOM LIVE TIMER (COM WAKE LOCK & CONTROLE INTEGRADO)
// ============================================================

function launchWorkoutTimer(fichaKey) {
  AppState.currentFicha = fichaKey;
  switchTab('timer');

  if (fichaKey === 'A') AppState.timer.totalMinutes = 40;
  else if (fichaKey === 'C') AppState.timer.totalMinutes = 20;
  else if (fichaKey === 'NC') AppState.timer.totalMinutes = parseInt(AppState.targets.NC.mode) || 20;
  else AppState.timer.totalMinutes = 52;

  AppState.timer.currentMinute = 1;
  AppState.timer.secondsLeft = 60;
  AppState.timer.historyReps = [];
  AppState.timer.isRunning = false;
  clearInterval(AppState.timer.intervalId);

  setupMinuteTarget();
  updateTimerUI();
}

function startOrPauseTimer() {
  getAudioContext();

  const playBtn = document.getElementById('btn-timer-play');
  const doneBtn = document.getElementById('btn-timer-done');

  if (AppState.timer.isRunning) {
    // Pausar
    clearInterval(AppState.timer.intervalId);
    AppState.timer.isRunning = false;
    releaseWakeLock(); // libera tela
    playBtn.innerHTML = `<i data-lucide="play" class="w-6 h-6"></i> RETOMAR`;
    doneBtn.disabled = true;
  } else {
    // Iniciar
    AppState.timer.isRunning = true;
    requestWakeLock(); // ativa tela sempre acesa!
    playBtn.innerHTML = `<i data-lucide="pause" class="w-6 h-6"></i> PAUSAR`;
    playBtn.classList.replace('from-rose-600', 'from-amber-600');
    playBtn.classList.replace('to-rose-700', 'to-amber-700');
    doneBtn.disabled = false;

    if (AppState.timer.secondsLeft === 60) {
      announceCurrentRound();
    }

    AppState.timer.intervalId = setInterval(timerTick, 1000);
  }
  lucide.createIcons();
}

function timerTick() {
  AppState.timer.secondsLeft--;

  if (AppState.timer.secondsLeft === 3 || AppState.timer.secondsLeft === 2 || AppState.timer.secondsLeft === 1) {
    playBeep(800, 0.1);
  }

  if (AppState.timer.secondsLeft <= 0) {
    playBeep(1200, 0.35);

    if (AppState.timer.historyReps.length < AppState.timer.currentMinute) {
      AppState.timer.historyReps.push(AppState.timer.currentRepsDone);
    }

    if (AppState.timer.currentMinute >= AppState.timer.totalMinutes) {
      finishWorkoutTimer();
      return;
    }

    AppState.timer.currentMinute++;
    AppState.timer.secondsLeft = 60;
    setupMinuteTarget();
    announceCurrentRound();
  }

  updateTimerUI();
}

function setupMinuteTarget() {
  const f = AppState.currentFicha;
  const min = AppState.timer.currentMinute;

  if (f === 'A') {
    AppState.timer.currentRepsDone = min % 2 !== 0 ? AppState.targets.A.barraReps : AppState.targets.A.abdReps;
  } else if (f === 'C') {
    AppState.timer.currentRepsDone = AppState.targets.C.flexaoReps;
  } else if (f === 'NC') {
    AppState.timer.currentRepsDone = AppState.targets.NC.troteSec;
  }
}

function announceCurrentRound() {
  const f = AppState.currentFicha;
  const min = AppState.timer.currentMinute;
  const isFinal = (f === 'A' && (min === 39 || min === 40)) || (f === 'C' && min === 20) || (f === 'NC' && min === AppState.timer.totalMinutes);

  if (isFinal) {
    speakVoice("Atenção! Série até a falha. Dê o seu máximo!");
    return;
  }

  if (f === 'A') {
    if (min % 2 !== 0) speakVoice(`Minuto ${min}: Barra Fixa. ${AppState.targets.A.barraReps} repetição.`);
    else speakVoice(`Minuto ${min}: Abdominal. ${AppState.targets.A.abdReps} repetições.`);
  } else if (f === 'C') {
    speakVoice(`Minuto ${min}: Flexão. ${AppState.targets.C.flexaoReps} repetições.`);
  }
}

function updateTimerUI() {
  const clockEl = document.getElementById('timer-clock');
  const roundEl = document.getElementById('timer-round-info');
  const currentExEl = document.getElementById('timer-current-exercise');
  const nextPreviewEl = document.getElementById('timer-next-preview');
  const targetRepEl = document.getElementById('current-rep-target');
  const assistTagEl = document.getElementById('current-assistance-tag');
  const progressBar = document.getElementById('timer-progress-bar');
  const amrapBanner = document.getElementById('amrap-banner');
  const workoutTag = document.getElementById('timer-workout-tag');

  const min = AppState.timer.currentMinute;
  const total = AppState.timer.totalMinutes;
  const sec = AppState.timer.secondsLeft;
  const f = AppState.currentFicha;

  const minsStr = String(Math.floor(sec / 60)).padStart(2, '0');
  const secsStr = String(sec % 60).padStart(2, '0');
  if (clockEl) clockEl.innerText = `${minsStr}:${secsStr}`;
  if (roundEl) roundEl.innerText = `Minuto ${min} de ${total}`;
  if (progressBar) progressBar.style.width = `${(sec / 60) * 100}%`;
  if (workoutTag) workoutTag.innerText = `FICHA ${f} • EMOM ${total} MIN`;

  const isFinal = (f === 'A' && (min === 39 || min === 40)) || (f === 'C' && min === 20) || (f === 'NC' && min === total);
  if (amrapBanner) {
    if (isFinal) amrapBanner.classList.remove('hidden');
    else amrapBanner.classList.add('hidden');
  }

  if (f === 'A') {
    if (min % 2 !== 0) {
      currentExEl.innerText = isFinal ? `Minuto ${min}: BARRA FIXA (FALHA 🔥)` : `Minuto ${min}: BARRA FIXA`;
      nextPreviewEl.innerText = `A seguir: Minuto ${min + 1} • Abdominal (${AppState.targets.A.abdReps} reps)`;
      targetRepEl.innerText = `${AppState.timer.currentRepsDone} rep`;
      assistTagEl.innerText = `(${getAssistanceLabel(AppState.targets.A.barraMod)})`;
      assistTagEl.classList.remove('hidden');
    } else {
      currentExEl.innerText = isFinal ? `Minuto ${min}: ABDOMINAL (FALHA 🔥)` : `Minuto ${min}: ABDOMINAL`;
      nextPreviewEl.innerText = min < total ? `A seguir: Minuto ${min + 1} • Barra Fixa (${AppState.targets.A.barraReps} rep)` : `A seguir: Fim do EMOM & Corrida 20'`;
      targetRepEl.innerText = `${AppState.timer.currentRepsDone} reps`;
      assistTagEl.classList.add('hidden');
    }
  } else if (f === 'C') {
    currentExEl.innerText = isFinal ? `Minuto ${min}: FLEXÃO (FALHA 🔥)` : `Minuto ${min}: FLEXÃO DE BRAÇO`;
    nextPreviewEl.innerText = min < total ? `A seguir: Minuto ${min + 1} • Flexão (${AppState.targets.C.flexaoReps} reps)` : `A seguir: Corrida 40' Z2`;
    targetRepEl.innerText = `${AppState.timer.currentRepsDone} reps`;
    assistTagEl.classList.add('hidden');
  }
}

function adjustCurrentRep(delta) {
  AppState.timer.currentRepsDone = Math.max(0, AppState.timer.currentRepsDone + delta);
  updateTimerUI();
}

function markSeriesCompleted() {
  playBeep(1000, 0.1);
  AppState.timer.historyReps[AppState.timer.currentMinute - 1] = AppState.timer.currentRepsDone;

  const btn = document.getElementById('btn-timer-done');
  if (btn) {
    btn.classList.add('bg-emerald-400');
    setTimeout(() => btn.classList.remove('bg-emerald-400'), 250);
  }
}

function resetTimer() {
  if (confirm("Deseja reiniciar este treino?")) {
    clearInterval(AppState.timer.intervalId);
    releaseWakeLock();
    AppState.timer.isRunning = false;
    AppState.timer.currentMinute = 1;
    AppState.timer.secondsLeft = 60;
    AppState.timer.historyReps = [];

    const playBtn = document.getElementById('btn-timer-play');
    if (playBtn) {
      playBtn.innerHTML = `<i data-lucide="play" class="w-6 h-6"></i> INICIAR TREINO`;
      playBtn.classList.replace('from-amber-600', 'from-rose-600');
      playBtn.classList.replace('to-amber-700', 'to-rose-700');
    }
    setupMinuteTarget();
    updateTimerUI();
    lucide.createIcons();
  }
}

function finishWorkoutTimer() {
  clearInterval(AppState.timer.intervalId);
  releaseWakeLock();
  AppState.timer.isRunning = false;

  playBeep(1400, 0.5);
  speakVoice("Parabéns! Bloco EMOM concluído com sucesso!");

  const f = AppState.currentFicha;
  let totalBarra = 0, totalAbd = 0, totalFlexao = 0;
  let barraFalha = 0, abdFalha = 0, flexaoFalha = 0;

  if (f === 'A') {
    for (let i = 0; i < AppState.timer.historyReps.length; i++) {
      const reps = AppState.timer.historyReps[i] || (i % 2 === 0 ? AppState.targets.A.barraReps : AppState.targets.A.abdReps);
      if (i % 2 === 0) totalBarra += reps;
      else totalAbd += reps;
    }
    barraFalha = AppState.timer.historyReps[38] || AppState.targets.A.barraReps;
    abdFalha = AppState.timer.historyReps[39] || AppState.targets.A.abdReps;
  } else if (f === 'C') {
    totalFlexao = AppState.timer.historyReps.reduce((a, b) => a + (b || AppState.targets.C.flexaoReps), 0);
    flexaoFalha = AppState.timer.historyReps[19] || AppState.targets.C.flexaoReps;
  }

  let corridaDist = prompt(`Bloco EMOM Concluído!\nVolume: ${f === 'A' ? `${totalBarra} Barras, ${totalAbd} Abdominais` : `${totalFlexao} Flexões`}\n\nSe fez a corrida contínua pós-treino, digite a distância em km:`, "2.5");
  if (corridaDist === null) corridaDist = "0";

  const suggestion = calculateProgression(f, { barraFalha, abdFalha, flexaoFalha });

  const record = {
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ficha: f,
    totalBarra,
    totalAbd,
    totalFlexao,
    barraFalha,
    abdFalha,
    flexaoFalha,
    barraMod: AppState.targets.A.barraMod,
    distanceKm: parseFloat(corridaDist) || 0,
    suggestion: suggestion.text
  };

  AppState.history.unshift(record);

  if (suggestion.newTargets) {
    if (f === 'A') {
      if (suggestion.newTargets.barraReps) AppState.targets.A.barraReps = suggestion.newTargets.barraReps;
      if (suggestion.newTargets.barraMod) AppState.targets.A.barraMod = suggestion.newTargets.barraMod;
      if (suggestion.newTargets.abdReps) AppState.targets.A.abdReps = suggestion.newTargets.abdReps;
    } else if (f === 'C') {
      if (suggestion.newTargets.flexaoReps) AppState.targets.C.flexaoReps = suggestion.newTargets.flexaoReps;
    }
  }

  saveToLocalStorage();
  alert(`Treino Salvo com Sucesso no Diário!\n\n${suggestion.text}`);
  switchTab('historico');
}

function calculateProgression(ficha, results) {
  if (ficha === 'A') {
    const curBarra = AppState.targets.A.barraReps;
    const curMod = AppState.targets.A.barraMod;
    const falha = results.barraFalha;

    let text = "";
    let newTargets = {};

    if (falha >= 8 && curMod !== 'livre') {
      text = `🔥 Falha incrível (${falha} reps)! Sugestão: Reduza a assistência para o próximo elástico ou teste Barra Livre!`;
      if (curMod === 'verde') newTargets.barraMod = 'roxa';
      else if (curMod === 'roxa') newTargets.barraMod = 'vermelha';
      else if (curMod === 'vermelha') newTargets.barraMod = 'livre';
    } else if (falha >= curBarra * 3) {
      text = `⚡ Excelente adaptação! Aumente para ${curBarra + 1} reps por minuto.`;
      newTargets.barraReps = curBarra + 1;
    } else {
      text = `💪 Volume consolidado! Mantenha ${curBarra} rep (${getAssistanceLabel(curMod)}) para o próximo treino.`;
    }

    return { text, newTargets };
  } else if (ficha === 'C') {
    const curFlex = AppState.targets.C.flexaoReps;
    const falha = results.flexaoFalha;

    let text = "";
    let newTargets = {};

    if (falha >= curFlex * 2) {
      text = `🔥 Fez ${falha} flexões na última série! No próximo treino, aumente para ${curFlex + 1} reps por minuto.`;
      newTargets.flexaoReps = curFlex + 1;
    } else {
      text = `💪 Mantenha ${curFlex} reps/min até bater pelo menos ${curFlex * 2} na série até a falha.`;
    }

    return { text, newTargets };
  }

  return { text: "Treino registrado com sucesso!", newTargets: null };
}

// ============================================================
// GRÁFICOS VISUAIS (CHART.JS)
// ============================================================

let chartVolume = null;
let chartCorrida = null;

function initCharts() {
  const ctxVol = document.getElementById('chart-volume')?.getContext('2d');
  const ctxCor = document.getElementById('chart-corrida')?.getContext('2d');

  if (ctxVol) {
    chartVolume = new Chart(ctxVol, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Barras', data: [], backgroundColor: '#f43f5e' },
          { label: 'Flexões', data: [], backgroundColor: '#fbbf24' },
          { label: 'Abdominais', data: [], backgroundColor: '#38bdf8' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
          y: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af' } }
        },
        plugins: {
          legend: { labels: { color: '#e5e7eb', font: { size: 11 } } }
        }
      }
    });
  }

  if (ctxCor) {
    chartCorrida = new Chart(ctxCor, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Distância (km)',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
          y: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af' } }
        },
        plugins: {
          legend: { labels: { color: '#e5e7eb', font: { size: 11 } } }
        }
      }
    });
  }

  updateCharts();
}

function updateCharts() {
  if (!chartVolume || !chartCorrida) return;

  const lastWorkouts = AppState.history.slice(0, 8).reverse();

  chartVolume.data.labels = lastWorkouts.map(h => `${h.date.slice(5)} (${h.ficha})`);
  chartVolume.data.datasets[0].data = lastWorkouts.map(h => h.totalBarra || 0);
  chartVolume.data.datasets[1].data = lastWorkouts.map(h => h.totalFlexao || 0);
  chartVolume.data.datasets[2].data = lastWorkouts.map(h => h.totalAbd || 0);
  chartVolume.update();

  chartCorrida.data.labels = lastWorkouts.map(h => `${h.date.slice(5)}`);
  chartCorrida.data.datasets[0].data = lastWorkouts.map(h => h.distanceKm || 0);
  chartCorrida.update();
}

// ============================================================
// SINCRONIZAÇÃO INSTANTÂNEA VIA URL / WHATSAPP
// ============================================================

function generateSyncPayload() {
  const bundle = {
    isCalibrated: AppState.isCalibrated,
    profile: AppState.profile,
    targets: AppState.targets,
    history: AppState.history,
    simulados: AppState.simulados
  };
  return btoa(encodeURIComponent(JSON.stringify(bundle)));
}

function shareDataToWhatsApp() {
  const payload = generateSyncPayload();
  const url = `${window.location.origin}${window.location.pathname}#sync=${payload}`;
  const msg = encodeURIComponent(`🥋 Meus Treinos TAF Protocolo Soviético:\nClique no link abaixo para sincronizar todos os seus dados no aparelho:\n\n${url}`);
  window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

function copySyncLink() {
  const payload = generateSyncPayload();
  const url = `${window.location.origin}${window.location.pathname}#sync=${payload}`;
  navigator.clipboard.writeText(url).then(() => {
    alert("Link de Sincronização copiado!\nCole no WhatsApp ou envie para você mesmo para abrir no celular e sincronizar na hora.");
  });
}

function checkUrlSyncHash() {
  if (window.location.hash.startsWith('#sync=')) {
    try {
      const b64 = window.location.hash.replace('#sync=', '');
      const json = decodeURIComponent(atob(b64));
      const parsed = JSON.parse(json);

      if (parsed.profile) AppState.profile = parsed.profile;
      if (parsed.targets) AppState.targets = parsed.targets;
      if (parsed.history) AppState.history = parsed.history;
      if (parsed.simulados) AppState.simulados = parsed.simulados;
      AppState.isCalibrated = true;

      saveToLocalStorage();
      history.replaceState(null, null, ' ');
      alert("🎉 Treinos e configurações sincronizados com sucesso a partir do link!");
    } catch (e) {
      console.error("Erro ao importar do hash de sincronização:", e);
    }
  }
}

// ============================================================
// MOTOR DE ÁUDIO & VOZ
// ============================================================

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playBeep(freq = 800, duration = 0.1) {
  if (!AppState.timer.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function speakVoice(text) {
  if (!AppState.timer.voiceEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

function toggleSound() {
  AppState.timer.soundEnabled = !AppState.timer.soundEnabled;
  const btn = document.getElementById('btn-sound');
  if (btn) {
    btn.innerHTML = AppState.timer.soundEnabled ? 
      `<i data-lucide="volume-2" class="w-4 h-4 text-rose-400"></i> Som: Ligado` :
      `<i data-lucide="volume-x" class="w-4 h-4 text-slate-500"></i> Som: Mudo`;
    lucide.createIcons();
  }
}

function toggleVoice() {
  AppState.timer.voiceEnabled = !AppState.timer.voiceEnabled;
  const btn = document.getElementById('btn-voice');
  if (btn) {
    btn.innerHTML = AppState.timer.voiceEnabled ? 
      `<i data-lucide="mic" class="w-4 h-4 text-emerald-400"></i> Voz: Ligada` :
      `<i data-lucide="mic-off" class="w-4 h-4 text-slate-500"></i> Voz: Desligada`;
    lucide.createIcons();
  }
}

// ============================================================
// FREQUÊNCIA CARDÍACA (TANAKA + KARVONEN)
// ============================================================

function calculateHeartZones() {
  const age = parseInt(document.getElementById('fc-idade')?.value) || AppState.profile.age;
  const hrRest = parseInt(document.getElementById('fc-repouso')?.value) || AppState.profile.hrRest;

  AppState.profile.age = age;
  AppState.profile.hrRest = hrRest;

  const fcMax = 208 - (0.7 * age);
  const reserve = fcMax - hrRest;

  const zones = [
    { name: 'Z1', label: 'Recuperação', minPct: 0.50, maxPct: 0.60, colorClass: 'border-blue-500/40 bg-blue-950/20 text-blue-300' },
    { name: 'Z2', label: 'Base Aeróbica TAF', minPct: 0.60, maxPct: 0.70, colorClass: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 ring-1 ring-emerald-500/40' },
    { name: 'Z3', label: 'Ritmo / Tempo', minPct: 0.70, maxPct: 0.80, colorClass: 'border-amber-500/40 bg-amber-950/20 text-amber-300' },
    { name: 'Z4', label: 'Limiar Anaeróbico', minPct: 0.80, maxPct: 0.90, colorClass: 'border-orange-500/40 bg-orange-950/20 text-orange-300' },
    { name: 'Z5', label: 'Potência / VO2', minPct: 0.90, maxPct: 1.00, colorClass: 'border-rose-500/40 bg-rose-950/20 text-rose-300' },
  ];

  const zoneResults = zones.map(z => {
    const minBpm = Math.round(hrRest + (z.minPct * reserve));
    const maxBpm = Math.round(hrRest + (z.maxPct * reserve));
    return { ...z, minBpm, maxBpm };
  });

  const fcMaxDisplay = document.getElementById('fc-max-calculated');
  if (fcMaxDisplay) fcMaxDisplay.innerText = `${fcMax.toFixed(1)} bpm`;

  const container = document.getElementById('zones-cards-container');
  if (container) {
    container.innerHTML = zoneResults.map(z => `
      <div class="p-2.5 rounded-xl border ${z.colorClass}">
        <div class="text-[10px] font-bold uppercase tracking-wider">${z.name} (${Math.round(z.minPct * 100)}-${Math.round(z.maxPct * 100)}%)</div>
        <div class="text-sm font-black font-mono my-0.5">${z.minBpm} - ${z.maxBpm} <span class="text-[10px] font-normal">bpm</span></div>
        <div class="text-[10px] text-slate-400">${z.label}</div>
      </div>
    `).join('');
  }

  saveToLocalStorage();
  return zoneResults;
}

function copyGarminZones() {
  const zones = calculateHeartZones();
  const text = `ZONAS DE FREQUÊNCIA CARDÍACA (TANAKA + KARVONEN) PARA O GARMIN:
FC Máxima: ${208 - (0.7 * AppState.profile.age)} bpm | FC Repouso: ${AppState.profile.hrRest} bpm
Z1: ${zones[0].minBpm} a ${zones[0].maxBpm} bpm
Z2: ${zones[1].minBpm} a ${zones[1].maxBpm} bpm (Base Aeróbica TAF)
Z3: ${zones[2].minBpm} a ${zones[2].maxBpm} bpm (Ritmo TAF)
Z4: ${zones[3].minBpm} a ${zones[3].maxBpm} bpm (Tiros Longos)
Z5: ${zones[4].minBpm} a ${zones[4].maxBpm} bpm (Tiros Curtos)`;

  navigator.clipboard.writeText(text).then(() => {
    alert("Zonas copiadas! Use para configurar o seu Garmin Connect.");
  });
}

// ============================================================
// ASSESSORIA DE CORRIDA & PACE
// ============================================================

function calcPace() {
  const dist = parseFloat(document.getElementById('ass-dist')?.value);
  const timeStr = document.getElementById('ass-time')?.value;
  const paceInput = document.getElementById('ass-pace');

  if (!dist || !timeStr || !paceInput) return;

  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    const totalMins = mins + (secs / 60);

    if (dist > 0 && totalMins > 0) {
      const paceDecimal = totalMins / dist;
      const paceMins = Math.floor(paceDecimal);
      const paceSecs = Math.round((paceDecimal - paceMins) * 60);
      paceInput.value = `${paceMins}:${String(paceSecs).padStart(2, '0')} min/km`;
    }
  }
}

function saveAssessoriaRun(e) {
  e.preventDefault();
  const date = document.getElementById('ass-date').value || new Date().toISOString().split('T')[0];
  const type = document.getElementById('ass-type').value;
  const dist = parseFloat(document.getElementById('ass-dist').value) || 0;
  const time = document.getElementById('ass-time').value;
  const pace = document.getElementById('ass-pace').value;

  const record = {
    id: Date.now(),
    date,
    time: "Assessoria",
    ficha: 'ASS',
    assType: type,
    distanceKm: dist,
    duration: time,
    pace,
    suggestion: `Treino da Assessoria (${type}): Pace ${pace}`
  };

  AppState.history.unshift(record);
  saveToLocalStorage();
  renderHistoryTable();
  alert("Treino da assessoria registrado!");
  document.getElementById('assessoria-form').reset();
}

// ============================================================
// TABELA DE HISTÓRICO & EXPORTAÇÃO
// ============================================================

function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  const filter = document.getElementById('filter-ficha')?.value || 'ALL';
  if (!tbody) return;

  let items = AppState.history;
  if (filter !== 'ALL') items = items.filter(h => h.ficha === filter);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">Nenhum treino registrado ainda.</td></tr>`;
    updateStatsCounters();
    return;
  }

  tbody.innerHTML = items.map(h => {
    let details = "";
    let falha = "-";

    if (h.ficha === 'A') {
      details = `<strong class="text-rose-400">${h.totalBarra || 0}</strong> barras (${getAssistanceLabel(h.barraMod)}), <strong class="text-sky-400">${h.totalAbd || 0}</strong> abd`;
      falha = `Barra: ${h.barraFalha || '-'} | Abd: ${h.abdFalha || '-'}`;
    } else if (h.ficha === 'B') {
      details = `Tiros Intervalados (${h.bType || 'B1'})`;
      falha = `Tiros`;
    } else if (h.ficha === 'C') {
      details = `<strong class="text-amber-400">${h.totalFlexao || 0}</strong> flexões`;
      falha = `Flexão: ${h.flexaoFalha || '-'}`;
    } else if (h.ficha === 'ASS') {
      details = `Assessoria (${h.assType || 'Corrida'}, Pace: ${h.pace || '-'})`;
      falha = h.duration || '-';
    }

    return `
      <tr class="hover:bg-slate-900/60 transition">
        <td class="py-2.5 px-3 text-slate-300">${h.date}</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${getFichaBadgeClass(h.ficha)}">${h.ficha === 'ASS' ? 'ASSESSORIA' : `FICHA ${h.ficha}`}</span></td>
        <td class="py-2.5 px-3 text-slate-200">${details}</td>
        <td class="py-2.5 px-3 text-rose-300 font-semibold">${falha}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">${h.distanceKm > 0 ? `${h.distanceKm.toFixed(2)} km` : '-'}</td>
        <td class="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-xs" title="${h.suggestion || ''}">${h.suggestion || '-'}</td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="deleteHistoryItem(${h.id})" class="text-slate-500 hover:text-rose-400 text-xs"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  updateStatsCounters();
  if (window.lucide) lucide.createIcons();
}

function getFichaBadgeClass(ficha) {
  if (ficha === 'A') return 'bg-rose-950 text-rose-300 border border-rose-800';
  if (ficha === 'B') return 'bg-amber-950 text-amber-300 border border-amber-800';
  if (ficha === 'C') return 'bg-sky-950 text-sky-300 border border-sky-800';
  if (ficha === 'ASS') return 'bg-emerald-950 text-emerald-300 border border-emerald-800';
  return 'bg-slate-800 text-slate-300';
}

function updateStatsCounters() {
  let totalBarras = 0, totalFlexoes = 0, totalAbd = 0, totalKm = 0;
  AppState.history.forEach(h => {
    if (h.totalBarra) totalBarras += h.totalBarra;
    if (h.totalFlexao) totalFlexoes += h.totalFlexao;
    if (h.totalAbd) totalAbd += h.totalAbd;
    if (h.distanceKm) totalKm += h.distanceKm;
  });

  const bEl = document.getElementById('stat-total-barras');
  const fEl = document.getElementById('stat-total-flexoes');
  const aEl = document.getElementById('stat-total-abd');
  const kEl = document.getElementById('stat-total-km');

  if (bEl) bEl.innerText = totalBarras;
  if (fEl) fEl.innerText = totalFlexoes;
  if (aEl) aEl.innerText = totalAbd;
  if (kEl) kEl.innerText = `${totalKm.toFixed(1)} km`;
}

function deleteHistoryItem(id) {
  if (confirm("Deseja apagar este treino?")) {
    AppState.history = AppState.history.filter(h => h.id !== id);
    saveToLocalStorage();
    renderHistoryTable();
  }
}

function exportHistoryCSV() {
  if (AppState.history.length === 0) {
    alert("Nenhum histórico para exportar!");
    return;
  }

  let csvContent = "\uFEFFData;Hora;Ficha;Barras;Flexões;Abdominais;Distância (km);Falha / Detalhes;Sugestão\n";
  AppState.history.forEach(h => {
    csvContent += `"${h.date}";"${h.time}";"${h.ficha}";"${h.totalBarra || 0}";"${h.totalFlexao || 0}";"${h.totalAbd || 0}";"${(h.distanceKm || 0).toFixed(2)}";"${h.barraFalha || h.flexaoFalha || ''}";"${(h.suggestion || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TAF_Diario_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ============================================================
// BACKUP & RESTAURAÇÃO DE DADOS
// ============================================================

function downloadBackupJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    isCalibrated: AppState.isCalibrated,
    profile: AppState.profile,
    targets: AppState.targets,
    history: AppState.history,
    simulados: AppState.simulados
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_taf_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function restoreBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.isCalibrated !== undefined) AppState.isCalibrated = parsed.isCalibrated;
      if (parsed.profile) AppState.profile = parsed.profile;
      if (parsed.targets) AppState.targets = parsed.targets;
      if (parsed.history) AppState.history = parsed.history;
      if (parsed.simulados) AppState.simulados = parsed.simulados;

      saveToLocalStorage();
      checkCalibrationStatus();
      calculateHeartZones();
      renderFichaCard('A');
      renderHistoryTable();
      renderSimuladosTable();
      calculateEditalScore();
      alert("Backup restaurado com sucesso!");
    } catch (err) {
      alert("Arquivo de backup inválido.");
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm("ATENÇÃO: Tem certeza que deseja apagar todos os treinos e dados para começar 100% do zero?")) {
    localStorage.removeItem('TAF_SOVIETICO_DATA');
    location.reload();
  }
}

// ============================================================
// MODAL DE REGISTRO MANUAL
// ============================================================

function openManualModal(fichaKey) {
  AppState.currentFicha = fichaKey;
  const container = document.getElementById('manual-fields-container');
  const title = document.getElementById('manual-modal-title');
  const t = AppState.targets[fichaKey];

  title.innerText = `Registrar Ficha ${fichaKey} Manualmente`;

  if (fichaKey === 'A') {
    container.innerHTML = `
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="text-slate-400 block mb-1">Reps/Min Barra</label>
          <input type="number" id="man-barra-base" value="${t.barraReps}" class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
        <div>
          <label class="text-slate-400 block mb-1">Última Série Barra (Falha)</label>
          <input type="number" id="man-barra-falha" placeholder="ex: 4" required class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
        <div>
          <label class="text-slate-400 block mb-1">Reps/Min Abdominal</label>
          <input type="number" id="man-abd-base" value="${t.abdReps}" class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
        <div>
          <label class="text-slate-400 block mb-1">Última Série Abd (Falha)</label>
          <input type="number" id="man-abd-falha" placeholder="ex: 15" required class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
        <div class="col-span-2">
          <label class="text-slate-400 block mb-1">Distância Corrida 20' (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 2.80" class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
      </div>
    `;
  } else if (fichaKey === 'B') {
    container.innerHTML = `
      <div class="space-y-3 text-xs">
        <div>
          <label class="text-slate-400 block mb-1">Tipo de Tiro</label>
          <select id="man-b-type" class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white">
            <option value="B1">B.1 - Tiro Curto (20x 30"/90")</option>
            <option value="B2">B.2 - Tiro Longo (8x 2'/3')</option>
          </select>
        </div>
        <div>
          <label class="text-slate-400 block mb-1">Distância Total (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 6.20" required class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
      </div>
    `;
  } else if (fichaKey === 'C') {
    container.innerHTML = `
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="text-slate-400 block mb-1">Reps/Min Flexão</label>
          <input type="number" id="man-flex-base" value="${t.flexaoReps}" class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
        <div>
          <label class="text-slate-400 block mb-1">Última Série Flexão (Falha)</label>
          <input type="number" id="man-flex-falha" placeholder="ex: 8" required class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
        <div class="col-span-2">
          <label class="text-slate-400 block mb-1">Distância Corrida 40' Z2 (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 5.10" class="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono">
        </div>
      </div>
    `;
  }

  document.getElementById('modal-manual').classList.remove('hidden');
}

function closeManualModal() {
  document.getElementById('modal-manual').classList.add('hidden');
}

function submitManualWorkout(e) {
  e.preventDefault();
  const f = AppState.currentFicha;
  
  let record = {
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ficha: f,
    distanceKm: parseFloat(document.getElementById('man-dist')?.value) || 0
  };

  if (f === 'A') {
    const baseBarra = parseInt(document.getElementById('man-barra-base').value) || 1;
    const falhaBarra = parseInt(document.getElementById('man-barra-falha').value) || 1;
    const baseAbd = parseInt(document.getElementById('man-abd-base').value) || 8;
    const falhaAbd = parseInt(document.getElementById('man-abd-falha').value) || 8;

    record.totalBarra = (baseBarra * 19) + falhaBarra;
    record.totalAbd = (baseAbd * 19) + falhaAbd;
    record.barraFalha = falhaBarra;
    record.abdFalha = falhaAbd;
    record.barraMod = AppState.targets.A.barraMod;

    const prog = calculateProgression('A', { barraFalha: falhaBarra, abdFalha: falhaAbd });
    record.suggestion = prog.text;
  } else if (f === 'B') {
    record.bType = document.getElementById('man-b-type').value;
    record.suggestion = "Intervalado cumprido com sucesso!";
  } else if (f === 'C') {
    const baseFlex = parseInt(document.getElementById('man-flex-base').value) || 3;
    const falhaFlex = parseInt(document.getElementById('man-flex-falha').value) || 3;

    record.totalFlexao = (baseFlex * 19) + falhaFlex;
    record.flexaoFalha = falhaFlex;

    const prog = calculateProgression('C', { flexaoFalha: falhaFlex });
    record.suggestion = prog.text;
  }

  AppState.history.unshift(record);
  saveToLocalStorage();
  closeManualModal();
  renderHistoryTable();
  alert("Treino registrado no histórico!");
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && AppState.timer.isRunning) {
      const activeTag = document.activeElement.tagName.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        markSeriesCompleted();
      }
    }
  });
}
