// =========================================================================
// 1. SPLASH WINDOW (МАТРИЧНЫЙ ТЕРМИНАЛ ЗАГРУЗКИ)
// =========================================================================
const SPLASH_LINES = [
    "[ SYSTEM ] ADHD Engine initiated. Focus level: 4%",
    "[ OK     ] Coffee levels detected: Critical but acceptable.",
    "[ INFO   ] Inspecting deep internet blockages...",
    "[ SEARCH ] Looking for winws.exe...",
    "[ SEARCH ] Looking for tgwsproxy.exe...",
    "[ SEARCH ] Getting distracted by a random Wikipedia article...",
    "[ FIX    ] Focus restored! Files found.",
    "[ WARN   ] WinDivert64.sys loading... Please don't close this window or look at shiny objects.",
    "[ OK     ] WinDivert driver injected successfully.",
    "[ SOCKS5 ] tgwsproxy spinning up on port 1080...",
    "[ PACKET ] Fragmentation: ENABLED",
    "[ PACKET ] HTTP Host Spoofing: ACTIVE",
    "[ PACKET ] HTTPS SNI Trickery: ACTIVE",
    "[ BYPASS ] Shaking hands with forbidden packets...",
    "[ BYPASS ] Harder... Faster... Better... Stronger...",
    "[ OK     ] DPI bypassed! Access to the matrix granted.",
    "[ STATUS ] BYPASS ACTIVE. GO WATCH YOUTUBE IN 4K NOW!",
    "==========================================================================",
    "  ____   _    ____   ____   _____ _____   ______ ____   ____     ",
    " /_  /  / |  / __ \\ / __ \\ / ___//__  /   / ____// __ \\ / __ \\    ",
    "  / /  / /| |/ /_/ // /_/ // __/    / /   / /_   / / / // /_/ /    ",
    " / /_ / ___// ____// _, _// /___   / /   / __/  / /_/ // _, _/     ",
    "/____/_/  |_/_/   /_/ |_|/_____/  /_/   /_/     \\____//_/ |_|      ",
    "                                                                    ",
    "            ___     ____   _   _   ____                             ",
    "           /   |   / __ \\ / / / / / __ \\                            ",
    "          / /| |  / / / // /_/ / / / / /                            ",
    "         / ___ | / /_/ // __  / / /_/ /                             ",
    "        /_/  |_|/_____//_/ /_/ /_____/                              ",
    "=========================================================================="
];

let splashSkipped = false;
async function runSplashSequence() {
    const term = document.getElementById('splash-terminal');
    for (let i = 0; i < SPLASH_LINES.length; i++) {
        if (splashSkipped) return;
        const line = SPLASH_LINES[i];
        term.textContent += line + '\n';
        term.scrollTop = term.scrollHeight;

        let delay = Math.floor(Math.random() * 80) + 15;
        if (line.includes('Wikipedia')) delay = 900;
        else if (line.includes('___') || line.includes('===') || line.includes('/_')) delay = 25;
        await new Promise(r => setTimeout(r, delay));
    }
    if (!splashSkipped) {
        await new Promise(r => setTimeout(r, 700));
        skipSplash();
    }
}

function skipSplash() {
    splashSkipped = true;
    const el = document.getElementById('splash-overlay');
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => el.style.display = 'none', 450);
}

// =========================================================================
// 2. WIZARD WINDOW (5-ШАГОВЫЙ МАСТЕР ПЕРВОЙ НАСТРОЙКИ)
// =========================================================================
let wizardStep = 0;
let wizardFinished = false;
let lastWizProgressEl = null;

function openWizardModal() {
    wizardStep = 0;
    wizardFinished = false;
    updateWizardUI();
    document.getElementById('wizard-overlay').classList.add('open');
}

