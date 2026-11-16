// =========================================================================
// МОДУЛЬ: 8-БИТНЫЙ 3D-КОТИК "ZAPPY" В БОКОВОМ МЕНЮ (ВСЕГДА РЯДОМ НА ВСЕХ ВКЛАДКАХ)
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
    tutorialActive: false,
    tutorialStep: 0,
    lookOverrideX: null,
    lookOverrideY: null
};

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
        tab: 'home',
        target: () => document.getElementById('reactor-container'),
        title: 'Шаг 1 из 5: Сердце обхода',
        text: 'Привет! Я Зэппи. Эта большая кнопка включает и выключает обход блокировок Zapret и прокси для Telegram.'
    },
    {
        tab: 'home',
        target: () => document.getElementById('txt-main-profile')?.closest('.glass-card') || document.getElementById('home-cards-col'),
        title: 'Шаг 2 из 5: Выбор стратегии и Игры',
        text: 'Здесь выбирается активный профиль обхода. Внутри можно запустить умный авто-подбор лучшей стратегии под твоего провайдера и включить игровой фильтр.'
    },
    {
        tab: 'mods',
        target: () => document.getElementById('mods-seg-track') || document.querySelector('#tab-mods .glass-card'),
        title: 'Шаг 3 из 5: Мастерская модификаций',
        text: 'В Мастерской можно создавать свои списки сайтов и собирать собственные стратегии в визуальном конструкторе с 3D-лабораторией пакетов.'
    },
    {
        tab: 'diag',
        target: () => document.getElementById('site-check-input')?.closest('.glass-card') || document.getElementById('btn-run-diag'),
        title: 'Шаг 4 из 5: Диагностика и Быстрый фикс',
        text: 'Если какой-то сайт не открывается, введи его адрес сюда. Анализатор найдет причину блокировки и починит доступ в один клик.'
    },
    {
        tab: 'settings',
        target: () => document.querySelector('#tab-settings .gem-field-wrap') || document.getElementById('settings-seg-track'),
        title: 'Шаг 5 из 5: Самоцветы тем и Команды',
        text: 'В Настройках можно выбрать 3D-камень темы, обновить базы IPSet и Hosts. А я всегда буду сидеть слева под вкладками!'
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

    const sidebar = document.getElementById('sidebar');
    const sidebarFooter = document.getElementById('sidebar-footer');
    if (!sidebar) return;

    document.getElementById('zappy-home-card')?.remove();
    document.getElementById('zappy-sidebar-card')?.remove();
    document.getElementById('zappy-tutorial-overlay')?.remove();

    // 1. Вертикальная уютная карточка Зэппи прямо внутри бокового меню (#sidebar)
    const card = document.createElement('div');
    card.id = 'zappy-sidebar-card';
    card.className = 'w-[200px] rounded-xl bg-[#121216] border border-[#26262E] p-2.5 mt-auto mb-2.5 flex flex-col gap-2 relative overflow-hidden select-none transition-all';
    card.innerHTML = `
        <!-- Шапка карточки: Статус + Имя + Уровень -->
        <div class="flex items-center justify-between px-0.5">
            <div class="flex items-center gap-1.5">
                <span id="zappy-home-dot" class="w-2 h-2 rounded-full dot-offline"></span>
                <span id="zappy-header-title" class="text-[11px] font-mono font-bold text-white tracking-wide">ZAPPY 8-BIT</span>
            </div>
            <span id="zappy-lvl-badge" class="px-1.5 py-0.2 rounded bg-[#1A1A22] border border-[#2C2C38] text-[9.5px] font-mono text-brand">LVL 1</span>
        </div>

        <!-- 3D-сцена с пиксельным котиком -->
        <div id="zappy-home-slot" class="relative w-full h-[108px] rounded-lg bg-[#0A0A0E] border border-[#22222A] flex items-center justify-center overflow-hidden">
            <div class="absolute inset-2 rounded-full bg-[var(--accent-soft)] blur-md opacity-55 pointer-events-none"></div>
            <div id="zappy-voxel-stage" class="w-[108px] h-[108px] flex items-center justify-center cursor-pointer active:cursor-grabbing relative z-10" title="Кликни по котику, чтобы погладить, или зажми ЛКМ для вращения"></div>
        </div>

        <!-- Диалоговое облачко Зэппи -->
        <div id="zappy-home-speech" class="text-[10px] font-mono text-[#CCCCCC] leading-snug bg-[#0E0E13] border border-[#202028] rounded-lg px-2 py-1.5 min-h-[42px] flex items-center text-center justify-center">
            Кликни по мне, чтобы погладить, или угости пакетом.
        </div>

        <!-- Кнопки: Дать пакет и Гид -->
        <div class="flex items-center gap-1.5">
            <button onclick="feedZappyCookie()" class="flex-1 py-1 px-2 rounded-md bg-[#1B1B22] hover:bg-[#252530] border border-[#2C2C38] text-[10px] font-mono font-semibold text-[#E0E0E0] hover:text-white flex items-center justify-center cursor-pointer transition active:scale-95">
                <span>Дать пакет</span>
            </button>
            <button onclick="startZappyTutorial()" class="py-1 px-2.5 rounded-md bg-[#1B1B22] hover:bg-[#252530] border border-[#2C2C38] text-[10px] font-mono font-semibold text-[#999999] hover:text-white flex items-center justify-center cursor-pointer transition active:scale-95" title="Запустить интерактивный тур по программе с Зэппи">
                <span>Гид</span>
            </button>
        </div>
    `;

    if (sidebarFooter) {
        sidebar.insertBefore(card, sidebarFooter);
    } else {
        sidebar.appendChild(card);
    }

    // 2. Полноэкранный Spotlight-оверлей для полётов Зэппи во время туториала
    const overlay = document.createElement('div');
    overlay.id = 'zappy-tutorial-overlay';
    overlay.className = 'fixed inset-0 z-[9990] pointer-events-auto hidden';
    overlay.innerHTML = `
        <div id="zappy-spotlight-hole" class="fixed rounded-xl pointer-events-none transition-all duration-300 ease-out"
             style="box-shadow: 0 0 0 9999px rgba(6, 6, 10, 0.80), 0 0 28px var(--accent-glow); border: 2px solid var(--accent-light);"></div>

        <div id="zappy-flying-companion" class="fixed z-[9995] w-[360px] rounded-2xl bg-[#121218]/95 border border-[var(--accent-light)] p-3 shadow-2xl flex items-center gap-3 transition-all duration-300 ease-out backdrop-blur-md">
            <div id="zappy-flying-slot" class="relative w-[108px] h-[108px] rounded-xl bg-[#0A0A0F] border border-[#282834] flex items-center justify-center shrink-0 overflow-hidden">
                <div class="absolute inset-1 rounded-full bg-[var(--accent-soft)] blur-md opacity-70 pointer-events-none"></div>
            </div>

            <div class="flex flex-col justify-between flex-1 min-w-0 gap-2">
                <div class="flex items-center justify-between">
                    <span id="zappy-fly-title" class="text-xs font-mono font-bold text-brand truncate">Шаг 1 из 5</span>
                    <button onclick="skipZappyTutorial()" class="text-[10px] font-mono text-[#777777] hover:text-white cursor-pointer transition">Закрыть</button>
                </div>

                <div id="zappy-fly-text" class="text-[11px] font-mono text-[#E0E0E0] leading-relaxed">
                    Описание элемента...
                </div>

                <div class="flex items-center justify-between gap-2 pt-1 border-t border-[#22222C]">
                    <button id="zappy-fly-prev" onclick="prevZappyTutorialStep()" class="px-2.5 py-1 rounded-md bg-[#1C1C24] hover:bg-[#262630] border border-[#30303C] text-[10px] font-mono text-[#BBBBBB] hover:text-white cursor-pointer transition">
                        Назад
                    </button>
                    <div class="flex items-center gap-1.5">
                        <button onclick="skipZappyTutorial()" class="px-2.5 py-1 rounded-md bg-[#1C1C24] hover:bg-[#262630] border border-[#30303C] text-[10px] font-mono text-[#888888] hover:text-white cursor-pointer transition">
                            Пропустить
                        </button>
                        <button id="zappy-fly-next" onclick="nextZappyTutorialStep()" class="px-3 py-1 rounded-md btn-brand text-[10.5px] font-mono font-bold text-white cursor-pointer transition shadow">
                            Далее
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Скрываем карточку Зэппи, когда сайдбар свёрнут в узкую полоску (rail-mode или compact-mode)
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        #sidebar.rail-mode #zappy-sidebar-card,
        body.compact-mode #zappy-sidebar-card {
            display: none !important;
        }
    `;
    document.head.appendChild(styleEl);

    const stage = document.getElementById('zappy-voxel-stage');
    const size = 108;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.25, 6.2);
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

    window.addEventListener('resize', () => {
        if (zappy3D.tutorialActive) positionSpotlightAndFlyingZappy();
    });

    Object.assign(zappy3D, {
        initialized: true,
        scene,
        camera,
        renderer
    });

    if (!localStorage.getItem('zappy_tutorial_done_v2')) {
        setTimeout(() => {
            const wiz = document.getElementById('wizard-modal');
            if (!wiz || !wiz.classList.contains('open')) {
                startZappyTutorial();
            }
        }, 1200);
    }

    animateZappy3D();
}

