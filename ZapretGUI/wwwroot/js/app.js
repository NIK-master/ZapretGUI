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
// 2. WIZARD WINDOW 2.0 + ПРОЦЕДУРНЫЙ 3D ASCII ДВИЖОК (TORUS, SHIELD, HELIX, CUBE)
// =========================================================================
let wizAsciiTimer = null;
let wizAsciiShape = 0; // 0: Torus, 1: Octahedron Shield, 2: DNA Network Helix, 3: Cyber Cube
let wizPitch = 0.45;   // Наклон вверх-вниз (вокруг оси X)
let wizYaw = 0.4;      // Поворот влево-вправо (вокруг оси Y)
let wizVelPitch = 0;   // Инерция по вертикали
let wizVelYaw = 0;     // Инерция по горизонтали
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
    if (wizAsciiTimer) return;
    wizAsciiTimer = setInterval(renderWizAsciiFrame, 33); // ~30 FPS
}

function stopWizAsciiEngine() {
    if (wizAsciiTimer) {
        clearInterval(wizAsciiTimer);
        wizAsciiTimer = null;
    }
}

function cycleWizAsciiShape() {
    sendCmd('playClick');
    wizAsciiShape = (wizAsciiShape + 1) % 4;
    const lbl = document.getElementById('wiz-ascii-model-name');
    if (lbl) lbl.innerText = ASCII_MODELS[wizAsciiShape];
}

