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

// 5 кардинально разных по силуэту 2D-самоцветов в едином 3D-пространстве
const FLOATING_STONES = [
    {
        id: 'green',
        name: 'Изумруд',
        sub: 'EMERALD',
        phase: 0.0,
        speed: 0.65,
        fillTop: '#4ADE80',
        fillMid: '#10B981',
        fillBot: '#065F46',
        edge: '#A7F3D0',
        glow: '#4CAF50',
        // 1. СТУПЕНЧАТЫЙ ОКТАГОН (Классическая прямоугольная огранка Emerald Cut)
        outer: [
            { x: -7.5, y: -15 }, { x: 7.5, y: -15 },
            { x: 11.5, y: -10.5 }, { x: 11.5, y: 10.5 },
            { x: 7.5, y: 15 }, { x: -7.5, y: 15 },
            { x: -11.5, y: 10.5 }, { x: -11.5, y: -10.5 }
        ],
        inner: [
            { x: -4.5, y: -9.5 }, { x: 4.5, y: -9.5 },
            { x: 6.5, y: -7 }, { x: 6.5, y: 7 },
            { x: 4.5, y: 9.5 }, { x: -4.5, y: 9.5 },
            { x: -6.5, y: 7 }, { x: -6.5, y: -7 }
        ],
        ribs: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]
    },
    {
        id: 'blue',
        name: 'Сапфир',
        sub: 'SAPPHIRE',
        phase: 1.4,
        speed: 0.58,
        fillTop: '#93C5FD',
        fillMid: '#2563EB',
        fillBot: '#1E3A8A',
        edge: '#BFDBFE',
        glow: '#60A5FA',
        // 2. УЗКОЕ ОСТРИЁ КОПЬЯ / КИНЖАЛЬНЫЙ ОСКОЛОК (Вытянутый ромб с хребтом)
        outer: [
            { x: 0, y: -17.5 },
            { x: 9.5, y: -3 },
            { x: 5.5, y: 10.5 },
            { x: 0, y: 17.5 },
            { x: -5.5, y: 10.5 },
            { x: -9.5, y: -3 }
        ],
        inner: [
            { x: 0, y: -10 },
            { x: 4.2, y: -2 },
            { x: 0, y: 10.5 },
            { x: -4.2, y: -2 }
        ],
        ribs: [[0, 0], [1, 1], [2, 2], [3, 2], [4, 2], [5, 3]]
    },
    {
        id: 'purple',
        name: 'Аметист',
        sub: 'AMETHYST',
        phase: 2.8,
        speed: 0.72,
        fillTop: '#D8B4FE',
        fillMid: '#7C3AED',
        fillBot: '#4C1D95',
        edge: '#E9D5FF',
        glow: '#A78BFA',
        // 3. ТРЁХЗУБАЯ КРИСТАЛЛИЧЕСКАЯ ДРУЗА (3 сросшихся острых пика разной высоты)
        outer: [
            { x: -13.5, y: -5.5 }, // Левый пик
            { x: -5.5, y: -3.5 },  // Левая впадина
            { x: -0.5, y: -17 },   // Главный центральный шпиль
            { x: 5.5, y: -4.5 },   // Правая впадина
            { x: 14, y: -8.5 },    // Правый пик
            { x: 11.5, y: 8.5 },   // Правое основание
            { x: 0, y: 14.5 },     // Нижний центр
            { x: -10.5, y: 9.5 }   // Левое основание
        ],
        inner: [
            { x: -5.5, y: -3.5 },
            { x: -0.5, y: -8.5 },
            { x: 5.5, y: -4.5 },
            { x: 4.5, y: 6.5 },
            { x: -4.5, y: 6.5 }
        ],
        ribs: [[0, 0], [2, 1], [4, 2], [5, 3], [6, 3], [6, 4], [7, 4]]
    },
    {
        id: 'amber',
        name: 'Топаз',
        sub: 'TOPAZ',
        phase: 4.2,
        speed: 0.62,
        fillTop: '#FDE68A',
        fillMid: '#D97706',
        fillBot: '#78350F',
        edge: '#FEF3C7',
        glow: '#FBBF24',
        // 4. КЛАССИЧЕСКИЙ БРИЛЛИАНТ С КОРОНОЙ (Плоский верх и острое клиновидное дно)
        outer: [
            { x: -8.5, y: -12.5 },
            { x: 8.5, y: -12.5 },
            { x: 15.5, y: -3.5 },
            { x: 0, y: 16 },
            { x: -15.5, y: -3.5 }
        ],
        inner: [
            { x: -6, y: -8 },
            { x: 6, y: -8 },
            { x: 8.5, y: -3 },
            { x: 0, y: 6.5 },
            { x: -8.5, y: -3 }
        ],
        ribs: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [0, 4], [1, 2]]
    },
    {
        id: 'cyan',
        name: 'Аквамарин',
        sub: 'AQUAMARINE',
        phase: 5.5,
        speed: 0.65,
        fillTop: '#67E8F9',
        fillMid: '#0891B2',
        fillBot: '#164E63',
        edge: '#CFFAFE',
        glow: '#22D3EE',
        // 5. АСИММЕТРИЧНЫЙ ЛУННЫЙ СЕРП / КРИСТАЛЛ-ПОЛУМЕСЯЦ
        outer: [
            { x: 6, y: -16 },
            { x: -6.5, y: -11.5 },
            { x: -13.5, y: 0 },
            { x: -6.5, y: 12 },
            { x: 6.5, y: 15.5 },
            { x: 11.5, y: 7 },
            { x: 2.5, y: 3.5 },   // Внутренний изгиб серпа
            { x: 2.5, y: -4.5 },  // Внутренний изгиб серпа
            { x: 11.5, y: -8.5 }
        ],
        inner: [
            { x: 3, y: -11 },
            { x: -5, y: -6.5 },
            { x: -7.5, y: 0 },
            { x: -4.5, y: 7.5 },
            { x: 3.5, y: 10.5 }
        ],
        ribs: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [8, 0], [7, 1], [6, 3], [5, 4]]
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

            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            canvas._targetMouseX = Math.max(-1, Math.min(1, (mx - rect.width / 2) / (rect.width / 2)));
            canvas._targetMouseY = Math.max(-1, Math.min(1, (my - rect.height / 2) / (rect.height / 2)));

            if (canvas._dragStartX !== null) {
                const dx = mx - canvas._dragStartX;
                if (Math.abs(dx) > 42) {
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
            if (now - canvas._lastWheelTime < 180) return;
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
        time += 0.0038;
        currentOrbitAngle += (targetOrbitAngle - currentOrbitAngle) * 0.075;

        const canvases = document.querySelectorAll('canvas.gem-field-canvas');
        const currentTheme = appState.settings.accentTheme || 'green';
        const activeStone = FLOATING_STONES.find(s => s.id === currentTheme) || FLOATING_STONES[0];
        const N = FLOATING_STONES.length;
        const stepAngle = (Math.PI * 2) / N;
        const dpr = window.devicePixelRatio || 1;

        canvases.forEach(canvas => {
            bindCanvasEvents(canvas);

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

            // Очень мягкое сглаживание реакции на мышь
            canvas._smoothMouseX += (canvas._targetMouseX - canvas._smoothMouseX) * 0.045;
            canvas._smoothMouseY += (canvas._targetMouseY - canvas._smoothMouseY) * 0.045;

            const camTiltX = canvas._smoothMouseX * 3.0;
            const camTiltY = canvas._smoothMouseY * 1.1;

            const cx = w / 2;
            // Поднимаем центр орбиты выше, чтобы между прицелом и подписью внизу был чистый зазор
            const cy = h / 2 - 16;

            const radiusX = Math.min(162, Math.max(112, w * 0.30));
            const radiusZ = 76;
            const fov = 250;

            // 1. Орбитальное кольцо и перспективные линии пола
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cx - camTiltX * 0.25, cy + 22, radiusX * 1.02, 10, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.beginPath();
            for (let gx = -160; gx <= 160; gx += 40) {
                ctx.moveTo(cx + gx * 0.65 - camTiltX * 0.2, h - 22);
                ctx.lineTo(cx + gx * 1.1 + camTiltX * 0.3, h);
            }
            ctx.stroke();
            ctx.restore();

            // 2. Вычисление 3D-координат камней на орбите
            const projected = FLOATING_STONES.map((st, idx) => {
                const theta = idx * stepAngle + currentOrbitAngle;
                const sinT = Math.sin(theta);
                const cosT = Math.cos(theta);

                const isSelected = st.id === currentTheme;
                const isHovered = canvas._hoverId === st.id;

                const targetHoverScale = isSelected ? 1.04 : isHovered ? 0.96 : 0.82;
                const prevScale = canvas._hoverScales[st.id] ?? targetHoverScale;
                const smoothItemScale = prevScale + (targetHoverScale - prevScale) * 0.08;
                canvas._hoverScales[st.id] = smoothItemScale;

                const bobY = Math.sin(time * st.speed + st.phase) * 2.0;
                const driftX = Math.cos(time * 0.5 * st.speed + st.phase) * 0.9;
                const swayAngle = Math.sin(time * 0.4 * st.speed + st.phase) * 0.035;

                const worldX = sinT * radiusX + driftX - camTiltX * cosT;
                const zDepth = (1 - cosT) * radiusZ;
                const worldY = bobY - (1 - cosT) * 4.5 - camTiltY * 0.25;

                const scale3D = fov / (fov + zDepth * 1.35);
                const screenX = cx + worldX * scale3D;
                const screenY = cy + worldY * scale3D;

                const depthAlpha = Math.max(0.24, Math.min(1, 0.32 + (cosT + 1) * 0.36));

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
                    hitRadius: 24 * scale3D,
                    isSelected,
                    isHovered
                };
            });

            canvas._renderedGems = projected;
            projected.sort((a, b) => b.zDepth - a.zDepth);

            // 3. Рисуем задние и передние камни
            projected.forEach(item => {
                const { st, screenX, screenY, scale3D, smoothItemScale, bobY, swayAngle, depthAlpha, isSelected, isHovered } = item;

                ctx.save();
                ctx.globalAlpha = isHovered ? Math.min(1, depthAlpha + 0.2) : depthAlpha;

                // Тень под камнем
                const shadowY = screenY + 21 * scale3D;
                const shadowRx = Math.max(4, (10 - bobY * 0.25) * scale3D);
                ctx.beginPath();
                ctx.ellipse(screenX, shadowY, shadowRx, 2.0 * scale3D, 0, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? st.glow + '45' : 'rgba(0, 0, 0, 0.45)';
                ctx.fill();

                // Мягкое свечение
                if (isSelected || isHovered) {
                    const glowR = (isSelected ? 24 : 16) * scale3D;
                    const gradGlow = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, glowR);
                    gradGlow.addColorStop(0, st.glow + (isSelected ? '50' : '28'));
                    gradGlow.addColorStop(1, st.glow + '00');
                    ctx.fillStyle = gradGlow;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, glowR, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Отрисовка уникальной формы кристалла
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

                const bodyGrad = ctx.createLinearGradient(-12, -16, 12, 16);
                bodyGrad.addColorStop(0, st.fillTop);
                bodyGrad.addColorStop(0.52, st.fillMid);
                bodyGrad.addColorStop(1, st.fillBot);
                ctx.fillStyle = bodyGrad;
                ctx.fill();

                ctx.strokeStyle = isSelected ? '#FFFFFF' : st.edge;
                ctx.lineWidth = isSelected ? 1.25 : 0.85;
                ctx.stroke();

                // Внутренние грани по индивидуальной карте ребер камня
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
                ctx.lineWidth = 0.65;
                ctx.beginPath();
                if (st.ribs) {
                    st.ribs.forEach(([oIdx, iIdx]) => {
                        const outPt = st.outer[oIdx];
                        const inPt = st.inner[iIdx];
                        if (outPt && inPt) {
                            ctx.moveTo(outPt.x, outPt.y);
                            ctx.lineTo(inPt.x, inPt.y);
                        }
                    });
                }
                ctx.stroke();

                // Внутренняя световая грань
                ctx.beginPath();
                st.inner.forEach((pt, pIdx) => {
                    if (pIdx === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.closePath();
                ctx.fillStyle = st.fillTop + (isSelected ? '82' : '42');
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 0.6;
                ctx.stroke();
                ctx.restore();

                // Подписи для невыбранных камней (а для выбранного камня подпись рисуется отдельно под рамкой прицела)
                if (!isSelected) {
                    const labelY = screenY + 26 * scale3D;
                    const fontSize = Math.max(8, Math.round(9.5 * scale3D));
                    ctx.font = `500 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const textTitle = st.name;
                    const textW = ctx.measureText(textTitle).width;
                    const pillW = textW + 10 * scale3D;
                    const pillH = 13 * scale3D;

                    drawRoundedBadge(ctx, screenX - pillW / 2, labelY - pillH / 2, pillW, pillH, 4 * scale3D);
                    ctx.fillStyle = 'rgba(14, 14, 18, 0.72)';
                    ctx.fill();
                    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)';
                    ctx.lineWidth = 0.6;
                    ctx.stroke();

                    ctx.fillStyle = isHovered ? '#E4E4E7' : '#94A3B8';
                    ctx.fillText(textTitle, screenX, labelY + 0.3);
                }

                ctx.restore();
            });

            // 4. Прицел-рамка вокруг выбранного кристалла (строго вокруг камня: заканчивается на cy + 19)
            const selX = cx - camTiltX * 0.25;
            const selY = cy;
            const boxW = 42, boxH = 38;
            const halfW = boxW / 2, halfH = boxH / 2;
            const corner = 6.5;

            ctx.save();
            ctx.strokeStyle = activeStone.glow;
            ctx.shadowColor = activeStone.glow;
            ctx.shadowBlur = 8;
            ctx.lineWidth = 1.4;

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

            // 5. Подпись выбранного камня — строго НИЖЕ рамки прицела (на cy + 33, с зазором 7px от нижних уголков)
            const activeLabelY = selY + halfH + 14;
            ctx.font = '700 10.5px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const activeTitle = `✦ ${activeStone.name} ✦`;
            const actTextW = ctx.measureText(activeTitle).width;
            const actPillW = actTextW + 16;
            const actPillH = 16;

            ctx.shadowBlur = 0;
            drawRoundedBadge(ctx, selX - actPillW / 2, activeLabelY - actPillH / 2, actPillW, actPillH, 5);
            ctx.fillStyle = 'rgba(12, 16, 15, 0.95)';
            ctx.fill();
            ctx.strokeStyle = activeStone.glow;
            ctx.lineWidth = 1.1;
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = activeStone.glow;
            ctx.shadowBlur = 5;
            ctx.fillText(activeTitle, selX, activeLabelY + 0.3);

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