function buildPixelCatVoxelModel(scene) {
    const theme = getZappyThemeColor();
    const u = 0.155;

    const matFurMain = new THREE.MeshLambertMaterial({ color: 0x2B2D38 });
    const matFurStripe = new THREE.MeshLambertMaterial({ color: 0x1D1E26 });
    const matFurWhite = new THREE.MeshLambertMaterial({ color: 0xF1F5F9 });
    const matPinkNose = new THREE.MeshLambertMaterial({ color: 0xF472B6 });
    const matEyePupil = new THREE.MeshBasicMaterial({ color: 0x0B0B0E });
    const matEyeShine = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

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

    // 1. ПИКСЕЛЬНАЯ ГОЛОВА И МОРДОЧКА КОТА
    headGroup.add(makeBox(8, 6, 6, matFurMain, 0, 1.2, 0));
    headGroup.add(makeBox(6, 7, 5, matFurMain, 0, 1.2, 0));
    headGroup.add(makeBox(9, 4, 5, matFurMain, 0, 0.6, 0));

    headGroup.add(makeBox(1.2, 2.2, 0.3, matFurStripe, 0.0, 3.3, 3.05));
    headGroup.add(makeBox(1.0, 1.4, 0.3, matFurStripe, -1.8, 3.1, 3.05));
    headGroup.add(makeBox(1.0, 1.4, 0.3, matFurStripe, 1.8, 3.1, 3.05));
    headGroup.add(makeBox(0.3, 1.0, 2.6, matFurStripe, -4.55, 0.8, 0));
    headGroup.add(makeBox(0.3, 1.0, 2.6, matFurStripe, 4.55, 0.8, 0));

    headGroup.add(makeBox(4.2, 2.2, 0.6, matFurWhite, 0, -0.3, 3.0));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, -4.8, 0.4, 2.2));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, -4.8, -0.4, 2.2));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, 4.8, 0.4, 2.2));
    headGroup.add(makeBox(1.0, 0.5, 0.3, matFurWhite, 4.8, -0.4, 2.2));

    headGroup.add(makeBox(1.3, 0.8, 0.5, matPinkNose, 0, 0.2, 3.35));
    const mouthMesh = makeBox(1.0, 0.45, 0.4, matFurStripe, 0, -0.65, 3.32);
    headGroup.add(mouthMesh);
    zappy3D.mouthMesh = mouthMesh;

    // 2. ТУЛОВИЩЕ, БЕЛАЯ ГРУДКА И ОШЕЙНИК
    headGroup.add(makeBox(6.2, 3.6, 5.0, matFurMain, 0, -3.2, -0.2));
    headGroup.add(makeBox(3.8, 2.8, 0.5, matFurWhite, 0, -3.3, 2.25));
    headGroup.add(makeBox(6.5, 0.8, 5.3, matCollar, 0, -1.9, -0.1));
    headGroup.add(makeBox(1.2, 1.2, 0.6, matEyeShine, 0, -2.3, 2.65));

    // 3. ПИКСЕЛЬНЫЕ КОШАЧЬИ ГЛАЗКИ
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

    const sleepL = makeBox(2.0, 0.6, 0.3, matEyeIris, -2.2, 1.2, eyeZ);
    const sleepR = makeBox(2.0, 0.6, 0.3, matEyeIris, 2.2, 1.2, eyeZ);
    sleepL.visible = false;
    sleepR.visible = false;
    headGroup.add(sleepL, sleepR);
    zappy3D.sleepEyeMeshes = [sleepL, sleepR];

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

    // 4. УШКИ
    [-2.7, 2.7].forEach(ex => {
        headGroup.add(makeBox(2.8, 1.2, 2.0, matFurMain, ex, 4.8, 0));
        headGroup.add(makeBox(2.0, 1.2, 1.6, matFurMain, ex, 5.8, 0));
        headGroup.add(makeBox(1.1, 1.0, 1.2, matFurStripe, ex, 6.7, 0));
        headGroup.add(makeBox(1.4, 1.4, 0.4, matPinkNose, ex, 5.1, 0.9));
    });

    // 5. ЛАПКИ И ХВОСТ
    const leftPaw = new THREE.Group();
    leftPaw.add(makeBox(2.0, 1.6, 2.2, matFurMain, -2.2, -4.8, 0.8));
    leftPaw.add(makeBox(2.1, 0.9, 1.6, matFurWhite, -2.2, -5.2, 1.4));
    voxelGroup.add(leftPaw);

    const rightPaw = new THREE.Group();
    rightPaw.add(makeBox(2.0, 1.6, 2.2, matFurMain, 2.2, -4.8, 0.8));
    rightPaw.add(makeBox(2.1, 0.9, 1.6, matFurWhite, 2.2, -5.2, 1.4));
    voxelGroup.add(rightPaw);

    const tailGroup = new THREE.Group();
    tailGroup.add(
        makeBox(1.1, 1.1, 1.6, matFurMain, 0, -3.8, -3.2),
        makeBox(1.1, 1.8, 1.2, matFurStripe, 0, -2.8, -4.2),
        makeBox(1.1, 1.8, 1.2, matFurMain, 0, -1.3, -4.8),
        makeBox(1.1, 1.1, 1.1, matFurWhite, 0, -0.1, -5.0)
    );
    voxelGroup.add(tailGroup);

    // 6. ПАКЕТ-ПЕЧЕНЬКА
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

