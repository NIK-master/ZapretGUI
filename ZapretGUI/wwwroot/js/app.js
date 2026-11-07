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
    if (!term) {
        skipSplash();
        return;
    }
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
    if (!el) return;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => { el.style.display = 'none'; }, 450);
}

// =========================================================================
// 2. WIZARD WINDOW 2.0 + ПРОЦЕДУРНЫЙ 3D ASCII ДВИЖОК (TORUS, SHIELD, HELIX, CUBE)
// =========================================================================
let wizardStep = 0;
let wizardFinished = false;
let lastWizProgressEl = null;
let wizCurrentPct = 0;
let wizDownloadPhase = 0;

let wizAsciiTimer = null;
let wizAsciiShape = 0;
let wizPitch = 0.45;
let wizYaw = 0.4;
let wizVelPitch = 0;
let wizVelYaw = 0;
let wizIsDragging = false;
let wizLastMouseX = 0, wizLastMouseY = 0;
let wizHyperSpeed = false;

const ASCII_MODELS = [
    'MODEL: TORUS_REACTOR.3D',
    'MODEL: SHIELD_OCTA.3D',
    'MODEL: NET_HELIX.3D',
    'MODEL: HYPER_CUBE.3D'
];

function startWizAsciiEngine() {
    const stage = document.getElementById('wiz-ascii-stage');
    if (stage) {
        stage.style.letterSpacing = '0px';
        stage.style.lineHeight = '11px';
        stage.style.fontSize = '11px';
    }
    if (wizAsciiTimer) return;
    wizAsciiTimer = setInterval(renderWizAsciiFrame, 33);
}

function stopWizAsciiEngine() {
    if (wizAsciiTimer) {
        clearInterval(wizAsciiTimer);
        wizAsciiTimer = null;
    }
}

function cycleWizAsciiShape() {
    wizAsciiShape = (wizAsciiShape + 1) % 4;
    const lbl = document.getElementById('wiz-ascii-model-name');
    if (lbl) lbl.innerText = ASCII_MODELS[wizAsciiShape];
}

function onWizAsciiMouseDown(e) {
    if (e.button !== 0) return;
    wizIsDragging = true;
    wizLastMouseX = e.clientX;
    wizLastMouseY = e.clientY;
    document.getElementById('wiz-left-panel')?.classList.add('is-dragging');
}

window.addEventListener('mousemove', (e) => {
    if (!wizIsDragging) return;
    const dx = e.clientX - wizLastMouseX;
    const dy = e.clientY - wizLastMouseY;
    wizLastMouseX = e.clientX;
    wizLastMouseY = e.clientY;

    wizYaw += dx * 0.013;
    wizPitch += dy * 0.013;
    wizVelYaw = dx * 0.005;
    wizVelPitch = dy * 0.005;
});

window.addEventListener('mouseup', () => {
    if (wizIsDragging) {
        wizIsDragging = false;
        document.getElementById('wiz-left-panel')?.classList.remove('is-dragging');
    }
});

function renderWizAsciiFrame() {
    const stage = document.getElementById('wiz-ascii-stage');
    if (!stage) return;

    const W = 60, H = 28;
    const output = new Array(W * H).fill(' ');
    const zbuffer = new Array(W * H).fill(0);
    const chars = '.,-~:;=!*#$@';

    if (!wizIsDragging) {
        const speedMult = wizHyperSpeed ? 2.4 : 1.0;
        wizYaw += (0.03 * speedMult) + wizVelYaw;
        wizPitch += (0.014 * speedMult) + wizVelPitch;
        wizVelYaw *= 0.90;
        wizVelPitch *= 0.90;
    }

    const cosY = Math.cos(wizYaw), sinY = Math.sin(wizYaw);
    const cosX = Math.cos(wizPitch), sinX = Math.sin(wizPitch);

    function plotPoint(x, y, z, nx, ny, nz) {
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y;

        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        const depth = z2 + 5.2;
        if (depth <= 0.5) return;
        const ooz = 1 / depth;

        const xp = Math.floor(W / 2 + 42 * ooz * x2);
        const yp = Math.floor(H / 2 - 21 * ooz * y2);

        if (xp < 0 || xp >= W || yp < 0 || yp >= H) return;
        const idx = xp + W * yp;

        if (ooz > zbuffer[idx]) {
            zbuffer[idx] = ooz;

            const nx1 = nx * cosY - nz * sinY;
            const nz1 = nx * sinY + nz * cosY;
            const ny2 = ny * cosX - nz1 * sinX;
            const nz2 = ny * sinX + nz1 * cosX;

            const netLen = Math.hypot(nx1, ny2, nz2) || 1;
            const lum = ((nx1 / netLen) * 0.35 + (ny2 / netLen) * 0.45 - (nz2 / netLen) * 0.75 + 1) * 0.5;
            const cIdx = Math.max(0, Math.min(chars.length - 1, Math.floor(lum * chars.length)));
            output[idx] = chars[cIdx];
        }
    }

    if (wizAsciiShape === 0) {
        const R1 = 0.82, R2 = 1.65;
        for (let theta = 0; theta < 6.28; theta += 0.11) {
            const cost = Math.cos(theta), sint = Math.sin(theta);
            for (let phi = 0; phi < 6.28; phi += 0.045) {
                const cosp = Math.cos(phi), sinp = Math.sin(phi);
                const circleX = R2 + R1 * cost;
                plotPoint(circleX * cosp, circleX * sinp, R1 * sint, cost * cosp, cost * sinp, sint);
            }
        }
    } else if (wizAsciiShape === 1) {
        const S = 1.95;
        const verts = [[0, S, 0], [0, -S, 0], [S, 0, 0], [-S, 0, 0], [0, 0, S], [0, 0, -S]];
        const faces = [[0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4], [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3]];
        faces.forEach(([i0, i1, i2]) => {
            const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];
            const nx = (v0[0] + v1[0] + v2[0]) / 3;
            const ny = (v0[1] + v1[1] + v2[1]) / 3;
            const nz = (v0[2] + v1[2] + v2[2]) / 3;
            for (let u = 0; u <= 1; u += 0.06) {
                for (let v = 0; u + v <= 1; v += 0.06) {
                    const w = 1 - u - v;
                    plotPoint(
                        u * v0[0] + v * v1[0] + w * v2[0],
                        u * v0[1] + v * v1[1] + w * v2[1],
                        u * v0[2] + v * v1[2] + w * v2[2],
                        nx, ny, nz
                    );
                }
            }
        });
    } else if (wizAsciiShape === 2) {
        for (let t = -2.1; t <= 2.1; t += 0.045) {
            const angle = t * 2.1;
            const r = 1.3;
            const x1 = r * Math.cos(angle), z1 = r * Math.sin(angle);
            const x2 = -x1, z2 = -z1;

            for (let a = 0; a < 6.28; a += 0.65) {
                const cr = 0.24;
                plotPoint(x1 + cr * Math.cos(a), t, z1 + cr * Math.sin(a), Math.cos(a), 0, Math.sin(a));
                plotPoint(x2 + cr * Math.cos(a), t, z2 + cr * Math.sin(a), -Math.cos(a), 0, -Math.sin(a));
            }
            if (Math.abs((t * 10) % 4) < 0.45) {
                for (let s = -1; s <= 1; s += 0.1) {
                    plotPoint(x1 * s, t, z1 * s, 0, 1, 0);
                }
            }
        }
    } else {
        const C = 1.35;
        for (let u = -C; u <= C; u += 0.1) {
            for (let v = -C; v <= C; v += 0.1) {
                plotPoint(u, v, C, 0, 0, 1);
                plotPoint(u, v, -C, 0, 0, -1);
                plotPoint(u, C, v, 0, 1, 0);
                plotPoint(u, -C, v, 0, -1, 0);
                plotPoint(C, u, v, 1, 0, 0);
                plotPoint(-C, u, v, -1, 0, 0);
            }
        }
    }

    let lines = '';
    for (let r = 0; r < H; r++) {
        lines += output.slice(r * W, (r + 1) * W).join('') + '\n';
    }
    stage.textContent = lines;
}

