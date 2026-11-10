// =========================================================================
// ЛОГИКА ВКЛАДКИ 2: МОДИФИКАЦИИ (MODSVIEW + CODE STUDIO + STRATEGY LEGO)
// =========================================================================
let modsLayoutMode = 'grid'; // 'grid' (2 колонки) или 'list' (1 колонка)
let editorViewMode = 'code'; // 'code' или 'visual'

// Интерактивный словарь-переводчик флагов и переменных winws.exe
const WINWS_FLAG_DICT = {
    '--wf-tcp': {
        badge: 'Перехват WinDivert',
        desc: 'Указывает драйверу ядра WinDivert, какие TCP-порты нужно перехватывать для модификации трафика (обычно 80, 443 и игровые порты).'
    },
    '--wf-udp': {
        badge: 'Перехват WinDivert',
        desc: 'Указывает драйверу WinDivert, какие UDP-порты перехватывать (443 для YouTube QUIC, 50000–50100 для голосовых чатов Discord).'
    },
    '--filter-tcp': {
        badge: 'Фильтр профиля',
        desc: 'Применяет текущую стратегию обхода только к указанным TCP-портам внутри данного блока (до следующего флага --new).'
    },
    '--filter-udp': {
        badge: 'Фильтр профиля',
        desc: 'Применяет текущую стратегию обхода только к указанным UDP-портам (например, 443 для протокола QUIC или диапозон портов звонков).'
    },
    '--hostlist': {
        badge: 'Белый список',
        desc: 'Путь к текстовому файлу со списком доменов (например, list-general.txt). Стратегия сработает ТОЛЬКО для сайтов из этого файла.'
    },
    '--hostlist-exclude': {
        badge: 'Исключения доменов',
        desc: 'Список доменов, которые нужно принудительно исключить из обработки обхода (чтобы не ломать российские сайты и банки).'
    },
    '--ipset': {
        badge: 'База IP-подсетей',
        desc: 'Путь к файлу со списком IP-адресов и подсетей (ipset-all.txt). Применяет обход на уровне IP, даже если домен не виден.'
    },
    '--ipset-exclude': {
        badge: 'Исключения IP',
        desc: 'Список IP-адресов и подсетей, трафик к которым не должен модифицироваться.'
    },
    '--dpi-desync': {
        badge: 'Ядро DPI-обхода',
        desc: 'Главный метод обмана ТСПУ: "fake" отправляет ложный пакет перед настоящим, "split2" режет пакет на части, "disorder2" меняет порядок сегментов, "multisplit" шинкует пакет на множество мелких кусков.'
    },
    '--dpi-desync-fooling': {
        badge: 'Маскировка фейка',
        desc: 'Способ сделать так, чтобы ТСПУ провайдера проверил фейковый пакет, а сам целевой сервер (YouTube/Discord) его проигнорировал. Популярные методы: "md5sig" (TCP MD5 опция), "badseq" (сдвиг Sequence) и "badsum".'
    },
    '--dpi-desync-repeats': {
        badge: 'Повторы отправки',
        desc: 'Сколько раз подряд продублировать отправку фейкового пакета (обычно от 4 до 11). Повышает шанс пробития агрессивного ТСПУ на UDP/QUIC.'
    },
    '--dpi-desync-autottl': {
        badge: 'Авто-TTL',
        desc: 'Автоматически вычисляет количество узлов (хопов) до сервера и ставит такой TTL, чтобы фейк дошел до ТСПУ провайдера, но сгорел по пути к сайту.'
    },
    '--dpi-desync-ttl': {
        badge: 'Жесткий TTL',
        desc: 'Фиксированное время жизни (Time-To-Live) для фейковых пакетов. Если число слишком маленькое — фейк не долетит до DPI, если большое — долетит до сервера и вызовет ошибку.'
    },
    '--dpi-desync-fake-tls': {
        badge: 'Payload TLS',
        desc: 'Бинарный файл (.bin) с поддельным заголовком TLS ClientHello, который отправляется провайдеру в качестве приманки.'
    },
    '--dpi-desync-fake-quic': {
        badge: 'Payload QUIC',
        desc: 'Бинарный файл (.bin) с поддельным заголовком QUIC Initial для пробития замедления видеопотока YouTube по протоколу UDP.'
    },
    '--dpi-desync-fake-unknown-udp': {
        badge: 'Payload UDP',
        desc: 'Поддельный пакет для обхода блокировки нестандартных UDP-протоколов (звонки в Discord, голосовые чаты в играх).'
    },
    '--dpi-desync-cutoff': {
        badge: 'Лимит пакетов',
        desc: 'Ограничивает работу десинхронизации только первыми N пакетами соединения (например, d3 или n2), чтобы не нагружать процессор после установки связи.'
    },
    '--dpi-desync-split-pos': {
        badge: 'Точка разреза',
        desc: 'Задает точную позицию байта (или метку sniext / midsld), в которой пакет будет разрезан на части.'
    },
    '--dpi-desync-split-seqovl': {
        badge: 'Перекрытие Sequence',
        desc: 'Специальная техника наложения TCP-сегментов друг на друга (Sequence Overlap), которую ТСПУ и целевой сервер собирают по-разному.'
    },
    '--dpi-desync-any-protocol': {
        badge: 'Все протоколы',
        desc: 'Применяет десинхронизацию ко всем пакетам на порту, даже если winws не распознал в них TLS, HTTP или QUIC.'
    },
    '--new': {
        badge: 'Разделитель стратегий',
        desc: 'Завершает настройку текущего правила и начинает новый независимый профиль фильтрации для других портов или списков внутри одного процесса winws.exe.'
    },
    '%bin%': {
        badge: 'Системная переменная',
        desc: 'Автоматически заменяется на путь к папке ZapretFiles\\bin\\, где лежат исполняемый файл winws.exe и бинарные фейки (.bin).'
    },
    '%lists%': {
        badge: 'Системная переменная',
        desc: 'Автоматически заменяется на путь к папке ZapretFiles\\lists\\, где хранятся списки доменов и подсетей.'
    },
    '%gamefilter%': {
        badge: 'Игровой фильтр',
        desc: 'Динамическая переменная: подставляет выбранный в настройках диапазон игровых портов (например, 1024-65535) или порт-заглушку 12, если фильтр выключен.'
    },
    '%gamefiltertcp%': {
        badge: 'Игровой фильтр TCP',
        desc: 'Подставляет диапазон TCP-портов из настроек Игрового фильтра.'
    },
    '%gamefilterudp%': {
        badge: 'Игровой фильтр UDP',
        desc: 'Подставляет диапазон UDP-портов из настроек Игрового фильтра.'
    }
};

