// =========================================================================
// ЛОГИКА ВКЛАДКИ 4: НАСТРОЙКИ (BENTO GRID, ПРЕСЕТЫ И ФИЛЬТРЫ)
// =========================================================================
const INTERVAL_OPTIONS = [
    { title: "1 секунда", value: 1, desc: "Максимальная плавность графиков и мгновенный отклик монитора скорости" },
    { title: "3 секунды", value: 3, desc: "Сбалансированный режим опроса сетевого интерфейса" },
    { title: "5 секунд", value: 5, desc: "Экономичный режим с минимальной нагрузкой на систему" }
];

const IPSET_OPTIONS = [
    { title: "По списку (Loaded)", mode: "loaded", desc: "Использовать полную базу заблокированных подсетей из файла ipset-all.txt" },
    { title: "Отключен (None)", mode: "none", desc: "Подставить адрес-заглушку 203.0.113.113/32 и отключить фильтрацию по IP" },
    { title: "Весь трафик (Any)", mode: "any", desc: "Очистить ipset-all.txt, чтобы правила применялись ко всем IP-адресам" }
];

const HOSTS_OPTIONS = [
    { title: "Flowseal (Базовый)", idx: 0, desc: "Официальный список доменов из репозитория zapret-discord-youtube (Telegram, Discord и др.)" },
    { title: "V3nilla (ChatGPT, AI, Сервисы)", idx: 1, desc: "Разблокировка ChatGPT, OpenAI, Claude, Gemini, Spotify, Instagram, Notion и GitHub без рекламы" },
    { title: "Flowseal + V3nilla (Рекомендуется)", idx: 2, desc: "Объединяет оба списка без дубликатов для максимальной доступности всех сервисов" },
    { title: "V3nilla Full (+ AdBlock 0.0.0.0)", idx: 3, desc: "Полный файл V3nilla, включая тысячи правил блокировки рекламы и телеметрии (0.0.0.0)" }
];

let saveToastTimer = null;
let currentSettingsCat = 'all';

function showSettingsSavedToast() {
    const toast = document.getElementById('settings-save-toast');
    if (!toast) return;
    toast.style.opacity = '1';
    if (saveToastTimer) clearTimeout(saveToastTimer);
    saveToastTimer = setTimeout(() => {
        toast.style.opacity = '0';
    }, 1600);
}