function onWizardOptionChange() {
    const zap = document.getElementById('wiz-chk-zapret').checked;
    const prx = document.getElementById('wiz-chk-proxy').checked;
    const aut = document.getElementById('wiz-chk-autostart').checked;
    const foc = document.getElementById('wiz-chk-focus').checked;

    document.getElementById('wiz-card-zapret')?.classList.toggle('selected', zap);
    document.getElementById('wiz-card-proxy')?.classList.toggle('selected', prx);
    document.getElementById('wiz-card-autostart')?.classList.toggle('selected', aut);
    document.getElementById('wiz-card-focus')?.classList.toggle('selected', foc);

    const sumZap = document.getElementById('wiz-sum-zapret');
    const sumPrx = document.getElementById('wiz-sum-proxy');
    const sumAut = document.getElementById('wiz-sum-auto');

    if (sumZap) { sumZap.innerText = zap ? 'ВКЛ' : 'ВЫКЛ'; sumZap.className = zap ? 'text-brand' : 'text-[#777777]'; }
    if (sumPrx) { sumPrx.innerText = prx ? 'ВКЛ' : 'ВЫКЛ'; sumPrx.className = prx ? 'text-brand' : 'text-[#777777]'; }
    if (sumAut) { sumAut.innerText = aut ? 'ВКЛ' : 'ВЫКЛ'; sumAut.className = aut ? 'text-brand' : 'text-[#777777]'; }
}

function openWizardModal() {
    wizardStep = 0;
    wizardFinished = false;
    wizHyperSpeed = false;
    wizCurrentPct = 0;
    wizDownloadPhase = 0;
    const btnNext = document.getElementById('wiz-btn-next');
    if (btnNext) {
        btnNext.disabled = false;
        btnNext.style.opacity = '1';
    }
    onWizardOptionChange();
    updateWizardUI();
    startWizAsciiEngine();
    document.getElementById('wizard-overlay').classList.add('open');
}

function updateWizardUI() {
    for (let i = 0; i < 5; i++) {
        document.getElementById('wiz-step-' + i).classList.toggle('active', i === wizardStep);
        const stepInd = document.getElementById('wstep-ind-' + i);
        if (stepInd) {
            if (i < wizardStep) stepInd.className = 'wiz-stepper-item done';
            else if (i === wizardStep) stepInd.className = 'wiz-stepper-item active';
            else stepInd.className = 'wiz-stepper-item';
        }
    }

    wizAsciiShape = wizardStep < 4 ? wizardStep : 0;
    wizHyperSpeed = (wizardStep === 4 && !wizardFinished);
    const modelLbl = document.getElementById('wiz-ascii-model-name');
    if (modelLbl) modelLbl.innerText = ASCII_MODELS[wizAsciiShape];

    const dots = document.getElementById('wiz-dots');
    dots.innerHTML = [0, 1, 2, 3, 4].map(i =>
        `<span class="w-2 h-2 rounded-full transition-all ${i === wizardStep ? 'bg-[#107C10] scale-125' : 'bg-[#333333]'}"></span>`
    ).join('');

    const btnBack = document.getElementById('wiz-btn-back');
    const btnNext = document.getElementById('wiz-btn-next');
    const btnSkip = document.getElementById('wiz-btn-skip');

    if (wizardStep === 0) {
        btnNext.innerText = 'Начать настройку →';
        btnBack.classList.add('hidden');
        btnSkip.classList.remove('hidden');
    } else if (wizardStep === 3) {
        btnNext.innerText = 'Установить и применить →';
        btnBack.classList.remove('hidden');
        btnSkip.classList.remove('hidden');
    } else if (wizardStep === 4) {
        btnNext.innerText = 'Завершить';
        btnBack.classList.add('hidden');
        btnSkip.classList.add('hidden');
    } else {
        btnNext.innerText = 'Далее →';
        btnBack.classList.remove('hidden');
        btnSkip.classList.remove('hidden');
    }
}

function wizardPrevStep() {
    if (wizardStep > 0 && wizardStep < 4) {
        wizardStep--;
        updateWizardUI();
    }
}

function setWizardProgress(val) {
    wizCurrentPct = Math.max(wizCurrentPct, Math.min(100, Math.round(val)));
    const bar = document.getElementById('wiz-finish-bar');
    const pctEl = document.getElementById('wiz-finish-pct');
    if (bar) bar.style.width = `${wizCurrentPct}%`;
    if (pctEl) pctEl.innerText = `${wizCurrentPct}%`;
}

