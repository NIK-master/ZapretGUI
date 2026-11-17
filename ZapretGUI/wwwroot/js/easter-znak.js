// =========================================================================
// ПАСХАЛКА: TOXI$ & ДОРА — ЗНАК (PRO ENGINE WITH CINEMATIC REWIND)
// Файл: wwwroot/js/easter-znak.js
// =========================================================================

let znakRafId = null;
let znakActiveLineIdx = -1;
let znakActiveWordIdx = -1;
let znakIsPlaying = false;
let isRewinding = false;

let znakAudioCtx = null;
let znakAnalyser = null;
let znakFreqData = null;

// Вспомогательные функции безопасного обновления DOM
function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
}

function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// Карта нейросети WhisperX со всеми триггерами
const ZNAK_TIMELINE = [
    {
        time: 8.89, endTime: 17.24, sub: "INTRO • TOXI$", widget: null,
        words: [
            { word: "У-у-у-у,", time: 9.67 },
            { word: "у-у-у,", time: 11.73 },
            { word: "у-у-у", time: 13.14 }
        ]
    },
    {
        time: 17.24, endTime: 21.55, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-stage-pass",
        words: [
            { word: "Выхожу", time: 17.36, trigger: "stage_enter" },
            { word: "на", time: 18.24 },
            { word: "сцену,", time: 18.40 },
            { word: "вижу", time: 19.67 },
            { word: "своих", time: 20.13 },
            { word: "фэнов", time: 20.71, trigger: "stage_fans" }
        ]
    },
    {
        time: 21.55, endTime: 25.96, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-altgirl-chat",
        words: [
            { word: "Неформалка", time: 21.79, trigger: "chat_m1" },
            { word: "лезет,", time: 22.89 },
            { word: "она", time: 23.51 },
            { word: "думает", time: 24.00 },
            { word: "я", time: 24.86 },
            { word: "эмо", time: 25.16, trigger: "chat_emo" }
        ]
    },
    {
        time: 25.96, endTime: 29.95, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-altgirl-chat",
        words: [
            { word: "Не", time: 25.96 },
            { word: "знаю,", time: 26.10 },
            { word: "что", time: 26.62 },
            { word: "ответить,", time: 27.10 },
            { word: "точно", time: 27.82 },
            { word: "знаю,", time: 28.31 },
            { word: "что", time: 28.83 },
            { word: "я", time: 29.21 },
            { word: "лега", time: 29.47, trigger: "chat_m2" }
        ]
    },
    {
        time: 29.95, endTime: 34.22, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-altgirl-chat",
        words: [
            { word: "Но", time: 30.09 },
            { word: "я", time: 30.27 },
            { word: "с", time: 30.45 },
            { word: "ней", time: 30.51 },
            { word: "не", time: 30.79 },
            { word: "проведу", time: 31.07 },
            { word: "эту", time: 32.17 },
            { word: "ночь", time: 32.40, trigger: "chat_m3" }
        ]
    },
    {
        time: 34.22, endTime: 37.68, sub: "ПРИПЕВ • TOXI$", widget: "zui-parallel-search",
        words: [
            { word: "Ведь", time: 34.24, trigger: "para_start" },
            { word: "я", time: 34.44 },
            { word: "уверен,", time: 34.76 },
            { word: "что", time: 35.67 },
            { word: "где-то", time: 35.91 },
            { word: "в", time: 36.51 },
            { word: "параллели", time: 36.55, trigger: "para_lock" }
        ]
    },
    {
        time: 37.68, endTime: 42.07, sub: "ПРИПЕВ • TOXI$", widget: "zui-map-tracker",
        words: [
            { word: "Найду", time: 37.90, trigger: "map_scan" },
            { word: "тебя", time: 38.42 },
            { word: "дуру", time: 39.22 },
            { word: "и", time: 39.90 },
            { word: "у", time: 40.15 },
            { word: "нас", time: 40.33 },
            { word: "будет", time: 40.61 },
            { word: "LOVE", time: 41.45, trigger: "map_target" }
        ]
    },
    {
        time: 42.07, endTime: 46.41, sub: "ПРИПЕВ • TOXI$", widget: "zui-heart-ecg",
        words: [
            { word: "Тобою", time: 42.25 },
            { word: "болею,", time: 43.06, trigger: "ecg_sick" },
            { word: "всем", time: 44.40 },
            { word: "сердцем", time: 44.68, trigger: "ecg_max" },
            { word: "болею", time: 45.28 }
        ]
    },
    {
        time: 46.41, endTime: 50.90, sub: "ПРИПЕВ • TOXI$", widget: "zui-marriage-modal",
        words: [
            { word: "И", time: 46.73 },
            { word: "я", time: 46.97 },
            { word: "надеюсь,", time: 47.21 },
            { word: "то", time: 47.95 },
            { word: "что", time: 48.17 },
            { word: "у", time: 48.60 },
            { word: "нас", time: 48.84 },
            { word: "будет", time: 49.08 },
            { word: "с", time: 49.56 },
            { word: "тобой", time: 49.64 },
            { word: "брак", time: 50.18, trigger: "marry_stamp" }
        ]
    },
    {
        time: 50.90, endTime: 54.20, sub: "SIGNAL 1", widget: "zui-kitty-sign",
        words: [
            { word: "Киса,", time: 51.00 },
            { word: "подай", time: 51.52 },
            { word: "мне", time: 52.04 },
            { word: "знак", time: 52.28, trigger: "sign_1" }
        ]
    },
    {
        time: 54.20, endTime: 59.50, sub: "SIGNAL 2 (NEON)", widget: "zui-neon-sign",
        words: [
            { word: "А-а-а...", time: 54.30 },
            { word: "У-у...", time: 57.10, trigger: "sign_2" }
        ]
    },
    {
        time: 59.50, endTime: 64.50, sub: "SIGNAL 3 (SECURED)", widget: "zui-warning-sign",
        words: [
            { word: "Киса,", time: 59.70 },
            { word: "подай", time: 60.26 },
            { word: "мне", time: 60.76 },
            { word: "знак", time: 61.01, trigger: "sign_3" }
        ]
    }
];

