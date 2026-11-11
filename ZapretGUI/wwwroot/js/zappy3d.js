// =========================================================================
// МОДУЛЬ: 8-BIT VOXEL 3D МАСКОТ "ZAPPY" (ВСТРОЕННЫЙ В ГЛАВНЫЙ ЭКРАН)
// Файл: wwwroot/js/zappy3d.js
// =========================================================================

let zappy3D = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    voxelGroup: null,
    headGroup: null,
    earsGroup: null,
    tailGroup: null,
    leftPaw: null,
    rightPaw: null,
    eyeMeshes: [],
    happyEyeMeshes: [],
    sleepEyeMeshes: [],
    dizzyEyeMeshes: [],
    mouthMesh: null,
    cheekMeshes: [],
    accentMaterials: [],
    cookieGroup: null,
    // Состояния и физика
    mood: 'normal', // normal, happy, dizzy, eating
    moodTimer: 0,
    blinkTimer: 100,
    isBlinking: false,
    mouseX: 0,
    mouseY: 0,
    rotY: 0,
    rotX: 0,
    spinVelY: 0,
    jumpY: 0,
    jumpVel: 0,
    squash: 1.0,
    isDragging: false,
    dragLastX: 0,
    dragAccum: 0,
    cookieAnim: 0,
    petsCount: 0
};

const ZAPPY_VOXEL_PHRASES_IDLE = [
    'Жду пакетов... Мур-р 🐾',
    'Слежу за пингом в 8-бит!',
    'Нажми на меня или дай печеньку!',
    'Воксельный щит готов к работе ⚡'
];

const ZAPPY_VOXEL_PHRASES_PET = [
    'МУР-Р! +100 к антистрессу! ^ω^',
    'Кусь за DPI! Пакеты летят! ⚡',
    'Воксельное мурчание активировано!',
    'Почеши за пиксельным ушком ещё!',
    'РКН не пройдет мимо моих лапок! 🛡'
];

const ZAPPY_VOXEL_PHRASES_COOKIE = [
    'ХРУМ! 8-битный пакет ТСПУ съеден! 🍪',
    'Ням-ням! Вкусные зашифрованные байты!',
    'Печенька усвоена! Пинг снижен! 😋',
    'Энергия воксельного ядра 100%! ✨'
];

function getZappyThemeColor() {
    const raw = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    return {
        str: raw,
        num: parseInt(raw.replace('#', ''), 16) || 0x4CAF50
    };
}

