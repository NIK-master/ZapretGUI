// =========================================================================
// МОДУЛЬ: 3D WEBGL РЕАКТОР 3.0 (ЧИСТЫЕ ТЕХНО-ДУГИ БЕЗ РЫВКОВ И ШАРИКОВ)
// Файл: wwwroot/js/reactor3d.js
// =========================================================================

let reactor3D = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    ringOuter: null,
    ringMid: null,
    ringInner: null,
    coloredMaterials: [],
    lastRunningState: null,
    lastThemeHex: null,
    targetColorObj: null,
    pulseScale: 1.0,
    pulseVelocity: 0,
    currentSpeed: 0.0025,
    trafficBoost: 0,
    targetBoost: 0
};

function getThemeHexNumber() {
    const raw = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    return parseInt(raw.replace('#', ''), 16) || 0x4CAF50;
}

// Создает чистое прерывистое кольцо из плоских дуг (без лишних шариков и частиц)
function createCleanArcRing(radius, tubeThickness, segmentsCount, arcRatio, material) {
    const group = new THREE.Group();
    const stepAngle = (Math.PI * 2) / segmentsCount;
    const arcLength = stepAngle * arcRatio;

    for (let i = 0; i < segmentsCount; i++) {
        const startAngle = i * stepAngle;
        const arcGeo = new THREE.TorusGeometry(radius, tubeThickness, 12, 40, arcLength);
        const arcMesh = new THREE.Mesh(arcGeo, material);
        arcMesh.rotation.z = startAngle;
        group.add(arcMesh);
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
        const size = 240;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.z = 5.8;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(size, size);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.id = 'reactor-webgl-canvas';
        renderer.domElement.className = 'reactor-webgl-canvas';

        container.insertBefore(renderer.domElement, container.firstChild);
        container.classList.add('webgl-ready');

        const idleHex = 0x3A3A42;

        const matOuter = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.45 });
        const matMid = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.32 });
        const matInner = new THREE.MeshBasicMaterial({ color: idleHex, transparent: true, opacity: 0.25 });

        // 1. Внешнее кольцо (4 длинные техно-дуги)
        const ringOuter = createCleanArcRing(2.05, 0.018, 4, 0.76, matOuter);
        scene.add(ringOuter);

        // 2. Среднее кольцо (3 длинные дуги, вращается в обратную сторону)
        const ringMid = createCleanArcRing(1.94, 0.015, 3, 0.72, matMid);
        scene.add(ringMid);

        // 3. Внутреннее кольцо (6 аккуратных штрихов у самого края кнопки)
        const ringInner = createCleanArcRing(1.84, 0.012, 6, 0.60, matInner);
        scene.add(ringInner);

        Object.assign(reactor3D, {
            initialized: true,
            scene,
            camera,
            renderer,
            ringOuter,
            ringMid,
            ringInner,
            coloredMaterials: [
                { mat: matOuter, onOp: 0.88, offOp: 0.42 },
                { mat: matMid, onOp: 0.65, offOp: 0.28 },
                { mat: matInner, onOp: 0.50, offOp: 0.20 }
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
    const idleHex = 0x3A3A42;

    reactor3D.targetColorObj = new THREE.Color(isRunning ? accentHex : idleHex);

    // Импульс срабатывает ТОЛЬКО тогда, когда статус запуска реально изменился!
    if (reactor3D.lastRunningState !== null && reactor3D.lastRunningState !== isRunning) {
        reactor3D.pulseVelocity = isRunning ? 0.045 : -0.032;
    }
    reactor3D.lastRunningState = isRunning;
    reactor3D.lastThemeHex = accentHex;
}

function feedReactor3DTraffic(rxMbps, txMbps) {
    if (!reactor3D.initialized) return;
    const total = (rxMbps || 0) + (txMbps || 0);
    reactor3D.targetBoost = Math.min(3.0, total * 0.10);
}

function animateReactor3D() {
    requestAnimationFrame(animateReactor3D);
    if (!reactor3D.initialized) return;

    const homeTab = document.getElementById('tab-home');
    if (homeTab && !homeTab.classList.contains('active')) return;

    const isRunning = !!appState.isRunning;
    if (!reactor3D.targetColorObj) {
        reactor3D.targetColorObj = new THREE.Color(isRunning ? getThemeHexNumber() : 0x3A3A42);
    }

    // 1. Плавный переход цвета и прозрачности
    reactor3D.coloredMaterials.forEach(item => {
        item.mat.color.lerp(reactor3D.targetColorObj, 0.08);
        const targetOp = isRunning ? item.onOp : item.offOp;
        item.mat.opacity += (targetOp - item.mat.opacity) * 0.08;
    });

    // 2. Мягкий упругий импульс только при клике на Вкл/Выкл
    reactor3D.pulseScale += reactor3D.pulseVelocity;
    reactor3D.pulseVelocity = (reactor3D.pulseVelocity + (1.0 - reactor3D.pulseScale) * 0.16) * 0.80;
    if (Math.abs(1.0 - reactor3D.pulseScale) < 0.0005 && Math.abs(reactor3D.pulseVelocity) < 0.0005) {
        reactor3D.pulseScale = 1.0;
        reactor3D.pulseVelocity = 0;
    }

    const s = reactor3D.pulseScale;
    reactor3D.ringOuter.scale.set(s, s, 1);
    reactor3D.ringMid.scale.set(s, s, 1);
    reactor3D.ringInner.scale.set(s, s, 1);

    // 3. Абсолютно плавное вращение без рывков
    reactor3D.trafficBoost += (reactor3D.targetBoost - reactor3D.trafficBoost) * 0.06;
    reactor3D.targetBoost *= 0.94;

    const targetSpeed = isRunning ? (0.012 + reactor3D.trafficBoost * 0.012) : 0.0022;
    reactor3D.currentSpeed += (targetSpeed - reactor3D.currentSpeed) * 0.05;
    const sp = reactor3D.currentSpeed;

    reactor3D.ringOuter.rotation.z += sp * 0.85;
    reactor3D.ringMid.rotation.z -= sp * 1.25;
    reactor3D.ringInner.rotation.z += sp * 1.65;

    // Едва заметное плавное 3D-дыхание плоскостей во включенном состоянии
    const tiltAmp = isRunning ? 0.22 : 0.08;
    const t = performance.now() * 0.0008;
    reactor3D.ringOuter.rotation.x += (Math.sin(t) * tiltAmp - reactor3D.ringOuter.rotation.x) * 0.05;
    reactor3D.ringOuter.rotation.y += (Math.cos(t) * tiltAmp - reactor3D.ringOuter.rotation.y) * 0.05;

    reactor3D.ringMid.rotation.x += (-Math.cos(t * 1.2) * (tiltAmp * 1.1) - reactor3D.ringMid.rotation.x) * 0.05;
    reactor3D.ringMid.rotation.y += (Math.sin(t * 1.2) * (tiltAmp * 1.1) - reactor3D.ringMid.rotation.y) * 0.05;

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