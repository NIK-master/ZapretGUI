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