function wizardNextStep() {
    if (wizardStep === 3) {
        wizardStep = 4;
        wizCurrentPct = 8;
        wizDownloadPhase = 0;
        lastWizProgressEl = null;
        updateWizardUI();

        const btnNext = document.getElementById('wiz-btn-next');
        btnNext.disabled = true;
        btnNext.style.opacity = '0.5';
        document.getElementById('wiz-console-log').innerHTML = '';
        setWizardProgress(8);

        sendCmd('runWizardSetup', {
            useZapret: document.getElementById('wiz-chk-zapret').checked,
            useTgProxy: document.getElementById('wiz-chk-proxy').checked,
            autoStart: document.getElementById('wiz-chk-autostart').checked,
            focusMode: document.getElementById('wiz-chk-focus').checked,
            accentTheme: appState.settings.accentTheme || 'green'
        });
    } else if (wizardStep === 4) {
        if (wizardFinished) {
            stopWizAsciiEngine();
            document.getElementById('wizard-overlay').classList.remove('open');
        }
    } else if (wizardStep < 3) {
        wizardStep++;
        updateWizardUI();
    }
}

function skipWizard() {
    stopWizAsciiEngine();
    sendCmd('skipWizard');
    document.getElementById('wizard-overlay').classList.remove('open');
}

function appendWizardLog(time, message, isProgress) {
    const box = document.getElementById('wiz-console-log');
    const text = `[${time}] ${message}`;

    const wantZapret = document.getElementById('wiz-chk-zapret')?.checked ?? true;
    const wantProxy = document.getElementById('wiz-chk-proxy')?.checked ?? true;
    const bothCores = wantZapret && wantProxy;

    if (message.includes('Поиск последней версии Zapret')) {
        wizDownloadPhase = 1;
        setWizardProgress(15);
    } else if (message.includes('Поиск последней версии TgWsProxy')) {
        wizDownloadPhase = 2;
        setWizardProgress(bothCores ? 58 : 15);
    } else if (message.includes('Распаковка архива')) {
        setWizardProgress(bothCores ? 52 : 90);
    } else if (message.includes('Модули успешно загружены') || message.includes('Настройка успешно завершена')) {
        setWizardProgress(100);
    } else {
        const pctMatch = message.match(/(\d+(?:\.\d+)?)%/);
        if (pctMatch) {
            const rawPct = parseFloat(pctMatch[1]);
            if (bothCores) {
                if (wizDownloadPhase <= 1) {
                    setWizardProgress(15 + rawPct * 0.35);
                } else {
                    setWizardProgress(58 + rawPct * 0.38);
                }
            } else {
                setWizardProgress(15 + rawPct * 0.80);
            }
        }
    }

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
// 3. ГЛОБАЛЬНОЕ СОСТОЯНИЕ И МОСТ PHOTINO / WEBVIEW2
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
        accentTheme: 'green',
        statsUpdateInterval: 1,
        hostsSourceIndex: 2,
        ipSetMode: 'loaded',
        watchdogPingAutoRestart: false
    }
};

let lastProgressLogEl = null;
let confirmCallback = null;
let cancelConfirmCallback = null;
let isBackendConfirm = false;
let selectionCallback = null;

let sessionStartTime = null;
let sessionTimerId = null;
let watchdogFailCount = 0;
let currentLogFilter = 'all';

