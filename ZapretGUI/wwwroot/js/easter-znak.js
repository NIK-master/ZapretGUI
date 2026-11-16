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

// Карта нейросети WhisperX с новыми триггерами
const ZNAK_TIMELINE = [
    {
        time: 8.89, endTime: 17.24, sub: "INTRO • TOXI$", widget: null,
        words: [
            { word: "У-у-у-у,", time: 9.67 }, { word: "у-у-у,", time: 11.73 }, { word: "у-у-у", time: 13.14 }
        ]
    },
    {
        time: 17.24, endTime: 21.55, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-stage-pass",
        words: [
            { word: "Выхожу", time: 17.36, trigger: "stage_enter" }, { word: "на", time: 18.24 }, { word: "сцену,", time: 18.40 },
            { word: "вижу", time: 19.67 }, { word: "своих", time: 20.13 }, { word: "фэнов", time: 20.71, trigger: "stage_fans" }
        ]
    },
    {
        time: 21.55, endTime: 25.96, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-altgirl-chat",
        words: [
            { word: "Неформалка", time: 21.79, trigger: "chat_m1" }, { word: "лезет,", time: 22.89 }, { word: "она", time: 23.51 },
            { word: "думает", time: 24.00 }, { word: "я", time: 24.86 }, { word: "эмо", time: 25.16, trigger: "chat_emo" }
        ]
    },
    {
        time: 25.96, endTime: 29.95, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-altgirl-chat",
        words: [
            { word: "Не", time: 25.96 }, { word: "знаю,", time: 26.10 }, { word: "что", time: 26.62 }, { word: "ответить,", time: 27.10 },
            { word: "точно", time: 27.82 }, { word: "знаю,", time: 28.31 }, { word: "что", time: 28.83 }, { word: "я", time: 29.21 },
            { word: "лега", time: 29.47, trigger: "chat_m2" }
        ]
    },
    {
        time: 29.95, endTime: 34.22, sub: "КУПЛЕТ 1 • TOXI$", widget: "zui-altgirl-chat",
        words: [
            { word: "Но", time: 30.09 }, { word: "я", time: 30.27 }, { word: "с", time: 30.45 }, { word: "ней", time: 30.51 },
            { word: "не", time: 30.79 }, { word: "проведу", time: 31.07 }, { word: "эту", time: 32.17 }, { word: "ночь", time: 32.40, trigger: "chat_m3" }
        ]
    },
    {
        time: 34.22, endTime: 37.68, sub: "ПРИПЕВ • TOXI$", widget: "zui-parallel-search",
        words: [
            { word: "Ведь", time: 34.24, trigger: "para_start" }, { word: "я", time: 34.44 }, { word: "уверен,", time: 34.76 }, { word: "что", time: 35.67 },
            { word: "где-то", time: 35.91 }, { word: "в", time: 36.51 }, { word: "параллели", time: 36.55, trigger: "para_lock" }
        ]
    },
    {
        time: 37.68, endTime: 42.07, sub: "ПРИПЕВ • TOXI$", widget: "zui-map-tracker",
        words: [
            { word: "Найду", time: 37.90 }, { word: "тебя", time: 38.42 }, { word: "дуру", time: 39.22 },
            { word: "и", time: 39.90 }, { word: "у", time: 40.15 }, { word: "нас", time: 40.33 }, { word: "будет", time: 40.61 },
            { word: "LOVE", time: 41.45, trigger: "map_target" }
        ]
    },
    {
        time: 42.07, endTime: 46.41, sub: "ПРИПЕВ • TOXI$", widget: "zui-heart-ecg",
        words: [
            { word: "Тобою", time: 42.25 }, { word: "болею,", time: 43.06, trigger: "ecg_sick" }, { word: "всем", time: 44.40 },
            { word: "сердцем", time: 44.68, trigger: "ecg_max" }, { word: "болею", time: 45.28 }
        ]
    },
    {
        time: 46.41, endTime: 50.90, sub: "ПРИПЕВ • TOXI$", widget: "zui-marriage-modal",
        words: [
            { word: "И", time: 46.73 }, { word: "я", time: 46.97 }, { word: "надеюсь,", time: 47.21 }, { word: "то", time: 47.95 },
            { word: "что", time: 48.17 }, { word: "у", time: 48.60 }, { word: "нас", time: 48.84 }, { word: "будет", time: 49.08 },
            { word: "с", time: 49.56 }, { word: "тобой", time: 49.64 }, { word: "брак", time: 50.18, trigger: "marry_stamp" }
        ]
    },
    {
        time: 50.90, endTime: 54.20, sub: "SIGNAL 1", widget: "zui-kitty-sign",
        words: [
            { word: "Киса,", time: 51.00 }, { word: "подай", time: 51.52 }, { word: "мне", time: 52.04 }, { word: "знак", time: 52.28, trigger: "sign_1" }
        ]
    },
    {
        time: 54.20, endTime: 59.50, sub: "SIGNAL 2 (NEON)", widget: "zui-neon-sign",
        words: [
            { word: "А-а-а...", time: 54.30 }, { word: "У-у...", time: 57.10, trigger: "sign_2" }
        ]
    },
    {
        time: 59.50, endTime: 64.50, sub: "SIGNAL 3 (OVERRIDE)", widget: "zui-warning-sign",
        words: [
            { word: "Киса,", time: 59.70 }, { word: "подай", time: 60.26 }, { word: "мне", time: 60.76 }, { word: "знак", time: 61.01, trigger: "sign_3" }
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
    document.getElementById('znak-time-code').innerText = '00:00';

    // Сброс всех виджетов к начальному состоянию (исправлено под новый CSS чата)
    showZnakWidget(null);
    document.querySelectorAll('.chat-bubble').forEach(e => e.classList.remove('chat-reveal'));

    document.getElementById('zui-chat-status').innerText = 'ожидание...';
    document.getElementById('zui-3d-planes')?.classList.remove('plane-anim-run', 'plane-anim-locked');
    document.getElementById('zui-map-sweep')?.classList.add('hidden');
    document.getElementById('zui-map-target')?.classList.remove('opacity-100');
    document.getElementById('zui-heart-panel')?.classList.remove('heart-overload');
    const ecgLine = document.getElementById('zui-ecg-line');
    if (ecgLine) ecgLine.style.stroke = 'var(--accent-light)';
    document.getElementById('zui-marry-stamp')?.classList.remove('stamp-drop');
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

    // Сброс мутаций виджетов при перемотке, чтобы они могли отыграть заново
    znakActiveLineIdx = -1;
    znakActiveWordIdx = -1;
    document.querySelectorAll('.chat-bubble').forEach(el => el.classList.remove('chat-reveal'));

    document.getElementById('zui-chat-status').innerText = 'ожидание...';
    document.getElementById('zui-3d-planes')?.classList.remove('plane-anim-run', 'plane-anim-locked');
    document.getElementById('zui-map-target')?.classList.remove('opacity-100');
    document.getElementById('zui-marry-stamp')?.classList.remove('stamp-drop');
}

function playEndingRewindSequence() {
    if (isRewinding) return;
    isRewinding = true;
    znakIsPlaying = false;
    if (znakRafId) cancelAnimationFrame(znakRafId);

    const audio = document.getElementById('znak-audio');
    if (audio) audio.pause();
    document.getElementById('znak-play-icon').innerHTML = '&#xE768;';

    // Прячем сцену и возвращаем плеер в центр
    document.getElementById('znak-motion-stage').style.opacity = '0';
    const playerCard = document.getElementById('znak-player-card');
    playerCard.classList.remove('znak-player-mini');
    playerCard.classList.add('znak-player-center');

    const fill = document.getElementById('znak-progress-fill');
    const timeCode = document.getElementById('znak-time-code');
    fill.style.transition = 'none';

    let dummyCur = ZNAK_CLIP_END_SEC;
    const rewindSpeed = 1.2; // скорость отмотки

    const rewindInterval = setInterval(() => {
        dummyCur -= rewindSpeed;
        if (dummyCur <= 0) {
            dummyCur = 0;
            clearInterval(rewindInterval);
            isRewinding = false;
            resetZnakStageToInitial();
        }

        const pct = (dummyCur / ZNAK_CLIP_END_SEC) * 100;
        fill.style.width = `${pct}%`;

        const mins = String(Math.floor(dummyCur / 60)).padStart(2, '0');
        const secs = String(Math.floor(dummyCur % 60)).padStart(2, '0');
        timeCode.innerText = `${mins}:${secs}`;
    }, 16);
}

function startZnakSyncLoop() {
    if (znakRafId) cancelAnimationFrame(znakRafId);
    const audio = document.getElementById('znak-audio');

    function frame() {
        if (!znakIsPlaying || !audio || isRewinding) return;

        const cur = audio.currentTime;
        if (cur >= ZNAK_CLIP_END_SEC) {
            playEndingRewindSequence();
            return;
        }

        const pct = (cur / ZNAK_CLIP_END_SEC) * 100;
        const progFill = document.getElementById('znak-progress-fill');
        if (progFill) progFill.style.width = `${pct}%`;

        const timeCode = document.getElementById('znak-time-code');
        if (timeCode) {
            const mins = String(Math.floor(cur / 60)).padStart(2, '0');
            const secs = String(Math.floor(cur % 60)).padStart(2, '0');
            timeCode.innerText = `${mins}:${secs}`;
        }

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

        znakRafId = requestAnimationFrame(frame);
    }

    znakRafId = requestAnimationFrame(frame);
}

function renderZnakLineWords(cue) {
    const subLyric = document.getElementById('znak-lyric-sub');
    const mainLyric = document.getElementById('znak-lyric-main');
    if (subLyric) subLyric.innerText = cue.sub || '';
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
        case 'stage_fans':
            document.getElementById('zui-stage-loc').innerText = 'MAIN ARENA • SOLD OUT';
            document.getElementById('zui-stage-fans').innerText = '9,999+ FANS';
            document.getElementById('zui-stage-badge').className = 'px-2 py-0.5 rounded bg-[var(--accent-soft)] border border-[var(--accent-light)] text-brand text-[9px] font-mono font-bold';
            break;

        case 'chat_m1':
            document.getElementById('zui-chat-m1')?.classList.add('chat-reveal');
            document.getElementById('zui-chat-status').innerText = 'печатает...';
            break;
        case 'chat_emo':
            document.getElementById('zui-chat-status').innerText = 'онлайн';
            break;
        case 'chat_lega':
        case 'chat_m2':
            document.getElementById('zui-chat-rank').className = 'px-2 py-0.5 rounded text-[9px] font-mono font-bold text-brand border border-[var(--accent-light)] bg-[var(--accent-soft)]';
            document.getElementById('zui-chat-rank').innerText = 'СТАТУС: ЛЕГА';
            document.getElementById('zui-chat-m2')?.classList.add('chat-reveal');
            break;
        case 'chat_m3':
        case 'chat_reject':
            document.getElementById('zui-chat-status').innerText = 'доступ ограничен';
            document.getElementById('zui-chat-m3')?.classList.add('chat-reveal');
            break;

        case 'para_start':
            document.getElementById('zui-3d-planes')?.classList.add('plane-anim-run');
            break;
        case 'para_lock':
            document.getElementById('zui-para-node').innerText = 'PARALLEL #777 FOUND';
            document.getElementById('zui-3d-planes')?.classList.add('plane-anim-locked');
            break;

        case 'map_scan':
            document.getElementById('zui-map-sweep')?.classList.remove('hidden');
            break;
        case 'map_target':
            document.getElementById('zui-map-target')?.classList.add('opacity-100');
            break;

        case 'ecg_sick':
            document.getElementById('zui-ecg-bpm').innerText = '145 BPM';
            document.getElementById('zui-ecg-status').innerText = 'Диагноз: Тобою болею';
            document.getElementById('zui-ecg-line').style.stroke = '#F59E0B';
            break;
        case 'ecg_max':
            document.getElementById('zui-ecg-bpm').innerText = '195 BPM • MAX';
            document.getElementById('zui-ecg-status').innerText = 'КРИТ: ВСЕМ СЕРДЦЕМ';
            document.getElementById('zui-ecg-line').style.stroke = '#EF4444';
            document.getElementById('zui-heart-panel')?.classList.add('heart-overload');
            break;

        case 'marry_stamp':
            document.getElementById('zui-marry-stamp')?.classList.add('stamp-drop');
            break;

        case 'sign_1':
            document.getElementById('zui-sign-beacon').style.background = 'var(--accent-soft)';
            document.getElementById('zui-sign-beacon').style.boxShadow = '0 0 25px var(--accent-glow)';
            break;
        case 'sign_2':
            document.getElementById('zui-neon-text').style.color = 'var(--accent-light)';
            document.getElementById('zui-neon-text').style.textShadow = '0 0 40px var(--accent-glow), 0 0 80px var(--accent-soft)';
            break;
    }
}

function updateAudioReactiveVisuals(curSec) {
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