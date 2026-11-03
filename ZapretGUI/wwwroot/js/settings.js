// =========================================================================
// УПРАВЛЕНИЕ ВКЛАДКОЙ НАСТРОЕК (SETTINGSVIEW — BENTO GRID v4.1)
// =========================================================================

const INTERVAL_NAMES = {
    1: '1 сек.',
    2: '2 сек.',
    5: '5 сек.',
    10: '10 сек.'
};

const HOSTS_SOURCE_NAMES = [
    'Только Flowseal (Discord / YT)',
    'Только V3nilla (ChatGPT / AI / Spotify)',
    'Flowseal + V3nilla (Рекомендуется)',
    'Flowseal + V3nilla + AdBlock (0.0.0.0)'
];

const IPSET_MODE_NAMES = {
    'loaded': 'По списку (Loaded)',
    'any': 'Весь трафик (Any)',
    'none': 'Отключен (Заглушка)'
};

const ACCENT_THEME_NAMES = {
    'green': 'Изумруд',
    'blue': 'Сапфир',
    'purple': 'Аметист',
    'amber': 'Топаз',
    'cyan': 'Аквамарин'
};

let currentSettingsCat = 'all';
let saveToastTimeout = null;

function applyAccentThemeToDom(theme) {
    const clean = theme || 'green';
    document.body.setAttribute('data-accent', clean);
    document.querySelectorAll('[data-accent-btn]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-accent-btn') === clean);
    });
    const wizThemeLbl = document.getElementById('wiz-sum-theme');
    if (wizThemeLbl) {
        wizThemeLbl.innerText = ACCENT_THEME_NAMES[clean] || 'Зеленая';
    }
    if (typeof drawChart === 'function') {
        drawChart();
    }
}

function selectAccentTheme(theme) {
    sendCmd('playClick');
    appState.settings.accentTheme = theme || 'green';
    applyAccentThemeToDom(appState.settings.accentTheme);
    onSettingsChanged();
}

function initSettingsFromBackend(data) {
    const s = data.settings || {};

    appState.settings.focusMode = !!s.focusMode;
    appState.settings.compactMode = !!s.compactMode;
    appState.settings.statsUpdateInterval = s.statsUpdateInterval || 1;
    appState.settings.hostsSourceIndex = s.hostsSourceIndex ?? 2;
    appState.settings.accentTheme = s.accentTheme || 'green';
    appState.settings.watchdogPingAutoRestart = !!s.watchdogPingAutoRestart;

    // Применяем тему и компактный режим
    applyAccentThemeToDom(appState.settings.accentTheme);
    document.body.classList.toggle('compact-mode', appState.settings.compactMode);

    // Если включен пропуск интро — сразу скрываем загрузочный терминал
    if (s.skipSplashScreen && !data.isFirstRun && typeof skipSplash === 'function') {
        skipSplash();
    }

    const setChk = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };

    setChk('set-autostart', data.isAutoStart);
    setChk('set-autostart-bypass', s.autoStartBypass);
    setChk('set-start-minimized', s.startMinimized);
    setChk('set-minimize-close', s.minimizeOnClose !== false);
    setChk('set-stop-on-exit', s.stopServicesOnExit !== false);
    setChk('set-notifications', s.notificationsEnabled !== false);
    setChk('set-always-on-top', s.alwaysOnTop);

    setChk('set-sound-effects', s.soundEffectsEnabled !== false);
    setChk('set-skip-splash', s.skipSplashScreen);
    setChk('set-compact-mode', s.compactMode);
    setChk('set-focus-mode', s.focusMode);
    setChk('set-hw-accel', s.hardwareAcceleration !== false);

    setChk('set-autorestart', s.autoRestartServices);
    setChk('set-watchdog-ping', s.watchdogPingAutoRestart);

    const pingInput = document.getElementById('set-ping-url');
    if (pingInput) pingInput.value = s.pingUrl || 'https://dynamodb.eu-central-1.amazonaws.com';

    const intTxt = document.getElementById('txt-selected-interval');
    if (intTxt) intTxt.innerText = INTERVAL_NAMES[appState.settings.statsUpdateInterval] || `${appState.settings.statsUpdateInterval} сек.`;

    const hostsTxt = document.getElementById('txt-selected-hosts');
    if (hostsTxt) hostsTxt.innerText = HOSTS_SOURCE_NAMES[appState.settings.hostsSourceIndex] || HOSTS_SOURCE_NAMES[2];

    const zapVer = document.getElementById('txt-core-zapret-ver');
    if (zapVer) zapVer.innerText = s.zapretCoreVersion && s.zapretCoreVersion !== '0.0.0' ? s.zapretCoreVersion : 'Установлен';

    const prxVer = document.getElementById('txt-core-proxy-ver');
    if (prxVer) prxVer.innerText = s.tgProxyCoreVersion && s.tgProxyCoreVersion !== '0.0.0' ? s.tgProxyCoreVersion : 'Установлен';

    if (data.routingStatus) {
        updateRoutingStatusUI(data.routingStatus);
    }
}

