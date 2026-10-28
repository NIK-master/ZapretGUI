// =========================================================================
// ЛОГИКА ВКЛАДКИ 3: ДИАГНОСТИКА (CLUSTER MATRIX, PROBES & ПАСХАЛКИ)
// =========================================================================
let tgClicks = 0, lastTgClick = 0;
let dsClicks = 0, lastDsClick = 0;
let lastDiagReport = null;

const DC_LOCATIONS = {
    1: 'Майами (US)',
    2: 'Амстердам (NL)',
    3: 'Майами (US)',
    4: 'Амстердам (NL)',
    5: 'Сингапур (SG)'
};

function prepareDiagSkeletons(shimmer = false) {
    const dcs = [1, 2, 3, 4, 5];
    const ports = [443, 80, 5222];
    const dcGrid = document.getElementById('diag-dc-grid');

    dcGrid.innerHTML = dcs.map(dc => `
        <div class="dc-cluster-card ${shimmer ? 'shimmer-box' : ''}">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-white">DC ${dc}</span>
                <span class="text-[10px] font-mono text-[#777777]">${DC_LOCATIONS[dc]}</span>
            </div>
            <div class="space-y-1">
                ${ports.map(p => `
                    <div class="port-badge-row">
                        <span class="text-[#888888]">:${p}</span>
                        <span class="text-[#555555] font-bold">${shimmer ? '...' : '—'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    const dsNodes = [
        { label: 'Gateway', desc: 'Авторизация и сокеты' },
        { label: 'Media', desc: 'Картинки и стримы' },
        { label: 'API', desc: 'Сообщения и чаты' }
    ];

    document.getElementById('diag-discord-grid').innerHTML = dsNodes.map(n => `
        <div class="dc-cluster-card ${shimmer ? 'shimmer-box' : ''}">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-xs font-bold text-white">${n.label}</div>
                    <div class="text-[10px] text-[#777777]">${n.desc}</div>
                </div>
                <span class="text-sm font-mono font-bold text-[#555555]">${shimmer ? '...' : '—'}</span>
            </div>
        </div>
    `).join('');
}

function updateDiagStepPills(progressPercent, statusText) {
    const lbl = document.getElementById('diag-step-label');
    const pct = document.getElementById('diag-step-percent');
    if (lbl) lbl.innerText = statusText || 'Проверка...';
    if (pct) pct.innerText = `${progressPercent}%`;

    const thresholds = [0, 10, 30, 40, 55, 70];
    thresholds.forEach((t, idx) => {
        const el = document.getElementById('dstep-' + idx);
        if (!el) return;
        const nextT = thresholds[idx + 1] ?? 100;
        if (progressPercent >= nextT) {
            el.className = 'diag-step-pill done';
        } else if (progressPercent >= t) {
            el.className = 'diag-step-pill active';
        } else {
            el.className = 'diag-step-pill';
        }
    });
}

function runDiagnostics() {
    sendCmd('playClick');
    const btn = document.getElementById('btn-run-diag');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    document.getElementById('diag-btn-text').innerText = 'Сканирование...';

    const wrap = document.getElementById('diag-progress-wrap');
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
    document.getElementById('diag-progress-bar').style.width = '5%';
    updateDiagStepPills(5, 'Запуск диагностики...');

    prepareDiagSkeletons(true);
    sendCmd('runDiagnostics');
}

function getPingColorHex(latency, ok) {
    const isCb = appState.settings.colorblindMode;
    const okColor = isCb ? '#60A5FA' : '#4CAF50';
    const warnColor = isCb ? '#FFB900' : '#F59E0B';
    const errColor = isCb ? '#FF8C00' : '#EF4444';

    if (!ok || latency == null) return errColor;
    return latency < 120 ? okColor : warnColor;
}

function computeHumanVerdict(r) {
    const blocks = r.blockTypes || [];
    const app = r.appStatus || {};
    const dcResults = r.dcResults || [];
    const pingResults = r.pingResults || [];
    const dcOk = dcResults.filter(x => x.ok).length;
    const dcTot = dcResults.length;
    const pingOk = pingResults.some(p => p.ok);
    const bypass = !!app.zapretRunning;

    const isCb = appState.settings.colorblindMode;
    const successColor = isCb ? '#0078D7' : '#107C10';
    const errorColor = isCb ? '#FF8C00' : '#D13438';
    const warningColor = isCb ? '#FFB900' : '#F59E0B';

    const hasSniBlock = blocks.includes(3);
    const hasIpBlock = blocks.includes(2);

    if (app.tgWsProxyRunning)
        return { title: 'TgWsProxy активен', detail: 'Трафик Telegram идет через локальный прокси.', color: successColor };
    if (!pingOk && dcOk === 0)
        return { title: 'Нет соединения', detail: 'Ни один внешний узел не отвечает.', color: errorColor };
    if (hasSniBlock)
        return bypass
            ? { title: 'Работает (Zapret активен)', detail: 'Обнаружен DPI, но обход успешно активен.', color: successColor }
            : { title: 'Блокировка по TLS SNI (DPI)', detail: 'Провайдер режет соединение. Включите Zapret.', color: errorColor };
    if (hasIpBlock)
        return bypass
            ? { title: 'Работает через обход', detail: 'Прямой доступ закрыт, но обходчик активен.', color: successColor }
            : { title: 'IP-адреса заблокированы', detail: 'Дата-центры недоступны напрямую.', color: errorColor };
    if (dcOk >= Math.max(Math.floor(dcTot / 2), 1))
        return { title: 'Telegram доступен', detail: `Отвечает ${dcOk} из ${dcTot} проверенных портов DC.`, color: successColor };

    return { title: 'Нестабильная связь', detail: 'Часть дата-центров не отвечает на запросы.', color: warningColor };
}

function computeDiscordVerdict(r) {
    const app = r.appStatus || {};
    const bypass = !!app.zapretRunning;
    const dsPing = r.discordPing || [];

    const isCb = appState.settings.colorblindMode;
    const successColor = isCb ? '#0078D7' : '#107C10';
    const errorColor = isCb ? '#FF8C00' : '#D13438';
    const warningColor = isCb ? '#FFB900' : '#F59E0B';

    if (dsPing.length > 0 && dsPing.every(p => !p.ok))
        return bypass
            ? { title: 'Сбои соединения Discord', detail: 'Zapret запущен, но узлы не отвечают. Смените .bat профиль.', color: warningColor }
            : { title: 'Discord заблокирован', detail: 'Gateway и API не отвечают. Включите Zapret.', color: errorColor };

    if (r.udpResult && r.udpResult.blocked)
        return bypass
            ? { title: 'Discord работает (с обходом)', detail: 'UDP-голос маршрутизируется через активный Zapret.', color: successColor }
            : { title: 'Проблемы с голосом (UDP)', detail: 'Чаты доступны, но голосовые порты блокируются.', color: warningColor };

    return { title: 'Discord работает отлично', detail: 'Все магистральные серверы и голосовые порты открыты.', color: successColor };
}

function setProbeBoxStyle(iconId, valId, text, state) {
    const iconEl = document.getElementById(iconId);
    const valEl = document.getElementById(valId);
    if (!iconEl || !valEl) return;

    valEl.innerText = text;
    if (state === 'ok') {
        iconEl.className = 'w-8 h-8 rounded-lg bg-[#107C10]/20 border border-[#107C10] flex items-center justify-center text-brand shrink-0';
        valEl.className = 'text-xs font-mono font-bold text-brand truncate';
    } else if (state === 'warn') {
        iconEl.className = 'w-8 h-8 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/60 flex items-center justify-center text-[#F59E0B] shrink-0';
        valEl.className = 'text-xs font-mono font-bold text-[#F59E0B] truncate';
    } else {
        iconEl.className = 'w-8 h-8 rounded-lg bg-[#D13438]/20 border border-[#D13438] flex items-center justify-center text-[#F44336] shrink-0';
        valEl.className = 'text-xs font-mono font-bold text-[#F44336] truncate';
    }
}

function renderDiagnosticsReport(report) {
    lastDiagReport = report;

    document.getElementById('diag-status-txt').innerText = `Последняя проверка: ${new Date().toLocaleTimeString()} • Все тесты выполнены.`;
    const wrap = document.getElementById('diag-progress-wrap');
    wrap.classList.add('hidden');
    wrap.classList.remove('flex');

    const btn = document.getElementById('btn-run-diag');
    btn.disabled = false;
    btn.style.opacity = '1';
    document.getElementById('diag-btn-text').innerText = 'Повторить проверку';

    const copyBtn = document.getElementById('btn-copy-diag');
    if (copyBtn) {
        copyBtn.classList.remove('hidden');
        copyBtn.classList.add('inline-flex');
    }

    // 1. Вердикты Telegram и Discord
    const tgV = computeHumanVerdict(report);
    const tgCard = document.getElementById('diag-tg-card');
    tgCard.style.borderColor = tgV.color;
    tgCard.style.background = '';
    document.getElementById('diag-tg-title').innerText = tgV.title;
    document.getElementById('diag-tg-title').style.color = 'white';
    document.getElementById('diag-tg-sub').innerText = tgV.detail;

    const dsV = computeDiscordVerdict(report);
    const dsCard = document.getElementById('diag-ds-card');
    dsCard.style.borderColor = dsV.color;
    dsCard.style.background = '';
    document.getElementById('diag-ds-title').innerText = dsV.title;
    document.getElementById('diag-ds-title').style.color = 'white';
    document.getElementById('diag-ds-sub').innerText = dsV.detail;

    // 2. Активные процессы
    const st = report.appStatus || {};
    document.getElementById('proc-dot-tg').className = `w-2 h-2 rounded-full shrink-0 ${st.telegramRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('proc-dot-ds').className = `w-2 h-2 rounded-full shrink-0 ${st.discordRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('proc-dot-zp').className = `w-2 h-2 rounded-full shrink-0 ${st.zapretRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('proc-dot-tw').className = `w-2 h-2 rounded-full shrink-0 ${st.tgWsProxyRunning ? 'dot-online' : 'dot-offline'}`;

    // 3. Глубокие метрики (DNS, DPI/SNI, ТСПУ Медиа, Discord UDP)
    if (report.dnsResult) {
        if (report.dnsResult.spoofed) {
            setProbeBoxStyle('probe-icon-dns', 'probe-val-dns', 'Подмена (Spoof)', 'err');
        } else {
            setProbeBoxStyle('probe-icon-dns', 'probe-val-dns', 'Чистый (OK)', 'ok');
        }
    }

    if (report.dpiResult) {
        if (report.dpiResult.dpiDetected) {
            setProbeBoxStyle('probe-icon-dpi', 'probe-val-dpi', `Блок (${report.dpiResult.sniTelegram.toUpperCase()})`, st.zapretRunning ? 'warn' : 'err');
        } else {
            setProbeBoxStyle('probe-icon-dpi', 'probe-val-dpi', 'TLS Проходит', 'ok');
        }
    }

    if (report.mediaResult) {
        const spd = report.mediaResult.speedKbps || 0;
        if (report.mediaResult.throttled) {
            setProbeBoxStyle('probe-icon-media', 'probe-val-media', `${spd.toFixed(0)} кбит/с (ТСПУ)`, 'warn');
        } else if (spd > 0) {
            setProbeBoxStyle('probe-icon-media', 'probe-val-media', `${spd.toFixed(0)} кбит/с (ОК)`, 'ok');
        } else {
            setProbeBoxStyle('probe-icon-media', 'probe-val-media', 'Нет ответа CDN', 'err');
        }
    }

    if (report.udpResult) {
        const openCnt = (report.udpResult.openPorts || []).length;
        const totCnt = (report.udpResult.testedPorts || []).length || 5;
        if (report.udpResult.blocked) {
            setProbeBoxStyle('probe-icon-udp', 'probe-val-udp', st.zapretRunning ? 'Через Zapret' : 'Закрыт (0/5)', st.zapretRunning ? 'ok' : 'warn');
        } else {
            setProbeBoxStyle('probe-icon-udp', 'probe-val-udp', `Открыт (${openCnt}/${totCnt})`, 'ok');
        }
    }

    // 4. Кластеры Telegram DC 1-5
    const dcList = report.dcResults || [];
    const dcOkCount = dcList.filter(x => x.ok).length;
    document.getElementById('diag-dc-summary').innerText = `Доступно портов: ${dcOkCount} из ${dcList.length}`;

    const dcs = [1, 2, 3, 4, 5];
    document.getElementById('diag-dc-grid').innerHTML = dcs.map(dcId => {
        const items = dcList.filter(x => x.dcId === dcId);
        const okItems = items.filter(x => x.ok && x.latencyMs != null);
        const avgPing = okItems.length > 0
            ? Math.round(okItems.reduce((acc, v) => acc + v.latencyMs, 0) / okItems.length)
            : null;

        const borderStatus = okItems.length === items.length
            ? 'border-[#107C10]/60'
            : (okItems.length > 0 ? 'border-[#F59E0B]/60' : 'border-[#D13438]/60');

        return `
        <div class="dc-cluster-card ${borderStatus}">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-white">DC ${dcId}</span>
                <span class="text-[10px] font-mono text-[#888888]">${avgPing != null ? avgPing + ' мс' : 'Недоступен'}</span>
            </div>
            <div class="text-[10px] text-[#666666] -mt-1">${DC_LOCATIONS[dcId]}</div>
            <div class="space-y-1 mt-0.5">
                ${items.map(portItem => {
            const c = getPingColorHex(portItem.latencyMs, portItem.ok);
            const valTxt = portItem.ok && portItem.latencyMs != null ? `${Math.round(portItem.latencyMs)} мс` : 'ERR';
            return `
                    <div class="port-badge-row">
                        <span class="text-[#888888]">:${portItem.port}</span>
                        <span class="font-bold" style="color:${c}">${valTxt}</span>
                    </div>`;
        }).join('')}
            </div>
        </div>`;
    }).join('');

    // 5. Магистральные узлы Discord
    const dsList = report.discordPing || [];
    const dsOkCount = dsList.filter(x => x.ok).length;
    document.getElementById('diag-ds-summary').innerText = `Доступно узлов: ${dsOkCount} из ${dsList.length}`;

    document.getElementById('diag-discord-grid').innerHTML = dsList.map(ds => {
        const c = getPingColorHex(ds.latencyMs, ds.ok);
        return `
        <div class="dc-cluster-card">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-xs font-bold text-white">${ds.title}</div>
                    <div class="text-[10px] font-mono text-[#777777] mt-0.5">${ds.ip || 'TCP :443'}</div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-mono font-bold" style="color:${c}">${ds.pingText}</div>
                    <div class="text-[10px] text-[#666666]">${ds.ok ? 'Онлайн' : 'Таймаут'}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    // 6. Общий индекс здоровья сети (Health Score 0-100%)
    const totalChecks = dcList.length + dsList.length + 2;
    const passedChecks = dcOkCount + dsOkCount + (report.dnsResult && !report.dnsResult.spoofed ? 1 : 0) + (report.mediaResult && !report.mediaResult.throttled ? 1 : 0);
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    const hBadge = document.getElementById('diag-health-badge');
    const hDot = document.getElementById('diag-health-dot');
    const hTxt = document.getElementById('diag-health-txt');
    if (hBadge && hDot && hTxt) {
        hTxt.innerText = `Здоровье сети: ${score}%`;
        if (score >= 75) {
            hBadge.className = 'px-2.5 py-0.5 rounded-full bg-[#0F240F] border border-[#107C10] font-mono text-xs text-brand font-semibold flex items-center gap-1.5';
            hDot.className = 'w-1.5 h-1.5 rounded-full dot-online';
        } else if (score >= 40) {
            hBadge.className = 'px-2.5 py-0.5 rounded-full bg-[#2E2210] border border-[#F59E0B] font-mono text-xs text-[#F59E0B] font-semibold flex items-center gap-1.5';
            hDot.className = 'w-1.5 h-1.5 rounded-full bg-[#F59E0B]';
        } else {
            hBadge.className = 'px-2.5 py-0.5 rounded-full bg-[#2A1215] border border-[#D13438] font-mono text-xs text-[#F44336] font-semibold flex items-center gap-1.5';
            hDot.className = 'w-1.5 h-1.5 rounded-full dot-offline';
        }
    }

    // 7. Инженерные рекомендации (очищаем пестрые эмодзи и ставим строгие иконки MDL2)
    const recs = report.recommendations || [];
    document.getElementById('diag-recs-list').innerHTML = recs.length
        ? recs.map(rawRec => formatCleanRecommendation(rawRec)).join('')
        : `<div class="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0F200F] border border-[#107C10] text-brand font-semibold">
               <span class="mdl-icon text-sm">&#xE73E;</span>
               <span>Все проверенные узлы и протоколы работают стабильно, дополнительных действий не требуется!</span>
           </div>`;
}

function formatCleanRecommendation(rawText) {
    // Убираем цветные эмодзи из C#-строк и ставим строгие системные иконки
    const clean = rawText.replace(/^[⚠️🛡📡🔵🔴🎮✓\s]+/u, '').trim().replace(/✓/g, '');
    const isWarn = rawText.includes('⚠️') || rawText.includes('🔴') || rawText.includes('БЛОКИРОВКА') || rawText.includes('Недоступен');
    const isOk = rawText.includes('доступен') || rawText.includes('активен, Discord работает');

    const borderCls = isOk
        ? 'border-[#107C10]/60 bg-[#0F200F]/60'
        : (isWarn ? 'border-[#D13438]/60 bg-[#2A1215]/40' : 'border-[#2A2A2A] bg-[#161616]');
    const iconColor = isOk ? 'text-brand' : (isWarn ? 'text-[#F44336]' : 'text-[#60A5FA]');
    const glyph = isOk ? '&#xE73E;' : (isWarn ? '&#xE7BA;' : '&#xE946;');

    // Подбираем кнопку быстрого действия под конкретную проблему
    let actionBtnHtml = '';
    if (rawText.includes('SNI-БЛОКИРОВКА') || rawText.includes('DISCORD API: Недоступен') || rawText.includes('Звонки не работают без Zapret')) {
        actionBtnHtml = !appState.isRunning
            ? `<button onclick="diagQuickAction('startBypass')" class="px-3 py-1.5 rounded-lg btn-brand text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1.5 shadow">
                   <span class="mdl-icon text-[10px]">&#xE7E8;</span><span>Включить обход</span>
               </button>`
            : `<button onclick="diagQuickAction('scanConfigs')" class="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2C2C2C] border border-[#3A3A3A] text-white text-[11px] font-semibold cursor-pointer shrink-0 flex items-center gap-1.5 transition">
                   <span class="mdl-icon text-[10px] text-brand">&#xE721;</span><span>Подобрать .bat</span>
               </button>`;
    } else if (rawText.includes('ТСПУ-ЗАМЕДЛЕНИЕ МЕДИА')) {
        actionBtnHtml = !appState.proxyRunning
            ? `<button onclick="diagQuickAction('enableProxy')" class="px-3 py-1.5 rounded-lg btn-brand text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1.5 shadow">
                   <span class="mdl-icon text-[10px]">&#xE709;</span><span>Запустить с TgWsProxy</span>
               </button>`
            : `<button onclick="diagQuickAction('scanConfigs')" class="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2C2C2C] border border-[#3A3A3A] text-white text-[11px] font-semibold cursor-pointer shrink-0 flex items-center gap-1.5 transition">
                   <span class="mdl-icon text-[10px] text-brand">&#xE721;</span><span>Сменить профиль</span>
               </button>`;
    } else if (rawText.includes('DNS-СПУФИНГ')) {
        actionBtnHtml = `<button onclick="diagQuickAction('applyHosts')" class="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2C2C2C] border border-[#107C10] text-brand text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1.5 transition">
                             <span class="mdl-icon text-[10px]">&#xE945;</span><span>Применить обходной Hosts</span>
                         </button>`;
    }

    return `
    <div class="flex items-center justify-between gap-3 p-3 rounded-lg border ${borderCls}">
        <div class="flex items-start gap-3">
            <span class="mdl-icon text-sm ${iconColor} mt-0.5 shrink-0">${glyph}</span>
            <span class="whitespace-pre-line leading-relaxed text-[#E0E0E0]">${clean}</span>
        </div>
        ${actionBtnHtml}
    </div>`;
}

function diagQuickAction(act) {
    sendCmd('playClick');
    const navBtns = document.querySelectorAll('.nav-btn');

    if (act === 'startBypass') {
        switchTab('home', navBtns[0]);
        if (!appState.isRunning) onMainToggleClick();
    } else if (act === 'scanConfigs') {
        switchTab('home', navBtns[0]);
        openConfigModal();
    } else if (act === 'enableProxy') {
        document.getElementById('chk-proxy').checked = true;
        onModuleToggleChange();
        switchTab('home', navBtns[0]);
        if (!appState.isRunning) onMainToggleClick();
        else sendCmd('restartBypass');
    } else if (act === 'applyHosts') {
        switchTab('settings', navBtns[3]);
        updateSystemHosts();
    }
}

async function copyDiagnosticsReport() {
    sendCmd('playClick');
    if (!lastDiagReport) return;

    const dcOk = (lastDiagReport.dcResults || []).filter(x => x.ok).length;
    const dcTot = (lastDiagReport.dcResults || []).length;
    const dsOk = (lastDiagReport.discordPing || []).filter(x => x.ok).length;
    const dsTot = (lastDiagReport.discordPing || []).length;
    const spd = lastDiagReport.mediaResult?.speedKbps?.toFixed(0) || '0';

    const lines = [
        `=== ОТЧЁТ ДИАГНОСТИКИ ZAPRET FOR ADHD ===`,
        `Время: ${new Date().toLocaleString()}`,
        `Telegram DC: ${dcOk}/${dcTot} портов доступно`,
        `Discord Nodes: ${dsOk}/${dsTot} узлов доступно`,
        `DNS Spoofing: ${lastDiagReport.dnsResult?.spoofed ? 'Обнаружен' : 'Чисто'}`,
        `DPI / TLS SNI: ${lastDiagReport.dpiResult?.dpiDetected ? 'Блокируется (' + lastDiagReport.dpiResult.sniTelegram + ')' : 'ОК'}`,
        `Скорость медиа CDN: ${spd} kbps`,
        `Активный профиль: ${appState.selectedProfile} (Zapret: ${appState.zapretRunning ? 'ВКЛ' : 'ВЫКЛ'})`
    ];

    try {
        await navigator.clipboard.writeText(lines.join('\r\n'));
        const txt = document.getElementById('txt-copy-diag');
        if (txt) {
            txt.innerText = 'Скопировано!';
            setTimeout(() => txt.innerText = 'Отчёт', 1800);
        }
    } catch { }
}

function onTgEmojiClick() {
    const now = Date.now();
    if (now - lastTgClick > 1500) tgClicks = 0;
    tgClicks++;
    lastTgClick = now;

    if (tgClicks >= 5) {
        tgClicks = 0;
        sendCmd('playSuccess');
        const title = document.getElementById('diag-tg-title');
        const sub = document.getElementById('diag-tg-sub');
        const card = document.getElementById('diag-tg-card');
        const emoji = document.getElementById('diag-tg-emoji');

        title.innerText = 'Telegram (Режим Дурова)';
        title.style.color = '#00E5FF';
        sub.innerText = 'Свободу интернету! Трафик летит напрямую.';
        card.style.borderColor = '#00E5FF';
        card.style.background = '#001A22';

        emoji.classList.remove('easter-fly');
        void emoji.offsetWidth;
        emoji.classList.add('easter-fly');
    }
}

function onDiscordEmojiClick() {
    const now = Date.now();
    if (now - lastDsClick > 1500) dsClicks = 0;
    dsClicks++;
    lastDsClick = now;

    if (dsClicks >= 5) {
        dsClicks = 0;
        sendCmd('playSuccess');
        const title = document.getElementById('diag-ds-title');
        const sub = document.getElementById('diag-ds-sub');
        const card = document.getElementById('diag-ds-card');
        const emoji = document.getElementById('diag-ds-emoji');

        title.innerText = 'Discord (Режим турбо-деда)';
        title.style.color = '#FF00FF';
        sub.innerText = 'Никакие блокировки больше не страшны!';
        card.style.borderColor = '#FF00FF';
        card.style.background = '#1A001A';

        emoji.classList.remove('easter-spin');
        void emoji.offsetWidth;
        emoji.classList.add('easter-spin');
    }
}