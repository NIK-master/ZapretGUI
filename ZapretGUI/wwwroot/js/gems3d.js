// =========================================================================
// МОДУЛЬ: СТИЛИЗОВАННЫЕ ЮВЕЛИРНЫЕ 3D-САМОЦВЕТЫ (БЕЗ АВТО-ПРОЛИСТЫВАНИЯ)
// Файл: wwwroot/js/gems3d.js
// =========================================================================

let gems3DInstances = [];
let gems3DLoopStarted = false;
let isSyncingGemsInternal = false;

const GEMS_3D_CONFIG = [
    { id: 'green', title: 'Изумруд', eng: 'EMERALD', color: 0x10B981, deep: 0x064E3B, edge: 0x6EE7B7, shape: 'emerald' },
    { id: 'blue', title: 'Сапфир', eng: 'SAPPHIRE', color: 0x3B82F6, deep: 0x1E3A8A, edge: 0x93C5FD, shape: 'sapphire' },
    { id: 'purple', title: 'Аметист', eng: 'AMETHYST', color: 0x9333EA, deep: 0x3B0764, edge: 0xD8B4FE, shape: 'amethyst' },
    { id: 'amber', title: 'Топаз', eng: 'TOPAZ', color: 0xF59E0B, deep: 0x78350F, edge: 0xFDE68A, shape: 'topaz' },
    { id: 'pink', title: 'Морганит', eng: 'MORGANITE', color: 0xEC4899, deep: 0x831843, edge: 0xFBCFE8, shape: 'morganite' }
];

function createQuartzSpire(radius, height) {
    const pts = [
        new THREE.Vector2(0.001, -height * 0.5),
        new THREE.Vector2(radius * 0.85, -height * 0.42),
        new THREE.Vector2(radius, height * 0.18),
        new THREE.Vector2(0.001, height * 0.55)
    ];
    return new THREE.LatheGeometry(pts, 6);
}