function setModsLayout(mode) {
    sendCmd('playClick');
    modsLayoutMode = mode;

    const btnGrid = document.getElementById('btn-layout-grid');
    const btnList = document.getElementById('btn-layout-list');

    if (btnGrid && btnList) {
        btnGrid.className = mode === 'grid'
            ? 'w-7 h-6 rounded flex items-center justify-center bg-[#262626] text-white transition cursor-pointer'
            : 'w-7 h-6 rounded flex items-center justify-center text-[#666666] hover:text-white transition cursor-pointer';

        btnList.className = mode === 'list'
            ? 'w-7 h-6 rounded flex items-center justify-center bg-[#262626] text-white transition cursor-pointer'
            : 'w-7 h-6 rounded flex items-center justify-center text-[#666666] hover:text-white transition cursor-pointer';
    }

    renderModsView();
}

function switchModsSubTab(subTab) {
    sendCmd('playClick');
    appState.modsSubTab = subTab;

    ['bat', 'list', 'guide'].forEach(t => {
        const btn = document.getElementById('mod-tab-' + t);
        if (btn) btn.classList.toggle('active', t === subTab);
    });

    const desc = document.getElementById('mods-cat-desc');
    const actions = document.getElementById('mods-action-bar');
    const filterControls = document.getElementById('mods-filter-controls');
    const listsContainer = document.getElementById('mods-lists-container');
    const guideContainer = document.getElementById('mods-guide-container');

    if (subTab === 'guide') {
        desc.innerText = 'Подробная документация по созданию собственных стратегий и списков доменов.';
        actions.classList.add('hidden');
        filterControls.classList.add('hidden');
        listsContainer.classList.add('hidden');
        guideContainer.classList.remove('hidden');
    } else {
        actions.classList.remove('hidden');
        filterControls.classList.remove('hidden');
        listsContainer.classList.remove('hidden');
        guideContainer.classList.add('hidden');

        if (subTab === 'bat') {
            desc.innerText = 'Пользовательские скрипты обхода (.bat) для специфичных игр, провайдеров и нестандартных блокировок.';
        } else {
            desc.innerText = 'Дополнительные списки доменов (list.txt), которые автоматически объединяются с основным списком обхода.';
        }
        renderModsView();
    }
    if (typeof updateModsSlidingPill === 'function') {
        requestAnimationFrame(() => updateModsSlidingPill());
    }
}

function updateModsCounters() {
    const batTotal = appState.batMods.length;
    const batActive = appState.batMods.filter(m => m.isActive).length;
    const listTotal = appState.listMods.length;
    const listActive = appState.listMods.filter(m => m.isActive).length;

    const badgeBat = document.getElementById('badge-count-bat');
    const badgeList = document.getElementById('badge-count-list');
    const summary = document.getElementById('mods-active-summary');

    if (badgeBat) badgeBat.innerText = batTotal;
    if (badgeList) badgeList.innerText = listTotal;

    const totalActive = batActive + listActive;
    if (summary) {
        summary.innerText = `Активно: ${totalActive} из ${batTotal + listTotal}`;
        summary.className = totalActive > 0
            ? 'px-2.5 py-0.5 rounded-full bg-[#0F240F] border border-[#107C10] font-mono text-[11px] text-brand font-semibold'
            : 'px-2.5 py-0.5 rounded-full bg-[#181818] border border-[#2A2A2A] font-mono text-[11px] text-[#888888]';
    }
}