function initZappy3DMascot() {
    if (zappy3D.initialized) return;
    if (typeof THREE === 'undefined') return;
    if (appState?.settings?.hardwareAcceleration === false) return;

    // Находим колонку с кнопкой запуска на Главном экране (#tab-home)
    const reactorContainer = document.getElementById('reactor-container');
    const homeTab = document.getElementById('tab-home');
    if (!reactorContainer && !homeTab) return;

    // Удаляем старый плавающий док, если он остался
    const oldFloating = document.getElementById('zappy-mascot-dock');
    if (oldFloating) oldFloating.remove();

    // Находим левую колонку (где лежит реактор) или создаем слот прямо под ним
    const leftCol = reactorContainer ? reactorContainer.parentElement : homeTab;
    if (!leftCol) return;

    // Делаем так, чтобы в компактном режиме маскот не теснил кнопку
    const card = document.createElement('div');
    card.id = 'zappy-home-card';
    card.className = 'glass-card rounded-xl p-2.5 mt-3 w-full max-w-[260px] flex items-center gap-2.5 relative overflow-hidden select-none transition-all';
    card.innerHTML = `
        <!-- Левая часть: 3D Воксельная сцена с котиком -->
        <div id="zappy-voxel-stage" class="relative w-[86px] h-[86px] rounded-lg bg-[#0D0D12] border border-[#25252E] flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing overflow-hidden" title="ЛКМ — погладить, Зажать и потянуть — покрутить 8-битного Зэппи!">
            <div class="absolute inset-1 rounded-full bg-[var(--accent-soft)] blur-md opacity-60 pointer-events-none"></div>
        </div>

        <!-- Правая часть: Статус, реплика и кнопки взаимодействия -->
        <div class="flex flex-col justify-between flex-1 min-w-0 h-[86px] py-0.5">
            <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5">
                    <span id="zappy-home-dot" class="w-2 h-2 rounded-full dot-offline"></span>
                    <span class="text-[11px] font-mono font-bold text-white tracking-wide">ZAPPY 8-BIT</span>
                </div>
                <span id="zappy-lvl-badge" class="px-1.5 py-0.2 rounded bg-[#1A1A22] border border-[#2C2C38] text-[9.5px] font-mono text-brand">LVL 1</span>
            </div>

            <!-- Диалоговая строка котика -->
            <div id="zappy-home-speech" class="text-[10.5px] font-mono text-[#BBBBBB] leading-tight line-clamp-2 bg-[#121217] border border-[#22222A] rounded px-2 py-1">
                Жду команд... Погладь меня! ^ω^
            </div>

            <!-- Кнопки действий -->
            <div class="flex items-center gap-1.5">
                <button onclick="petZappyMascot()" class="flex-1 py-1 px-2 rounded bg-[#1D1D24] hover:bg-[#282832] border border-[#2E2E3A] text-[10px] font-mono font-semibold text-[#E0E0E0] hover:text-white flex items-center justify-center gap-1 cursor-pointer transition active:scale-95">
                    <span>🐾</span><span>Гладить</span>
                </button>
                <button onclick="feedZappyCookie()" class="flex-1 py-1 px-2 rounded bg-[#1D1D24] hover:bg-[#282832] border border-[#2E2E3A] text-[10px] font-mono font-semibold text-[#E0E0E0] hover:text-white flex items-center justify-center gap-1 cursor-pointer transition active:scale-95" title="Скормить перехваченный пакет данных">
                    <span>🍪</span><span>Пакет</span>
                </button>
            </div>
        </div>
    `;

    leftCol.appendChild(card);

    // Прячем карточку маскота в компактном режиме (850x520), чтобы не нарушать минимализм
    const styleEl = document.createElement('style');
    styleEl.textContent = `body.compact-mode #zappy-home-card { display: none !important; }`;
    document.head.appendChild(styleEl);

    const stage = document.getElementById('zappy-voxel-stage');
    const size = 86;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.2);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'relative z-10 block';
    stage.appendChild(renderer.domElement);

    // Освещение для четких 8-битных кубических граней
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight.position.set(4, 7, 5);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x94A3B8, 0.5);
    backLight.position.set(-4, -2, -3);
    scene.add(backLight);

    buildVoxelCatModel(scene);
    setupZappyInteractions(stage);

    Object.assign(zappy3D, {
        initialized: true,
        scene,
        camera,
        renderer
    });

    animateZappy3D();
}

