// =========================================================================
// МОДУЛЬ: 3D ЛАБОРАТОРИЯ ПРОБИТИЯ ТСПУ 2.0 (СВЕТ, СЕТКА И ВЗРЫВЫ ФЕЙКОВ)
// Файл: wwwroot/js/packet-sim3d.js
// =========================================================================

let packetSim = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    dpiScannerRing: null,
    dpiCoreLaser: null,
    serverNode: null,
    clientNode: null,
    packets: [],
    sparks: [],
    spawnTimer: 0,
    config: {
        mode: 'fake,split2',
        fooling: 'md5sig',
        quic: true,
        repeats: 6
    }
};

function initPacketSim3D() {
    if (packetSim.initialized) return;
    if (typeof THREE === 'undefined') return;
    if (appState?.settings?.hardwareAcceleration === false) return;

    const host = document.getElementById('lego-3d-sim-canvas-wrap');
    if (!host) return;

    try {
        const w = host.clientWidth || 780;
        const h = host.clientHeight || 148;

        const scene = new THREE.Scene();
        // Изометрический кинематографичный ракурс сверху-сбоку
        const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
        camera.position.set(0, 2.35, 7.2);
        camera.lookAt(0, -0.1, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        host.innerHTML = '';
        host.appendChild(renderer.domElement);

        // Освещение для объемных 3D-граней пакетов
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
        dirLight.position.set(3, 6, 5);
        scene.add(dirLight);

        // 1. Перспективная кибер-сетка пола
        const grid = new THREE.GridHelper(11, 22, 0x2A2A35, 0x181820);
        grid.position.y = -0.75;
        scene.add(grid);

        // 2. Светящаяся магистральная линия передачи данных
        const beamGeo = new THREE.CylinderGeometry(0.025, 0.025, 8.2, 8);
        beamGeo.rotateZ(Math.PI / 2);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.6 });
        const beamMesh = new THREE.Mesh(beamGeo, beamMat);
        beamMesh.position.set(0, 0, 0);
        scene.add(beamMesh);

        // 3. Портал Клиента (Отправитель — слева, x = -4.0)
        const cliGroup = new THREE.Group();
        cliGroup.position.set(-4.0, 0, 0);
        const cliRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.52, 0.04, 12, 32),
            new THREE.MeshBasicMaterial({ color: 0x60A5FA })
        );
        cliRing.rotation.y = Math.PI / 2;
        cliGroup.add(cliRing);
        scene.add(cliGroup);

        // 4. Лазерный Щит ТСПУ / DPI (Посередине, x = 0)
        const dpiGroup = new THREE.Group();
        dpiGroup.position.set(0, 0, 0);

        // Внешнее зубчатое кольцо сканера РКН/ТСПУ
        const scannerRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.92, 0.035, 10, 6),
            new THREE.MeshBasicMaterial({ color: 0xEF4444, wireframe: false })
        );
        scannerRing.rotation.y = Math.PI / 2;
        dpiGroup.add(scannerRing);

        // Полупрозрачное красное силовое поле внутри кольца
        const laserDisc = new THREE.Mesh(
            new THREE.CircleGeometry(0.88, 24),
            new THREE.MeshBasicMaterial({ color: 0xEF4444, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
        );
        laserDisc.rotation.y = Math.PI / 2;
        dpiGroup.add(laserDisc);
        scene.add(dpiGroup);

        // 5. Ядро Целевого Сервера (YouTube / Discord — справа, x = 4.0)
        const srvGroup = new THREE.Group();
        srvGroup.position.set(4.0, 0, 0);
        const srvCore = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.55, 0),
            new THREE.MeshStandardMaterial({
                color: 0x4CAF50,
                emissive: 0x107C10,
                emissiveIntensity: 0.5,
                roughness: 0.2,
                metalness: 0.5
            })
        );
        const srvWire = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.72, 1),
            new THREE.MeshBasicMaterial({ color: 0x4ADE80, wireframe: true, transparent: true, opacity: 0.35 })
        );
        srvGroup.add(srvCore);
        srvGroup.add(srvWire);
        scene.add(srvGroup);

        Object.assign(packetSim, {
            initialized: true,
            scene,
            camera,
            renderer,
            dpiScannerRing: scannerRing,
            dpiCoreLaser: laserDisc,
            serverNode: srvGroup,
            clientNode: cliGroup
        });

        updatePacketSimConfig();
        spawnSimPacketWave();
        animatePacketSim3D();
    } catch (e) {
        console.warn('PacketSim3D error:', e);
    }
}

