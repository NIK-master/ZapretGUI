// =========================================================================
// ИНТЕРАКТИВНЫЙ РАДАР И ГРАФ СЕТИ (NODE GRAPH RADAR) ДЛЯ ДИАГНОСТИКИ
// =========================================================================
let diagViewMode = 'radar';
let diagRadarAnimId = null;
let diagRadarAngle = 0;
let diagRadarNodes = [];
let diagHoveredNode = null;
let diagRadarLastTime = 0;

function initDiagnosticsRadarView() {
    const dcGrid = document.getElementById('diag-dc-grid');
    if (!dcGrid) return;
    const matrixCard = dcGrid.closest('.glass-card');
    if (!matrixCard || document.getElementById('diag-radar-wrap')) return;

    const headerBar = document.createElement('div');
    headerBar.className = 'flex items-center justify-between pb-3 mb-3 border-b border-[#242424]';
    headerBar.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full dot-online"></span>
            <span class="text-xs font-bold text-white uppercase tracking-wider">Топология маршрутов: Telegram DC & Discord</span>
        </div>
        <div class="flex items-center gap-2">
            <div class="flex items-center bg-[#101010] border border-[#2A2A2A] rounded-lg p-0.5 text-[11px] font-semibold">
                <button id="btn-diag-view-radar" onclick="setDiagViewMode('radar')" class="px-2.5 py-1 rounded-md bg-[#262626] text-white transition cursor-pointer">🎯 Радар узлов</button>
                <button id="btn-diag-view-table" onclick="setDiagViewMode('table')" class="px-2.5 py-1 rounded-md text-[#888888] hover:text-white transition cursor-pointer">📋 Таблица</button>
            </div>
        </div>
    `;

    const radarWrap = document.createElement('div');
    radarWrap.id = 'diag-radar-wrap';
    radarWrap.className = 'relative w-full h-[300px] rounded-xl bg-[#08080A] border border-[#222226] overflow-hidden flex items-center justify-center';
    radarWrap.innerHTML = `
        <canvas id="diag-radar-canvas" width="760" height="300" class="w-full h-full cursor-crosshair"></canvas>
        <div class="absolute top-2.5 left-3 pointer-events-none flex items-center gap-3 text-[11px] font-mono text-[#888888]">
            <span class="flex items-center gap-1.5"><i class="w-2 h-2 rounded-full bg-[#4CAF50] inline-block"></i>Маршрут пробит</span>
            <span class="flex items-center gap-1.5"><i class="w-2 h-2 rounded-full bg-[#F59E0B] inline-block"></i>Частично / Пинг</span>
            <span class="flex items-center gap-1.5"><i class="w-2 h-2 rounded-full bg-[#D13438] inline-block"></i>Потеря пакетов</span>
        </div>
        <div id="diag-radar-tooltip" class="hidden absolute pointer-events-none bg-[#121216]/95 border border-[#33333A] rounded-lg px-3 py-2 text-xs font-mono text-white shadow-2xl z-20"></div>
    `;

    const tablesContainer = document.createElement('div');
    tablesContainer.id = 'diag-tables-wrap';
    tablesContainer.className = 'space-y-4 hidden';
    while (matrixCard.firstChild) {
        tablesContainer.appendChild(matrixCard.firstChild);
    }

    matrixCard.appendChild(headerBar);
    matrixCard.appendChild(radarWrap);
    matrixCard.appendChild(tablesContainer);

    const canvas = document.getElementById('diag-radar-canvas');
    if (canvas) {
        canvas.addEventListener('mousemove', onDiagRadarMouseMove);
        canvas.addEventListener('mouseleave', () => {
            diagHoveredNode = null;
            document.getElementById('diag-radar-tooltip')?.classList.add('hidden');
        });
    }

    buildDefaultRadarNodes();
    startDiagRadarLoop();
}

function setDiagViewMode(mode) {
    diagViewMode = mode;
    const radarWrap = document.getElementById('diag-radar-wrap');
    const tablesWrap = document.getElementById('diag-tables-wrap');
    const btnRadar = document.getElementById('btn-diag-view-radar');
    const btnTable = document.getElementById('btn-diag-view-table');

    if (mode === 'radar') {
        radarWrap?.classList.remove('hidden');
        tablesWrap?.classList.add('hidden');
        if (btnRadar) btnRadar.className = 'px-2.5 py-1 rounded-md bg-[#262626] text-white transition cursor-pointer';
        if (btnTable) btnTable.className = 'px-2.5 py-1 rounded-md text-[#888888] hover:text-white transition cursor-pointer';
    } else {
        radarWrap?.classList.add('hidden');
        tablesWrap?.classList.remove('hidden');
        if (btnRadar) btnRadar.className = 'px-2.5 py-1 rounded-md text-[#888888] hover:text-white transition cursor-pointer';
        if (btnTable) btnTable.className = 'px-2.5 py-1 rounded-md bg-[#262626] text-white transition cursor-pointer';
    }
}

function buildDefaultRadarNodes() {
    diagRadarNodes = [
        { id: 'dc1', label: 'TG DC 1', sub: '149.154.175.50 (US)', angle: -2.45, radius: 0.78, status: 'idle', ping: null, details: 'Ожидание сканирования...' },
        { id: 'dc2', label: 'TG DC 2', sub: '149.154.167.51 (NL)', angle: -1.80, radius: 0.62, status: 'idle', ping: null, details: 'Ожидание сканирования...' },
        { id: 'dc3', label: 'TG DC 3', sub: '149.154.175.100 (US)', angle: -1.15, radius: 0.80, status: 'idle', ping: null, details: 'Ожидание сканирования...' },
        { id: 'dc4', label: 'TG DC 4', sub: '149.154.167.91 (NL)', angle: -0.50, radius: 0.64, status: 'idle', ping: null, details: 'Ожидание сканирования...' },
        { id: 'dc5', label: 'TG DC 5', sub: '91.108.56.130 (SG)', angle: 0.25, radius: 0.82, status: 'idle', ping: null, details: 'Ожидание сканирования...' },
        { id: 'ds_gw', label: 'Discord GW', sub: '162.159.130.234 :443', angle: 1.05, radius: 0.66, status: 'idle', ping: null, details: 'Gateway TCP :443' },
        { id: 'ds_med', label: 'Discord Media', sub: '162.159.129.235 :443', angle: 1.75, radius: 0.76, status: 'idle', ping: null, details: 'Media TCP :443' },
        { id: 'ds_api', label: 'Discord API', sub: '162.159.128.233 :443', angle: 2.40, radius: 0.62, status: 'idle', ping: null, details: 'API TCP :443' },
        { id: 'ds_udp', label: 'Voice UDP', sub: 'Ports 50000–50010', angle: 3.05, radius: 0.82, status: 'idle', ping: null, details: 'Голосовой шлюз UDP' }
    ];
}

function updateRadarNodesFromReport(report) {
    if (!report) return;
    if (!diagRadarNodes.length) buildDefaultRadarNodes();

    for (let dcId = 1; dcId <= 5; dcId++) {
        const node = diagRadarNodes.find(n => n.id === 'dc' + dcId);
        if (!node) continue;

        const ports = (report.dcResults || []).filter(r => r.dcId === dcId);
        const okPorts = ports.filter(p => p.ok);

        if (ports.length === 0) node.status = 'idle';
        else if (okPorts.length === ports.length) node.status = 'ok';
        else if (okPorts.length > 0) node.status = 'warn';
        else node.status = 'fail';

        const lats = okPorts.filter(p => p.latencyMs != null).map(p => p.latencyMs);
        node.ping = lats.length > 0 ? Math.round(Math.min(...lats)) : null;
        node.details = ports.map(p => `:${p.port} → ${p.ok ? Math.round(p.latencyMs) + ' мс ✓' : 'Блок ✕'}`).join('\n');
    }

    const dsMap = { 'Gateway': 'ds_gw', 'Media': 'ds_med', 'API': 'ds_api' };
    (report.discordPing || []).forEach(d => {
        const node = diagRadarNodes.find(n => n.id === dsMap[d.label]);
        if (node) {
            node.status = d.ok ? (d.latencyMs > 180 ? 'warn' : 'ok') : 'fail';
            node.ping = d.ok && d.latencyMs != null ? Math.round(d.latencyMs) : null;
            node.details = `${d.ip}:443\nСтатус: ${d.ok ? node.ping + ' мс ✓' : 'Недоступен ✕'}`;
        }
    });

    const udpNode = diagRadarNodes.find(n => n.id === 'ds_udp');
    if (udpNode && report.udpResult) {
        const openCount = (report.udpResult.openPorts || []).length;
        const totalCount = (report.udpResult.testedPorts || []).length || 5;
        udpNode.status = !report.udpResult.blocked ? 'ok' : (report.appStatus?.zapretRunning ? 'warn' : 'fail');
        udpNode.ping = null;
        udpNode.details = `Открыто UDP: ${openCount}/${totalCount}\n${!report.udpResult.blocked ? 'Голос доступен ✓' : (report.appStatus?.zapretRunning ? 'Обход через Zapret ✓' : 'UDP заблокирован ✕')}`;
    }
}

function onDiagRadarMouseMove(e) {
    const canvas = document.getElementById('diag-radar-canvas');
    const tooltip = document.getElementById('diag-radar-tooltip');
    if (!canvas || !tooltip) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = null;
    for (const n of diagRadarNodes) {
        if (n._px != null && Math.hypot(mx - n._px, my - n._py) < 22) {
            found = n;
            break;
        }
    }

    diagHoveredNode = found;
    if (found) {
        tooltip.classList.remove('hidden');
        tooltip.innerHTML = `
            <div class="font-bold text-brand mb-0.5">${found.label}</div>
            <div class="text-[10px] text-[#888888] mb-1">${found.sub}</div>
            <div class="whitespace-pre-line text-[11px] text-[#E0E0E0]">${found.details}</div>
        `;
        const leftPx = Math.min(rect.width - 185, Math.max(8, mx + 14));
        const topPx = Math.min(rect.height - 95, Math.max(8, my - 10));
        tooltip.style.left = `${leftPx}px`;
        tooltip.style.top = `${topPx}px`;
    } else {
        tooltip.classList.add('hidden');
    }
}

function startDiagRadarLoop() {
    if (diagRadarAnimId) return;
    diagRadarLastTime = performance.now();

    function frame(now) {
        const dt = Math.min(0.05, Math.max(0.001, (now - diagRadarLastTime) / 1000));
        diagRadarLastTime = now;
        try { drawDiagRadarFrame(dt, now); } catch (e) { }
        diagRadarAnimId = requestAnimationFrame(frame);
    }
    diagRadarAnimId = requestAnimationFrame(frame);
}

function drawDiagRadarFrame(dt = 0.016, now = performance.now()) {
    const canvas = document.getElementById('diag-radar-canvas');
    if (!canvas || canvas.offsetParent === null) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 20 || h < 20) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cx = Math.floor(w / 2) + 0.5;
    const cy = Math.floor(h / 2 + 6) + 0.5;
    const maxR = Math.min(w * 0.42, h * 0.43);

    const accentHex = getComputedStyle(document.body).getPropertyValue('--accent-light').trim() || '#4CAF50';
    const isScanningNow = !document.getElementById('diag-progress-wrap')?.classList.contains('hidden');

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 1;
    [0.35, 0.65, 0.95].forEach(rMult => {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.round(maxR * rMult), 0, Math.PI * 2);
        ctx.stroke();
    });

    ctx.beginPath();
    ctx.moveTo(cx - maxR * 1.15, cy);
    ctx.lineTo(cx + maxR * 1.15, cy);
    ctx.moveTo(cx, cy - maxR * 0.98);
    ctx.lineTo(cx, cy + maxR * 0.98);
    ctx.stroke();

    const angularSpeed = isScanningNow ? 1.35 : 0.42;
    diagRadarAngle = (diagRadarAngle + angularSpeed * dt) % (Math.PI * 2);

    const sweepArc = 0.52;
    const slices = 6;
    ctx.save();
    for (let s = 0; s < slices; s++) {
        const a0 = diagRadarAngle - sweepArc + (s / slices) * sweepArc;
        const a1 = diagRadarAngle - sweepArc + ((s + 1) / slices) * sweepArc + 0.005;
        const alphaHex = isScanningNow
            ? Math.round(((s + 1) / slices) * 36).toString(16).padStart(2, '0')
            : Math.round(((s + 1) / slices) * 16).toString(16).padStart(2, '0');

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR * 0.98, a0, a1);
        ctx.closePath();
        ctx.fillStyle = accentHex.startsWith('#') ? (accentHex + alphaHex) : `rgba(76, 175, 80, ${isScanningNow ? 0.12 : 0.05})`;
        ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(diagRadarAngle) * maxR * 0.98, cy + Math.sin(diagRadarAngle) * maxR * 0.98);
    ctx.strokeStyle = accentHex.startsWith('#') ? (accentHex + '66') : 'rgba(76, 175, 80, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    const pulseTime = now * 0.00028;

    diagRadarNodes.forEach((node, idx) => {
        const nx = cx + Math.cos(node.angle) * (maxR * 1.75 * node.radius);
        const ny = cy + Math.sin(node.angle) * (maxR * 0.92 * node.radius);
        node._px = nx;
        node._py = ny;

        let col = '#44444A';
        if (node.status === 'ok') col = accentHex;
        else if (node.status === 'warn') col = '#F59E0B';
        else if (node.status === 'fail') col = '#D13438';
        else if (isScanningNow) col = '#3B82F6';

        ctx.save();
        ctx.beginPath();
        if (node.status === 'fail') {
            ctx.setLineDash([4, 5]);
            ctx.strokeStyle = 'rgba(209, 52, 56, 0.35)';
        } else if (node.status === 'ok' || node.status === 'warn') {
            ctx.strokeStyle = col + '55';
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        }
        ctx.lineWidth = diagHoveredNode === node ? 2.0 : 1.2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.restore();

        if (node.status === 'ok' || node.status === 'warn' || isScanningNow) {
            const p = (pulseTime + idx * 0.19) % 1;
            const px = cx + (nx - cx) * p;
            const py = cy + (ny - cy) * p;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(px, py, 2.3, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.fillStyle = '#141418';
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px "Segoe UI", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU', cx, cy + 0.5);

    diagRadarNodes.forEach(node => {
        const nx = node._px;
        const ny = node._py;
        const isHov = diagHoveredNode === node;

        let col = '#52525B';
        let glow = 'transparent';
        if (node.status === 'ok') { col = accentHex; glow = accentHex + '44'; }
        else if (node.status === 'warn') { col = '#F59E0B'; glow = 'rgba(245, 158, 11, 0.30)'; }
        else if (node.status === 'fail') { col = '#D13438'; glow = 'rgba(209, 52, 56, 0.25)'; }
        else if (isScanningNow) { col = '#60A5FA'; glow = 'rgba(96, 165, 250, 0.28)'; }

        if (node.status === 'ok' || isHov) {
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(nx, ny, isHov ? 18 : 14, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#121216';
        ctx.strokeStyle = col;
        ctx.lineWidth = isHov ? 2.2 : 1.6;
        ctx.beginPath();
        ctx.arc(nx, ny, isHov ? 10.5 : 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(nx, ny, node.status === 'fail' ? 2.5 : 3.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = node.status === 'fail' ? '#999999' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, nx, ny - 16);

        if (node.ping != null) {
            ctx.font = '600 10px Consolas, monospace';
            ctx.fillStyle = col;
            ctx.fillText(`${node.ping} мс`, nx, ny + 18);
        } else if (node.status === 'fail') {
            ctx.font = '600 9.5px Consolas, monospace';
            ctx.fillStyle = '#F87171';
            ctx.fillText('LOSS', nx, ny + 18);
        }
    });

    ctx.restore();
}