// =========================================================================
// МОДУЛЬ: 3D WEBGL РЕАКТОР (THREE.JS) + 3D TILT КАРТОЧЕК
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
    coreWire: null,
    particles: null,
    trafficBoost: 0,
    targetBoost: 0,
    mouseX: 0,
    mouseY: 0
};

function getThemeHexNumber() {
    const raw = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    return parseInt(raw.replace('#', ''), 16) || 0x4CAF50;
}

function initReactor3D() {
    if (reactor3D.initialized) return;
    if (typeof THREE === 'undefined') return;

    const container = document.getElementById('reactor-container');
    if (!container) return;

    // Если аппаратное ускорение отключено в настройках — оставляем CSS-кольца
    if (appState?.settings?.hardwareAcceleration === false) return;

    try {
        const width = 240;
        const height = 240;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.z = 5.6;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.id = 'reactor-webgl-canvas';
        renderer.domElement.className = 'reactor-webgl-canvas';

        container.insertBefore(renderer.domElement, container.firstChild);
        container.classList.add('webgl-ready');

        const accentHex = getThemeHexNumber();

        // 1. Внешнее карданово кольцо
        const geoOuter = new THREE.TorusGeometry(2.08, 0.022, 16, 90);
        const matOuter = new THREE.MeshBasicMaterial({ color: 0x3A3A40, transparent: true, opacity: 0.65 });
        const ringOuter = new THREE.Mesh(geoOuter, matOuter);
        ringOuter.rotation.x = 0.55;
        scene.add(ringOuter);

        // 2. Среднее энергетическое кольцо (наклонное)
        const geoMid = new THREE.TorusGeometry(1.92, 0.028, 16, 80);
        const matMid = new THREE.MeshBasicMaterial({ color: accentHex, wireframe: true, transparent: true, opacity: 0.25 });
        const ringMid = new THREE.Mesh(geoMid, matMid);
        ringMid.rotation.y = 0.75;
        scene.add(ringMid);

        // 3. Внутреннее скоростное кольцо
        const geoInner = new THREE.TorusGeometry(1.78, 0.018, 12, 64);
        const matInner = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.35 });
        const ringInner = new THREE.Mesh(geoInner, matInner);
        ringInner.rotation.x = -0.65;
        scene.add(ringInner);

        // 4. Геодезическая каркасная сфера вокруг кнопки
        const geoCore = new THREE.IcosahedronGeometry(1.98, 1);
        const matCore = new THREE.MeshBasicMaterial({ color: accentHex, wireframe: true, transparent: true, opacity: 0.08 });
        const coreWire = new THREE.Mesh(geoCore, matCore);
        scene.add(coreWire);

        // 5. Орбитальное облако частиц вокруг реактора
        const pCount = 42;
        const pPositions = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount; i++) {
            const angle = (i / pCount) * Math.PI * 2;
            const radius = 2.02 + (Math.random() - 0.5) * 0.28;
            pPositions[i * 3] = Math.cos(angle) * radius;
            pPositions[i * 3 + 1] = Math.sin(angle) * radius;
            pPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
        const pMat = new THREE.PointsMaterial({ color: accentHex, size: 0.06, transparent: true, opacity: 0.45 });
        const particles = new THREE.Points(pGeo, pMat);
        scene.add(particles);

        // Реакция на движение мыши (легкий параллакс гироскопа)
        container.addEventListener('mousemove', (e) => {
            const r = container.getBoundingClientRect();
            reactor3D.mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
            reactor3D.mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.6;
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
            ringOuter,
            ringMid,
            ringInner,
            coreWire,
            particles
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
    const idleHex = 0x3F3F46;

    reactor3D.ringOuter.material.color.setHex(isRunning ? accentHex : idleHex);
    reactor3D.ringOuter.material.opacity = isRunning ? 0.85 : 0.40;

    reactor3D.ringMid.material.color.setHex(accentHex);
    reactor3D.ringMid.material.opacity = isRunning ? 0.50 : 0.14;

    reactor3D.ringInner.material.color.setHex(isRunning ? accentHex : idleHex);
    reactor3D.ringInner.material.opacity = isRunning ? 0.70 : 0.25;

    reactor3D.coreWire.material.color.setHex(accentHex);
    reactor3D.coreWire.material.opacity = isRunning ? 0.16 : 0.05;

    reactor3D.particles.material.color.setHex(accentHex);
    reactor3D.particles.material.opacity = isRunning ? 0.80 : 0.25;
}

function feedReactor3DTraffic(rxMbps, txMbps) {
    if (!reactor3D.initialized) return;
    const total = (rxMbps || 0) + (txMbps || 0);
    // Плавный буст скорости вращения от сетевой активности (до +3.5x)
    reactor3D.targetBoost = Math.min(3.5, total * 0.12);
}

function animateReactor3D() {
    requestAnimationFrame(animateReactor3D);
    if (!reactor3D.initialized) return;

    // Не рендерим впустую, если открыта не Главная вкладка
    const homeTab = document.getElementById('tab-home');
    if (homeTab && !homeTab.classList.contains('active')) return;

    const isRunning = !!appState.isRunning;
    reactor3D.trafficBoost += (reactor3D.targetBoost - reactor3D.trafficBoost) * 0.08;
    reactor3D.targetBoost *= 0.95;

    const baseSpeed = isRunning ? (0.018 + reactor3D.trafficBoost * 0.015) : 0.004;

    reactor3D.ringOuter.rotation.z += baseSpeed * 0.8;
    reactor3D.ringOuter.rotation.x += (0.55 + reactor3D.mouseY - reactor3D.ringOuter.rotation.x) * 0.06;
    reactor3D.ringOuter.rotation.y += (reactor3D.mouseX - reactor3D.ringOuter.rotation.y) * 0.06;

    reactor3D.ringMid.rotation.x -= baseSpeed * 1.15;
    reactor3D.ringMid.rotation.y += baseSpeed * 0.65;

    reactor3D.ringInner.rotation.z -= baseSpeed * 1.5;
    reactor3D.ringInner.rotation.y -= baseSpeed * 0.4;

    reactor3D.coreWire.rotation.y += baseSpeed * 0.35;
    reactor3D.coreWire.rotation.x += baseSpeed * 0.2;

    reactor3D.particles.rotation.z += baseSpeed * 0.5;

    reactor3D.renderer.render(reactor3D.scene, reactor3D.camera);
}

// Инициализация легкого 3D-наклона (Vanilla-Tilt) для карточек на Главной
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