function updateWizardUI() {
    for (let i = 0; i < 5; i++) {
        document.getElementById('wiz-step-' + i).classList.toggle('active', i === wizardStep);
    }

    const dots = document.getElementById('wiz-dots');
    dots.innerHTML = [0, 1, 2, 3, 4].map(i =>
        `<span class="w-2 h-2 rounded-full transition-all ${i === wizardStep ? 'bg-emerald-500 scale-125' : 'bg-zinc-700'}"></span>`
    ).join('');

    const btnBack = document.getElementById('wiz-btn-back');
    const btnNext = document.getElementById('wiz-btn-next');
    const btnSkip = document.getElementById('wiz-btn-skip');

    if (wizardStep === 0) {
        btnNext.innerText = 'Начать настройку';
        btnBack.classList.add('hidden');
        btnSkip.classList.remove('hidden');
    } else if (wizardStep === 3) {
        btnNext.innerText = 'Применить и завершить';
        btnBack.classList.remove('hidden');
        btnSkip.classList.remove('hidden');
    } else if (wizardStep === 4) {
        btnNext.innerText = 'Закрыть';
        btnBack.classList.add('hidden');
        btnSkip.classList.add('hidden');
    } else {
        btnNext.innerText = 'Далее';
        btnBack.classList.remove('hidden');
        btnSkip.classList.remove('hidden');
    }
}

function wizardPrevStep() {
    sendCmd('playClick');
    if (wizardStep > 0 && wizardStep < 4) {
        wizardStep--;
        updateWizardUI();
    }
}

function wizardNextStep() {
    sendCmd('playClick');
    if (wizardStep === 3) {
        wizardStep = 4;
        updateWizardUI();

        const btnNext = document.getElementById('wiz-btn-next');
        btnNext.disabled = true;
        btnNext.style.opacity = '0.5';
        document.getElementById('wiz-console-log').innerHTML = '';

        sendCmd('runWizardSetup', {
            useZapret: document.getElementById('wiz-chk-zapret').checked,
            useTgProxy: document.getElementById('wiz-chk-proxy').checked,
            autoStart: document.getElementById('wiz-chk-autostart').checked,
            focusMode: document.getElementById('wiz-chk-focus').checked,
            colorblind: document.getElementById('wiz-chk-colorblind').checked
        });
    } else if (wizardStep === 4) {
        if (wizardFinished) {
            document.getElementById('wizard-overlay').classList.remove('open');
        }
    } else if (wizardStep < 3) {
        wizardStep++;
        updateWizardUI();
    }
}

function skipWizard() {
    sendCmd('playClick');
    sendCmd('skipWizard');
    document.getElementById('wizard-overlay').classList.remove('open');
}

function appendWizardLog(time, message, isProgress) {
    const box = document.getElementById('wiz-console-log');
    const text = `[${time}] ${message}`;

    if (isProgress && lastWizProgressEl) {
        lastWizProgressEl.innerText = text;
        return;
    }

    const div = document.createElement('div');
    div.innerText = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    lastWizProgressEl = isProgress ? div : null;
}

// =========================================================================
// 3. ГЛОБАЛЬНОЕ СОСТОЯНИЕ И МОСТ WEBVIEW2
// =========================================================================
let appState = {
    isRunning: false,
    zapretRunning: false,
    proxyRunning: false,
    isScanning: false,
    firstTimeScanPrompted: false,
    selectedProfile: 'general.bat',
    currentPing: -1,
    configs: [],
    gameFilter: { mode: 'disabled', tcp: '1024-65535', udp: '1024-65535' },
    modsSubTab: 'bat',
    batMods: [],
    listMods: [],
    editingMod: { id: '', isBat: true, wordWrap: true, fontSize: 13 },
    settings: {
        focusMode: false,
        compactMode: false,
        colorblindMode: false,
        statsUpdateInterval: 1,
        hostsSourceIndex: 2,
        ipSetMode: 'loaded'
    }
};

let lastProgressLogEl = null;
let confirmCallback = null;
let isBackendConfirm = false;
let selectionCallback = null;

function sendCmd(action, payload = {}) {
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ action, ...payload });
    }
}