// Захват 3D-модели только при зажатии ЛКМ
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

    // Крутим строго в сторону движения мыши:
    // Мышь вправо (dx > 0) -> передняя грань идет вправо (Yaw+)
    // Мышь вниз (dy > 0)   -> передняя грань идет вниз (Pitch+)
    wizYaw += dx * 0.013;
    wizPitch += dy * 0.013;

    // Запоминаем скорость для плавной инерции после отпускания мыши
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

    const W = 58, H = 30;
    const output = new Array(W * H).fill(' ');
    const zbuffer = new Array(W * H).fill(0);
    const chars = '.,-~:;=!*#$@';

    if (!wizIsDragging) {
        const speedMult = wizHyperSpeed ? 2.8 : 1.0;
        // Плавное авто-вращение + затухающая инерция после броска мышкой
        wizYaw += (0.032 * speedMult) + wizVelYaw;
        wizPitch += (0.014 * speedMult) + wizVelPitch;
        wizVelYaw *= 0.90;
        wizVelPitch *= 0.90;
    }

    const cosY = Math.cos(wizYaw), sinY = Math.sin(wizYaw);
    const cosX = Math.cos(wizPitch), sinX = Math.sin(wizPitch);

    function plotPoint(x, y, z, nx, ny, nz) {
        // 1. Вращение вокруг вертикальной оси Y (Yaw — влево/вправо за мышкой)
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y;

        // 2. Вращение вокруг горизонтальной оси X (Pitch — вверх/вниз за мышкой)
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        const depth = z2 + 5.0;
        if (depth <= 0.5) return;
        const ooz = 1 / depth;

        // Экранные координаты: X вправо, Y вверх (в консоль вниз)
        const xp = Math.floor(W / 2 + 34 * ooz * x2);
        const yp = Math.floor(H / 2 - 17 * ooz * y2);

        if (xp < 0 || xp >= W || yp < 0 || yp >= H) return;
        const idx = xp + W * yp;

        if (ooz > zbuffer[idx]) {
            zbuffer[idx] = ooz;

            // Поворачиваем нормали для реалистичного блика света
            const nx1 = nx * cosY - nz * sinY;
            const nz1 = nx * sinY + nz * cosY;
            const ny2 = ny * cosX - nz1 * sinX;
            const nz2 = ny * sinX + nz1 * cosX;

            const lum = (nx1 * 0.35 + ny2 * 0.45 - nz2 * 0.75 + 1) * 0.5;
            const cIdx = Math.max(0, Math.min(chars.length - 1, Math.floor(lum * chars.length)));
            output[idx] = chars[cIdx];
        }
    }

    if (wizAsciiShape === 0) {
        // 0. Классический 3D Тор (Donut Reactor)
        const R1 = 0.85, R2 = 1.75;
        for (let theta = 0; theta < 6.28; theta += 0.13) {
            const cost = Math.cos(theta), sint = Math.sin(theta);
            for (let phi = 0; phi < 6.28; phi += 0.055) {
                const cosp = Math.cos(phi), sinp = Math.sin(phi);
                const circleX = R2 + R1 * cost;
                plotPoint(
                    circleX * cosp,
                    circleX * sinp,
                    R1 * sint,
                    cost * cosp,
                    cost * sinp,
                    sint
                );
            }
        }
    } else if (wizAsciiShape === 1) {
        // 1. 3D Кристалл / Октаэдр защиты (Privacy Shield)
        const S = 2.05;
        const verts = [
            [0, S, 0], [0, -S, 0], [S, 0, 0], [-S, 0, 0], [0, 0, S], [0, 0, -S]
        ];
        const faces = [
            [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
            [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3]
        ];
        faces.forEach(([i0, i1, i2]) => {
            const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];
            const nx = (v0[0] + v1[0] + v2[0]) / 3;
            const ny = (v0[1] + v1[1] + v2[1]) / 3;
            const nz = (v0[2] + v1[2] + v2[2]) / 3;
            for (let u = 0; u <= 1; u += 0.07) {
                for (let v = 0; u + v <= 1; v += 0.07) {
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
        // 2. Двойная сетевая спираль (Network DNA Helix)
        for (let t = -2.2; t <= 2.2; t += 0.05) {
            const angle = t * 2.2;
            const r = 1.35;
            const x1 = r * Math.cos(angle), z1 = r * Math.sin(angle);
            const x2 = -x1, z2 = -z1;

            for (let a = 0; a < 6.28; a += 0.7) {
                const cr = 0.24;
                plotPoint(x1 + cr * Math.cos(a), t, z1 + cr * Math.sin(a), Math.cos(a), 0, Math.sin(a));
                plotPoint(x2 + cr * Math.cos(a), t, z2 + cr * Math.sin(a), -Math.cos(a), 0, -Math.sin(a));
            }
            if (Math.abs((t * 10) % 4) < 0.5) {
                for (let s = -1; s <= 1; s += 0.11) {
                    plotPoint(x1 * s, t, z1 * s, 0, 1, 0);
                }
            }
        }
    } else {
        // 3. 3D Кибер-Куб (Hyper Cube)
        const C = 1.4;
        for (let u = -C; u <= C; u += 0.12) {
            for (let v = -C; v <= C; v += 0.12) {
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
    sendCmd('playClick');
    const zap = document.getElementById('wiz-chk-zapret').checked;
    const prx = document.getElementById('wiz-chk-proxy').checked;
    const aut = document.getElementById('wiz-chk-autostart').checked;
    const foc = document.getElementById('wiz-chk-focus').checked;
    const cb = document.getElementById('wiz-chk-colorblind').checked;

    document.getElementById('wiz-card-zapret')?.classList.toggle('selected', zap);
    document.getElementById('wiz-card-proxy')?.classList.toggle('selected', prx);
    document.getElementById('wiz-card-autostart')?.classList.toggle('selected', aut);
    document.getElementById('wiz-card-focus')?.classList.toggle('selected', foc);
    document.getElementById('wiz-card-colorblind')?.classList.toggle('selected', cb);

    // Живое превью цветовой слепоты прямо в мастере
    document.body.classList.toggle('colorblind-mode', cb);

    const sumZap = document.getElementById('wiz-sum-zapret');
    const sumPrx = document.getElementById('wiz-sum-proxy');
    const sumAut = document.getElementById('wiz-sum-auto');
    const sumThm = document.getElementById('wiz-sum-theme');

    if (sumZap) { sumZap.innerText = zap ? 'ВКЛ' : 'ВЫКЛ'; sumZap.className = zap ? 'text-brand' : 'text-[#777777]'; }
    if (sumPrx) { sumPrx.innerText = prx ? 'ВКЛ' : 'ВЫКЛ'; sumPrx.className = prx ? 'text-brand' : 'text-[#777777]'; }
    if (sumAut) { sumAut.innerText = aut ? 'ВКЛ' : 'ВЫКЛ'; sumAut.className = aut ? 'text-brand' : 'text-[#777777]'; }
    if (sumThm) { sumThm.innerText = cb ? 'Сине-оранж.' : 'Стандарт'; }
}

function openWizardModal() {
    wizardStep = 0;
    wizardFinished = false;
    wizHyperSpeed = false;
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

    // Автоматически меняем 3D ASCII-модель под тему текущего шага
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
        document.getElementById('wiz-finish-bar').style.width = '30%';
        const pct = document.getElementById('wiz-finish-pct');
        if (pct) pct.innerText = '30%';

        sendCmd('runWizardSetup', {
            useZapret: document.getElementById('wiz-chk-zapret').checked,
            useTgProxy: document.getElementById('wiz-chk-proxy').checked,
            autoStart: document.getElementById('wiz-chk-autostart').checked,
            focusMode: document.getElementById('wiz-chk-focus').checked,
            colorblind: document.getElementById('wiz-chk-colorblind').checked
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
    sendCmd('playClick');
    stopWizAsciiEngine();
    sendCmd('skipWizard');
    document.getElementById('wizard-overlay').classList.remove('open');
}

function appendWizardLog(time, message, isProgress) {
    const box = document.getElementById('wiz-console-log');
    const text = `[${time}] ${message}`;

    const pctMatch = message.match(/(\d+(?:\.\d+)?)%/);
    if (pctMatch) {
        const val = Math.min(98, Math.max(30, Math.round(parseFloat(pctMatch[1]))));
        document.getElementById('wiz-finish-bar').style.width = `${val}%`;
        const pctEl = document.getElementById('wiz-finish-pct');
        if (pctEl) pctEl.innerText = `${val}%`;
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

// Таймер активной сессии обхода
let sessionStartTime = null;
let sessionTimerId = null;

// Фильтр логов
let currentLogFilter = 'all';

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
            document.getElementById('wiz-finish-status').innerText = 'Установка успешно завершена!';
            document.getElementById('wiz-finish-status').className = 'text-base font-bold text-brand';
            document.getElementById('wiz-finish-bar').style.width = '100%';
            const wizPct = document.getElementById('wiz-finish-pct');
            if (wizPct) wizPct.innerText = '100%';
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
            updateRoutingStatusUI(data);
            document.getElementById('btn-update-ipset').innerHTML = '<span class="mdl-icon text-xs">&#xE149;</span><span>Обновить базу IP</span>';
            document.getElementById('btn-update-ipset').disabled = false;
            document.getElementById('btn-update-hosts').innerHTML = '<span class="mdl-icon text-xs">&#xE945;</span><span>Обновить</span>';
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
                setEditorStatus('✓ Синтаксис корректен!', 'text-[#4ADE80]');
            } else {
                setEditorStatus('⚠ Ошибка в скрипте', 'text-[#F44336]');
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
            renderDiagnosticsReport(data);
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
function updatePingDisplay(pingMs) {
    const pingEl = document.getElementById('stat-ping');
    const badgeEl = document.getElementById('ping-quality-badge');
    const isCb = appState.settings.colorblindMode;

    if (pingMs < 0) {
        pingEl.innerText = '—';
        pingEl.style.color = isCb ? '#FF8C00' : '#D13438';
        badgeEl.innerText = 'Недоступен';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#2A1215] text-[#F44336]';
        return;
    }

    pingEl.innerText = pingMs;
    if (pingMs < 80) {
        pingEl.style.color = isCb ? '#60A5FA' : '#4CAF50';
        badgeEl.innerText = 'Отлично';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#1A2E1A] text-[#4ADE80]';
    } else if (pingMs < 150) {
        pingEl.style.color = '#FF8C00';
        badgeEl.innerText = 'Норма';
        badgeEl.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#2E2210] text-[#F59E0B]';
    } else {
        pingEl.style.color = isCb ? '#FF8C00' : '#D13438';
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
    } else {
        badge.className = 'mt-2.5 px-3 py-1 rounded-full bg-[#181818] border border-[#2A2A2A] flex items-center gap-2 text-[11px] font-mono text-[#888888] transition-all';
        dot.className = 'w-1.5 h-1.5 rounded-full bg-[#555555]';
        txt.innerText = 'ОЖИДАНИЕ ЗАПУСКА';
    }
}

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
    const wasRunning = appState.isRunning;
    appState.zapretRunning = zapretRunning;
    appState.proxyRunning = proxyRunning;
    appState.isRunning = zapretRunning || proxyRunning;

    if (appState.isRunning && !wasRunning) {
        sessionStartTime = Date.now();
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
                    <span class="font-mono text-sm font-semibold text-brand">${cfg.fileName}</span>
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
    el.className = `text-xs font-mono font-semibold truncate ${isEnabled ? 'text-brand' : 'text-[#A0A0A0]'}`;
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
        card.className = `gf-mode-card p-3 rounded-lg border cursor-pointer flex items-center justify-between transition ${isSelected ? 'bg-[#172554] border-blue-600' : 'bg-[#18181B] border-[#27272A] hover:bg-[#27272A]'}`;
        const check = card.querySelector('.gf-check');
        check.innerText = isSelected ? '✓' : '→';
        check.className = `gf-check text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-[#3F3F46]'}`;
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

// =========================================================================
// 5. ПАНЕЛЬ ЛОГОВ С ПОИСКОМ И ФИЛЬТРАМИ
// =========================================================================
function setLogFilter(mode) {
    sendCmd('playClick');
    currentLogFilter = mode;
    const btnAll = document.getElementById('log-filter-all');
    const btnErr = document.getElementById('log-filter-err');

    btnAll.className = mode === 'all'
        ? 'px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2A2A2A] text-white cursor-pointer transition'
        : 'px-2 py-0.5 rounded text-[11px] font-medium text-[#888888] hover:text-white cursor-pointer transition';

    btnErr.className = mode === 'err'
        ? 'px-2 py-0.5 rounded text-[11px] font-semibold bg-[#3B181C] text-[#F44336] cursor-pointer transition'
        : 'px-2 py-0.5 rounded text-[11px] font-medium text-[#888888] hover:text-white cursor-pointer transition';

    applyLogFilters();
}

function applyLogFilters() {
    const box = document.getElementById('log-box');
    const query = (document.getElementById('log-search-input')?.value || '').toLowerCase();

    Array.from(box.children).forEach(el => {
        const isErr = el.dataset.isErr === '1';
        const text = el.innerText.toLowerCase();
        const matchMode = currentLogFilter === 'all' || isErr;
        const matchQuery = !query || text.includes(query);
        el.style.display = (matchMode && matchQuery) ? '' : 'none';
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
    let color = 'text-[#A0A0A0]';
    let isErr = false;

    if (message.includes('ОШИБКА') || message.includes('⚠') || message.includes('🛑') || message.includes('❌') || message.includes('ERR')) {
        color = 'text-[#F44336] font-semibold';
        isErr = true;
    } else if (message.includes('✅') || message.includes('✨') || message.includes('🏆')) {
        color = 'text-brand';
    } else if (message.includes('🔍') || message.includes('[Auto]')) {
        color = 'text-[#60A5FA]';
    }

    div.dataset.isErr = isErr ? '1' : '0';
    div.className = color;
    div.innerText = text;
    box.appendChild(div);

    const counter = document.getElementById('log-counter-badge');
    if (counter) counter.innerText = box.children.length;

    applyLogFilters();
    box.scrollTop = box.scrollHeight;

    lastProgressLogEl = isProgress ? div : null;
}

function clearLogs() {
    sendCmd('playClick');
    document.getElementById('log-box').innerHTML = '';
    const counter = document.getElementById('log-counter-badge');
    if (counter) counter.innerText = '0';
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
    okBtn.className = `px-4 py-1.5 rounded-md text-xs font-semibold text-white transition cursor-pointer ${isError ? 'bg-[#D13438] hover:opacity-90' : 'btn-brand'}`;
    document.getElementById('confirm-modal').classList.add('open');
}

function showConfirm(title, message, confirmText, onConfirm, isDanger = false) {
    confirmCallback = onConfirm;
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-msg').innerText = message;
    document.getElementById('confirm-cancel-btn').style.display = 'inline-block';
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = confirmText;
    okBtn.className = `px-4 py-1.5 rounded-md text-xs font-semibold text-white transition cursor-pointer ${isDanger ? 'bg-[#D13438] hover:opacity-90' : 'btn-brand'}`;
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

// =========================================================================
// 6. ДВУХКАНАЛЬНЫЙ ГРАФИК ТРАФИКА С ГРАДИЕНТОМ И ПИКОМ
// =========================================================================
const rxHistory = new Array(30).fill(0);
const txHistory = new Array(30).fill(0);
let peakSpeedMbps = 0;

function updateChart(rxValue, txValue = 0) {
    rxHistory.push(rxValue);
    rxHistory.shift();
    txHistory.push(txValue);
    txHistory.shift();

    peakSpeedMbps = Math.max(peakSpeedMbps, rxValue, txValue);
    const peakEl = document.getElementById('stat-peak');
    if (peakEl) peakEl.innerText = `Пик: ${peakSpeedMbps.toFixed(1)} Мбит/с`;

    const canvas = document.getElementById('traffic-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Фоновая сетка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    [0.33, 0.66].forEach(ratio => {
        ctx.beginPath();
        ctx.moveTo(0, h * ratio);
        ctx.lineTo(w, h * ratio);
        ctx.stroke();
    });

    const maxVal = Math.max(5, ...rxHistory, ...txHistory);
    const isCb = appState.settings.colorblindMode;
    const rxColor = isCb ? '#0078D7' : '#4CAF50';

    // Заливка под кривой Download
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isCb ? 'rgba(0, 120, 215, 0.35)' : 'rgba(76, 175, 80, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.beginPath();
    rxHistory.forEach((val, idx) => {
        const x = (idx / (rxHistory.length - 1)) * w;
        const y = h - (val / maxVal) * (h - 14) - 5;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Линия Download
    ctx.beginPath();
    ctx.strokeStyle = rxColor;
    ctx.lineWidth = 2;
    rxHistory.forEach((val, idx) => {
        const x = (idx / (rxHistory.length - 1)) * w;
        const y = h - (val / maxVal) * (h - 14) - 5;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Пунктирная линия Upload
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#60A5FA';
    ctx.lineWidth = 1.3;
    txHistory.forEach((val, idx) => {
        const x = (idx / (txHistory.length - 1)) * w;
        const y = h - (val / maxVal) * (h - 14) - 5;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
}

let sidebarOpen = true;
function toggleSidebar() {
    sendCmd('playClick');
    sidebarOpen = !sidebarOpen;
    const sb = document.getElementById('sidebar');
    sb.style.width = sidebarOpen ? '220px' : '0px';
    sb.style.paddingLeft = sidebarOpen ? '10px' : '0px';
    sb.style.paddingRight = sidebarOpen ? '10px' : '0px';
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
    // Фикс: проверяем !e.target.closest('button'), чтобы клик по иконке внутри кнопки не вызывал перетаскивание!
    document.getElementById('titlebar').addEventListener('mousedown', (e) => {
        if (!e.target.closest('button')) {
            sendCmd('windowDrag');
        }
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