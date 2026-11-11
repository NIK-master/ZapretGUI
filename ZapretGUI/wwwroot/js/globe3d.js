// =========================================================================
// МОДУЛЬ: 3D ГОЛОГРАФИЧЕСКИЙ ГЛОБУС МАРШРУТИЗАЦИИ В ДИАГНОСТИКЕ (THREE.JS)
// Файл: wwwroot/js/globe3d.js
// =========================================================================

let diagGlobe = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    globeGroup: null,
    arcsGroup: null,
    pulses: [],
    isDragging: false,
    prevX: 0,
    prevY: 0,
    velX: 0.0025,
    velY: 0
};
function latLonToVec3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

const GLOBE_NODES = [
    { id: 'user', name: 'Ваш ПК (РФ)',     lat: 55.75, lon: 37.61, isOrigin: true },
    { id: 'dc2',  name: 'Амстердам (DC2/4)', lat: 52.37, lon: 4.89,  ok: true },
    { id: 'dc1',  name: 'Майами (DC1/3)',   lat: 25.76, lon: -80.19, ok: true },
    { id: 'dc5',  name: 'Сингапур (DC5)',   lat: 1.35,  lon: 103.82, ok: true },
    { id: 'ds',   name: 'Франкфурт (Discord)', lat: 50.11, lon: 8.68, ok: true }
];

function injectGlobe3DViewButton() {
    const btnRadar = document.getElementById('btn-diag-view-radar');
    if (!btnRadar || document.getElementById('btn-diag-view-globe')) return;

    const track = btnRadar.parentElement;
    const btnGlobe = document.createElement('button');
    btnGlobe.id = 'btn-diag-view-globe';
    btnGlobe.className = 'px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-[#888888] hover:text-white transition cursor-pointer flex items-center gap-1.5';
    btnGlobe.innerHTML = `<span class="mdl-icon text-[10px] text-[#60A5FA]">&#xE774;</span><span>3D Глобус</span>`;
    btnGlobe.onclick = () => switchDiagViewWithGlobe('globe');
    track.appendChild(btnGlobe);

    // Вставляем контейнер 3D-глобуса внутрь той же карточки, где лежат #diag-cards-view-wrap и #diag-radar-wrap
    const radarWrap = document.getElementById('diag-radar-wrap');
    if (radarWrap && !document.getElementById('diag-globe3d-wrap')) {
        const globeWrap = document.createElement('div');
        globeWrap.id = 'diag-globe3d-wrap';
        globeWrap.className = 'hidden flex-col items-center justify-center relative overflow-hidden pt-1';
        globeWrap.innerHTML = `
            <div class="w-full flex items-center justify-between mb-2 px-1 z-10">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full dot-online"></span>
                    <span class="text-xs font-bold text-[#E0E0E0] uppercase tracking-wider">Межконтинентальная 3D-карта маршрутов (Telegram DC 1–5 & Discord)</span>
                </div>
                <span class="text-[11px] font-mono text-[#888888]">Зажмите ЛКМ для вращения 3D-сферы</span>
            </div>

            <div class="relative w-full h-[290px] rounded-xl bg-gradient-to-b from-[#07090E] to-[#0D131F] border border-[#222938] flex items-center justify-center overflow-hidden">
                <div id="diag-globe3d-canvas-host" class="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"></div>

                <!-- Плашка-легенда узлов в углу 3D-экрана -->
                <div class="absolute left-3 top-3 bg-[#0B0F17]/85 border border-[#243044] rounded-lg px-3 py-2 text-[10.5px] font-mono text-[#CCCCCC] space-y-1 pointer-events-none backdrop-blur-sm">
                    <div class="text-[10px] text-[#777777] uppercase font-bold mb-1">Активные магистрали:</div>
                    <div id="globe-node-list" class="space-y-1"></div>
                </div>
            </div>

            <div class="w-full flex flex-wrap items-center justify-between text-[11px] font-mono text-[#999999] mt-2.5 px-1">
                <span>📍 Точка исхода: Ваш маршрутизатор</span>
                <div class="flex items-center gap-4">
                    <span><b class="text-[#60A5FA]">●</b> Ваш ПК</span>
                    <span><b class="text-brand">―●</b> Канал открыт (OK)</span>
                    <span><b class="text-[#EF4444]">―✕</b> Блокировка / Таймаут</span>
                </div>
            </div>
        `;
        radarWrap.parentNode.insertBefore(globeWrap, radarWrap.nextSibling);
    }

    // Расширяем штатный переключатель setDiagViewMode из radar.js, чтобы все 3 кнопки работали синхронно
    if (typeof window.setDiagViewMode === 'function' && !window._globeHooked) {
        const origSetMode = window.setDiagViewMode;
        window._globeHooked = true;
        window.setDiagViewMode = function (mode) {
            const globeWrap = document.getElementById('diag-globe3d-wrap');
            const gBtn = document.getElementById('btn-diag-view-globe');
            if (globeWrap) {
                globeWrap.classList.add('hidden');
                globeWrap.classList.remove('flex');
            }
            if (gBtn) {
                gBtn.className = 'px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-[#888888] hover:text-white transition cursor-pointer flex items-center gap-1.5';
            }
            origSetMode(mode);
        };
    }
}

