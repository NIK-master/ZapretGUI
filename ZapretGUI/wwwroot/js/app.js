// =========================================================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ И МОСТ PHOTINO / WEBVIEW2
// =========================================================================
let appState = {
    isRunning: false,
    zapretRunning: false,
    proxyRunning: false,
    isScanning: false,
    firstTimeScanPrompted: false,
    selectedProfile: 'general.bat',
    currentPing: -1,
    configs: [],
    gameFilter: { mode: 'disabled', tcp: '1024-65535', udp: '1024-65535' },
    modsSubTab: 'bat',
    batMods: [],
    listMods: [],
    editingMod: { id: '', isBat: true, wordWrap: true, fontSize: 13 },
    settings: {
        focusMode: false,
        compactMode: false,
        accentTheme: 'green',
        statsUpdateInterval: 1,
        hostsSourceIndex: 2,
        ipSetMode: 'loaded',
        watchdogPingAutoRestart: false
    }
};

function sendCmd(action, data = {}) {
    if (!action || action === 'playClick') return;

    const payload = JSON.stringify({ action, ...data });

    if (window.external && typeof window.external.sendMessage === 'function') {
        window.external.sendMessage(payload);
    } else if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(payload);
    }
}

function handleBackendEvent(type, data) {
    switch (type) {
        case 'initData':
            document.querySelectorAll('.app-ver-text').forEach(el => el.innerText = data.version);
            document.getElementById('chk-zapret').checked = data.settings.zapretEnabled;
            document.getElementById('chk-proxy').checked = data.settings.tgProxyEnabled;

            appState.firstTimeScanPrompted = data.settings.firstTimeScanPrompted;
            appState.selectedProfile = data.settings.selectedProfileName || 'general.bat';
            appState.gameFilter = {
                mode: data.settings.gameFilterMode || 'disabled',
                tcp: data.settings.gameFilterTcpRange || '1024-65535',
                udp: data.settings.gameFilterUdpRange || '1024-65535'
            };

            if (typeof initSettingsFromBackend === 'function') {
                initSettingsFromBackend(data);
            }
            document.body.classList.toggle('compact-mode', !!data.settings.compactMode);

            if (data.settings.skipSplashScreen && !data.isFirstRun) {
                skipSplash();
            }

            appState.batMods = data.batMods || [];
            appState.listMods = data.listMods || [];

            initConfigsList(data.profiles || ['general.bat']);
            if (typeof renderModsView === 'function') renderModsView();
            if (typeof prepareDiagSkeletons === 'function') prepareDiagSkeletons();
            updateGameFilterBadge(data.gameFilterStatus, appState.gameFilter.mode !== 'disabled');
            updateRunningUI(data.zapretRunning, data.proxyRunning);

            if (data.zapretRunning || data.proxyRunning)
                appendLog(new Date().toLocaleTimeString(), 'Интерфейс загружен. Найдены активные процессы в фоне.');
            else
                appendLog(new Date().toLocaleTimeString(), 'Интерфейс загружен. Ожидание команд...');

            if (data.isFirstRun) {
                openWizardModal();
            }
            break;

        case 'wizardLog':
            appendWizardLog(data.time, data.message, data.isProgress);
            break;

        case 'wizardCompleted':
            wizardFinished = true;
            wizHyperSpeed = false;
            wizCurrentPct = 100;
            document.getElementById('wiz-finish-status').innerText = 'Установка успешно завершена!';
            document.getElementById('wiz-finish-status').className = 'text-base font-bold text-brand';
            setWizardProgress(100);
            const btnNext = document.getElementById('wiz-btn-next');
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.innerText = 'Запустить панель →';
            break;

        case 'askConfirm':
            isBackendConfirm = true;
            showConfirm(data.title, data.message, data.confirmText || 'Да', null, data.isDanger);
            break;

        case 'routingStatusUpdated':
            if (typeof updateRoutingStatusUI === 'function') updateRoutingStatusUI(data);
            document.getElementById('btn-update-ipset').innerHTML = '<span class="mdl-icon text-xs text-brand">&#xE149;</span><span>Обновить базу</span>';
            document.getElementById('btn-update-ipset').disabled = false;
            document.getElementById('btn-update-hosts').innerHTML = '<span class="mdl-icon text-xs">&#xE945;</span><span>Обновить</span>';
            document.getElementById('btn-update-hosts').disabled = false;
            break;

        case 'updatesCheckFinished':
            document.getElementById('btn-check-updates').innerHTML = '<span class="mdl-icon text-xs">&#xE149;</span><span>Проверить обновления</span>';
            document.getElementById('btn-check-updates').disabled = false;
            break;

        case 'modsUpdated':
            appState.batMods = data.batMods || [];
            appState.listMods = data.listMods || [];
            if (data.selectedProfile) {
                appState.selectedProfile = data.selectedProfile;
            }
            initConfigsList(data.profiles || ['general.bat']);
            if (typeof renderModsView === 'function') renderModsView();
            break;

        case 'modIdGenerated':
            document.getElementById('new-mod-id').value = data.id;
            if (typeof updateModIdValidationUI === 'function') updateModIdValidationUI(data.id, false, false);
            break;

        case 'modIdChecked':
            if (typeof updateModIdValidationUI === 'function') updateModIdValidationUI(data.cleanId, data.isTaken, data.isEmpty);
            break;

        case 'modCreated':
            if (typeof closeCreateModModal === 'function') closeCreateModModal();
            break;

        case 'modContentLoaded':
            if (typeof openEditorWithData === 'function') openEditorWithData(data);
            break;

        case 'batValidationResult':
            if (data.isValid) {
                if (typeof setEditorStatus === 'function') setEditorStatus('✓ Синтаксис корректен!', 'text-brand');
            } else {
                if (typeof setEditorStatus === 'function') setEditorStatus('⚠ Ошибка в скрипте', 'text-[#F44336]');
                showAlert('Проверка синтаксиса Zapret', data.errorMessage, true);
            }
            break;

        case 'modSaveSyntaxWarning':
            showConfirm(
                'Предупреждение синтаксиса Zapret',
                `В скрипте обнаружена проблема:\n\n${data.errorMessage}\n\nВсё равно сохранить файл?`,
                'Сохранить всё равно',
                () => saveEditorChanges(true)
            );
            break;

        case 'modContentSaved':
            if (typeof closeEditorModal === 'function') closeEditorModal();
            break;

        case 'promptRestartZapret':
            showConfirm(
                'Перезапустить Zapret?',
                `${data.reason}\n\nФайл list-general.txt был обновлен в прямом эфире, но для применения новых доменов в уже работающем ядре winws.exe требуется перезапуск. Перезапустить сейчас?`,
                'Перезапустить',
                () => sendCmd('restartBypass')
            );
            break;

        case 'diagProgress':
            document.getElementById('diag-status-txt').innerText = data.status;
            document.getElementById('diag-progress-bar').style.width = `${data.progress}%`;
            if (typeof updateDiagStepPills === 'function') {
                updateDiagStepPills(data.progress, data.status);
            }
            break;

        case 'diagResult':
            if (typeof renderDiagnosticsReport === 'function') renderDiagnosticsReport(data);
            if (typeof updateRadarNodesFromReport === 'function') updateRadarNodesFromReport(data);
            if (typeof syncGlobe3DWithDiagReport === 'function') syncGlobe3DWithDiagReport(data);
            break;

        case 'log':
            appendLog(data.time, data.message, data.isProgress);
            break;

        case 'netStats':
            document.getElementById('stat-rx').innerText = data.download.toFixed(1);
            document.getElementById('stat-tx').innerText = data.upload.toFixed(1);
            updateChart(data.download, data.upload);
            updateRunningUI(data.zapretRunning, data.proxyRunning);
            break;

        case 'netStatus':
            document.getElementById('dot-net').className = `w-2 h-2 rounded-full ${data.isOnline ? 'dot-online' : 'dot-offline'}`;
            break;

        case 'pingResult':
            document.getElementById('ping-refresh-icon').classList.remove('spin-anim');
            appState.currentPing = data.ping;
            updatePingDisplay(data.ping);
            document.getElementById('dot-net').className = `w-2 h-2 rounded-full ${data.ping >= 0 ? 'dot-online' : 'dot-offline'}`;
            appState.configs.forEach(c => c.pingMs = data.ping > 0 ? data.ping : 999999);
            renderConfigCards();

            if (appState.isRunning && appState.settings.watchdogPingAutoRestart) {
                if (data.ping < 0) {
                    watchdogFailCount++;
                    if (watchdogFailCount >= 3) {
                        watchdogFailCount = 0;
                        appendLog(new Date().toLocaleTimeString(), '🐕 [Ping-Watchdog] Обнаружена потеря пинга. Автоматический перезапуск служб...');
                        sendCmd('restartBypass');
                    }
                } else {
                    watchdogFailCount = 0;
                }
            }
            break;

        case 'bypassState':
            updateRunningUI(data.zapretRunning, data.proxyRunning);
            break;

        case 'configTested':
            const item = appState.configs.find(c => c.fileName.toLowerCase() === data.fileName.toLowerCase());
            if (item) {
                item.testsOk = data.ok;
                item.testsTotal = data.total;
                if (appState.currentPing > 0) item.pingMs = appState.currentPing;
                renderConfigCards();
            }
            break;

        case 'scanState':
            appState.isScanning = data.isScanning;
            updateScanButtonUI();
            break;

        case 'scanCompleted':
            appState.isScanning = false;
            updateScanButtonUI();
            if (data.topConfigs && data.topConfigs.length > 0) {
                appState.configs.forEach(c => c.topRank = 999999);
                data.topConfigs.forEach((name, idx) => {
                    const cfg = appState.configs.find(c => c.fileName.toLowerCase() === name.toLowerCase());
                    if (cfg) cfg.topRank = idx;
                });
                selectProfile(data.bestConfig);
                appendLog(new Date().toLocaleTimeString(), `🏆 Сканирование завершено! Выбрана лучшая стратегия: ${data.bestConfig}`);
            } else {
                appendLog(new Date().toLocaleTimeString(), '⚠ Сканирование завершено, но ни одна стратегия не сработала.');
            }
            break;

        case 'scanFailed':
            appState.isScanning = false;
            updateScanButtonUI();
            appendLog(new Date().toLocaleTimeString(), `❌ Ошибка сканера: ${data.error}`);
            break;

        case 'gameFilterSaved':
            appState.gameFilter = { mode: data.mode, tcp: data.tcp, udp: data.udp };
            updateGameFilterBadge(data.statusText, data.mode !== 'disabled');
            closeGameFilterModal();

            if (appState.zapretRunning) {
                showConfirm(
                    'Перезапустить Zapret?',
                    'Настройки Игрового фильтра сохранены. Чтобы новые диапазоны портов вступили в силу в работающем обходе, требуется перезапуск. Перезапустить сейчас?',
                    'Перезапустить',
                    () => sendCmd('saveGameFilter', { ...appState.gameFilter, restartIfRunning: true })
                );
            }
            break;

        case 'errorGlitch':
            if (!appState.settings.focusMode) {
                const mc = document.getElementById('main-container');
                mc.classList.remove('glitch-anim');
                void mc.offsetWidth;
                mc.classList.add('glitch-anim');
            }
            break;

        case 'alert':
            showAlert(data.title, data.message, data.isError);
            break;

        case 'profileSelected':
            appState.selectedProfile = data.profile;
            document.getElementById('txt-main-profile').innerText = data.profile;
            document.getElementById('modal-active-profile').innerText = data.profile;
            renderConfigCards();
            if (typeof renderModsView === 'function') renderModsView();
            break;

        case 'toggleCommandPalette':
            toggleCommandPaletteModal();
            break;

        case 'siteAnalyzed':
            if (typeof renderSiteAnalyzeResult === 'function') renderSiteAnalyzeResult(data);
            break;

        case 'siteAnalyzeError':
            if (typeof renderSiteAnalyzeError === 'function') renderSiteAnalyzeError(data.error);
            break;
    }
}

