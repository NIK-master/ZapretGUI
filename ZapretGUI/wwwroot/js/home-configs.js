// =========================================================================
// 1. ЛОГИКА ВКЛАДКИ 1: ГЛАВНАЯ (HOMEVIEW)
// =========================================================================
let sessionStartTime = null;
let sessionTimerId = null;
let watchdogFailCount = 0;
let lastProgressLogEl = null;
let currentLogFilter = 'all';

function updatePingDisplay(pingMs) {
    const pingEl = document.getElementById('stat-ping');
    const badgeEl = document.getElementById('ping-quality-badge');

    if (pingMs < 0) {
        pingEl.innerText = '—';
        pingEl.style.color = '#D13438';
        badgeEl.innerText = 'Недоступен';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#2A1215] text-[#F44336]';
        return;
    }

    pingEl.innerText = pingMs;
    if (pingMs < 80) {
        pingEl.style.color = 'var(--accent-light)';
        badgeEl.innerText = 'Отлично';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#0F240F] text-brand';
    } else if (pingMs < 150) {
        pingEl.style.color = '#FF8C00';
        badgeEl.innerText = 'Норма';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#2E2210] text-[#F59E0B]';
    } else {
        pingEl.style.color = '#D13438';
        badgeEl.innerText = 'Высокий';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#2A1215] text-[#F44336]';
    }
}

function formatUptime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateSessionBadgeTick() {
    const badge = document.getElementById('session-badge');
    const dot = document.getElementById('session-dot');
    const txt = document.getElementById('session-text');

    if (appState.isRunning && sessionStartTime) {
        const elapsed = Date.now() - sessionStartTime;
        badge.className = 'mt-2.5 px-3 py-1 rounded-full bg-[#0F240F] border border-[#107C10] flex items-center gap-2 text-[11px] font-mono text-white transition-all';
        dot.className = 'w-1.5 h-1.5 rounded-full dot-online';
        txt.innerText = `АКТИВЕН • ${formatUptime(elapsed)}`;

        if (appState.settings.watchdogPingAutoRestart && Math.floor(elapsed / 1000) % 25 === 0) {
            sendCmd('ping');
        }
    } else {
        badge.className = 'mt-2.5 px-3 py-1 rounded-full bg-[#181818] border border-[#2A2A2A] flex items-center gap-2 text-[11px] font-mono text-[#888888] transition-all';
        dot.className = 'w-1.5 h-1.5 rounded-full bg-[#555555]';
        txt.innerText = 'ОЖИДАНИЕ ЗАПУСКА';
    }
}

function onMainToggleClick() {
    if (!appState.isRunning) {
        const useZapret = document.getElementById('chk-zapret').checked;
        const useProxy = document.getElementById('chk-proxy').checked;

        if (useZapret && !appState.firstTimeScanPrompted) {
            appState.firstTimeScanPrompted = true;
            sendCmd('markFirstScanPrompted');

            showConfirm(
                'Первый запуск Zapret',
                'Перед первым включением рекомендуется протестировать стратегии обхода, чтобы выбрать самую быструю и стабильную для вашего провайдера.\n\nЗапустить автоматическое тестирование конфигураций сейчас?',
                'Запустить тест',
                () => {
                    openConfigModal();
                    toggleSmartScan();
                },
                false,
                () => {
                    sendCmd('toggleBypass', {
                        profile: appState.selectedProfile,
                        useZapret,
                        useProxy
                    });
                }
            );
            return;
        }

        sendCmd('toggleBypass', {
            profile: appState.selectedProfile,
            useZapret,
            useProxy
        });
    } else {
        sendCmd('toggleBypass');
    }
}

function onModuleToggleChange() {
    sendCmd('updateModuleToggles', {
        useZapret: document.getElementById('chk-zapret').checked,
        useProxy: document.getElementById('chk-proxy').checked
    });
}

function refreshPing() {
    document.getElementById('stat-ping').innerText = '...';
    document.getElementById('ping-refresh-icon').classList.add('spin-anim');
    sendCmd('ping');
}