// Собирает 3D-воксельного 8-битного котика из кубиков!
function buildVoxelCatModel(scene) {
    const theme = getZappyThemeColor();
    const u = 0.16; // Размер одного 3D-вокселя (кубика)

    const matDarkBody = new THREE.MeshLambertMaterial({ color: 0x22222B });
    const matBelly = new THREE.MeshLambertMaterial({ color: 0x323240 });
    const matVisor = new THREE.MeshBasicMaterial({ color: 0x09090D });
    const matPink = new THREE.MeshBasicMaterial({ color: 0xF472B6 });
    const matAccent = new THREE.MeshLambertMaterial({
        color: theme.num,
        emissive: theme.num,
        emissiveIntensity: 0.45
    });
    const matGlowEye = new THREE.MeshBasicMaterial({ color: theme.num });

    zappy3D.accentMaterials = [matAccent, matGlowEye];

    // Вспомогательная функция создания воксельного блока (w, h, d в вокселях)
    function makeBox(w, h, d, mat, x, y, z) {
        const geo = new THREE.BoxGeometry(w * u, h * u, d * u);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x * u, y * u, z * u);
        return mesh;
    }

    const voxelGroup = new THREE.Group();
    scene.add(voxelGroup);

    const headGroup = new THREE.Group();
    voxelGroup.add(headGroup);

    // 1. ГОЛОВА-КОРПУС (8-битный ступенчатый куб со скругленными воксельными углами)
    headGroup.add(makeBox(9, 7, 7, matDarkBody, 0, 1.0, 0));     // Центральное ядро головы
    headGroup.add(makeBox(7, 8, 6, matDarkBody, 0, 1.0, 0));     // Верхняя/нижняя ступенька
    headGroup.add(makeBox(10, 5, 5, matDarkBody, 0, 1.0, 0));    // Боковые щёчки
    headGroup.add(makeBox(5, 2.5, 4, matBelly, 0, -3.2, 0.3));   // Воксельное пузико снизу

    // Боковые 8-битные наушники (светятся в цвет темы)
    headGroup.add(makeBox(1, 3, 3, matAccent, -5.2, 1.0, 0));
    headGroup.add(makeBox(1, 3, 3, matAccent, 5.2, 1.0, 0));

    // 2. ЭКРАН-МОРДОЧКА СПЕРЕДИ
    headGroup.add(makeBox(7.6, 5.2, 0.6, matVisor, 0, 1.0, 3.4));

    // 3. ПИКСЕЛЬНЫЕ ГЛАЗКИ И МИМИКА НА ЭКРАНЕ (переключаются по состояниям)
    const eyeZ = 3.78;
    // Обычные 8-битные глаза (вертикальные пиксели + белый блик)
    const eyeL = makeBox(1.3, 2.2, 0.2, matGlowEye, -2.1, 1.4, eyeZ);
    const eyeR = makeBox(1.3, 2.2, 0.2, matGlowEye, 2.1, 1.4, eyeZ);
    headGroup.add(eyeL, eyeR);
    zappy3D.eyeMeshes = [eyeL, eyeR];

    // Радостные 8-битные глаза-уголки (^ ^) из 3 кубиков каждый
    const happyGroupL = new THREE.Group();
    happyGroupL.add(
        makeBox(0.7, 0.7, 0.2, matGlowEye, -2.7, 1.2, eyeZ),
        makeBox(0.7, 0.7, 0.2, matGlowEye, -2.1, 1.9, eyeZ),
        makeBox(0.7, 0.7, 0.2, matGlowEye, -1.5, 1.2, eyeZ)
    );
    const happyGroupR = new THREE.Group();
    happyGroupR.add(
        makeBox(0.7, 0.7, 0.2, matGlowEye, 1.5, 1.2, eyeZ),
        makeBox(0.7, 0.7, 0.2, matGlowEye, 2.1, 1.9, eyeZ),
        makeBox(0.7, 0.7, 0.2, matGlowEye, 2.7, 1.2, eyeZ)
    );
    happyGroupL.visible = false;
    happyGroupR.visible = false;
    headGroup.add(happyGroupL, happyGroupR);
    zappy3D.happyEyeMeshes = [happyGroupL, happyGroupR];

    // Сонные / моргающие глаза (- -)
    const sleepL = makeBox(2.0, 0.6, 0.2, matGlowEye, -2.1, 1.3, eyeZ);
    const sleepR = makeBox(2.0, 0.6, 0.2, matGlowEye, 2.1, 1.3, eyeZ);
    sleepL.visible = false;
    sleepR.visible = false;
    headGroup.add(sleepL, sleepR);
    zappy3D.sleepEyeMeshes = [sleepL, sleepR];

    // Головокружение (X X)
    const dizzyL = new THREE.Group();
    dizzyL.add(
        makeBox(0.6, 0.6, 0.2, matGlowEye, -2.6, 1.9, eyeZ),
        makeBox(0.6, 0.6, 0.2, matGlowEye, -1.6, 1.9, eyeZ),
        makeBox(0.7, 0.7, 0.2, matGlowEye, -2.1, 1.3, eyeZ),
        makeBox(0.6, 0.6, 0.2, matGlowEye, -2.6, 0.7, eyeZ),
        makeBox(0.6, 0.6, 0.2, matGlowEye, -1.6, 0.7, eyeZ)
    );
    const dizzyR = dizzyL.clone();
    dizzyR.position.x = 4.2 * u;
    dizzyL.visible = false;
    dizzyR.visible = false;
    headGroup.add(dizzyL, dizzyR);
    zappy3D.dizzyEyeMeshes = [dizzyL, dizzyR];

    // Пиксельный кошачий носик/ротик и розовые румяные щечки
    const mouthMesh = makeBox(1.4, 0.55, 0.2, matGlowEye, 0, 0.0, eyeZ);
    headGroup.add(mouthMesh);
    zappy3D.mouthMesh = mouthMesh;

    const cheekL = makeBox(1.1, 0.6, 0.2, matPink, -3.1, 0.2, eyeZ);
    const cheekR = makeBox(1.1, 0.6, 0.2, matPink, 3.1, 0.2, eyeZ);
    headGroup.add(cheekL, cheekR);
    zappy3D.cheekMeshes = [cheekL, cheekR];

    // 4. СТУПЕНЧАТЫЕ 8-БИТНЫЕ УШКИ НА МАКУШКЕ
    const earsGroup = new THREE.Group();
    [-3.0, 3.0].forEach(ex => {
        // Пирамидка уха из 3 слоев вокселей
        earsGroup.add(makeBox(3.0, 1.0, 2.2, matDarkBody, ex, 5.2, 0));
        earsGroup.add(makeBox(2.0, 1.0, 1.8, matDarkBody, ex, 6.2, 0));
        earsGroup.add(makeBox(1.0, 1.0, 1.2, matAccent, ex, 7.2, 0)); // Светящийся кончик уха!
        earsGroup.add(makeBox(1.4, 1.4, 0.5, matAccent, ex, 5.6, 0.95)); // Внутренняя часть ушка
    });
    headGroup.add(earsGroup);

    // 5. ВОКСЕЛЬНЫЕ ЛАПКИ И ХВОСТИК ИЗ КУБИКОВ
    const leftPaw = new THREE.Group();
    leftPaw.add(makeBox(2.2, 1.6, 2.6, matDarkBody, -2.8, -4.4, 1.2));
    leftPaw.add(makeBox(1.4, 0.6, 0.6, matAccent, -2.8, -4.7, 2.4)); // Светящиеся подушечки лап
    voxelGroup.add(leftPaw);

    const rightPaw = new THREE.Group();
    rightPaw.add(makeBox(2.2, 1.6, 2.6, matDarkBody, 2.8, -4.4, 1.2));
    rightPaw.add(makeBox(1.4, 0.6, 0.6, matAccent, 2.8, -4.7, 2.4));
    voxelGroup.add(rightPaw);

    // Ступенчатый 8-битный хвост сзади
    const tailGroup = new THREE.Group();
    tailGroup.add(
        makeBox(1.2, 1.2, 1.5, matDarkBody, 0, -2.8, -3.6),
        makeBox(1.2, 1.8, 1.2, matDarkBody, 0, -1.8, -4.6),
        makeBox(1.2, 1.8, 1.2, matAccent, 0, -0.2, -5.2)
    );
    voxelGroup.add(tailGroup);

    // 6. 8-БИТНАЯ ПЕЧЕНЬКА-ПАКЕТ (прилетает при нажатии на кнопку 🍪)
    const cookieGroup = new THREE.Group();
    const matCookie = new THREE.MeshLambertMaterial({ color: 0xF59E0B });
    const matChoco = new THREE.MeshBasicMaterial({ color: 0x451A03 });
    cookieGroup.add(makeBox(2.2, 2.2, 0.8, matCookie, 0, 0, 0));
    cookieGroup.add(makeBox(0.6, 0.6, 1.0, matChoco, -0.5, 0.5, 0));
    cookieGroup.add(makeBox(0.6, 0.6, 1.0, matChoco, 0.5, -0.4, 0));
    cookieGroup.visible = false;
    scene.add(cookieGroup);

    Object.assign(zappy3D, {
        voxelGroup,
        headGroup,
        earsGroup,
        tailGroup,
        leftPaw,
        rightPaw,
        cookieGroup
    });
}

