// =========================================================================
// УПРАВЛЕНИЕ ВКЛАДКОЙ НАСТРОЕК (SETTINGSVIEW — BENTO GRID v4.1)
// =========================================================================

const INTERVAL_NAMES = {
    1: '1 сек.',
    2: '2 сек.',
    5: '5 сек.',
    10: '10 сек.'
};

const HOSTS_SOURCE_NAMES = [
    'Только Flowseal (Discord / YT)',
    'Только V3nilla (ChatGPT / AI / Spotify)',
    'Flowseal + V3nilla (Рекомендуется)',
    'Flowseal + V3nilla + AdBlock (0.0.0.0)'
];

const IPSET_MODE_NAMES = {
    'loaded': 'По списку (Loaded)',
    'any': 'Весь трафик (Any)',
    'none': 'Отключен (Заглушка)'
};

const ACCENT_THEME_NAMES = {
    'green': 'Изумруд',
    'blue': 'Сапфир',
    'purple': 'Аметист',
    'amber': 'Топаз',
    'cyan': 'Аквамарин'
};

// 5 уникальных 2D-форм камешков на единой 3D-орбите
const FLOATING_STONES = [
    {
        id: 'green',
        name: 'Изумруд',
        sub: 'EMERALD',
        phase: 0.0,
        speed: 0.85,
        fillTop: '#4ADE80',
        fillMid: '#10B981',
        fillBot: '#065F46',
        edge: '#A7F3D0',
        glow: '#4CAF50',
        // 1. Классический изумрудный шестигранный кристалл
        outer: [
            { x: -1.5, y: -17 }, { x: 11.5, y: -9.5 }, { x: 13.5, y: 6 },
            { x: 2.8, y: 16.5 }, { x: -11.5, y: 10.5 }, { x: -13, y: -6 }
        ],
        inner: [
            { x: -0.8, y: -9 }, { x: 6, y: -4 }, { x: 5.5, y: 6 },
            { x: -4.5, y: 7 }, { x: -6, y: -3 }
        ]
    },
    {
        id: 'blue',
        name: 'Сапфир',
        sub: 'SAPPHIRE',
        phase: 1.4,
        speed: 0.76,
        fillTop: '#93C5FD',
        fillMid: '#2563EB',
        fillBot: '#1E3A8A',
        edge: '#BFDBFE',
        glow: '#60A5FA',
        // 2. Острый диагональный осколок-клинок
        outer: [
            { x: 3, y: -18.5 }, { x: 15, y: -2 }, { x: 5.5, y: 17 },
            { x: -10.5, y: 12 }, { x: -13.5, y: -4.5 }
        ],
        inner: [
            { x: 1.8, y: -9 }, { x: 7.5, y: -1 }, { x: 2.2, y: 8.5 }, { x: -6, y: 2.2 }
        ]
    },
    {
        id: 'purple',
        name: 'Аметист',
        sub: 'AMETHYST',
        phase: 2.8,
        speed: 0.9,
        fillTop: '#D8B4FE',
        fillMid: '#7C3AED',
        fillBot: '#4C1D95',
        edge: '#E9D5FF',
        glow: '#A78BFA',
        // 3. Широкая граненая друза
        outer: [
            { x: -7.5, y: -15.5 }, { x: 9, y: -14 }, { x: 16, y: 1.5 },
            { x: 7.5, y: 15.5 }, { x: -9, y: 14 }, { x: -16, y: -1.5 }
        ],
        inner: [
            { x: -3.2, y: -7.5 }, { x: 5, y: -6 }, { x: 7.5, y: 3.2 },
            { x: -2.2, y: 7.5 }, { x: -7.5, y: 0 }
        ]
    },
    {
        id: 'amber',
        name: 'Топаз',
        sub: 'TOPAZ',
        phase: 4.2,
        speed: 0.8,
        fillTop: '#FDE68A',
        fillMid: '#D97706',
        fillBot: '#78350F',
        edge: '#FEF3C7',
        glow: '#FBBF24',
        // 4. Массивный угловатый янтарный монолит
        outer: [
            { x: -10.5, y: -15 }, { x: 6, y: -16.5 }, { x: 14.5, y: -4 },
            { x: 11.5, y: 13 }, { x: -4.5, y: 16.5 }, { x: -14.5, y: 4.5 }
        ],
        inner: [
            { x: -4.5, y: -7.5 }, { x: 4.5, y: -7.5 }, { x: 6, y: 4.5 }, { x: -6, y: 6 }
        ]
    },
    {
        id: 'cyan',
        name: 'Аквамарин',
        sub: 'AQUAMARINE',
        phase: 5.5,
        speed: 0.84,
        fillTop: '#67E8F9',
        fillMid: '#0891B2',
        fillBot: '#164E63',
        edge: '#CFFAFE',
        glow: '#22D3EE',
        // 5. Призматический осколок-капля
        outer: [
            { x: 0, y: -18.5 }, { x: 14.5, y: -3.8 }, { x: 10.5, y: 13 },
            { x: -3.2, y: 16.5 }, { x: -14.5, y: 2.8 }
        ],
        inner: [
            { x: 0, y: -8.5 }, { x: 7, y: -1 }, { x: 2.8, y: 7.5 }, { x: -6, y: 2.2 }
        ]
    }
];

