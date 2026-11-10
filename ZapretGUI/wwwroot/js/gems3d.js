// =========================================================================
// МОДУЛЬ: 3D WEBGL КАРУСЕЛЬ ГРАНЕНЫХ КРИСТАЛЛОВ ТЕМ (THREE.JS)
// Файл: wwwroot/js/gems3d.js
// =========================================================================

let gems3D = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    crystalGroups: [],
    currentAngle: 0,
    targetAngle: 0,
    isDragging: false,
    dragStartX: 0,
    dragMoved: 0
};

const GEMS_3D_DATA = [
    { id: 'green',  name: 'Изумруд (Green)',   color: 0x4CAF50, emissive: 0x107C10, scaleY: 1.35 },
    { id: 'blue',   name: 'Сапфир (Blue)',     color: 0x60A5FA, emissive: 0x0078D7, scaleY: 1.25 },
    { id: 'purple', name: 'Аметист (Purple)',  color: 0xA78BFA, emissive: 0x7C3AED, scaleY: 1.40 },
    { id: 'amber',  name: 'Янтарь (Amber)',    color: 0xFBBF24, emissive: 0xD97706, scaleY: 1.20 },
    { id: 'pink',   name: 'Кварц (Pink)',      color: 0xF472B6, emissive: 0xDB2777, scaleY: 1.30 }
];

function initGems3DShowcase() {
    if (gems3D.initialized) return;
    if (typeof THREE === 'undefined') return;
    if (appState?.settings?.hardwareAcceleration === false) return;

    const oldCanvas = document.getElementById('gem-field-canvas');
    if (!oldCanvas || !oldCanvas.parentElement) return;

    const wrap = oldCanvas.parentElement;
    const w = wrap.clientWidth || 440;
    const h = wrap.clientHeight || 108;

    try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
        camera.position.set(0, 0.35, 6.2);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.className = 'gem-field-canvas';

        // Прячем старый 2D-холст и ставим на его место WebGL-сцену
        oldCanvas.style.display = 'none';
        wrap.insertBefore(renderer.domElement, oldCanvas);

        // Освещение для ярких граней кристаллов
        scene.add(new THREE.AmbientLight(0xffffff, 0.65));

        const keyLight = new THREE.PointLight(0xffffff, 1.6, 20);
        keyLight.position.set(3, 4, 5);
        scene.add(keyLight);

        const rimLight = new THREE.PointLight(0x60A5FA, 1.0, 15);
        rimLight.position.set(-4, -2, 3);
        scene.add(rimLight);

        const crystalGroups = [];
        const step = (Math.PI * 2) / GEMS_3D_DATA.length;

        GEMS_3D_DATA.forEach((gem, idx) => {
            const group = new THREE.Group();

            // 1. Граненое тело кристалла (Low-Poly FlatShading)
            const bodyGeo = new THREE.OctahedronGeometry(0.62, 0);
            bodyGeo.scale(0.82, gem.scaleY, 0.82);
            const bodyMat = new THREE.MeshStandardMaterial({
                color: gem.color,
                emissive: gem.emissive,
                emissiveIntensity: 0.42,
                roughness: 0.15,
                metalness: 0.35,
                flatShading: true,
                transparent: true,
                opacity: 0.92
            });
            const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
            group.add(bodyMesh);

            // 2. Внешняя голографическая оправа граней
            const wireGeo = new THREE.OctahedronGeometry(0.66, 0);
            wireGeo.scale(0.84, gem.scaleY, 0.84);
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.25
            });
            const wireMesh = new THREE.Mesh(wireGeo, wireMat);
            group.add(wireMesh);

            // 3. Орбитальное кольцо вокруг активного кристалла
            const haloGeo = new THREE.TorusGeometry(0.82, 0.018, 8, 36);
            const haloMat = new THREE.MeshBasicMaterial({
                color: gem.color,
                transparent: true,
                opacity: 0
            });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            haloMesh.rotation.x = Math.PI / 2.3;
            group.add(haloMesh);

            scene.add(group);
            crystalGroups.push({
                data: gem,
                index: idx,
                baseAngle: idx * step,
                group,
                bodyMesh,
                wireMesh,
                haloMesh,
                bodyMat,
                wireMat,
                haloMat
            });
        });

        // Интерактив: перетаскивание, клик по кристаллу и колесико мыши
        const glCanvas = renderer.domElement;
        glCanvas.addEventListener('pointerdown', e => {
            gems3D.isDragging = true;
            gems3D.dragStartX = e.clientX;
            gems3D.dragMoved = 0;
            try { glCanvas.setPointerCapture(e.pointerId); } catch { }
        });

        glCanvas.addEventListener('pointermove', e => {
            if (!gems3D.isDragging) return;
            const dx = e.clientX - gems3D.dragStartX;
            gems3D.dragStartX = e.clientX;
            gems3D.dragMoved += Math.abs(dx);
            gems3D.targetAngle += dx * 0.011;
        });

        glCanvas.addEventListener('pointerup', e => {
            if (!gems3D.isDragging) return;
            gems3D.isDragging = false;
            try { glCanvas.releasePointerCapture(e.pointerId); } catch { }

            if (gems3D.dragMoved < 6) {
                // Клик по левой или правой части сцены прокручивает к соседнему кристаллу
                const rect = glCanvas.getBoundingClientRect();
                const relX = (e.clientX - rect.left) / rect.width;
                if (relX < 0.36) cycleGemTheme(-1);
                else if (relX > 0.64) cycleGemTheme(1);
            } else {
                snapGems3DToNearest();
            }
        });

        glCanvas.addEventListener('wheel', e => {
            e.preventDefault();
            cycleGemTheme(e.deltaY > 0 ? 1 : -1);
        }, { passive: false });

        Object.assign(gems3D, {
            initialized: true,
            scene,
            camera,
            renderer,
            crystalGroups
        });

        syncGems3DWithActiveTheme(appState?.settings?.accentTheme || 'green', true);
        animateGems3D();
    } catch (err) {
        console.warn('Gems3D fallback to 2D:', err);
    }
}