function renderModsView() {
    updateModsCounters();
    if (appState.modsSubTab === 'guide') return;

    const isBat = appState.modsSubTab === 'bat';
    const rawSource = isBat ? appState.batMods : appState.listMods;
    const query = (document.getElementById('mods-search-input')?.value || '').trim().toLowerCase();

    const source = rawSource.filter(m => {
        if (!query) return true;
        const name = (m.meta?.name || '').toLowerCase();
        const author = (m.meta?.author || '').toLowerCase();
        const desc = (m.meta?.description || '').toLowerCase();
        const id = (m.id || '').toLowerCase();
        return name.includes(query) || author.includes(query) || desc.includes(query) || id.includes(query);
    });

    const activeMods = source.filter(m => m.isActive);
    const availableMods = source.filter(m => !m.isActive);

    const useGrid = modsLayoutMode === 'grid' && !appState.settings.compactMode;
    const gridClass = useGrid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2.5';
    const activeListEl = document.getElementById('active-mods-list');
    const availListEl = document.getElementById('available-mods-list');
    activeListEl.className = gridClass;
    availListEl.className = gridClass;

    document.getElementById('active-mods-section').classList.toggle('hidden', activeMods.length === 0);
    document.getElementById('available-mods-section').classList.toggle('hidden', availableMods.length === 0);
    document.getElementById('mods-divider').classList.toggle('hidden', !(activeMods.length > 0 && availableMods.length > 0));

    const emptyState = document.getElementById('mods-empty-state');
    const emptyTitle = document.getElementById('mods-empty-title');
    const emptySub = document.getElementById('mods-empty-sub');

    if (source.length === 0) {
        emptyState.classList.remove('hidden');
        if (query && rawSource.length > 0) {
            emptyTitle.innerText = `По запросу «${query}» ничего не найдено`;
            emptySub.innerText = 'Попробуйте изменить поисковый запрос или очистить поле фильтра.';
        } else {
            emptyTitle.innerText = isBat
                ? 'У вас пока нет пользовательских .bat стратегий'
                : 'У вас пока нет дополнительных списков доменов';
            emptySub.innerText = 'Создайте собственную модификацию в встроенном редакторе кода или импортируйте готовый архив (.zip / .netfix-mod).';
        }
    } else {
        emptyState.classList.add('hidden');
    }

    activeListEl.innerHTML = activeMods.map((m, idx) => buildModCardHtml(m, isBat, idx)).join('');
    availListEl.innerHTML = availableMods.map((m, idx) => buildModCardHtml(m, isBat, idx + activeMods.length)).join('');
}

function escapeStr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function buildModCardHtml(mod, isBat, index = 0) {
    const safeName = escapeStr(mod.meta.name);
    const delayMs = Math.min(index * 40, 240);
    const typeGlyph = isBat ? '&#xE756;' : '&#xE774;';
    const fileBadge = isBat ? `mod_${mod.id}.bat` : `${mod.id}/list.txt`;
    const isCurrentSelectedProf = isBat && mod.isActive && (appState.selectedProfile || '').toLowerCase() === fileBadge.toLowerCase();
    const statusText = mod.isActive ? (isCurrentSelectedProf ? 'Выбран ★' : 'Активен') : 'Отключен';
    const statusCls = mod.isActive ? 'text-brand font-semibold' : 'text-[#777777]';
    const iconBoxCls = mod.isActive
        ? 'bg-[#107C10]/20 border-[#107C10] text-brand'
        : 'bg-[#202020] border-[#2E2E2E] text-[#888888]';

    const selectProfileBtn = isBat && mod.isActive
        ? `<button onclick="selectProfile('${fileBadge}')" class="mod-action-pill ${isCurrentSelectedProf ? '!border-[#107C10] !text-brand' : ''}" title="Сделать текущим профилем запуска Zapret">
               <span class="mdl-icon text-[11px]">${isCurrentSelectedProf ? '&#xE73E;' : '&#xE768;'}</span>
               <span>${isCurrentSelectedProf ? 'Выбран' : 'Выбрать'}</span>
           </button>`
        : '';

    return `
    <div style="animation-delay: ${delayMs}ms" class="mod-workshop-card ${mod.isActive ? 'is-active' : ''} flex flex-col justify-between gap-3">
        <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl border ${iconBoxCls} flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                    <span class="mdl-icon text-base">${typeGlyph}</span>
                </div>
                <div class="overflow-hidden">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-[15px] text-white truncate">${mod.meta.name}</span>
                        <span class="px-1.5 py-0.5 rounded bg-[#222222] border border-[#333333] text-[#AAAAAA] font-mono text-[10px]">v${mod.meta.version || '1.0'}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#777777] min-w-0 w-full">
                        <span class="shrink-0 max-w-[50%] truncate" title="${fileBadge}">${fileBadge}</span>
                        <span class="shrink-0">•</span>
                        <span class="text-[#999999] truncate flex-1 min-w-0" title="Автор: ${mod.meta.author || 'Аноним'}">Автор: ${mod.meta.author || 'Аноним'}</span>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] ${statusCls}">${statusText}</span>
                <input type="checkbox" ${mod.isActive ? 'checked' : ''} onchange="toggleMod('${mod.id}', ${isBat}, '${safeName}')" class="cyber-toggle" title="Включить / отключить мод">
            </div>
        </div>

        <div class="text-xs text-[#A8A8A8] leading-relaxed line-clamp-2 min-h-[32px]">
            ${mod.meta.description || 'Описание не указано.'}
        </div>

        <div class="flex items-center justify-between pt-2.5 border-t border-[#242424]">
            <span class="text-[10px] font-mono text-[#555555]">ID: ${mod.id}</span>

            <div class="flex items-center gap-1.5">
                ${selectProfileBtn}
                <button onclick="openModEditor('${mod.id}', ${isBat})" class="mod-action-pill" title="Открыть в Code Studio">
                    <span class="mdl-icon text-[11px]">&#xE70F;</span>
                    <span>Код</span>
                </button>
                <button onclick="exportMod('${mod.id}', ${isBat}, '${safeName}')" class="mod-action-pill" title="Упаковать мод в .zip архив">
                    <span class="mdl-icon text-[11px]">&#xE78C;</span>
                    <span>Экспорт</span>
                </button>
                <button onclick="promptDeleteMod('${mod.id}', ${isBat}, '${safeName}')" class="mod-action-pill danger" title="Удалить мод с диска">
                    <span class="mdl-icon text-[11px]">&#xE74D;</span>
                </button>
            </div>
        </div>
    </div>`;
}