let gemFieldStarted = false;
let currentOrbitAngle = 0;
let targetOrbitAngle = 0;

function setTargetOrbitByTheme(themeId) {
    const N = FLOATING_STONES.length;
    const step = (Math.PI * 2) / N;
    const idx = Math.max(0, FLOATING_STONES.findIndex(s => s.id === themeId));
    const desired = -idx * step;

    let diff = (desired - targetOrbitAngle) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    targetOrbitAngle += diff;
}

function cycleAccentGem(dir) {
    const N = FLOATING_STONES.length;
    const curIdx = Math.max(0, FLOATING_STONES.findIndex(s => s.id === (appState.settings.accentTheme || 'green')));
    const nextIdx = (curIdx + dir + N) % N;
    selectAccentTheme(FLOATING_STONES[nextIdx].id);
}

// Вспомогательная функция для рисования скругленной плашки подписи на Canvas
function drawRoundedBadge(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function startGemSwatchesEngine() {
    if (gemFieldStarted) return;
    gemFieldStarted = true;

    const initIdx = Math.max(0, FLOATING_STONES.findIndex(s => s.id === (appState.settings.accentTheme || 'green')));
    currentOrbitAngle = -initIdx * ((Math.PI * 2) / FLOATING_STONES.length);
    targetOrbitAngle = currentOrbitAngle;

    function bindCanvasEvents(canvas) {
        if (canvas._bound) return;
        canvas._bound = true;
        canvas._targetMouseX = 0;
        canvas._targetMouseY = 0;
        canvas._smoothMouseX = 0;
        canvas._smoothMouseY = 0;
        canvas._hoverId = null;
        canvas._hoverScales = {};
        canvas._renderedGems = [];
        canvas._dragStartX = null;
        canvas._didDrag = false;
        canvas._lastWheelTime = 0;

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            // Координаты в честных CSS-пикселях (1:1 без искажения пропорций)
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            canvas._targetMouseX = Math.max(-1, Math.min(1, (mx - rect.width / 2) / (rect.width / 2)));
            canvas._targetMouseY = Math.max(-1, Math.min(1, (my - rect.height / 2) / (rect.height / 2)));

            if (canvas._dragStartX !== null) {
                const dx = mx - canvas._dragStartX;
                if (Math.abs(dx) > 48) {
                    canvas._didDrag = true;
                    cycleAccentGem(dx > 0 ? -1 : 1);
                    canvas._dragStartX = mx;
                }
                return;
            }

            let hovered = null;
            const list = [...(canvas._renderedGems || [])].reverse();
            for (const g of list) {
                if (Math.hypot(mx - g.screenX, my - g.screenY) <= g.hitRadius) {
                    hovered = g;
                    break;
                }
            }
            canvas._hoverId = hovered ? hovered.id : null;
        });

        canvas.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            const rect = canvas.getBoundingClientRect();
            canvas._dragStartX = e.clientX - rect.left;
            canvas._didDrag = false;
        });

        window.addEventListener('mouseup', () => {
            canvas._dragStartX = null;
        });

        canvas.addEventListener('mouseleave', () => {
            canvas._targetMouseX = 0;
            canvas._targetMouseY = 0;
            canvas._hoverId = null;
            canvas._dragStartX = null;
        });

        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const now = performance.now();
            if (now - canvas._lastWheelTime < 180) return; // Плавная защита от слишком быстрого скролла
            canvas._lastWheelTime = now;
            cycleAccentGem(e.deltaY > 0 ? 1 : -1);
        }, { passive: false });

        canvas.addEventListener('click', e => {
            if (canvas._didDrag) {
                canvas._didDrag = false;
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const list = [...(canvas._renderedGems || [])].reverse();
            for (const g of list) {
                if (Math.hypot(mx - g.screenX, my - g.screenY) <= g.hitRadius + 8) {
                    selectAccentTheme(g.id);
                    return;
                }
            }
            if (mx < rect.width * 0.4) cycleAccentGem(-1);
            else if (mx > rect.width * 0.6) cycleAccentGem(1);
        });
    }

    let time = 0;

    function renderZeroGravityCarousel() {
        // Медленное, плавное дыхание невесомости
        time += 0.006;

        // Очень мягкое вращение 3D-орбиты при перелистывании
        currentOrbitAngle += (targetOrbitAngle - currentOrbitAngle) * 0.085;

        const canvases = document.querySelectorAll('canvas.gem-field-canvas');
        const currentTheme = appState.settings.accentTheme || 'green';
        const activeStone = FLOATING_STONES.find(s => s.id === currentTheme) || FLOATING_STONES[0];
        const N = FLOATING_STONES.length;
        const stepAngle = (Math.PI * 2) / N;
        const dpr = window.devicePixelRatio || 1;

        canvases.forEach(canvas => {
            bindCanvasEvents(canvas);

            // Синхронизируем физический размер Canvas с реальным CSS-размером (чтобы камни никогда не сплющивались!)
            const rect = canvas.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            if (w < 10 || h < 10) return;

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

            // Плавное сглаживание реакции на мышь (никаких рывков!)
            canvas._smoothMouseX += (canvas._targetMouseX - canvas._smoothMouseX) * 0.07;
            canvas._smoothMouseY += (canvas._targetMouseY - canvas._smoothMouseY) * 0.07;

            const camTiltX = canvas._smoothMouseX * 4.5;
            const camTiltY = canvas._smoothMouseY * 2.0;

            const cx = w / 2;
            const cy = h / 2 - 9; // Смещаем центр орбиты чуть выше, оставляя место под красивые подписи

            // Адаптивный радиус орбиты (одинаково красиво смотрится и в широком Мастере, и в Настройках)
            const radiusX = Math.min(165, Math.max(115, w * 0.31));
            const radiusZ = 86;
            const fov = 250;

            // 1. Рисуем 3D-кольцо орбиты и перспективную сетку пола
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cx - camTiltX * 0.35, cy + 20, radiusX * 1.02, 13, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
            ctx.beginPath();
            for (let gx = -180; gx <= 180; gx += 45) {
                ctx.moveTo(cx + gx * 0.7 - camTiltX * 0.25, h - 24);
                ctx.lineTo(cx + gx * 1.15 + camTiltX * 0.4, h);
            }
            ctx.stroke();
            ctx.restore();

            // 2. Вычисляем 3D-координаты камней
            const projected = FLOATING_STONES.map((st, idx) => {
                const theta = idx * stepAngle + currentOrbitAngle;
                const sinT = Math.sin(theta);
                const cosT = Math.cos(theta); // +1 на переднем плане, -1 далеко позади

                const isSelected = st.id === currentTheme;
                const isHovered = canvas._hoverId === st.id;

                // Плавное сглаживание масштаба каждого камня при наведении/выборе
                const targetHoverScale = isSelected ? 1.12 : isHovered ? 1.03 : 0.90;
                const prevScale = canvas._hoverScales[st.id] ?? targetHoverScale;
                const smoothItemScale = prevScale + (targetHoverScale - prevScale) * 0.12;
                canvas._hoverScales[st.id] = smoothItemScale;

                // Невесомое парение
                const bobY = Math.sin(time * st.speed + st.phase) * 3.2;
                const driftX = Math.cos(time * 0.7 * st.speed + st.phase) * 1.2;
                const swayAngle = Math.sin(time * 0.65 * st.speed + st.phase) * 0.055;

                const worldX = sinT * radiusX + driftX - camTiltX * cosT;
                const zDepth = (1 - cosT) * radiusZ;
                const worldY = bobY - (1 - cosT) * 6.5 - camTiltY * 0.4;

                const scale3D = fov / (fov + zDepth * 1.35);
                const screenX = cx + worldX * scale3D;
                const screenY = cy + worldY * scale3D;

                const depthAlpha = Math.max(0.26, Math.min(1, 0.34 + (cosT + 1) * 0.35));

                return {
                    st,
                    id: st.id,
                    name: st.name,
                    screenX,
                    screenY,
                    scale3D,
                    smoothItemScale,
                    zDepth,
                    cosT,
                    bobY,
                    swayAngle,
                    depthAlpha,
                    hitRadius: 26 * scale3D,
                    isSelected,
                    isHovered
                };
            });

            canvas._renderedGems = projected;
            projected.sort((a, b) => b.zDepth - a.zDepth);

            // 3. Отрисовка камней и их 3D-подписей (от дальних к ближним)
            projected.forEach(item => {
                const { st, screenX, screenY, scale3D, smoothItemScale, bobY, swayAngle, depthAlpha, isSelected, isHovered } = item;

                ctx.save();
                ctx.globalAlpha = isHovered ? Math.min(1, depthAlpha + 0.2) : depthAlpha;

                // Мягкая тень на полу
                const shadowY = screenY + 23 * scale3D;
                const shadowRx = Math.max(4, (12 - bobY * 0.35) * scale3D);
                ctx.beginPath();
                ctx.ellipse(screenX, shadowY, shadowRx, 2.4 * scale3D, 0, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? st.glow + '60' : 'rgba(0, 0, 0, 0.55)';
                ctx.fill();

                // Свечение вокруг камня
                if (isSelected || isHovered) {
                    const glowR = (isSelected ? 28 : 19) * scale3D;
                    const gradGlow = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, glowR);
                    gradGlow.addColorStop(0, st.glow + (isSelected ? '60' : '33'));
                    gradGlow.addColorStop(1, st.glow + '00');
                    ctx.fillStyle = gradGlow;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, glowR, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Отрисовка самого 2D-камешка (с честным соотношением сторон 1:1)
                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(swayAngle);
                const finalScale = scale3D * smoothItemScale;
                ctx.scale(finalScale, finalScale);

                ctx.beginPath();
                st.outer.forEach((pt, pIdx) => {
                    if (pIdx === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.closePath();

                const bodyGrad = ctx.createLinearGradient(-12, -17, 12, 17);
                bodyGrad.addColorStop(0, st.fillTop);
                bodyGrad.addColorStop(0.52, st.fillMid);
                bodyGrad.addColorStop(1, st.fillBot);
                ctx.fillStyle = bodyGrad;
                ctx.fill();

                ctx.strokeStyle = isSelected ? '#FFFFFF' : st.edge;
                ctx.lineWidth = isSelected ? 1.3 : 0.85;
                ctx.stroke();

                // Внутренние ребра огранки
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                for (let k = 0; k < st.inner.length; k++) {
                    const outPt = st.outer[k % st.outer.length];
                    const inPt = st.inner[k];
                    ctx.moveTo(outPt.x, outPt.y);
                    ctx.lineTo(inPt.x, inPt.y);
                }
                ctx.stroke();

                // Передняя площадка камня
                ctx.beginPath();
                st.inner.forEach((pt, pIdx) => {
                    if (pIdx === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.closePath();
                ctx.fillStyle = st.fillTop + (isSelected ? '88' : '50');
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
                ctx.lineWidth = 0.65;
                ctx.stroke();
                ctx.restore();

                // 4. Красивая парящая подпись под каждым камешком
                const labelY = screenY + 27 * scale3D + (isSelected ? 4 : 1);
                const fontSize = Math.max(8.5, Math.round(10.5 * scale3D));
                ctx.font = `${isSelected ? '700' : '600'} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const textTitle = isSelected ? `✦ ${st.name} ✦` : st.name;
                const textW = ctx.measureText(textTitle).width;
                const pillW = textW + (isSelected ? 16 : 12) * scale3D;
                const pillH = (isSelected ? 16 : 14) * scale3D;

                // Подложка-капсула под текстом
                drawRoundedBadge(ctx, screenX - pillW / 2, labelY - pillH / 2, pillW, pillH, 5 * scale3D);
                ctx.fillStyle = isSelected ? 'rgba(14, 18, 16, 0.92)' : 'rgba(16, 16, 20, 0.75)';
                ctx.fill();

                ctx.strokeStyle = isSelected ? st.glow : isHovered ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)';
                ctx.lineWidth = isSelected ? 1.1 : 0.7;
                ctx.stroke();

                // Текст названия камня
                ctx.fillStyle = isSelected ? '#FFFFFF' : isHovered ? '#E4E4E7' : '#A1A1AA';
                if (isSelected) {
                    ctx.shadowColor = st.glow;
                    ctx.shadowBlur = 6;
                }
                ctx.fillText(textTitle, screenX, labelY + 0.5);
                ctx.shadowBlur = 0;

                ctx.restore();
            });

            // 5. Голографическая рамка-прицел вокруг центрального активного камня
            const selX = cx - camTiltX * 0.35;
            const selY = cy;
            const boxW = 46, boxH = 48;
            const halfW = boxW / 2, halfH = boxH / 2;
            const corner = 7;

            ctx.save();
            ctx.strokeStyle = activeStone.glow;
            ctx.shadowColor = activeStone.glow;
            ctx.shadowBlur = 9;
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(selX - halfW, selY - halfH + corner);
            ctx.lineTo(selX - halfW, selY - halfH);
            ctx.lineTo(selX - halfW + corner, selY - halfH);

            ctx.moveTo(selX + halfW - corner, selY - halfH);
            ctx.lineTo(selX + halfW, selY - halfH);
            ctx.lineTo(selX + halfW, selY - halfH + corner);

            ctx.moveTo(selX + halfW, selY + halfH - corner);
            ctx.lineTo(selX + halfW, selY + halfH);
            ctx.lineTo(selX + halfW - corner, selY + halfH);

            ctx.moveTo(selX - halfW + corner, selY + halfH);
            ctx.lineTo(selX - halfW, selY + halfH);
            ctx.lineTo(selX - halfW, selY + halfH - corner);
            ctx.stroke();
            ctx.restore();

            ctx.restore();
        });

        requestAnimationFrame(renderZeroGravityCarousel);
    }

    requestAnimationFrame(renderZeroGravityCarousel);
}

let currentSettingsCat = 'all';
let saveToastTimeout = null;

function applyAccentThemeToDom(theme) {
    const clean = (!theme || theme === 'crimson') ? (theme === 'crimson' ? 'cyan' : 'green') : theme;
    appState.settings.accentTheme = clean;

    document.body.setAttribute('data-accent', clean);
    setTargetOrbitByTheme(clean);

    const stoneObj = FLOATING_STONES.find(s => s.id === clean) || FLOATING_STONES[0];
    const themeTitle = stoneObj.name;

    const wizThemeLbl = document.getElementById('wiz-sum-theme');
    if (wizThemeLbl) {
        wizThemeLbl.innerText = themeTitle;
    }

    document.querySelectorAll('.gem-active-label').forEach(el => {
        el.innerText = `${stoneObj.name} • ${stoneObj.sub}`;
    });

    startGemSwatchesEngine();

    if (typeof drawChart === 'function') {
        drawChart();
    }
}

function selectAccentTheme(theme) {
    sendCmd('playClick');
    appState.settings.accentTheme = theme || 'green';
    applyAccentThemeToDom(appState.settings.accentTheme);
    onSettingsChanged();
}

function initSettingsFromBackend(data) {
    const s = data.settings || {};

    appState.settings.focusMode = !!s.focusMode;
    appState.settings.compactMode = !!s.compactMode;
    appState.settings.statsUpdateInterval = s.statsUpdateInterval || 1;
    appState.settings.hostsSourceIndex = s.hostsSourceIndex ?? 2;
    appState.settings.accentTheme = s.accentTheme || 'green';
    appState.settings.watchdogPingAutoRestart = !!s.watchdogPingAutoRestart;

    applyAccentThemeToDom(appState.settings.accentTheme);
    document.body.classList.toggle('compact-mode', appState.settings.compactMode);

    if (s.skipSplashScreen && !data.isFirstRun && typeof skipSplash === 'function') {
        skipSplash();
    }

    const setChk = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };

    setChk('set-autostart', data.isAutoStart);
    setChk('set-autostart-bypass', s.autoStartBypass);
    setChk('set-start-minimized', s.startMinimized);
    setChk('set-minimize-close', s.minimizeOnClose !== false);
    setChk('set-stop-on-exit', s.stopServicesOnExit !== false);
    setChk('set-notifications', s.notificationsEnabled !== false);
    setChk('set-always-on-top', s.alwaysOnTop);

    setChk('set-sound-effects', s.soundEffectsEnabled !== false);
    setChk('set-skip-splash', s.skipSplashScreen);
    setChk('set-compact-mode', s.compactMode);
    setChk('set-focus-mode', s.focusMode);
    setChk('set-hw-accel', s.hardwareAcceleration !== false);

    setChk('set-autorestart', s.autoRestartServices);
    setChk('set-watchdog-ping', s.watchdogPingAutoRestart);

    const pingInput = document.getElementById('set-ping-url');
    if (pingInput) pingInput.value = s.pingUrl || 'https://dynamodb.eu-central-1.amazonaws.com';

    const intTxt = document.getElementById('txt-selected-interval');
    if (intTxt) intTxt.innerText = INTERVAL_NAMES[appState.settings.statsUpdateInterval] || `${appState.settings.statsUpdateInterval} сек.`;

    const hostsTxt = document.getElementById('txt-selected-hosts');
    if (hostsTxt) hostsTxt.innerText = HOSTS_SOURCE_NAMES[appState.settings.hostsSourceIndex] || HOSTS_SOURCE_NAMES[2];

    const zapVer = document.getElementById('txt-core-zapret-ver');
    if (zapVer) zapVer.innerText = s.zapretCoreVersion && s.zapretCoreVersion !== '0.0.0' ? s.zapretCoreVersion : 'Установлен';

    const prxVer = document.getElementById('txt-core-proxy-ver');
    if (prxVer) prxVer.innerText = s.tgProxyCoreVersion && s.tgProxyCoreVersion !== '0.0.0' ? s.tgProxyCoreVersion : 'Установлен';

    if (data.routingStatus) {
        updateRoutingStatusUI(data.routingStatus);
    }
}

function updateRoutingStatusUI(rs) {
    if (!rs) return;
    appState.settings.ipSetMode = rs.ipMode || 'loaded';

    const ipBadge = document.getElementById('badge-ipset-status');
    if (ipBadge) {
        ipBadge.innerText = rs.ipStatusText || 'Неизвестно';
        ipBadge.className = rs.ipMode === 'loaded'
            ? 'px-2 py-0.5 rounded bg-[#0F240F] text-brand font-mono text-[10px] font-semibold'
            : 'px-2 py-0.5 rounded bg-[#222222] text-[#999999] font-mono text-[10px] font-semibold';
    }

    const ipSel = document.getElementById('txt-selected-ipset');
    if (ipSel) {
        ipSel.innerText = IPSET_MODE_NAMES[rs.ipMode] || 'По списку (Loaded)';
    }

    const hostsBadge = document.getElementById('badge-hosts-status');
    if (hostsBadge) {
        hostsBadge.innerText = rs.hostsStatusText || 'Не применен';
        hostsBadge.className = rs.hostsApplied
            ? 'px-2 py-0.5 rounded bg-[#0F240F] text-brand font-mono text-[10px] font-semibold'
            : 'px-2 py-0.5 rounded bg-[#222222] text-[#888888] font-mono text-[10px] font-semibold';
    }
}

function onSettingsChanged() {
    sendCmd('playClick');

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

        accentTheme: appState.settings.accentTheme || 'green',
        soundEffectsEnabled: document.getElementById('set-sound-effects')?.checked ?? true,
        skipSplashScreen: document.getElementById('set-skip-splash')?.checked ?? false,
        compactMode: compact,
        focusMode: focus,
        hardwareAcceleration: document.getElementById('set-hw-accel')?.checked ?? true,

        pingUrl: document.getElementById('set-ping-url')?.value?.trim() || 'https://dynamodb.eu-central-1.amazonaws.com',
        statsUpdateInterval: appState.settings.statsUpdateInterval || 1,
        autoRestartServices: document.getElementById('set-autorestart')?.checked ?? false,
        watchdogPingAutoRestart: watchdog,
        hostsSourceIndex: appState.settings.hostsSourceIndex ?? 2
    };

    sendCmd('saveSettings', { settings: payload });
    showSettingsSavedToast();
}

function showSettingsSavedToast() {
    const toast = document.getElementById('settings-save-toast');
    if (!toast) return;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');

    if (saveToastTimeout) clearTimeout(saveToastTimeout);
    saveToastTimeout = setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 1600);
}

function setPingUrlPreset(url) {
    const input = document.getElementById('set-ping-url');
    if (input) {
        input.value = url;
        onSettingsChanged();
    }
}

function setSettingsCat(cat, btnEl) {
    sendCmd('playClick');
    currentSettingsCat = cat;

    document.querySelectorAll('.set-cat-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) {
        btnEl.classList.add('active');
        updateSettingsSlidingPill(btnEl);
    }

    filterSettingsView();
}

function updateSettingsSlidingPill(activeBtn) {
    const pill = document.getElementById('settings-seg-pill');
    const track = document.getElementById('settings-seg-track');
    if (!pill || !track || !activeBtn) return;

    const trackRect = track.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const offsetLeft = btnRect.left - trackRect.left + track.scrollLeft;

    pill.style.width = `${btnRect.width}px`;
    pill.style.transform = `translateX(${offsetLeft}px)`;
}

function filterSettingsView() {
    const query = (document.getElementById('settings-search-input')?.value || '').trim().toLowerCase();
    const groups = document.querySelectorAll('#tab-settings [data-set-group]');

    groups.forEach(group => {
        const groupCat = group.getAttribute('data-set-group');
        const catMatches = (currentSettingsCat === 'all' || currentSettingsCat === groupCat);

        if (!catMatches && !query) {
            group.classList.add('hidden');
            return;
        }

        const searchableRows = group.querySelectorAll('[data-search]');
        if (searchableRows.length === 0) {
            group.classList.toggle('hidden', !catMatches);
            return;
        }

        let visibleInGroup = 0;
        searchableRows.forEach(row => {
            const text = (row.getAttribute('data-search') + ' ' + row.innerText).toLowerCase();
            const match = !query || text.includes(query);
            row.classList.toggle('hidden', !match);
            if (match) visibleInGroup++;
        });

        group.classList.toggle('hidden', visibleInGroup === 0);
    });
}

function openIntervalSelector() {
    sendCmd('playClick');
    const options = [
        { value: 1, title: '1 секунда (Реальное время)', desc: 'Максимально плавный график скорости трафика' },
        { value: 2, title: '2 секунды', desc: 'Сбалансированная частота опроса сетевой карты' },
        { value: 5, title: '5 секунд', desc: 'Экономичный режим обновления статистики' },
        { value: 10, title: '10 секунд', desc: 'Редкое обновление для слабых ПК' }
    ];

    openSelectionModal('Телеметрия сети', 'Частота опроса трафика', options, appState.settings.statsUpdateInterval, val => {
        appState.settings.statsUpdateInterval = val;
        const txt = document.getElementById('txt-selected-interval');
        if (txt) txt.innerText = INTERVAL_NAMES[val] || `${val} сек.`;
        onSettingsChanged();
    });
}

function openIpSetSelector() {
    sendCmd('playClick');
    const options = [
        { value: 'loaded', title: 'По списку (Loaded • Рекомендуется)', desc: 'Обходить блокировки только для подсетей из базы ipset-all.txt' },
        { value: 'any', title: 'Весь трафик (Any • 0 IP)', desc: 'Применять правила ко всем IP-адресам без фильтрации по базе' },
        { value: 'none', title: 'Отключен (Заглушка)', desc: 'Временно отключить IPSet-маршрутизацию (подсеть-заглушка)' }
    ];

    openSelectionModal('Маршрутизация IPSet', 'Режим фильтрации подсетей', options, appState.settings.ipSetMode, val => {
        sendCmd('setIpSetMode', { mode: val });
    });
}

function openHostsSourceSelector() {
    sendCmd('playClick');
    const options = [
        { value: 0, title: HOSTS_SOURCE_NAMES[0], desc: 'Базовый список доменов Discord и голосовых серверов от Flowseal' },
        { value: 1, title: HOSTS_SOURCE_NAMES[1], desc: 'Домены ChatGPT, OpenAI, Claude, Gemini, Spotify и др. от V3nilla' },
        { value: 2, title: HOSTS_SOURCE_NAMES[2], desc: 'Объединенная база всех сервисов без блокировщика рекламы' },
        { value: 3, title: HOSTS_SOURCE_NAMES[3], desc: 'Полная база + блокировка рекламных трекеров через 0.0.0.0' }
    ];

    openSelectionModal('Системный файл Hosts', 'Выберите источник правил', options, appState.settings.hostsSourceIndex, val => {
        appState.settings.hostsSourceIndex = val;
        const txt = document.getElementById('txt-selected-hosts');
        if (txt) txt.innerText = HOSTS_SOURCE_NAMES[val];
        onSettingsChanged();
    });
}

function updateIpSetFromWeb() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-update-ipset');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="mdl-icon text-xs spin-anim">&#xE149;</span><span>Загрузка...</span>';
    }
    sendCmd('updateIpSet');
}

function updateSystemHosts() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-update-hosts');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="mdl-icon text-xs spin-anim">&#xE149;</span><span>Запись...</span>';
    }
    sendCmd('updateHosts', { sourceIndex: appState.settings.hostsSourceIndex });
}

function promptClearHosts() {
    sendCmd('playClick');
    showConfirm(
        'Очистка файла Hosts',
        'Удалить все записи Zapret из системного файла hosts?\n\nВаши собственные записи в файле hosts затронуты не будут.',
        'Очистить',
        () => sendCmd('clearHosts'),
        true
    );
}

function checkUpdatesManual() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-check-updates');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Проверка...';
    }
    sendCmd('checkUpdates');
}

function promptResetSettings() {
    sendCmd('playClick');
    showConfirm(
        'Сброс настроек',
        'Вы уверены, что хотите сбросить все настройки программы к значениям по умолчанию?',
        'Сбросить всё',
        () => sendCmd('resetSettings'),
        true
    );
}