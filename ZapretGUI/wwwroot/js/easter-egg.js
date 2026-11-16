// =========================================================================
// ПАСХАЛКА «ЗНАК» — Музыкальный плеер + синхронизированное лирическое шоу
// =========================================================================

// Таймлайн лирики: { time: секунда начала, text: строка, anim: тип анимации, duration: мс показа }
// ⚠ ЗАПОЛНИ РЕАЛЬНЫМИ СТРОЧКАМИ И ТАЙМИНГАМИ ПОД СВОЙ ФРАГМЕНТ ТРЕКА!
const EE_TIMELINE = [
    // --- Вступление (инструментал) ---
    { time: 0.0,  text: '',                         anim: 'waveform',     duration: 4000 },

    // --- Куплет / Припев — ЗАМЕНИ ТЕКСТ НА РЕАЛЬНЫЕ СТРОКИ ---
    { time: 4.0,  text: '[Строка 1]',               anim: 'fade',         duration: 3200 },
    { time: 7.5,  text: '[Строка 2]',               anim: 'typing',       duration: 3000 },
    { time: 11.0, text: '[Строка 3]',               anim: 'neon',         duration: 3200 },
    { time: 14.5, text: '[Строка 4]',               anim: 'glitch',       duration: 3000 },

    { time: 18.0, text: '[Строка 5]',               anim: 'phone',        duration: 3500 },
    { time: 22.0, text: '[Строка 6]',               anim: 'heartbeat',    duration: 3000 },
    { time: 25.5, text: '[Строка 7]',               anim: 'fade',         duration: 3200 },
    { time: 29.0, text: '[Строка 8]',               anim: 'neon',         duration: 3000 },

    // --- Припев ---
    { time: 32.5, text: '[Припев строка 1]',        anim: 'particles',    duration: 3500 },
    { time: 36.5, text: '[Припев строка 2]',        anim: 'glitch',       duration: 3000 },
    { time: 40.0, text: '[Припев строка 3]',        anim: 'neon',         duration: 3200 },
    { time: 43.5, text: '[Припев строка 4]',        anim: 'heartbeat',    duration: 3000 },

    { time: 47.0, text: '[Припев строка 5]',        anim: 'particles',    duration: 3500 },
    { time: 51.0, text: '[Припев строка 6]',        anim: 'smoke',        duration: 3000 },
    { time: 54.5, text: '[Припев строка 7]',        anim: 'fade',         duration: 3200 },
    { time: 58.0, text: '[Финальная строка]',       anim: 'shatter',      duration: 3500 },

    // --- Аутро ---
    { time: 62.0, text: '',                         anim: 'city',         duration: 4000 },
];

// Общая длительность отрывка (секунды) — подгони под свой фрагмент
const EE_TRACK_DURATION = 66;

let eeState = {
    active: false,
    playing: false,
    audio: null,
    animFrame: null,
    currentLineIdx: -1,
    activeElements: [],    // DOM элементы для cleanup
    bgCtx: null,
    bgCanvas: null,
};

// =========================================================================
// 1. ЗАПУСК / ЗАКРЫТИЕ
// =========================================================================

function launchEasterEgg() {
    if (eeState.active) return;
    eeState.active = true;

    // Создаём DOM
    injectEasterEggDOM();

    // Просим C# развернуть окно на весь экран и загрузить аудио
    sendCmd('easterEgg');
}

function onEasterEggReady(data) {
    const overlay = document.getElementById('ee-overlay');
    if (!overlay) return;

    if (!data.hasAudio) {
        // Нет MP3 файла — показываем сообщение
        showNoAudioMessage(data.error);
        overlay.classList.add('active');
        return;
    }

    // Создаём аудио из base64
    eeState.audio = new Audio('data:audio/mpeg;base64,' + data.audioBase64);
    eeState.audio.volume = 0.85;

    eeState.audio.addEventListener('ended', () => {
        closeEasterEgg();
    });

    eeState.audio.addEventListener('timeupdate', () => {
        updateProgress();
    });

    overlay.classList.add('active');
    initBgCanvas();
}

