// =========================================================================
// МОДУЛЬ: 8-БИТНЫЙ 3D-КОТИК "ZAPPY" (ПИКСЕЛЬНЫЙ КОТ + ИНТЕРАКТИВНЫЙ ТУТОРИАЛ)
// Файл: wwwroot/js/zappy3d.js
// =========================================================================

let zappy3D = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    voxelGroup: null,
    headGroup: null,
    tailGroup: null,
    leftPaw: null,
    rightPaw: null,
    eyeMeshes: [],
    happyEyeMeshes: [],
    sleepEyeMeshes: [],
    dizzyEyeMeshes: [],
    mouthMesh: null,
    accentMaterials: [],
    cookieGroup: null,
    // Физика с жестким лимитом высоты
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
    petsCount: 0,
    // Пошаговый туториал
    tutorialActive: false,
    tutorialStep: 0
};

// Все фразы строго без смайликов и эмодзи
const ZAPPY_PHRASES_PET = [
    'Мур-р... Спасибо за ласку, продолжай в том же духе.',
    'Обожаю, когда меня чешут за пиксельным ушком.',
    'Мурчание синхронизировано с сетевым адаптером.',
    'Клик принят. Уровень кошачьего антистресса повышен.',
    'Слежу за пакетами и мурчу на частоте процессора.'
];

const ZAPPY_PHRASES_COOKIE = [
    'Хрум-хрум... Заблокированный пакет успешно съеден.',
    'Вкусные зашифрованные байты, давай еще.',
    'Пакет переработан в чистую энергию обхода.',
    'Спасибо за угощение, теперь пинг будет еще стабильнее.'
];