const ZNAK_CLIP_END_SEC = 64.5;

function updateZnakResponsiveScale() {
    const overlay = document.getElementById('znak-easter-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    const scale = Math.max(0.72, Math.min(1.35, Math.min(window.innerWidth / 1280, window.innerHeight / 780)));
    overlay.style.setProperty('--znak-stage-scale', scale.toFixed(3));
}
window.addEventListener('resize', updateZnakResponsiveScale);

function launchZnakEasterEgg() {
    const overlay = document.getElementById('znak-easter-overlay');
    if (!overlay) return;
    sendCmd('playSuccess');
    sendCmd('setEasterFullscreen', { enable: true });
    if (typeof setZappyMascotVisibility === 'function') setZappyMascotVisibility(false);

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    updateZnakResponsiveScale();
    resetZnakStageToInitial();
}

function closeZnakEasterEgg() {
    stopZnakPlayback();
    isRewinding = false;
    const overlay = document.getElementById('znak-easter-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
    sendCmd('setEasterFullscreen', { enable: false });
    if (typeof setZappyMascotVisibility === 'function') setZappyMascotVisibility(true);
}

function resetAllWidgetStates() {
    // Сцена 1: Stage Pass
    setText('zui-stage-loc', 'Выход к микрофону...');
    setText('zui-stage-fans', 'Ожидание');
    setText('zui-stage-badge', 'BACKSTAGE');
    const stageBadge = document.getElementById('zui-stage-badge');
    if (stageBadge) stageBadge.className = 'px-2 py-0.5 rounded bg-[#1A1A1A] border border-[#333] text-[#AAAAAA] text-[9px] font-mono font-bold transition-all';

    // Сцена 2: Мессенджер
    document.querySelectorAll('.chat-bubble').forEach(e => e.classList.remove('chat-reveal'));
    setHtml('zui-chat-status', '<span class="animate-pulse">печатает...</span>');
    const chatRank = document.getElementById('zui-chat-rank');
    if (chatRank) {
        chatRank.className = 'px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#1E1E1E] border border-[#333333] text-[#999999] transition-all';
        chatRank.innerText = 'USER';
    }

    // Сцена 3: Параллели
    const planes = document.getElementById('zui-3d-planes');
    if (planes) {
        planes.classList.remove('plane-anim-run', 'plane-anim-locked');
        planes.classList.add('idle-float');
    }
    setText('zui-para-node', 'SCANNING...');

    // Сцена 4: Радар
    const mapSweep = document.getElementById('zui-map-sweep');
    if (mapSweep) mapSweep.style.opacity = '0';
    document.getElementById('zui-map-target')?.classList.remove('opacity-100');

    // Сцена 5: ЭКГ
    document.getElementById('zui-heart-panel')?.classList.remove('heart-overload');
    const ecgLine = document.getElementById('zui-ecg-line');
    if (ecgLine) ecgLine.style.stroke = 'var(--accent-light)';
    setHtml('zui-ecg-bpm', '<span class="mdl-icon text-[10px] animate-pulse">&#xE00B;</span> 110 BPM');
    setText('zui-ecg-status', 'Синдром: Ожидание');

    // Сцена 6: Брак
    document.getElementById('zui-marry-stamp')?.classList.remove('stamp-drop');

    // Сцены 7-8: Знаки
    const beacon = document.getElementById('zui-sign-beacon');
    if (beacon) {
        beacon.style.background = '';
        beacon.style.boxShadow = '';
    }
    setText('zui-sign-title', 'ОЖИДАНИЕ СИГНАЛА...');

    const neonText = document.getElementById('zui-neon-text');
    if (neonText) {
        neonText.style.color = '#222';
        neonText.style.textShadow = 'none';
    }
}

function resetZnakStageToInitial() {
    stopZnakPlayback();
    znakActiveLineIdx = -1;
    znakActiveWordIdx = -1;
    isRewinding = false;

    const playerCard = document.getElementById('znak-player-card');
    const motionStage = document.getElementById('znak-motion-stage');
    const mainLyric = document.getElementById('znak-lyric-main');
    const subLyric = document.getElementById('znak-lyric-sub');
    const progFill = document.getElementById('znak-progress-fill');

    if (playerCard) {
        playerCard.classList.remove('znak-player-mini');
        playerCard.classList.add('znak-player-center');
    }
    if (motionStage) motionStage.style.opacity = '0';
    if (mainLyric) mainLyric.innerHTML = '<span class="znak-word revealed">Нажми</span> <span class="znak-word active">Play</span> <span class="znak-word">для</span> <span class="znak-word">старта</span>';
    if (subLyric) subLyric.innerText = '';

    if (progFill) {
        progFill.style.transition = 'none';
        progFill.style.width = '0%';
        void progFill.offsetWidth;
        progFill.style.transition = 'width 0.1s linear';
    }
    setText('znak-time-code', '00:00');

    showZnakWidget(null);
    resetAllWidgetStates();
}

function toggleZnakPlay() {
    if (isRewinding) return;
    const audio = document.getElementById('znak-audio');
    const playIcon = document.getElementById('znak-play-icon');
    const playerCard = document.getElementById('znak-player-card');
    const motionStage = document.getElementById('znak-motion-stage');

    if (znakIsPlaying) {
        znakIsPlaying = false;
        if (audio) audio.pause();
        if (playIcon) playIcon.innerHTML = '&#xE768;';
        if (znakRafId) cancelAnimationFrame(znakRafId);
        return;
    }

    if (playerCard) {
        playerCard.classList.remove('znak-player-center');
        playerCard.classList.add('znak-player-mini');
    }
    if (motionStage) motionStage.style.opacity = '1';

    znakIsPlaying = true;
    if (playIcon) playIcon.innerHTML = '&#xE769;';

    if (audio) {
        initZnakWebAudioAnalyser();
        if (znakAudioCtx && znakAudioCtx.state === 'suspended') znakAudioCtx.resume().catch(() => { });
        audio.play().then(() => startZnakSyncLoop()).catch(() => { });
    }
}

function initZnakWebAudioAnalyser() {
    const audio = document.getElementById('znak-audio');
    if (!audio || znakAudioCtx) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        znakAudioCtx = new AudioContextClass();
        const src = znakAudioCtx.createMediaElementSource(audio);
        znakAnalyser = znakAudioCtx.createAnalyser();
        znakAnalyser.fftSize = 64;
        src.connect(znakAnalyser);
        znakAnalyser.connect(znakAudioCtx.destination);
        znakFreqData = new Uint8Array(znakAnalyser.frequencyBinCount);
    } catch { }
}

function restartZnakAudio() {
    if (isRewinding) return;
    const audio = document.getElementById('znak-audio');
    if (audio) audio.currentTime = 0;
    resetZnakStageToInitial();
    if (!znakIsPlaying) toggleZnakPlay();
}

function stopZnakPlayback() {
    znakIsPlaying = false;
    if (znakRafId) { cancelAnimationFrame(znakRafId); znakRafId = null; }
    const audio = document.getElementById('znak-audio');
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch { } }
    const playIcon = document.getElementById('znak-play-icon');
    if (playIcon) playIcon.innerHTML = '&#xE768;';
}