function closeEasterEgg() {
    const overlay = document.getElementById('ee-overlay');
    if (!overlay) return;

    if (eeState.audio) {
        eeState.audio.pause();
        eeState.audio.src = '';
        eeState.audio = null;
    }

    if (eeState.animFrame) {
        cancelAnimationFrame(eeState.animFrame);
        eeState.animFrame = null;
    }

    overlay.classList.add('ee-closing');

    // Просим C# вернуть окно к нормальному размеру
    sendCmd('easterEggClose');

    setTimeout(() => {
        overlay.remove();
        eeState.active = false;
        eeState.playing = false;
        eeState.currentLineIdx = -1;
        eeState.activeElements = [];
    }, 800);
}

// =========================================================================
// 2. DOM INJECTION
// =========================================================================

function injectEasterEggDOM() {
    // Удаляем старый если есть
    document.getElementById('ee-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ee-overlay';
    overlay.innerHTML = `
        <canvas id="ee-bg-canvas"></canvas>

        <div id="ee-player">
            <div class="ee-cover">
                <span class="ee-cover-icon mdl-icon">&#xE768;</span>
            </div>
            <div class="ee-track-info">
                <div class="ee-track-title">ЗНАК</div>
                <div class="ee-track-artist">Toxi$ & Дора</div>
            </div>
            <div class="ee-progress-wrap">
                <span class="ee-time" id="ee-time-cur">0:00</span>
                <div class="ee-progress-track" onclick="seekEE(event)">
                    <div class="ee-progress-fill" id="ee-progress-fill"></div>
                </div>
                <span class="ee-time" id="ee-time-dur">-:--</span>
            </div>
            <div class="ee-controls">
                <button class="ee-btn ee-btn-play" id="ee-btn-play" onclick="togglePlayEE()">
                    <span class="mdl-icon">&#xE768;</span>
                </button>
                <button class="ee-btn ee-btn-close" onclick="closeEasterEgg()" title="Закрыть">
                    <span class="mdl-icon" style="font-size:18px">&#xE711;</span>
                </button>
            </div>
        </div>

        <div id="ee-lyrics-stage"></div>
    `;

    document.body.appendChild(overlay);
}

function showNoAudioMessage(error) {
    const player = document.getElementById('ee-player');
    if (!player) return;
    player.innerHTML = `
        <div class="ee-no-audio">
            <div class="ee-no-audio-icon">🎵</div>
            <div class="ee-no-audio-title">Аудиофайл не найден</div>
            <div class="ee-no-audio-hint">
                Чтобы пасхалка заработала, положи MP3 файл песни рядом с приложением:
            </div>
            <div class="ee-no-audio-path">Assets/znak.mp3</div>
            <div style="margin-top: 24px">
                <button class="ee-btn ee-btn-close" onclick="closeEasterEgg()" style="font-size:13px; color:#888; border:1px solid #333; padding:8px 20px; border-radius:8px;">
                    Закрыть
                </button>
            </div>
        </div>
    `;
}

// =========================================================================
// 3. PLAYBACK CONTROLS
// =========================================================================

function togglePlayEE() {
    if (!eeState.audio) return;

    if (eeState.playing) {
        eeState.audio.pause();
        eeState.playing = false;
        updatePlayButton();
    } else {
        eeState.audio.play().then(() => {
            eeState.playing = true;
            updatePlayButton();
            minimizePlayer();
            startLyricsEngine();
        }).catch(err => {
            console.error('EE audio play error:', err);
        });
    }
}

function minimizePlayer() {
    const player = document.getElementById('ee-player');
    if (player) {
        player.classList.add('minimized');
    }
}

function updatePlayButton() {
    const btn = document.getElementById('ee-btn-play');
    if (btn) {
        // &#xE768; = Play, &#xE769; = Pause
        btn.innerHTML = `<span class="mdl-icon">${eeState.playing ? '&#xE769;' : '&#xE768;'}</span>`;
    }
}

function updateProgress() {
    if (!eeState.audio) return;

    const cur = eeState.audio.currentTime;
    const dur = eeState.audio.duration || EE_TRACK_DURATION;

    document.getElementById('ee-progress-fill').style.width = `${(cur / dur) * 100}%`;
    document.getElementById('ee-time-cur').textContent = formatTime(cur);
    document.getElementById('ee-time-dur').textContent = formatTime(dur);
}

function seekEE(e) {
    if (!eeState.audio) return;
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    eeState.audio.currentTime = pct * (eeState.audio.duration || EE_TRACK_DURATION);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// =========================================================================
// 4. LYRICS ENGINE — синхронизация текста и анимаций с аудио
// =========================================================================

function startLyricsEngine() {
    eeState.currentLineIdx = -1;
    tickLyrics();
}

function tickLyrics() {
    if (!eeState.active || !eeState.audio) return;

    const time = eeState.audio.currentTime;

    // Найти текущую строку
    let newIdx = -1;
    for (let i = EE_TIMELINE.length - 1; i >= 0; i--) {
        if (time >= EE_TIMELINE[i].time) {
            newIdx = i;
            break;
        }
    }

    if (newIdx !== eeState.currentLineIdx && newIdx >= 0) {
        eeState.currentLineIdx = newIdx;
        const entry = EE_TIMELINE[newIdx];
        transitionLyric(entry);
    }

    eeState.animFrame = requestAnimationFrame(tickLyrics);
}

function transitionLyric(entry) {
    const stage = document.getElementById('ee-lyrics-stage');
    if (!stage) return;

    // Убираем предыдущую строку
    const prevLines = stage.querySelectorAll('.ee-lyric-line');
    prevLines.forEach(el => {
        el.classList.remove('anim-fade-up');
        el.classList.add('anim-fade-out');
        setTimeout(() => el.remove(), 400);
    });

    // Очищаем предыдущие motion-элементы
    cleanupMotionElements();

    // Запускаем motion анимацию
    if (entry.anim) {
        playMotionAnimation(entry.anim, entry.duration || 3000);
    }

    // Показываем новую строку (если есть текст)
    if (entry.text) {
        setTimeout(() => {
            if (entry.anim === 'typing') {
                showTypingLyric(stage, entry.text);
            } else {
                showLyric(stage, entry.text);
            }
        }, 80);
    }
}

function showLyric(stage, text) {
    const el = document.createElement('div');
    el.className = 'ee-lyric-line anim-fade-up';
    el.textContent = text;
    stage.appendChild(el);
}

function showTypingLyric(stage, text) {
    const el = document.createElement('div');
    el.className = 'ee-lyric-line';
    el.style.opacity = '1';
    el.style.transform = 'none';
    stage.appendChild(el);

    const cursor = document.createElement('span');
    cursor.className = 'ee-typing-cursor';

    let i = 0;
    const interval = setInterval(() => {
        if (i < text.length) {
            el.textContent = text.substring(0, i + 1);
            el.appendChild(cursor);
            i++;
        } else {
            clearInterval(interval);
            setTimeout(() => cursor.remove(), 800);
        }
    }, 55);
}

// =========================================================================
// 5. MOTION ANIMATIONS CATALOG
// =========================================================================

function playMotionAnimation(type, duration) {
    const stage = document.getElementById('ee-lyrics-stage');
    const overlay = document.getElementById('ee-overlay');
    if (!stage || !overlay) return;

    switch (type) {
        case 'glitch':
            stage.classList.add('ee-anim-glitch');
            eeState.activeElements.push({ type: 'class', target: stage, cls: 'ee-anim-glitch' });
            setTimeout(() => stage.classList.remove('ee-anim-glitch'), duration);
            break;

        case 'neon':
            stage.classList.add('ee-anim-neon');
            eeState.activeElements.push({ type: 'class', target: stage, cls: 'ee-anim-neon' });
            setTimeout(() => stage.classList.remove('ee-anim-neon'), duration);
            break;

        case 'heartbeat':
            spawnHeartbeatRings(stage, 4, duration);
            break;

        case 'particles':
            spawnParticles(stage, 40);
            break;

        case 'phone':
            spawnPhoneMock(stage, duration);
            break;

        case 'waveform':
            spawnWaveform(stage, duration);
            break;

        case 'city':
            spawnBokeh(stage, 15, duration);
            break;

        case 'smoke':
            spawnSmoke(stage, 6, duration);
            break;

        case 'shatter':
            // Shatter будет применён к строке после её появления
            setTimeout(() => shatterCurrentLyric(stage), duration * 0.6);
            break;

        case 'typing':
        case 'fade':
        default:
            // Стандартный fade — без дополнительных эффектов
            break;
    }
}

function cleanupMotionElements() {
    const stage = document.getElementById('ee-lyrics-stage');

    // Убираем CSS-классы
    eeState.activeElements.forEach(item => {
        if (item.type === 'class' && item.target) {
            item.target.classList.remove(item.cls);
        }
    });
    eeState.activeElements = [];

    // Убираем motion DOM элементы
    if (stage) {
        stage.querySelectorAll('.ee-heartbeat-ring, .ee-particle, .ee-phone-mock, .ee-waveform-bar, .ee-bokeh-dot, .ee-smoke, .ee-shard').forEach(el => {
            el.classList.add('exit');
            setTimeout(() => el.remove(), 500);
        });
    }
}

// --- Heartbeat rings ---
function spawnHeartbeatRings(stage, count, duration) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const ring = document.createElement('div');
            ring.className = 'ee-heartbeat-ring';
            ring.style.left = '50%';
            ring.style.top = '50%';
            ring.style.transform = 'translate(-50%, -50%)';
            stage.appendChild(ring);
            setTimeout(() => ring.remove(), 1300);
        }, i * (duration / count));
    }
}