function startZappyTutorial() {
    if (!zappy3D.initialized) return;
    zappy3D.tutorialActive = true;
    zappy3D.tutorialStep = 0;

    const stage = document.getElementById('zappy-voxel-stage');
    const flyingSlot = document.getElementById('zappy-flying-slot');
    const overlay = document.getElementById('zappy-tutorial-overlay');

    if (stage && flyingSlot && overlay) {
        flyingSlot.appendChild(stage);
        overlay.classList.remove('hidden');
    }

    renderZappyTutorialStep();
}

function renderZappyTutorialStep() {
    const stepObj = ZAPPY_TUTORIAL_STEPS[zappy3D.tutorialStep];
    if (!stepObj) {
        skipZappyTutorial();
        return;
    }

    if (stepObj.tab && typeof switchTab === 'function') {
        const currentActive = document.getElementById('tab-' + stepObj.tab);
        if (currentActive && !currentActive.classList.contains('active')) {
            switchTab(stepObj.tab);
        }
    }

    const titleEl = document.getElementById('zappy-fly-title');
    const textEl = document.getElementById('zappy-fly-text');
    const prevBtn = document.getElementById('zappy-fly-prev');
    const nextBtn = document.getElementById('zappy-fly-next');

    if (titleEl) titleEl.innerText = stepObj.title;
    if (textEl) textEl.innerText = stepObj.text;
    if (prevBtn) {
        prevBtn.disabled = zappy3D.tutorialStep === 0;
        prevBtn.style.opacity = zappy3D.tutorialStep === 0 ? '0.35' : '1';
    }
    if (nextBtn) {
        nextBtn.innerText = (zappy3D.tutorialStep >= ZAPPY_TUTORIAL_STEPS.length - 1) ? 'Завершить' : 'Далее';
    }

    zappy3D.mood = 'happy';
    zappy3D.moodTimer = 85;
    zappy3D.jumpVel = 0.09;
    zappy3D.spinVelY = 0.20;

    requestAnimationFrame(() => {
        setTimeout(() => positionSpotlightAndFlyingZappy(), 40);
    });
}