function seekZnakAudio(e) {
    if (isRewinding) return;
    const wrap = e.currentTarget;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const audio = document.getElementById('znak-audio');
    if (audio && !isNaN(audio.duration)) {
        const effectiveDur = Math.min(audio.duration, ZNAK_CLIP_END_SEC);
        audio.currentTime = ratio * effectiveDur;
    }

    znakActiveLineIdx = -1;
    znakActiveWordIdx = -1;
    resetAllWidgetStates();
}

function playEndingRewindSequence() {
    if (isRewinding) return;
    isRewinding = true;
    znakIsPlaying = false;
    if (znakRafId) cancelAnimationFrame(znakRafId);

    const audio = document.getElementById('znak-audio');
    if (audio) audio.pause();
    setHtml('znak-play-icon', '&#xE768;');

    const motionStage = document.getElementById('znak-motion-stage');
    if (motionStage) motionStage.style.opacity = '0';

    const playerCard = document.getElementById('znak-player-card');
    if (playerCard) {
        playerCard.classList.remove('znak-player-mini');
        playerCard.classList.add('znak-player-center');
    }

    const fill = document.getElementById('znak-progress-fill');
    if (fill) fill.style.transition = 'none';

    let dummyCur = ZNAK_CLIP_END_SEC;
    const rewindSpeed = 1.2;

    const rewindInterval = setInterval(() => {
        dummyCur -= rewindSpeed;
        if (dummyCur <= 0) {
            dummyCur = 0;
            clearInterval(rewindInterval);
            isRewinding = false;
            resetZnakStageToInitial();
        }

        const pct = (dummyCur / ZNAK_CLIP_END_SEC) * 100;
        if (fill) fill.style.width = `${pct}%`;

        const mins = String(Math.floor(dummyCur / 60)).padStart(2, '0');
        const secs = String(Math.floor(dummyCur % 60)).padStart(2, '0');
        setText('znak-time-code', `${mins}:${secs}`);
    }, 16);
}