function buildStylizedGemMesh(gem, bodyMat, coreMat, edgeMat) {
    const root = new THREE.Group();

    function addPart(geom, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
        const mesh = new THREE.Mesh(geom, bodyMat);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.scale.set(...scale);
        root.add(mesh);

        const inner = new THREE.Mesh(geom, coreMat);
        inner.position.set(...pos);
        inner.rotation.set(...rot);
        inner.scale.set(scale[0] * 0.55, scale[1] * 0.55, scale[2] * 0.55);
        root.add(inner);

        const edgesGeo = new THREE.EdgesGeometry(geom, 10);
        const edges = new THREE.LineSegments(edgesGeo, edgeMat);
        edges.position.set(...pos);
        edges.rotation.set(...rot);
        edges.scale.set(scale[0] * 1.008, scale[1] * 1.008, scale[2] * 1.008);
        root.add(edges);
    }

    switch (gem.shape) {
        case 'morganite': {
            const x = 0, y = 0;
            const heartShape = new THREE.Shape();
            heartShape.moveTo(x, y + 0.22);
            heartShape.bezierCurveTo(x, y + 0.25, x - 0.08, y + 0.48, x - 0.34, y + 0.48);
            heartShape.bezierCurveTo(x - 0.68, y + 0.48, x - 0.68, y + 0.02, x - 0.68, y + 0.02);
            heartShape.bezierCurveTo(x - 0.68, y - 0.25, x - 0.35, y - 0.52, x, y - 0.78);
            heartShape.bezierCurveTo(x + 0.35, y - 0.52, x + 0.68, y - 0.25, x + 0.68, y + 0.02);
            heartShape.bezierCurveTo(x + 0.68, y + 0.02, x + 0.68, y + 0.48, x + 0.34, y + 0.48);
            heartShape.bezierCurveTo(x + 0.08, y + 0.48, x, y + 0.25, x, y + 0.22);

            const geom = new THREE.ExtrudeGeometry(heartShape, {
                depth: 0.14,
                bevelEnabled: true,
                bevelSegments: 1,
                steps: 1,
                bevelSize: 0.16,
                bevelThickness: 0.18,
                curveSegments: 5
            });
            geom.center();
            addPart(geom, [0, 0.02, 0], [0, 0, 0], [0.78, 0.78, 0.85]);
            break;
        }

        case 'topaz': {
            const pts = [
                new THREE.Vector2(0.001, -0.58),
                new THREE.Vector2(0.62, 0.14),
                new THREE.Vector2(0.36, 0.44),
                new THREE.Vector2(0.001, 0.44)
            ];
            const geom = new THREE.LatheGeometry(pts, 8);
            geom.center();
            addPart(geom, [0, 0.02, 0]);
            break;
        }

        case 'emerald': {
            const pts = [
                new THREE.Vector2(0.001, -0.56),
                new THREE.Vector2(0.26, -0.56),
                new THREE.Vector2(0.46, -0.34),
                new THREE.Vector2(0.46, 0.34),
                new THREE.Vector2(0.26, 0.56),
                new THREE.Vector2(0.001, 0.56)
            ];
            const geom = new THREE.LatheGeometry(pts, 8);
            geom.scale(0.88, 1.0, 0.68);
            geom.rotateY(Math.PI / 8);
            geom.center();
            addPart(geom, [0, 0.02, 0]);
            break;
        }

        case 'sapphire': {
            const pts = [
                new THREE.Vector2(0.001, -0.68),
                new THREE.Vector2(0.44, -0.16),
                new THREE.Vector2(0.50, 0.00),
                new THREE.Vector2(0.44, 0.16),
                new THREE.Vector2(0.001, 0.68)
            ];
            const geom = new THREE.LatheGeometry(pts, 6);
            geom.scale(0.88, 1.0, 0.72);
            geom.center();
            addPart(geom, [0, 0.02, 0]);
            break;
        }

        case 'amethyst':
        default: {
            const mainSpire = createQuartzSpire(0.30, 1.08);
            const leftSpire = createQuartzSpire(0.22, 0.78);
            const rightSpire = createQuartzSpire(0.20, 0.72);

            addPart(mainSpire, [0.00, 0.04, 0.04], [0.05, 0.3, -0.04]);
            addPart(leftSpire, [-0.24, -0.10, -0.04], [0.12, 0.8, 0.48]);
            addPart(rightSpire, [0.24, -0.12, -0.02], [-0.10, 0.2, -0.52]);
            break;
        }
    }

    return root;
}