function updateRoutingStatusUI(rs) {
    if (!rs) return;
    appState.settings.ipSetMode = rs.ipMode || 'loaded';

    const ipBadge = document.getElementById('badge-ipset-status');
    if (ipBadge) {
        ipBadge.innerText = rs.ipStatusText || 'Неизвестно';
        ipBadge.className = rs.ipMode === 'loaded'
            ? 'px-2 py-0.5 rounded bg-[#0F240F] text-brand font-mono text-[10px] font-semibold'
            : 'px-2 py-0.5 rounded bg-[#222222] text-[#999999] font-mono text-[10px] font-semibold';
    }

    const ipSel = document.getElementById('txt-selected-ipset');
    if (ipSel) {
        ipSel.innerText = IPSET_MODE_NAMES[rs.ipMode] || 'По списку (Loaded)';
    }

    const hostsBadge = document.getElementById('badge-hosts-status');
    if (hostsBadge) {
        hostsBadge.innerText = rs.hostsStatusText || 'Не применен';
        hostsBadge.className = rs.hostsApplied
            ? 'px-2 py-0.5 rounded bg-[#0F240F] text-brand font-mono text-[10px] font-semibold'
            : 'px-2 py-0.5 rounded bg-[#222222] text-[#888888] font-mono text-[10px] font-semibold';
    }
}

function onSettingsChanged() {
    sendCmd('playClick');

    const compact = document.getElementById('set-compact-mode')?.checked ?? false;
    const focus = document.getElementById('set-focus-mode')?.checked ?? false;
    const watchdog = document.getElementById('set-watchdog-ping')?.checked ?? false;

    appState.settings.compactMode = compact;
    appState.settings.focusMode = focus;
    appState.settings.watchdogPingAutoRestart = watchdog;

    document.body.classList.toggle('compact-mode', compact);

    const payload = {
        autoStart: document.getElementById('set-autostart')?.checked ?? false,
        autoStartBypass: document.getElementById('set-autostart-bypass')?.checked ?? false,
        startMinimized: document.getElementById('set-start-minimized')?.checked ?? false,
        minimizeOnClose: document.getElementById('set-minimize-close')?.checked ?? true,
        stopServicesOnExit: document.getElementById('set-stop-on-exit')?.checked ?? true,
        notificationsEnabled: document.getElementById('set-notifications')?.checked ?? true,
        alwaysOnTop: document.getElementById('set-always-on-top')?.checked ?? false,

        accentTheme: appState.settings.accentTheme || 'green',
        soundEffectsEnabled: document.getElementById('set-sound-effects')?.checked ?? true,
        skipSplashScreen: document.getElementById('set-skip-splash')?.checked ?? false,
        compactMode: compact,
        focusMode: focus,
        hardwareAcceleration: document.getElementById('set-hw-accel')?.checked ?? true,

        pingUrl: document.getElementById('set-ping-url')?.value?.trim() || 'https://dynamodb.eu-central-1.amazonaws.com',
        statsUpdateInterval: appState.settings.statsUpdateInterval || 1,
        autoRestartServices: document.getElementById('set-autorestart')?.checked ?? false,
        watchdogPingAutoRestart: watchdog,
        hostsSourceIndex: appState.settings.hostsSourceIndex ?? 2
    };

    sendCmd('saveSettings', { settings: payload });
    showSettingsSavedToast();
}

function showSettingsSavedToast() {
    const toast = document.getElementById('settings-save-toast');
    if (!toast) return;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');

    if (saveToastTimeout) clearTimeout(saveToastTimeout);
    saveToastTimeout = setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 1600);
}

function setPingUrlPreset(url) {
    const input = document.getElementById('set-ping-url');
    if (input) {
        input.value = url;
        onSettingsChanged();
    }
}