// Взрыв искр при сгорании фейк-пакета после обмана ТСПУ
function createFakeExplosionSparks(pos, hexColor) {
    for (let i = 0; i < 10; i++) {
        const sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
        const sparkMat = new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity: 1 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(pos);
        packetSim.scene.add(spark);

        packetSim.sparks.push({
            mesh: spark,
            vx: (Math.random() - 0.2) * 0.08,
            vy: (Math.random() - 0.5) * 0.12,
            vz: (Math.random() - 0.5) * 0.12
        });
    }
}

function updatePacketSimConfig() {
    const mode = document.getElementById('lego-tcp-desync')?.value || 'fake,split2';
    const fooling = document.getElementById('lego-fooling')?.value || 'md5sig';
    const quic = document.getElementById('lego-quic-enabled')?.checked ?? true;
    const repeats = parseInt(document.getElementById('lego-repeats')?.value || '6', 10);

    packetSim.config = { mode, fooling, quic, repeats };

    const lbl = document.getElementById('lego-sim-caption');
    if (lbl) {
        const parts = [];
        if (mode.includes('fake')) parts.push(`Фейк-приманка (${fooling === 'none' ? 'Auto-TTL' : fooling})`);
        if (mode.includes('multisplit')) parts.push('Шинковка на 4 части');
        else if (mode.includes('disorder')) parts.push('Обратный порядок (Disorder)');
        else if (mode.includes('split')) parts.push('Разрез на 2 сегмента (Split)');
        else if (mode.includes('syndata')) parts.push('SYN-Data пакет');
        lbl.innerText = parts.join(' • ');
    }
}

function spawnSimPacketWave() {
    if (!packetSim.initialized) return;

    const { mode } = packetSim.config;
    const accentHex = typeof getThemeHexNumber === 'function' ? getThemeHexNumber() : 0x4CAF50;

    // 1. Если включен fake — выпускаем яркую оранжевую капсулу-приманку впереди пакета
    if (mode.includes('fake')) {
        const fakeGeo = new THREE.OctahedronGeometry(0.28, 0);
        const fakeMat = new THREE.MeshStandardMaterial({
            color: 0xF59E0B,
            emissive: 0xD97706,
            emissiveIntensity: 0.7,
            roughness: 0.3
        });
        const fakeMesh = new THREE.Mesh(fakeGeo, fakeMat);
        fakeMesh.position.set(-3.4, 0, 0);
        packetSim.scene.add(fakeMesh);

        packetSim.packets.push({
            mesh: fakeMesh,
            isFake: true,
            speed: 0.062
        });
    }

    // 2. Выпускаем реальные сегменты пакета данных
    let segmentsCount = 1;
    if (mode.includes('multisplit')) segmentsCount = 4;
    else if (mode.includes('split') || mode.includes('disorder')) segmentsCount = 2;

    const isDisorder = mode.includes('disorder');

    for (let i = 0; i < segmentsCount; i++) {
        const w = Math.max(0.18, 0.56 / segmentsCount);
        const segGeo = new THREE.BoxGeometry(w, 0.36, 0.36);
        const segColor = i % 2 === 0 ? accentHex : 0x38BDF8;
        const segMat = new THREE.MeshStandardMaterial({
            color: segColor,
            emissive: segColor,
            emissiveIntensity: 0.35,
            roughness: 0.25,
            metalness: 0.4
        });
        const segMesh = new THREE.Mesh(segGeo, segMat);
        segMesh.position.set(-3.85 - i * (w + 0.18), 0, 0);
        packetSim.scene.add(segMesh);

        packetSim.packets.push({
            mesh: segMesh,
            isFake: false,
            segIndex: i,
            totalSegs: segmentsCount,
            isDisorder,
            speed: 0.056
        });
    }
}