function toggleMod(id, isBat, name) {
    sendCmd('playClick');
    sendCmd('toggleMod', { id, isBat, name });
}

function promptDisableAllMods() {
    sendCmd('playClick');
    const isBat = appState.modsSubTab === 'bat';
    const activeCount = (isBat ? appState.batMods : appState.listMods).filter(m => m.isActive).length;
    if (activeCount === 0) return;

    showConfirm(
        'Отключить всё',
        'Вы уверены, что хотите отключить все активные моды в этой категории?',
        'Отключить',
        () => sendCmd('disableAllMods', { isBat }),
        true
    );
}

function promptDeleteMod(id, isBat, name) {
    sendCmd('playClick');
    showConfirm(
        'Удаление мода',
        `Удалить мод «${name}» навсегда?\nЭто удалит папку мода и все его файлы с диска.`,
        'Удалить',
        () => sendCmd('deleteMod', { id, isBat, name }),
        true
    );
}

function exportMod(id, isBat, name) {
    sendCmd('playClick');
    sendCmd('exportMod', { id, isBat, name });
}

function openCreateModModal() {
    sendCmd('playClick');
    if (appState.modsSubTab === 'guide') {
        switchModsSubTab('bat');
    }
    document.getElementById('new-mod-name').value = 'Мой новый мод';
    document.getElementById('new-mod-author').value = 'You';
    document.getElementById('new-mod-desc').value = 'Пользовательская модификация обхода';
    sendCmd('generateModId', { baseName: 'custom_mod' });
    document.getElementById('create-mod-modal').classList.add('open');
}

function closeCreateModModal() {
    sendCmd('playClick');
    document.getElementById('create-mod-modal').classList.remove('open');
}

function regenerateModId() {
    sendCmd('playClick');
    const name = document.getElementById('new-mod-name').value || 'mod';
    sendCmd('generateModId', { baseName: name });
}

function onNewModNameInput() {
    const name = document.getElementById('new-mod-name').value || 'mod';
    sendCmd('generateModId', { baseName: name });
}

function onNewModIdInput() {
    const id = document.getElementById('new-mod-id').value;
    sendCmd('checkModId', { id });
}