// =========================================================================
// 2. НАВИГАЦИЯ ПО ВКЛАДКАМ И СЛАЙДЯЩИЕ КАПСУЛЫ
// =========================================================================
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('rail-mode');
}

function switchTab(tabId, btnEl) {
    document.querySelectorAll('.tab-view').forEach(sec => sec.classList.remove('active'));
    document.getElementById('tab-' + tabId)?.classList.add('active');

    const navBtns = document.querySelectorAll('#sidebar-nav .nav-btn');
    navBtns.forEach(b => {
        b.classList.remove('active', 'font-semibold', 'text-white');
        b.classList.add('font-medium', 'text-[#CCCCCC]');
        const ico = b.querySelector('.mdl-icon');
        if (ico) {
            ico.classList.remove('text-brand', 'text-[#4CAF50]');
            ico.classList.add('text-[#888888]');
        }
    });

    const targetBtn = btnEl || Array.from(navBtns).find(b => b.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (targetBtn) {
        targetBtn.classList.add('active', 'font-semibold', 'text-white');
        targetBtn.classList.remove('font-medium', 'text-[#CCCCCC]');
        const ico = targetBtn.querySelector('.mdl-icon');
        if (ico) {
            ico.classList.remove('text-[#888888]');
            ico.classList.add('text-brand');
        }

        const pill = document.getElementById('sidebar-active-pill');
        if (pill) {
            pill.style.transform = `translateY(${targetBtn.offsetTop}px)`;
        }
    }

    if (tabId === 'home') {
        requestAnimationFrame(() => drawChart());
    } else if (tabId === 'mods') {
        requestAnimationFrame(() => updateModsSlidingPill());
    } else if (tabId === 'settings') {
        requestAnimationFrame(() => {
            const activeSetBtn = document.querySelector('.set-cat-btn.active');
            if (activeSetBtn) updateSettingsSlidingPill(activeSetBtn);
            if (typeof initGems3DShowcase === 'function') initGems3DShowcase();
            if (typeof resizeGems3DIfNeeded === 'function') resizeGems3DIfNeeded();
        });
    }
}

function updateModsSlidingPill() {
    const pill = document.getElementById('mods-seg-pill');
    const activeBtn = document.querySelector('#mods-seg-track .mods-seg-btn.active') ||
        document.getElementById('mod-tab-' + (appState.modsSubTab || 'bat'));
    if (!pill || !activeBtn) return;

    pill.style.width = `${activeBtn.offsetWidth}px`;
    pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

function updateSettingsSlidingPill(targetBtn) {
    const pill = document.getElementById('settings-seg-pill');
    const btn = targetBtn || document.querySelector('#settings-seg-track .set-cat-btn.active');
    if (!pill || !btn) return;

    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
}

// =========================================================================
// 3. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ DOM
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    runSplashSequence().catch(() => skipSplash());
    setTimeout(() => {
        if (!splashSkipped) skipSplash();
    }, 6500);

    if (window.external && typeof window.external.receiveMessage === 'function') {
        window.external.receiveMessage(rawMsg => {
            try {
                const msg = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
                if (msg && msg.type) {
                    handleBackendEvent(msg.type, msg.data);
                }
            } catch (e) {
                console.error('Ошибка Photino message:', e);
            }
        });
    } else if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener('message', e => {
            try {
                const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (msg && msg.type) {
                    handleBackendEvent(msg.type, msg.data);
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    if (typeof window.runDiagnostics === 'function') {
        const origRunDiag = window.runDiagnostics;
        window.runDiagnostics = function () {
            if (typeof buildDefaultRadarNodes === 'function') buildDefaultRadarNodes();
            origRunDiag();
        };
    }

    try {
        if (typeof initReactor3D === 'function') initReactor3D();
        if (typeof initGems3DShowcase === 'function') initGems3DShowcase();
        if (typeof initZappy3DMascot === 'function') initZappy3DMascot();
        if (typeof refreshCardsTiltEffect === 'function') refreshCardsTiltEffect();
    } catch (e) {
        console.error('3D init error:', e);
    }

    try {
        if (typeof initDiagnosticsRadarView === 'function') initDiagnosticsRadarView();
        if (typeof injectGlobe3DViewButton === 'function') injectGlobe3DViewButton();
    } catch (e) {
        console.error('Radar/Globe init error:', e);
    }

    window.addEventListener('resize', () => {
        updateModsSlidingPill();
        updateSettingsSlidingPill();
        drawChart();
    });

    ['titlebar', 'wizard-titlebar'].forEach(id => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.addEventListener('mousedown', e => {
                if (e.button === 0 && !e.target.closest('button') && !e.target.closest('input')) {
                    sendCmd('windowDrag');
                }
            });
        }
    });

    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
            e.preventDefault();
            e.stopPropagation();
            toggleCommandPaletteModal();
        }
    }, true);

    window.addEventListener('wheel', e => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    const dropOverlay = document.getElementById('dropzone-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        if (dropOverlay) {
            dropOverlay.classList.remove('hidden');
            dropOverlay.classList.add('flex');
        }
    });

    window.addEventListener('dragleave', e => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (dropOverlay) {
                dropOverlay.classList.add('hidden');
                dropOverlay.classList.remove('flex');
            }
        }
    });

    window.addEventListener('dragover', e => e.preventDefault());

    window.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        if (dropOverlay) {
            dropOverlay.classList.add('hidden');
            dropOverlay.classList.remove('flex');
        }

        const file = e.dataTransfer?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = String(reader.result).split(',')[1] || '';
            sendCmd('importDroppedFile', { fileName: file.name, base64 });
        };
        reader.readAsDataURL(file);
    });


    drawChart();
    sendCmd('init');
});