function animatePacketSim3D() {
    requestAnimationFrame(animatePacketSim3D);
    if (!packetSim.initialized) return;

    const modal = document.getElementById('editor-modal');
    const vis = document.getElementById('editor-visual-builder');
    if (!modal || !modal.classList.contains('open') || !vis || vis.classList.contains('hidden')) {
        return;
    }

    const host = document.getElementById('lego-3d-sim-canvas-wrap');
    if (host && host.clientWidth > 100) {
        const w = host.clientWidth;
        const h = host.clientHeight || 148;
        if (Math.abs(packetSim.renderer.domElement.width / (window.devicePixelRatio || 1) - w) > 5 ||
            Math.abs(packetSim.renderer.domElement.height / (window.devicePixelRatio || 1) - h) > 5) {
            packetSim.renderer.setSize(w, h);
            packetSim.camera.aspect = w / h;
            packetSim.camera.updateProjectionMatrix();
        }
    }

    packetSim.spawnTimer++;
    if (packetSim.spawnTimer > 62) {
        packetSim.spawnTimer = 0;
        spawnSimPacketWave();
    }

    packetSim.dpiScannerRing.rotation.z -= 0.025;
    packetSim.serverNode.rotation.y += 0.022;
    packetSim.clientNode.rotation.x += 0.02;

    // Движение пакетов
    for (let i = packetSim.packets.length - 1; i >= 0; i--) {
        const p = packetSim.packets[i];
        p.mesh.position.x += p.speed;
        p.mesh.rotation.x += 0.035;
        p.mesh.rotation.y += 0.025;

        if (p.isFake) {
            // Когда фейк проходит щит ТСПУ (x > 0.25) — он отвлекает сканер и взрывается искрами
            if (p.mesh.position.x >= 0.45) {
                createFakeExplosionSparks(p.mesh.position, 0xF59E0B);
                packetSim.dpiCoreLaser.material.opacity = 0.42; // вспышка щита
                packetSim.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                packetSim.packets.splice(i, 1);
                continue;
            }
        } else {
            // Реальные сегменты: расходятся по орбитам вокруг лазера ТСПУ
            if (p.totalSegs > 1 && p.mesh.position.x > -1.8 && p.mesh.position.x < 1.8) {
                const dir = (p.segIndex % 2 === 0 ? 1 : -1);
                const angle = (p.mesh.position.x + 1.8) * 1.1;
                const amp = 0.42 * dir * (p.isDisorder ? -1 : 1);
                p.mesh.position.y = Math.sin(angle) * amp;
                p.mesh.position.z = Math.cos(angle) * (amp * 0.5);
            } else {
                p.mesh.position.y *= 0.85;
                p.mesh.position.z *= 0.85;
            }

            if (p.mesh.position.x >= 3.7) {
                packetSim.serverNode.scale.set(1.22, 1.22, 1.22);
                packetSim.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                packetSim.packets.splice(i, 1);
                continue;
            }
        }
    }

    // Анимация разлетающихся искр от сгоревшего фейка
    for (let i = packetSim.sparks.length - 1; i >= 0; i--) {
        const sp = packetSim.sparks[i];
        sp.mesh.position.x += sp.vx;
        sp.mesh.position.y += sp.vy;
        sp.mesh.position.z += sp.vz;
        sp.mesh.scale.multiplyScalar(0.89);
        sp.mesh.material.opacity *= 0.88;

        if (sp.mesh.material.opacity < 0.06) {
            packetSim.scene.remove(sp.mesh);
            sp.mesh.geometry.dispose();
            sp.mesh.material.dispose();
            packetSim.sparks.splice(i, 1);
        }
    }

    packetSim.dpiCoreLaser.material.opacity += (0.14 - packetSim.dpiCoreLaser.material.opacity) * 0.1;
    packetSim.serverNode.scale.lerp(new THREE.Vector3(1, 1, 1), 0.12);
    packetSim.renderer.render(packetSim.scene, packetSim.camera);
}