function updateModIdValidationUI(cleanId, isTaken, isEmpty) {
    const status = document.getElementById('new-mod-id-status');
    const btn = document.getElementById('btn-confirm-create-mod');
    if (isEmpty) {
        status.innerText = '⚠ Введите корректный ID (a-z, 0-9)';
        status.className = 'text-[11px] font-mono text-[#FF8C00]';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else if (isTaken) {
        status.innerText = '❌ Такой ID уже занят!';
        status.className = 'text-[11px] font-mono text-[#F44336]';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else {
        status.innerText = `✓ ID «${cleanId}» уникален`;
        status.className = 'text-[11px] font-mono text-brand';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function confirmCreateMod() {
    sendCmd('playClick');
    sendCmd('createMod', {
        isBat: appState.modsSubTab !== 'list',
        id: document.getElementById('new-mod-id').value,
        name: document.getElementById('new-mod-name').value,
        author: document.getElementById('new-mod-author').value,
        description: document.getElementById('new-mod-desc').value
    });
}

function openModEditor(id, isBat) {
    sendCmd('playClick');
    sendCmd('getModContent', { id, isBat });
}

function escapeSyntaxHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function highlightSingleBatLine(rawLine) {
    const trimmed = rawLine.trimStart();
    if (trimmed.startsWith('::') || /^rem(\s|$)/i.test(trimmed)) {
        return `<span class="syn-comment">${escapeSyntaxHtml(rawLine)}</span>`;
    }

    const tokenRegex = /("(?:[^"\\]|\\.)*"|%[a-zA-Z0-9_~]+%|--new\b|--[a-zA-Z0-9-]+|-[a-zA-Z0-9-]+|\bwinws(?:\.exe)?\b|\^(?=\s*$)|\b(?:@?echo|chcp|cd|pushd|popd|set|title|cls|color|mode|goto|call|if|for|pause|timeout)\b|\b\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*\b)/gi;

    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(rawLine)) !== null) {
        if (match.index > lastIndex) {
            result += escapeSyntaxHtml(rawLine.slice(lastIndex, match.index));
        }
        const token = match[0];
        const lower = token.toLowerCase();
        let cls = '';

        if (token.startsWith('"')) {
            const inner = escapeSyntaxHtml(token).replace(/(%[a-zA-Z0-9_~]+%)/g, '<span class="syn-var" data-token="$1">$1</span>');
            result += `<span class="syn-string">${inner}</span>`;
            lastIndex = tokenRegex.lastIndex;
            continue;
        } else if (token.startsWith('%')) {
            cls = 'syn-var';
        } else if (lower === '--new') {
            cls = 'syn-new';
        } else if (token.startsWith('-')) {
            cls = 'syn-flag';
        } else if (lower.startsWith('winws')) {
            cls = 'syn-exe';
        } else if (token === '^') {
            cls = 'syn-caret';
        } else if (/^\d/.test(token)) {
            cls = 'syn-num';
        } else {
            cls = 'syn-cmd';
        }

        result += `<span class="${cls}" data-token="${escapeSyntaxHtml(lower)}">${escapeSyntaxHtml(token)}</span>`;
        lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < rawLine.length) {
        result += escapeSyntaxHtml(rawLine.slice(lastIndex));
    }
    return result;
}

function highlightSingleListLine(rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed) return escapeSyntaxHtml(rawLine);
    if (trimmed.startsWith('#')) {
        return `<span class="syn-comment">${escapeSyntaxHtml(rawLine)}</span>`;
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('/')) {
        if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(trimmed)) {
            return `<span class="syn-ip">${escapeSyntaxHtml(rawLine)}</span>`;
        }
        return `<span class="syn-warn" title="Нажмите «Очистить дубли и URL», чтобы оставить чистый домен">${escapeSyntaxHtml(rawLine)}</span>`;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
        return `<span class="syn-ip">${escapeSyntaxHtml(rawLine)}</span>`;
    }
    return `<span class="syn-domain">${escapeSyntaxHtml(rawLine)}</span>`;
}

function updateEditorSyntaxHighlight() {
    const ta = document.getElementById('editor-textarea');
    const hl = document.getElementById('editor-highlight-layer');
    if (!ta || !hl) return;

    const text = ta.value || '';
    const lines = text.split('\n');
    const isBat = appState.editingMod.isBat;

    const htmlLines = lines.map(line => isBat ? highlightSingleBatLine(line) : highlightSingleListLine(line));
    hl.innerHTML = htmlLines.join('\n') + '\n ';
}

// =========================================================================
// ЖИВОЙ ПЕРЕВОДЧИК ФЛАГОВ WINWS ПО НАВЕДЕНИЮ МЫШИ В CODE STUDIO
// =========================================================================
function onEditorMouseMove(e) {
    const modal = document.getElementById('editor-modal');
    if (!appState.editingMod.isBat || !modal || !modal.classList.contains('open')) {
        hideWinwsFlagTooltip();
        return;
    }

    const hl = document.getElementById('editor-highlight-layer');
    const wrap = document.getElementById('editor-canvas-wrap');
    const ta = document.getElementById('editor-textarea');
    if (!hl || !wrap || !ta) return;

    ta.style.pointerEvents = 'none';
    const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
    ta.style.pointerEvents = '';

    if (elemUnder && elemUnder.hasAttribute('data-token')) {
        const rawToken = (elemUnder.getAttribute('data-token') || '').toLowerCase();
        const info = WINWS_FLAG_DICT[rawToken];
        if (info) {
            const wrapRect = wrap.getBoundingClientRect();
            const spanRect = elemUnder.getBoundingClientRect();
            showWinwsFlagTooltip(rawToken, info, spanRect.left - wrapRect.left, spanRect.top - wrapRect.top);
            return;
        }
    }

    hideWinwsFlagTooltip();
}