function switchDiagViewWithGlobe(mode) {
    if (mode !== 'globe') {
        if (typeof setDiagViewMode === 'function') setDiagViewMode(mode);
        return;
    }

    sendCmd('playClick');

    // Скрываем ТОЛЬКО внутренние блоки (#diag-cards-view-wrap и #diag-radar-wrap), НЕ пряча родительский .glass-card!
    const cardsWrap = document.getElementById('diag-cards-view-wrap');
    const radarWrap = document.getElementById('diag-radar-wrap');
    const globeWrap = document.getElementById('diag-globe3d-wrap');

    if (cardsWrap) cardsWrap.classList.add('hidden');
    if (radarWrap) {
        radarWrap.classList.add('hidden');
        radarWrap.classList.remove('flex');
    }
    if (globeWrap) {
        globeWrap.classList.remove('hidden');
        globeWrap.classList.add('flex');
    }

    ['btn-diag-view-cards', 'btn-diag-view-radar'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.className = 'px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-[#888888] hover:text-white transition cursor-pointer flex items-center gap-1.5';
    });

    const gBtn = document.getElementById('btn-diag-view-globe');
    if (gBtn) {
        gBtn.className = 'px-2.5 py-0.5 rounded-md bg-[#262626] text-white text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5';
    }

    requestAnimationFrame(() => {
        initDiagGlobe3D();
        rebuildGlobe3DArcs();
    });
}

function initDiagGlobe3D() {
    if (diagGlobe.initialized) return;
    if (typeof THREE === 'undefined') return;

    const host = document.getElementById('diag-globe3d-canvas-host');
    if (!host) return;

    const w = host.clientWidth || 720;
    const h = host.clientHeight || 290;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 1. Темное ядро Земли
    const coreGeo = new THREE.SphereGeometry(1.58, 36, 36);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0A0F18, transparent: true, opacity: 0.95 });
    globeGroup.add(new THREE.Mesh(coreGeo, coreMat));

    // 2. Голографическая сетка параллелей и меридианов
    const wireGeo = new THREE.SphereGeometry(1.60, 28, 20);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1E3A5F, wireframe: true, transparent: true, opacity: 0.45 });
    globeGroup.add(new THREE.Mesh(wireGeo, wireMat));

    // 3. Точечная матрица поверхности планеты (эффект голограммы материков)
    const dotsCount = 360;
    const dotPositions = new Float32Array(dotsCount * 3);
    for (let i = 0; i < dotsCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / dotsCount);
        const theta = Math.sqrt(dotsCount * Math.PI) * phi;
        const r = 1.61;
        dotPositions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
        dotPositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        dotPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const dotsGeo = new THREE.BufferGeometry();
    dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
    const dotsMat = new THREE.PointsMaterial({ color: 0x38BDF8, size: 0.028, transparent: true, opacity: 0.35 });
    globeGroup.add(new THREE.Points(dotsGeo, dotsMat));

    // 4. Внешнее орбитальное кольцо атмосферы
    const ringGeo = new THREE.RingGeometry(1.76, 1.78, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(ringGeo, ringMat));

    const arcsGroup = new THREE.Group();
    globeGroup.add(arcsGroup);

    // Начальный поворот лицом к Европе / РФ
    globeGroup.rotation.y = -0.65;
    globeGroup.rotation.x = 0.32;

    const canvasEl = renderer.domElement;
    canvasEl.style.touchAction = 'none';

    canvasEl.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        diagGlobe.isDragging = true;
        diagGlobe.prevX = e.clientX;
        diagGlobe.prevY = e.clientY;
        diagGlobe.velX = 0;
        diagGlobe.velY = 0;
        try { canvasEl.setPointerCapture(e.pointerId); } catch { }
    });

    canvasEl.addEventListener('pointermove', e => {
        if (!diagGlobe.isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - diagGlobe.prevX;
        const dy = e.clientY - diagGlobe.prevY;
        diagGlobe.prevX = e.clientX;
        diagGlobe.prevY = e.clientY;

        diagGlobe.velX = dx * 0.0065;
        diagGlobe.velY = dy * 0.0065;

        applyGlobeQuaternionDelta(diagGlobe.velX, diagGlobe.velY);
    });

    const stopGlobeDrag = (e) => {
        if (!diagGlobe.isDragging) return;
        diagGlobe.isDragging = false;
        try { canvasEl.releasePointerCapture(e.pointerId); } catch { }
    };

    canvasEl.addEventListener('pointerup', stopGlobeDrag);
    canvasEl.addEventListener('pointercancel', stopGlobeDrag);

    Object.assign(diagGlobe, {
        initialized: true,
        scene,
        camera,
        renderer,
        globeGroup,
        arcsGroup
    });

    rebuildGlobe3DArcs();
    animateDiagGlobe3D();
}

