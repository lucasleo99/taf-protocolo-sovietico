/**
 * TAF PROTOCOLO SOVIÉTICO - SISTEMA INTELIGENTE
 * Autorregulação, EMOM Timer, Zonas de FC e Integração Garmin
 */

// Estado da Aplicação
const AppState = {
  profile: {
    age: 35,
    hrRest: 45,
    barraMod: 'roxa', // 'livre', 'verde', 'roxa', 'vermelha', 'excentrica'
    barraModLabel: 'Superband Roxa (Média)'
  },
  currentFicha: 'A',
  targets: {
    A: {
      barraReps: 1,
      barraMod: 'roxa',
      abdReps: 10,
      runMin: 20
    },
    B: {
      type: 'B1', // 'B1' (tiro curto) ou 'B2' (tiro longo)
      duration: 52
    },
    C: {
      flexaoReps: 3,
      runMin: 40
    },
    NC: {
      mode: '20', // 20 ou 40 minutos
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
    historyReps: [], // reps feitas em cada minuto
    isAmrap: false,
    soundEnabled: true,
    voiceEnabled: true
  },
  history: [],
  simulados: []
};

// ============================================================
// INICIALIZAÇÃO & PERSISTÊNCIA (LOCALSTORAGE)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  calculateHeartZones();
  updateHeaderStats();
  renderFichaCard('A');
  renderHistoryTable();
  renderSimuladosTable();
  setupKeyboardShortcuts();
  
  if (window.lucide) {
    lucide.createIcons();
  }
});

function saveToLocalStorage() {
  const data = {
    profile: AppState.profile,
    targets: AppState.targets,
    history: AppState.history,
    simulados: AppState.simulados
  };
  localStorage.setItem('TAF_SOVIETICO_DATA', JSON.stringify(data));
  updateStatsCounters();
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('TAF_SOVIETICO_DATA');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.profile) AppState.profile = parsed.profile;
      if (parsed.targets) AppState.targets = parsed.targets;
      if (parsed.history) AppState.history = parsed.history;
      if (parsed.simulados) AppState.simulados = parsed.simulados;
    } catch (e) {
      console.error("Erro ao carregar dados salvos:", e);
    }
  } else {
    // Carregar dados de exemplo iniciais baseados na planilha do Halabi
    loadSampleData(false);
  }

  // Preencher campos de input do perfil se existirem
  const ageInput = document.getElementById('fc-idade');
  const restInput = document.getElementById('fc-repouso');
  if (ageInput) ageInput.value = AppState.profile.age;
  if (restInput) restInput.value = AppState.profile.hrRest;
}

// ============================================================
// NAVEGAÇÃO DE ABAS
// ============================================================