function startZnakSyncLoop() {
    if (znakRafId) cancelAnimationFrame(znakRafId);
    const audio = document.getElementById('znak-audio');

    function frame() {
        if (!znakIsPlaying || !audio || isRewinding) return;

        try {
            const cur = audio.currentTime;
            if (cur >= ZNAK_CLIP_END_SEC) {
                playEndingRewindSequence();
                return;
            }

            const pct = (cur / ZNAK_CLIP_END_SEC) * 100;
            const progFill = document.getElementById('znak-progress-fill');
            if (progFill) progFill.style.width = `${pct}%`;

            const mins = String(Math.floor(cur / 60)).padStart(2, '0');
            const secs = String(Math.floor(cur % 60)).padStart(2, '0');
            setText('znak-time-code', `${mins}:${secs}`);

            updateAudioReactiveVisuals(cur);

            let lineIdx = -1;
            for (let i = 0; i < ZNAK_TIMELINE.length; i++) {
                if (cur >= ZNAK_TIMELINE[i].time) lineIdx = i;
                else break;
            }

            if (lineIdx !== -1) {
                const cue = ZNAK_TIMELINE[lineIdx];

                if (lineIdx !== znakActiveLineIdx) {
                    znakActiveLineIdx = lineIdx;
                    znakActiveWordIdx = -1;
                    renderZnakLineWords(cue);
                    showZnakWidget(cue.widget);
                }

                let wordIdx = -1;
                for (let w = 0; w < cue.words.length; w++) {
                    if (cur >= cue.words[w].time) wordIdx = w;
                    else break;
                }

                if (wordIdx !== -1 && wordIdx !== znakActiveWordIdx) {
                    znakActiveWordIdx = wordIdx;
                    highlightWordsUpTo(wordIdx);

                    const wordObj = cue.words[wordIdx];
                    if (wordObj && wordObj.trigger) {
                        triggerKeywordWidgetMutation(wordObj.trigger);
                    }
                }
            } else {
                const subLyric = document.getElementById('znak-lyric-sub');
                const mainLyric = document.getElementById('znak-lyric-main');
                if (subLyric && subLyric.innerText !== 'INTRO • BEAT') {
                    subLyric.innerText = 'INTRO • BEAT';
                    if (mainLyric) mainLyric.innerHTML = '<span class="znak-word active">...</span>';
                }
            }
        } catch (err) {
            console.error('Znak sync frame error:', err);
        }

        znakRafId = requestAnimationFrame(frame);
    }

    znakRafId = requestAnimationFrame(frame);
}