function setZappySpeechText(text) {
    const el = document.getElementById('zappy-home-speech');
    if (el) el.innerText = text;
}

function setupZappyInteractions(stageEl) {
    window.addEventListener('mousemove', e => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        zappy3D.mouseX = nx;
        zappy3D.mouseY = ny;

        if (zappy3D.isDragging) {
            const dx = e.clientX - zappy3D.dragLastX;
            zappy3D.dragLastX = e.clientX;
            zappy3D.spinVelY = dx * 0.03;
            zappy3D.rotY += zappy3D.spinVelY;
            zappy3D.dragAccum += Math.abs(dx);

            if (zappy3D.dragAccum > 220 && zappy3D.mood !== 'dizzy') {
                zappy3D.mood = 'dizzy';
                zappy3D.moodTimer = 140;
                setZappySpeechText('Уи-и-и! Мои воксели кружатся! X_X');
            }
        }
    });

    stageEl.addEventListener('pointerdown', e => {
        zappy3D.isDragging = true;
        zappy3D.dragLastX = e.clientX;
        zappy3D.dragAccum = 0;
        try { stageEl.setPointerCapture(e.pointerId); } catch { }
    });

    stageEl.addEventListener('pointerup', e => {
        if (!zappy3D.isDragging) return;
        zappy3D.isDragging = false;
        try { stageEl.releasePointerCapture(e.pointerId); } catch { }

        if (zappy3D.dragAccum < 10) {
            petZappyMascot();
        }
    });
}