function setSettingsCat(cat, btnEl) {
    sendCmd('playClick');
    currentSettingsCat = cat;

    document.querySelectorAll('.set-cat-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    filterSettingsView();
}

function filterSettingsView() {
    const query = (document.getElementById('settings-search-input')?.value || '').trim().toLowerCase();

    document.querySelectorAll('#tab-settings [data-set-group]').forEach(groupEl => {
        const groupName = groupEl.getAttribute('data-set-group');
        const catMatch = currentSettingsCat === 'all' || currentSettingsCat === groupName;

        if (!catMatch && !query) {
            groupEl.classList.add('hidden');
            return;
        }

        if (!query) {
            groupEl.classList.remove('hidden');
            groupEl.querySelectorAll('[data-search]').forEach(row => row.style.display = '');
            return;
        }

        // Если введен поисковый запрос — фильтруем отдельные строки
        let anyVisibleInGroup = false;
        const searchableRows = groupEl.querySelectorAll('[data-search]');

        if (searchableRows.length === 0) {
            const matchText = groupEl.innerText.toLowerCase().includes(query);
            groupEl.classList.toggle('hidden', !matchText);
            return;
        }

        searchableRows.forEach(row => {
            const hay = (row.getAttribute('data-search') + ' ' + row.innerText).toLowerCase();
            const matched = hay.includes(query);
            row.style.display = matched ? '' : 'none';
            if (matched) anyVisibleInGroup = true;
        });

        groupEl.classList.toggle('hidden', !anyVisibleInGroup);
    });
}

function setPingUrlPreset(url) {
    const input = document.getElementById('set-ping-url');
    if (!input) return;
    input.value = url;
    onSettingsChanged();
}

function initSettingsFromBackend(data) {
    document.getElementById('set-autostart').checked = data.isAutoStart;
    document.getElementById('set-start-minimized').checked = data.settings.startMinimized;
    document.getElementById('set-minimize-close').checked = data.settings.minimizeOnClose;
    document.getElementById('set-notifications').checked = data.settings.notificationsEnabled;
    document.getElementById('set-focus-mode').checked = data.settings.focusMode;
    document.getElementById('set-compact-mode').checked = data.settings.compactMode;
    document.getElementById('set-hw-accel').checked = data.settings.hardwareAcceleration;
    document.getElementById('set-colorblind').checked = data.settings.colorblindMode;
    document.getElementById('set-ping-url').value = data.settings.pingUrl || 'https://dynamodb.eu-central-1.amazonaws.com';
    document.getElementById('set-autorestart').checked = data.settings.autoRestartServices;

    // Отображение установленных версий ядер
    const zpVerEl = document.getElementById('txt-core-zapret-ver');
    const prVerEl = document.getElementById('txt-core-proxy-ver');
    if (zpVerEl) zpVerEl.innerText = (!data.settings.zapretCoreVersion || data.settings.zapretCoreVersion === '0.0.0') ? 'установлено' : data.settings.zapretCoreVersion;
    if (prVerEl) prVerEl.innerText = (!data.settings.tgProxyCoreVersion || data.settings.tgProxyCoreVersion === '0.0.0') ? 'установлено' : data.settings.tgProxyCoreVersion;

    appState.settings.focusMode = data.settings.focusMode;
    appState.settings.compactMode = data.settings.compactMode;
    appState.settings.colorblindMode = data.settings.colorblindMode;
    appState.settings.statsUpdateInterval = data.settings.statsUpdateInterval || 1;
    appState.settings.hostsSourceIndex = data.settings.hostsSourceIndex ?? 2;

    const intOpt = INTERVAL_OPTIONS.find(o => o.value === appState.settings.statsUpdateInterval) || INTERVAL_OPTIONS[0];
    document.getElementById('txt-selected-interval').innerText = intOpt.title;

    const hostOpt = HOSTS_OPTIONS[appState.settings.hostsSourceIndex] || HOSTS_OPTIONS[2];
    document.getElementById('txt-selected-hosts').innerText = hostOpt.title;

    if (data.routingStatus) updateRoutingStatusUI(data.routingStatus);

    applyVisualSettingsLive();
}

function onSettingsChanged() {
    sendCmd('playClick');

    appState.settings.focusMode = document.getElementById('set-focus-mode').checked;
    appState.settings.compactMode = document.getElementById('set-compact-mode').checked;
    appState.settings.colorblindMode = document.getElementById('set-colorblind').checked;

    applyVisualSettingsLive();
    showSettingsSavedToast();

    sendCmd('saveSettings', {
        settings: {
            autoStart: document.getElementById('set-autostart').checked,
            startMinimized: document.getElementById('set-start-minimized').checked,
            minimizeOnClose: document.getElementById('set-minimize-close').checked,
            notificationsEnabled: document.getElementById('set-notifications').checked,
            focusMode: appState.settings.focusMode,
            compactMode: appState.settings.compactMode,
            hardwareAcceleration: document.getElementById('set-hw-accel').checked,
            colorblindMode: appState.settings.colorblindMode,
            pingUrl: document.getElementById('set-ping-url').value,
            statsUpdateInterval: appState.settings.statsUpdateInterval,
            autoRestartServices: document.getElementById('set-autorestart').checked,
            hostsSourceIndex: appState.settings.hostsSourceIndex
        }
    });
}

function applyVisualSettingsLive() {
    const isCompact = !!appState.settings.compactMode;
    document.body.classList.toggle('colorblind-mode', !!appState.settings.colorblindMode);
    document.body.classList.toggle('compact-mode', isCompact);

    const statsPanel = document.getElementById('home-stats-panel');
    const logsPanel = document.getElementById('home-logs-panel');
    const btnCol = document.getElementById('home-btn-col');
    const cardsCol = document.getElementById('home-cards-col');

    statsPanel.classList.toggle('hidden', isCompact);
    logsPanel.classList.toggle('hidden', isCompact);
    btnCol.className = isCompact ? 'col-span-6 flex flex-col items-center justify-center' : 'col-span-4 flex flex-col items-center justify-center';
    cardsCol.className = isCompact ? 'col-span-6 flex flex-col gap-3' : 'col-span-4 flex flex-col gap-3';

    const guideGrid = document.getElementById('mods-guide-grid');
    if (guideGrid) {
        guideGrid.className = isCompact ? 'flex flex-col gap-2.5' : 'grid grid-cols-2 gap-3';
    }

    if (typeof renderModsView === 'function') {
        renderModsView();
    }
}

function updateRoutingStatusUI(rs) {
    appState.settings.ipSetMode = rs.ipMode || 'loaded';
    const ipBadge = document.getElementById('badge-ipset-status');
    ipBadge.innerText = rs.ipStatusText || 'Неизвестно';
    ipBadge.className = `px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${rs.ipMode === 'loaded' ? 'bg-[#0F240F] border border-[#107C10]/60 text-brand' : 'bg-[#222222] text-[#999999]'}`;

    const ipOpt = IPSET_OPTIONS.find(o => o.mode === appState.settings.ipSetMode) || IPSET_OPTIONS[0];
    document.getElementById('txt-selected-ipset').innerText = ipOpt.title;

    const hostsBadge = document.getElementById('badge-hosts-status');
    hostsBadge.innerText = rs.hostsStatusText || 'Не применен';
    hostsBadge.className = `px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${rs.hostsApplied ? 'bg-[#0F240F] border border-[#107C10]/60 text-brand' : 'bg-[#222222] text-[#888888]'}`;
}

function openSelectionModal(title, subTitle, items, onSelect) {
    sendCmd('playClick');
    selectionCallback = onSelect;
    document.getElementById('sel-modal-title').innerText = title;
    document.getElementById('sel-modal-sub').innerText = subTitle;

    document.getElementById('sel-modal-list').innerHTML = items.map((item, idx) => `
        <div onclick="chooseSelectionOption(${idx})"
             class="p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${item.selected ? 'bg-[#0F240F] border-[#107C10]' : 'bg-[#181818] border-[#262626] hover:bg-[#222222]'}">
            <div class="pr-3">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-semibold text-white">${item.title}</span>
                    ${item.selected ? '<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-[#107C10]/30 text-brand border border-[#107C10]/50 rounded">выбрано</span>' : ''}
                </div>
                <div class="text-xs text-[#999999] leading-relaxed">${item.desc}</div>
            </div>
            <span class="text-base font-bold ${item.selected ? 'text-brand' : 'text-[#555555]'}">${item.selected ? '✓' : '→'}</span>
        </div>
    `).join('');

    document.getElementById('selection-modal').classList.add('open');
}

function closeSelectionModal() {
    sendCmd('playClick');
    document.getElementById('selection-modal').classList.remove('open');
    selectionCallback = null;
}

function chooseSelectionOption(idx) {
    const cb = selectionCallback;
    closeSelectionModal();
    if (cb) cb(idx);
}

function openIntervalSelector() {
    const items = INTERVAL_OPTIONS.map(o => ({ ...o, selected: o.value === appState.settings.statsUpdateInterval }));
    openSelectionModal('Интервал обновления статистики', 'Сеть и диагностика', items, idx => {
        const chosen = INTERVAL_OPTIONS[idx];
        appState.settings.statsUpdateInterval = chosen.value;
        document.getElementById('txt-selected-interval').innerText = chosen.title;
        onSettingsChanged();
    });
}

function openIpSetSelector() {
    const items = IPSET_OPTIONS.map(o => ({ ...o, selected: o.mode === appState.settings.ipSetMode }));
    openSelectionModal('Режим фильтрации IPSet', 'База подсетей ipset-all.txt', items, idx => {
        const chosen = IPSET_OPTIONS[idx];
        sendCmd('setIpSetMode', { mode: chosen.mode });
        showSettingsSavedToast();
    });
}

function openHostsSourceSelector() {
    const items = HOSTS_OPTIONS.map(o => ({ ...o, selected: o.idx === appState.settings.hostsSourceIndex }));
    openSelectionModal('Источник списка Hosts', 'Системный файл C:\\Windows\\System32\\drivers\\etc\\hosts', items, idx => {
        const chosen = HOSTS_OPTIONS[idx];
        appState.settings.hostsSourceIndex = chosen.idx;
        document.getElementById('txt-selected-hosts').innerText = chosen.title;
        onSettingsChanged();
    });
}

function updateIpSetFromWeb() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-update-ipset');
    btn.innerText = 'Загрузка...';
    btn.disabled = true;
    sendCmd('updateIpSet');
}

function updateSystemHosts() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-update-hosts');
    btn.innerText = 'Загрузка...';
    btn.disabled = true;
    sendCmd('updateHosts', { sourceIndex: appState.settings.hostsSourceIndex });
}

function promptClearHosts() {
    sendCmd('playClick');
    showConfirm(
        'Очистка записей Zapret из Hosts',
        'Удалить все добавленные программой обходные записи из системного файла hosts?\nВаши собственные записи затронуты не будут.',
        'Очистить',
        () => sendCmd('clearHosts'),
        true
    );
}

function checkUpdatesManual() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-check-updates');
    btn.innerText = 'Проверка...';
    btn.disabled = true;
    sendCmd('checkUpdates');
}

function promptResetSettings() {
    sendCmd('playClick');
    showConfirm(
        'Сброс настроек',
        'Вы уверены, что хотите вернуть все настройки к состоянию по умолчанию? Это действие нельзя отменить.',
        'Сбросить',
        () => sendCmd('resetSettings'),
        true
    );
}