// --- Particles ---
function spawnParticles(stage, count) {
    const cx = stage.clientWidth / 2;
    const cy = stage.clientHeight / 2;

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'ee-particle';

        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const dist = 100 + Math.random() * 250;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        const dur = 0.6 + Math.random() * 0.8;

        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.setProperty('--tx', tx + 'px');
        p.style.setProperty('--ty', ty + 'px');
        p.style.setProperty('--dur', dur + 's');
        p.style.width = (2 + Math.random() * 4) + 'px';
        p.style.height = p.style.width;
        p.style.background = `hsl(${345 + Math.random() * 30}, ${70 + Math.random() * 30}%, ${55 + Math.random() * 20}%)`;

        stage.appendChild(p);
        setTimeout(() => p.remove(), dur * 1000 + 100);
    }
}

// --- Phone notification mockup ---
function spawnPhoneMock(stage, duration) {
    const phone = document.createElement('div');
    phone.className = 'ee-phone-mock';
    phone.style.right = '10%';
    phone.style.top = '20%';
    phone.innerHTML = `
        <div class="ee-phone-notch"></div>
        <div class="ee-phone-notification">
            <div class="ee-phone-notif-icon">
                <span class="mdl-icon">&#xE8BD;</span>
            </div>
            <div class="ee-phone-notif-text">
                <div class="ee-phone-notif-title">Новое сообщение</div>
                <div class="ee-phone-notif-body">Ты — мой знак...</div>
            </div>
        </div>
    `;
    stage.appendChild(phone);

    setTimeout(() => {
        phone.classList.add('exit');
        setTimeout(() => phone.remove(), 500);
    }, duration * 0.75);
}