function createGemInstanceForWrap(wrap) {
    if (!wrap || wrap._gems3dMounted) return;

    const oldCanvas = wrap.querySelector('canvas');
    if (!oldCanvas) return;

    wrap._gems3dMounted = true;

    const w = Math.max(wrap.clientWidth, 440);
    const h = Math.max(wrap.clientHeight, 108);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(29, w / h, 0.1, 100);
    camera.position.set(0, 0.38, 6.2);
    camera.lookAt(0, -0.06, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'gem-field-canvas';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '108px';
    renderer.domElement.style.display = 'block';

    // Полностью удаляем старый холст с его старыми слушателями из settings.js, чтобы они не листали тему!
    oldCanvas.remove();
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'absolute inset-0 pointer-events-none overflow-hidden';
    labelsContainer.style.zIndex = '4';
    wrap.appendChild(labelsContainer);

    scene.add(new THREE.AmbientLight(0xffffff, 0.30));

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.90);
    keyLight.position.set(3.5, 5.5, 5.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94A3B8, 0.45);
    fillLight.position.set(-4.5, -2.0, 2.0);
    scene.add(fillLight);

    const crystalGroups = [];
    const step = (Math.PI * 2) / GEMS_3D_CONFIG.length;

    GEMS_3D_CONFIG.forEach((gem, idx) => {
        const bodyMat = new THREE.MeshPhongMaterial({
            color: gem.color,
            emissive: gem.deep,
            emissiveIntensity: 0.35,
            specular: 0xFFFFFF,
            shininess: 95,
            flatShading: true,
            transparent: true,
            opacity: 0.88
        });

        const coreMat = new THREE.MeshBasicMaterial({
            color: gem.edge,
            transparent: true,
            opacity: 0.35
        });

        const edgesMat = new THREE.LineBasicMaterial({
            color: gem.edge,
            transparent: true,
            opacity: 0.75
        });

        const group = buildStylizedGemMesh(gem, bodyMat, coreMat, edgesMat);

        const labelEl = document.createElement('div');
        labelEl.innerText = gem.title;
        labelsContainer.appendChild(labelEl);

        scene.add(group);
        crystalGroups.push({
            data: gem,
            index: idx,
            baseAngle: idx * step,
            group,
            bodyMat,
            coreMat,
            edgesMat,
            labelEl
        });
    });

    const instance = {
        wrapEl: wrap,
        scene,
        camera,
        renderer,
        crystalGroups,
        currentAngle: 0,
        targetAngle: 0,
        isDragging: false,
        dragStartX: 0,
        dragMoved: 0
    };

    const glCanvas = renderer.domElement;
    glCanvas.style.touchAction = 'none';

    glCanvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        instance.isDragging = true;
        instance.dragStartX = e.clientX;
        instance.dragMoved = 0;
        try { glCanvas.setPointerCapture(e.pointerId); } catch { }
    });

    glCanvas.addEventListener('pointermove', e => {
        if (!instance.isDragging) return;
        const dx = e.clientX - instance.dragStartX;
        instance.dragStartX = e.clientX;
        instance.dragMoved += Math.abs(dx);
        instance.targetAngle += dx * 0.011;
    });

    glCanvas.addEventListener('pointerup', e => {
        if (!instance.isDragging) return;
        instance.isDragging = false;
        try { glCanvas.releasePointerCapture(e.pointerId); } catch { }

        if (instance.dragMoved < 6) {
            const rect = glCanvas.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            if (relX < 0.38) userSelectGemByDelta(-1);
            else if (relX > 0.62) userSelectGemByDelta(1);
        } else {
            const stepAngle = (Math.PI * 2) / GEMS_3D_CONFIG.length;
            const rawIdx = Math.round(-instance.targetAngle / stepAngle);
            const normIdx = ((rawIdx % GEMS_3D_CONFIG.length) + GEMS_3D_CONFIG.length) % GEMS_3D_CONFIG.length;
            const chosen = GEMS_3D_CONFIG[normIdx];
            if (chosen) userCommitGemTheme(chosen.id);
        }
    });

    // Колесо мыши работает ТОЛЬКО при наведении прямо на 3D-холст и не скроллит страницу
    glCanvas.addEventListener('wheel', e => {
        e.preventDefault();
        e.stopPropagation();
        userSelectGemByDelta(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    gems3DInstances.push(instance);
}

function userSelectGemByDelta(dir) {
    const curTheme = (appState?.settings?.accentTheme || 'green');
    const norm = (curTheme === 'crimson' || curTheme === 'cyan') ? 'pink' : curTheme;
    const idx = Math.max(0, GEMS_3D_CONFIG.findIndex(g => g.id === norm));
    const nextIdx = (idx + dir + GEMS_3D_CONFIG.length) % GEMS_3D_CONFIG.length;
    userCommitGemTheme(GEMS_3D_CONFIG[nextIdx].id);
}

function userCommitGemTheme(themeId) {
    if (isSyncingGemsInternal) return;
    isSyncingGemsInternal = true;
    try {
        if (typeof window.selectAccentTheme === 'function') {
            window.selectAccentTheme(themeId, false);
        }
        syncGems3DWithActiveTheme(themeId, false);
        if (typeof syncReactor3DThemeAndState === 'function') {
            syncReactor3DThemeAndState();
        }
    } finally {
        isSyncingGemsInternal = false;
    }
}

function initGems3DShowcase() {
    if (typeof THREE === 'undefined') return;
    if (appState?.settings?.hardwareAcceleration === false) return;

    const wraps = document.querySelectorAll('.gem-field-wrap');
    wraps.forEach(w => createGemInstanceForWrap(w));

    // Перехватываем кнопки-стрелки cycleGemTheme / cycleWizGemTheme, чтобы они крутили 3D-карусель
    window.cycleGemTheme = function (dir) {
        userSelectGemByDelta(dir);
    };
    window.cycleWizGemTheme = function (dir) {
        userSelectGemByDelta(dir);
    };

    syncGems3DWithActiveTheme(appState?.settings?.accentTheme || 'green', true);

    if (!gems3DLoopStarted) {
        gems3DLoopStarted = true;
        animateGems3D();
    }
}

function resizeGems3DIfNeeded() {
    gems3DInstances.forEach(inst => {
        const w = inst.wrapEl.clientWidth;
        const h = inst.wrapEl.clientHeight || 108;
        if (w > 60 && h > 40) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (Math.abs(inst.renderer.domElement.width / dpr - w) > 2) {
                inst.renderer.setSize(w, h);
                inst.camera.aspect = w / h;
                inst.camera.updateProjectionMatrix();
            }
        }
    });
}

function syncGems3DWithActiveTheme(themeId, instant = false) {
    const norm = (themeId === 'crimson' || themeId === 'cyan') ? 'pink' : (themeId || 'green');
    const idx = GEMS_3D_CONFIG.findIndex(g => g.id === norm);
    if (idx < 0) return;

    const step = (Math.PI * 2) / GEMS_3D_CONFIG.length;
    const desired = -idx * step;

    gems3DInstances.forEach(inst => {
        let diff = (desired - inst.targetAngle) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;

        inst.targetAngle += diff;
        if (instant) inst.currentAngle = inst.targetAngle;
    });
}

function animateGems3D() {
    requestAnimationFrame(animateGems3D);

    const radiusX = 2.30;
    const radiusZ = 1.25;
    const now = performance.now();

    gems3DInstances.forEach(inst => {
        const w = inst.wrapEl.clientWidth;
        const h = inst.wrapEl.clientHeight || 108;
        if (w < 40) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (Math.abs(inst.renderer.domElement.width / dpr - w) > 2) {
            inst.renderer.setSize(w, h);
            inst.camera.aspect = w / h;
            inst.camera.updateProjectionMatrix();
        }

        inst.currentAngle += (inst.targetAngle - inst.currentAngle) * 0.12;

        inst.crystalGroups.forEach(item => {
            const a = item.baseAngle + inst.currentAngle;
            const x = Math.sin(a) * radiusX;
            const z = Math.cos(a) * radiusZ;
            const depthNorm = (z + radiusZ) / (radiusZ * 2);
            const isFront = depthNorm > 0.92;

            const bobY = Math.sin(now * 0.0025 + item.index) * 0.04 + 0.14;
            item.group.position.set(x, bobY, z);

            const s = 0.45 + depthNorm * 0.52;
            item.group.scale.set(s, s, s);

            item.group.rotation.y += 0.011 + depthNorm * 0.011;
            item.group.rotation.x = 0.18 + Math.sin(now * 0.0015 + item.index) * 0.08;

            item.bodyMat.opacity = 0.28 + depthNorm * 0.62;
            item.coreMat.opacity = 0.12 + depthNorm * 0.30;
            item.edgesMat.opacity = isFront ? 0.90 : 0.25;

            const labelPos3D = new THREE.Vector3(x, -0.46, z);
            labelPos3D.project(inst.camera);
            const screenX = (labelPos3D.x * 0.5 + 0.5) * w;
            const screenY = (-(labelPos3D.y * 0.5) + 0.5) * h;

            item.labelEl.style.left = `${screenX}px`;
            item.labelEl.style.top = `${Math.min(h - 13, screenY)}px`;
            item.labelEl.style.opacity = String(0.38 + depthNorm * 0.62);
            item.labelEl.style.transform = `translate(-50%, -50%) scale(${0.82 + depthNorm * 0.22})`;

            if (isFront) {
                item.labelEl.className = 'absolute px-2.5 py-0.5 rounded-md bg-[#141418] border border-[var(--accent-light)] text-white font-mono text-[11px] font-bold shadow whitespace-nowrap';
            } else {
                item.labelEl.className = 'absolute px-1.5 py-0.2 rounded bg-[#0E0E12]/80 border border-[#26262E] text-[#888888] font-mono text-[10px] whitespace-nowrap';
            }
        });

        inst.renderer.render(inst.scene, inst.camera);
    });
}