function setSettingsCat(cat, btnEl) {
    sendCmd('playClick');
    currentSettingsCat = cat;

    document.querySelectorAll('.set-cat-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) {
        btnEl.classList.add('active');
        updateSettingsSlidingPill(btnEl);
    }

    filterSettingsView();
}

function updateSettingsSlidingPill(activeBtn) {
    const pill = document.getElementById('settings-seg-pill');
    const track = document.getElementById('settings-seg-track');
    if (!pill || !track || !activeBtn) return;

    const trackRect = track.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const offsetLeft = btnRect.left - trackRect.left + track.scrollLeft;

    pill.style.width = `${btnRect.width}px`;
    pill.style.transform = `translateX(${offsetLeft}px)`;
}

function filterSettingsView() {
    const query = (document.getElementById('settings-search-input')?.value || '').trim().toLowerCase();
    const groups = document.querySelectorAll('#tab-settings [data-set-group]');

    groups.forEach(group => {
        const groupCat = group.getAttribute('data-set-group');
        const catMatches = (currentSettingsCat === 'all' || currentSettingsCat === groupCat);

        if (!catMatches && !query) {
            group.classList.add('hidden');
            return;
        }

        const searchableRows = group.querySelectorAll('[data-search]');
        if (searchableRows.length === 0) {
            group.classList.toggle('hidden', !catMatches);
            return;
        }

        let visibleInGroup = 0;
        searchableRows.forEach(row => {
            const text = (row.getAttribute('data-search') + ' ' + row.innerText).toLowerCase();
            const match = !query || text.includes(query);
            row.classList.toggle('hidden', !match);
            if (match) visibleInGroup++;
        });

        group.classList.toggle('hidden', visibleInGroup === 0);
    });
}

function openIntervalSelector() {
    sendCmd('playClick');
    const options = [
        { value: 1, title: '1 секунда (Реальное время)', desc: 'Максимально плавный график скорости трафика' },
        { value: 2, title: '2 секунды', desc: 'Сбалансированная частота опроса сетевой карты' },
        { value: 5, title: '5 секунд', desc: 'Экономичный режим обновления статистики' },
        { value: 10, title: '10 секунд', desc: 'Редкое обновление для слабых ПК' }
    ];

    openSelectionModal('Телеметрия сети', 'Частота опроса трафика', options, appState.settings.statsUpdateInterval, val => {
        appState.settings.statsUpdateInterval = val;
        const txt = document.getElementById('txt-selected-interval');
        if (txt) txt.innerText = INTERVAL_NAMES[val] || `${val} сек.`;
        onSettingsChanged();
    });
}

function openIpSetSelector() {
    sendCmd('playClick');
    const options = [
        { value: 'loaded', title: 'По списку (Loaded • Рекомендуется)', desc: 'Обходить блокировки только для подсетей из базы ipset-all.txt' },
        { value: 'any', title: 'Весь трафик (Any • 0 IP)', desc: 'Применять правила ко всем IP-адресам без фильтрации по базе' },
        { value: 'none', title: 'Отключен (Заглушка)', desc: 'Временно отключить IPSet-маршрутизацию (подсеть-заглушка)' }
    ];

    openSelectionModal('Маршрутизация IPSet', 'Режим фильтрации подсетей', options, appState.settings.ipSetMode, val => {
        sendCmd('setIpSetMode', { mode: val });
    });
}

function openHostsSourceSelector() {
    sendCmd('playClick');
    const options = [
        { value: 0, title: HOSTS_SOURCE_NAMES[0], desc: 'Базовый список доменов Discord и голосовых серверов от Flowseal' },
        { value: 1, title: HOSTS_SOURCE_NAMES[1], desc: 'Домены ChatGPT, OpenAI, Claude, Gemini, Spotify и др. от V3nilla' },
        { value: 2, title: HOSTS_SOURCE_NAMES[2], desc: 'Объединенная база всех сервисов без блокировщика рекламы' },
        { value: 3, title: HOSTS_SOURCE_NAMES[3], desc: 'Полная база + блокировка рекламных трекеров через 0.0.0.0' }
    ];

    openSelectionModal('Системный файл Hosts', 'Выберите источник правил', options, appState.settings.hostsSourceIndex, val => {
        appState.settings.hostsSourceIndex = val;
        const txt = document.getElementById('txt-selected-hosts');
        if (txt) txt.innerText = HOSTS_SOURCE_NAMES[val];
        onSettingsChanged();
    });
}