function updateRunningUI(zapretRunning, proxyRunning) {
    const wasRunning = appState.isRunning;
    appState.zapretRunning = zapretRunning;
    appState.proxyRunning = proxyRunning;
    appState.isRunning = zapretRunning || proxyRunning;

    if (appState.isRunning && !wasRunning) {
        sessionStartTime = Date.now();
        watchdogFailCount = 0;
        if (!sessionTimerId) sessionTimerId = setInterval(updateSessionBadgeTick, 1000);
    } else if (!appState.isRunning) {
        sessionStartTime = null;
        if (sessionTimerId) {
            clearInterval(sessionTimerId);
            sessionTimerId = null;
        }
    }
    updateSessionBadgeTick();

    const btn = document.getElementById('main-toggle-btn');
    const reactor = document.getElementById('reactor-container');
    const txt = document.getElementById('main-btn-text');
    const lbl = document.getElementById('zapret-status-label');
    const proxyLbl = document.getElementById('proxy-status-label');

    btn.classList.toggle('active', appState.isRunning);
    reactor.classList.toggle('active', appState.isRunning);
    txt.innerText = appState.isRunning ? 'Остановить' : 'Починить интернет';

    lbl.innerText = zapretRunning ? 'Работает' : 'Остановлен';
    lbl.className = `text-xs font-medium mb-3 ${zapretRunning ? 'text-brand' : 'text-[#D13438]'}`;

    if (proxyLbl) {
        proxyLbl.innerText = proxyRunning ? 'Работает локально (:1080)' : 'Прокси для Telegram';
        proxyLbl.className = `text-xs mt-0.5 ${proxyRunning ? 'text-brand font-medium' : 'text-[#A0A0A0]'}`;
    }

    document.getElementById('dot-zapret').className = `w-2 h-2 rounded-full ${zapretRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('dot-proxy').className = `w-2 h-2 rounded-full ${proxyRunning ? 'dot-online' : 'dot-offline'}`;
}

// =========================================================================
// 2. ВЫБОР КОНФИГОВ ZAPRET (.BAT) И ИГРОВОГО ФИЛЬТРА
// =========================================================================
function initConfigsList(fileNames) {
    const existingMap = {};
    appState.configs.forEach(c => existingMap[c.fileName.toLowerCase()] = c);

    appState.configs = fileNames.map(name => existingMap[name.toLowerCase()] || ({
        fileName: name,
        topRank: 999999,
        pingMs: appState.currentPing > 0 ? appState.currentPing : 999999,
        testsOk: -1,
        testsTotal: 0
    }));

    document.getElementById('txt-main-profile').innerText = appState.selectedProfile;
    document.getElementById('modal-active-profile').innerText = appState.selectedProfile;
    document.getElementById('modal-configs-count').innerText = `${appState.configs.length} конфигов`;

    renderConfigCards();
}

function renderConfigCards() {
    const list = document.getElementById('profile-cards-list');
    if (!list) return;

    const sorted = [...appState.configs].sort((a, b) => {
        if (a.topRank !== b.topRank) return a.topRank - b.topRank;
        if (b.testsOk !== a.testsOk) return b.testsOk - a.testsOk;
        return a.fileName.localeCompare(b.fileName);
    });

    list.innerHTML = sorted.map(cfg => {
        const isSelected = cfg.fileName.toLowerCase() === appState.selectedProfile.toLowerCase();
        const isMod = cfg.fileName.toLowerCase().startsWith('mod_');

        let badgeHtml = '';
        if (cfg.topRank === 0) {
            badgeHtml = `<span class="px-2 py-0.5 rounded bg-[#0F240F] border border-[#107C10] text-brand font-mono text-[10px] font-bold">★ ЛУЧШИЙ</span>`;
        } else if (cfg.testsOk >= 0) {
            const allOk = cfg.testsOk === cfg.testsTotal && cfg.testsTotal > 0;
            badgeHtml = `<span class="px-2 py-0.5 rounded ${allOk ? 'bg-[#0F240F] text-brand' : 'bg-[#2E2210] text-[#F59E0B]'} font-mono text-[10px] font-semibold">OK: ${cfg.testsOk}/${cfg.testsTotal}</span>`;
        } else if (isMod) {
            badgeHtml = `<span class="px-2 py-0.5 rounded bg-[#1E1E24] border border-[#333333] text-[#CCCCCC] font-mono text-[10px]">MOD</span>`;
        }

        return `
            <div onclick="selectProfile('${cfg.fileName.replace(/'/g, "\\'")}')"
                 class="p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${isSelected ? 'bg-[#0F240F] border-[#107C10]' : 'bg-[#181818] border-[#262626] hover:border-[#3E3E3E]'}">
                <div class="flex items-center gap-2.5 overflow-hidden">
                    <span class="mdl-icon text-sm ${isSelected ? 'text-brand' : 'text-[#777777]'}">&#xE756;</span>
                    <span class="font-mono text-xs font-semibold text-white truncate">${cfg.fileName}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    ${badgeHtml}
                    ${isSelected ? '<span class="text-xs font-bold text-brand">✓ Выбран</span>' : '<span class="text-xs text-[#666666]">Выбрать</span>'}
                </div>
            </div>
        `;
    }).join('');
}

function selectProfile(profileName) {
    appState.selectedProfile = profileName;
    document.getElementById('txt-main-profile').innerText = profileName;
    document.getElementById('modal-active-profile').innerText = profileName;
    renderConfigCards();
    sendCmd('selectProfile', { profile: profileName });
}

function openConfigModal() {
    renderConfigCards();
    document.getElementById('config-modal').classList.add('open');
}

function closeConfigModal() {
    document.getElementById('config-modal').classList.remove('open');
}

function toggleSmartScan() {
    sendCmd('startScan');
}

function updateScanButtonUI() {
    const txt = document.getElementById('scan-btn-text');
    const icon = document.getElementById('scan-btn-icon');
    if (!txt || !icon) return;

    if (appState.isScanning) {
        txt.innerText = 'Остановить сканирование...';
        icon.classList.add('spin-anim');
    } else {
        txt.innerText = 'Запустить авто-подбор (Smart DPI Scan)';
        icon.classList.remove('spin-anim');
    }
}

function updateGameFilterBadge(statusText, isEnabled) {
    const el = document.getElementById('txt-gf-status');
    if (!el) return;
    el.innerText = statusText || 'Отключен';
    el.className = `text-xs font-mono font-semibold truncate ${isEnabled ? 'text-brand' : 'text-[#A0A0A0]'}`;
}

function openGameFilterModal() {
    selectGfMode(appState.gameFilter.mode || 'disabled');
    document.getElementById('gf-tcp-input').value = appState.gameFilter.tcp || '1024-65535';
    document.getElementById('gf-udp-input').value = appState.gameFilter.udp || '1024-65535';
    document.getElementById('gf-modal').classList.add('open');
}

function closeGameFilterModal() {
    document.getElementById('gf-modal').classList.remove('open');
}

function selectGfMode(mode) {
    appState.gameFilter.mode = mode;

    document.querySelectorAll('.gf-mode-card').forEach(card => {
        const isCurrent = card.getAttribute('data-mode') === mode;
        card.className = `gf-mode-card p-3 rounded-lg border cursor-pointer flex items-center justify-between transition ${isCurrent ? 'bg-[#0F240F] border-[#107C10]' : 'border-[#262626] bg-[#181818] hover:bg-[#222222]'}`;
        const chk = card.querySelector('.gf-check');
        if (chk) {
            chk.innerText = isCurrent ? '✓' : '→';
            chk.className = `gf-check text-sm font-bold ${isCurrent ? 'text-brand' : 'text-[#555555]'}`;
        }
    });
}

function resetGfPorts() {
    document.getElementById('gf-tcp-input').value = '1024-65535';
    document.getElementById('gf-udp-input').value = '1024-65535';
}

function saveGameFilter() {
    sendCmd('saveGameFilter', {
        mode: appState.gameFilter.mode,
        tcp: document.getElementById('gf-tcp-input').value.trim(),
        udp: document.getElementById('gf-udp-input').value.trim(),
        restartIfRunning: false
    });
}

// =========================================================================
// 3. ДВУХКАНАЛЬНЫЙ ГРАФИК ТРАФИКА
// =========================================================================
const CHART_POINTS = 40;
let rxHistory = new Array(CHART_POINTS).fill(0);
let txHistory = new Array(CHART_POINTS).fill(0);
let peakSpeedMbps = 0;
let totalRxMB = 0;
let totalTxMB = 0;
let chartHoverIndex = -1;

function updateChart(rxMbps, txMbps) {
    rxHistory.push(rxMbps);
    if (rxHistory.length > CHART_POINTS) rxHistory.shift();

    txHistory.push(txMbps);
    if (txHistory.length > CHART_POINTS) txHistory.shift();

    const maxNow = Math.max(rxMbps, txMbps);
    if (maxNow > peakSpeedMbps) {
        peakSpeedMbps = maxNow;
        const peakEl = document.getElementById('stat-peak');
        if (peakEl) peakEl.innerText = `Пик: ${peakSpeedMbps.toFixed(1)} Мбит/с`;
    }

    const intervalSec = Math.max(1, appState.settings.statsUpdateInterval || 1);
    totalRxMB += (rxMbps * intervalSec) / 8.0;
    totalTxMB += (txMbps * intervalSec) / 8.0;

    const totalEl = document.getElementById('stat-session-total');
    if (totalEl) {
        totalEl.innerText = `Сессия: ↓ ${totalRxMB.toFixed(1)} МБ • ↑ ${totalTxMB.toFixed(1)} МБ`;
    }

    drawChart();
}

function onChartMouseMove(e) {
    const canvas = document.getElementById('traffic-chart');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    chartHoverIndex = Math.round(relX * (CHART_POINTS - 1));
    drawChart();
}

function onChartMouseLeave() {
    chartHoverIndex = -1;
    drawChart();
}

function drawChart() {
    const canvas = document.getElementById('traffic-chart');
    if (!canvas || canvas.offsetParent === null) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 10 || h < 10) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const accentLight = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    const maxVal = Math.max(5, ...rxHistory, ...txHistory) * 1.25;

    function drawSeries(data, strokeColor, fillHex) {
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const x = (i / (CHART_POINTS - 1)) * w;
            const y = h - 4 - (data[i] / maxVal) * (h - 20);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, fillHex + '40');
        grad.addColorStop(1, fillHex + '00');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    drawSeries(txHistory, '#60A5FA', '#3B82F6');
    drawSeries(rxHistory, accentLight, accentLight.startsWith('#') ? accentLight : '#4CAF50');

    if (chartHoverIndex >= 0 && chartHoverIndex < CHART_POINTS) {
        const x = Math.floor((chartHoverIndex / (CHART_POINTS - 1)) * w) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.stroke();

        const rxVal = rxHistory[chartHoverIndex].toFixed(1);
        const txVal = txHistory[chartHoverIndex].toFixed(1);
        const label = `↓ ${rxVal}  ↑ ${txVal} Мбит/с`;

        ctx.font = '600 10px Consolas, monospace';
        const textW = ctx.measureText(label).width + 10;
        const boxX = Math.min(w - textW - 4, Math.max(4, x - textW / 2));

        ctx.fillStyle = 'rgba(20, 20, 20, 0.92)';
        ctx.fillRect(boxX, 16, textW, 16);
        ctx.strokeStyle = '#333333';
        ctx.strokeRect(boxX, 16, textW, 16);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, boxX + 5, 27);
    }

    ctx.restore();
}

// =========================================================================
// 4. ЖУРНАЛ СОБЫТИЙ
// =========================================================================
const MAX_LOG_LINES = 300;

function appendLog(time, message, isProgress = false) {
    const box = document.getElementById('log-box');
    if (!box) return;

    const fullText = `[${time}] ${message}`;
    if (isProgress && lastProgressLogEl && lastProgressLogEl.parentNode === box) {
        lastProgressLogEl.innerText = fullText;
        box.scrollTop = box.scrollHeight;
        return;
    }

    const row = document.createElement('div');
    const isErr = message.includes('ОШИБКА') || message.includes('ERR') || message.includes('❌') || message.includes('⚠');
    row.setAttribute('data-err', isErr ? '1' : '0');

    if (isErr) row.className = 'text-[#F87171]';
    else if (message.includes('✅') || message.includes('🏆')) row.className = 'text-brand font-semibold';
    else row.className = 'text-[#CCCCCC]';

    row.innerText = fullText;
    box.appendChild(row);
    lastProgressLogEl = isProgress ? row : null;

    while (box.children.length > MAX_LOG_LINES) {
        box.removeChild(box.firstElementChild);
    }

    updateLogCounter();
    applyLogFilters();
    box.scrollTop = box.scrollHeight;
}

function updateLogCounter() {
    const box = document.getElementById('log-box');
    const badge = document.getElementById('log-counter-badge');
    if (box && badge) {
        badge.innerText = box.children.length;
    }
}

function setLogFilter(mode) {
    currentLogFilter = mode;

    const btnAll = document.getElementById('log-filter-all');
    const btnErr = document.getElementById('log-filter-err');

    if (btnAll && btnErr) {
        btnAll.className = mode === 'all'
            ? 'px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2A2A2A] text-white cursor-pointer transition'
            : 'px-2 py-0.5 rounded text-[11px] font-medium text-[#888888] hover:text-white cursor-pointer transition';

        btnErr.className = mode === 'err'
            ? 'px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2A1215] text-[#F44336] cursor-pointer transition'
            : 'px-2 py-0.5 rounded text-[11px] font-medium text-[#888888] hover:text-white cursor-pointer transition';
    }

    applyLogFilters();
}

function applyLogFilters() {
    const box = document.getElementById('log-box');
    if (!box) return;
    const q = (document.getElementById('log-search-input')?.value || '').trim().toLowerCase();

    Array.from(box.children).forEach(el => {
        const isErr = el.getAttribute('data-err') === '1';
        const matchType = currentLogFilter === 'all' || isErr;
        const matchQuery = !q || el.innerText.toLowerCase().includes(q);
        el.classList.toggle('hidden', !(matchType && matchQuery));
    });
}

function clearLogs() {
    const box = document.getElementById('log-box');
    if (box) box.innerHTML = '';
    lastProgressLogEl = null;
    updateLogCounter();
}

function exportLogs() {
    const box = document.getElementById('log-box');
    if (!box) return;
    const text = Array.from(box.children).map(el => el.innerText).join('\r\n');
    sendCmd('exportLogs', { text });
}