// --- Waveform ---
function spawnWaveform(stage, duration) {
    const barCount = 48;
    const cx = stage.clientWidth / 2;
    const totalWidth = barCount * 8;
    const startX = cx - totalWidth / 2;

    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'ee-waveform-bar';
        bar.style.left = (startX + i * 8) + 'px';

        const h = 0.3 + Math.random() * 0.7;
        const d = 0.2 + Math.random() * 0.4;
        bar.style.setProperty('--h', h);
        bar.style.setProperty('--dur', d + 's');
        bar.style.height = '80px';

        stage.appendChild(bar);
    }

    setTimeout(() => {
        stage.querySelectorAll('.ee-waveform-bar').forEach(el => {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.5s';
            setTimeout(() => el.remove(), 600);
        });
    }, duration * 0.8);
}

// --- Bokeh city lights ---
function spawnBokeh(stage, count, duration) {
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.className = 'ee-bokeh-dot';

        const size = 20 + Math.random() * 60;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dot.style.left = (Math.random() * 100) + '%';
        dot.style.top = (40 + Math.random() * 50) + '%';

        const colors = ['rgba(233,69,96,0.25)', 'rgba(0,212,255,0.2)', 'rgba(255,200,87,0.2)', 'rgba(124,58,237,0.2)'];
        dot.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
        dot.style.setProperty('--blur', (6 + Math.random() * 12) + 'px');
        dot.style.setProperty('--dur', (4 + Math.random() * 4) + 's');
        dot.style.setProperty('--dx', (-20 + Math.random() * 40) + 'px');
        dot.style.setProperty('--dy', (-10 + Math.random() * 20) + 'px');
        dot.style.setProperty('--s', (0.8 + Math.random() * 0.5).toFixed(2));
        dot.style.setProperty('--o1', (0.2 + Math.random() * 0.3).toFixed(2));
        dot.style.setProperty('--o2', (0.4 + Math.random() * 0.4).toFixed(2));

        stage.appendChild(dot);
    }

    setTimeout(() => {
        stage.querySelectorAll('.ee-bokeh-dot').forEach(el => {
            el.style.opacity = '0';
            el.style.transition = 'opacity 1s';
            setTimeout(() => el.remove(), 1100);
        });
    }, duration * 0.85);
}