function bumpZappyLevel() {
    zappy3D.petsCount++;
    const lvl = 1 + Math.floor(zappy3D.petsCount / 5);
    const badge = document.getElementById('zappy-lvl-badge');
    if (badge) badge.innerText = `LVL ${lvl}`;
}

function petZappyMascot() {
    if (!zappy3D.initialized) return;
    zappy3D.mood = 'happy';
    zappy3D.moodTimer = 100;
    zappy3D.jumpVel = 0.14;
    zappy3D.squash = 1.25;
    zappy3D.spinVelY = 0.22;
    bumpZappyLevel();

    const phrase = ZAPPY_VOXEL_PHRASES_PET[Math.floor(Math.random() * ZAPPY_VOXEL_PHRASES_PET.length)];
    setZappySpeechText(phrase);
}

function feedZappyCookie() {
    if (!zappy3D.initialized) return;
    zappy3D.cookieAnim = 1.0;
    zappy3D.cookieGroup.visible = true;
    zappy3D.mood = 'eating';
    zappy3D.moodTimer = 110;
    zappy3D.jumpVel = 0.11;
    bumpZappyLevel();

    const phrase = ZAPPY_VOXEL_PHRASES_COOKIE[Math.floor(Math.random() * ZAPPY_VOXEL_PHRASES_COOKIE.length)];
    setZappySpeechText(phrase);
}

function updateVoxelFaceVisibility(isRunning) {
    const mood = zappy3D.mood;
    const showHappy = (mood === 'happy' || mood === 'eating');
    const showDizzy = (mood === 'dizzy');
    const showSleep = (!showHappy && !showDizzy && (!isRunning || zappy3D.isBlinking));
    const showNormal = (!showHappy && !showDizzy && !showSleep);

    zappy3D.eyeMeshes.forEach(m => m.visible = showNormal);
    zappy3D.happyEyeMeshes.forEach(m => m.visible = showHappy);
    zappy3D.sleepEyeMeshes.forEach(m => m.visible = showSleep);
    zappy3D.dizzyEyeMeshes.forEach(m => m.visible = showDizzy);

    // Открываем ротик при поедании печеньки
    if (zappy3D.mouthMesh) {
        if (mood === 'eating') {
            const openScale = 1.2 + Math.abs(Math.sin(performance.now() * 0.03)) * 2.2;
            zappy3D.mouthMesh.scale.set(1.2, openScale, 1);
        } else {
            zappy3D.mouthMesh.scale.set(1, 1, 1);
        }
    }
}

