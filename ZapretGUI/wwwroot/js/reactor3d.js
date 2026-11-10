// =========================================================================
// МОДУЛЬ: 3D WEBGL РЕАКТОР 2.0 (КАРДАНОВЫ ДУГИ С МАЯЧКАМИ) + 3D TILT
// Файл: wwwroot/js/reactor3d.js
// =========================================================================

let reactor3D = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    gimbalOuter: null,
    gimbalMid: null,
    gimbalInner: null,
    particles: null,
    coloredMaterials: [],
    trafficBoost: 0,
    targetBoost: 0,
    mouseX: 0,
    mouseY: 0
};

function getThemeHexNumber() {
    const raw = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    return parseInt(raw.replace('#', ''), 16) || 0x4CAF50;
}

// Создает технологичное прерывистое кольцо из дуг и ярких узелков-маячков,
// чтобы вращение было отчетливо видно под любым углом
function createSegmentedTechRing(radius, tubeThickness, segmentsCount, arcRatio, markerSize, matRing, matMarker) {
    const group = new THREE.Group();
    const stepAngle = (Math.PI * 2) / segmentsCount;
    const arcLength = stepAngle * arcRatio;

    for (let i = 0; i < segmentsCount; i++) {
        const startAngle = i * stepAngle;

        // Дуга сегмента
        const arcGeo = new THREE.TorusGeometry(radius, tubeThickness, 10, 28, arcLength);
        const arcMesh = new THREE.Mesh(arcGeo, matRing);
        arcMesh.rotation.z = startAngle;
        group.add(arcMesh);

        // Светящийся узелок-маячок в начале каждого сегмента
        if (markerSize > 0) {
            const dotGeo = new THREE.SphereGeometry(markerSize, 10, 10);
            const dotMesh = new THREE.Mesh(dotGeo, matMarker);
            dotMesh.position.set(
                Math.cos(startAngle) * radius,
                Math.sin(startAngle) * radius,
                0
            );
            group.add(dotMesh);
        }
    }

    return group;
}

function initReactor3D() {
    if (reactor3D.initialized) return;
    if (typeof THREE === 'undefined') return;

    const container = document.getElementById('reactor-container');
    if (!container) return;

    if (appState?.settings?.hardwareAcceleration === false) return;

    try {
        const size = 246;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.z = 6.0;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(size, size);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.id = 'reactor-webgl-canvas';
        renderer.domElement.className = 'reactor-webgl-canvas';

        container.insertBefore(renderer.domElement, container.firstChild);
        container.classList.add('webgl-ready');

        const idleHex = 0x3A3A42;

        // Материалы (все хранятся в массиве и строго переключаются между Серым и Акцентным)
        const matOuterRing = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.55 });
        const matOuterDots = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.85 });

        const matMidRing = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.45 });
        const matMidDots = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.80 });

        const matInnerRing = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.40 });
        const matInnerDots = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.75 });

        const matParticles = new THREE.PointsMaterial({ color: idleHex, size: 0.055, transparent: true, opacity: 0.35 });

        // 1. Внешний контур (4 длинные дуги + 4 маячка) — обрамляет кнопку снаружи
        const gimbalOuter = createSegmentedTechRing(2.14, 0.022, 4, 0.68, 0.048, matOuterRing, matOuterDots);
        gimbalOuter.rotation.x = 0.32;
        gimbalOuter.rotation.y = -0.22;
        scene.add(gimbalOuter);

        // 2. Средний гироскоп (6 пунктирных дуг + 6 маячков под углом)
        const gimbalMid = createSegmentedTechRing(1.98, 0.018, 6, 0.55, 0.038, matMidRing, matMidDots);
        gimbalMid.rotation.x = -0.48;
        gimbalMid.rotation.y = 0.42;
        scene.add(gimbalMid);

        // 3. Внутреннее скоростное кольцо (8 коротких импульсов)
        const gimbalInner = createSegmentedTechRing(1.84, 0.015, 8, 0.45, 0.030, matInnerRing, matInnerDots);
        gimbalInner.rotation.x = 0.52;
        gimbalInner.rotation.y = 0.35;
        scene.add(gimbalInner);

        // 4. Кольцо орбитальных частиц вокруг реактора
        const pCount = 36;
        const pPositions = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount; i++) {
            const angle = (i / pCount) * Math.PI * 2;
            const r = 2.24 + (i % 2 === 0 ? 0.05 : -0.05);
            pPositions[i * 3] = Math.cos(angle) * r;
            pPositions[i * 3 + 1] = Math.sin(angle) * r;
            pPositions[i * 3 + 2] = ((i % 3) - 1) * 0.15;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
        const particles = new THREE.Points(pGeo, matParticles);
        scene.add(particles);

        container.addEventListener('mousemove', (e) => {
            const r = container.getBoundingClientRect();
            reactor3D.mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.55;
            reactor3D.mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.55;
        });
        container.addEventListener('mouseleave', () => {
            reactor3D.mouseX = 0;
            reactor3D.mouseY = 0;
        });

        Object.assign(reactor3D, {
            initialized: true,
            scene,
            camera,
            renderer,
            gimbalOuter,
            gimbalMid,
            gimbalInner,
            particles,
            coloredMaterials: [
                { mat: matOuterRing, onOp: 0.85, offOp: 0.38 },
                { mat: matOuterDots, onOp: 1.00, offOp: 0.55 },
                { mat: matMidRing, onOp: 0.65, offOp: 0.28 },
                { mat: matMidDots, onOp: 0.95, offOp: 0.45 },
                { mat: matInnerRing, onOp: 0.55, offOp: 0.22 },
                { mat: matInnerDots, onOp: 0.90, offOp: 0.40 },
                { mat: matParticles, onOp: 0.75, offOp: 0.20 }
            ]
        });

        syncReactor3DThemeAndState();
        animateReactor3D();
    } catch (err) {
        console.warn('WebGL Reactor fallback to CSS:', err);
    }
}