const ZAPPY_TUTORIAL_STEPS = [
    {
        title: 'Шаг 1 из 4: Знакомство',
        text: 'Привет! Я Зэппи, твой пиксельный кот-напарник. Давай я быстро покажу, как тут все устроено.'
    },
    {
        title: 'Шаг 2 из 4: Главный запуск',
        text: 'Большая круглая кнопка надо мной включает обход Zapret и прокси для Telegram. А в списке профилей можно автоматически подобрать лучшую стратегию.'
    },
    {
        title: 'Шаг 3 из 4: Моды и Диагностика',
        text: 'Во вкладке Модификации можно собирать свои стратегии, а в Диагностике проверять доступность любого сайта и чинить его в один клик.'
    },
    {
        title: 'Шаг 4 из 4: Отдых и Палитра',
        text: 'Нажми Ctrl+K для быстрого вызова команд. А если станет скучно, просто кликни по мне, чтобы погладить, или угости пакетом данных!'
    }
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

    const reactorContainer = document.getElementById('reactor-container');
    const homeTab = document.getElementById('tab-home');
    if (!reactorContainer && !homeTab) return;

    const oldCard = document.getElementById('zappy-home-card');
    if (oldCard) oldCard.remove();

    const leftCol = reactorContainer ? reactorContainer.parentElement : homeTab;
    if (!leftCol) return;

    const card = document.createElement('div');
    card.id = 'zappy-home-card';
    card.className = 'glass-card rounded-xl p-2.5 mt-3 w-full max-w-[265px] flex items-center gap-2.5 relative overflow-hidden select-none transition-all';
    card.innerHTML = `
        <!-- Левая часть: 3D сцена с пиксельным котиком -->
        <div id="zappy-voxel-stage" class="relative w-[88px] h-[88px] rounded-lg bg-[#0D0D12] border border-[#25252E] flex items-center justify-center shrink-0 cursor-pointer active:cursor-grabbing overflow-hidden" title="Кликни по котику, чтобы погладить, или зажми ЛКМ для вращения">
            <div class="absolute inset-1 rounded-full bg-[var(--accent-soft)] blur-md opacity-55 pointer-events-none"></div>
        </div>

        <!-- Правая часть: Имя, диалог/туториал и кнопки -->
        <div class="flex flex-col justify-between flex-1 min-w-0 min-h-[88px] py-0.5 gap-1">
            <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5">
                    <span id="zappy-home-dot" class="w-2 h-2 rounded-full dot-offline"></span>
                    <span id="zappy-header-title" class="text-[11px] font-mono font-bold text-white tracking-wide truncate">ZAPPY 8-BIT</span>
                </div>
                <span id="zappy-lvl-badge" class="px-1.5 py-0.2 rounded bg-[#1A1A22] border border-[#2C2C38] text-[9.5px] font-mono text-brand shrink-0">LVL 1</span>
            </div>

            <!-- Текст реплики или текущего шага туториала -->
            <div id="zappy-home-speech" class="text-[10px] font-mono text-[#CCCCCC] leading-snug bg-[#121217] border border-[#22222A] rounded px-2 py-1.5 min-h-[38px] flex items-center">
                Кликни по мне, чтобы погладить, или угости пакетом данных.
            </div>

            <!-- Обычные кнопки действий -->
            <div id="zappy-normal-actions" class="flex items-center gap-1.5">
                <button onclick="feedZappyCookie()" class="flex-1 py-1 px-2 rounded bg-[#1D1D24] hover:bg-[#282832] border border-[#2E2E3A] text-[10px] font-mono font-semibold text-[#E0E0E0] hover:text-white flex items-center justify-center cursor-pointer transition active:scale-95">
                    <span>Дать пакет</span>
                </button>
                <button onclick="startZappyTutorial()" class="py-1 px-2 rounded bg-[#1D1D24] hover:bg-[#282832] border border-[#2E2E3A] text-[10px] font-mono font-semibold text-[#999999] hover:text-white flex items-center justify-center cursor-pointer transition active:scale-95" title="Показать краткое обучение с Зэппи">
                    <span>Гид</span>
                </button>
            </div>

            <!-- Кнопки управления туториалом (скрыты по умолчанию) -->
            <div id="zappy-tutorial-actions" class="hidden items-center justify-between gap-1.5">
                <button onclick="skipZappyTutorial()" class="py-1 px-2 rounded bg-[#18181E] hover:bg-[#22222A] border border-[#2A2A34] text-[9.5px] font-mono text-[#888888] hover:text-white cursor-pointer transition">
                    Скрыть
                </button>
                <button id="zappy-tut-next-btn" onclick="nextZappyTutorialStep()" class="flex-1 py-1 px-2 rounded btn-brand text-[10px] font-mono font-bold text-white cursor-pointer transition">
                    Далее
                </button>
            </div>
        </div>
    `;

    leftCol.appendChild(card);

    const styleEl = document.createElement('style');
    styleEl.textContent = `body.compact-mode #zappy-home-card { display: none !important; }`;
    document.head.appendChild(styleEl);

    const stage = document.getElementById('zappy-voxel-stage');
    const size = 88;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.25, 6.3);
    camera.lookAt(0, 0.0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'relative z-10 block';
    stage.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
    dirLight.position.set(4, 7, 5);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x94A3B8, 0.45);
    backLight.position.set(-4, -2, -3);
    scene.add(backLight);

    buildPixelCatVoxelModel(scene);
    setupZappyInteractions(stage);

    Object.assign(zappy3D, {
        initialized: true,
        scene,
        camera,
        renderer
    });

    // Автоматический запуск туториала с Зэппи при первом входе
    if (!localStorage.getItem('zappy_tutorial_done_v1')) {
        setTimeout(() => startZappyTutorial(), 900);
    }

    animateZappy3D();
}

