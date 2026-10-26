// =========================================================================
// ЛОГИКА ВКЛАДКИ 2: МОДИФИКАЦИИ (MODSVIEW + CODE STUDIO)
// =========================================================================
let modsLayoutMode = 'grid'; // 'grid' (2 колонки) или 'list' (1 колонка)

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
    const statusText = mod.isActive ? 'Активен' : 'Отключен';
    const statusCls = mod.isActive ? 'text-brand font-semibold' : 'text-[#777777]';
    const iconBoxCls = mod.isActive
        ? 'bg-[#107C10]/20 border-[#107C10] text-brand'
        : 'bg-[#202020] border-[#2E2E2E] text-[#888888]';

    return `
    <div style="animation-delay: ${delayMs}ms" class="mod-workshop-card ${mod.isActive ? 'is-active' : ''} flex flex-col justify-between gap-3">
        <!-- Верхняя часть: Иконка, Название, Технический ID и Тумблер -->
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
                    <div class="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#777777] truncate">
                        <span>${fileBadge}</span>
                        <span>•</span>
                        <span class="text-[#999999]">Автор: ${mod.meta.author || 'Аноним'}</span>
                    </div>
                </div>
            </div>

            <!-- Тумблер включения -->
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] ${statusCls}">${statusText}</span>
                <input type="checkbox" ${mod.isActive ? 'checked' : ''} onchange="toggleMod('${mod.id}', ${isBat}, '${safeName}')" class="cyber-toggle" title="Включить / отключить мод">
            </div>
        </div>

        <!-- Описание мода -->
        <div class="text-xs text-[#A8A8A8] leading-relaxed line-clamp-2 min-h-[32px]">
            ${mod.meta.description || 'Описание не указано.'}
        </div>

        <!-- Нижняя панель инструментов карточки -->
        <div class="flex items-center justify-between pt-2.5 border-t border-[#242424]">
            <span class="text-[10px] font-mono text-[#555555]">ID: ${mod.id}</span>

            <div class="flex items-center gap-1.5">
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

function openEditorWithData(data) {
    appState.editingMod.id = data.id;
    appState.editingMod.isBat = data.isBat;

    document.getElementById('editor-title').innerText = `Редактор: ${data.meta.name}`;
    document.getElementById('editor-subtitle').innerText = `Уникальный ID: ${data.id} • Файл: ${data.fileName}`;

    document.getElementById('edit-mod-name').value = data.meta.name || '';
    document.getElementById('edit-mod-author').value = data.meta.author || '';
    document.getElementById('edit-mod-version').value = data.meta.version || '1.0';
    document.getElementById('edit-mod-desc').value = data.meta.description || '';

    document.getElementById('editor-bat-tools').style.display = data.isBat ? 'flex' : 'none';
    document.getElementById('editor-snippets-bar').style.display = data.isBat ? 'flex' : 'none';
    document.getElementById('editor-list-tools').style.display = data.isBat ? 'none' : 'flex';

    const ta = document.getElementById('editor-textarea');
    ta.value = data.content || '';
    setEditorStatus('', '');
    onEditorTextInput();
    updateEditorCursorPos();

    document.getElementById('editor-modal').classList.add('open');
}

function closeEditorModal() {
    sendCmd('playClick');
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
    appState.editingMod.wordWrap = !appState.editingMod.wordWrap;
    const ta = document.getElementById('editor-textarea');
    ta.style.whiteSpace = appState.editingMod.wordWrap ? 'pre-wrap' : 'pre';
    document.getElementById('btn-word-wrap').innerText = `Перенос: ${appState.editingMod.wordWrap ? 'Вкл' : 'Выкл'}`;
}

function changeEditorFontSize(delta) {
    const next = appState.editingMod.fontSize + delta;
    if (next >= 10 && next <= 24) {
        appState.editingMod.fontSize = next;
        document.getElementById('editor-textarea').style.fontSize = `${next}px`;
        document.getElementById('editor-line-numbers').style.fontSize = `${next}px`;
    }
}

function onEditorTextInput() {
    const ta = document.getElementById('editor-textarea');
    const lines = ta.value.split('\n');
    const count = Math.max(1, lines.length);

    let nums = '';
    for (let i = 1; i <= count; i++) nums += i + '\n';
    document.getElementById('editor-line-numbers').innerText = nums;

    if (!appState.editingMod.isBat) {
        const nonEmpty = lines.filter(l => l.trim().length > 0).length;
        document.getElementById('editor-stats-info').innerText = `Строк: ${count} (Доменов: ${nonEmpty})`;
    } else {
        document.getElementById('editor-stats-info').innerText = `Строк: ${count} • Символов: ${ta.value.length}`;
    }
}

function syncEditorScroll() {
    const ta = document.getElementById('editor-textarea');
    document.getElementById('editor-line-numbers').scrollTop = ta.scrollTop;
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
    el.className = `truncate max-w-[260px] ${colorCls}`;
}

function saveEditorChanges(bypassWarning = false) {
    sendCmd('playClick');
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