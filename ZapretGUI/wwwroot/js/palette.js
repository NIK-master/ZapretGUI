// =========================================================================
// 1. УНИВЕРСАЛЬНЫЕ ДИАЛОГИ (ALERT, CONFIRM, SELECTION)
// =========================================================================
let confirmCallback = null;
let cancelConfirmCallback = null;
let isBackendConfirm = false;
let selectionCallback = null;

function showAlert(title, message, isError = false) {
    isBackendConfirm = false;
    confirmCallback = null;
    cancelConfirmCallback = null;

    document.getElementById('confirm-title').innerText = title || 'Уведомление';
    document.getElementById('confirm-title').className = `text-base font-bold mb-2 ${isError ? 'text-[#F44336]' : 'text-white'}`;
    document.getElementById('confirm-msg').innerText = message || '';
    document.getElementById('confirm-cancel-btn').classList.add('hidden');

    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = 'ОК';
    okBtn.className = 'px-4 py-1.5 rounded-md btn-brand text-xs font-semibold cursor-pointer';

    document.getElementById('confirm-modal').classList.add('open');
}

function showConfirm(title, message, confirmText = 'Да', onAccept = null, isDanger = false, onCancel = null) {
    confirmCallback = onAccept;
    cancelConfirmCallback = onCancel;

    document.getElementById('confirm-title').innerText = title || 'Подтверждение';
    document.getElementById('confirm-title').className = 'text-base font-bold text-white mb-2';
    document.getElementById('confirm-msg').innerText = message || '';
    document.getElementById('confirm-cancel-btn').classList.remove('hidden');

    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = confirmText;
    okBtn.className = isDanger
        ? 'px-4 py-1.5 rounded-md bg-[#D13438] hover:bg-[#B8282C] text-white text-xs font-semibold cursor-pointer transition'
        : 'px-4 py-1.5 rounded-md btn-brand text-xs font-semibold cursor-pointer';

    document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirmModal(accepted) {
    document.getElementById('confirm-modal').classList.remove('open');

    if (isBackendConfirm) {
        isBackendConfirm = false;
        sendCmd('confirmResponse', { accepted });
        return;
    }

    if (accepted && typeof confirmCallback === 'function') {
        const cb = confirmCallback;
        confirmCallback = null;
        cb();
    } else if (!accepted && typeof cancelConfirmCallback === 'function') {
        const ccb = cancelConfirmCallback;
        cancelConfirmCallback = null;
        ccb();
    }
}

function openSelectionModal(subTitle, title, options, currentVal, onSelect) {
    selectionCallback = onSelect;
    document.getElementById('sel-modal-sub').innerText = subTitle;
    document.getElementById('sel-modal-title').innerText = title;

    const list = document.getElementById('sel-modal-list');
    list.innerHTML = options.map((opt, idx) => {
        const isSel = String(opt.value) === String(currentVal);
        return `
            <div onclick="chooseSelectionOption(${idx})"
                 class="p-3 rounded-lg border cursor-pointer flex items-center justify-between transition ${isSel ? 'bg-[#0F240F] border-[#107C10]' : 'bg-[#181818] border-[#262626] hover:bg-[#222222]'}">
                <div class="pr-3">
                    <div class="text-xs font-bold ${isSel ? 'text-brand' : 'text-white'}">${opt.title}</div>
                    <div class="text-[11px] text-[#888888] mt-0.5">${opt.desc}</div>
                </div>
                <span class="text-sm font-bold ${isSel ? 'text-brand' : 'text-[#555555]'}">${isSel ? '✓' : '→'}</span>
            </div>
        `;
    }).join('');

    list._options = options;
    document.getElementById('selection-modal').classList.add('open');
}

function chooseSelectionOption(idx) {
    const list = document.getElementById('sel-modal-list');
    const opt = list._options?.[idx];
    document.getElementById('selection-modal').classList.remove('open');
    if (opt && typeof selectionCallback === 'function') {
        selectionCallback(opt.value);
    }
}

function closeSelectionModal() {
    document.getElementById('selection-modal').classList.remove('open');
}

// =========================================================================
// 2. ПАЛИТРА БЫСТРЫХ КОМАНД (CTRL + K)
// =========================================================================
let cmdSelectedIndex = 0;
let filteredCommands = [];

function getCommandPaletteItems() {
    const base = [
        { title: appState.isRunning ? 'Остановить обход блокировок' : 'Включить обход блокировок', cat: 'Управление', icon: '&#xE7E8;', run: () => onMainToggleClick() },
        { title: 'Перезапустить службы Zapret и Proxy', cat: 'Управление', icon: '&#xE777;', run: () => sendCmd('restartBypass') },
        { title: 'Авто-подбор лучшего конфига (Smart DPI Scan)', cat: 'Сканер', icon: '&#xE721;', run: () => { openConfigModal(); toggleSmartScan(); } },
        { title: 'Запустить полную диагностику сети', cat: 'Диагностика', icon: '&#xE9D9;', run: () => { switchTab('diag'); runDiagnostics(); } },
        { title: 'Настроить Игровой фильтр (Game Filter)', cat: 'Игры', icon: '&#xE7FC;', run: () => openGameFilterModal() },
        { title: 'Создать новую модификацию (.bat / список)', cat: 'Мастерская', icon: '&#xE710;', run: () => { switchTab('mods'); openCreateModModal(); } },
        { title: 'Выгрузить драйвер WinDivert (для античитов)', cat: 'Система', icon: '&#xEA18;', run: () => sendCmd('unloadWinDivert') },
        { title: 'Подключить прокси в Telegram Desktop (1 клик)', cat: 'Telegram', icon: '&#xE709;', run: () => sendCmd('connectTelegramProxy') },
        { title: 'Обновить системный файл Hosts', cat: 'Маршруты', icon: '&#xE8B7;', run: () => updateSystemHosts() },
        { title: 'Экспортировать резервную копию настроек', cat: 'Бэкап', icon: '&#xE78C;', run: () => sendCmd('exportConfigBackup') },
        { title: 'Перейти: Главная панель', cat: 'Навигация', icon: '&#xE80F;', run: () => switchTab('home') },
        { title: 'Перейти: Мастерская модификаций', cat: 'Навигация', icon: '&#xE74C;', run: () => switchTab('mods') },
        { title: 'Перейти: Настройки системы', cat: 'Навигация', icon: '&#xE713;', run: () => switchTab('settings') }
    ];

    appState.configs.forEach(c => {
        base.push({
            title: `Профиль: ${c.fileName}`,
            cat: 'Конфиг .bat',
            icon: '&#xE756;',
            run: () => selectProfile(c.fileName)
        });
    });

    return base;
}

function toggleCommandPaletteModal() {
    const modal = document.getElementById('cmd-palette-modal');
    if (modal && modal.classList.contains('open')) closeCommandPalette();
    else openCommandPalette();
}

function openCommandPalette() {
    const input = document.getElementById('cmd-palette-input');
    if (input) input.value = '';
    cmdSelectedIndex = 0;
    renderCommandPaletteList();
    document.getElementById('cmd-palette-modal').classList.add('open');
    setTimeout(() => input?.focus(), 40);
}

function closeCommandPalette() {
    document.getElementById('cmd-palette-modal').classList.remove('open');
}

function renderCommandPaletteList() {
    const q = (document.getElementById('cmd-palette-input')?.value || '').trim().toLowerCase();
    const all = getCommandPaletteItems();
    filteredCommands = all.filter(item => !q || item.title.toLowerCase().includes(q) || item.cat.toLowerCase().includes(q));
    cmdSelectedIndex = Math.max(0, Math.min(cmdSelectedIndex, filteredCommands.length - 1));

    const list = document.getElementById('cmd-palette-list');
    if (!list) return;

    if (filteredCommands.length === 0) {
        list.innerHTML = `<div class="p-4 text-center text-xs text-[#666666]">Ничего не найдено</div>`;
        return;
    }

    list.innerHTML = filteredCommands.map((item, idx) => {
        const active = idx === cmdSelectedIndex;
        return `
            <div onclick="executeCommandPaletteItem(${idx})"
                 onmouseenter="cmdSelectedIndex=${idx}; renderCommandPaletteList()"
                 class="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition ${active ? 'bg-[#0F240F] border border-[#107C10]' : 'border border-transparent hover:bg-[#1C1C1C]'}">
                <div class="flex items-center gap-2.5 overflow-hidden">
                    <span class="mdl-icon text-xs ${active ? 'text-brand' : 'text-[#888888]'}">${item.icon}</span>
                    <span class="text-xs font-medium text-white truncate">${item.title}</span>
                </div>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181818] text-[#888888] shrink-0">${item.cat}</span>
            </div>
        `;
    }).join('');
}

function onCommandPaletteKeyDown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredCommands.length > 0) {
            cmdSelectedIndex = (cmdSelectedIndex + 1) % filteredCommands.length;
            renderCommandPaletteList();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredCommands.length > 0) {
            cmdSelectedIndex = (cmdSelectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
            renderCommandPaletteList();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeCommandPaletteItem(cmdSelectedIndex);
    } else if (e.key === 'Escape') {
        closeCommandPalette();
    }
}

function executeCommandPaletteItem(idx) {
    const item = filteredCommands[idx];
    closeCommandPalette();
    if (item && typeof item.run === 'function') {
        item.run();
    }
}