function showWinwsFlagTooltip(tokenName, info, relX, relY) {
    const tip = document.getElementById('winws-flag-tooltip');
    const wrap = document.getElementById('editor-canvas-wrap');
    if (!tip || !wrap) return;

    document.getElementById('wft-flag-name').innerText = tokenName;
    document.getElementById('wft-flag-badge').innerText = info.badge;
    document.getElementById('wft-flag-desc').innerText = info.desc;

    tip.classList.remove('hidden');

    const wrapW = wrap.clientWidth;
    const tipW = tip.offsetWidth || 340;
    const tipH = tip.offsetHeight || 85;

    const left = Math.max(10, Math.min(relX, wrapW - tipW - 12));
    const top = relY > tipH + 16 ? (relY - tipH - 8) : (relY + 24);

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
}

function hideWinwsFlagTooltip() {
    document.getElementById('winws-flag-tooltip')?.classList.add('hidden');
}

// =========================================================================
// ВИЗУАЛЬНЫЙ КОНСТРУКТОР СТРАТЕГИЙ («STRATEGY LEGO»)
// =========================================================================
function switchEditorViewMode(mode) {
    editorViewMode = mode;
    const codeContainer = document.getElementById('editor-code-view-container');
    const visualContainer = document.getElementById('editor-visual-builder');
    const btnCode = document.getElementById('btn-ed-mode-code');
    const btnVis = document.getElementById('btn-ed-mode-visual');

    if (mode === 'visual' && appState.editingMod.isBat) {
        codeContainer?.classList.add('hidden');
        visualContainer?.classList.remove('hidden');
        visualContainer?.classList.add('flex');
        if (btnCode) btnCode.className = 'px-3 py-1 rounded-md text-[#888888] hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5';
        if (btnVis) btnVis.className = 'px-3 py-1 rounded-md bg-[#26262A] text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5';
        updateLegoPreview();
        requestAnimationFrame(() => {
            if (typeof initPacketSim3D === 'function') initPacketSim3D();
            if (typeof updatePacketSimConfig === 'function') updatePacketSimConfig();
        });
    } else {
        visualContainer?.classList.add('hidden');
        visualContainer?.classList.remove('flex');
        codeContainer?.classList.remove('hidden');
        if (btnCode) btnCode.className = 'px-3 py-1 rounded-md bg-[#26262A] text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5';
        if (btnVis) btnVis.className = 'px-3 py-1 rounded-md text-[#888888] hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5';
    }
}

function updateLegoPreview() {
    const tcpDesync = document.getElementById('lego-tcp-desync')?.value || 'fake,split2';
    const fooling = document.getElementById('lego-fooling')?.value || 'md5sig';
    const quicEnabled = document.getElementById('lego-quic-enabled')?.checked ?? true;
    const repeats = document.getElementById('lego-repeats')?.value || '6';
    const discordUdp = document.getElementById('lego-discord-udp')?.checked ?? true;
    const useGf = document.getElementById('lego-game-filter')?.checked ?? true;

    const wfTcp = useGf ? '80,443,%GameFilterTCP%' : '80,443';
    let wfUdpParts = ['443'];
    if (discordUdp) wfUdpParts.push('50000-50100');
    if (useGf) wfUdpParts.push('%GameFilterUDP%');
    const wfUdp = wfUdpParts.join(',');

    const blocks = [];

    if (quicEnabled) {
        blocks.push(`--filter-udp=443 --hostlist="%LISTS%list-general.txt" --dpi-desync=fake --dpi-desync-repeats=${repeats}`);
    }

    if (discordUdp) {
        const udpPorts = useGf ? '50000-50100,%GameFilterUDP%' : '50000-50100';
        blocks.push(`--filter-udp=${udpPorts} --dpi-desync=fake --dpi-desync-any-protocol --dpi-desync-cutoff=d3 --dpi-desync-repeats=${repeats}`);
    }

    const foolPart = fooling === 'none'
        ? '--dpi-desync-autottl=2'
        : `--dpi-desync-fooling=${fooling}`;

    const tcpPorts = useGf ? '80,443,%GameFilterTCP%' : '80,443';
    blocks.push(`--filter-tcp=${tcpPorts} --hostlist="%LISTS%list-general.txt" --dpi-desync=${tcpDesync} --dpi-desync-repeats=${repeats} ${foolPart}`);

    const header = `:: Сгенерировано в Визуальном конструкторе Zapret for ADHD\r\n"%BIN%winws.exe" --wf-tcp=${wfTcp} --wf-udp=${wfUdp} ^\r\n`;
    const body = blocks.join(' ^\r\n--new ^\r\n');

    const previewEl = document.getElementById('lego-code-preview');
    if (previewEl) previewEl.textContent = header + body;
    if (typeof updatePacketSimConfig === 'function') updatePacketSimConfig();
}

function applyLegoToCodeEditor() {
    updateLegoPreview();
    const code = document.getElementById('lego-code-preview')?.textContent || '';
    if (!code) return;

    const ta = document.getElementById('editor-textarea');
    ta.value = code;
    onEditorTextInput();
    switchEditorViewMode('code');
    setEditorStatus('✓ Схема из конструктора перенесена в код!', 'text-brand');
}