function sendCmd(action, data = {}) {
    if (!action || action === 'playClick') return;

    const payload = JSON.stringify({ action, ...data });

    if (window.external && typeof window.external.sendMessage === 'function') {
        window.external.sendMessage(payload);
    } else if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(payload);
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

            if (typeof initSettingsFromBackend === 'function') {
                initSettingsFromBackend(data);
            }
            document.body.classList.toggle('compact-mode', !!data.settings.compactMode);

            if (data.settings.skipSplashScreen && !data.isFirstRun) {
                skipSplash();
            }

            appState.batMods = data.batMods || [];
            appState.listMods = data.listMods || [];

            initConfigsList(data.profiles || ['general.bat']);
            if (typeof renderModsView === 'function') renderModsView();
            if (typeof prepareDiagSkeletons === 'function') prepareDiagSkeletons();
            updateGameFilterBadge(data.gameFilterStatus, appState.gameFilter.mode !== 'disabled');
            updateRunningUI(data.zapretRunning, data.proxyRunning);

            if (data.zapretRunning || data.proxyRunning)
                appendLog(new Date().toLocaleTimeString(), 'Интерфейс загружен. Найдены активные процессы в фоне.');
            else
                appendLog(new Date().toLocaleTimeString(), 'Интерфейс загружен. Ожидание команд...');

            if (data.isFirstRun) {
                openWizardModal();
            }
            break;

        case 'wizardLog':
            appendWizardLog(data.time, data.message, data.isProgress);
            break;

        case 'wizardCompleted':
            wizardFinished = true;
            wizHyperSpeed = false;
            wizCurrentPct = 100;
            document.getElementById('wiz-finish-status').innerText = 'Установка успешно завершена!';
            document.getElementById('wiz-finish-status').className = 'text-base font-bold text-brand';
            setWizardProgress(100);
            const btnNext = document.getElementById('wiz-btn-next');
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.innerText = 'Запустить панель →';
            break;

        case 'askConfirm':
            isBackendConfirm = true;
            showConfirm(data.title, data.message, data.confirmText || 'Да', null, data.isDanger);
            break;

        case 'routingStatusUpdated':
            if (typeof updateRoutingStatusUI === 'function') updateRoutingStatusUI(data);
            document.getElementById('btn-update-ipset').innerHTML = '<span class="mdl-icon text-xs text-brand">&#xE149;</span><span>Обновить базу</span>';
            document.getElementById('btn-update-ipset').disabled = false;
            document.getElementById('btn-update-hosts').innerHTML = '<span class="mdl-icon text-xs">&#xE945;</span><span>Обновить</span>';
            document.getElementById('btn-update-hosts').disabled = false;
            break;

        case 'updatesCheckFinished':
            document.getElementById('btn-check-updates').innerHTML = '<span class="mdl-icon text-xs">&#xE149;</span><span>Проверить обновления</span>';
            document.getElementById('btn-check-updates').disabled = false;
            break;

        case 'modsUpdated':
            appState.batMods = data.batMods || [];
            appState.listMods = data.listMods || [];
            initConfigsList(data.profiles || ['general.bat']);
            if (typeof renderModsView === 'function') renderModsView();
            break;

        case 'modIdGenerated':
            document.getElementById('new-mod-id').value = data.id;
            if (typeof updateModIdValidationUI === 'function') updateModIdValidationUI(data.id, false, false);
            break;

        case 'modIdChecked':
            if (typeof updateModIdValidationUI === 'function') updateModIdValidationUI(data.cleanId, data.isTaken, data.isEmpty);
            break;

        case 'modCreated':
            if (typeof closeCreateModModal === 'function') closeCreateModModal();
            break;

        case 'modContentLoaded':
            if (typeof openEditorWithData === 'function') openEditorWithData(data);
            break;

        case 'batValidationResult':
            if (data.isValid) {
                if (typeof setEditorStatus === 'function') setEditorStatus('✓ Синтаксис корректен!', 'text-brand');
            } else {
                if (typeof setEditorStatus === 'function') setEditorStatus('⚠ Ошибка в скрипте', 'text-[#F44336]');
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
            if (typeof closeEditorModal === 'function') closeEditorModal();
            break;

        case 'promptRestartZapret':
            showConfirm(
                'Перезапустить Zapret?',
                `${data.reason}\n\nФайл list-general.txt был обновлен в прямом эфире, но для применения новых доменов в уже работающем ядре winws.exe требуется перезапуск. Перезапустить сейчас?`,
                'Перезапустить',
                () => sendCmd('restartBypass')
            );
            break;

        case 'diagProgress':
            document.getElementById('diag-status-txt').innerText = data.status;
            document.getElementById('diag-progress-bar').style.width = `${data.progress}%`;
            if (typeof updateDiagStepPills === 'function') {
                updateDiagStepPills(data.progress, data.status);
            }
            break;

        case 'diagResult':
            if (typeof renderDiagnosticsReport === 'function') renderDiagnosticsReport(data);
            updateRadarNodesFromReport(data);
            break;

        case 'log':
            appendLog(data.time, data.message, data.isProgress);
            break;

        case 'netStats':
            document.getElementById('stat-rx').innerText = data.download.toFixed(1);
            document.getElementById('stat-tx').innerText = data.upload.toFixed(1);
            updateChart(data.download, data.upload);
            updateRunningUI(data.zapretRunning, data.proxyRunning);
            break;

        case 'netStatus':
            document.getElementById('dot-net').className = `w-2 h-2 rounded-full ${data.isOnline ? 'dot-online' : 'dot-offline'}`;
            break;

        case 'pingResult':
            document.getElementById('ping-refresh-icon').classList.remove('spin-anim');
            appState.currentPing = data.ping;
            updatePingDisplay(data.ping);
            document.getElementById('dot-net').className = `w-2 h-2 rounded-full ${data.ping >= 0 ? 'dot-online' : 'dot-offline'}`;
            appState.configs.forEach(c => c.pingMs = data.ping > 0 ? data.ping : 999999);
            renderConfigCards();

            if (appState.isRunning && appState.settings.watchdogPingAutoRestart) {
                if (data.ping < 0) {
                    watchdogFailCount++;
                    if (watchdogFailCount >= 3) {
                        watchdogFailCount = 0;
                        appendLog(new Date().toLocaleTimeString(), '🐕 [Ping-Watchdog] Обнаружена потеря пинга. Автоматический перезапуск служб...');
                        sendCmd('restartBypass');
                    }
                } else {
                    watchdogFailCount = 0;
                }
            }
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

        case 'scanFailed':
            appState.isScanning = false;
            updateScanButtonUI();
            appendLog(new Date().toLocaleTimeString(), `❌ Ошибка сканера: ${data.error}`);
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

        case 'profileSelected':
            appState.selectedProfile = data.profile;
            document.getElementById('txt-main-profile').innerText = data.profile;
            document.getElementById('modal-active-profile').innerText = data.profile;
            renderConfigCards();
            break;

        case 'toggleCommandPalette':
            toggleCommandPaletteModal();
            break;
    }
}

// =========================================================================
// 4. ЛОГИКА ВКЛАДКИ 1: ГЛАВНАЯ (HOMEVIEW)
// =========================================================================
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
// 5. ВЫБОР КОНФИГОВ ZAPRET (.BAT) И ИГРОВОГО ФИЛЬТРА
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
// 6. ДВУХКАНАЛЬНЫЙ ГРАФИК ТРАФИКА
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
// 7. ЖУРНАЛ СОБЫТИЙ
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

    // Удаляем самые старые строки, если лог перевалил за лимит
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

// =========================================================================
// 8. НАВИГАЦИЯ И ДИАЛОГИ
// =========================================================================
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('rail-mode');
}