function updateIpSetFromWeb() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-update-ipset');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="mdl-icon text-xs spin-anim">&#xE149;</span><span>Загрузка...</span>';
    }
    sendCmd('updateIpSet');
}

function updateSystemHosts() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-update-hosts');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="mdl-icon text-xs spin-anim">&#xE149;</span><span>Запись...</span>';
    }
    sendCmd('updateHosts', { sourceIndex: appState.settings.hostsSourceIndex });
}

function promptClearHosts() {
    sendCmd('playClick');
    showConfirm(
        'Очистка файла Hosts',
        'Удалить все записи Zapret из системного файла hosts?\n\nВаши собственные записи в файле hosts затронуты не будут.',
        'Очистить',
        () => sendCmd('clearHosts'),
        true
    );
}

function checkUpdatesManual() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-check-updates');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Проверка...';
    }
    sendCmd('checkUpdates');
}

function promptResetSettings() {
    sendCmd('playClick');
    showConfirm(
        'Сброс настроек',
        'Вы уверены, что хотите сбросить все настройки программы к значениям по умолчанию?',
        'Сбросить всё',
        () => sendCmd('resetSettings'),
        true
    );
}

// Цветовые грани для каждого 3D-камешка (основной тон, светлая грань, тень и свечение)
const GEM_PALETTES = {
    green:  { main: [16, 185, 129], light: [74, 222, 128], dark: [6, 78, 59],   glow: '#4CAF50' },
    blue:   { main: [37, 99, 235],  light: [96, 165, 250], dark: [30, 58, 138], glow: '#60A5FA' },
    purple: { main: [124, 58, 237], light: [192, 132, 252], dark: [76, 29, 149], glow: '#A78BFA' },
    amber:  { main: [217, 119, 6],  light: [251, 191, 36], dark: [120, 53, 15], glow: '#FBBF24' },
    cyan:   { main: [8, 145, 178],  light: [34, 211, 238], dark: [22, 78, 99],  glow: '#22D3EE' }
};

let gemAnimStarted = false;