// =========================================================================
// 4. СОХРАНЕНИЕ НАСТРОЕК, МИНИМАЛИСТИЧНЫЙ РЕЖИМ И ПОИСК ПО НАСТРОЙКАМ
// =========================================================================
let settingsSaveToastTimer = null;

function onSettingsChanged() {
    const compact = document.getElementById('set-compact-mode')?.checked ?? false;
    const focus = document.getElementById('set-focus-mode')?.checked ?? false;
    const watchdog = document.getElementById('set-watchdog-ping')?.checked ?? false;

    appState.settings.compactMode = compact;
    appState.settings.focusMode = focus;
    appState.settings.watchdogPingAutoRestart = watchdog;

    document.body.classList.toggle('compact-mode', compact);
    if (typeof renderModsView === 'function') renderModsView();
    if (typeof syncReactor3DThemeAndState === 'function') syncReactor3DThemeAndState();
    if (typeof syncGems3DWithActiveTheme === 'function') syncGems3DWithActiveTheme(appState.settings.accentTheme);

    const payload = {
        autoStart: document.getElementById('set-autostart')?.checked ?? false,
        autoStartBypass: document.getElementById('set-autostart-bypass')?.checked ?? false,
        startMinimized: document.getElementById('set-start-minimized')?.checked ?? false,
        minimizeOnClose: document.getElementById('set-minimize-close')?.checked ?? true,
        stopServicesOnExit: document.getElementById('set-stop-on-exit')?.checked ?? true,
        notificationsEnabled: document.getElementById('set-notifications')?.checked ?? true,
        alwaysOnTop: document.getElementById('set-always-on-top')?.checked ?? false,
        soundEffectsEnabled: document.getElementById('set-sound-effects')?.checked ?? true,
        skipSplashScreen: document.getElementById('set-skip-splash')?.checked ?? false,
        compactMode: compact,
        focusMode: focus,
        hardwareAcceleration: document.getElementById('set-hw-accel')?.checked ?? true,
        pingUrl: document.getElementById('set-ping-url')?.value?.trim() || 'https://dynamodb.eu-central-1.amazonaws.com',
        statsUpdateInterval: appState.settings.statsUpdateInterval || 1,
        autoRestartServices: document.getElementById('set-autorestart')?.checked ?? false,
        watchdogPingAutoRestart: watchdog,
        accentTheme: appState.settings.accentTheme || 'green',
        hostsSourceIndex: appState.settings.hostsSourceIndex ?? 2
    };

    sendCmd('saveSettings', { settings: payload });

    const toast = document.getElementById('settings-save-toast');
    if (toast) {
        toast.style.opacity = '1';
        clearTimeout(settingsSaveToastTimer);
        settingsSaveToastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1600);
    }

    setTimeout(() => {
        updateModsSlidingPill();
        updateSettingsSlidingPill();
        drawChart();
    }, 80);
}