function renderZnakLineWords(cue) {
    setText('znak-lyric-sub', cue.sub || '');
    const mainLyric = document.getElementById('znak-lyric-main');
    if (!mainLyric) return;

    mainLyric.innerHTML = cue.words.map((w, idx) => {
        const specialCls = w.trigger ? 'special-word' : '';
        return `<span class="znak-word ${specialCls}" data-widx="${idx}">${w.word}</span>`;
    }).join('');
}

function highlightWordsUpTo(activeIdx) {
    const spans = document.querySelectorAll('#znak-lyric-main .znak-word');
    spans.forEach((sp, idx) => {
        if (idx < activeIdx) {
            sp.classList.add('revealed');
            sp.classList.remove('active');
        } else if (idx === activeIdx) {
            sp.classList.add('revealed', 'active');
        } else {
            sp.classList.remove('revealed', 'active');
        }
    });
}

function triggerKeywordWidgetMutation(triggerId) {
    const activePanel = document.querySelector('#znak-ui-widgets-layer .znak-widget-card:not(.hidden) .znak-ui-panel');
    if (activePanel) {
        activePanel.classList.remove('keyword-pulse');
        void activePanel.offsetWidth;
        activePanel.classList.add('keyword-pulse');
        setTimeout(() => activePanel.classList.remove('keyword-pulse'), 320);
    }

    switch (triggerId) {
        case 'stage_enter':
            setText('zui-stage-loc', 'MAIN STAGE • ВЫХОД');
            setText('zui-stage-fans', '1,200');
            setText('zui-stage-badge', 'LIVE');
            break;

        case 'stage_fans':
            setText('zui-stage-loc', 'MAIN ARENA • SOLD OUT');
            setText('zui-stage-fans', '9,999+ FANS');
            const b = document.getElementById('zui-stage-badge');
            if (b) b.className = 'px-2 py-0.5 rounded bg-[var(--accent-soft)] border border-[var(--accent-light)] text-brand text-[9px] font-mono font-bold';
            break;

        case 'chat_m1':
            document.getElementById('zui-chat-m1')?.classList.add('chat-reveal');
            setHtml('zui-chat-status', '<span class="animate-pulse">печатает...</span>');
            break;

        case 'chat_emo':
            setText('zui-chat-status', 'онлайн');
            break;

        case 'chat_m2':
        case 'chat_lega':
            const rank = document.getElementById('zui-chat-rank');
            if (rank) {
                rank.className = 'px-2 py-0.5 rounded text-[9px] font-mono font-bold text-brand border border-[var(--accent-light)] bg-[var(--accent-soft)]';
                rank.innerText = 'СТАТУС: ЛЕГА';
            }
            document.getElementById('zui-chat-m2')?.classList.add('chat-reveal');
            break;

        case 'chat_m3':
        case 'chat_reject':
            setText('zui-chat-status', 'доступ ограничен');
            document.getElementById('zui-chat-m3')?.classList.add('chat-reveal');
            break;

        case 'para_start':
            document.getElementById('zui-3d-planes')?.classList.remove('idle-float');
            document.getElementById('zui-3d-planes')?.classList.add('plane-anim-run');
            break;

        case 'para_lock':
            setText('zui-para-node', 'PARALLEL #777 FOUND');
            document.getElementById('zui-3d-planes')?.classList.add('plane-anim-locked');
            break;

        case 'map_scan':
            const sweep = document.getElementById('zui-map-sweep');
            if (sweep) sweep.style.opacity = '0.45';
            break;

        case 'map_target':
            document.getElementById('zui-map-target')?.classList.add('opacity-100');
            break;

        case 'ecg_sick':
            setText('zui-ecg-bpm', '145 BPM');
            setText('zui-ecg-status', 'Диагноз: Тобою болею');
            const ecg1 = document.getElementById('zui-ecg-line');
            if (ecg1) ecg1.style.stroke = '#F59E0B';
            break;

        case 'ecg_max':
            setText('zui-ecg-bpm', '195 BPM • MAX');
            setText('zui-ecg-status', 'КРИТ: ВСЕМ СЕРДЦЕМ');
            const ecg2 = document.getElementById('zui-ecg-line');
            if (ecg2) ecg2.style.stroke = '#EF4444';
            document.getElementById('zui-heart-panel')?.classList.add('heart-overload');
            break;

        case 'marry_stamp':
            document.getElementById('zui-marry-stamp')?.classList.add('stamp-drop');
            break;

        case 'sign_1':
            const beacon = document.getElementById('zui-sign-beacon');
            if (beacon) {
                beacon.style.background = 'var(--accent-soft)';
                beacon.style.boxShadow = '0 0 25px var(--accent-glow)';
            }
            setText('zui-sign-title', 'СИГНАЛ ОТ ЗЭППИ ПОЛУЧЕН!');
            break;

        case 'sign_2':
            const neon = document.getElementById('zui-neon-text');
            if (neon) {
                neon.style.color = 'var(--accent-light)';
                neon.style.textShadow = '0 0 40px var(--accent-glow), 0 0 80px var(--accent-soft)';
            }
            break;
    }
}

