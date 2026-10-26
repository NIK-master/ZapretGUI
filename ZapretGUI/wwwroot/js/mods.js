// =========================================================================
// ЛОГИКА ВКЛАДКИ 2: МОДИФИКАЦИИ (MODSVIEW + CODE STUDIO)
// =========================================================================
function switchModsSubTab(subTab) {
    sendCmd('playClick');
    appState.modsSubTab = subTab;

    const btnBat = document.getElementById('mod-tab-bat');
    const btnList = document.getElementById('mod-tab-list');
    const btnGuide = document.getElementById('mod-tab-guide');

    const inactiveCls = 'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition cursor-pointer text-left';
    const activeCls = 'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold bg-[#2A2A2A] text-white transition cursor-pointer text-left';

    btnBat.className = (subTab === 'bat' ? activeCls : inactiveCls) + ' mb-1.5';
    btnList.className = (subTab === 'list' ? activeCls : inactiveCls) + ' mb-2';
    btnGuide.className = subTab === 'guide' ? activeCls : inactiveCls;

    const title = document.getElementById('mods-cat-title');
    const desc = document.getElementById('mods-cat-desc');
    const actions = document.getElementById('mods-action-bar');
    const listsContainer = document.getElementById('mods-lists-container');
    const guideContainer = document.getElementById('mods-guide-container');

    if (subTab === 'guide') {
        title.innerText = 'Руководство';
        desc.innerText = 'Ответы на частые вопросы и инструкции.';
        actions.classList.add('hidden');
        listsContainer.classList.add('hidden');
        guideContainer.classList.remove('hidden');
    } else {
        actions.classList.remove('hidden');
        listsContainer.classList.remove('hidden');
        guideContainer.classList.add('hidden');

        if (subTab === 'bat') {
            title.innerText = '.bat Стратегии';
            desc.innerText = 'Пользовательские скрипты обхода для специфичных игр и задач.';
        } else {
            title.innerText = 'Листы доменов';
            desc.innerText = 'Списки сайтов и сервисов для маршрутизации трафика (обновляются в прямом эфире).';
        }
        renderModsView();
    }
}

function renderModsView() {
    if (appState.modsSubTab === 'guide') return;

    const isBat = appState.modsSubTab === 'bat';
    const source = isBat ? appState.batMods : appState.listMods;

    const activeMods = source.filter(m => m.isActive);
    const availableMods = source.filter(m => !m.isActive);

    document.getElementById('active-mods-section').classList.toggle('hidden', activeMods.length === 0);
    document.getElementById('available-mods-section').classList.toggle('hidden', availableMods.length === 0);
    document.getElementById('mods-divider').classList.toggle('hidden', !(activeMods.length > 0 && availableMods.length > 0));
    document.getElementById('mods-empty-state').classList.toggle('hidden', source.length > 0);

    document.getElementById('active-mods-list').innerHTML = activeMods.map(m => buildModCardHtml(m, isBat)).join('');
    document.getElementById('available-mods-list').innerHTML = availableMods.map(m => buildModCardHtml(m, isBat)).join('');
}

function escapeStr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function buildModCardHtml(mod, isBat) {
    const cardBorder = mod.isActive
        ? 'bg-[#0A1F0A] border-emerald-600/80'
        : 'bg-[#18181B] border-zinc-800 hover:bg-[#222227]';

    const btnCls = mod.isActive
        ? 'bg-[#7F1D1D] hover:bg-red-800 text-white'
        : 'bg-[#1E3A8A] hover:bg-blue-800 text-white';

    const btnLabel = mod.isActive ? '✕ Убрать' : 'Включить ▶';
    const safeName = escapeStr(mod.meta.name);

    return `
    <div class="mod-card-enter p-3.5 rounded-xl border ${cardBorder} flex items-center justify-between gap-4 transition">
        <div class="overflow-hidden">
            <div class="flex items-center gap-2">
                <span class="font-bold text-[15px] text-white truncate">${mod.meta.name}</span>
                <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[11px]">v${mod.meta.version || '1.0'}</span>
            </div>
            <div class="text-xs text-emerald-400 mt-0.5">Автор: ${mod.meta.author || 'Аноним'}</div>
            <div class="text-xs text-zinc-400 mt-1 line-clamp-2">${mod.meta.description || ''}</div>
        </div>

        <div class="flex flex-col items-end shrink-0 min-w-[135px]">
            <button onclick="toggleMod('${mod.id}', ${isBat}, '${safeName}')" class="w-full py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${btnCls}">
                ${btnLabel}
            </button>
            <div class="flex items-center gap-3 mt-2 text-xs">
                <button onclick="openModEditor('${mod.id}', ${isBat})" class="text-[#888888] hover:text-white transition cursor-pointer flex items-center gap-1" title="Редактировать мод">
                    <span class="mdl-icon text-[11px]">&#xE70F;</span><span>Изменить</span>
                </button>
                <button onclick="exportMod('${mod.id}', ${isBat}, '${safeName}')" class="text-[#60A5FA] hover:text-blue-300 transition cursor-pointer flex items-center gap-1" title="Экспортировать в .zip">
                    <span class="mdl-icon text-[11px]">&#xE78C;</span><span>Экспорт</span>
                </button>
                <button onclick="promptDeleteMod('${mod.id}', ${isBat}, '${safeName}')" class="text-[#F44336] hover:text-red-300 transition cursor-pointer flex items-center gap-1" title="Удалить мод">
                    <span class="mdl-icon text-[11px]">&#xE74D;</span><span>Удалить</span>
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
        'Вы уверены, что хотите отключить все моды в этой категории?',
        'Отключить',
        () => sendCmd('disableAllMods', { isBat }),
        true
    );
}

function promptDeleteMod(id, isBat, name) {
    sendCmd('playClick');
    showConfirm(
        'Удаление мода',
        `Удалить мод «${name}» навсегда?\nЭто удалит все файлы мода с диска.`,
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
    document.getElementById('new-mod-name').value = 'Мой новый мод';
    document.getElementById('new-mod-author').value = 'You';
    document.getElementById('new-mod-desc').value = 'Описание мода';
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
        status.className = 'text-[11px] font-mono text-amber-400';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else if (isTaken) {
        status.innerText = '❌ Такой ID уже занят!';
        status.className = 'text-[11px] font-mono text-red-400';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else {
        status.innerText = `✓ ID «${cleanId}» уникален`;
        status.className = 'text-[11px] font-mono text-emerald-400';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function confirmCreateMod() {
    sendCmd('playClick');
    sendCmd('createMod', {
        isBat: appState.modsSubTab === 'bat',
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
    setEditorStatus(`Готово! Доменов: ${uniqueSorted.length} (удалено: ${removed})`, 'text-blue-400');
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
        setEditorStatus(`Найдено на строке ${lineNum}`, 'text-blue-400');
    } else {
        setEditorStatus('Совпадений не найдено', 'text-red-400');
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
        setEditorStatus(`Заменено совпадений: ${count}`, 'text-emerald-400');
    } else {
        setEditorStatus('Совпадений для замены нет', 'text-red-400');
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