function handleBackendEvent(type, data) {
    switch (type) {
        case 'initData':
            document.querySelectorAll('.app-ver-text').forEach(el => el.innerText = data.version);
            document.getElementById('chk-zapret').checked = data.settings.zapretEnabled;
            document.getElementById('chk-proxy').checked = data.settings.tgProxyEnabled;

            appState.firstTimeScanPrompted = data.settings.firstTimeScanPrompted;
            appState.selectedProfile = data.settings.selectedProfileName || 'general.bat';
            appState.gameFilter = {
                mode: data.settings.gameFilterMode || 'disabled',
                tcp: data.settings.gameFilterTcpRange || '1024-65535',
                udp: data.settings.gameFilterUdpRange || '1024-65535'
            };

            initSettingsFromBackend(data);

            appState.batMods = data.batMods || [];
            appState.listMods = data.listMods || [];

            initConfigsList(data.profiles || ['general.bat']);
            renderModsView();
            prepareDiagSkeletons();
            updateGameFilterBadge(data.gameFilterStatus, appState.gameFilter.mode !== 'disabled');
            updateRunningUI(data.zapretRunning, data.proxyRunning);

            if (data.isFirstRun) {
                openWizardModal();
            }
            break;

        case 'wizardLog':
            appendWizardLog(data.time, data.message, data.isProgress);
            break;

        case 'wizardCompleted':
            wizardFinished = true;
            document.getElementById('wiz-finish-status').innerText = 'Всё готово!';
            document.getElementById('wiz-finish-status').className = 'text-xl font-bold text-emerald-400 mb-2';
            document.getElementById('wiz-finish-bar').style.width = '100%';
            const btnNext = document.getElementById('wiz-btn-next');
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.innerText = 'Закрыть';
            break;

        case 'askConfirm':
            isBackendConfirm = true;
            showConfirm(data.title, data.message, data.confirmText || 'Да', null, data.isDanger);
            break;

        case 'routingStatusUpdated':
            updateRoutingStatusUI(data);
            document.getElementById('btn-update-ipset').innerText = '🔄 Обновить базу IP';
            document.getElementById('btn-update-ipset').disabled = false;
            document.getElementById('btn-update-hosts').innerText = '⚡ Обновить';
            document.getElementById('btn-update-hosts').disabled = false;
            break;

        case 'updatesCheckFinished':
            document.getElementById('btn-check-updates').innerText = 'Проверить обновления';
            document.getElementById('btn-check-updates').disabled = false;
            break;

        case 'modsUpdated':
            appState.batMods = data.batMods || [];
            appState.listMods = data.listMods || [];
            initConfigsList(data.profiles || ['general.bat']);
            renderModsView();
            break;

        case 'modIdGenerated':
            document.getElementById('new-mod-id').value = data.id;
            updateModIdValidationUI(data.id, false, false);
            break;

        case 'modIdChecked':
            updateModIdValidationUI(data.cleanId, data.isTaken, data.isEmpty);
            break;

        case 'modCreated':
            closeCreateModModal();
            break;

        case 'modContentLoaded':
            openEditorWithData(data);
            break;

        case 'batValidationResult':
            if (data.isValid) {
                setEditorStatus('✓ Синтаксис корректен!', 'text-emerald-400');
            } else {
                setEditorStatus('⚠ Ошибка в скрипте', 'text-red-400');
                showAlert('Проверка синтаксиса Zapret', data.errorMessage, true);
            }
            break;

        case 'modSaveSyntaxWarning':
            showConfirm(
                'Предупреждение синтаксиса Zapret',
                `В скрипте обнаружена проблема:\n\n${data.errorMessage}\n\nВсё равно сохранить файл?`,
                'Сохранить всё равно',
                () => saveEditorChanges(true)
            );
            break;

        case 'modContentSaved':
            closeEditorModal();
            break;

        case 'promptRestartZapret':
            showConfirm(
                'Перезапустить Zapret?',
                `${data.reason}\n\nФайл list-general.txt был обновлен в прямом эфире, но для применения новых доменов в уже работающем ядре winws.exe требуется перезапуск. Перезапустить сейчас?`,
                '🔄 Перезапустить',
                () => sendCmd('restartBypass')
            );
            break;

        case 'diagProgress':
            document.getElementById('diag-status-txt').innerText = data.status;
            document.getElementById('diag-progress-bar').style.width = `${data.progress}%`;
            break;

        case 'diagResult':
            renderDiagnosticsReport(data);
            break;

        case 'log':
            appendLog(data.time, data.message, data.isProgress);
            break;

        case 'netStats':
            document.getElementById('stat-rx').innerText = data.download.toFixed(1);
            document.getElementById('stat-tx').innerText = data.upload.toFixed(1);
            updateChart(data.download);
            updateRunningUI(data.zapretRunning, data.proxyRunning);
            break;

        case 'netStatus':
            document.getElementById('dot-net').className = `w-2 h-2 rounded-full ${data.isOnline ? 'dot-online' : 'dot-offline'}`;
            break;

        case 'pingResult':
            document.getElementById('ping-refresh-icon').classList.remove('spin-anim');
            appState.currentPing = data.ping;
            document.getElementById('stat-ping').innerText = data.ping >= 0 ? data.ping : '—';
            document.getElementById('dot-net').className = `w-2 h-2 rounded-full ${data.ping >= 0 ? 'dot-online' : 'dot-offline'}`;
            appState.configs.forEach(c => c.pingMs = data.ping > 0 ? data.ping : 999999);
            renderConfigCards();
            break;

        case 'bypassState':
            updateRunningUI(data.zapretRunning, data.proxyRunning);
            break;

        case 'configTested':
            const item = appState.configs.find(c => c.fileName.toLowerCase() === data.fileName.toLowerCase());
            if (item) {
                item.testsOk = data.ok;
                item.testsTotal = data.total;
                if (appState.currentPing > 0) item.pingMs = appState.currentPing;
                renderConfigCards();
            }
            break;

        case 'scanState':
            appState.isScanning = data.isScanning;
            updateScanButtonUI();
            break;

        case 'scanCompleted':
            appState.isScanning = false;
            updateScanButtonUI();
            if (data.topConfigs && data.topConfigs.length > 0) {
                appState.configs.forEach(c => c.topRank = 999999);
                data.topConfigs.forEach((name, idx) => {
                    const cfg = appState.configs.find(c => c.fileName.toLowerCase() === name.toLowerCase());
                    if (cfg) cfg.topRank = idx;
                });
                selectProfile(data.bestConfig);
                appendLog(new Date().toLocaleTimeString(), `🏆 Сканирование завершено! Выбрана лучшая стратегия: ${data.bestConfig}`);
            } else {
                appendLog(new Date().toLocaleTimeString(), '⚠ Сканирование завершено, но ни одна стратегия не сработала.');
            }
            break;

        case 'gameFilterSaved':
            appState.gameFilter = { mode: data.mode, tcp: data.tcp, udp: data.udp };
            updateGameFilterBadge(data.statusText, data.mode !== 'disabled');
            closeGameFilterModal();

            if (appState.zapretRunning) {
                showConfirm(
                    'Перезапустить Zapret?',
                    'Настройки Игрового фильтра сохранены. Чтобы новые диапазоны портов вступили в силу в работающем обходе, требуется перезапуск. Перезапустить сейчас?',
                    'Перезапустить',
                    () => sendCmd('saveGameFilter', { ...appState.gameFilter, restartIfRunning: true })
                );
            }
            break;

        case 'errorGlitch':
            if (!appState.settings.focusMode) {
                const mc = document.getElementById('main-container');
                mc.classList.remove('glitch-anim');
                void mc.offsetWidth;
                mc.classList.add('glitch-anim');
            }
            break;

        case 'alert':
            showAlert(data.title, data.message, data.isError);
            break;
    }
}

