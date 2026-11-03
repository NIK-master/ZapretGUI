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
    'green': 'Зеленая',
    'blue': 'Синяя',
    'purple': 'Аметист',
    'amber': 'Янтарь',
    'crimson': 'Малиновая'
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