function positionSpotlightAndFlyingZappy() {
    if (!zappy3D.tutorialActive) return;

    const stepObj = ZAPPY_TUTORIAL_STEPS[zappy3D.tutorialStep];
    const hole = document.getElementById('zappy-spotlight-hole');
    const companion = document.getElementById('zappy-flying-companion');
    if (!stepObj || !hole || !companion) return;

    const targetEl = typeof stepObj.target === 'function' ? stepObj.target() : null;
    if (!targetEl) return;

    try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch { }

    const rect = targetEl.getBoundingClientRect();
    const pad = 8;

    const holeLeft = Math.max(8, rect.left - pad);
    const holeTop = Math.max(8, rect.top - pad);
    const holeW = Math.min(window.innerWidth - holeLeft - 8, rect.width + pad * 2);
    const holeH = Math.min(window.innerHeight - holeTop - 8, rect.height + pad * 2);

    hole.style.left = `${holeLeft}px`;
    hole.style.top = `${holeTop}px`;
    hole.style.width = `${holeW}px`;
    hole.style.height = `${holeH}px`;

    const compW = 360;
    const compH = companion.offsetHeight || 136;
    const margin = 16;

    let compX = holeLeft + holeW + margin;
    let compY = holeTop + (holeH - compH) / 2;

    if (compX + compW > window.innerWidth - 12) {
        compX = holeLeft - compW - margin;
    }
    if (compX < 12) {
        compX = Math.max(14, Math.min(window.innerWidth - compW - 14, holeLeft + (holeW - compW) / 2));
        if (holeTop + holeH + compH + margin < window.innerHeight - 12) {
            compY = holeTop + holeH + margin;
        } else {
            compY = Math.max(54, holeTop - compH - margin);
        }
    }

    compY = Math.max(52, Math.min(window.innerHeight - compH - 14, compY));

    companion.style.left = `${Math.round(compX)}px`;
    companion.style.top = `${Math.round(compY)}px`;

    const targetCenterX = holeLeft + holeW / 2;
    const compCenterX = compX + compW / 2;
    zappy3D.lookOverrideX = Math.max(-0.8, Math.min(0.8, (targetCenterX - compCenterX) / 300));
    zappy3D.lookOverrideY = 0;
}