// Собирает настоящего 8-битного воксельного котика (НЕ робота!)
function buildPixelCatVoxelModel(scene) {
    const theme = getZappyThemeColor();
    const u = 0.155; // Базовый размер одного 3D-пикселя (вокселя)

    // Натуральные кошачьи цвета (тёмно-угольная шерсть, более тёмные полоски, белая мордочка и носочки, розовый носик)
    const matFurMain = new THREE.MeshLambertMaterial({ color: 0x2B2D38 }); // Основная шерсть
    const matFurStripe = new THREE.MeshLambertMaterial({ color: 0x1D1E26 }); // Темные кошачьи полоски
    const matFurWhite = new THREE.MeshLambertMaterial({ color: 0xF1F5F9 }); // Белая грудка, щёчки и носочки лап
    const matPinkNose = new THREE.MeshLambertMaterial({ color: 0xF472B6 }); // Розовый носик и ушки
    const matEyePupil = new THREE.MeshBasicMaterial({ color: 0x0B0B0E });   // Черный зрачок
    const matEyeShine = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });   // Белый блик в глазах

    // Цвет темы используется для ошейника, медальона и радужки глаз
    const matCollar = new THREE.MeshLambertMaterial({
        color: theme.num,
        emissive: theme.num,
        emissiveIntensity: 0.25
    });
    const matEyeIris = new THREE.MeshBasicMaterial({ color: theme.num });

    zappy3D.accentMaterials = [matCollar, matEyeIris];

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

    // 1. ПИКСЕЛЬНАЯ ГОЛОВА И ТЕЛО КОТИКА
    headGroup.add(makeBox(8, 6, 6, matFurMain, 0, 1.2, 0));       // Основа головы
    headGroup.add(makeBox(6, 7, 5, matFurMain, 0, 1.2, 0));       // Скругление макушки
    headGroup.add(makeBox(9, 4, 5, matFurMain, 0, 0.6, 0));       // Пухлые кошачьи щёчки

    // Полоски на лбу и по бокам (табби-окрас)
    headGroup.add(makeBox(1.2, 2.2, 0.3, matFurStripe, 0.0, 3.3, 3.05));
    headGroup.add(makeBox(1.0, 1.4, 0.3, matFurStripe, -1.8, 3.1, 3.05));
    headGroup.add(makeBox(1.0, 1.4, 0.3, matFurStripe, 1.8, 3.1, 3.05));
    headGroup.add(makeBox(0.3, 1.0, 2.6, matFurStripe, -4.55, 0.8, 0));
    headGroup.add(makeBox(0.3, 1.0, 2.6, matFurStripe, 4.55, 0.8, 0));

    // Белая пушистая мордочка вокруг носика + пиксельные усы
    headGroup.add(makeBox(4.2, 2.2, 0.6, matFurWhite, 0, -0.3, 3.0));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, -4.8, 0.4, 2.2));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, -4.8, -0.4, 2.2));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, 4.8, 0.4, 2.2));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, 4.8, -0.4, 2.2));

    // Розовый пиксельный носик и ротик
    headGroup.add(makeBox(1.3, 0.8, 0.5, matPinkNose, 0, 0.2, 3.35));
    const mouthMesh = makeBox(1.0, 0.45, 0.4, matFurStripe, 0, -0.65, 3.32);
    headGroup.add(mouthMesh);
    zappy3D.mouthMesh = mouthMesh;

    // 2. ТУЛОВИЩЕ, БЕЛАЯ ГРУДКА И ОШЕЙНИК С МЕДАЛЬОНОМ
    headGroup.add(makeBox(6.2, 3.6, 5.0, matFurMain, 0, -3.2, -0.2)); // Тельце
    headGroup.add(makeBox(3.8, 2.8, 0.5, matFurWhite, 0, -3.3, 2.25)); // Белая грудка
    headGroup.add(makeBox(6.5, 0.8, 5.3, matCollar, 0, -1.9, -0.1)); // Ошейник в цвет темы
    headGroup.add(makeBox(1.2, 1.2, 0.6, matEyeShine, 0, -2.3, 2.65)); // Бубенчик/медальон на шее

    // 3. ПИКСЕЛЬНЫЕ КОШАЧЬИ ГЛАЗА
    const eyeZ = 3.08;
    const openEyesL = new THREE.Group();
    openEyesL.add(
        makeBox(1.8, 2.2, 0.3, matEyeIris, -2.2, 1.3, eyeZ),
        makeBox(1.1, 1.8, 0.35, matEyePupil, -2.1, 1.3, eyeZ + 0.05),
        makeBox(0.6, 0.6, 0.4, matEyeShine, -2.5, 1.8, eyeZ + 0.1)
    );
    const openEyesR = new THREE.Group();
    openEyesR.add(
        makeBox(1.8, 2.2, 0.3, matEyeIris, 2.2, 1.3, eyeZ),
        makeBox(1.1, 1.8, 0.35, matEyePupil, 2.1, 1.3, eyeZ + 0.05),
        makeBox(0.6, 0.6, 0.4, matEyeShine, 1.9, 1.8, eyeZ + 0.1)
    );
    headGroup.add(openEyesL, openEyesR);
    zappy3D.eyeMeshes = [openEyesL, openEyesR];

    // Радостно зажмуренные глазки-дуги
    const happyGroupL = new THREE.Group();
    happyGroupL.add(
        makeBox(0.7, 0.7, 0.3, matEyeIris, -2.8, 1.1, eyeZ),
        makeBox(0.8, 0.7, 0.3, matEyeIris, -2.2, 1.8, eyeZ),
        makeBox(0.7, 0.7, 0.3, matEyeIris, -1.6, 1.1, eyeZ)
    );
    const happyGroupR = new THREE.Group();
    happyGroupR.add(
        makeBox(0.7, 0.7, 0.3, matEyeIris, 1.6, 1.1, eyeZ),
        makeBox(0.8, 0.7, 0.3, matEyeIris, 2.2, 1.8, eyeZ),
        makeBox(0.7, 0.7, 0.3, matEyeIris, 2.8, 1.1, eyeZ)
    );
    happyGroupL.visible = false;
    happyGroupR.visible = false;
    headGroup.add(happyGroupL, happyGroupR);
    zappy3D.happyEyeMeshes = [happyGroupL, happyGroupR];

    // Сонные / моргающие глаза
    const sleepL = makeBox(2.0, 0.6, 0.3, matEyeIris, -2.2, 1.2, eyeZ);
    const sleepR = makeBox(2.0, 0.6, 0.3, matEyeIris, 2.2, 1.2, eyeZ);
    sleepL.visible = false;
    sleepR.visible = false;
    headGroup.add(sleepL, sleepR);
    zappy3D.sleepEyeMeshes = [sleepL, sleepR];

    // Головокружение (крестики)
    const dizzyL = new THREE.Group();
    dizzyL.add(
        makeBox(0.6, 0.6, 0.3, matEyeIris, -2.7, 1.8, eyeZ),
        makeBox(0.6, 0.6, 0.3, matEyeIris, -1.7, 1.8, eyeZ),
        makeBox(0.7, 0.7, 0.3, matEyeIris, -2.2, 1.3, eyeZ),
        makeBox(0.6, 0.6, 0.3, matEyeIris, -2.7, 0.8, eyeZ),
        makeBox(0.6, 0.6, 0.3, matEyeIris, -1.7, 0.8, eyeZ)
    );
    const dizzyR = dizzyL.clone();
    dizzyR.position.x = 4.4 * u;
    dizzyL.visible = false;
    dizzyR.visible = false;
    headGroup.add(dizzyL, dizzyR);
    zappy3D.dizzyEyeMeshes = [dizzyL, dizzyR];

    // 4. СТУПЕНЧАТЫЕ 8-БИТНЫЕ КОШАЧЬИ УШКИ С РОЗОВОЙ СЕРЕДИНКОЙ
    [-2.7, 2.7].forEach(ex => {
        headGroup.add(makeBox(2.8, 1.2, 2.0, matFurMain, ex, 4.8, 0));
        headGroup.add(makeBox(2.0, 1.2, 1.6, matFurMain, ex, 5.8, 0));
        headGroup.add(makeBox(1.1, 1.0, 1.2, matFurStripe, ex, 6.7, 0));
        headGroup.add(makeBox(1.4, 1.4, 0.4, matPinkNose, ex, 5.1, 0.9));
    });

    // 5. ЛАПКИ С БЕЛЫМИ НОСОЧКАМИ И ПИКСЕЛЬНЫЙ ХВОСТ
    const leftPaw = new THREE.Group();
    leftPaw.add(makeBox(2.0, 1.6, 2.2, matFurMain, -2.2, -4.8, 0.8));
    leftPaw.add(makeBox(2.1, 0.9, 1.6, matFurWhite, -2.2, -5.2, 1.4)); // Белый носочек
    voxelGroup.add(leftPaw);

    const rightPaw = new THREE.Group();
    rightPaw.add(makeBox(2.0, 1.6, 2.2, matFurMain, 2.2, -4.8, 0.8));
    rightPaw.add(makeBox(2.1, 0.9, 1.6, matFurWhite, 2.2, -5.2, 1.4)); // Белый носочек
    voxelGroup.add(rightPaw);

    const tailGroup = new THREE.Group();
    tailGroup.add(
        makeBox(1.1, 1.1, 1.6, matFurMain, 0, -3.8, -3.2),
        makeBox(1.1, 1.8, 1.2, matFurStripe, 0, -2.8, -4.2),
        makeBox(1.1, 1.8, 1.2, matFurMain, 0, -1.3, -4.8),
        makeBox(1.1, 1.1, 1.1, matFurWhite, 0, -0.1, -5.0) // Белый кончик хвоста
    );
    voxelGroup.add(tailGroup);

    // 6. 8-БИТНЫЙ ПАКЕТ-ПЕЧЕНЬКА
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