function syncGems3DWithActiveTheme(themeId, instant = false) {
    if (!gems3D.initialized) return;
    const norm = (themeId === 'crimson' || themeId === 'cyan') ? 'pink' : (themeId || 'green');
    const idx = GEMS_3D_DATA.findIndex(g => g.id === norm);
    if (idx < 0) return;

    const step = (Math.PI * 2) / GEMS_3D_DATA.length;
    const desired = -idx * step;

    // Выбираем кратчайший путь поворота по кругу
    let diff = (desired - gems3D.targetAngle) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    gems3D.targetAngle += diff;
    if (instant) gems3D.currentAngle = gems3D.targetAngle;
}

function snapGems3DToNearest() {
    const step = (Math.PI * 2) / GEMS_3D_DATA.length;
    const rawIdx = Math.round(-gems3D.targetAngle / step);
    const normIdx = ((rawIdx % GEMS_3D_DATA.length) + GEMS_3D_DATA.length) % GEMS_3D_DATA.length;
    const chosen = GEMS_3D_DATA[normIdx];
    if (chosen && typeof selectAccentTheme === 'function') {
        selectAccentTheme(chosen.id);
    }
}

function animateGems3D() {
    requestAnimationFrame(animateGems3D);
    if (!gems3D.initialized) return;

    const setTab = document.getElementById('tab-settings');
    if (setTab && !setTab.classList.contains('active')) return;

    const wrap = gems3D.renderer.domElement.parentElement;
    if (wrap && wrap.clientWidth > 100) {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight || 108;
        if (Math.abs(gems3D.renderer.domElement.width / (window.devicePixelRatio || 1) - w) > 4) {
            gems3D.renderer.setSize(w, h);
            gems3D.camera.aspect = w / h;
            gems3D.camera.updateProjectionMatrix();
        }
    }

    gems3D.currentAngle += (gems3D.targetAngle - gems3D.currentAngle) * 0.12;

    const radiusX = 2.35;
    const radiusZ = 1.15;

    gems3D.crystalGroups.forEach(item => {
        const a = item.baseAngle + gems3D.currentAngle;
        const x = Math.sin(a) * radiusX;
        const z = Math.cos(a) * radiusZ;
        const depthNorm = (z + radiusZ) / (radiusZ * 2); // 1 спереди, 0 сзади

        item.group.position.set(x, Math.sin(Date.now() * 0.0025 + item.index) * 0.06, z);

        const s = 0.55 + depthNorm * 0.52;
        item.group.scale.set(s, s, s);

        item.bodyMesh.rotation.y += 0.012 + depthNorm * 0.012;
        item.wireMesh.rotation.y = item.bodyMesh.rotation.y;
        item.haloMesh.rotation.z -= 0.025;

        item.bodyMat.opacity = 0.35 + depthNorm * 0.62;
        item.wireMat.opacity = depthNorm > 0.85 ? 0.38 : 0.08;
        item.haloMat.opacity = depthNorm > 0.92 ? 0.65 : 0;
    });

    gems3D.renderer.render(gems3D.scene, gems3D.camera);
}