function switchTab(tabId) {
  // Ocultar todas as tabs
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => {
    el.classList.remove('active', 'border-rose-500', 'text-rose-400');
    el.classList.add('border-transparent', 'text-slate-400');
  });

  // Mostrar tab selecionada
  const targetContent = document.getElementById(`tab-${tabId}`) || document.getElementById(`${tabId}-tab`);
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);

  if (targetContent) targetContent.classList.add('active');
  if (targetBtn) {
    targetBtn.classList.add('active', 'border-rose-500', 'text-rose-400');
    targetBtn.classList.remove('border-transparent', 'text-slate-400');
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ============================================================
// CÁLCULO DE FREQUÊNCIA CARDÍACA (TANAKA + KARVONEN)
// ============================================================

function calculateHeartZones() {
  const age = parseInt(document.getElementById('fc-idade')?.value) || AppState.profile.age;
  const hrRest = parseInt(document.getElementById('fc-repouso')?.value) || AppState.profile.hrRest;

  AppState.profile.age = age;
  AppState.profile.hrRest = hrRest;

  // Tanaka: FCmax = 208 - (0.7 * Idade)
  const fcMax = 208 - (0.7 * age);
  const reserve = fcMax - hrRest;

  // Zonas de Karvonen
  const zones = [
    { name: 'Z1', label: 'Recuperação Ativa', minPct: 0.50, maxPct: 0.60, colorClass: 'border-blue-500/40 bg-blue-950/20 text-blue-300' },
    { name: 'Z2', label: 'Base Aeróbica (Chave TAF)', minPct: 0.60, maxPct: 0.70, colorClass: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 ring-1 ring-emerald-500/40' },
    { name: 'Z3', label: 'Ritmo / Tempo', minPct: 0.70, maxPct: 0.80, colorClass: 'border-amber-500/40 bg-amber-950/20 text-amber-300' },
    { name: 'Z4', label: 'Limiar Anaeróbico (Tiro Longo)', minPct: 0.80, maxPct: 0.90, colorClass: 'border-orange-500/40 bg-orange-950/20 text-orange-300' },
    { name: 'Z5', label: 'Potência / VO2 Máx (Tiro Curto)', minPct: 0.90, maxPct: 1.00, colorClass: 'border-rose-500/40 bg-rose-950/20 text-rose-300' },
  ];

  const zoneResults = zones.map(z => {
    const minBpm = Math.round(hrRest + (z.minPct * reserve));
    const maxBpm = Math.round(hrRest + (z.maxPct * reserve));
    return { ...z, minBpm, maxBpm };
  });

  // Atualizar UI
  const fcMaxDisplay = document.getElementById('fc-max-calculated');
  if (fcMaxDisplay) fcMaxDisplay.innerText = `${fcMax.toFixed(1)} bpm`;

  const headerZ2 = document.getElementById('header-z2-range');
  if (headerZ2) headerZ2.innerText = `${zoneResults[1].minBpm} - ${zoneResults[1].maxBpm} bpm`;

  const container = document.getElementById('zones-cards-container');
  if (container) {
    container.innerHTML = zoneResults.map(z => `
      <div class="p-3 rounded-xl border ${z.colorClass}">
        <div class="text-[11px] font-bold uppercase tracking-wider">${z.name} (${Math.round(z.minPct * 100)}-${Math.round(z.maxPct * 100)}%)</div>
        <div class="text-base font-black font-mono my-1">${z.minBpm} - ${z.maxBpm} <span class="text-xs font-normal">bpm</span></div>
        <div class="text-[10px] text-slate-400 leading-tight">${z.label}</div>
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
Z1: ${zones[0].minBpm} a ${zones[0].maxBpm} bpm (Recuperação)
Z2: ${zones[1].minBpm} a ${zones[1].maxBpm} bpm (Base Aeróbica TAF)
Z3: ${zones[2].minBpm} a ${zones[2].maxBpm} bpm (Ritmo de Prova)
Z4: ${zones[3].minBpm} a ${zones[3].maxBpm} bpm (Tiros Longos B2)
Z5: ${zones[4].minBpm} a ${zones[4].maxBpm} bpm (Tiros Curtos B1)`;

  navigator.clipboard.writeText(text).then(() => {
    alert("Zonas copiadas para a área de transferência! Cole no bloco de notas ou use para configurar o Garmin.");
  });
}

// ============================================================
// RENDERIZAÇÃO DAS FICHAS DE TREINO (A, B, C, NÃO CORREDORES)
// ============================================================

function selectFicha(fichaKey) {
  AppState.currentFicha = fichaKey;
  
  // Atualizar botões de seleção
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
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-2">
        <div>
          <span class="text-xs font-bold text-rose-400 uppercase tracking-wider block">Treino Previsto para Hoje</span>
          <h2 class="text-xl font-black text-white">Ficha A: Barra Fixa + Abdominal + Corrida</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openManualModal('A')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition">
            Preencher Manualmente
          </button>
          <button onclick="launchWorkoutTimer('A')" class="btn-pressable px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-900/40 transition">
            <i data-lucide="play" class="w-4 h-4"></i> Iniciar no EMOM Timer
          </button>
        </div>
      </div>

      <!-- Estrutura Geral -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Aquecimento -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-slate-400 block mb-1">1. Aquecimento</span>
          <div class="text-sm font-semibold text-white">10 a 15 reps leves</div>
          <p class="text-xs text-slate-400 mt-1">1 minuto de descanso antes de iniciar o EMOM.</p>
        </div>

        <!-- EMOM 40 Minutos -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-rose-900/50 ring-1 ring-rose-500/30">
          <span class="text-xs font-bold text-rose-400 block mb-1">2. Bloco Principal (40' EMOM)</span>
          <div class="space-y-1.5 text-xs text-slate-200">
            <div class="flex justify-between items-center bg-slate-800/80 px-2.5 py-1.5 rounded">
              <span>Minutos Ímpares (Barra):</span>
              <span class="font-bold text-rose-400 font-mono">${t.barraReps} rep (${getAssistanceLabel(t.barraMod)})</span>
            </div>
            <div class="flex justify-between items-center bg-slate-800/80 px-2.5 py-1.5 rounded">
              <span>Minutos Pares (Abdominal):</span>
              <span class="font-bold text-sky-400 font-mono">${t.abdReps} reps</span>
            </div>
            <div class="text-[11px] text-amber-300 font-semibold pt-1">
              🔥 Min 39 e 40: <strong>Até a falha técnica!</strong>
            </div>
          </div>
        </div>

        <!-- Corrida 20 Minutos -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-emerald-400 block mb-1">3. Corrida Contínua (20')</span>
          <div class="space-y-1 text-xs text-slate-300 font-mono">
            <div>&bull; 5' em <strong>Z2</strong> (${z2Range})</div>
            <div>&bull; 10' em <strong>Z3</strong> (${z3Range})</div>
            <div>&bull; 5' em <strong>Z2</strong> (${z2Range})</div>
          </div>
          <span class="text-[10px] text-slate-500 mt-1 block">Configuração pronta para o seu Garmin!</span>
        </div>
      </div>

      <!-- Ajuste Rápido de Metas da Sessão -->
      <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-400">Modalidade da Barra hoje:</span>
          <select id="select-ficha-a-mod" onchange="updateFichaAMod(this.value)" class="bg-slate-800 border border-slate-700 text-xs text-amber-300 font-bold rounded-lg px-2.5 py-1.5 focus:outline-none">
            <option value="livre" ${t.barraMod === 'livre' ? 'selected' : ''}>Sem elástico (Livre)</option>
            <option value="verde" ${t.barraMod === 'verde' ? 'selected' : ''}>Superband Verde (Forte)</option>
            <option value="roxa" ${t.barraMod === 'roxa' ? 'selected' : ''}>Superband Roxa (Média)</option>
            <option value="vermelha" ${t.barraMod === 'vermelha' ? 'selected' : ''}>Superband Vermelha (Leve)</option>
            <option value="excentrica" ${t.barraMod === 'excentrica' ? 'selected' : ''}>Excêntrica (Descida 4s)</option>
          </select>
        </div>

        <div class="text-xs text-slate-400">
          Volume Total Estimado: <strong class="text-white font-mono">${t.barraReps * 19}+ falha</strong> barras | <strong class="text-white font-mono">${t.abdReps * 19}+ falha</strong> abdominais
        </div>
      </div>
    `;
  } else if (fichaKey === 'B') {
    const t = AppState.targets.B;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-2">
        <div>
          <span class="text-xs font-bold text-amber-400 uppercase tracking-wider block">Treino de Tiros</span>
          <h2 class="text-xl font-black text-white">Ficha B: Corrida Intervalada (52 minutos)</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openManualModal('B')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition">
            Registrar Corrida
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-2">
        <span class="text-xs text-slate-400">Escolha o Tipo de Tiro de Hoje:</span>
        <div class="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
          <button onclick="setBType('B1')" class="px-3 py-1 text-xs font-bold rounded ${t.type === 'B1' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}">
            B.1 - Tiro Curto
          </button>
          <button onclick="setBType('B2')" class="px-3 py-1 text-xs font-bold rounded ${t.type === 'B2' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}">
            B.2 - Tiro Longo
          </button>
        </div>
      </div>

      ${t.type === 'B1' ? `
        <div class="bg-slate-900/90 p-5 rounded-xl border border-rose-900/40 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-rose-400">Estrutura B.1 (Tiro Curto - VO2 Máx)</h3>
            <span class="text-xs font-mono bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-800">52 minutos totais</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div class="bg-slate-800/70 p-3 rounded-lg">
              <span class="text-slate-400 block font-semibold">1. Aquecimento</span>
              <div class="font-bold text-white mt-1">5 min em Z2</div>
            </div>
            <div class="bg-slate-800/70 p-3 rounded-lg">
              <span class="text-slate-400 block font-semibold">2. Transição</span>
              <div class="font-bold text-white mt-1">2 min caminhada</div>
            </div>
            <div class="bg-rose-950/40 p-3 rounded-lg border border-rose-800/60 md:col-span-1">
              <span class="text-rose-400 block font-bold">3. Tiros (20 Séries)</span>
              <div class="font-bold text-white mt-1">30" Tiro Máximo + 90" Caminhada</div>
            </div>
            <div class="bg-slate-800/70 p-3 rounded-lg">
              <span class="text-slate-400 block font-semibold">4. Desaquecimento</span>
              <div class="font-bold text-white mt-1">5 min em Z2</div>
            </div>
          </div>
        </div>
      ` : `
        <div class="bg-slate-900/90 p-5 rounded-xl border border-sky-900/40 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-sky-400">Estrutura B.2 (Tiro Longo - Limiar de Lactato)</h3>
            <span class="text-xs font-mono bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800">52 minutos totais</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div class="bg-slate-800/70 p-3 rounded-lg">
              <span class="text-slate-400 block font-semibold">1. Aquecimento</span>
              <div class="font-bold text-white mt-1">5 min em Z2</div>
            </div>
            <div class="bg-slate-800/70 p-3 rounded-lg">
              <span class="text-slate-400 block font-semibold">2. Transição</span>
              <div class="font-bold text-white mt-1">2 min caminhada</div>
            </div>
            <div class="bg-sky-950/40 p-3 rounded-lg border border-sky-800/60 md:col-span-1">
              <span class="text-sky-400 block font-bold">3. Tiros (8 Séries)</span>
              <div class="font-bold text-white mt-1">2 min Tiro Forte (Z4-Z5) + 3 min Caminhada</div>
            </div>
            <div class="bg-slate-800/70 p-3 rounded-lg">
              <span class="text-slate-400 block font-semibold">4. Desaquecimento</span>
              <div class="font-bold text-white mt-1">5 min em Z2</div>
            </div>
          </div>
        </div>
      `}

      <div class="p-3 bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
        <i data-lucide="info" class="w-4 h-4 text-sky-400 flex-shrink-0"></i>
        <span>Como você faz corrida com assessoria, você pode usar os tiros da assessoria ou este modelo no Garmin. Registre a distância e o pace no botão acima!</span>
      </div>
    `;
  } else if (fichaKey === 'C') {
    const t = AppState.targets.C;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-2">
        <div>
          <span class="text-xs font-bold text-sky-400 uppercase tracking-wider block">Treino Previsto para Hoje</span>
          <h2 class="text-xl font-black text-white">Ficha C: Flexão de Braços + 40' Trote Longo Z2</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openManualModal('C')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition">
            Preencher Manualmente
          </button>
          <button onclick="launchWorkoutTimer('C')" class="btn-pressable px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-900/40 transition">
            <i data-lucide="play" class="w-4 h-4"></i> Iniciar no EMOM Timer
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Aquecimento -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-slate-400 block mb-1">1. Aquecimento</span>
          <div class="text-sm font-semibold text-white">10 a 15 reps leves</div>
          <p class="text-xs text-slate-400 mt-1">1 minuto de descanso antes de iniciar o EMOM.</p>
        </div>

        <!-- EMOM 20 Minutos -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-sky-900/50 ring-1 ring-sky-500/30">
          <span class="text-xs font-bold text-sky-400 block mb-1">2. Bloco Principal (20' EMOM)</span>
          <div class="space-y-1.5 text-xs text-slate-200">
            <div class="flex justify-between items-center bg-slate-800/80 px-2.5 py-1.5 rounded">
              <span>Minutos 1 a 19 (Flexão):</span>
              <span class="font-bold text-sky-400 font-mono">${t.flexaoReps} reps/min</span>
            </div>
            <div class="text-[11px] text-amber-300 font-semibold pt-1">
              🔥 Minuto 20: <strong>Até a falha técnica!</strong>
            </div>
          </div>
        </div>

        <!-- Corrida 40 Minutos Z2 -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <span class="text-xs font-bold text-emerald-400 block mb-1">3. Trote Longo (40')</span>
          <div class="text-sm font-bold text-emerald-300 font-mono">40 min contínuos em Zona 2</div>
          <div class="text-xs text-slate-400 mt-1">Faixa ideal: <strong>${z2Range}</strong></div>
          <span class="text-[10px] text-slate-500 mt-1 block">Mantenha respiração nasal/confortável</span>
        </div>
      </div>

      <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400">
        Volume Estimado: <strong class="text-white font-mono">${t.flexaoReps * 19}+ falha</strong> flexões de braço com técnica rigorosa do edital.
      </div>
    `;
  } else if (fichaKey === 'NC') {
    const t = AppState.targets.NC;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-2">
        <div>
          <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Módulo Especial de Transição</span>
          <h2 class="text-xl font-black text-white">Progressão para Não Corredores (EMOM Trote/Caminhada)</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="launchWorkoutTimer('NC')" class="btn-pressable px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition">
            <i data-lucide="play" class="w-4 h-4"></i> Iniciar Timer de Corrida
          </button>
        </div>
      </div>

      <p class="text-xs text-slate-300">
        Para quem ainda não consegue correr 20 ou 40 minutos contínuos sem parar. O protocolo fraciona o minuto entre trote suave e caminhada de recuperação:
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">Meta do Minuto Atual:</span>
            <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              ${t.troteSec}" Trote / ${60 - t.troteSec}" Caminhada
            </span>
          </div>
          <div class="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
            <div style="width: ${(t.troteSec/60)*100}%" class="bg-emerald-500 h-full"></div>
            <div style="width: ${((60-t.troteSec)/60)*100}%" class="bg-slate-600 h-full"></div>
          </div>
          <div class="flex justify-between text-[10px] text-slate-400">
            <span>Trote: ${t.troteSec} seg</span>
            <span>Caminhada: ${60 - t.troteSec} seg</span>
          </div>
        </div>

        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
          <span class="text-xs font-bold text-white block">Regra de Progressão:</span>
          <p class="text-[11px] text-slate-400 leading-relaxed">
            No último minuto (Minuto 20 ou 40), você corre em trote contínuo <strong>até a falha</strong>. Se conseguir passar de 1 minuto correndo direto na última volta, aumentamos +5 segundos de trote para o próximo treino!
          </p>
        </div>
      </div>
    `;
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateFichaAMod(newMod) {
  AppState.targets.A.barraMod = newMod;
  AppState.profile.barraMod = newMod;
  AppState.profile.barraModLabel = getAssistanceLabel(newMod);
  saveToLocalStorage();
  updateHeaderStats();
}

function setBType(type) {
  AppState.targets.B.type = type;
  saveToLocalStorage();
  renderFichaCard('B');
}

function getAssistanceLabel(mod) {
  const map = {
    'livre': 'Peso do Corpo',
    'verde': 'Superband Verde (Forte)',
    'roxa': 'Superband Roxa (Média)',
    'vermelha': 'Superband Vermelha (Leve)',
    'excentrica': 'Excêntrica Lenta'
  };
  return map[mod] || 'Superband Roxa';
}

function updateHeaderStats() {
  const barraEl = document.getElementById('header-barra-status');
  if (barraEl) {
    barraEl.innerText = getAssistanceLabel(AppState.targets.A.barraMod);
  }
}

// ============================================================
// MOTOR DE ÁUDIO & VOZ (WEB AUDIO API & SPEECH SYNTHESIS)
// ============================================================

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
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
  } catch (e) {
    console.error("Audio error:", e);
  }
}

function speakVoice(text) {
  if (!AppState.timer.voiceEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error("Voice error:", e);
  }
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
// EMOM LIVE TIMER (SISTEMA INTERATIVO)
// ============================================================

function launchWorkoutTimer(fichaKey) {
  AppState.currentFicha = fichaKey;
  switchTab('timer');

  // Configurar duração do EMOM
  if (fichaKey === 'A') {
    AppState.timer.totalMinutes = 40;
  } else if (fichaKey === 'C') {
    AppState.timer.totalMinutes = 20;
  } else if (fichaKey === 'NC') {
    AppState.timer.totalMinutes = parseInt(AppState.targets.NC.mode) || 20;
  } else {
    AppState.timer.totalMinutes = 52;
  }

  AppState.timer.currentMinute = 1;
  AppState.timer.secondsLeft = 60;
  AppState.timer.historyReps = [];
  AppState.timer.isRunning = false;
  clearInterval(AppState.timer.intervalId);

  updateTimerUI();
}

function startOrPauseTimer() {
  getAudioContext(); // desbloquear áudio

  const playBtn = document.getElementById('btn-timer-play');
  const doneBtn = document.getElementById('btn-timer-done');

  if (AppState.timer.isRunning) {
    // Pausar
    clearInterval(AppState.timer.intervalId);
    AppState.timer.isRunning = false;
    playBtn.innerHTML = `<i data-lucide="play" class="w-6 h-6"></i> RETOMAR`;
    doneBtn.disabled = true;
  } else {
    // Iniciar
    AppState.timer.isRunning = true;
    playBtn.innerHTML = `<i data-lucide="pause" class="w-6 h-6"></i> PAUSAR`;
    playBtn.classList.replace('from-rose-600', 'from-amber-600');
    playBtn.classList.replace('to-rose-700', 'to-amber-700');
    doneBtn.disabled = false;

    // Falar o primeiro minuto se começou agora
    if (AppState.timer.secondsLeft === 60) {
      announceCurrentRound();
    }

    AppState.timer.intervalId = setInterval(timerTick, 1000);
  }
  lucide.createIcons();
}

function timerTick() {
  AppState.timer.secondsLeft--;

  // Bipes de contagem regressiva nos últimos 3 segundos
  if (AppState.timer.secondsLeft === 3 || AppState.timer.secondsLeft === 2 || AppState.timer.secondsLeft === 1) {
    playBeep(800, 0.1);
  }

  // Virada do minuto
  if (AppState.timer.secondsLeft <= 0) {
    playBeep(1200, 0.35); // Bipe agudo de início da série

    // Salvar repetição realizada no minuto anterior se não tiver marcado
    if (AppState.timer.historyReps.length < AppState.timer.currentMinute) {
      AppState.timer.historyReps.push(AppState.timer.currentRepsDone);
    }

    if (AppState.timer.currentMinute >= AppState.timer.totalMinutes) {
      // Fim do EMOM!
      finishWorkoutTimer();
      return;
    }

    // Avançar minuto
    AppState.timer.currentMinute++;
    AppState.timer.secondsLeft = 60;
    
    // Atualizar meta padrão para o novo minuto
    setupMinuteTarget();
    announceCurrentRound();
  }

  updateTimerUI();
}

function setupMinuteTarget() {
  const f = AppState.currentFicha;
  const min = AppState.timer.currentMinute;

  if (f === 'A') {
    if (min % 2 !== 0) {
      // Barra
      AppState.timer.currentRepsDone = AppState.targets.A.barraReps;
    } else {
      // Abd
      AppState.timer.currentRepsDone = AppState.targets.A.abdReps;
    }
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
    if (min % 2 !== 0) {
      speakVoice(`Minuto ${min}: Barra Fixa. ${AppState.targets.A.barraReps} repetição.`);
    } else {
      speakVoice(`Minuto ${min}: Abdominal. ${AppState.targets.A.abdReps} repetições.`);
    }
  } else if (f === 'C') {
    speakVoice(`Minuto ${min}: Flexão. ${AppState.targets.C.flexaoReps} repetições.`);
  } else if (f === 'NC') {
    speakVoice(`Minuto ${min}: ${AppState.targets.NC.troteSec} segundos de trote.`);
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

  // Formato MM:SS
  const minsStr = String(Math.floor(sec / 60)).padStart(2, '0');
  const secsStr = String(sec % 60).padStart(2, '0');
  if (clockEl) clockEl.innerText = `${minsStr}:${secsStr}`;

  if (roundEl) roundEl.innerText = `Minuto ${min} de ${total}`;
  if (progressBar) progressBar.style.width = `${(sec / 60) * 100}%`;

  if (workoutTag) {
    workoutTag.innerText = `FICHA ${f} • EMOM ${total} MIN`;
  }

  // Identificar se é AMRAP (último minuto)
  const isFinal = (f === 'A' && (min === 39 || min === 40)) || (f === 'C' && min === 20) || (f === 'NC' && min === total);
  AppState.timer.isAmrap = isFinal;

  if (amrapBanner) {
    if (isFinal) {
      amrapBanner.classList.remove('hidden');
    } else {
      amrapBanner.classList.add('hidden');
    }
  }

  // Textos de Exercício
  if (f === 'A') {
    if (min % 2 !== 0) {
      currentExEl.innerText = isFinal ? `Minuto ${min}: BARRA FIXA (ATÉ A FALHA 🔥)` : `Minuto ${min}: BARRA FIXA`;
      nextPreviewEl.innerText = `A seguir: Minuto ${min + 1} • Abdominal (${AppState.targets.A.abdReps} reps)`;
      targetRepEl.innerText = `${AppState.timer.currentRepsDone} rep`;
      assistTagEl.innerText = `(${getAssistanceLabel(AppState.targets.A.barraMod)})`;
      assistTagEl.classList.remove('hidden');
    } else {
      currentExEl.innerText = isFinal ? `Minuto ${min}: ABDOMINAL (ATÉ A FALHA 🔥)` : `Minuto ${min}: ABDOMINAL`;
      nextPreviewEl.innerText = min < total ? `A seguir: Minuto ${min + 1} • Barra Fixa (${AppState.targets.A.barraReps} rep)` : `A seguir: Fim do EMOM & Corrida 20'`;
      targetRepEl.innerText = `${AppState.timer.currentRepsDone} reps`;
      assistTagEl.classList.add('hidden');
    }
  } else if (f === 'C') {
    currentExEl.innerText = isFinal ? `Minuto ${min}: FLEXÃO (ATÉ A FALHA 🔥)` : `Minuto ${min}: FLEXÃO DE BRAÇO`;
    nextPreviewEl.innerText = min < total ? `A seguir: Minuto ${min + 1} • Flexão (${AppState.targets.C.flexaoReps} reps)` : `A seguir: Corrida 40' Z2`;
    targetRepEl.innerText = `${AppState.timer.currentRepsDone} reps`;
    assistTagEl.classList.add('hidden');
  } else if (f === 'NC') {
    currentExEl.innerText = isFinal ? `Minuto ${min}: TROTE ATÉ A FALHA 🔥` : `Minuto ${min}: Trote Intervalado`;
    nextPreviewEl.innerText = `Trote ${AppState.targets.NC.troteSec}s / Caminhada ${60 - AppState.targets.NC.troteSec}s`;
    targetRepEl.innerText = `${AppState.timer.currentRepsDone} seg`;
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
  if (confirm("Deseja reiniciar este treino do início?")) {
    clearInterval(AppState.timer.intervalId);
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
  AppState.timer.isRunning = false;

  playBeep(1400, 0.5);
  speakVoice("Parabéns! Bloco EMOM concluído com sucesso!");

  // Calcular estatísticas finais
  const f = AppState.currentFicha;
  let totalBarra = 0;
  let totalAbd = 0;
  let totalFlexao = 0;
  let barraFalha = 0;
  let abdFalha = 0;
  let flexaoFalha = 0;

  if (f === 'A') {
    // minutos ímpares = barra, pares = abd
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

  // Perguntar distância da corrida
  let corridaDist = prompt(`Bloco EMOM Concluído!\nVolume Total: ${f === 'A' ? `${totalBarra} Barras, ${totalAbd} Abdominais` : `${totalFlexao} Flexões`}\n\nSe você fez a corrida contínua pós-treino, informe a distância percorrida em km (ex: 2.8):`, "2.5");

  if (corridaDist === null) corridaDist = "0";

  // Calcular autorregulação do próximo treino
  const suggestion = calculateProgression(f, { barraFalha, abdFalha, flexaoFalha });

  // Salvar no Histórico
  const workoutRecord = {
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

  AppState.history.unshift(workoutRecord);
  
  // Aplicar nova meta recomendada
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
  alert(`Treino Salvo com Sucesso no Histórico!\n\n${suggestion.text}`);
  switchTab('historico');
}

// ============================================================
// MOTOR DE AUTORREGULAÇÃO & PROGRESSÃO SOVIÉTICA
// ============================================================

function calculateProgression(ficha, results) {
  if (ficha === 'A') {
    const curBarra = AppState.targets.A.barraReps;
    const curMod = AppState.targets.A.barraMod;
    const falha = results.barraFalha;

    let text = "";
    let newTargets = {};

    if (falha >= 8 && curMod !== 'livre') {
      text = `🔥 Falha incrível (${falha} reps no elástico)! Sugestão: Reduza o elástico para um mais leve (ou teste barra livre no próximo treino!).`;
      if (curMod === 'verde') newTargets.barraMod = 'roxa';
      else if (curMod === 'roxa') newTargets.barraMod = 'vermelha';
      else if (curMod === 'vermelha') newTargets.barraMod = 'livre';
    } else if (falha >= curBarra * 3) {
      text = `⚡ Excelente reserva neural! Aumente de ${curBarra} para ${curBarra + 1} reps por minuto.`;
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
      text = `🔥 Fez ${falha} flexões na última série! No próximo treino, aumente a meta para ${curFlex + 1} reps por minuto.`;
      newTargets.flexaoReps = curFlex + 1;
    } else {
      text = `💪 Mantenha a meta de ${curFlex} reps/min até bater pelo menos ${curFlex * 2} na série até a falha.`;
    }

    return { text, newTargets };
  }

  return { text: "Treino registrado com sucesso!", newTargets: null };
}

// ============================================================
// REGISTRO MANUAL DE TREINOS (MODAL)
// ============================================================

function openManualModal(fichaKey) {
  AppState.currentFicha = fichaKey;
  const container = document.getElementById('manual-fields-container');
  const title = document.getElementById('manual-modal-title');
  const t = AppState.targets[fichaKey];

  title.innerText = `Registrar Ficha ${fichaKey} Manualmente`;

  if (fichaKey === 'A') {
    container.innerHTML = `
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Reps/Minuto Barra</label>
          <input type="number" id="man-barra-base" value="${t.barraReps}" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Última Série Barra (Falha)</label>
          <input type="number" id="man-barra-falha" placeholder="ex: 4" required class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Reps/Minuto Abdominal</label>
          <input type="number" id="man-abd-base" value="${t.abdReps}" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Última Série Abd (Falha)</label>
          <input type="number" id="man-abd-falha" placeholder="ex: 15" required class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div class="col-span-2">
          <label class="text-xs text-slate-400 block mb-1">Distância Corrida 20' (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 2.80" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
      </div>
    `;
  } else if (fichaKey === 'B') {
    container.innerHTML = `
      <div class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Tipo de Tiro</label>
          <select id="man-b-type" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
            <option value="B1">B.1 - Tiro Curto (20x 30"/90")</option>
            <option value="B2">B.2 - Tiro Longo (8x 2'/3')</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Distância Total Percorrida (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 6.20" required class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Tempo Total (minutos)</label>
          <input type="number" id="man-time" value="52" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
      </div>
    `;
  } else if (fichaKey === 'C') {
    container.innerHTML = `
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Reps/Minuto Flexão</label>
          <input type="number" id="man-flex-base" value="${t.flexaoReps}" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Última Série Flexão (Falha)</label>
          <input type="number" id="man-flex-falha" placeholder="ex: 8" required class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
        </div>
        <div class="col-span-2">
          <label class="text-xs text-slate-400 block mb-1">Distância Corrida 40' Z2 (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 5.10" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono">
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
    const baseAbd = parseInt(document.getElementById('man-abd-base').value) || 10;
    const falhaAbd = parseInt(document.getElementById('man-abd-falha').value) || 10;

    record.totalBarra = (baseBarra * 19) + falhaBarra;
    record.totalAbd = (baseAbd * 19) + falhaAbd;
    record.barraFalha = falhaBarra;
    record.abdFalha = falhaAbd;
    record.barraMod = AppState.targets.A.barraMod;

    const prog = calculateProgression('A', { barraFalha: falhaBarra, abdFalha: falhaAbd });
    record.suggestion = prog.text;
  } else if (f === 'B') {
    record.bType = document.getElementById('man-b-type').value;
    record.suggestion = "Intervalado cumprido! Excelente estímulo de VO2.";
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
  alert("Treino registrado no histórico com sucesso!");
}

// ============================================================
// SIMULADOS & TESTES DE ENTRADA
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

  // Calibrar Metas
  // Barra: 20% do teste ou mínimo 1 rep
  let barraTarget = Math.max(1, Math.floor(barraMax * 0.20));
  // Flexão: ~18% a 20%
  let flexaoTarget = Math.max(1, Math.floor(flexaoMax * 0.18));
  // Abdominal: 20%
  let abdTarget = Math.max(5, Math.floor(abdMax * 0.20));

  AppState.targets.A.barraReps = barraTarget;
  AppState.targets.A.barraMod = barraMod;
  AppState.targets.A.abdReps = abdTarget;
  AppState.targets.C.flexaoReps = flexaoTarget;

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
  renderSimuladosTable();
  renderFichaCard(AppState.currentFicha);
  updateHeaderStats();

  alert(`Teste Calibrado com Sucesso!\n\nMetas calculadas para o Protocolo Soviético:\n• Barra Fixa: ${barraTarget} rep/min (${getAssistanceLabel(barraMod)})\n• Flexão: ${flexaoTarget} reps/min\n• Abdominal: ${abdTarget} reps/min`);
}

function renderSimuladosTable() {
  const tbody = document.getElementById('simulados-table-body');
  if (!tbody) return;

  if (AppState.simulados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">Nenhum teste registrado ainda. Registre seu teste acima!</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.simulados.map(s => `
    <tr class="hover:bg-slate-900/60 transition">
      <td class="py-2.5 px-3 text-white">${s.date}</td>
      <td class="py-2.5 px-3 text-rose-400 font-bold">${s.barraMax} reps <span class="text-[10px] text-slate-400">(${getAssistanceLabel(s.barraMod)})</span></td>
      <td class="py-2.5 px-3 text-emerald-400">${s.barraTarget} rep/min</td>
      <td class="py-2.5 px-3 text-amber-400 font-bold">${s.flexaoMax} reps</td>
      <td class="py-2.5 px-3 text-emerald-400">${s.flexaoTarget} reps/min</td>
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
    saveToLocalStorage();
    renderSimuladosTable();
  }
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
  const fc = document.getElementById('ass-fc').value;
  const notes = document.getElementById('ass-notes').value;

  const record = {
    id: Date.now(),
    date,
    time: "Assessoria",
    ficha: 'ASS',
    assType: type,
    distanceKm: dist,
    duration: time,
    pace,
    avgBpm: fc,
    suggestion: `Treino da Assessoria (${type}): ${pace} | ${notes || 'Sem observações'}`
  };

  AppState.history.unshift(record);
  saveToLocalStorage();
  renderHistoryTable();
  alert("Treino da assessoria registrado com sucesso!");
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
  if (filter !== 'ALL') {
    items = items.filter(h => h.ficha === filter);
  }

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">Nenhum treino registrado ainda com esse filtro.</td></tr>`;
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
      falha = `Volume de Tiros`;
    } else if (h.ficha === 'C') {
      details = `<strong class="text-amber-400">${h.totalFlexao || 0}</strong> flexões`;
      falha = `Flexão: ${h.flexaoFalha || '-'}`;
    } else if (h.ficha === 'ASS') {
      details = `Assessoria: ${h.assType || 'Corrida'} (${h.duration || '-'}, Pace: ${h.pace || '-'})`;
      falha = h.avgBpm ? `${h.avgBpm} bpm` : '-';
    }

    return `
      <tr class="hover:bg-slate-900/60 transition">
        <td class="py-2.5 px-3 text-slate-300">${h.date} <span class="text-[10px] text-slate-500 block">${h.time}</span></td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getFichaBadgeClass(h.ficha)}">
            ${h.ficha === 'ASS' ? 'ASSESSORIA' : `FICHA ${h.ficha}`}
          </span>
        </td>
        <td class="py-2.5 px-3 text-slate-200 text-xs">${details}</td>
        <td class="py-2.5 px-3 text-rose-300 font-semibold text-xs">${falha}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">${h.distanceKm > 0 ? `${h.distanceKm.toFixed(2)} km` : '-'}</td>
        <td class="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate" title="${h.suggestion || ''}">${h.suggestion || '-'}</td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="deleteHistoryItem(${h.id})" class="text-slate-500 hover:text-rose-400 text-xs transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
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
  let totalBarras = 0;
  let totalFlexoes = 0;
  let totalAbd = 0;
  let totalKm = 0;

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
  if (confirm("Deseja apagar este treino do diário?")) {
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
    csvContent += `"${h.date}";"${h.time}";"${h.ficha}";"${h.totalBarra || 0}";"${h.totalFlexao || 0}";"${h.totalAbd || 0}";"${(h.distanceKm || 0).toFixed(2)}";"${h.barraFalha || h.flexaoFalha || h.avgBpm || ''}";"${(h.suggestion || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TAF_Protocolo_Sovietico_Diario_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ============================================================
// BACKUP & RESTAURAÇÃO DE DADOS
// ============================================================

function downloadBackupJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    profile: AppState.profile,
    targets: AppState.targets,
    history: AppState.history,
    simulados: AppState.simulados
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_taf_sovietico_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function restoreBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.profile) AppState.profile = parsed.profile;
      if (parsed.targets) AppState.targets = parsed.targets;
      if (parsed.history) AppState.history = parsed.history;
      if (parsed.simulados) AppState.simulados = parsed.simulados;

      saveToLocalStorage();
      calculateHeartZones();
      updateHeaderStats();
      renderFichaCard('A');
      renderHistoryTable();
      renderSimuladosTable();
      alert("Backup restaurado com sucesso!");
    } catch (err) {
      alert("Arquivo de backup inválido.");
    }
  };
  reader.readAsText(file);
}

function loadSampleData(confirmPrompt = true) {
  if (confirmPrompt && !confirm("Deseja carregar os dados de exemplo do curso Gabriel Halabi?")) return;

  AppState.profile = {
    age: 35,
    hrRest: 45,
    barraMod: 'roxa',
    barraModLabel: 'Superband Roxa (Média)'
  };

  AppState.targets = {
    A: { barraReps: 1, barraMod: 'roxa', abdReps: 10, runMin: 20 },
    B: { type: 'B1', duration: 52 },
    C: { flexaoReps: 3, runMin: 40 },
    NC: { mode: '20', troteSec: 15, walkSec: 45 }
  };

  AppState.simulados = [
    {
      id: 1,
      date: '2026-10-30',
      barraMax: 1,
      barraMod: 'roxa',
      barraTarget: 1,
      flexaoMax: 17,
      flexaoTarget: 3,
      abdMax: 32,
      abdTarget: 6,
      corrida: '2400m em 09:55'
    }
  ];

  AppState.history = [
    {
      id: 101,
      date: '2025-10-20',
      time: '08:00',
      ficha: 'A',
      totalBarra: 20,
      totalAbd: 200,
      barraFalha: 3,
      abdFalha: 14,
      barraMod: 'roxa',
      distanceKm: 2.8,
      suggestion: 'Consolidando base com Superband Roxa.'
    },
    {
      id: 102,
      date: '2025-10-23',
      time: '08:00',
      ficha: 'B',
      bType: 'B1',
      distanceKm: 5.8,
      suggestion: 'Tiros 20x 30"/90" concluídos.'
    },
    {
      id: 103,
      date: '2025-11-04',
      time: '07:45',
      ficha: 'C',
      totalFlexao: 60,
      flexaoFalha: 7,
      distanceKm: 5.1,
      suggestion: 'Volume de 60 flexões completado sem dor.'
    }
  ];

  saveToLocalStorage();
  calculateHeartZones();
  updateHeaderStats();
  renderFichaCard('A');
  renderHistoryTable();
  renderSimuladosTable();
}

function clearAllData() {
  if (confirm("ATENÇÃO: Tem certeza que deseja apagar todos os treinos e dados? Esta ação não pode ser desfeita.")) {
    localStorage.removeItem('TAF_SOVIETICO_DATA');
    location.reload();
  }
}

// Atalhos de teclado (Espaço para marcar série)
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && AppState.timer.isRunning) {
      // Prevenir rolagem da página com espaço
      const activeTag = document.activeElement.tagName.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        markSeriesCompleted();
      }
    }
  });
}