// =========================================================================
// ИНТЕРАКТИВНЫЙ ТУТОРИАЛ С ЗЭППИ (ЗАПУСКАЕТСЯ ПРИ ПЕРВОМ ВХОДЕ ИЛИ ПО КНОПКЕ)
// =========================================================================
function startZappyTutorial() {
    zappy3D.tutorialActive = true;
    zappy3D.tutorialStep = 0;

    document.getElementById('zappy-normal-actions')?.classList.add('hidden');
    const tutActions = document.getElementById('zappy-tutorial-actions');
    if (tutActions) {
        tutActions.classList.remove('hidden');
        tutActions.classList.add('flex');
    }

    renderZappyTutorialStep();
}

function renderZappyTutorialStep() {
    const stepObj = ZAPPY_TUTORIAL_STEPS[zappy3D.tutorialStep];
    if (!stepObj) {
        skipZappyTutorial();
        return;
    }

    const titleEl = document.getElementById('zappy-header-title');
    if (titleEl) titleEl.innerText = stepObj.title;

    setZappySpeechText(stepObj.text);

    const nextBtn = document.getElementById('zappy-tut-next-btn');
    if (nextBtn) {
        nextBtn.innerText = (zappy3D.tutorialStep >= ZAPPY_TUTORIAL_STEPS.length - 1) ? 'Понятно' : 'Далее';
    }

    // Котик радостно подпрыгивает на каждом шаге обучения
    zappy3D.mood = 'happy';
    zappy3D.moodTimer = 70;
    zappy3D.jumpVel = Math.min(0.09, zappy3D.jumpVel + 0.07);
}