function openEditorWithData(data) {
    appState.editingMod.id = data.id;
    appState.editingMod.isBat = data.isBat;

    document.getElementById('editor-title').innerText = `Редактор: ${data.meta.name}`;
    document.getElementById('editor-subtitle').innerText = `ID: ${data.id} • Файл: ${data.fileName}`;

    document.getElementById('edit-mod-name').value = data.meta.name || '';
    document.getElementById('edit-mod-author').value = data.meta.author || '';
    document.getElementById('edit-mod-version').value = data.meta.version || '1.0';
    document.getElementById('edit-mod-desc').value = data.meta.description || '';

    document.getElementById('editor-mode-tabs')?.classList.toggle('hidden', !data.isBat);
    document.getElementById('editor-bat-tools').className = data.isBat ? 'flex items-center gap-1' : 'hidden';
    document.getElementById('editor-snippets-bar').className = data.isBat ? 'flex items-center gap-1 overflow-x-auto pb-1 mb-1.5 shrink-0' : 'hidden';
    document.getElementById('editor-list-tools').className = data.isBat ? 'hidden' : 'flex items-center gap-1';

    switchEditorViewMode('code');

    const ta = document.getElementById('editor-textarea');
    ta.value = data.content || '';
    onEditorTextInput();
    setEditorStatus('Наведите курсор на любой флаг для перевода', 'text-[#4ADE80]');
    document.getElementById('editor-modal').classList.add('open');
}

function closeEditorModal() {
    sendCmd('playClick');
    hideWinwsFlagTooltip();
    const ta = document.getElementById('editor-textarea');
    if (ta) {
        ta.style.pointerEvents = '';
        ta.blur();
    }
    document.getElementById('editor-modal').classList.remove('open');
}

function toggleEditorMetaPanel() {
    sendCmd('playClick');
    document.getElementById('editor-meta-panel').classList.toggle('hidden');
}

function toggleEditorSearch() {
    sendCmd('playClick');
    const p = document.getElementById('editor-search-panel');
    const isHidden = p.classList.contains('hidden');
    if (isHidden) {
        p.classList.remove('hidden');
        p.classList.add('flex');
        document.getElementById('editor-find-input').focus();
    } else {
        p.classList.add('hidden');
        p.classList.remove('flex');
        document.getElementById('editor-textarea').focus();
    }
}

function toggleEditorWordWrap() {
    sendCmd('playClick');
    appState.editingMod.wordWrap = !appState.editingMod.wordWrap;
    const ta = document.getElementById('editor-textarea');
    const hl = document.getElementById('editor-highlight-layer');
    const ws = appState.editingMod.wordWrap ? 'pre-wrap' : 'pre';
    ta.style.whiteSpace = ws;
    if (hl) hl.style.whiteSpace = ws;
    document.getElementById('btn-word-wrap').innerText = `Перенос: ${appState.editingMod.wordWrap ? 'Вкл' : 'Выкл'}`;
    syncEditorScroll();
}

function changeEditorFontSize(delta) {
    sendCmd('playClick');
    appState.editingMod.fontSize = Math.min(22, Math.max(10, appState.editingMod.fontSize + delta));
    const sizePx = `${appState.editingMod.fontSize}px`;
    document.getElementById('editor-textarea').style.fontSize = sizePx;
    document.getElementById('editor-line-numbers').style.fontSize = sizePx;
    const hl = document.getElementById('editor-highlight-layer');
    if (hl) hl.style.fontSize = sizePx;
    syncEditorScroll();
}

function onEditorTextInput() {
    const ta = document.getElementById('editor-textarea');
    const lines = ta.value.split('\n');
    const lineNums = document.getElementById('editor-line-numbers');

    let nums = '';
    for (let i = 1; i <= Math.max(1, lines.length); i++) {
        nums += i + '\n';
    }
    lineNums.innerText = nums;

    updateEditorSyntaxHighlight();
    syncEditorScroll();

    if (appState.editingMod.isBat) {
        document.getElementById('editor-stats-info').innerText = `Строк: ${lines.length} | Символов: ${ta.value.length}`;
    } else {
        const validDomains = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('#')).length;
        document.getElementById('editor-stats-info').innerText = `Доменов: ${validDomains} | Строк: ${lines.length}`;
    }
    updateEditorCursorPos();
}

function syncEditorScroll() {
    const ta = document.getElementById('editor-textarea');
    const hl = document.getElementById('editor-highlight-layer');
    const ln = document.getElementById('editor-line-numbers');
    if (ln) ln.scrollTop = ta.scrollTop;
    if (hl) {
        hl.scrollTop = ta.scrollTop;
        hl.scrollLeft = ta.scrollLeft;
    }
}

function updateEditorCursorPos() {
    const ta = document.getElementById('editor-textarea');
    const upToCaret = ta.value.substring(0, ta.selectionStart);
    const lines = upToCaret.split('\n');
    const row = lines.length;
    const col = lines[lines.length - 1].length + 1;
    document.getElementById('editor-cursor-pos').innerText = `Стр: ${row}, Столб: ${col}`;
}