function updateAudioReactiveVisuals() {
    let bassEnergy = 0;
    if (znakAnalyser && znakFreqData) {
        znakAnalyser.getByteFrequencyData(znakFreqData);
        bassEnergy = (znakFreqData[0] + znakFreqData[1] + znakFreqData[2]) / (3 * 255);
    }

    const orb1 = document.getElementById('znak-orb-1');
    const orb2 = document.getElementById('znak-orb-2');
    if (orb1) orb1.style.transform = `scale(${(1 + bassEnergy * 0.28).toFixed(3)})`;
    if (orb2) orb2.style.transform = `scale(${(1 + bassEnergy * 0.22).toFixed(3)})`;

    const bars = document.querySelectorAll('#zui-stage-bars .znak-eq-bar');
    bars.forEach((b, i) => {
        const val = (znakFreqData ? (znakFreqData[i * 2] / 255) : 0);
        b.style.height = `${Math.max(15, Math.min(100, Math.round(val * 100)))}%`;
    });
}

function showZnakWidget(widgetId) {
    const allWidgets = document.querySelectorAll('#znak-ui-widgets-layer .znak-widget-card');
    allWidgets.forEach(w => {
        if (w.id === widgetId) {
            w.classList.remove('hidden');
        } else {
            w.classList.add('hidden');
        }
    });
}

window.addEventListener('keydown', e => {
    const overlay = document.getElementById('znak-easter-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        closeZnakEasterEgg();
    }
});