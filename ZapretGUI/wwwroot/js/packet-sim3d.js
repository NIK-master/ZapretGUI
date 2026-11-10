// =========================================================================
// МОДУЛЬ: 3D СИМУЛЯТОР ПАКЕТОВ И ПРОБИТИЯ ТСПУ В КОНСТРУКТОРЕ (THREE.JS)
// Файл: wwwroot/js/packet-sim3d.js
// =========================================================================

let packetSim = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    dpiWall: null,
    serverNode: null,
    packets: [],
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
        const h = host.clientHeight || 96;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
        camera.position.set(0, 1.35, 6.8);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        host.innerHTML = '';
        host.appendChild(renderer.domElement);

        // 1. Направляющие рельсы сетевого туннеля
        const railGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-4.5, -0.45, 0),
            new THREE.Vector3(4.5, -0.45, 0)
        ]);
        const railMat = new THREE.LineBasicMaterial({ color: 0x2E2E38, transparent: true, opacity: 0.7 });
        scene.add(new THREE.Line(railGeo, railMat));

        // 2. Щит ТСПУ / DPI Провайдера в центре (x = 0)
        const wallGroup = new THREE.Group();
        const wallGeo = new THREE.BoxGeometry(0.12, 1.45, 1.6);
        const wallMat = new THREE.MeshBasicMaterial({ color: 0xEF4444, wireframe: true, transparent: true, opacity: 0.45 });
        wallGroup.add(new THREE.Mesh(wallGeo, wallMat));

        const coreWallGeo = new THREE.PlaneGeometry(1.5, 1.35);
        const coreWallMat = new THREE.MeshBasicMaterial({ color: 0xD13438, transparent: true, opacity: 0.14, side: THREE.DoubleSide });
        const planeMesh = new THREE.Mesh(coreWallGeo, coreWallMat);
        planeMesh.rotation.y = Math.PI / 2;
        wallGroup.add(planeMesh);
        scene.add(wallGroup);

        // 3. Узел Целевого Сервера справа (x = 3.6)
        const srvGeo = new THREE.OctahedronGeometry(0.52, 1);
        const srvMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, wireframe: true, transparent: true, opacity: 0.75 });
        const serverNode = new THREE.Mesh(srvGeo, srvMat);
        serverNode.position.set(3.6, 0.05, 0);
        scene.add(serverNode);

        // 4. Источник клиента слева (x = -3.6)
        const cliGeo = new THREE.RingGeometry(0.28, 0.38, 16);
        const cliMat = new THREE.MeshBasicMaterial({ color: 0x60A5FA, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
        const cliMesh = new THREE.Mesh(cliGeo, cliMat);
        cliMesh.rotation.y = Math.PI / 2;
        cliMesh.position.set(-3.6, 0.05, 0);
        scene.add(cliMesh);

        Object.assign(packetSim, {
            initialized: true,
            scene,
            camera,
            renderer,
            dpiWall: wallGroup,
            serverNode
        });

        updatePacketSimConfig();
        animatePacketSim3D();
    } catch (e) {
        console.warn('PacketSim3D error:', e);
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
        if (mode.includes('multisplit')) parts.push('Шинковка на 4 сегмента');
        else if (mode.includes('disorder')) parts.push('Обратный порядок кусков');
        else if (mode.includes('split')) parts.push('Разрез пакета на 2 части');
        else if (mode.includes('syndata')) parts.push('Данные внутри SYN');
        lbl.innerText = parts.join(' + ');
    }
}