function nextZappyTutorialStep() {
    zappy3D.tutorialStep++;
    if (zappy3D.tutorialStep >= ZAPPY_TUTORIAL_STEPS.length) {
        skipZappyTutorial();
    } else {
        renderZappyTutorialStep();
    }
}

function prevZappyTutorialStep() {
    if (zappy3D.tutorialStep > 0) {
        zappy3D.tutorialStep--;
        renderZappyTutorialStep();
    }
}

function skipZappyTutorial() {
    zappy3D.tutorialActive = false;
    zappy3D.lookOverrideX = null;
    zappy3D.lookOverrideY = null;
    localStorage.setItem('zappy_tutorial_done_v2', '1');

    const stage = document.getElementById('zappy-voxel-stage');
    const homeSlot = document.getElementById('zappy-home-slot');
    const overlay = document.getElementById('zappy-tutorial-overlay');

    if (overlay) overlay.classList.add('hidden');
    if (stage && homeSlot) homeSlot.appendChild(stage);

    if (typeof switchTab === 'function') {
        switchTab('home');
    }

    setZappySpeechText('Экскурсия окончена. Я всегда рядом в боковом меню.');
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
    const showSleep = (!showHappy && !showDizzy && (!isRunning && !zappy3D.tutorialActive || zappy3D.isBlinking));
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

    const sidebar = document.getElementById('sidebar');
    if (!zappy3D.tutorialActive) {
        if (document.body.classList.contains('compact-mode')) return;
        if (sidebar && sidebar.classList.contains('rail-mode')) return;
    }

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
        const lookX = zappy3D.lookOverrideX !== null ? zappy3D.lookOverrideX : zappy3D.mouseX;
        const lookY = zappy3D.lookOverrideY !== null ? zappy3D.lookOverrideY : zappy3D.mouseY;
        const targetRotY = lookX * 0.42;
        const targetRotX = lookY * 0.20;
        zappy3D.rotY += (targetRotY - zappy3D.rotY) * 0.08 + zappy3D.spinVelY;
        zappy3D.rotX += (targetRotX - zappy3D.rotX) * 0.08;
        zappy3D.spinVelY *= 0.88;
    }

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

    const bob = Math.sin(now * (isRunning || zappy3D.tutorialActive ? 0.0048 : 0.0022)) * 0.07;
    zappy3D.voxelGroup.position.y = bob + zappy3D.jumpY;

    zappy3D.headGroup.rotation.y = zappy3D.rotY;
    zappy3D.headGroup.rotation.x = zappy3D.rotX;
    zappy3D.headGroup.scale.set(1 / Math.sqrt(zappy3D.squash), zappy3D.squash, 1 / Math.sqrt(zappy3D.squash));

    const speed = isRunning || zappy3D.tutorialActive ? 0.008 : 0.003;
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