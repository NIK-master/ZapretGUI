// =========================================================================
// ЛОГИКА ВКЛАДКИ 3: ДИАГНОСТИКА (DIAGNOSTICSVIEW + ПАСХАЛКИ)
// =========================================================================
let tgClicks = 0, lastTgClick = 0;
let dsClicks = 0, lastDsClick = 0;

function prepareDiagSkeletons(shimmer = false) {
    const dcs = [1, 2, 3, 4, 5];
    const ports = [443, 80, 5222];
    const dcGrid = document.getElementById('diag-dc-grid');

    let dcHtml = '';
    dcs.forEach(dc => {
        ports.forEach(port => {
            dcHtml += `
            <div class="server-ping-card ${shimmer ? 'shimmer-box' : ''}">
                <div class="text-xs font-bold text-zinc-400">DC ${dc} :${port}</div>
                <div class="text-sm font-mono font-bold text-zinc-600 mt-1">${shimmer ? '...' : '—'}</div>
            </div>`;
        });
    });
    dcGrid.innerHTML = dcHtml;

    const dsLabels = ['Gateway', 'Media', 'API'];
    document.getElementById('diag-discord-grid').innerHTML = dsLabels.map(lbl => `
        <div class="server-ping-card ${shimmer ? 'shimmer-box' : ''}">
            <div class="text-xs font-bold text-zinc-400">${lbl}</div>
            <div class="text-sm font-mono font-bold text-zinc-600 mt-1">${shimmer ? '...' : '—'}</div>
        </div>
    `).join('');
}

function runDiagnostics() {
    sendCmd('playClick');
    document.getElementById('btn-run-diag').disabled = true;
    document.getElementById('btn-run-diag').style.opacity = '0.5';
    document.getElementById('diag-progress-wrap').classList.remove('hidden');
    document.getElementById('diag-progress-bar').style.width = '5%';
    prepareDiagSkeletons(true);
    sendCmd('runDiagnostics');
}

function getPingColorHex(latency, ok) {
    const isCb = appState.settings.colorblindMode;
    const okColor = isCb ? '#0078D7' : '#10B981';
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
    const successColor = isCb ? '#0078D7' : '#10B981';
    const errorColor = isCb ? '#FF8C00' : '#EF4444';
    const warningColor = isCb ? '#FFB900' : '#F59E0B';

    const hasSniBlock = blocks.includes(3);
    const hasIpBlock = blocks.includes(2);

    if (app.tgWsProxyRunning)
        return { title: 'tg-ws-proxy активен', detail: 'Telegram работает через прокси локально.', color: successColor };
    if (!pingOk && dcOk === 0)
        return { title: 'Интернета нет', detail: 'Ни один сервер не отвечает.', color: errorColor };
    if (hasSniBlock)
        return bypass
            ? { title: 'Telegram работает (обходчик активен)', detail: 'DPI обнаружен, но обходчик запущен.', color: successColor }
            : { title: 'Telegram заблокирован (DPI)', detail: 'Нужен Zapret.', color: errorColor };
    if (hasIpBlock)
        return bypass
            ? { title: 'Telegram работает', detail: 'IP заблокированы, но обходчик компенсирует.', color: successColor }
            : { title: 'Серверы заблокированы', detail: 'Нужен VPN.', color: errorColor };
    if (dcOk >= Math.max(Math.floor(dcTot / 2), 1))
        return { title: 'Telegram работает нормально', detail: 'Серверы отвечают быстро.', color: successColor };

    return { title: 'Ситуация неоднозначная', detail: 'Проблемы со связью.', color: warningColor };
}

function computeDiscordVerdict(r) {
    const app = r.appStatus || {};
    const bypass = !!app.zapretRunning;
    const dsPing = r.discordPing || [];

    const isCb = appState.settings.colorblindMode;
    const successColor = isCb ? '#0078D7' : '#10B981';
    const errorColor = isCb ? '#FF8C00' : '#EF4444';
    const warningColor = isCb ? '#FFB900' : '#F59E0B';

    if (dsPing.length > 0 && dsPing.every(p => !p.ok))
        return bypass
            ? { title: 'Сбои в Discord', detail: 'Обходчик работает, но серверы недоступны. Возможно, стоит сменить профиль.', color: warningColor }
            : { title: 'Discord полностью заблокирован', detail: 'API и Gateway не отвечают. Включи Zapret.', color: errorColor };

    if (r.udpResult && r.udpResult.blocked)
        return bypass
            ? { title: 'Discord работает (обходчик активен)', detail: 'UDP заблокирован, но Zapret маршрутизирует трафик.', color: successColor }
            : { title: 'Проблемы с голосом', detail: 'Чаты работают, но UDP заблокирован. Звонки не пройдут.', color: warningColor };

    return { title: 'Discord работает нормально', detail: 'Все нужные порты и серверы доступны.', color: successColor };
}

function renderDiagnosticsReport(report) {
    document.getElementById('diag-status-txt').innerText = 'Проверка завершена.';
    document.getElementById('diag-progress-wrap').classList.add('hidden');
    document.getElementById('btn-run-diag').disabled = false;
    document.getElementById('btn-run-diag').style.opacity = '1';

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

    const st = report.appStatus || {};
    document.getElementById('proc-dot-tg').className = `w-2.5 h-2.5 rounded-full ${st.telegramRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('proc-dot-ds').className = `w-2.5 h-2.5 rounded-full ${st.discordRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('proc-dot-zp').className = `w-2.5 h-2.5 rounded-full ${st.zapretRunning ? 'dot-online' : 'dot-offline'}`;
    document.getElementById('proc-dot-tw').className = `w-2.5 h-2.5 rounded-full ${st.tgWsProxyRunning ? 'dot-online' : 'dot-offline'}`;

    document.getElementById('diag-dc-grid').innerHTML = (report.dcResults || []).map(dc => {
        const c = getPingColorHex(dc.latencyMs, dc.ok);
        return `
        <div class="server-ping-card">
            <div class="text-xs font-bold text-zinc-400">${dc.title}</div>
            <div class="text-sm font-mono font-bold mt-1" style="color:${c}">${dc.pingText}</div>
        </div>`;
    }).join('');

    document.getElementById('diag-discord-grid').innerHTML = (report.discordPing || []).map(ds => {
        const c = getPingColorHex(ds.latencyMs, ds.ok);
        return `
        <div class="server-ping-card">
            <div class="text-xs font-bold text-zinc-400">${ds.title}</div>
            <div class="text-sm font-mono font-bold mt-1" style="color:${c}">${ds.pingText}</div>
        </div>`;
    }).join('');

    const recs = report.recommendations || [];
    document.getElementById('diag-recs-list').innerHTML = recs.length
        ? recs.map(r => `<div class="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/50"><span>💡</span><span class="whitespace-pre-line leading-relaxed">${r}</span></div>`).join('')
        : '<div class="text-emerald-400">Все сервисы работают стабильно, дополнительных действий не требуется!</div>';
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