function spawnSimPacketWave() {
    if (!packetSim.initialized) return;

    const { mode } = packetSim.config;
    const accentHex = typeof getThemeHexNumber === 'function' ? getThemeHexNumber() : 0x4CAF50;

    // 1. Если включен fake — создаем приманку (оранжево-розовый каркасный куб), летящую чуть впереди
    if (mode.includes('fake')) {
        const fakeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const fakeMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, wireframe: true, transparent: true, opacity: 0.9 });
        const fakeMesh = new THREE.Mesh(fakeGeo, fakeMat);
        fakeMesh.position.set(-3.3, 0.08, 0);
        packetSim.scene.add(fakeMesh);

        packetSim.packets.push({
            mesh: fakeMesh,
            isFake: true,
            speed: 0.058,
            alive: true
        });
    }

    // 2. Создаем реальные сегменты пакета в зависимости от метода нарезки
    let segmentsCount = 1;
    if (mode.includes('multisplit')) segmentsCount = 4;
    else if (mode.includes('split') || mode.includes('disorder')) segmentsCount = 2;

    const isDisorder = mode.includes('disorder');

    for (let i = 0; i < segmentsCount; i++) {
        const w = 0.36 / segmentsCount;
        const segGeo = new THREE.BoxGeometry(w, 0.30, 0.30);
        const segMat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? accentHex : 0x60A5FA,
            transparent: true,
            opacity: 0.92
        });
        const segMesh = new THREE.Mesh(segGeo, segMat);
        segMesh.position.set(-3.55 - i * (w + 0.12), 0.05, 0);
        packetSim.scene.add(segMesh);

        packetSim.packets.push({
            mesh: segMesh,
            isFake: false,
            segIndex: i,
            totalSegs: segmentsCount,
            isDisorder,
            speed: 0.052,
            alive: true
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
        const h = host.clientHeight || 86;
        if (Math.abs(packetSim.renderer.domElement.width / (window.devicePixelRatio || 1) - w) > 5) {
            packetSim.renderer.setSize(w, h);
            packetSim.camera.aspect = w / h;
            packetSim.camera.updateProjectionMatrix();
        }
    }

    packetSim.spawnTimer++;
    if (packetSim.spawnTimer > 68) {
        packetSim.spawnTimer = 0;
        spawnSimPacketWave();
    }

    packetSim.serverNode.rotation.y += 0.025;
    packetSim.serverNode.rotation.x += 0.015;
    packetSim.dpiWall.rotation.y = Math.sin(Date.now() * 0.002) * 0.08;

    for (let i = packetSim.packets.length - 1; i >= 0; i--) {
        const p = packetSim.packets[i];
        p.mesh.position.x += p.speed;
        p.mesh.rotation.x += 0.04;

        // Поведение фейк-пакета: проходит сквозь ТСПУ (x = 0), отвлекая его, и сгорает на x = 1.2 (Auto-TTL / Fooling)
        if (p.isFake) {
            if (p.mesh.position.x > 0.1) {
                p.mesh.scale.multiplyScalar(0.92);
                p.mesh.material.opacity *= 0.88;
                p.mesh.position.y += 0.018;
            }
            if (p.mesh.position.x > 1.6 || p.mesh.material.opacity < 0.05) {
                packetSim.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                packetSim.packets.splice(i, 1);
                continue;
            }
        } else {
            // Реальные сегменты: при приближении к ТСПУ (x > -1.4) разводятся по высоте/спирали, чтобы обойти DPI
            if (p.totalSegs > 1 && p.mesh.position.x > -1.4 && p.mesh.position.x < 1.4) {
                const offsetDir = (p.segIndex % 2 === 0 ? 1 : -1);
                const wave = Math.sin((p.mesh.position.x + 1.4) * 1.15) * 0.28 * offsetDir;
                p.mesh.position.y = 0.05 + (p.isDisorder ? -wave : wave);
            } else {
                p.mesh.position.y += (0.05 - p.mesh.position.y) * 0.15;
            }

            // Достигли целевого сервера (x >= 3.4)
            if (p.mesh.position.x >= 3.4) {
                packetSim.serverNode.scale.set(1.18, 1.18, 1.18);
                packetSim.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                packetSim.packets.splice(i, 1);
                continue;
            }
        }
    }

    packetSim.serverNode.scale.lerp(new THREE.Vector3(1, 1, 1), 0.12);
    packetSim.renderer.render(packetSim.scene, packetSim.camera);
}