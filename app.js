/**
 * TAF PROTOCOLO SOVIÉTICO - SISTEMA INTELIGENTE 3.0
 * Design Limpo e Profissional (Sem estética de IA)
 * Suporte a Carga Externa (Colete/Cinto de Peso), Autorregulação, Wake Lock e Gráficos
 */

// Estado Global da Aplicação
const AppState = {
  isCalibrated: false,
  profile: {
    age: 30,
    hrRest: 55,
    weightKg: 78,
    barraMod: 'roxa',
    barraModLabel: 'Superband Roxa'
  },
  schedule: {
    1: { ficha: 'A', name: 'Segunda-feira', title: 'Ficha A', badge: 'Ficha A', badgeSub: 'Barra/Abd', label: 'Ficha A: Barra + Abdominal (Pegada e Força)', type: 'workout', hasLegs: false, detail: 'EMOM 40 min alternado (Barra + Abdominal Remador) + Dead Hang 2x 30s.' },
    2: { ficha: 'ASS', name: 'Terça-feira', title: 'Regen. + Pernas', badge: 'Regen.', badgeSub: '+ Pernas', label: 'Corrida Regenerativa + Fortalecimento de Pernas (25-30 min)', type: 'assessoria', hasLegs: true, detail: 'Corrida leve em Z2 (Garmin/TrainingPeaks) + Fortalecimento de membros inferiores (25-30 min).' },
    3: { ficha: 'C', name: 'Quarta-feira', title: 'Ficha C', badge: 'Ficha C', badgeSub: 'Flexão', label: 'Ficha C: Flexão de Braço (20 min EMOM)', type: 'workout', hasLegs: false, detail: 'EMOM 20 min de Flexão de Braço submáxima (peitoral e tríceps).' },
    4: { ficha: 'ASS', name: 'Quinta-feira', title: 'Intervalado', badge: 'Tiros', badgeSub: 'Assessoria', label: 'Corrida Intervalada (Tiros da Assessoria)', type: 'assessoria', hasLegs: false, detail: 'Treino de velocidade / tiros para VO2 Máx prescrito pela assessoria no Garmin.' },
    5: { ficha: 'A', name: 'Sexta-feira', title: 'Ficha A + Pernas', badge: 'Ficha A', badgeSub: '+ Pernas', label: 'Ficha A + Fortalecimento de Pernas (25-30 min)', type: 'workout', hasLegs: true, detail: 'Ficha A (EMOM 40 min Barra + Abd) + Fortalecimento de pernas para fechar o ciclo semanal de força.' },
    6: { ficha: 'ASS', name: 'Sábado', title: 'Rodagem', badge: 'Rodagem', badgeSub: 'Assessoria', label: 'Corrida de Rodagem (Ritmo Confortável)', type: 'assessoria', hasLegs: false, detail: 'Volume aeróbico contínuo em Z2/Z3 prescrito pela Assessoria.' },
    0: { ficha: 'ASS', name: 'Domingo', title: 'Longão', badge: 'Longão', badgeSub: 'Assessoria', label: 'Corrida Longão (Endurance / Base Aeróbica)', type: 'assessoria', hasLegs: false, detail: 'Treino longo com a Assessoria para construir resistência e fôlego para o TAF.' }
  },
  currentFicha: 'A',
  targets: {
    A: {
      barraReps: 1,
      barraMod: 'roxa',
      barraExtraKg: 0,
      abdReps: 8,
      abdExtraKg: 0,
      runMin: 20
    },
    B: {
      type: 'B1',
      duration: 52
    },
    C: {
      flexaoReps: 3,
      flexaoExtraKg: 0,
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

// Wake Lock API (Impede bloqueio de tela durante o treino)
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      const pill = document.getElementById('wake-lock-pill');
      if (pill) pill.classList.remove('hidden');
    }
  } catch (err) {
    console.log('Wake Lock indisponível:', err);
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
// PLANNER SEMANAL AUTOMÁTICO ("TREINO DE HOJE")
// ============================================================

function renderWeeklyPlanner() {
  const container = document.getElementById('weekly-planner-container');
  if (!container) return;

  const now = new Date();
  const todayDay = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  const todayStr = now.toISOString().split('T')[0];

  // Checar se já fez treino hoje
  const workoutToday = AppState.history.find(h => h.date === todayStr);

  const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Começa na Segunda e termina no Domingo
  const dayNamesShort = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 0: 'Dom' };

  const currentPlan = AppState.schedule[todayDay] || { ficha: 'A', name: 'Hoje', label: 'Treino', type: 'workout' };

  container.innerHTML = `
    <!-- Topo: Título e Status de Hoje -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e2638] pb-2.5">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center text-xs font-bold font-mono">
          <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
        </div>
        <div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <h3 class="text-xs font-bold text-white uppercase tracking-wider">Cronograma Semanal</h3>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-[#151a26] text-amber-300 font-mono font-bold">Hoje: ${currentPlan.name}</span>
            ${currentPlan.hasLegs ? `
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold flex items-center gap-1">
                <i data-lucide="shield" class="w-2.5 h-2.5 text-amber-400"></i> + Pernas (25-30m)
              </span>
            ` : ''}
          </div>
          <p class="text-[11px] text-slate-400 -mt-0.5">${currentPlan.label}</p>
        </div>
      </div>

      <!-- Status de Conclusão de Hoje / Ações -->
      <div class="flex items-center gap-2">
        ${currentPlan.hasLegs ? `
          <button onclick="openLegsModal()" class="btn-athletic px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1 shadow-sm" title="Ver rotina de pernas">
            <i data-lucide="shield" class="w-3 h-3 text-amber-400"></i> Treino Pernas
          </button>
        ` : ''}

        ${workoutToday ? `
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1 rounded-md font-mono">
            <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i> Concluído!
          </span>
        ` : currentPlan.type === 'rest' ? `
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-[#151a26] border border-[#1e2638] px-2.5 py-1 rounded-md font-mono">
            <i data-lucide="coffee" class="w-3.5 h-3.5 text-slate-400"></i> Recuperação
          </span>
        ` : `
          <button onclick="startTodayPlan()" class="btn-athletic px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
            <i data-lucide="play" class="w-3 h-3"></i> Fazer Treino de Hoje
          </button>
        `}
      </div>
    </div>

    <!-- Barra dos 7 Dias da Semana -->
    <div class="grid grid-cols-7 gap-1.5 pt-1 text-center font-mono">
      ${daysOrder.map(d => {
        const item = AppState.schedule[d];
        const isToday = d === todayDay;
        const shortName = dayNamesShort[d];

        const badgeTitle = item.badge || item.ficha;
        const badgeSub = item.badgeSub || '';

        let cardClass = "border-[#1e2638] bg-[#151a26]/40 text-slate-400 hover:border-slate-500";
        if (isToday) {
          cardClass = "border-rose-500 bg-rose-950/40 text-rose-300 ring-1 ring-rose-500/60 shadow-sm";
        }

        return `
          <button onclick="selectDaySchedule(${d})" class="p-1.5 rounded-lg border ${cardClass} text-left transition flex flex-col justify-between overflow-hidden">
            <div class="flex justify-between items-center text-[9px] font-bold uppercase w-full">
              <span class="${isToday ? 'text-rose-400 font-bold' : 'text-slate-400'}">${shortName}</span>
              ${isToday ? `<span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>` : ''}
            </div>
            <div class="mt-1">
              <div class="text-[10px] font-bold text-white truncate leading-tight">${badgeTitle}</div>
              ${badgeSub ? `<div class="text-[8px] ${item.hasLegs ? 'text-amber-400 font-bold' : 'text-slate-400'} truncate leading-tight mt-0.5">${badgeSub}</div>` : ''}
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function startTodayPlan() {
  const now = new Date();
  const todayDay = now.getDay();
  const currentPlan = AppState.schedule[todayDay];

  if (!currentPlan) return;

  if (currentPlan.ficha === 'A' || currentPlan.ficha === 'B' || currentPlan.ficha === 'C') {
    switchTab('treino');
    selectFicha(currentPlan.ficha);
    document.getElementById('ficha-card-container')?.scrollIntoView({ behavior: 'smooth' });
  } else if (currentPlan.ficha === 'ASS') {
    switchTab('garmin');
    document.getElementById('assessoria-form')?.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert("Hoje é dia de descanso programado! A recuperação faz parte essencial do método para os tendões absorverem o volume.");
  }
}

function selectDaySchedule(dayNumber) {
  const plan = AppState.schedule[dayNumber];
  if (!plan) return;

  if (plan.ficha === 'A' || plan.ficha === 'B' || plan.ficha === 'C') {
    switchTab('treino');
    selectFicha(plan.ficha);
    document.getElementById('ficha-card-container')?.scrollIntoView({ behavior: 'smooth' });
  } else if (plan.ficha === 'ASS') {
    if (plan.hasLegs) {
      if (confirm(`${plan.name}: ${plan.label}\n\n• Treino de corrida leve prescrito no Garmin/TrainingPeaks.\n• Bloco de fortalecimento de pernas (25-30 min).\n\nDeseja abrir a rotina de fortalecimento de pernas agora?`)) {
        openLegsModal();
        return;
      }
    }
    switchTab('garmin');
    document.getElementById('assessoria-form')?.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert(`${plan.name}: ${plan.label}.\n\n${plan.detail}`);
  }
}

function openLegsModal() {
  const modal = document.getElementById('modal-legs');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeLegsModal() {
  const modal = document.getElementById('modal-legs');
  if (modal) modal.classList.add('hidden');
}

// Dead Hang Timer (Resistência de Pegada para o TAF)
let deadHangInterval = null;
let deadHangSeconds = 0;

function startDeadHang(seconds) {
  getAudioContext();
  cancelDeadHang();
  
  deadHangSeconds = seconds;
  const box = document.getElementById('dead-hang-active-box');
  const clock = document.getElementById('dead-hang-clock');
  
  if (box) box.classList.remove('hidden');
  if (clock) clock.innerText = `${deadHangSeconds}s`;

  playBeep(1200, 0.3); // início
  speakVoice("Começou o Dead Hang. Segure firme na barra!");

  deadHangInterval = setInterval(() => {
    deadHangSeconds--;
    if (clock) clock.innerText = `${deadHangSeconds}s`;

    if (deadHangSeconds === 3 || deadHangSeconds === 2 || deadHangSeconds === 1) {
      playBeep(800, 0.1);
    }

    if (deadHangSeconds <= 0) {
      clearInterval(deadHangInterval);
      playBeep(1400, 0.5);
      speakVoice("Excelente! Pegada fortalecida com sucesso!");
      if (clock) clock.innerText = "Concluído!";
      setTimeout(() => {
        if (box) box.classList.add('hidden');
      }, 3000);
    }
  }, 1000);
}

function cancelDeadHang() {
  if (deadHangInterval) {
    clearInterval(deadHangInterval);
    deadHangInterval = null;
  }
  const box = document.getElementById('dead-hang-active-box');
  if (box) box.classList.add('hidden');
}

// Contador de Ciclo de Simulado Real (A cada 8 treinos de Ficha A)
function updateCycleBadge() {
  const badge = document.getElementById('cycle-count-text');
  if (!badge) return;

  const countA = AppState.history.filter(h => h.ficha === 'A').length;
  const currentInCycle = (countA % 8) + 1;

  if (currentInCycle === 8) {
    badge.innerText = "Simulado Hoje!";
    badge.className = "text-rose-400 font-bold animate-pulse";
  } else {
    badge.innerText = `${currentInCycle} / 8`;
    badge.className = "text-amber-400 font-bold";
  }
}

function forceReloadApp() {
  const btn = document.getElementById('btn-force-reload');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
  }
  setTimeout(() => {
    window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
  }, 200);
}

// ============================================================
// INICIALIZAÇÃO & PERSISTÊNCIA
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  checkUrlSyncHash();
  loadFromLocalStorage();
  checkCalibrationStatus();
  updateCycleBadge();
  calculateHeartZones();
  renderWeeklyPlanner();
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
    if (onboardingBanner) onboardingBanner.classList.remove('hidden');
    if (levelDesc) levelDesc.innerText = "Não Calibrado";
  } else {
    if (onboardingBanner) onboardingBanner.classList.add('hidden');
    const latest = AppState.simulados[0];
    if (levelDesc && latest) {
      levelDesc.innerText = `Barra: ${latest.barraTarget} rep (${getAssistanceLabel(latest.barraMod, AppState.targets.A.barraExtraKg)}) | Flexão: ${latest.flexaoTarget}`;
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
  updateCycleBadge();
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
      console.error("Erro ao ler dados:", e);
    }
  }

  const ageInput = document.getElementById('fc-idade');
  const restInput = document.getElementById('fc-repouso');
  const weightInput = document.getElementById('sim-weight');
  if (ageInput) ageInput.value = AppState.profile.age;
  if (restInput) restInput.value = AppState.profile.hrRest;
  if (weightInput) weightInput.value = AppState.profile.weightKg || 78;
}

// ============================================================
// NAVEGAÇÃO DE ABAS
// ============================================================

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab-clean').forEach(el => {
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
// CALIBRAÇÃO DO PROTOCOLO (TESTE INICIAL / SIMULADO)
// ============================================================

function saveSimulado(e) {
  e.preventDefault();
  const date = document.getElementById('sim-date').value || new Date().toISOString().split('T')[0];
  const weightKg = parseFloat(document.getElementById('sim-weight')?.value) || AppState.profile.weightKg || 78;
  const barraMax = parseInt(document.getElementById('sim-barra').value) || 0;
  const barraMod = document.getElementById('sim-barra-mod').value;
  const flexaoMax = parseInt(document.getElementById('sim-flexao').value) || 0;
  const abdMax = parseInt(document.getElementById('sim-abd').value) || 0;
  const distCorrida = document.getElementById('sim-dist').value || "2400";
  const tempoCorrida = document.getElementById('sim-tempo').value || "12:00";

  let barraTarget = Math.max(1, Math.floor(barraMax * 0.20));
  let flexaoTarget = Math.max(1, Math.floor(flexaoMax * 0.18));
  let abdTarget = Math.max(5, Math.floor(abdMax * 0.20));

  AppState.isCalibrated = true;
  AppState.profile.weightKg = weightKg;
  AppState.targets.A.barraReps = barraTarget;
  AppState.targets.A.barraMod = barraMod;
  AppState.targets.A.abdReps = abdTarget;
  AppState.targets.C.flexaoReps = flexaoTarget;
  AppState.profile.barraMod = barraMod;

  const simRecord = {
    id: Date.now(),
    date,
    weightKg,
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
  updateDesmameWidget();
  calculateEditalScore();

  alert(`Protocolo Calibrado com Sucesso.\n\nMetas por minuto (20 séries):\n• Barra Fixa: ${barraTarget} rep (${getAssistanceLabel(barraMod, AppState.targets.A.barraExtraKg)})\n• Flexão: ${flexaoTarget} reps\n• Abdominal: ${abdTarget} reps`);
  switchTab('treino');
}

function renderSimuladosTable() {
  const tbody = document.getElementById('simulados-table-body');
  if (!tbody) return;

  if (AppState.simulados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-slate-500 font-sans">Nenhum teste registrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.simulados.map(s => `
    <tr class="hover:bg-[#151a26]/60 transition">
      <td class="py-2 px-2.5 text-white">${s.date} <span class="text-[9px] text-slate-500 block">${s.weightKg ? `${s.weightKg} kg` : ''}</span></td>
      <td class="py-2 px-2.5 text-slate-200">${s.barraMax} reps <span class="text-[10px] text-slate-400">(${getAssistanceLabel(s.barraMod, 0)})</span></td>
      <td class="py-2 px-2.5 text-rose-400 font-bold">${s.barraTarget} rep</td>
      <td class="py-2 px-2.5 text-slate-200">${s.flexaoMax} reps</td>
      <td class="py-2 px-2.5 text-rose-400 font-bold">${s.flexaoTarget} reps</td>
      <td class="py-2 px-2.5 text-slate-200">${s.abdMax} reps</td>
      <td class="py-2 px-2.5 text-slate-400">${s.corrida}</td>
      <td class="py-2 px-2.5 text-right">
        <button onclick="deleteSimulado(${s.id})" class="text-slate-500 hover:text-rose-400 text-xs font-sans">Excluir</button>
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
// SIMULADOR DE PONTUAÇÃO DO EDITAL
// ============================================================

function calculateEditalScore() {
  const select = document.getElementById('edital-selector');
  const editalType = select ? select.value : 'PF_AGENTE';

  const latest = AppState.simulados[0] || {
    barraMax: 1,
    barraMod: 'roxa',
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
    const b = latest.barraMod === 'livre' ? latest.barraMax : 0;
    if (b < 2) barraPts = 0;
    else if (b === 2) barraPts = 2.0;
    else if (b === 3) barraPts = 2.5;
    else if (b === 4) barraPts = 3.0;
    else if (b === 5) barraPts = 3.5;
    else if (b === 6) barraPts = 4.0;
    else if (b === 7) barraPts = 4.5;
    else barraPts = 5.0;

    const a = latest.abdMax;
    if (a < 36) abdPts = 0;
    else if (a <= 37) abdPts = 2.0;
    else if (a <= 39) abdPts = 2.5;
    else if (a <= 41) abdPts = 3.0;
    else if (a <= 43) abdPts = 3.5;
    else if (a <= 45) abdPts = 4.0;
    else if (a <= 47) abdPts = 4.5;
    else abdPts = 5.0;

    corridaPts = 3.0;
    const totalPts = barraPts + abdPts + corridaPts;
    isAprovado = barraPts >= 2.0 && abdPts >= 2.0 && (totalPts >= 8.0);

    tableRows = [
      { nome: "Barra Fixa (Pronada)", atual: `${latest.barraMax} reps (${getAssistanceLabel(latest.barraMod, 0)})`, min: "2 repetições livres", nota: `${barraPts.toFixed(1)} / 5.0`, max: "8 reps (5.0)" },
      { nome: "Abdominal Remador", atual: `${latest.abdMax} reps`, min: "36 repetições", nota: `${abdPts.toFixed(1)} / 5.0`, max: "48 reps (5.0)" },
      { nome: "Corrida 12 Minutos", atual: latest.corrida, min: "2.000 metros", nota: `${corridaPts.toFixed(1)} / 5.0`, max: "2.600m (5.0)" }
    ];
  } else {
    const b = latest.barraMod === 'livre' ? latest.barraMax : 0;
    barraPts = b >= 3 ? 3.0 : 0;
    flexaoPts = latest.flexaoMax >= 25 ? 3.0 : 1.5;
    abdPts = latest.abdMax >= 35 ? 3.0 : 1.5;
    isAprovado = barraPts >= 3.0 && flexaoPts >= 2.5;

    tableRows = [
      { nome: "Barra Fixa", atual: `${latest.barraMax} reps (${getAssistanceLabel(latest.barraMod, 0)})`, min: "3 repetições livres", nota: `${barraPts.toFixed(1)} pts`, max: "10 reps" },
      { nome: "Flexão de Braços", atual: `${latest.flexaoMax} reps`, min: "25 repetições", nota: `${flexaoPts.toFixed(1)} pts`, max: "40 reps" },
      { nome: "Abdominal", atual: `${latest.abdMax} reps`, min: "35 repetições", nota: `${abdPts.toFixed(1)} pts`, max: "45 reps" }
    ];
  }

  const statusCard = document.getElementById('edital-status-card');
  const statusText = document.getElementById('edital-status-text');
  const statusDesc = document.getElementById('edital-status-desc');
  const pointsText = document.getElementById('edital-points-text');
  const critText = document.getElementById('edital-critical-text');
  const tableBody = document.getElementById('edital-table-body');

  if (statusText) {
    if (isAprovado) {
      statusText.innerText = "APROVADO";
      statusText.className = "text-lg font-bold text-emerald-400 font-mono my-0.5";
      statusCard.className = "p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-950/10";
      statusDesc.innerText = "Índices mínimos atingidos.";
    } else {
      statusText.innerText = "REPROVADO";
      statusText.className = "text-lg font-bold text-rose-500 font-mono my-0.5";
      statusCard.className = "p-3.5 rounded-lg border border-rose-500/30 bg-rose-950/10";
      statusDesc.innerText = "Abaixo do índice mínimo em barra fixa livre.";
    }
  }

  if (pointsText) pointsText.innerText = `${(barraPts + abdPts + corridaPts + flexaoPts).toFixed(1)} pts`;
  if (critText) critText.innerText = latest.barraMod !== 'livre' ? "Barra Fixa (Elástico)" : "Consistência";

  if (tableBody) {
    tableBody.innerHTML = tableRows.map(r => `
      <tr class="hover:bg-[#151a26]/40 transition">
        <td class="py-2 px-2.5 text-white font-medium font-sans">${r.nome}</td>
        <td class="py-2 px-2.5 text-slate-300">${r.atual}</td>
        <td class="py-2 px-2.5 text-slate-400">${r.min}</td>
        <td class="py-2 px-2.5 font-bold ${r.nota.startsWith('0') ? 'text-rose-500' : 'text-emerald-400'}">${r.nota}</td>
        <td class="py-2 px-2.5 text-slate-400">${r.max}</td>
      </tr>
    `).join('');
  }
}

// ============================================================
// RENDERIZAÇÃO DAS FICHAS DE TREINO (A, B, C, NC)
// ============================================================

function selectFicha(fichaKey) {
  AppState.currentFicha = fichaKey;
  
  document.querySelectorAll('.ficha-selector').forEach(btn => {
    btn.classList.remove('border-rose-500', 'bg-rose-950/20');
    btn.classList.add('border-[#1e2638]', 'bg-[#10141e]');
  });
  const activeBtn = document.getElementById(`btn-ficha-${fichaKey}`);
  if (activeBtn) {
    activeBtn.classList.add('border-rose-500', 'bg-rose-950/20');
    activeBtn.classList.remove('border-[#1e2638]', 'bg-[#10141e]');
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
      <div class="flex flex-wrap items-center justify-between border-b border-[#1e2638] pb-2.5 gap-2">
        <div>
          <span class="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider block">Ficha A • Duração Total: ~65 Minutos</span>
          <h2 class="text-sm md:text-base font-bold text-white">Barra Fixa + Abdominal + Pegada + Corrida</h2>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="openManualModal('A')" class="btn-athletic px-2.5 py-1.5 rounded bg-[#151a26] hover:bg-[#1e2638] text-xs text-slate-300 border border-[#1e2638]">
            Preencher Manual
          </button>
          <button onclick="launchWorkoutTimer('A')" class="btn-athletic px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm">
            <i data-lucide="play" class="w-3.5 h-3.5"></i> Iniciar no Timer
          </button>
        </div>
      </div>

      <!-- EXPLICAÇÃO DIDÁTICA DO TEMPO (CLAREZA TOTAL) -->
      <div class="p-3 rounded-lg bg-[#151a26] border border-rose-500/30 text-xs space-y-1">
        <div class="flex items-center gap-1.5 text-rose-300 font-bold text-[11px] uppercase tracking-wide">
          <i data-lucide="info" class="w-3.5 h-3.5 text-rose-400"></i> Como Funciona o Tempo Desta Sessão:
        </div>
        <p class="text-slate-300 text-[11px] leading-relaxed">
          O bloco EMOM tem <strong class="text-white">40 minutos totais de relógio</strong> (NÃO são 40 minutos de cada!). Você reveza os exercícios a cada virada de minuto:
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 font-mono text-[11px]">
          <div class="bg-[#10141e] p-2 rounded border border-[#1e2638]">
            <span class="text-rose-400 font-bold block">Minutos Ímpares (1, 3, 5, 7... 37):</span>
            <span class="text-white">1 Barra Fixa</span> (${getAssistanceLabel(t.barraMod, t.barraExtraKg)}). Faz a barra em 3 segundos e descansa o resto do minuto. (20 séries no total).
          </div>
          <div class="bg-[#10141e] p-2 rounded border border-[#1e2638]">
            <span class="text-sky-400 font-bold block">Minutos Pares (2, 4, 6, 8... 38):</span>
            <span class="text-white">${t.abdReps} Abdominais</span>. Faz em 10 segundos e descansa o resto do minuto. (20 séries no total).
          </div>
        </div>
      </div>

      <!-- OS 4 BLOCOS PASSO A PASSO -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
        <!-- BLOCO 1: FORÇA PURA -->
        <div class="card-subtle p-2.5 border-amber-500/30 bg-amber-950/10">
          <div class="flex justify-between items-center">
            <span class="text-[9px] text-amber-400 uppercase font-bold">Passo 1 (3 min)</span>
            <span class="text-[9px] text-slate-500">Antes do EMOM</span>
          </div>
          <div class="text-white font-bold text-[11px] mt-0.5">3x Excêntricas 5s</div>
          <span class="text-[10px] text-slate-400 font-sans block mt-0.5">Pule até o queixo passar da barra e desça freando em 5s sem elástico. Constrói arrancada.</span>
        </div>

        <!-- BLOCO 2: DENSIDADE SUBMÁXIMA -->
        <div class="card-subtle p-2.5 border-rose-900/60 bg-rose-950/10">
          <div class="flex justify-between items-center">
            <span class="text-[9px] text-rose-400 uppercase font-bold">Passo 2 (40 min)</span>
            <span class="text-[9px] text-rose-300 font-bold">Principal</span>
          </div>
          <div class="text-white font-bold text-[11px] mt-0.5">EMOM Alternado</div>
          <span class="text-[10px] text-slate-400 font-sans block mt-0.5">1 Barra / ${t.abdReps} Abd revezando a cada minuto. Minutos 39 e 40 são até a falha!</span>
        </div>

        <!-- BLOCO 3: DEAD HANG -->
        <div class="card-subtle p-2.5 border-blue-500/30 bg-blue-950/10">
          <div class="flex justify-between items-center">
            <span class="text-[9px] text-blue-400 uppercase font-bold">Passo 3 (2 min)</span>
            <span class="text-[9px] text-slate-500">Pós-EMOM</span>
          </div>
          <div class="text-white font-bold text-[11px] mt-0.5">2x 30s Dead Hang</div>
          <span class="text-[10px] text-slate-400 font-sans block mt-0.5">Fique pendurado estático na barra para calejar as mãos e antebraços.</span>
        </div>

        <!-- BLOCO 4: CORRIDA OU FORTALECIMENTO -->
        <div class="card-subtle p-2.5 border-emerald-500/30 bg-emerald-950/10">
          <div class="flex justify-between items-center">
            <span class="text-[9px] text-emerald-400 uppercase font-bold">Passo 4</span>
            <span class="text-[9px] text-slate-500">${new Date().getDay() === 5 ? 'Sexta: Pernas' : 'Final'}</span>
          </div>
          <div class="text-white font-bold text-[11px] mt-0.5">${new Date().getDay() === 5 ? 'Fortalecimento Pernas' : 'Corrida Contínua'}</div>
          <span class="text-[10px] text-slate-400 font-sans block mt-0.5">${new Date().getDay() === 5 ? '25-30 min de pernas (búlgaro, panturrilha e tibial).' : '5\' Z2 + 10\' Z3 + 5\' Z2 (ou poupe para a corrida da Assessoria).'}</span>
        </div>
      </div>

      <!-- BANNER DE FORTALECIMENTO DE PERNAS (SEXTA-FEIRA) -->
      <div class="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <i data-lucide="shield" class="w-4 h-4 text-amber-400 flex-shrink-0"></i>
          <div>
            <span class="text-[11px] font-bold text-amber-300 block">Sexta-feira: Ficha A + Fortalecimento de Pernas (25-30 min)</span>
            <span class="text-[10px] text-slate-400 block">Blindagem de canelas e joelhos sem sobrecarregar a barra fixa.</span>
          </div>
        </div>
        <button onclick="openLegsModal()" class="btn-athletic px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold whitespace-nowrap">
          Ver Exercícios &rarr;
        </button>
      </div>

      <!-- Configuração de Carga e Assistência -->
      <div class="p-2.5 rounded-lg bg-[#151a26]/60 border border-[#1e2638] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 text-[11px]">Tipo de Barra:</span>
            <select id="select-ficha-a-mod" onchange="updateFichaAMod(this.value)" class="bg-[#10141e] border border-[#1e2638] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none">
              <option value="roxa" ${t.barraMod === 'roxa' ? 'selected' : ''}>Superband Roxa</option>
              <option value="verde" ${t.barraMod === 'verde' ? 'selected' : ''}>Superband Verde</option>
              <option value="vermelha" ${t.barraMod === 'vermelha' ? 'selected' : ''}>Superband Vermelha</option>
              <option value="livre" ${t.barraMod === 'livre' ? 'selected' : ''}>Barra Livre (Peso Corporal)</option>
              <option value="excentrica" ${t.barraMod === 'excentrica' ? 'selected' : ''}>Excêntrica (4s)</option>
              <option value="colete" ${t.barraMod === 'colete' ? 'selected' : ''}>Sobrecarga / Colete</option>
            </select>
          </div>

          <!-- Campo de Carga Extra (Item 6) -->
          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 text-[11px]">Carga Extra:</span>
            <div class="flex items-center bg-[#10141e] border border-[#1e2638] rounded px-2 py-0.5">
              <input type="number" min="0" step="1" id="input-barra-extra" value="${t.barraExtraKg || 0}" onchange="updateBarraExtraKg(this.value)" class="w-12 bg-transparent text-white font-mono text-xs focus:outline-none">
              <span class="text-[10px] text-slate-400">kg</span>
            </div>
          </div>
        </div>

        <span class="text-slate-400 font-mono text-[11px]">
          Volume previsto: <strong class="text-white">${t.barraReps * 19}+ falha</strong> barras
        </span>
      </div>
    `;
  } else if (fichaKey === 'B') {
    const t = AppState.targets.B;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-[#1e2638] pb-2.5 gap-2">
        <div>
          <span class="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">Ficha B • Duração Total: 52 Minutos</span>
          <h2 class="text-sm md:text-base font-bold text-white">Corrida Intervalada (Tiros para VO2 Máx)</h2>
        </div>
        <button onclick="openManualModal('B')" class="btn-athletic px-2.5 py-1.5 rounded bg-[#151a26] hover:bg-[#1e2638] text-xs text-slate-300 border border-[#1e2638]">
          Registrar Tiro
        </button>
      </div>

      <div class="flex items-center gap-2 mb-1">
        <span class="text-slate-400 text-xs">Tipo de Treino:</span>
        <div class="inline-flex rounded bg-[#151a26] p-0.5 border border-[#1e2638] text-xs font-mono">
          <button onclick="setBType('B1')" class="px-2.5 py-1 rounded font-bold ${t.type === 'B1' ? 'bg-rose-600 text-white' : 'text-slate-400'}">
            B.1 Curto (30" / 90")
          </button>
          <button onclick="setBType('B2')" class="px-2.5 py-1 rounded font-bold ${t.type === 'B2' ? 'bg-slate-700 text-white' : 'text-slate-400'}">
            B.2 Longo (2' / 3')
          </button>
        </div>
      </div>

      <div class="card-subtle p-3 text-xs space-y-2">
        <div class="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
          Linha do Tempo dos 52 Minutos:
        </div>
        ${t.type === 'B1' ? `
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
            <div class="p-2 rounded bg-[#10141e] border border-[#1e2638]">1. Aquecimento: 5 min Z2 leve</div>
            <div class="p-2 rounded bg-[#10141e] border border-[#1e2638]">2. Transição: 2 min caminhada</div>
            <div class="p-2 rounded bg-[#10141e] border border-rose-500/40 text-rose-300">3. 20 Tiros: 30" tiro / 90" caminhada (40 min)</div>
            <div class="p-2 rounded bg-[#10141e] border border-[#1e2638]">4. Volta à calma: 5 min Z2 leve</div>
          </div>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
            <div class="p-2 rounded bg-[#10141e] border border-[#1e2638]">1. Aquecimento: 5 min Z2 leve</div>
            <div class="p-2 rounded bg-[#10141e] border border-[#1e2638]">2. Transição: 2 min caminhada</div>
            <div class="p-2 rounded bg-[#10141e] border border-sky-500/40 text-sky-300">3. 8 Tiros: 2 min forte / 3 min caminhada (40 min)</div>
            <div class="p-2 rounded bg-[#10141e] border border-[#1e2638]">4. Volta à calma: 5 min Z2 leve</div>
          </div>
        `}
        <span class="text-[10px] text-slate-400 block pt-1 font-sans">
          Nota: Se você treina com assessoria de corrida, pode substituir esta sessão pelo treino de tiros passado pelo seu treinador!
        </span>
      </div>
    `;
  } else if (fichaKey === 'C') {
    const t = AppState.targets.C;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-[#1e2638] pb-2.5 gap-2">
        <div>
          <span class="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider block">Ficha C • Duração Total: 60 Minutos</span>
          <h2 class="text-sm md:text-base font-bold text-white">Flexão de Braço (20 min) + Trote Longo Z2 (40 min)</h2>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="openManualModal('C')" class="btn-athletic px-2.5 py-1.5 rounded bg-[#151a26] hover:bg-[#1e2638] text-xs text-slate-300 border border-[#1e2638]">
            Preencher Manual
          </button>
          <button onclick="launchWorkoutTimer('C')" class="btn-athletic px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-1.5">
            <i data-lucide="play" class="w-3.5 h-3.5"></i> Iniciar no Timer
          </button>
        </div>
      </div>

      <!-- EXPLICAÇÃO DIDÁTICA DO TEMPO FICHA C -->
      <div class="p-3 rounded-lg bg-[#151a26] border border-sky-500/30 text-xs space-y-1">
        <div class="flex items-center gap-1.5 text-sky-300 font-bold text-[11px] uppercase tracking-wide">
          <i data-lucide="info" class="w-3.5 h-3.5 text-sky-400"></i> Como Funciona o Tempo Desta Sessão:
        </div>
        <p class="text-slate-300 text-[11px] leading-relaxed">
          Esta sessão é dividida em dois momentos bem separados:
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 font-mono text-[11px]">
          <div class="bg-[#10141e] p-2 rounded border border-[#1e2638]">
            <span class="text-sky-400 font-bold block">1ª Parte: 20 Minutos EMOM de Flexão</span>
            A cada minuto (do min 1 ao 19), você faz <strong class="text-white">${t.flexaoReps} flexões</strong> em 5 segundos e descansa o restante do minuto. No minuto 20, faz até a falha técnica!
          </div>
          <div class="bg-[#10141e] p-2 rounded border border-[#1e2638]">
            <span class="text-emerald-400 font-bold block">2ª Parte: 40' Trote (Opcional)</span>
            No protocolo padrão há 40' de trote Z2. <em>Como você já corre 4x com assessoria (Terça, Quinta, Sábado e Domingo), faça apenas os 20' EMOM de flexão e preserve as pernas para o intervalado de Quinta!</em>
          </div>
        </div>
      </div>
    `;
  } else if (fichaKey === 'NC') {
    const t = AppState.targets.NC;
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between border-b border-[#1e2638] pb-2.5 gap-2">
        <div>
          <span class="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">Transição Aeróbica</span>
          <h2 class="text-sm md:text-base font-bold text-white">EMOM Corrida / Caminhada</h2>
        </div>
        <button onclick="launchWorkoutTimer('NC')" class="btn-athletic px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5">
          <i data-lucide="play" class="w-3.5 h-3.5"></i> Iniciar Timer
        </button>
      </div>

      <div class="card-subtle p-3 text-xs font-mono text-slate-300">
        Cada minuto: <strong class="text-emerald-400">${t.troteSec}s de trote</strong> + <strong class="text-slate-400">${60 - t.troteSec}s de caminhada</strong>. No último minuto, trote até a falha.
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function updateFichaAMod(newMod) {
  AppState.targets.A.barraMod = newMod;
  AppState.profile.barraMod = newMod;
  AppState.profile.barraModLabel = getAssistanceLabel(newMod, AppState.targets.A.barraExtraKg);
  saveToLocalStorage();
  checkCalibrationStatus();
  updateDesmameWidget();
  renderFichaCard('A');
}

function updateBarraExtraKg(val) {
  const kg = parseFloat(val) || 0;
  AppState.targets.A.barraExtraKg = kg;
  if (kg > 0) AppState.targets.A.barraMod = 'colete';
  saveToLocalStorage();
  checkCalibrationStatus();
  renderFichaCard('A');
}

function setBType(type) {
  AppState.targets.B.type = type;
  saveToLocalStorage();
  renderFichaCard('B');
}

function getAssistanceLabel(mod, extraKg = 0) {
  if (extraKg > 0 || mod === 'colete') return `Colete (+${extraKg}kg)`;
  const map = {
    'livre': 'Barra Livre',
    'verde': 'Superband Verde',
    'roxa': 'Superband Roxa',
    'vermelha': 'Superband Vermelha',
    'excentrica': 'Excêntrica Lenta'
  };
  return map[mod] || 'Superband Roxa';
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
      el.className = "p-2.5 rounded-lg border border-amber-500/50 bg-amber-950/20";
      const badge = el.querySelector('span');
      if (badge) badge.className = "text-[10px] text-amber-400 block uppercase font-mono font-bold";
    } else {
      el.className = "p-2.5 rounded-lg border border-[#1e2638] bg-[#151a26]/50";
      const badge = el.querySelector('span');
      if (badge) badge.className = "text-[10px] text-slate-500 block uppercase font-mono";
    }
  });

  if (pill) pill.innerText = `Fase Atual: ${getAssistanceLabel(currentMod, AppState.targets.A.barraExtraKg)}`;

  const lastA = AppState.history.find(h => h.ficha === 'A');
  if (hint && lastA && lastA.barraFalha !== undefined) {
    if (lastA.barraFalha >= 8 && currentMod !== 'livre') {
      hint.innerHTML = `<strong>Atingiu ${lastA.barraFalha} repetições na última série.</strong> Recomenda-se reduzir a assistência para a próxima fase.`;
    } else if (lastA.barraFalha >= 8 && currentMod === 'livre') {
      hint.innerHTML = `<strong>Domínio consolidado em Barra Livre (${lastA.barraFalha} reps).</strong> Fase avançada: você já pode adicionar +2 kg de sobrecarga com colete/cinto!`;
    } else {
      hint.innerHTML = `Último registro de falha: <strong>${lastA.barraFalha} reps</strong> com ${getAssistanceLabel(currentMod, AppState.targets.A.barraExtraKg)}. Faltam <strong>${Math.max(1, 8 - lastA.barraFalha)} reps</strong> para avançar de fase.`;
    }
  }
}

// ============================================================
// EMOM LIVE TIMER
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
    clearInterval(AppState.timer.intervalId);
    AppState.timer.isRunning = false;
    releaseWakeLock();
    playBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Retomar`;
    doneBtn.disabled = true;
  } else {
    AppState.timer.isRunning = true;
    requestWakeLock();
    playBtn.innerHTML = `<i data-lucide="pause" class="w-4 h-4"></i> Pausar`;
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
    speakVoice("Série até a falha técnica.");
    return;
  }

  if (f === 'A') {
    if (min % 2 !== 0) speakVoice(`Minuto ${min}: Barra Fixa.`);
    else speakVoice(`Minuto ${min}: Abdominal.`);
  } else if (f === 'C') {
    speakVoice(`Minuto ${min}: Flexão.`);
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
  if (roundEl) roundEl.innerText = `${min} de ${total}`;
  if (progressBar) progressBar.style.width = `${(sec / 60) * 100}%`;
  if (workoutTag) workoutTag.innerText = `FICHA ${f} • ${total} MIN`;

  const isFinal = (f === 'A' && (min === 39 || min === 40)) || (f === 'C' && min === 20) || (f === 'NC' && min === total);
  if (amrapBanner) {
    if (isFinal) amrapBanner.classList.remove('hidden');
    else amrapBanner.classList.add('hidden');
  }

  const extraBarra = AppState.targets.A.barraExtraKg > 0 ? ` (+${AppState.targets.A.barraExtraKg}kg)` : '';
  const extraAbd = AppState.targets.A.abdExtraKg > 0 ? ` (+${AppState.targets.A.abdExtraKg}kg)` : '';

  if (f === 'A') {
    if (min % 2 !== 0) {
      currentExEl.innerText = isFinal ? `Minuto ${min}: Barra Fixa (Falha)` : `Minuto ${min}: Barra Fixa`;
      nextPreviewEl.innerText = `A seguir: Minuto ${min + 1} • Abdominal (${AppState.targets.A.abdReps} reps)`;
      targetRepEl.innerText = `${AppState.timer.currentRepsDone} rep${extraBarra}`;
      assistTagEl.innerText = `(${getAssistanceLabel(AppState.targets.A.barraMod, AppState.targets.A.barraExtraKg)})`;
      assistTagEl.classList.remove('hidden');
    } else {
      currentExEl.innerText = isFinal ? `Minuto ${min}: Abdominal (Falha)` : `Minuto ${min}: Abdominal`;
      nextPreviewEl.innerText = min < total ? `A seguir: Minuto ${min + 1} • Barra Fixa (${AppState.targets.A.barraReps} rep)` : `A seguir: Corrida 20 min`;
      targetRepEl.innerText = `${AppState.timer.currentRepsDone} reps${extraAbd}`;
      assistTagEl.classList.add('hidden');
    }
  } else if (f === 'C') {
    currentExEl.innerText = isFinal ? `Minuto ${min}: Flexão (Falha)` : `Minuto ${min}: Flexão de Braço`;
    nextPreviewEl.innerText = min < total ? `A seguir: Minuto ${min + 1} • Flexão (${AppState.targets.C.flexaoReps} reps)` : `A seguir: Corrida 40 min`;
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
    setTimeout(() => btn.classList.remove('bg-emerald-400'), 200);
  }
}

function resetTimer() {
  if (confirm("Reiniciar a sessão?")) {
    clearInterval(AppState.timer.intervalId);
    releaseWakeLock();
    AppState.timer.isRunning = false;
    AppState.timer.currentMinute = 1;
    AppState.timer.secondsLeft = 60;
    AppState.timer.historyReps = [];

    const playBtn = document.getElementById('btn-timer-play');
    if (playBtn) playBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Iniciar Treino`;
    setupMinuteTarget();
    updateTimerUI();
    lucide.createIcons();
  }
}

function finishWorkoutTimer() {
  clearInterval(AppState.timer.intervalId);
  releaseWakeLock();
  AppState.timer.isRunning = false;

  playBeep(1400, 0.4);

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

  let corridaDist = prompt(`Bloco Concluído.\nVolume: ${f === 'A' ? `${totalBarra} Barras, ${totalAbd} Abdominais` : `${totalFlexao} Flexões`}\n\nDistância da corrida em km:`, "2.5");
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
    barraExtraKg: AppState.targets.A.barraExtraKg || 0,
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
  updateDesmameWidget();
  renderWeeklyPlanner();
  alert(`Sessão Registrada.\n\n${suggestion.text}`);
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
      text = `Série de falha: ${falha} repetições. Adaptação atingida: reduza o elástico no próximo treino.`;
      if (curMod === 'verde') newTargets.barraMod = 'roxa';
      else if (curMod === 'roxa') newTargets.barraMod = 'vermelha';
      else if (curMod === 'vermelha') newTargets.barraMod = 'livre';
    } else if (falha >= 8 && curMod === 'livre') {
      text = `Domínio em barra livre (${falha} reps). Fase de sobrecarga: adicione +2 kg com colete/cinto.`;
    } else if (falha >= curBarra * 3) {
      text = `Reserva submáxima favorável: aumentar para ${curBarra + 1} reps/minuto.`;
      newTargets.barraReps = curBarra + 1;
    } else {
      text = `Volume consolidado. Manter ${curBarra} rep (${getAssistanceLabel(curMod, AppState.targets.A.barraExtraKg)}).`;
    }

    return { text, newTargets };
  } else if (ficha === 'C') {
    const curFlex = AppState.targets.C.flexaoReps;
    const falha = results.flexaoFalha;

    let text = "";
    let newTargets = {};

    if (falha >= curFlex * 2) {
      text = `Falha atingiu ${falha} flexões. Aumentar para ${curFlex + 1} reps/minuto.`;
      newTargets.flexaoReps = curFlex + 1;
    } else {
      text = `Manter meta de ${curFlex} reps/minuto.`;
    }

    return { text, newTargets };
  }

  return { text: "Treino registrado.", newTargets: null };
}

// ============================================================
// GRÁFICOS VISUAIS (CHART.JS - TEMA SÓBRIO)
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
          { label: 'Barras', data: [], backgroundColor: '#e11d48' },
          { label: 'Flexões', data: [], backgroundColor: '#f59e0b' },
          { label: 'Abdominais', data: [], backgroundColor: '#0284c7' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1e2638' }, ticks: { color: '#64748b', font: { size: 9, family: 'monospace' } } },
          y: { grid: { color: '#1e2638' }, ticks: { color: '#64748b', font: { family: 'monospace' } } }
        },
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 10 } } }
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
            label: 'Quilômetros',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            fill: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1e2638' }, ticks: { color: '#64748b', font: { size: 9, family: 'monospace' } } },
          y: { grid: { color: '#1e2638' }, ticks: { color: '#64748b', font: { family: 'monospace' } } }
        },
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 10 } } }
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
// SINCRONIZAÇÃO
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
  const msg = encodeURIComponent(`Dados TAF Soviético:\n${url}`);
  window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

function copySyncLink() {
  const payload = generateSyncPayload();
  const url = `${window.location.origin}${window.location.pathname}#sync=${payload}`;
  navigator.clipboard.writeText(url).then(() => {
    alert("Link de sincronização copiado.");
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
      alert("Dados sincronizados com sucesso.");
    } catch (e) {
      console.error("Erro ao sincronizar do hash:", e);
    }
  }
}

// ============================================================
// ÁUDIO & VOZ
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
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
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
      `<i data-lucide="volume-2" class="w-4 h-4 text-rose-400"></i>` :
      `<i data-lucide="volume-x" class="w-4 h-4 text-slate-500"></i>`;
    lucide.createIcons();
  }
}

function toggleVoice() {
  AppState.timer.voiceEnabled = !AppState.timer.voiceEnabled;
  const btn = document.getElementById('btn-voice');
  if (btn) {
    btn.innerHTML = AppState.timer.voiceEnabled ? 
      `<i data-lucide="mic" class="w-4 h-4 text-emerald-400"></i>` :
      `<i data-lucide="mic-off" class="w-4 h-4 text-slate-500"></i>`;
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
    { name: 'Z1', label: 'Recuperação', minPct: 0.50, maxPct: 0.60, colorClass: 'border-[#1e2638] bg-[#151a26] text-blue-300' },
    { name: 'Z2', label: 'Base Aeróbica', minPct: 0.60, maxPct: 0.70, colorClass: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-400' },
    { name: 'Z3', label: 'Ritmo Limiar', minPct: 0.70, maxPct: 0.80, colorClass: 'border-[#1e2638] bg-[#151a26] text-amber-300' },
    { name: 'Z4', label: 'Tiro Longo', minPct: 0.80, maxPct: 0.90, colorClass: 'border-[#1e2638] bg-[#151a26] text-orange-300' },
    { name: 'Z5', label: 'VO2 Máx', minPct: 0.90, maxPct: 1.00, colorClass: 'border-[#1e2638] bg-[#151a26] text-rose-400' },
  ];

  const zoneResults = zones.map(z => {
    const minBpm = Math.round(hrRest + (z.minPct * reserve));
    const maxBpm = Math.round(hrRest + (z.maxPct * reserve));
    return { ...z, minBpm, maxBpm };
  });

  const fcMaxDisplay = document.getElementById('fc-max-calculated');
  if (fcMaxDisplay) fcMaxDisplay.innerText = `${fcMax.toFixed(0)} bpm`;

  const container = document.getElementById('zones-cards-container');
  if (container) {
    container.innerHTML = zoneResults.map(z => `
      <div class="p-2 rounded border ${z.colorClass}">
        <span class="text-[9px] font-bold uppercase block">${z.name}</span>
        <div class="text-xs font-bold font-mono my-0.5">${z.minBpm}-${z.maxBpm} bpm</div>
        <span class="text-[9px] text-slate-400 block">${z.label}</span>
      </div>
    `).join('');
  }

  saveToLocalStorage();
  return zoneResults;
}

function copyGarminZones() {
  const zones = calculateHeartZones();
  const text = `Zonas Garmin (Tanaka+Karvonen):\nZ1: ${zones[0].minBpm}-${zones[0].maxBpm}\nZ2: ${zones[1].minBpm}-${zones[1].maxBpm}\nZ3: ${zones[2].minBpm}-${zones[2].maxBpm}\nZ4: ${zones[3].minBpm}-${zones[3].maxBpm}\nZ5: ${zones[4].minBpm}-${zones[4].maxBpm}`;
  navigator.clipboard.writeText(text).then(() => {
    alert("Zonas copiadas para a área de transferência.");
  });
}

// ============================================================
// ASSESSORIA & PACE
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
    suggestion: `Assessoria (${type}): Pace ${pace}`
  };

  AppState.history.unshift(record);
  saveToLocalStorage();
  renderHistoryTable();
  alert("Sessão registrada.");
  document.getElementById('assessoria-form').reset();
}

// ============================================================
// HISTÓRICO
// ============================================================

function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  const items = AppState.history;
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-slate-500 font-sans">Nenhum treino registrado.</td></tr>`;
    updateStatsCounters();
    return;
  }

  tbody.innerHTML = items.map(h => {
    let details = "";
    let falha = "-";

    if (h.ficha === 'A') {
      const extra = h.barraExtraKg > 0 ? ` (+${h.barraExtraKg}kg)` : '';
      details = `${h.totalBarra || 0} barras${extra}, ${h.totalAbd || 0} abd`;
      falha = `${h.barraFalha || '-'}/${h.abdFalha || '-'}`;
    } else if (h.ficha === 'B') {
      details = `Intervalado (${h.bType || 'B1'})`;
      falha = `-`;
    } else if (h.ficha === 'C') {
      details = `${h.totalFlexao || 0} flexões`;
      falha = `${h.flexaoFalha || '-'}`;
    } else if (h.ficha === 'ASS') {
      details = `Assessoria (${h.assType || 'Corrida'}, ${h.pace || '-'})`;
      falha = h.duration || '-';
    }

    return `
      <tr class="hover:bg-[#151a26]/40 transition">
        <td class="py-2 px-2.5 text-slate-300">${h.date}</td>
        <td class="py-2 px-2.5"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${getFichaBadgeClass(h.ficha)}">${h.ficha === 'ASS' ? 'ASSESSORIA' : `FICHA ${h.ficha}`}</span></td>
        <td class="py-2 px-2.5 text-white">${details}</td>
        <td class="py-2 px-2.5 text-rose-400 font-semibold">${falha}</td>
        <td class="py-2 px-2.5 text-emerald-400 font-bold">${h.distanceKm > 0 ? `${h.distanceKm.toFixed(2)} km` : '-'}</td>
        <td class="py-2 px-2.5 text-slate-400 text-[11px] truncate max-w-xs font-sans">${h.suggestion || '-'}</td>
        <td class="py-2 px-2.5 text-right font-sans">
          <button onclick="deleteHistoryItem(${h.id})" class="text-slate-500 hover:text-rose-400 text-xs">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');

  updateStatsCounters();
}

function getFichaBadgeClass(ficha) {
  if (ficha === 'A') return 'bg-rose-950/60 text-rose-300 border border-rose-900';
  if (ficha === 'B') return 'bg-amber-950/60 text-amber-300 border border-amber-900';
  if (ficha === 'C') return 'bg-sky-950/60 text-sky-300 border border-sky-900';
  if (ficha === 'ASS') return 'bg-emerald-950/60 text-emerald-300 border border-emerald-900';
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
  if (confirm("Apagar treino?")) {
    AppState.history = AppState.history.filter(h => h.id !== id);
    saveToLocalStorage();
    renderHistoryTable();
  }
}

function exportHistoryCSV() {
  if (AppState.history.length === 0) {
    alert("Nenhum histórico para exportar.");
    return;
  }

  let csvContent = "\uFEFFData;Hora;Ficha;Barras;Flexões;Abdominais;Distância (km);Falha;Sugestão\n";
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
// BACKUP
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
      updateDesmameWidget();
      renderHistoryTable();
      renderSimuladosTable();
      calculateEditalScore();
      alert("Backup restaurado.");
    } catch (err) {
      alert("Arquivo inválido.");
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm("Tem certeza que deseja apagar os registros locais?")) {
    localStorage.removeItem('TAF_SOVIETICO_DATA');
    location.reload();
  }
}

// ============================================================
// MODAL MANUAL
// ============================================================

function openManualModal(fichaKey) {
  AppState.currentFicha = fichaKey;
  const container = document.getElementById('manual-fields-container');
  const title = document.getElementById('manual-modal-title');
  const t = AppState.targets[fichaKey];

  title.innerText = `Registrar Ficha ${fichaKey}`;

  if (fichaKey === 'A') {
    container.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Reps/Min Barra</label>
          <input type="number" id="man-barra-base" value="${t.barraReps}" class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Última Série Barra (Falha)</label>
          <input type="number" id="man-barra-falha" placeholder="ex: 4" required class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Reps/Min Abdominal</label>
          <input type="number" id="man-abd-base" value="${t.abdReps}" class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Última Série Abd (Falha)</label>
          <input type="number" id="man-abd-falha" placeholder="ex: 12" required class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
        <div class="col-span-2">
          <label class="text-slate-400 font-sans block mb-0.5">Distância Corrida 20' (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 2.80" class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
      </div>
    `;
  } else if (fichaKey === 'B') {
    container.innerHTML = `
      <div class="space-y-2 text-xs font-mono">
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Tipo</label>
          <select id="man-b-type" class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
            <option value="B1">B.1 Curto (20x 30"/90")</option>
            <option value="B2">B.2 Longo (8x 2'/3')</option>
          </select>
        </div>
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Distância Total (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 6.0" required class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
      </div>
    `;
  } else if (fichaKey === 'C') {
    container.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Reps/Min Flexão</label>
          <input type="number" id="man-flex-base" value="${t.flexaoReps}" class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
        <div>
          <label class="text-slate-400 font-sans block mb-0.5">Última Série Flexão (Falha)</label>
          <input type="number" id="man-flex-falha" placeholder="ex: 8" required class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
        </div>
        <div class="col-span-2">
          <label class="text-slate-400 font-sans block mb-0.5">Distância Corrida 40' (km)</label>
          <input type="number" step="0.01" id="man-dist" placeholder="ex: 5.10" class="w-full bg-[#151a26] border border-[#1e2638] rounded p-1.5 text-white">
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
    record.barraExtraKg = AppState.targets.A.barraExtraKg || 0;

    const prog = calculateProgression('A', { barraFalha: falhaBarra, abdFalha: falhaAbd });
    record.suggestion = prog.text;
  } else if (f === 'B') {
    record.bType = document.getElementById('man-b-type').value;
    record.suggestion = "Sessão concluída.";
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
  updateDesmameWidget();
  renderWeeklyPlanner();
  closeManualModal();
  renderHistoryTable();
  alert("Sessão salva.");
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