// =========================================================================
// 4. ЛОГИКА ВКЛАДКИ 1: ГЛАВНАЯ (HOMEVIEW)
// =========================================================================
function onMainToggleClick() {
    sendCmd('playClick');

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
    sendCmd('playClick');
    sendCmd('updateModuleToggles', {
        useZapret: document.getElementById('chk-zapret').checked,
        useProxy: document.getElementById('chk-proxy').checked
    });
}

function refreshPing() {
    sendCmd('playClick');
    document.getElementById('stat-ping').innerText = '...';
    document.getElementById('ping-refresh-icon').classList.add('spin-anim');
    sendCmd('ping');
}

function updateRunningUI(zapretRunning, proxyRunning) {
    appState.zapretRunning = zapretRunning;
    appState.proxyRunning = proxyRunning;
    appState.isRunning = zapretRunning || proxyRunning;

    const btn = document.getElementById('main-toggle-btn');
    const txt = document.getElementById('main-btn-text');
    const lbl = document.getElementById('zapret-status-label');

    btn.classList.toggle('active', appState.isRunning);
    txt.innerText = appState.isRunning ? 'Остановить' : 'Починить интернет';

    lbl.innerText = zapretRunning ? 'Работает' : 'Остановлен';
    lbl.className = `text-xs font-medium mb-3 ${zapretRunning ? 'text-emerald-400' : 'text-red-400'}`;

    const cfgBtn = document.getElementById('btn-open-config');
    const gfBtn = document.getElementById('btn-open-gf');
    cfgBtn.style.opacity = appState.isRunning ? '0.5' : '1';
    cfgBtn.style.pointerEvents = appState.isRunning ? 'none' : 'auto';
    gfBtn.style.opacity = appState.isRunning ? '0.5' : '1';
    gfBtn.style.pointerEvents = appState.isRunning ? 'none' : 'auto';

    document.getElementById('dot-zapret').className = `w-2 h-2 rounded-full ${zapretRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('dot-proxy').className = `w-2 h-2 rounded-full ${proxyRunning ? 'dot-online' : 'dot-offline'}`;
}

function initConfigsList(fileNames) {
    const existingMap = {};
    appState.configs.forEach(c => existingMap[c.fileName.toLowerCase()] = c);

    appState.configs = fileNames.map(name => existingMap[name.toLowerCase()] || ({
        fileName: name,
        topRank: 999999,
        pingMs: appState.currentPing > 0 ? appState.currentPing : 999999,
        testsOk: -1,
        testsTotal: -1
    }));

    if (!fileNames.some(f => f.toLowerCase() === appState.selectedProfile.toLowerCase()) && fileNames.length > 0) {
        appState.selectedProfile = fileNames[0];
    }

    document.getElementById('txt-main-profile').innerText = appState.selectedProfile;
    document.getElementById('modal-active-profile').innerText = appState.selectedProfile;
    renderConfigCards();
}

function sortConfigs() {
    appState.configs.sort((a, b) => {
        if (a.topRank !== b.topRank) return a.topRank - b.topRank;
        const rateA = a.testsTotal > 0 ? a.testsOk / a.testsTotal : -1;
        const rateB = b.testsTotal > 0 ? b.testsOk / b.testsTotal : -1;
        if (rateA !== rateB) return rateB - rateA;
        if (a.pingMs !== b.pingMs) return a.pingMs - b.pingMs;
        return a.fileName.localeCompare(b.fileName);
    });
}

function renderConfigCards() {
    sortConfigs();
    const list = document.getElementById('profile-cards-list');
    document.getElementById('modal-configs-count').innerText = `${appState.configs.length} конфигов`;

    list.innerHTML = appState.configs.map(cfg => {
        const isActive = cfg.fileName.toLowerCase() === appState.selectedProfile.toLowerCase();
        const pingStr = cfg.pingMs < 999999 ? `${cfg.pingMs}` : '—';
        const testStr = cfg.testsTotal > 0 ? `${cfg.testsOk}/${cfg.testsTotal}` : 'не проводились';
        const metaInfo = `Пинг: ${pingStr} мс • Тесты: ${testStr}`;

        return `
        <div onclick="selectProfile('${cfg.fileName}')"
             class="p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${isActive ? 'bg-[#172554] border-blue-600' : 'bg-[#18181B] border-zinc-800 hover:bg-zinc-800/80'}">
            <div>
                <div class="flex items-center gap-2.5 mb-1">
                    <span class="font-mono text-sm font-semibold text-emerald-400">${cfg.fileName}</span>
                    ${isActive ? '<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-900 text-blue-300 rounded">активный</span>' : ''}
                </div>
                <div class="text-xs text-zinc-400">${metaInfo}</div>
            </div>
            <span class="text-base font-bold ${isActive ? 'text-blue-400' : 'text-zinc-600'}">${isActive ? '✓' : '→'}</span>
        </div>`;
    }).join('');
}

function selectProfile(fileName) {
    sendCmd('playClick');
    appState.selectedProfile = fileName;
    document.getElementById('txt-main-profile').innerText = fileName;
    document.getElementById('modal-active-profile').innerText = fileName;
    sendCmd('selectProfile', { profile: fileName });
    renderConfigCards();
}

function openConfigModal() {
    sendCmd('playClick');
    renderConfigCards();
    document.getElementById('config-modal').classList.add('open');
}

function closeConfigModal() {
    sendCmd('playClick');
    document.getElementById('config-modal').classList.remove('open');
}

function toggleSmartScan() {
    sendCmd('playClick');
    sendCmd('startScan');
}

function updateScanButtonUI() {
    const icon = document.getElementById('scan-btn-icon');
    const text = document.getElementById('scan-btn-text');
    if (appState.isScanning) {
        icon.innerHTML = '&#xE71A;';
        icon.className = 'mdl-icon text-sm text-[#F44336]';
        text.innerText = 'Остановить тесты';
    } else {
        icon.innerHTML = '&#xE721;';
        icon.className = 'mdl-icon text-sm text-[#A1A1AA]';
        text.innerText = 'Запустить авто-подбор (Smart DPI Scan)';
    }
}

function updateGameFilterBadge(statusText, isEnabled) {
    const el = document.getElementById('txt-gf-status');
    el.innerText = statusText;
    el.className = `text-xs font-mono font-semibold truncate ${isEnabled ? 'text-emerald-400' : 'text-zinc-400'}`;
}

function openGameFilterModal() {
    sendCmd('playClick');
    selectGfMode(appState.gameFilter.mode);
    document.getElementById('gf-tcp-input').value = appState.gameFilter.tcp;
    document.getElementById('gf-udp-input').value = appState.gameFilter.udp;
    document.getElementById('gf-modal').classList.add('open');
}

function closeGameFilterModal() {
    sendCmd('playClick');
    document.getElementById('gf-modal').classList.remove('open');
}

function selectGfMode(mode) {
    appState.gameFilter.mode = mode;
    document.querySelectorAll('.gf-mode-card').forEach(card => {
        const isSelected = card.getAttribute('data-mode') === mode;
        card.className = `gf-mode-card p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${isSelected ? 'bg-[#172554] border-blue-600' : 'bg-[#18181B] border-zinc-800 hover:bg-zinc-800/70'}`;
        const check = card.querySelector('.gf-check');
        check.innerText = isSelected ? '✓' : '→';
        check.className = `gf-check text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-zinc-600'}`;
    });
}