function onEditorKeyDown(e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleEditorSearch();
    } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveEditorChanges(false);
    }
}

function insertSnippet(snippet) {
    const ta = document.getElementById('editor-textarea');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + snippet + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + snippet.length;
    ta.focus();
    onEditorTextInput();
}

function commentCurrentLine() {
    const ta = document.getElementById('editor-textarea');
    const caret = ta.selectionStart;
    const lines = ta.value.split('\n');
    const lineIdx = ta.value.substring(0, caret).split('\n').length - 1;

    if (lineIdx >= 0 && lineIdx < lines.length) {
        const line = lines[lineIdx];
        if (line.trimStart().startsWith('::')) {
            const idx = line.indexOf('::');
            lines[lineIdx] = line.slice(0, idx) + line.slice(idx + 2).trimStart();
        } else {
            lines[lineIdx] = ':: ' + line;
        }
        ta.value = lines.join('\n');
        ta.focus();
        onEditorTextInput();
    }
}

function validateCurrentBat() {
    sendCmd('playClick');
    sendCmd('validateBatMod', {
        name: document.getElementById('edit-mod-name').value || 'Текущий скрипт',
        content: document.getElementById('editor-textarea').value
    });
}

function cleanDomainsList() {
    sendCmd('playClick');
    const ta = document.getElementById('editor-textarea');
    const rawLines = ta.value.split(/\r?\n/).filter(l => l.trim().length > 0);
    const cleaned = [];

    rawLines.forEach(raw => {
        let d = raw.trim().toLowerCase();
        if (!d || d.startsWith('#') || d.startsWith('//')) return;
        if (d.startsWith('http://')) d = d.substring(7);
        else if (d.startsWith('https://')) d = d.substring(8);
        if (d.startsWith('www.')) d = d.substring(4);
        const slashIdx = d.indexOf('/');
        if (slashIdx > 0) d = d.substring(0, slashIdx);
        const colonIdx = d.indexOf(':');
        if (colonIdx > 0) d = d.substring(0, colonIdx);
        if (d && d.includes('.')) cleaned.push(d);
    });

    const uniqueSorted = [...new Set(cleaned)].sort();
    const removed = Math.max(0, rawLines.length - uniqueSorted.length);
    ta.value = uniqueSorted.join('\n');
    onEditorTextInput();
    setEditorStatus(`Готово! Доменов: ${uniqueSorted.length} (удалено: ${removed})`, 'text-[#60A5FA]');
}

function editorFindNext() {
    const query = document.getElementById('editor-find-input').value;
    if (!query) return;
    const ta = document.getElementById('editor-textarea');
    const text = ta.value.toLowerCase();
    const q = query.toLowerCase();

    let start = ta.selectionEnd;
    if (start >= text.length) start = 0;

    let idx = text.indexOf(q, start);
    if (idx === -1 && start > 0) idx = text.indexOf(q, 0);

    if (idx >= 0) {
        ta.focus();
        ta.setSelectionRange(idx, idx + query.length);
        const lineNum = text.substring(0, idx).split('\n').length;
        setEditorStatus(`Найдено на строке ${lineNum}`, 'text-[#60A5FA]');
    } else {
        setEditorStatus('Совпадений не найдено', 'text-[#F44336]');
    }
}

function editorReplaceAll() {
    const query = document.getElementById('editor-find-input').value;
    const replacement = document.getElementById('editor-replace-input').value || '';
    if (!query) return;

    const ta = document.getElementById('editor-textarea');
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = ta.value.match(regex);
    const count = matches ? matches.length : 0;

    if (count > 0) {
        ta.value = ta.value.replace(regex, replacement);
        onEditorTextInput();
        setEditorStatus(`Заменено совпадений: ${count}`, 'text-[#4ADE80]');
    } else {
        setEditorStatus('Совпадений для замены нет', 'text-[#F44336]');
    }
}

function setEditorStatus(msg, colorCls) {
    const el = document.getElementById('editor-status-msg');
    el.innerText = msg;
    el.title = msg; 
    el.className = `truncate flex-1 min-w-0 ${colorCls}`;
}

function saveEditorChanges(bypassWarning = false) {
    sendCmd('playClick');
    if (editorViewMode === 'visual' && appState.editingMod.isBat) {
        updateLegoPreview();
        const gen = document.getElementById('lego-code-preview')?.textContent || '';
        if (gen) document.getElementById('editor-textarea').value = gen;
    }

    sendCmd('saveModContent', {
        id: appState.editingMod.id,
        isBat: appState.editingMod.isBat,
        name: document.getElementById('edit-mod-name').value,
        author: document.getElementById('edit-mod-author').value,
        version: document.getElementById('edit-mod-version').value,
        description: document.getElementById('edit-mod-desc').value,
        content: document.getElementById('editor-textarea').value,
        bypassWarning
    });
}