function rebuildGlobe3DArcs() {
    if (!diagGlobe.initialized) return;

    while (diagGlobe.arcsGroup.children.length > 0) {
        const ch = diagGlobe.arcsGroup.children[0];
        diagGlobe.arcsGroup.remove(ch);
    }
    diagGlobe.pulses = [];

    const radius = 1.62;
    const originPos = latLonToVec3(GLOBE_NODES[0].lat, GLOBE_NODES[0].lon, radius);

    // Маяк пользователя (синий)
    const userDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0x60A5FA })
    );
    userDot.position.copy(originPos);
    diagGlobe.arcsGroup.add(userDot);

    const accentHex = typeof getThemeHexNumber === 'function' ? getThemeHexNumber() : 0x4CAF50;
    const legendHtml = [];

    for (let i = 1; i < GLOBE_NODES.length; i++) {
        const node = GLOBE_NODES[i];
        const targetPos = latLonToVec3(node.lat, node.lon, radius);
        const colorHex = node.ok ? accentHex : 0xEF4444;

        const dcDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 14, 14),
            new THREE.MeshBasicMaterial({ color: colorHex })
        );
        dcDot.position.copy(targetPos);
        diagGlobe.arcsGroup.add(dcDot);

        const midPos = originPos.clone().add(targetPos).multiplyScalar(0.5).normalize().multiplyScalar(radius + 0.52);
        const curve = new THREE.QuadraticBezierCurve3(originPos, midPos, targetPos);
        const points = curve.getPoints(40);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.75 });
        diagGlobe.arcsGroup.add(new THREE.Line(lineGeo, lineMat));

        const pulseMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
        );
        diagGlobe.arcsGroup.add(pulseMesh);
        diagGlobe.pulses.push({
            mesh: pulseMesh,
            curve,
            t: (i * 0.23) % 1.0,
            speed: node.ok ? 0.011 : 0.0035
        });

        const dotCls = node.ok ? 'text-brand' : 'text-[#EF4444]';
        const statusStr = node.ok ? 'ONLINE' : 'BLOCK';
        legendHtml.push(`<div class="flex items-center justify-between gap-3"><span>${node.name}</span><span class="${dotCls} font-bold">${statusStr}</span></div>`);
    }

    const legEl = document.getElementById('globe-node-list');
    if (legEl) legEl.innerHTML = legendHtml.join('');
}

function syncGlobe3DWithDiagReport(report) {
    if (!report) return;
    const dcs = report.dcResults || [];
    const ds = report.discordPing || [];

    const dc13 = dcs.filter(x => x.dcId === 1 || x.dcId === 3);
    const dc24 = dcs.filter(x => x.dcId === 2 || x.dcId === 4);
    const dc5 = dcs.filter(x => x.dcId === 5);

    if (dc24.length) GLOBE_NODES[1].ok = dc24.some(x => x.ok);
    if (dc13.length) GLOBE_NODES[2].ok = dc13.some(x => x.ok);
    if (dc5.length)  GLOBE_NODES[3].ok = dc5.some(x => x.ok);
    if (ds.length)   GLOBE_NODES[4].ok = ds.some(x => x.ok);

    rebuildGlobe3DArcs();
}

function applyGlobeQuaternionDelta(deltaX, deltaY) {
    if (!diagGlobe.globeGroup) return;

    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY);

    diagGlobe.globeGroup.quaternion.premultiply(qY);
    diagGlobe.globeGroup.quaternion.premultiply(qX);
}

function animateDiagGlobe3D() {
    requestAnimationFrame(animateDiagGlobe3D);
    if (!diagGlobe.initialized) return;

    const wrap = document.getElementById('diag-globe3d-wrap');
    if (!wrap || wrap.classList.contains('hidden')) return;

    const host = document.getElementById('diag-globe3d-canvas-host');
    if (host && host.clientWidth > 100) {
        const w = host.clientWidth;
        const h = host.clientHeight || 290;
        if (Math.abs(diagGlobe.renderer.domElement.width / (window.devicePixelRatio || 1) - w) > 5) {
            diagGlobe.renderer.setSize(w, h);
            diagGlobe.camera.aspect = w / h;
            diagGlobe.camera.updateProjectionMatrix();
        }
    }

    // Свободная инерция после отпускания мыши + легкое авто-вращение
    if (!diagGlobe.isDragging) {
        diagGlobe.velX = diagGlobe.velX * 0.94 + 0.0022 * 0.06;
        diagGlobe.velY = diagGlobe.velY * 0.92;
        applyGlobeQuaternionDelta(diagGlobe.velX, diagGlobe.velY);
    }

    diagGlobe.pulses.forEach(p => {
        p.t += p.speed;
        if (p.t > 1) p.t = 0;
        const pos = p.curve.getPoint(p.t);
        p.mesh.position.copy(pos);
    });

    diagGlobe.renderer.render(diagGlobe.scene, diagGlobe.camera);
}