function resetGfPorts() {
    sendCmd('playClick');
    document.getElementById('gf-tcp-input').value = '1024-65535';
    document.getElementById('gf-udp-input').value = '1024-65535';
}

function saveGameFilter() {
    sendCmd('playClick');
    sendCmd('saveGameFilter', {
        mode: appState.gameFilter.mode,
        tcp: document.getElementById('gf-tcp-input').value,
        udp: document.getElementById('gf-udp-input').value,
        restartIfRunning: false
    });
}

function appendLog(time, message, isProgress = false) {
    const box = document.getElementById('log-box');
    const text = `[${time}] ${message}`;

    if (isProgress && lastProgressLogEl) {
        lastProgressLogEl.innerText = text;
        return;
    }

    while (box.children.length >= 250) {
        box.removeChild(box.firstChild);
    }

    const div = document.createElement('div');
    let color = 'text-zinc-400';
    if (message.includes('ОШИБКА') || message.includes('⚠') || message.includes('🛑') || message.includes('❌'))
        color = 'text-red-400 font-bold';
    else if (message.includes('✅') || message.includes('✨') || message.includes('🏆'))
        color = 'text-emerald-400';
    else if (message.includes('🔍'))
        color = 'text-blue-400';

    div.className = color;
    div.innerText = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;

    lastProgressLogEl = isProgress ? div : null;
}