function syncReactor3DThemeAndState() {
    if (!reactor3D.initialized) return;

    const isRunning = !!appState.isRunning;
    const accentHex = getThemeHexNumber();
    const idleHex = 0x3A3A42; // Строгий нейтрально-серый цвет при выключенном обходе
    const targetHex = isRunning ? accentHex : idleHex;

    reactor3D.coloredMaterials.forEach(item => {
        item.mat.color.setHex(targetHex);
        item.mat.opacity = isRunning ? item.onOp : item.offOp;
    });
}

function feedReactor3DTraffic(rxMbps, txMbps) {
    if (!reactor3D.initialized) return;
    const total = (rxMbps || 0) + (txMbps || 0);
    reactor3D.targetBoost = Math.min(3.5, total * 0.12);
}

function animateReactor3D() {
    requestAnimationFrame(animateReactor3D);
    if (!reactor3D.initialized) return;

    const homeTab = document.getElementById('tab-home');
    if (homeTab && !homeTab.classList.contains('active')) return;

    const isRunning = !!appState.isRunning;
    reactor3D.trafficBoost += (reactor3D.targetBoost - reactor3D.trafficBoost) * 0.08;
    reactor3D.targetBoost *= 0.94;

    // В выключенном режиме медленное плавное вращение, во включенном — бодрое + ускорение от трафика
    const speed = isRunning ? (0.016 + reactor3D.trafficBoost * 0.016) : 0.0035;

    // Вращение каждой группы вокруг своей собственной оси Z (видно благодаря сегментам и маячкам)
    // плюс плавное 3D-покачивание плоскостей кардана
    reactor3D.gimbalOuter.rotation.z += speed * 0.9;
    reactor3D.gimbalOuter.rotation.x += (0.32 + reactor3D.mouseY - reactor3D.gimbalOuter.rotation.x) * 0.06;
    reactor3D.gimbalOuter.rotation.y += (-0.22 + reactor3D.mouseX - reactor3D.gimbalOuter.rotation.y) * 0.06;

    reactor3D.gimbalMid.rotation.z -= speed * 1.35;
    reactor3D.gimbalMid.rotation.x = -0.48 + Math.sin(Date.now() * 0.0012) * 0.18;
    reactor3D.gimbalMid.rotation.y = 0.42 + Math.cos(Date.now() * 0.0010) * 0.18;

    reactor3D.gimbalInner.rotation.z += speed * 1.85;
    reactor3D.gimbalInner.rotation.x = 0.52 + Math.cos(Date.now() * 0.0015) * 0.22;

    reactor3D.particles.rotation.z -= speed * 0.45;

    reactor3D.renderer.render(reactor3D.scene, reactor3D.camera);
}

function refreshCardsTiltEffect() {
    if (typeof VanillaTilt === 'undefined') return;
    if (appState?.settings?.focusMode) return;

    const targets = document.querySelectorAll('#home-stats-panel, #home-cards-col .glass-card');
    targets.forEach(el => {
        if (!el._tiltInitialized) {
            VanillaTilt.init(el, {
                max: 3.5,
                speed: 400,
                glare: true,
                'max-glare': 0.06,
                scale: 1.01
            });
            el._tiltInitialized = true;
        }
    });
}