function startGemSwatchesEngine() {
    if (gemAnimStarted) return;
    gemAnimStarted = true;

    // Строим геометрию граненого самоцвета (верхушка, 2 пояса граней со смещением и нижнее острие)
    const ringSides = 6;
    const baseVerts = [
        { x: 0, y: -13.5, z: 0 }, // 0: Верхняя вершина
        { x: 0, y:  13.5, z: 0 }  // 1: Нижнее острие
    ];

    // Верхняя корона (индексы 2..7) и нижний пояс (8..13)
    for (let i = 0; i < ringSides; i++) {
        const a = (i * Math.PI * 2) / ringSides;
        baseVerts.push({ x: Math.cos(a) * 9.5, y: -4.2, z: Math.sin(a) * 9.5 });
    }
    for (let i = 0; i < ringSides; i++) {
        const a = ((i + 0.5) * Math.PI * 2) / ringSides;
        baseVerts.push({ x: Math.cos(a) * 8.2, y: 4.5, z: Math.sin(a) * 8.2 });
    }

    const faces = [];
    for (let i = 0; i < ringSides; i++) {
        const next = (i + 1) % ringSides;
        const u0 = 2 + i, u1 = 2 + next;
        const l0 = 8 + i, l1 = 8 + next;

        faces.push([0, u1, u0]);  // Верхние треугольные грани короны
        faces.push([u0, u1, l0]); // Боковые грани пояса A
        faces.push([u1, l1, l0]); // Боковые грани пояса B
        faces.push([1, l0, l1]);  // Нижние грани павильона
    }

    let angle = 0;

    function renderGemsFrame() {
        angle += 0.028;
        const canvases = document.querySelectorAll('canvas.gem-canvas');

        canvases.forEach((canvas, idx) => {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const gemKey = canvas.getAttribute('data-gem') || 'green';
            const pal = GEM_PALETTES[gemKey] || GEM_PALETTES.green;
            const isSelected = canvas.parentElement?.classList.contains('active');
            const isHovered = canvas.parentElement?.matches(':hover');

            // Выбранный или наведенный камешек крутится быстрее и плавно левитирует
            const localYaw = angle * (isSelected ? 1.85 : isHovered ? 1.4 : 0.85) + idx * 0.9;
            const localPitch = 0.32 + Math.sin(angle * 1.5 + idx) * 0.14;
            const floatY = isSelected ? Math.sin(angle * 2.4) * 1.4 : 0;

            const cosY = Math.cos(localYaw), sinY = Math.sin(localYaw);
            const cosX = Math.cos(localPitch), sinX = Math.sin(localPitch);

            const tVerts = baseVerts.map(v => {
                const x1 = v.x * cosY - v.z * sinY;
                const z1 = v.x * sinY + v.z * cosY;
                const y2 = v.y * cosX - z1 * sinX;
                const z2 = v.y * sinX + z1 * cosX;

                const scale = 42 / (42 + z2);
                return {
                    x: w / 2 + x1 * scale,
                    y: h / 2 + y2 * scale + floatY,
                    z: z2,
                    rawX: x1, rawY: y2, rawZ: z2
                };
            });

            // Сортируем 2D-грани по глубине Z и отсекаем невидимые задние грани
            const drawList = [];
            for (const [i0, i1, i2] of faces) {
                const v0 = tVerts[i0], v1 = tVerts[i1], v2 = tVerts[i2];

                const crossZ = (v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x);
                if (crossZ <= 0) continue;

                // Вычисляем 3D-нормаль грани для реалистичного блика при повороте
                const ax = v1.rawX - v0.rawX, ay = v1.rawY - v0.rawY, az = v1.rawZ - v0.rawZ;
                const bx = v2.rawX - v0.rawX, by = v2.rawY - v0.rawY, bz = v2.rawZ - v0.rawZ;
                let nx = ay * bz - az * by;
                let ny = az * bx - ax * bz;
                let nz = ax * by - ay * bx;
                const len = Math.hypot(nx, ny, nz) || 1;
                nx /= len; ny /= len; nz /= len;

                const lightDot = Math.max(0, Math.min(1, (nx * -0.45 + ny * -0.55 + nz * -0.7 + 1) * 0.55));
                const avgZ = (v0.z + v1.z + v2.z) / 3;

                drawList.push({ v0, v1, v2, lightDot, avgZ });
            }

            drawList.sort((a, b) => b.avgZ - a.avgZ);

            // Мягкий ореол позади выбранного камешка
            if (isSelected) {
                const rad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 16);
                rad.addColorStop(0, pal.glow + '66');
                rad.addColorStop(1, pal.glow + '00');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 16, 0, Math.PI * 2);
                ctx.fill();
            }

            // Рендерим плоские 2D-грани с живым освещением
            for (const f of drawList) {
                const t = f.lightDot;
                let r, g, b;
                if (t > 0.62) {
                    const k = (t - 0.62) / 0.38;
                    r = Math.round(pal.light[0] + (255 - pal.light[0]) * k * 0.7);
                    g = Math.round(pal.light[1] + (255 - pal.light[1]) * k * 0.7);
                    b = Math.round(pal.light[2] + (255 - pal.light[2]) * k * 0.7);
                } else {
                    const k = t / 0.62;
                    r = Math.round(pal.dark[0] + (pal.main[0] - pal.dark[0]) * k);
                    g = Math.round(pal.dark[1] + (pal.main[1] - pal.dark[1]) * k);
                    b = Math.round(pal.dark[2] + (pal.main[2] - pal.dark[2]) * k);
                }

                ctx.beginPath();
                ctx.moveTo(f.v0.x, f.v0.y);
                ctx.lineTo(f.v1.x, f.v1.y);
                ctx.lineTo(f.v2.x, f.v2.y);
                ctx.closePath();

                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fill();

                ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 0.65;
                ctx.stroke();
            }
        });

        requestAnimationFrame(renderGemsFrame);
    }

    requestAnimationFrame(renderGemsFrame);
}

function applyAccentThemeToDom(theme) {
    // Автоматически мигрируем старый crimson на бирюзовый cyan
    const clean = (!theme || theme === 'crimson') ? (theme === 'crimson' ? 'cyan' : 'green') : theme;
    appState.settings.accentTheme = clean;

    document.body.setAttribute('data-accent', clean);
    document.querySelectorAll('[data-accent-btn]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-accent-btn') === clean);
    });

    const wizThemeLbl = document.getElementById('wiz-sum-theme');
    if (wizThemeLbl) {
        wizThemeLbl.innerText = ACCENT_THEME_NAMES[clean] || 'Изумруд';
    }

    startGemSwatchesEngine();

    if (typeof drawChart === 'function') {
        drawChart();
    }
}