// --- Smoke ---
function spawnSmoke(stage, count, duration) {
    const cx = stage.clientWidth / 2;
    const cy = stage.clientHeight * 0.7;

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const s = document.createElement('div');
            s.className = 'ee-smoke';

            const size = 60 + Math.random() * 80;
            s.style.setProperty('--size', size + 'px');
            s.style.setProperty('--dur', (3 + Math.random() * 3) + 's');
            s.style.setProperty('--dx', (-40 + Math.random() * 80) + 'px');
            s.style.left = (cx - size / 2 + (Math.random() - 0.5) * 200) + 'px';
            s.style.top = cy + 'px';

            stage.appendChild(s);
            setTimeout(() => s.remove(), 6000);
        }, i * (duration / count) * 0.6);
    }
}

// --- Shatter current lyric line ---
function shatterCurrentLyric(stage) {
    const line = stage.querySelector('.ee-lyric-line');
    if (!line) return;

    const text = line.textContent;
    const rect = line.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();

    line.style.visibility = 'hidden';

    // Создаём осколки из каждого символа
    const chars = text.split('');
    chars.forEach((char, i) => {
        if (char === ' ') return;

        const shard = document.createElement('span');
        shard.className = 'ee-shard';
        shard.textContent = char;
        shard.style.fontSize = '42px';
        shard.style.fontWeight = '800';
        shard.style.color = '#FFF';
        shard.style.position = 'absolute';

        // Примерная позиция символа
        const charX = rect.left - stageRect.left + (i / chars.length) * rect.width;
        const charY = rect.top - stageRect.top;
        shard.style.left = charX + 'px';
        shard.style.top = charY + 'px';

        const angle = (Math.random() - 0.5) * Math.PI;
        const dist = 80 + Math.random() * 200;
        shard.style.setProperty('--tx', (Math.cos(angle) * dist) + 'px');
        shard.style.setProperty('--ty', (Math.sin(angle) * dist - 50) + 'px');
        shard.style.setProperty('--rot', (-30 + Math.random() * 60) + 'deg');
        shard.style.setProperty('--dur', (0.5 + Math.random() * 0.4) + 's');

        stage.appendChild(shard);
        setTimeout(() => shard.remove(), 1000);
    });
}

// =========================================================================
// 6. BACKGROUND CANVAS — ambient particle field
// =========================================================================

function initBgCanvas() {
    const canvas = document.getElementById('ee-bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    eeState.bgCanvas = canvas;
    eeState.bgCtx = ctx;

    function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const dots = [];
    const dotCount = 60;
    for (let i = 0; i < dotCount; i++) {
        dots.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: 1 + Math.random() * 1.5,
            a: 0.1 + Math.random() * 0.2,
        });
    }

    function draw() {
        if (!eeState.active) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Subtle gradient background
        const grad = ctx.createRadialGradient(
            canvas.width * 0.5, canvas.height * 0.4, 0,
            canvas.width * 0.5, canvas.height * 0.4, canvas.width * 0.6
        );
        grad.addColorStop(0, 'rgba(233, 69, 96, 0.04)');
        grad.addColorStop(0.5, 'rgba(15, 52, 96, 0.03)');
        grad.addColorStop(1, 'rgba(10, 10, 10, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw & connect dots
        dots.forEach(d => {
            d.x += d.vx;
            d.y += d.vy;

            if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
            if (d.y < 0 || d.y > canvas.height) d.vy *= -1;

            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(233, 69, 96, ${d.a})`;
            ctx.fill();
        });

        // Lines between close dots
        for (let i = 0; i < dots.length; i++) {
            for (let j = i + 1; j < dots.length; j++) {
                const dx = dots[i].x - dots[j].x;
                const dy = dots[i].y - dots[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(dots[i].x, dots[i].y);
                    ctx.lineTo(dots[j].x, dots[j].y);
                    ctx.strokeStyle = `rgba(233, 69, 96, ${0.06 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    }

    draw();
}

// =========================================================================
// 7. ИНТЕГРАЦИЯ С handleBackendEvent
// =========================================================================

// Этот блок вызывается из app.js handleBackendEvent
// Добавь в switch: case 'easterEggReady': onEasterEggReady(data); break;