function filterSettingsView() {
    const query = (document.getElementById('settings-search-input')?.value || '').trim().toLowerCase();
    const activeCatBtn = document.querySelector('#settings-seg-track .set-cat-btn.active');
    const currentCat = window.currentSettingsCat || (activeCatBtn?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'all');

    const groups = document.querySelectorAll('#tab-settings [data-set-group]');
    groups.forEach(group => {
        const groupCat = group.getAttribute('data-set-group');
        const catMatches = (currentCat === 'all' || currentCat === groupCat);

        if (!catMatches) {
            group.classList.add('hidden');
            return;
        }

        if (!query) {
            group.classList.remove('hidden');
            group.querySelectorAll('[data-search]').forEach(item => item.classList.remove('hidden'));
            group.querySelectorAll('.glass-card').forEach(card => card.classList.remove('hidden'));
            const routingGrid = group.querySelector('#settings-routing-grid');
            if (routingGrid) routingGrid.classList.remove('hidden');
            return;
        }

        const innerCards = group.classList.contains('glass-card') ? [group] : Array.from(group.querySelectorAll('.glass-card'));
        let anyVisibleInGroup = false;

        innerCards.forEach(card => {
            const searchableItems = card.querySelectorAll('[data-search]');
            let visibleInCard = 0;

            searchableItems.forEach(item => {
                const hay = (item.getAttribute('data-search') + ' ' + item.innerText).toLowerCase();
                const match = hay.includes(query);
                item.classList.toggle('hidden', !match);
                if (match) visibleInCard++;
            });

            const routingGrid = card.querySelector('#settings-routing-grid');
            if (routingGrid) {
                const visRouting = routingGrid.querySelectorAll('[data-search]:not(.hidden)').length;
                routingGrid.classList.toggle('hidden', visRouting === 0);
            }

            card.classList.toggle('hidden', visibleInCard === 0);
            if (visibleInCard > 0) anyVisibleInGroup = true;
        });

        group.classList.toggle('hidden', !anyVisibleInGroup);
    });
}