function switchTab(tabId, btnEl) {
    document.querySelectorAll('.tab-view').forEach(sec => sec.classList.remove('active'));
    document.getElementById('tab-' + tabId)?.classList.add('active');

    const navBtns = document.querySelectorAll('#sidebar-nav .nav-btn');
    navBtns.forEach(b => {
        b.classList.remove('active', 'font-semibold', 'text-white');
        b.classList.add('font-medium', 'text-[#CCCCCC]');
        const ico = b.querySelector('.mdl-icon');
        if (ico) {
            ico.classList.remove('text-brand', 'text-[#4CAF50]');
            ico.classList.add('text-[#888888]');
        }
    });

    const targetBtn = btnEl || Array.from(navBtns).find(b => b.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (targetBtn) {
        targetBtn.classList.add('active', 'font-semibold', 'text-white');
        targetBtn.classList.remove('font-medium', 'text-[#CCCCCC]');
        const ico = targetBtn.querySelector('.mdl-icon');
        if (ico) {
            ico.classList.remove('text-[#888888]');
            ico.classList.add('text-brand');
        }

        const pill = document.getElementById('sidebar-active-pill');
        if (pill) {
            pill.style.transform = `translateY(${targetBtn.offsetTop}px)`;
        }
    }

    if (tabId === 'mods') {
        requestAnimationFrame(() => updateModsSlidingPill());
    } else if (tabId === 'settings') {
        requestAnimationFrame(() => {
            const activeSetBtn = document.querySelector('.set-cat-btn.active');
            if (activeSetBtn) updateSettingsSlidingPill(activeSetBtn);
        });
    }
}

function showAlert(title, message, isError = false) {
    isBackendConfirm = false;
    confirmCallback = null;
    cancelConfirmCallback = null;

    document.getElementById('confirm-title').innerText = title || 'Уведомление';
    document.getElementById('confirm-title').className = `text-base font-bold mb-2 ${isError ? 'text-[#F44336]' : 'text-white'}`;
    document.getElementById('confirm-msg').innerText = message || '';
    document.getElementById('confirm-cancel-btn').classList.add('hidden');

    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = 'ОК';
    okBtn.className = 'px-4 py-1.5 rounded-md btn-brand text-xs font-semibold cursor-pointer';

    document.getElementById('confirm-modal').classList.add('open');
}

function showConfirm(title, message, confirmText = 'Да', onAccept = null, isDanger = false, onCancel = null) {
    confirmCallback = onAccept;
    cancelConfirmCallback = onCancel;

    document.getElementById('confirm-title').innerText = title || 'Подтверждение';
    document.getElementById('confirm-title').className = 'text-base font-bold text-white mb-2';
    document.getElementById('confirm-msg').innerText = message || '';
    document.getElementById('confirm-cancel-btn').classList.remove('hidden');

    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = confirmText;
    okBtn.className = isDanger
        ? 'px-4 py-1.5 rounded-md bg-[#D13438] hover:bg-[#B8282C] text-white text-xs font-semibold cursor-pointer transition'
        : 'px-4 py-1.5 rounded-md btn-brand text-xs font-semibold cursor-pointer';

    document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirmModal(accepted) {
    document.getElementById('confirm-modal').classList.remove('open');

    if (isBackendConfirm) {
        isBackendConfirm = false;
        sendCmd('confirmResponse', { accepted });
        return;
    }

    if (accepted && typeof confirmCallback === 'function') {
        const cb = confirmCallback;
        confirmCallback = null;
        cb();
    } else if (!accepted && typeof cancelConfirmCallback === 'function') {
        const ccb = cancelConfirmCallback;
        cancelConfirmCallback = null;
        ccb();
    }
}

function openSelectionModal(subTitle, title, options, currentVal, onSelect) {
    selectionCallback = onSelect;
    document.getElementById('sel-modal-sub').innerText = subTitle;
    document.getElementById('sel-modal-title').innerText = title;

    const list = document.getElementById('sel-modal-list');
    list.innerHTML = options.map((opt, idx) => {
        const isSel = String(opt.value) === String(currentVal);
        return `
            <div onclick="chooseSelectionOption(${idx})"
                 class="p-3 rounded-lg border cursor-pointer flex items-center justify-between transition ${isSel ? 'bg-[#0F240F] border-[#107C10]' : 'bg-[#181818] border-[#262626] hover:bg-[#222222]'}">
                <div class="pr-3">
                    <div class="text-xs font-bold ${isSel ? 'text-brand' : 'text-white'}">${opt.title}</div>
                    <div class="text-[11px] text-[#888888] mt-0.5">${opt.desc}</div>
                </div>
                <span class="text-sm font-bold ${isSel ? 'text-brand' : 'text-[#555555]'}">${isSel ? '✓' : '→'}</span>
            </div>
        `;
    }).join('');

    list._options = options;
    document.getElementById('selection-modal').classList.add('open');
}

function chooseSelectionOption(idx) {
    const list = document.getElementById('sel-modal-list');
    const opt = list._options?.[idx];
    document.getElementById('selection-modal').classList.remove('open');
    if (opt && typeof selectionCallback === 'function') {
        selectionCallback(opt.value);
    }
}

function closeSelectionModal() {
    document.getElementById('selection-modal').classList.remove('open');
}

// =========================================================================
// 9. COMMAND PALETTE (CTRL + K)
// =========================================================================
let cmdSelectedIndex = 0;
let filteredCommands = [];

function getCommandPaletteItems() {
    const base = [
        { title: appState.isRunning ? 'Остановить обход блокировок' : 'Включить обход блокировок', cat: 'Управление', icon: '&#xE7E8;', run: () => onMainToggleClick() },
        { title: 'Перезапустить службы Zapret и Proxy', cat: 'Управление', icon: '&#xE777;', run: () => sendCmd('restartBypass') },
        { title: 'Авто-подбор лучшего конфига (Smart DPI Scan)', cat: 'Сканер', icon: '&#xE721;', run: () => { openConfigModal(); toggleSmartScan(); } },
        { title: 'Запустить полную диагностику сети', cat: 'Диагностика', icon: '&#xE9D9;', run: () => { switchTab('diag'); runDiagnostics(); } },
        { title: 'Настроить Игровой фильтр (Game Filter)', cat: 'Игры', icon: '&#xE7FC;', run: () => openGameFilterModal() },
        { title: 'Создать новую модификацию (.bat / список)', cat: 'Мастерская', icon: '&#xE710;', run: () => { switchTab('mods'); openCreateModModal(); } },
        { title: 'Выгрузить драйвер WinDivert (для античитов)', cat: 'Система', icon: '&#xEA18;', run: () => sendCmd('unloadWinDivert') },
        { title: 'Подключить прокси в Telegram Desktop (1 клик)', cat: 'Telegram', icon: '&#xE709;', run: () => sendCmd('connectTelegramProxy') },
        { title: 'Обновить системный файл Hosts', cat: 'Маршруты', icon: '&#xE8B7;', run: () => updateSystemHosts() },
        { title: 'Экспортировать резервную копию настроек', cat: 'Бэкап', icon: '&#xE78C;', run: () => sendCmd('exportConfigBackup') },
        { title: 'Перейти: Главная панель', cat: 'Навигация', icon: '&#xE80F;', run: () => switchTab('home') },
        { title: 'Перейти: Мастерская модификаций', cat: 'Навигация', icon: '&#xE74C;', run: () => switchTab('mods') },
        { title: 'Перейти: Настройки системы', cat: 'Навигация', icon: '&#xE713;', run: () => switchTab('settings') }
    ];

    appState.configs.forEach(c => {
        base.push({
            title: `Профиль: ${c.fileName}`,
            cat: 'Конфиг .bat',
            icon: '&#xE756;',
            run: () => selectProfile(c.fileName)
        });
    });

    return base;
}

function toggleCommandPaletteModal() {
    const modal = document.getElementById('cmd-palette-modal');
    if (modal && modal.classList.contains('open')) closeCommandPalette();
    else openCommandPalette();
}

function openCommandPalette() {
    const input = document.getElementById('cmd-palette-input');
    if (input) input.value = '';
    cmdSelectedIndex = 0;
    renderCommandPaletteList();
    document.getElementById('cmd-palette-modal').classList.add('open');
    setTimeout(() => input?.focus(), 40);
}

function closeCommandPalette() {
    document.getElementById('cmd-palette-modal').classList.remove('open');
}

function renderCommandPaletteList() {
    const q = (document.getElementById('cmd-palette-input')?.value || '').trim().toLowerCase();
    const all = getCommandPaletteItems();
    filteredCommands = all.filter(item => !q || item.title.toLowerCase().includes(q) || item.cat.toLowerCase().includes(q));
    cmdSelectedIndex = Math.max(0, Math.min(cmdSelectedIndex, filteredCommands.length - 1));

    const list = document.getElementById('cmd-palette-list');
    if (!list) return;

    if (filteredCommands.length === 0) {
        list.innerHTML = `<div class="p-4 text-center text-xs text-[#666666]">Ничего не найдено</div>`;
        return;
    }

    list.innerHTML = filteredCommands.map((item, idx) => {
        const active = idx === cmdSelectedIndex;
        return `
            <div onclick="executeCommandPaletteItem(${idx})"
                 onmouseenter="cmdSelectedIndex=${idx}; renderCommandPaletteList()"
                 class="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition ${active ? 'bg-[#0F240F] border border-[#107C10]' : 'border border-transparent hover:bg-[#1C1C1C]'}">
                <div class="flex items-center gap-2.5 overflow-hidden">
                    <span class="mdl-icon text-xs ${active ? 'text-brand' : 'text-[#888888]'}">${item.icon}</span>
                    <span class="text-xs font-medium text-white truncate">${item.title}</span>
                </div>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181818] text-[#888888] shrink-0">${item.cat}</span>
            </div>
        `;
    }).join('');
}

function onCommandPaletteKeyDown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredCommands.length > 0) {
            cmdSelectedIndex = (cmdSelectedIndex + 1) % filteredCommands.length;
            renderCommandPaletteList();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredCommands.length > 0) {
            cmdSelectedIndex = (cmdSelectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
            renderCommandPaletteList();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeCommandPaletteItem(cmdSelectedIndex);
    } else if (e.key === 'Escape') {
        closeCommandPalette();
    }
}

function executeCommandPaletteItem(idx) {
    const item = filteredCommands[idx];
    closeCommandPalette();
    if (item && typeof item.run === 'function') {
        item.run();
    }
}

// =========================================================================
// 10. ФИКСЫ СЛАЙДЯЩИХ ПЛАШЕК, ПОИСКА И СОХРАНЕНИЯ НАСТРОЕК
// =========================================================================
function updateModsSlidingPill() {
    const pill = document.getElementById('mods-seg-pill');
    const activeBtn = document.querySelector('#mods-seg-track .mods-seg-btn.active') ||
        document.getElementById('mod-tab-' + (appState.modsSubTab || 'bat'));
    if (!pill || !activeBtn) return;

    pill.style.width = `${activeBtn.offsetWidth}px`;
    pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

function updateSettingsSlidingPill(targetBtn) {
    const pill = document.getElementById('settings-seg-pill');
    const btn = targetBtn || document.querySelector('#settings-seg-track .set-cat-btn.active');
    if (!pill || !btn) return;

    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function filterSettingsView() {
    const query = (document.getElementById('settings-search-input')?.value || '').trim().toLowerCase();
    const activeCatBtn = document.querySelector('#settings-seg-track .set-cat-btn.active');
    const currentCat = window.currentSettingsCat || (activeCatBtn?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'all');

    const groups = document.querySelectorAll('#tab-settings [data-set-group]');
    groups.forEach(group => {
        const groupCat = group.getAttribute('data-set-group');
        const catMatches = (currentCat === 'all' || currentCat === groupCat);

        if (!catMatches) {
            group.classList.add('hidden');
            return;
        }

        if (!query) {
            group.classList.remove('hidden');
            group.querySelectorAll('[data-search]').forEach(item => item.classList.remove('hidden'));
            group.querySelectorAll('.glass-card').forEach(card => card.classList.remove('hidden'));
            const routingGrid = group.querySelector('#settings-routing-grid');
            if (routingGrid) routingGrid.classList.remove('hidden');
            return;
        }

        const innerCards = group.classList.contains('glass-card') ? [group] : Array.from(group.querySelectorAll('.glass-card'));
        let anyVisibleInGroup = false;

        innerCards.forEach(card => {
            const searchableItems = card.querySelectorAll('[data-search]');
            let visibleInCard = 0;

            searchableItems.forEach(item => {
                const hay = (item.getAttribute('data-search') + ' ' + item.innerText).toLowerCase();
                const match = hay.includes(query);
                item.classList.toggle('hidden', !match);
                if (match) visibleInCard++;
            });

            const routingGrid = card.querySelector('#settings-routing-grid');
            if (routingGrid) {
                const visRouting = routingGrid.querySelectorAll('[data-search]:not(.hidden)').length;
                routingGrid.classList.toggle('hidden', visRouting === 0);
            }

            card.classList.toggle('hidden', visibleInCard === 0);
            if (visibleInCard > 0) anyVisibleInGroup = true;
        });

        group.classList.toggle('hidden', !anyVisibleInGroup);
    });
}

let settingsSaveToastTimer = null;
function onSettingsChanged() {
    const compact = document.getElementById('set-compact-mode')?.checked ?? false;
    const focus = document.getElementById('set-focus-mode')?.checked ?? false;
    const watchdog = document.getElementById('set-watchdog-ping')?.checked ?? false;

    appState.settings.compactMode = compact;
    appState.settings.focusMode = focus;
    appState.settings.watchdogPingAutoRestart = watchdog;

    document.body.classList.toggle('compact-mode', compact);

    const payload = {
        autoStart: document.getElementById('set-autostart')?.checked ?? false,
        autoStartBypass: document.getElementById('set-autostart-bypass')?.checked ?? false,
        startMinimized: document.getElementById('set-start-minimized')?.checked ?? false,
        minimizeOnClose: document.getElementById('set-minimize-close')?.checked ?? true,
        stopServicesOnExit: document.getElementById('set-stop-on-exit')?.checked ?? true,
        notificationsEnabled: document.getElementById('set-notifications')?.checked ?? true,
        alwaysOnTop: document.getElementById('set-always-on-top')?.checked ?? false,
        soundEffectsEnabled: document.getElementById('set-sound-effects')?.checked ?? true,
        skipSplashScreen: document.getElementById('set-skip-splash')?.checked ?? false,
        compactMode: compact,
        focusMode: focus,
        hardwareAcceleration: document.getElementById('set-hw-accel')?.checked ?? true,
        pingUrl: document.getElementById('set-ping-url')?.value?.trim() || 'https://dynamodb.eu-central-1.amazonaws.com',
        statsUpdateInterval: appState.settings.statsUpdateInterval || 1,
        autoRestartServices: document.getElementById('set-autorestart')?.checked ?? false,
        watchdogPingAutoRestart: watchdog,
        accentTheme: appState.settings.accentTheme || 'green',
        hostsSourceIndex: appState.settings.hostsSourceIndex ?? 2
    };

    sendCmd('saveSettings', { settings: payload });

    const toast = document.getElementById('settings-save-toast');
    if (toast) {
        toast.style.opacity = '1';
        clearTimeout(settingsSaveToastTimer);
        settingsSaveToastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1600);
    }

    setTimeout(() => {
        updateModsSlidingPill();
        updateSettingsSlidingPill();
    }, 60);
}

// =========================================================================
// 11. ИНТЕРАКТИВНЫЙ РАДАР И ГРАФ СЕТИ (NODE GRAPH RADAR) ДЛЯ ДИАГНОСТИКИ
// =========================================================================
let diagViewMode = 'radar';
let diagRadarAnimId = null;
let diagRadarAngle = 0;
let diagRadarNodes = [];
let diagHoveredNode = null;

let diagRadarLastTime = 0;

function onDiagRadarMouseMove(e) {
    const canvas = document.getElementById('diag-radar-canvas');
    const tooltip = document.getElementById('diag-radar-tooltip');
    if (!canvas || !tooltip) return;

    const rect = canvas.getBoundingClientRect();
    // Координаты узлов теперь хранятся в чистых CSS-пикселях (логических)
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = null;
    for (const n of diagRadarNodes) {
        if (n._px != null && Math.hypot(mx - n._px, my - n._py) < 22) {
            found = n;
            break;
        }
    }

    diagHoveredNode = found;
    if (found) {
        tooltip.classList.remove('hidden');
        tooltip.innerHTML = `
            <div class="font-bold text-brand mb-0.5">${found.label}</div>
            <div class="text-[10px] text-[#888888] mb-1">${found.sub}</div>
            <div class="whitespace-pre-line text-[11px] text-[#E0E0E0]">${found.details}</div>
        `;
        const leftPx = Math.min(rect.width - 185, Math.max(8, mx + 14));
        const topPx = Math.min(rect.height - 95, Math.max(8, my - 10));
        tooltip.style.left = `${leftPx}px`;
        tooltip.style.top = `${topPx}px`;
    } else {
        tooltip.classList.add('hidden');
    }
}

function startDiagRadarLoop() {
    if (diagRadarAnimId) return;
    diagRadarLastTime = performance.now();

    function frame(now) {
        const dt = Math.min(0.05, Math.max(0.001, (now - diagRadarLastTime) / 1000));
        diagRadarLastTime = now;
        try { drawDiagRadarFrame(dt, now); } catch (e) { }
        diagRadarAnimId = requestAnimationFrame(frame);
    }
    diagRadarAnimId = requestAnimationFrame(frame);
}

function drawDiagRadarFrame(dt = 0.016, now = performance.now()) {
    const canvas = document.getElementById('diag-radar-canvas');
    if (!canvas || canvas.offsetParent === null) return;

    // 1. Честный HiDPI-скейлинг под физические пиксели монитора
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 20 || h < 20) return;

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

    // Округляем центр до .5px для идеально звонких однопиксельных линий
    const cx = Math.floor(w / 2) + 0.5;
    const cy = Math.floor(h / 2 + 6) + 0.5;
    const maxR = Math.min(w * 0.42, h * 0.43);

    const accentHex = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    const isScanningNow = !document.getElementById('diag-progress-wrap')?.classList.contains('hidden');

    // 2. Сетка радара и кольца дальности
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 1;
    [0.35, 0.65, 0.95].forEach(rMult => {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.round(maxR * rMult), 0, Math.PI * 2);
        ctx.stroke();
    });

    ctx.beginPath();
    ctx.moveTo(cx - maxR * 1.15, cy);
    ctx.lineTo(cx + maxR * 1.15, cy);
    ctx.moveTo(cx, cy - maxR * 0.98);
    ctx.lineTo(cx, cy + maxR * 0.98);
    ctx.stroke();

    // 3. Плавное вращение сканирующего луча (независимо от герцовки монитора: 60/144/240Hz)
    // В обычном режиме: ~0.42 рад/сек (~15 сек на полный оборот), при сканировании: ~1.35 рад/сек
    const angularSpeed = isScanningNow ? 1.35 : 0.42;
    diagRadarAngle = (diagRadarAngle + angularSpeed * dt) % (Math.PI * 2);

    // Мягкий градиентный шлейф луча из 6 сегментов + тонкая ведущая линия
    const sweepArc = 0.52;
    const slices = 6;
    ctx.save();
    for (let s = 0; s < slices; s++) {
        const a0 = diagRadarAngle - sweepArc + (s / slices) * sweepArc;
        const a1 = diagRadarAngle - sweepArc + ((s + 1) / slices) * sweepArc + 0.005;
        const alphaHex = isScanningNow
            ? Math.round(((s + 1) / slices) * 36).toString(16).padStart(2, '0')
            : Math.round(((s + 1) / slices) * 16).toString(16).padStart(2, '0');

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR * 0.98, a0, a1);
        ctx.closePath();
        ctx.fillStyle = accentHex.startsWith('#') ? (accentHex + alphaHex) : `rgba(76, 175, 80, ${isScanningNow ? 0.12 : 0.05})`;
        ctx.fill();
    }

    // Ведущая стрелка луча
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(diagRadarAngle) * maxR * 0.98, cy + Math.sin(diagRadarAngle) * maxR * 0.98);
    ctx.strokeStyle = accentHex.startsWith('#') ? (accentHex + '66') : 'rgba(76, 175, 80, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 4. Линии связи и спокойное движение пакетов (0.28 цикла в секунду вместо бешеного мелькания)
    const pulseTime = now * 0.00028;

    diagRadarNodes.forEach((node, idx) => {
        const nx = cx + Math.cos(node.angle) * (maxR * 1.75 * node.radius);
        const ny = cy + Math.sin(node.angle) * (maxR * 0.92 * node.radius);
        node._px = nx;
        node._py = ny;

        let col = '#44444A';
        if (node.status === 'ok') col = accentHex;
        else if (node.status === 'warn') col = '#F59E0B';
        else if (node.status === 'fail') col = '#D13438';
        else if (isScanningNow) col = '#3B82F6';

        ctx.save();
        ctx.beginPath();
        if (node.status === 'fail') {
            ctx.setLineDash([4, 5]);
            ctx.strokeStyle = 'rgba(209, 52, 56, 0.35)';
        } else if (node.status === 'ok' || node.status === 'warn') {
            ctx.strokeStyle = col + '55';
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        }
        ctx.lineWidth = diagHoveredNode === node ? 2.0 : 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.restore();

        if (node.status === 'ok' || node.status === 'warn' || isScanningNow) {
            const p = (pulseTime + idx * 0.19) % 1;
            const px = cx + (nx - cx) * p;
            const py = cy + (ny - cy) * p;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(px, py, 2.3, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // 5. Центральный хаб YOU
    ctx.fillStyle = '#141418';
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px "Segoe UI", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU', cx, cy + 0.5);

    // 6. Узлы Telegram DC и Discord
    diagRadarNodes.forEach(node => {
        const nx = node._px;
        const ny = node._py;
        const isHov = diagHoveredNode === node;

        let col = '#52525B';
        let glow = 'transparent';
        if (node.status === 'ok') { col = accentHex; glow = accentHex + '44'; }
        else if (node.status === 'warn') { col = '#F59E0B'; glow = 'rgba(245, 158, 11, 0.30)'; }
        else if (node.status === 'fail') { col = '#D13438'; glow = 'rgba(209, 52, 56, 0.25)'; }
        else if (isScanningNow) { col = '#60A5FA'; glow = 'rgba(96, 165, 250, 0.28)'; }

        if (node.status === 'ok' || isHov) {
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(nx, ny, isHov ? 18 : 14, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#121216';
        ctx.strokeStyle = col;
        ctx.lineWidth = isHov ? 2.2 : 1.6;
        ctx.beginPath();
        ctx.arc(nx, ny, isHov ? 10.5 : 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(nx, ny, node.status === 'fail' ? 2.5 : 3.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = node.status === 'fail' ? '#999999' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, nx, ny - 16);

        if (node.ping != null) {
            ctx.font = '600 10px Consolas, monospace';
            ctx.fillStyle = col;
            ctx.fillText(`${node.ping} мс`, nx, ny + 18);
        } else if (node.status === 'fail') {
            ctx.font = '600 9.5px Consolas, monospace';
            ctx.fillStyle = '#F87171';
            ctx.fillText('LOSS', nx, ny + 18);
        }
    });

    ctx.restore();
}


// =========================================================================
// 12. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ DOM
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    // 1. Сразу запускаем матричный терминал загрузки (и ставим страховочный таймер)
    runSplashSequence().catch(() => skipSplash());
    setTimeout(() => {
        if (!splashSkipped) skipSplash();
    }, 6500);

    // 2. Подключаем мост Photino.NET / WebView2
    if (window.external && typeof window.external.receiveMessage === 'function') {
        window.external.receiveMessage(rawMsg => {
            try {
                const msg = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
                if (msg && msg.type) {
                    handleBackendEvent(msg.type, msg.data);
                }
            } catch (e) {
                console.error('Ошибка Photino message:', e);
            }
        });
    } else if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener('message', e => {
            try {
                const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (msg && msg.type) {
                    handleBackendEvent(msg.type, msg.data);
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    if (typeof window.runDiagnostics === 'function') {
        const origRunDiag = window.runDiagnostics;
        window.runDiagnostics = function () {
            buildDefaultRadarNodes();
            origRunDiag();
        };
    }

    try {
        initDiagnosticsRadarView();
    } catch (e) {
        console.error('Radar init error:', e);
    }

    window.addEventListener('resize', () => {
        updateModsSlidingPill();
        updateSettingsSlidingPill();
    });

    // 4. Перетаскивание окна за шапку
    ['titlebar', 'wizard-titlebar'].forEach(id => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.addEventListener('mousedown', e => {
                if (e.button === 0 && !e.target.closest('button') && !e.target.closest('input')) {
                    sendCmd('windowDrag');
                }
            });
        }
    });

    // 5. Глобальный перехват Ctrl+K
    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
            e.preventDefault();
            e.stopPropagation();
            toggleCommandPaletteModal();
        }
    }, true);

    // 6. Drag & Drop файлов
    const dropOverlay = document.getElementById('dropzone-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        if (dropOverlay) {
            dropOverlay.classList.remove('hidden');
            dropOverlay.classList.add('flex');
        }
    });

    window.addEventListener('dragleave', e => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (dropOverlay) {
                dropOverlay.classList.add('hidden');
                dropOverlay.classList.remove('flex');
            }
        }
    });

    window.addEventListener('dragover', e => e.preventDefault());

    window.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        if (dropOverlay) {
            dropOverlay.classList.add('hidden');
            dropOverlay.classList.remove('flex');
        }

        const file = e.dataTransfer?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = String(reader.result).split(',')[1] || '';
            sendCmd('importDroppedFile', { fileName: file.name, base64 });
        };
        reader.readAsDataURL(file);
    });

    drawChart();
    sendCmd('init');
});