function clearLogs() {
    sendCmd('playClick');
    document.getElementById('log-box').innerHTML = '';
    lastProgressLogEl = null;
}

function exportLogs() {
    sendCmd('playClick');
    const text = Array.from(document.getElementById('log-box').children).map(el => el.innerText).join('\r\n');
    sendCmd('exportLogs', { text });
}

function showAlert(title, message, isError = false) {
    confirmCallback = null;
    isBackendConfirm = false;
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-msg').innerText = message;
    document.getElementById('confirm-cancel-btn').style.display = 'none';
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = 'ОК';
    okBtn.className = `px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition cursor-pointer ${isError ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`;
    document.getElementById('confirm-modal').classList.add('open');
}

function showConfirm(title, message, confirmText, onConfirm, isDanger = false) {
    confirmCallback = onConfirm;
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-msg').innerText = message;
    document.getElementById('confirm-cancel-btn').style.display = 'inline-block';
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = confirmText;
    okBtn.className = `px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition cursor-pointer ${isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`;
    document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirmModal(accepted) {
    sendCmd('playClick');
    document.getElementById('confirm-modal').classList.remove('open');

    if (isBackendConfirm) {
        isBackendConfirm = false;
        sendCmd('confirmResponse', { accepted });
        return;
    }

    if (accepted && confirmCallback) {
        const cb = confirmCallback;
        confirmCallback = null;
        cb();
    }
}

const rxHistory = new Array(30).fill(0);
function updateChart(rxValue) {
    rxHistory.push(rxValue);
    rxHistory.shift();

    const canvas = document.getElementById('traffic-chart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxVal = Math.max(10, ...rxHistory);
    ctx.beginPath();
    ctx.strokeStyle = appState.settings.colorblindMode ? '#0078D7' : '#10B981';
    ctx.lineWidth = 2;

    rxHistory.forEach((val, idx) => {
        const x = (idx / (rxHistory.length - 1)) * canvas.width;
        const y = canvas.height - (val / maxVal) * (canvas.height - 12) - 6;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

let sidebarOpen = true;
function toggleSidebar() {
    sendCmd('playClick');
    sidebarOpen = !sidebarOpen;
    const sb = document.getElementById('sidebar');
    sb.style.width = sidebarOpen ? '224px' : '0px';
    sb.style.padding = sidebarOpen ? '12px' : '0px';
    sb.style.borderRightWidth = sidebarOpen ? '1px' : '0px';
}

function switchTab(tabId, btn) {
    sendCmd('playClick');
    document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => {
        b.className = 'nav-btn flex items-center gap-3 px-4 h-[40px] rounded-md text-sm font-medium text-[#CCCCCC] hover:bg-[#222222] hover:text-white transition-all cursor-pointer';
    });
    btn.className = 'nav-btn active flex items-center gap-3 px-4 h-[40px] rounded-md text-sm font-semibold bg-[#2A2A2A] text-white border-l-[3px] border-[#107C10] transition-all cursor-pointer';
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('titlebar').addEventListener('mousedown', (e) => {
        if (e.target.tagName !== 'BUTTON') sendCmd('windowDrag');
    });

    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener('message', event => {
            const msg = event.data;
            if (msg && msg.type) handleBackendEvent(msg.type, msg.data);
        });
    }

    runSplashSequence();
    sendCmd('init');
});