function animateZappy3D() {
    requestAnimationFrame(animateZappy3D);
    if (!zappy3D.initialized) return;

    const homeTab = document.getElementById('tab-home');
    if (homeTab && !homeTab.classList.contains('active')) return;
    if (document.body.classList.contains('compact-mode')) return;

    const now = performance.now();
    const isRunning = !!appState?.isRunning;
    const theme = getZappyThemeColor();

    // Синхронизируем цвет акцентов котика с выбранным самоцветом
    zappy3D.accentMaterials.forEach(m => {
        m.color.setHex(theme.num);
        if (m.emissive) m.emissive.setHex(theme.num);
    });

    const dot = document.getElementById('zappy-home-dot');
    if (dot) {
        dot.className = `w-2 h-2 rounded-full ${isRunning ? 'dot-online' : 'dot-offline'}`;
    }

    if (zappy3D.moodTimer > 0) {
        zappy3D.moodTimer--;
        if (zappy3D.moodTimer === 0) zappy3D.mood = 'normal';
    }

    zappy3D.blinkTimer--;
    if (zappy3D.blinkTimer <= 0) {
        zappy3D.isBlinking = true;
        if (zappy3D.blinkTimer < -7) {
            zappy3D.isBlinking = false;
            zappy3D.blinkTimer = 95 + Math.floor(Math.random() * 130);
        }
    }

    updateVoxelFaceVisibility(isRunning);

    if (!zappy3D.isDragging) {
        const targetRotY = zappy3D.mouseX * 0.42;
        const targetRotX = zappy3D.mouseY * 0.22;
        zappy3D.rotY += (targetRotY - zappy3D.rotY) * 0.08 + zappy3D.spinVelY;
        zappy3D.rotX += (targetRotX - zappy3D.rotX) * 0.08;
        zappy3D.spinVelY *= 0.88;
    }

    zappy3D.jumpY += zappy3D.jumpVel;
    zappy3D.jumpVel -= 0.009;
    if (zappy3D.jumpY <= 0) {
        zappy3D.jumpY = 0;
        zappy3D.jumpVel = 0;
    }
    zappy3D.squash += (1.0 - zappy3D.squash) * 0.15;

    // 8-битное ступенчатое парение
    const bob = Math.sin(now * (isRunning ? 0.005 : 0.0025)) * 0.10;
    zappy3D.voxelGroup.position.y = bob + zappy3D.jumpY;

    zappy3D.headGroup.rotation.y = zappy3D.rotY;
    zappy3D.headGroup.rotation.x = zappy3D.rotX;
    zappy3D.headGroup.scale.set(1 / Math.sqrt(zappy3D.squash), zappy3D.squash, 1 / Math.sqrt(zappy3D.squash));

    // Виляние кубическим хвостиком и переступание лапками
    const speed = isRunning ? 0.008 : 0.003;
    zappy3D.tailGroup.rotation.z = Math.sin(now * speed * 1.4) * 0.28;
    zappy3D.leftPaw.position.y = Math.sin(now * speed) * 0.08;
    zappy3D.rightPaw.position.y = Math.cos(now * speed) * 0.08;

    // Полёт 8-битной печеньки
    if (zappy3D.cookieAnim > 0) {
        zappy3D.cookieAnim -= 0.04;
        const t = 1.0 - Math.max(0, zappy3D.cookieAnim);
        zappy3D.cookieGroup.position.set(
            (1 - t) * 1.1,
            Math.sin(t * Math.PI) * 0.7,
            (1 - t) * 2.2 + 0.55
        );
        zappy3D.cookieGroup.rotation.y += 0.16;
        zappy3D.cookieGroup.rotation.z += 0.12;

        if (zappy3D.cookieAnim <= 0) {
            zappy3D.cookieGroup.visible = false;
            zappy3D.squash = 0.80;
        }
    }

    zappy3D.renderer.render(zappy3D.scene, zappy3D.camera);
}