function nextZappyTutorialStep() {
    zappy3D.tutorialStep++;
    if (zappy3D.tutorialStep >= ZAPPY_TUTORIAL_STEPS.length) {
        skipZappyTutorial();
    } else {
        renderZappyTutorialStep();
    }
}

function skipZappyTutorial() {
    zappy3D.tutorialActive = false;
    localStorage.setItem('zappy_tutorial_done_v1', '1');

    const titleEl = document.getElementById('zappy-header-title');
    if (titleEl) titleEl.innerText = 'ZAPPY 8-BIT';

    const tutActions = document.getElementById('zappy-tutorial-actions');
    if (tutActions) {
        tutActions.classList.add('hidden');
        tutActions.classList.remove('flex');
    }
    document.getElementById('zappy-normal-actions')?.classList.remove('hidden');

    setZappySpeechText('Обучение завершено. Я всегда рядом на Главном экране.');
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
            zappy3D.spinVelY = Math.max(-0.25, Math.min(0.25, dx * 0.03));
            zappy3D.rotY += zappy3D.spinVelY;
            zappy3D.dragAccum += Math.abs(dx);

            if (zappy3D.dragAccum > 220 && zappy3D.mood !== 'dizzy') {
                zappy3D.mood = 'dizzy';
                zappy3D.moodTimer = 140;
                if (!zappy3D.tutorialActive) {
                    setZappySpeechText('Ой-ой, слишком быстрое вращение, голова кружится.');
                }
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
    zappy3D.moodTimer = 95;

    // Строгий лимит скорости прыжка и сквиша при спаме кликами!
    if (zappy3D.jumpY < 0.18) {
        zappy3D.jumpVel = Math.min(0.11, zappy3D.jumpVel + 0.09);
    }
    zappy3D.squash = Math.min(1.22, zappy3D.squash + 0.16);
    zappy3D.spinVelY = 0.18;
    bumpZappyLevel();

    if (!zappy3D.tutorialActive) {
        const phrase = ZAPPY_PHRASES_PET[Math.floor(Math.random() * ZAPPY_PHRASES_PET.length)];
        setZappySpeechText(phrase);
    }
}

function feedZappyCookie() {
    if (!zappy3D.initialized) return;
    zappy3D.cookieAnim = 1.0;
    zappy3D.cookieGroup.visible = true;
    zappy3D.mood = 'eating';
    zappy3D.moodTimer = 110;

    if (zappy3D.jumpY < 0.18) {
        zappy3D.jumpVel = Math.min(0.10, zappy3D.jumpVel + 0.08);
    }
    bumpZappyLevel();

    if (!zappy3D.tutorialActive) {
        const phrase = ZAPPY_PHRASES_COOKIE[Math.floor(Math.random() * ZAPPY_PHRASES_COOKIE.length)];
        setZappySpeechText(phrase);
    }
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
        const targetRotY = zappy3D.mouseX * 0.40;
        const targetRotX = zappy3D.mouseY * 0.20;
        zappy3D.rotY += (targetRotY - zappy3D.rotY) * 0.08 + zappy3D.spinVelY;
        zappy3D.rotX += (targetRotX - zappy3D.rotX) * 0.08;
        zappy3D.spinVelY *= 0.88;
    }

    // Прыжок с ЖЕСТКИМ ПОТОЛКОМ (MAX_JUMP_Y = 0.28), чтобы при спаме котик никогда не улетал из рамки!
    zappy3D.jumpY += zappy3D.jumpVel;
    zappy3D.jumpVel -= 0.010;
    if (zappy3D.jumpY > 0.28) {
        zappy3D.jumpY = 0.28;
        if (zappy3D.jumpVel > 0) zappy3D.jumpVel = 0;
    }
    if (zappy3D.jumpY <= 0) {
        zappy3D.jumpY = 0;
        zappy3D.jumpVel = 0;
    }

    zappy3D.squash += (1.0 - zappy3D.squash) * 0.16;
    zappy3D.squash = Math.max(0.78, Math.min(1.24, zappy3D.squash));

    const bob = Math.sin(now * (isRunning ? 0.0045 : 0.0022)) * 0.07;
    zappy3D.voxelGroup.position.y = bob + zappy3D.jumpY;

    zappy3D.headGroup.rotation.y = zappy3D.rotY;
    zappy3D.headGroup.rotation.x = zappy3D.rotX;
    zappy3D.headGroup.scale.set(1 / Math.sqrt(zappy3D.squash), zappy3D.squash, 1 / Math.sqrt(zappy3D.squash));

    const speed = isRunning ? 0.008 : 0.003;
    zappy3D.tailGroup.rotation.z = Math.sin(now * speed * 1.4) * 0.26;
    zappy3D.leftPaw.position.y = Math.sin(now * speed) * 0.06;
    zappy3D.rightPaw.position.y = Math.cos(now * speed) * 0.06;

    if (zappy3D.cookieAnim > 0) {
        zappy3D.cookieAnim -= 0.04;
        const t = 1.0 - Math.max(0, zappy3D.cookieAnim);
        zappy3D.cookieGroup.position.set(
            (1 - t) * 1.0,
            Math.sin(t * Math.PI) * 0.55,
            (1 - t) * 2.1 + 0.55
        );
        zappy3D.cookieGroup.rotation.y += 0.16;
        zappy3D.cookieGroup.rotation.z += 0.12;

        if (zappy3D.cookieAnim <= 0) {
            zappy3D.cookieGroup.visible = false;
            zappy3D.squash = 0.82;
        }
    }

    zappy3D.renderer.render(zappy3D.scene, zappy3D.camera);
}