/**
 * Task Desk - 個人任務工作桌
 * 純 HTML5 + CSS3 + Vanilla JavaScript 實現
 * 零付費服務、零後端、本機儲存、PWA 離線可用
 */

(function () {
  'use strict';

  // --- 預設規則對照表（作為 rules.json 備案） ---
  const DEFAULT_RULES = {
    version: 1,
    taskTypes: [
      {
        id: "deep_focus",
        name: "深度專注",
        description: "讀書、寫報告、寫程式、研讀研究",
        minMind: "mid",
        minBody: "low",
        minTime: 60,
        places: ["home", "school"],
        aiAssist: false,
        keywords: ["讀書", "報告", "寫程式", "程式", "研究", "論文", "研讀", "複習", "演算法", "架構", "專題", "code", "coding"]
      },
      {
        id: "hands_on",
        name: "動手做",
        description: "接線、組裝、測試、修繕、實驗",
        minMind: "mid",
        minBody: "mid",
        minTime: 60,
        places: ["home", "school"],
        aiAssist: false,
        keywords: ["接線", "組裝", "測試", "修繕", "實驗", "製作", "維修", "烙鐵", "模型", "焊接", "硬體", "零件"]
      },
      {
        id: "admin",
        name: "行政雜事",
        description: "寄信、填表、報名、繳費、確認",
        minMind: "low",
        minBody: "low",
        minTime: 30,
        places: ["any"],
        aiAssist: false,
        keywords: ["寄信", "填表", "報名", "繳費", "回信", "申請", "發票", "預約", "確認", "信件", "表單", "帳單", "匯款", "加選", "退選"]
      },
      {
        id: "tidy",
        name: "整理",
        description: "回訊息、整理清單、改文件、小幅備份",
        minMind: "low",
        minBody: "low",
        minTime: 30,
        places: ["any"],
        aiAssist: false,
        keywords: ["回訊息", "整理清單", "改文件", "歸檔", "分類", "刪除", "備份", "訊息", "回覆", "line", "slack", "mail"]
      },
      {
        id: "bulk_organize",
        name: "巨量整理",
        description: "大量資料、文件、筆記的整理歸納與盤點",
        minMind: "mid",
        minBody: "low",
        minTime: 60,
        places: ["home", "school"],
        aiAssist: true,
        keywords: ["整理", "歸納", "彙整", "筆記", "資料夾", "大掃除", "盤點", "清點", "大批資料", "文獻整理"]
      },
      {
        id: "creative",
        name: "創作",
        description: "畫畫、設計、發想草圖、創意構想",
        minMind: "mid",
        minBody: "low",
        minTime: 30,
        places: ["home"],
        aiAssist: false,
        keywords: ["畫畫", "設計", "發想", "繪圖", "靈感", "草圖", "作曲", "插畫", "剪輯", "剪片", "構圖"]
      },
      {
        id: "physical",
        name: "身體活動",
        description: "運動、跆拳道、跑步、健身、重訓",
        minMind: "low",
        minBody: "high",
        minTime: 30,
        places: ["any"],
        aiAssist: false,
        keywords: ["運動", "跆拳道", "跑步", "重訓", "拉筋", "健身", "散步", "游泳", "打球", "拳擊", "深蹲", "體能"]
      }
    ]
  };

  // --- 狀態與常數 ---
  const STORAGE_KEY_ITEMS = 'taskdesk_items_v1';
  const STORAGE_KEY_SETTINGS = 'taskdesk_settings_v1';
  const STORAGE_KEY_SYNC = 'taskdesk_sync_v1';
  const STORAGE_KEY_FOCUS_SESSIONS = 'taskdesk_focus_sessions_v1';
  const STORAGE_KEY_USER_STATE = 'taskdesk_user_state_v1';

  let rules = DEFAULT_RULES;
  let items = [];
  let currentUserState = {
    energy: 'high', // 'high' | 'low'
    flow: 'smooth', // 'smooth' | 'stuck'
    updatedAt: 0
  };
  let ambientCandidates = [];
  let ambientCurrentIndex = 0;
  let ambientDismissed = false;
  let isCaptureRoutineActive = false;
  let settings = {
    todaySmallLimit: 3,
    weekMediumLargeLimit: 3,
    weekLimit: 3, // 相容舊版
    theme: 'dark',
    safeTop: 56,
    includeKeepInConsult: false,
    pinLock: false,
    pinHash: '',
    focusLockEnabled: true,
    kairosEnabled: false,
    kairosUrl: 'http://127.0.0.1:5050'
  };

  let activeWorkbench = 'today'; // 'today' | 'week'

  // 專注鎖定與 Kairos 沉浸引擎狀態 (v2.0)
  let focusTimerInterval = null;
  let activeFocusTaskId = null;
  let focusRemainingSeconds = 25 * 60;
  let kairosOnline = false;
  let guardianExtensionOnline = false;
  let kairosSession = {
    status: 'IDLE', // 'IDLE' | 'FOCUSING' | 'PAUSED'
    taskId: null,
    elapsedSeconds: 0,
    startedAt: null,
    accumulatedSeconds: 0,
    currentSliceStart: null,
    pauseResumeNote: ''
  };

  let syncConfig = {
    githubToken: '',
    gistId: '',
    lastSyncTime: null
  };

  // 狀態諮詢會話狀態
  let consultState = {
    selectedPlace: 'home',
    selectedBody: 'mid',
    selectedMind: 'mid',
    selectedTime: 30,
    selectedLater: 'none',
    candidates: [],
    turnsRemaining: 5,
    chatHistory: []
  };

  // 記錄正在 AI 猜測中的卡片 ID
  const analyzingItemIds = new Set();

  // --- 初始化流程 ---
  async function init() {
    loadSettings();
    loadUserState();
    loadSyncConfig();
    applyTheme(settings.theme);
    applySafeTop(settings.safeTop);
    loadItems();
    checkAndResetRoutines();
    await loadRules();
    setupEventListeners();
    setupPWA();
    renderAll();
    checkLockOnStartup();
    checkStartupStatePrompt();
    if (window.location.hash === '#quick_capture' || window.location.search.includes('action=quick_capture')) {
      setTimeout(() => {
        if (window.handleQuickCaptureFromWidget) window.handleQuickCaptureFromWidget();
      }, 350);
    }
  }

  // --- 載入與儲存 ---
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = Object.assign({}, settings, parsed);
        // 向前相容既有設定
        if (typeof parsed.todaySmallLimit !== 'number') {
          settings.todaySmallLimit = 3;
        }
        if (typeof parsed.weekMediumLargeLimit !== 'number') {
          settings.weekMediumLargeLimit = typeof parsed.weekLimit === 'number' ? parsed.weekLimit : 3;
        }
        if (parsed.focusLockEnabled !== undefined) {
          settings.focusLockEnabled = parsed.focusLockEnabled;
        }
        if (parsed.kairosEnabled !== undefined) {
          settings.kairosEnabled = parsed.kairosEnabled;
        }
        if (parsed.kairosUrl) {
          settings.kairosUrl = parsed.kairosUrl;
        }
      }
    } catch (e) {
      console.warn('載入設定失敗:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('儲存設定失敗:', e);
    }
  }

  function loadUserState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER_STATE);
      if (saved) {
        currentUserState = Object.assign({}, currentUserState, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('載入使用者狀態失敗:', e);
    }
  }

  function saveUserState() {
    try {
      localStorage.setItem(STORAGE_KEY_USER_STATE, JSON.stringify(currentUserState));
    } catch (e) {
      console.error('儲存使用者狀態失敗:', e);
    }
  }

  function getTodayDateStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function checkAndResetRoutines() {
    const todayStr = getTodayDateStr();
    let changed = false;
    items.forEach(it => {
      if (it.isRoutine) {
        if (it.lastResetDate !== todayStr) {
          if (it.done) {
            it.done = false;
            it.doneAt = null;
          }
          it.lastResetDate = todayStr;
          it.updatedAt = Date.now();
          changed = true;
        }
      }
    });
    if (changed) {
      saveItems();
    }
  }

  function checkStartupStatePrompt() {
    const elapsed = Date.now() - (currentUserState.updatedAt || 0);
    // 若超過 3.5 小時未更新，或今日剛開工，提示速評當前能量
    if (elapsed > 3.5 * 60 * 60 * 1000) {
      setTimeout(() => {
        showPostTaskCheckin(null, true);
      }, 700);
    }
  }

  function showPostTaskCheckin(taskItem = null, isStartup = false) {
    const checkinEl = document.getElementById('postTaskCheckin');
    const titleEl = document.getElementById('postTaskCheckinTitle');
    if (!checkinEl) return;
    if (isStartup) {
      if (titleEl) titleEl.textContent = '歡迎上桌開工！目前身心能量狀態如何？';
    } else if (taskItem) {
      if (titleEl) titleEl.textContent = `剛完成「${taskItem.text}」！目前感覺如何？`;
    } else {
      if (titleEl) titleEl.textContent = '目前身心能量狀態感覺如何？';
    }
    checkinEl.style.display = 'block';
  }

  function closePostTaskCheckin() {
    const checkinEl = document.getElementById('postTaskCheckin');
    if (checkinEl) checkinEl.style.display = 'none';
  }

  function setUserState(energy, flow) {
    currentUserState.energy = energy;
    currentUserState.flow = flow;
    currentUserState.updatedAt = Date.now();
    saveUserState();
    ambientDismissed = false;
    ambientCurrentIndex = 0;
    closePostTaskCheckin();
    renderAmbientSuggestion();
    const stateLabels = {
      'high_smooth': '充沛 · 順暢',
      'high_stuck': '充沛 · 卡關',
      'low_smooth': '疲憊 · 順暢',
      'low_stuck': '疲憊 · 卡關'
    };
    const key = `${energy}_${flow}`;
    showToast(`狀態已更新為【${stateLabels[key] || ''}】，推薦條已同步調整`);
  }

  function loadSyncConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SYNC);
      if (saved) {
        syncConfig = Object.assign({}, syncConfig, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('載入同步設定失敗:', e);
    }
  }

  function saveSyncConfig() {
    try {
      localStorage.setItem(STORAGE_KEY_SYNC, JSON.stringify(syncConfig));
    } catch (e) {
      console.error('儲存同步設定失敗:', e);
    }
  }

  // --- 任務大小與耗時預估 (試水溫 5-10m / 小 15-30m / 中 1-2h / 大 2h+) ---
  function guessSize(text, typeId) {
    if (!text) return 'micro';
    const lower = text.toLowerCase();

    // 大任務關鍵詞 (2h+ 深度專案、論文、重大工作)
    const largeKeywords = [
      '論文', '專案', '專題', '架構', '重構', '期末', '考科', '大掃除',
      '整天', '全天', '系統設計', '複習全部', '完整', '大批'
    ];
    for (const kw of largeKeywords) {
      if (lower.includes(kw)) return 'large';
    }
    if (typeId === 'bulk_organize') return 'large';

    // 中任務關鍵詞 (1-2h 專注時段)
    const mediumKeywords = [
      '寫程式', '研究', '組裝', '測試', '實驗', '修繕', '製作', '重訓',
      '運動', '跑步', '閱讀', '章節', '練習', 'code', 'coding', '報告', '讀書'
    ];
    for (const kw of mediumKeywords) {
      if (lower.includes(kw)) return 'medium';
    }
    if (typeId === 'deep_focus' || typeId === 'hands_on' || typeId === 'physical') {
      return 'medium';
    }

    // 常規小任務關鍵詞 (15-30m 具體行政瑣事、回信、繳費、打電話、採買)
    const smallKeywords = [
      '回信', '郵件', '繳費', '打電話', '聯絡', '通知', '採買', '買', '匯款', '填表', '預約', '洗衣服', '丟垃圾'
    ];
    for (const kw of smallKeywords) {
      if (lower.includes(kw)) return 'small';
    }
    if (typeId === 'admin' || typeId === 'errand') {
      return 'small';
    }

    // 若無法明確估算或內容模糊：自動設為「試水溫 5-10m」，零壓力破除起步阻力
    return 'micro';
  }

  // 切換「今日」與「本週」工作桌
  function switchWorkbench(target) {
    activeWorkbench = target === 'week' ? 'week' : 'today';
    const tabToday = document.getElementById('tabWorkbenchToday');
    const tabWeek = document.getElementById('tabWorkbenchWeek');
    const secToday = document.getElementById('sectionToday');
    const secWeek = document.getElementById('sectionWeek');

    if (activeWorkbench === 'today') {
      if (tabToday) {
        tabToday.classList.add('active');
        tabToday.setAttribute('aria-selected', 'true');
      }
      if (tabWeek) {
        tabWeek.classList.remove('active');
        tabWeek.setAttribute('aria-selected', 'false');
      }
      if (secToday) secToday.style.display = 'block';
      if (secWeek) secWeek.style.display = 'none';
    } else {
      if (tabToday) {
        tabToday.classList.remove('active');
        tabToday.setAttribute('aria-selected', 'false');
      }
      if (tabWeek) {
        tabWeek.classList.add('active');
        tabWeek.setAttribute('aria-selected', 'true');
      }
      if (secToday) secToday.style.display = 'none';
      if (secWeek) secWeek.style.display = 'block';
    }
  }

  function loadItems() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (saved) {
        items = JSON.parse(saved);
        // 確保每個任務都有 size, quadrant, deadline 屬性
        items.forEach(it => {
          if (!it.size) {
            it.size = guessSize(it.text, it.typeId);
          }
          if (!it.quadrant) {
            it.quadrant = getComputedQuadrant(it);
          }
          if (it.deadline === undefined) {
            it.deadline = null;
          }
        });
      }
    } catch (e) {
      console.warn('載入任務失敗:', e);
      items = [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
      syncToAndroidWidgets();
    } catch (e) {
      console.error('儲存任務失敗:', e);
    }
  }

  // 同步任務資料至 Android 原生小工具 (Widgets)
  function syncToAndroidWidgets() {
    try {
      if (window.AndroidWidgetBridge && typeof window.AndroidWidgetBridge.updateWidgetsData === 'function') {
        const payload = {
          items: items,
          todaySmallLimit: settings.todaySmallLimit || 3,
          weekMediumLargeLimit: settings.weekMediumLargeLimit || 3
        };
        window.AndroidWidgetBridge.updateWidgetsData(JSON.stringify(payload));
      }
    } catch (err) {
      console.warn('Android Widget 同步略過或尚未就緒:', err);
    }
  }

  // 接收來自 Android Widget 的快速記錄觸發
  window.handleQuickCaptureFromWidget = function () {
    const quickInput = document.getElementById('inputQuickTask');
    if (quickInput) {
      quickInput.focus();
      quickInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('快速記錄模式：請輸入任務名稱');
    }
  };

  async function loadRules() {
    try {
      const res = await fetch('./rules.json');
      if (res.ok) {
        const data = await res.json();
        if (data && data.taskTypes) {
          rules = data;
        }
      }
    } catch (e) {
      console.info('使用內建預設規則對照表:', e);
    }
  }

  // --- 主題切換 ---
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // 手機頂部避讓前鏡頭挖孔
  function applySafeTop(val) {
    const top = parseInt(val, 10) || 56;
    document.documentElement.style.setProperty('--app-safe-top', `${top}px`);
  }

  // --- 存取密碼鎖 (PIN Lock) ---
  let isLocked = false;

  async function hashPin(pin) {
    if (!pin) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_taskdesk_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function checkLockOnStartup() {
    const btnLock = document.getElementById('btnLockApp');
    const menuItemLock = document.getElementById('menuItemLock');
    if (settings.pinLock && settings.pinHash) {
      if (btnLock) btnLock.style.display = 'flex';
      if (menuItemLock) menuItemLock.style.display = 'flex';
      lockApp();
    } else {
      if (btnLock) btnLock.style.display = 'none';
      if (menuItemLock) menuItemLock.style.display = 'none';
    }
  }

  function lockApp() {
    isLocked = true;
    const overlay = document.getElementById('lockScreenOverlay');
    const input = document.getElementById('inputUnlockPin');
    if (overlay) {
      overlay.style.display = 'flex';
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 80);
      }
    }
  }

  async function unlockApp() {
    const input = document.getElementById('inputUnlockPin');
    const overlay = document.getElementById('lockScreenOverlay');
    const card = overlay.querySelector('.lock-screen-card');
    const entered = input.value;
    const enteredHash = await hashPin(entered);

    if (enteredHash === settings.pinHash) {
      isLocked = false;
      overlay.style.display = 'none';
      input.value = '';
      showToast('工作桌已解鎖');
    } else {
      if (card) {
        card.classList.remove('lock-shake');
        void card.offsetWidth;
        card.classList.add('lock-shake');
      }
      showToast('密碼錯誤，請重新輸入');
      input.value = '';
      input.focus();
    }
  }

  // --- PWA 註冊 ---
  function setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.info('ServiceWorker 註冊通知:', err);
        });
      });
    }
  }

  // --- 輔助工具函式 ---
  function generateId() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function showToast(message, duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease-out';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function getTypeById(typeId) {
    if (!typeId) return null;
    return rules.taskTypes.find(t => t.id === typeId) || null;
  }

  // 本機關鍵字猜測備案
  function guessTypeByKeywords(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const type of rules.taskTypes) {
      if (type.keywords && Array.isArray(type.keywords)) {
        for (const kw of type.keywords) {
          if (lower.includes(kw.toLowerCase())) {
            return type.id;
          }
        }
      }
    }
    return null;
  }

  // 取得母任務對應的所有子任務
  function getSubtasks(parentId) {
    return items.filter(it => it.parentId === parentId);
  }

  // 取得本週已完成頂層任務數量
  function getWeekCompletedCount() {
    const now = new Date();
    const currentWeekKey = getWeekKey(now);
    return items.filter(it => it.done && !it.parentId && it.doneAt && getWeekKey(new Date(it.doneAt)) === currentWeekKey).length;
  }

  function getWeekKey(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
    return `${target.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function getWeekDateRangeStr(weekKey) {
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    // 計算該週週一
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

    const f = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return `${f(ISOweekStart)} - ${f(ISOweekEnd)}`;
  }

  // --- 批次輸入解析 (支援換行純文字、縮排子任務、符號分割、及 Google Tasks Takeout JSON) ---
  function parseBatchInput(rawText, onlyUncompleted = true) {
    if (!rawText || !rawText.trim()) return [];
    const trimmed = rawText.trim();

    // 嘗試解析 JSON (例如 Google Tasks Takeout 或陣列)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const tasksFound = [];

        function processTaskObject(task, isSub = false) {
          if (!task) return;
          if (onlyUncompleted && (task.status === 'completed' || task.done === true)) {
            return;
          }
          const title = task.title || task.text || task.name || task.summary || '';
          if (typeof title === 'string' && title.trim()) {
            let fullText = title.trim();
            if (task.notes && typeof task.notes === 'string' && task.notes.trim()) {
              fullText += ` (${task.notes.trim()})`;
            }
            tasksFound.push({ text: fullText, isSubtask: isSub });
          }
          if (Array.isArray(task.items) || Array.isArray(task.subtasks)) {
            const subItems = task.items || task.subtasks;
            subItems.forEach(st => processTaskObject(st, true));
          }
        }

        if (Array.isArray(parsed)) {
          parsed.forEach(it => {
            if (typeof it === 'string' && it.trim()) {
              tasksFound.push({ text: it.trim(), isSubtask: false });
            } else if (typeof it === 'object') {
              processTaskObject(it, !!(it.parent || it.parentId));
            }
          });
        } else if (typeof parsed === 'object') {
          // Google Takeout tasks#taskLists 格式
          if (Array.isArray(parsed.items)) {
            parsed.items.forEach(item => {
              if (Array.isArray(item.items)) {
                item.items.forEach(t => processTaskObject(t, !!(t.parent || t.parentId)));
              } else {
                processTaskObject(item, !!(item.parent || item.parentId));
              }
            });
          }
        }

        if (tasksFound.length > 0) {
          return tasksFound;
        }
      } catch (e) {
        // 非有效 JSON，繼續進行常規純文字拆解
      }
    }

    // 若包含換行符號：按行解析並識別縮排（Tab 或 2+ 空格）為子任務
    if (/[\r\n]/.test(rawText)) {
      const rawLines = rawText.split(/\r?\n/);
      const result = [];
      for (const line of rawLines) {
        if (!line.trim()) continue;
        const indentMatch = line.match(/^([ \t]+)/);
        const isIndented = !!(indentMatch && (indentMatch[1].includes('\t') || indentMatch[1].length >= 2));
        let clean = line.trim();
        clean = clean.replace(/^[-*•]\s+/, '').replace(/^\d+[\.、]\s*/, '').trim();
        if (clean.length > 0) {
          result.push({ text: clean, isSubtask: isIndented });
        }
      }
      return result;
    }

    // 若無換行符號：依頓號、逗號、分號分割為單層獨立任務
    const parts = rawText.split(/[、，,；;]+/);
    const result = [];
    for (let part of parts) {
      part = part.trim();
      part = part.replace(/^[-*•]\s+/, '').replace(/^\d+[\.、]\s*/, '').trim();
      if (part.length > 0) {
        result.push({ text: part, isSubtask: false });
      }
    }
    return result;
  }

  // --- 核心業務邏輯：新增項目 ---
  async function addItemsToInbox(rawTexts, explicitSize, explicitQuadrant, explicitDeadline) {
    if (!rawTexts || rawTexts.length === 0) return;

    const newItems = [];
    let currentParentItem = null;

    for (let rawElem of rawTexts) {
      let text = typeof rawElem === 'string' ? rawElem : (rawElem.text || '');
      const isSubtask = typeof rawElem === 'object' ? !!rawElem.isSubtask : false;
      if (!text || !text.trim()) continue;

      let parsedQuadrant = explicitQuadrant || null;
      let parsedDeadline = explicitDeadline || null;

      let isDone = false;
      if (/^\[[xX✓]\]\s*/.test(text) || /#done\b/i.test(text)) {
        isDone = true;
        text = text.replace(/^\[[xX✓]\]\s*/, '').replace(/#done\b/i, '').trim();
      }

      // 支援文字中解析標籤如 #q1, #q2, #q3, #q4
      const qMatch = text.match(/#(q[1-4])/i);
      if (qMatch) {
        parsedQuadrant = qMatch[1].toLowerCase();
        text = text.replace(qMatch[0], '').trim();
      }

      // 支援文字中解析死線如 #deadline:2026-10-15 或 #2026-10-15
      const dlMatch = text.match(/#deadline:(\d{4}-\d{2}-\d{2})/i) || text.match(/#(\d{4}-\d{2}-\d{2})/);
      if (dlMatch) {
        parsedDeadline = dlMatch[1];
        text = text.replace(dlMatch[0], '').trim();
      }

      let isRoutine = isCaptureRoutineActive;
      if (/#routine\b/i.test(text) || /#習慣\b/.test(text)) {
        isRoutine = true;
        text = text.replace(/#routine\b/i, '').replace(/#習慣\b/, '').trim();
      }

      // 判定是否作為子任務放入 currentParentItem
      const parentIdToUse = (isSubtask && currentParentItem) ? currentParentItem.id : null;
      const targetBucket = (parentIdToUse && currentParentItem) ? currentParentItem.bucket : (isRoutine ? 'keep' : 'inbox');

      // 立即使用本機關鍵字備案作為初值
      const keywordGuessedType = guessTypeByKeywords(text);
      const isAuto = (!explicitSize || explicitSize === 'auto');
      const itemSize = parentIdToUse ? 'micro' : (isAuto ? guessSize(text, keywordGuessedType) : explicitSize);
      const item = {
        id: generateId(),
        text: text,
        size: itemSize, // 'micro' | 'small' | 'medium' | 'large'
        bucket: targetBucket,
        isNow: false,
        done: isDone,
        doneAt: isDone ? Date.now() : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        typeId: keywordGuessedType,
        typeSource: keywordGuessedType ? 'rule' : 'ai',
        parentId: parentIdToUse,
        aiGenerated: false,
        manualQuadrant: parsedQuadrant,
        quadrant: parsedQuadrant || getComputedQuadrant({ text: text, size: itemSize, deadline: parsedDeadline }),
        deadline: parsedDeadline || null,
        isRoutine: isRoutine,
        routineTrigger: isRoutine ? 'recharge' : null,
        routineCadence: isRoutine ? 'daily' : null,
        lastResetDate: isRoutine ? getTodayDateStr() : null
      };
      items.push(item);
      newItems.push(item);

      if (!parentIdToUse) {
        currentParentItem = item;
      }
    }

    saveItems();
    renderAll();
  }

  // 明確指定某項目為「現在做這個」（清除其他現在，並自動移入有效工作桌）
  function setAsNow(itemId) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    items.forEach(it => {
      it.isNow = false;
    });
    item.isNow = true;
    item.updatedAt = Date.now();

    // 若不在今日也不在週工作桌，自動移入目前開啟的工作桌
    if (item.bucket !== 'today' && item.bucket !== 'week') {
      item.bucket = activeWorkbench === 'week' ? 'week' : 'today';
    }

    saveItems();
    renderAll();
  }

  // --- 分堆與狀態移動 ---
  function moveItemBucket(itemId, targetBucket) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    item.updatedAt = Date.now();
    const itemSize = item.size || guessSize(item.text, item.typeId);

    if (targetBucket === 'today') {
      // 檢查「今日」小任務與試水溫上限（母任務僅算一件頂層項目）
      if (itemSize === 'small' || itemSize === 'micro') {
        const currentTodaySmallCount = items.filter(it => 
          it.bucket === 'today' && !it.parentId && !it.done && 
          ['small', 'micro'].includes(it.size || guessSize(it.text, it.typeId))
        ).length;

        if (item.bucket !== 'today' && currentTodaySmallCount >= settings.todaySmallLimit) {
          showToast(`今日小任務/試水溫已滿 ${settings.todaySmallLimit} 件，要先移走一件或完成一件`);
          return;
        }
      }
    } else if (targetBucket === 'week') {
      // 檢查「這週」中與大任務上限
      if (itemSize === 'medium' || itemSize === 'large') {
        const currentWeekMedLargeCount = items.filter(it => 
          it.bucket === 'week' && !it.parentId && !it.done && 
          ['medium', 'large'].includes(it.size || guessSize(it.text, it.typeId))
        ).length;

        if (item.bucket !== 'week' && currentWeekMedLargeCount >= settings.weekMediumLargeLimit) {
          showToast(`這週中/大任務已滿 ${settings.weekMediumLargeLimit} 件，要先移走一件或完成一件`);
          return;
        }
      }
    } else {
      // 若移出「今日」與「這週」，取消其「現在」標記
      if (item.isNow) {
        item.isNow = false;
      }
    }

    item.bucket = targetBucket;

    // 連動子任務的 bucket
    const subtasks = getSubtasks(item.id);
    subtasks.forEach(sub => {
      sub.bucket = targetBucket;
      sub.updatedAt = Date.now();
    });

    saveItems();
    renderAll();
  }

  // 切換「現在做這個」（全域最多一個）
  function toggleItemNow(itemId) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    if (item.isNow) {
      item.isNow = false;
    } else {
      // 先取消其他所有項目的 isNow
      items.forEach(it => {
        it.isNow = false;
      });
      item.isNow = true;

      // 若該項目不在「今日」也不在「這週」，移入當前開啟的工作桌
      if (item.bucket !== 'today' && item.bucket !== 'week') {
        const targetBucket = activeWorkbench === 'week' ? 'week' : 'today';
        const itemSize = item.size || guessSize(item.text, item.typeId);

        if (targetBucket === 'today' && (itemSize === 'small' || itemSize === 'micro')) {
          const currentTodaySmallCount = items.filter(it => 
            it.bucket === 'today' && !it.parentId && !it.done && 
            ['small', 'micro'].includes(it.size || guessSize(it.text, it.typeId))
          ).length;
          if (currentTodaySmallCount >= settings.todaySmallLimit) {
            showToast(`今日小任務/試水溫已滿 ${settings.todaySmallLimit} 件，無法將此項目移至今日`);
            item.isNow = false;
            saveItems();
            renderAll();
            return;
          }
        } else if (targetBucket === 'week' && (itemSize === 'medium' || itemSize === 'large')) {
          const currentWeekMedLargeCount = items.filter(it => 
            it.bucket === 'week' && !it.parentId && !it.done && 
            ['medium', 'large'].includes(it.size || guessSize(it.text, it.typeId))
          ).length;
          if (currentWeekMedLargeCount >= settings.weekMediumLargeLimit) {
            showToast(`這週中/大任務已滿 ${settings.weekMediumLargeLimit} 件，無法將此項目移至這週`);
            item.isNow = false;
            saveItems();
            renderAll();
            return;
          }
        }
        item.bucket = targetBucket;
      }
    }

    item.updatedAt = Date.now();
    saveItems();
    renderAll();
  }

  // 完成與反完成切換
  function toggleItemDone(itemId, isChecked) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    const cardEl = document.querySelector(`[data-card-id="${itemId}"]`);
    if (cardEl) {
      cardEl.classList.add('is-completing');
    }

    setTimeout(() => {
      item.done = isChecked;
      item.doneAt = isChecked ? Date.now() : null;
      item.updatedAt = Date.now();
      if (isChecked && item.isNow) {
        item.isNow = false;
      }

      // 若為母任務：一併更新所有子任務
      if (!item.parentId) {
        const subtasks = getSubtasks(item.id);
        subtasks.forEach(sub => {
          sub.done = isChecked;
          sub.doneAt = isChecked ? Date.now() : null;
          sub.updatedAt = Date.now();
        });
      } else {
        // 若為子任務：檢查母任務的所有子任務是否皆完成
        const parent = items.find(it => it.id === item.parentId);
        if (parent) {
          const siblings = getSubtasks(parent.id);
          const allSubsDone = siblings.length > 0 && siblings.every(s => s.done);
          if (allSubsDone) {
            parent.done = true;
            parent.doneAt = Date.now();
            parent.updatedAt = Date.now();
            if (parent.isNow) parent.isNow = false;
          } else if (!isChecked && parent.done) {
            // 若子任務取消打勾，母任務亦恢復未完成
            parent.done = false;
            parent.doneAt = null;
            parent.updatedAt = Date.now();
          }
        }
      }

      saveItems();
      renderAll();
      if (isChecked) {
        if (item.isRoutine) {
          item.lastResetDate = getTodayDateStr();
          showToast(`已完成今日習慣「${item.text}」！明天將自動重設`);
        } else {
          showToast(`已完成「${item.text}」，已永久歸檔至歷史檔案庫`);
        }
        if (!item.parentId) {
          setTimeout(() => {
            showPostTaskCheckin(item, false);
          }, 350);
        }
      }
    }, 200);
  }

  // 刪除項目
  function deleteItem(itemId) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    // 同步刪除子任務
    items = items.filter(it => it.id !== itemId && it.parentId !== itemId);
    saveItems();
    renderAll();
  }

  // 手動新增子任務
  function addSubtask(parentId, subText) {
    if (!subText || !subText.trim()) return;
    const parent = items.find(it => it.id === parentId);
    if (!parent) return;

    items.push({
      id: generateId(),
      text: subText.trim(),
      size: 'small',
      bucket: parent.bucket,
      isNow: false,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      typeId: parent.typeId,
      typeSource: 'user',
      parentId: parent.id,
      aiGenerated: false
    });

    // 若原本母任務是完成的，新增未完成子任務後母任務恢復未完成
    if (parent.done) {
      parent.done = false;
      parent.doneAt = null;
    }
    parent.updatedAt = Date.now();

    saveItems();
    renderAll();
  }

  // 更新項目類型（手動更正）
  function updateItemType(itemId, newTypeId) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    item.typeId = newTypeId;
    item.typeSource = 'user'; // 使用者手動設定，不會被之後的 AI 覆蓋
    item.updatedAt = Date.now();

    // 連動未設定類型之子任務
    const subtasks = getSubtasks(item.id);
    subtasks.forEach(sub => {
      if (sub.typeSource !== 'user') {
        sub.typeId = newTypeId;
        sub.updatedAt = Date.now();
      }
    });

    saveItems();
    renderAll();
  }

  // --- 狀態諮詢演算法 (幫我選) ---
  const LEVEL_WEIGHTS = { low: 1, mid: 2, high: 3 };

  function matchCondition(taskType, userState) {
    // 若無類型或未分類，一律視為符合
    if (!taskType) return true;

    const uMind = LEVEL_WEIGHTS[userState.mind] || 2;
    const rMind = LEVEL_WEIGHTS[taskType.minMind] || 1;
    if (uMind < rMind) return false;

    const uBody = LEVEL_WEIGHTS[userState.body] || 2;
    const rBody = LEVEL_WEIGHTS[taskType.minBody] || 1;
    if (uBody < rBody) return false;

    // 可用時間計算（若 1 小時內有事，最多算 60 分鐘）
    let availableTime = userState.time;
    if (userState.later === 'within1h') {
      availableTime = Math.min(availableTime, 60);
    }
    if (availableTime < (taskType.minTime || 0)) return false;

    // 地點判斷
    if (taskType.places && !taskType.places.includes('any')) {
      if (!taskType.places.includes(userState.place)) {
        return false;
      }
    }

    return true;
  }

  function getConsultCandidates(userState) {
    // 取得候選庫：未完成的「這週」項目（及可選的「保溫」項目）
    const candidateTopItems = items.filter(it => {
      if (it.done || it.parentId) return false;
      if (it.bucket === 'today' || it.bucket === 'week') return true;
      if (settings.includeKeepInConsult && it.bucket === 'keep') return true;
      return false;
    });

    const matchedEntries = [];

    for (const item of candidateTopItems) {
      const subtasks = getSubtasks(item.id).filter(s => !s.done);
      if (subtasks.length > 0) {
        // 若有未完成子任務，個別比對
        for (const sub of subtasks) {
          const effectiveTypeId = sub.typeId || item.typeId;
          const typeObj = getTypeById(effectiveTypeId);
          if (matchCondition(typeObj, userState)) {
            matchedEntries.push({
              id: item.id,
              subtaskId: sub.id,
              displayText: `${item.text} › ${sub.text}`,
              typeId: effectiveTypeId,
              itemRef: item
            });
          }
        }
      } else {
        // 無子任務，比對母任務本身
        const typeObj = getTypeById(item.typeId);
        if (matchCondition(typeObj, userState)) {
          matchedEntries.push({
            id: item.id,
            subtaskId: null,
            displayText: item.text,
            typeId: item.typeId,
            itemRef: item
          });
        }
      }
    }

    return matchedEntries;
  }

  // --- 專注鎖定與 Kairos 本機專注守護系統 ---
  function getTaskFocusDurationMinutes(item) {
    if (!item) return 25;
    if (typeof item.estimateMinutes === 'number' && item.estimateMinutes > 0) {
      return item.estimateMinutes;
    }
    const size = item.size || guessSize(item.text, item.typeId);
    if (size === 'micro') return 10;
    if (size === 'small') return 25;
    if (size === 'medium') return 50;
    if (size === 'large') return 90;
    return 25;
  }

  async function notifyKairosFocusStart(item, minutes) {
    if (!settings.kairosEnabled || !settings.kairosUrl) return;
    const targetUrl = settings.kairosUrl.replace(/\/$/, '');
    try {
      const resp = await fetch(`${targetUrl}/api/pomodoro/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'focus',
          duration_minutes: minutes || 25,
          task_name: item ? item.text : 'TaskDesk Focus'
        })
      });
      if (resp.ok) {
        kairosOnline = true;
      } else {
        kairosOnline = false;
      }
    } catch (err) {
      console.warn('無法連線至 Kairos (可能未啟動或非本地環境):', err);
      kairosOnline = false;
    }
    updateFocusGuardStatusBadge();
  }

  async function notifyKairosFocusStop() {
    if (!settings.kairosEnabled || !settings.kairosUrl) return;
    const targetUrl = settings.kairosUrl.replace(/\/$/, '');
    try {
      await fetch(`${targetUrl}/api/pomodoro/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.warn('無法通知 Kairos 重設:', err);
    }
  }

  async function testKairosConnection(url) {
    const targetUrl = (url || settings.kairosUrl || 'http://127.0.0.1:5050').replace(/\/$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        kairosOnline = true;
        return { success: true, message: '連線成功！Kairos 本機專注守護服務正常運行中。' };
      }
      return { success: false, message: `連線失敗 (HTTP ${res.status})，請確認 Kairos 狀態。` };
    } catch (err) {
      kairosOnline = false;
      return { success: false, message: '無法連線至 Kairos。請確認本機已執行 Kairos (python api.py)。' };
    }
  }

  // --- Kairos 沉浸引擎日誌與工時記錄 (v2.0) ---
  function getFocusSessions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FOCUS_SESSIONS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  function logFocusSession(item, elapsedSeconds, status, reason = '') {
    try {
      const logs = getFocusSessions();
      const record = {
        id: generateId(),
        taskId: item ? item.id : null,
        taskText: item ? item.text : '未知任務',
        startedAt: kairosSession.startedAt || (Date.now() - (elapsedSeconds || 0) * 1000),
        endedAt: Date.now(),
        elapsedSeconds: Math.max(0, elapsedSeconds || 0),
        elapsedMinutes: Math.round(((elapsedSeconds || 0) / 60) * 10) / 10,
        status: status, // 'COMPLETED' | 'ABORTED_TOO_LARGE' | 'ABORTED_POSTPONE' | 'ABORTED_QUIT'
        reason: reason || '',
        note: kairosSession.pauseResumeNote || ''
      };
      logs.unshift(record);
      if (logs.length > 500) logs.length = 500;
      localStorage.setItem(STORAGE_KEY_FOCUS_SESSIONS, JSON.stringify(logs));
    } catch (e) {
      console.warn('儲存專注紀錄失敗:', e);
    }
  }

  function formatElapsedMinutes(sec) {
    const m = Math.floor(sec / 60);
    return `${String(m).padStart(2, '0')}m`;
  }

  function updateKairosTimerDisplay() {
    const el = document.getElementById('kairosTimerDisplay');
    if (el) {
      el.textContent = formatElapsedMinutes(kairosSession.elapsedSeconds);
    }
    // 相容舊版 banner
    const oldEl = document.getElementById('focusTimerDisplay');
    if (oldEl) {
      oldEl.textContent = formatElapsedMinutes(kairosSession.elapsedSeconds);
    }
  }

  function broadcastFocusToExtension(action, payload) {
    try {
      window.postMessage({
        type: 'TASKDESK_FOCUS_EVENT',
        action: action,
        payload: payload || null
      }, '*');
    } catch (e) {}
  }

  function updateFocusGuardStatusBadge() {
    const badge = document.getElementById('focusGuardStatusBadge');
    if (!badge) return;
    if (window.AndroidWidgetBridge && typeof window.AndroidWidgetBridge.isAccessibilityGranted === 'function') {
      try {
        const granted = window.AndroidWidgetBridge.isAccessibilityGranted();
        if (granted) {
          badge.textContent = 'Android 守護中 (已阻擋分心 App)';
          badge.style.color = '#2dd4bf';
          badge.style.borderColor = 'rgba(45, 212, 191, 0.4)';
          return;
        } else {
          badge.textContent = 'Android 守護未授權 (請至設定開啟)';
          badge.style.color = '#f59e0b';
          badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          return;
        }
      } catch (e) {}
    }
    if (guardianExtensionOnline) {
      badge.textContent = 'Guardian 擴充守護中 (已阻擋分心網站)';
      badge.style.color = '#2dd4bf';
      badge.style.borderColor = 'rgba(45, 212, 191, 0.4)';
    } else if (settings.kairosEnabled) {
      if (kairosOnline) {
        badge.textContent = 'Kairos 本機守護中';
        badge.style.color = '#38bdf8';
        badge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      } else {
        badge.textContent = 'Kairos 離線/未連線';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      }
    } else {
      badge.textContent = '站內專注鎖定中';
      badge.style.color = 'var(--accent-primary)';
      badge.style.borderColor = 'rgba(14, 165, 233, 0.3)';
    }
  }

  // Done 完成時的微慶祝動畫 (Web Audio + CSS Particles)
  function triggerMicroCelebration() {
    const container = document.getElementById('kairosCelebration');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'block';

    const colors = ['#10b981', '#38bdf8', '#fbbf24', '#a855f7', '#ec4899', '#34d399', '#60a5fa'];
    const count = 36;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'kairos-celebration-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
      const dist = 120 + Math.random() * 260;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - (30 + Math.random() * 60);
      p.style.left = `${cx}px`;
      p.style.top = `${cy}px`;
      p.style.setProperty('--dx', `${dx}px`);
      p.style.setProperty('--dy', `${dy}px`);
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = `${0.65 + Math.random() * 0.4}s`;
      container.appendChild(p);
    }

    // Web Audio 柔和慶祝和弦
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.36);
        });
      }
    } catch (e) {}

    setTimeout(() => {
      container.style.display = 'none';
      container.innerHTML = '';
    }, 1200);
  }

  function syncKairosElapsedSeconds() {
    if (kairosSession.status === 'FOCUSING' && kairosSession.currentSliceStart) {
      const slice = Math.max(0, Math.floor((Date.now() - kairosSession.currentSliceStart) / 1000));
      kairosSession.elapsedSeconds = (kairosSession.accumulatedSeconds || 0) + slice;
    } else {
      kairosSession.elapsedSeconds = kairosSession.accumulatedSeconds || 0;
    }
  }

  function startFocusTimer(item) {
    if (focusTimerInterval) {
      clearInterval(focusTimerInterval);
      focusTimerInterval = null;
    }
    const now = Date.now();
    activeFocusTaskId = item.id;
    kairosSession.status = 'FOCUSING';
    kairosSession.taskId = item.id;
    kairosSession.accumulatedSeconds = 0;
    kairosSession.currentSliceStart = now;
    kairosSession.startedAt = now;
    kairosSession.elapsedSeconds = 0;
    kairosSession.pauseResumeNote = '';

    updateKairosTimerDisplay();

    const durMinutes = getTaskFocusDurationMinutes(item);
    if (settings.kairosEnabled) {
      notifyKairosFocusStart(item, durMinutes);
    }
    broadcastFocusToExtension('START', {
      id: item.id,
      text: item.text,
      durMinutes: durMinutes,
      startedAt: now
    });
    if (window.AndroidWidgetBridge && typeof window.AndroidWidgetBridge.setFocusActive === 'function') {
      try {
        window.AndroidWidgetBridge.setFocusActive(true, item.text);
      } catch (e) {}
    }

    focusTimerInterval = setInterval(() => {
      if (kairosSession.status === 'FOCUSING') {
        syncKairosElapsedSeconds();
        updateKairosTimerDisplay();
      }
    }, 1000);
  }

  function stopFocusTimer() {
    syncKairosElapsedSeconds();
    if (focusTimerInterval) {
      clearInterval(focusTimerInterval);
      focusTimerInterval = null;
    }
    activeFocusTaskId = null;
    kairosSession.status = 'IDLE';
    kairosSession.taskId = null;
    kairosSession.currentSliceStart = null;
    if (settings.kairosEnabled) {
      notifyKairosFocusStop();
    }
    broadcastFocusToExtension('STOP');
    if (window.AndroidWidgetBridge && typeof window.AndroidWidgetBridge.setFocusActive === 'function') {
      try {
        window.AndroidWidgetBridge.setFocusActive(false, '');
      } catch (e) {}
    }
  }

  // 渲染 Kairos 全頁沉浸 Overlay
  function renderFocusLockBanner() {
    const overlay = document.getElementById('kairosOverlay');
    const dock = document.getElementById('deskDrawersDock');
    const nowItem = items.find(it => it.isNow && !it.done);

    if (nowItem && settings.focusLockEnabled) {
      if (overlay) overlay.style.display = 'flex';
      document.body.classList.add('body-focus-active');
      document.body.classList.add('body-kairos-active');
      if (dock) dock.classList.add('locked-by-focus');

      const titleEl = document.getElementById('focusTaskTitle');
      const metaEl = document.getElementById('focusTaskMeta');
      if (titleEl) titleEl.textContent = nowItem.text;

      const typeObj = getTypeById(nowItem.typeId);
      const quadInfo = getQuadrantInfo(nowItem);
      const durMinutes = getTaskFocusDurationMinutes(nowItem);
      const sizeLabels = { micro: '試水溫 5-10m', small: '小 15-30m', medium: '中 1-2h', large: '大 2h+' };
      const sizeText = sizeLabels[nowItem.size || 'micro'] || '試水溫';
      if (metaEl) {
        metaEl.textContent = `${sizeText} (${durMinutes}m) · ${quadInfo ? quadInfo.badge : '核心深耕'} · ${typeObj ? typeObj.name : '未分類'}`;
      }

      // 渲染子任務 Checklist
      const subtasksWrap = document.getElementById('kairosSubtasksWrap');
      if (subtasksWrap) {
        const subtasks = getSubtasks(nowItem.id);
        if (subtasks.length > 0) {
          subtasksWrap.style.display = 'flex';
          subtasksWrap.innerHTML = '';
          subtasks.forEach(sub => {
            const row = document.createElement('label');
            row.className = `kairos-subtask-item ${sub.done ? 'done' : ''}`;
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'kairos-subtask-check';
            chk.checked = !!sub.done;
            chk.addEventListener('change', () => {
              toggleItemDone(sub.id, chk.checked);
            });
            const txt = document.createElement('span');
            txt.className = 'kairos-subtask-title';
            txt.textContent = sub.text;
            row.appendChild(chk);
            row.appendChild(txt);
            subtasksWrap.appendChild(row);
          });
        } else {
          subtasksWrap.style.display = 'none';
        }
      }

      if (activeFocusTaskId !== nowItem.id) {
        startFocusTimer(nowItem);
        if (!localStorage.getItem('taskdesk_focus_hint_seen')) {
          showToast('已進入單工專注：底層工作桌已暫時鎖定。您可隨時點暫停、結束專注，或按 Ctrl+K 隨手記雜念。');
          localStorage.setItem('taskdesk_focus_hint_seen', 'true');
        }
      }
      updateFocusGuardStatusBadge();
    } else {
      if (overlay) overlay.style.display = 'none';
      document.body.classList.remove('body-focus-active');
      document.body.classList.remove('body-kairos-active');
      if (dock) dock.classList.remove('locked-by-focus');
      if (activeFocusTaskId) {
        stopFocusTimer();
      }
    }
  }

  // --- Kairos 沉浸模式動作處理器 (Done / Pause / Resume / Abort / Brain Dump) ---
  function handleKairosDone() {
    syncKairosElapsedSeconds();
    const nowItem = items.find(it => it.isNow && !it.done);
    if (!nowItem) return;
    const elapsed = kairosSession.elapsedSeconds;
    logFocusSession(nowItem, elapsed, 'COMPLETED');
    triggerMicroCelebration();
    toggleItemDone(nowItem.id, true);

    const overlay = document.getElementById('kairosOverlay');
    if (overlay) {
      overlay.classList.add('kairos-exiting');
      setTimeout(() => {
        overlay.classList.remove('kairos-exiting');
        renderAll();
      }, 280);
    } else {
      renderAll();
    }
    const minText = Math.floor(elapsed / 60);
    showToast(`辛苦了！本次專注 ${minText > 0 ? minText + ' 分鐘' : elapsed + ' 秒'}。做得好！建議稍作休息伸展。`);
  }

  function handleKairosPause() {
    if (kairosSession.status === 'FOCUSING' && kairosSession.currentSliceStart) {
      kairosSession.accumulatedSeconds += Math.max(0, Math.floor((Date.now() - kairosSession.currentSliceStart) / 1000));
      kairosSession.currentSliceStart = null;
    }
    kairosSession.status = 'PAUSED';
    syncKairosElapsedSeconds();
    broadcastFocusToExtension('PAUSE');

    const overlay = document.getElementById('kairosOverlay');
    const breathing = document.getElementById('kairosBreathingState');
    const actions = document.getElementById('kairosActions');
    const statusLabel = document.getElementById('kairosStatusLabel');
    if (overlay) overlay.classList.add('is-paused');
    if (breathing) breathing.style.display = 'flex';
    if (actions) actions.style.display = 'none';
    if (statusLabel) statusLabel.textContent = '暫停中';
    const resumeNoteInput = document.getElementById('kairosResumeNote');
    if (resumeNoteInput) {
      resumeNoteInput.value = kairosSession.pauseResumeNote || '';
      setTimeout(() => resumeNoteInput.focus(), 100);
    }
  }

  function handleKairosResume() {
    const resumeNoteInput = document.getElementById('kairosResumeNote');
    const noteVal = resumeNoteInput ? resumeNoteInput.value.trim() : '';
    kairosSession.pauseResumeNote = noteVal;

    const overlay = document.getElementById('kairosOverlay');
    const breathing = document.getElementById('kairosBreathingState');
    const actions = document.getElementById('kairosActions');
    const statusLabel = document.getElementById('kairosStatusLabel');

    if (noteVal) {
      const toast = document.createElement('div');
      toast.className = 'kairos-resume-note-toast';
      toast.textContent = `接關提醒：${noteVal}`;
      document.body.appendChild(toast);
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 2800);
    }

    if (overlay) overlay.classList.remove('is-paused');
    if (breathing) breathing.style.display = 'none';
    if (actions) actions.style.display = 'flex';
    if (statusLabel) statusLabel.textContent = '專注中';
    kairosSession.currentSliceStart = Date.now();
    kairosSession.status = 'FOCUSING';
    syncKairosElapsedSeconds();
    updateKairosTimerDisplay();
    broadcastFocusToExtension('RESUME');
  }

  function handleKairosAbort() {
    syncKairosElapsedSeconds();
    const modal = document.getElementById('kairosAbortModal');
    const elapsedEl = document.getElementById('kairosAbortElapsed');
    if (elapsedEl) {
      elapsedEl.textContent = Math.floor(kairosSession.elapsedSeconds / 60);
    }
    if (modal) modal.style.display = 'flex';
  }

  function closeKairosAbortModal() {
    const modal = document.getElementById('kairosAbortModal');
    if (modal) modal.style.display = 'none';
  }

  function executeAbort(actionType) {
    syncKairosElapsedSeconds();
    closeKairosAbortModal();
    const nowItem = items.find(it => it.isNow && !it.done);
    if (!nowItem) return;
    const elapsed = kairosSession.elapsedSeconds;

    if (actionType === 'TOO_LARGE') {
      logFocusSession(nowItem, elapsed, 'ABORTED_TOO_LARGE', '任務過大需拆解');
      nowItem.isNow = false;
      nowItem.updatedAt = Date.now();
      saveItems();
      renderAll();
      showToast('已退回看板，已保留進度，建議為此任務新增子步驟。');
    } else if (actionType === 'POSTPONE') {
      logFocusSession(nowItem, elapsed, 'ABORTED_POSTPONE', '延後先擱著');
      nowItem.isNow = false;
      nowItem.updatedAt = Date.now();
      saveItems();
      renderAll();
      showToast('已暫停專注，任務保留在工作桌。');
    } else if (actionType === 'QUIT') {
      logFocusSession(nowItem, elapsed, 'ABORTED_QUIT', '不想做了退出');
      nowItem.isNow = false;
      nowItem.updatedAt = Date.now();
      saveItems();
      renderAll();
      showToast('已退出專注，辛苦了，隨時可以回來。');
    }
  }

  // 大腦暫存器 (Brain Dump)
  function openBrainDump() {
    const dump = document.getElementById('kairosbrainDump');
    const input = document.getElementById('kairosbrainDumpInput');
    if (!dump || !input) return;
    dump.style.display = 'block';
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }

  function closeBrainDump() {
    const dump = document.getElementById('kairosbrainDump');
    if (dump) dump.style.display = 'none';
  }

  function submitBrainDump() {
    const input = document.getElementById('kairosbrainDumpInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      closeBrainDump();
      return;
    }
    const keywordGuessedType = guessTypeByKeywords(text);
    const itemSize = guessSize(text, keywordGuessedType);
    const newItem = {
      id: generateId(),
      text: text,
      size: itemSize,
      bucket: 'inbox',
      isNow: false,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      typeId: keywordGuessedType,
      typeSource: 'rule',
      parentId: null,
      aiGenerated: false,
      quadrant: getComputedQuadrant({ text: text, size: itemSize }),
      deadline: null
    };
    items.unshift(newItem);
    saveItems();
    renderAll();
    input.value = '';
    closeBrainDump();
    showToast('雜念已存入收集箱');
  }

  // --- 專注與工時分析儀表板 (Focus Analytics Dashboard) ---
  let analyticsState = {
    timeRange: 'today', // 'today' | 'week' | 'month' | 'all'
    activeTab: 'overview' // 'overview' | 'intent' | 'friction' | 'logs'
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function openAnalyticsModal() {
    const modal = document.getElementById('modalAnalytics');
    if (modal) modal.style.display = 'flex';
    renderAnalyticsDashboard();
  }

  function closeAnalyticsModal() {
    const modal = document.getElementById('modalAnalytics');
    if (modal) modal.style.display = 'none';
  }

  function setAnalyticsTimeRange(range) {
    analyticsState.timeRange = range;
    const filterBtns = document.querySelectorAll('#analyticsTimeFilter .analytics-filter-btn');
    filterBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === range);
    });
    renderAnalyticsDashboard();
  }

  function switchAnalyticsTab(tabId) {
    analyticsState.activeTab = tabId;
    const tabBtns = document.querySelectorAll('.analytics-tabs-bar .analytics-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    const panels = {
      overview: document.getElementById('panelAnalyticsOverview'),
      intent: document.getElementById('panelAnalyticsIntent'),
      friction: document.getElementById('panelAnalyticsFriction'),
      logs: document.getElementById('panelAnalyticsLogs')
    };
    Object.keys(panels).forEach(key => {
      if (panels[key]) panels[key].style.display = key === tabId ? 'flex' : 'none';
    });
  }

  function getFilteredFocusSessions() {
    const all = getFocusSessions();
    const now = new Date();
    const range = analyticsState.timeRange;

    if (range === 'all') return all;

    let startMs = 0;
    if (range === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startMs = todayStart.getTime();
    } else if (range === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      startMs = monday.getTime();
    } else if (range === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      startMs = monthStart.getTime();
    }

    return all.filter(s => (s.startedAt || s.endedAt) >= startMs);
  }

  function formatDurationZh(totalSec) {
    const m = Math.floor((totalSec || 0) / 60);
    const h = Math.floor(m / 60);
    const remainM = m % 60;
    if (h > 0) {
      return `${h}h ${remainM}m`;
    }
    return `${m}m`;
  }

  function renderAnalyticsDashboard() {
    const sessions = getFilteredFocusSessions();
    renderAnalyticsOverview(sessions);
    renderAnalyticsIntent(sessions);
    renderAnalyticsFriction(sessions);
    renderAnalyticsLogs(sessions);
  }

  function renderAnalyticsOverview(sessions) {
    const totalSec = sessions.reduce((acc, s) => acc + (s.elapsedSeconds || 0), 0);
    const count = sessions.length;
    const avgSec = count > 0 ? Math.round(totalSec / count) : 0;
    const completedCount = sessions.filter(s => s.status === 'COMPLETED').length;
    const adjustedCount = count - completedCount;

    const elTotal = document.getElementById('kpiTotalTime');
    const elCount = document.getElementById('kpiSessionCount');
    const elAvg = document.getElementById('kpiAvgDuration');
    const elRatio = document.getElementById('kpiCompletionRatio');

    if (elTotal) elTotal.textContent = formatDurationZh(totalSec);
    if (elCount) elCount.textContent = `${count} 次`;
    if (elAvg) elAvg.textContent = formatDurationZh(avgSec);
    if (elRatio) elRatio.textContent = `${completedCount} / ${adjustedCount}`;

    // 每日趨勢長條圖
    const chartContainer = document.getElementById('analyticsTrendChartContainer');
    if (chartContainer) {
      chartContainer.innerHTML = '';
      if (sessions.length === 0) {
        chartContainer.innerHTML = '<div class="analytics-empty-hint" style="width:100%;">此區間內尚無專注資料</div>';
      } else {
        const dailyMap = {};
        sessions.forEach(s => {
          const d = new Date(s.startedAt || s.endedAt);
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          dailyMap[key] = (dailyMap[key] || 0) + (s.elapsedSeconds || 0);
        });

        const dayKeys = Object.keys(dailyMap);
        const maxDailySec = Math.max(...Object.values(dailyMap), 1);

        dayKeys.forEach(k => {
          const sec = dailyMap[k];
          const pct = Math.min(100, Math.max(10, Math.round((sec / maxDailySec) * 100)));
          const col = document.createElement('div');
          col.className = 'analytics-bar-col';
          col.title = `${k}: ${formatDurationZh(sec)}`;
          col.innerHTML = `
            <div class="analytics-bar-track">
              <div class="analytics-bar-fill" style="height: ${pct}%;"></div>
            </div>
            <span class="analytics-bar-date">${k}</span>
          `;
          chartContainer.appendChild(col);
        });
      }
    }

    // 開工時段分佈
    const todList = document.getElementById('analyticsTodList');
    if (todList) {
      todList.innerHTML = '';
      const buckets = {
        '早晨 (06:00 - 12:00)': 0,
        '下午 (12:00 - 18:00)': 0,
        '晚間 (18:00 - 24:00)': 0,
        '深夜 (00:00 - 06:00)': 0
      };

      sessions.forEach(s => {
        const hour = new Date(s.startedAt || s.endedAt).getHours();
        if (hour >= 6 && hour < 12) buckets['早晨 (06:00 - 12:00)'] += (s.elapsedSeconds || 0);
        else if (hour >= 12 && hour < 18) buckets['下午 (12:00 - 18:00)'] += (s.elapsedSeconds || 0);
        else if (hour >= 18 && hour < 24) buckets['晚間 (18:00 - 24:00)'] += (s.elapsedSeconds || 0);
        else buckets['深夜 (00:00 - 06:00)'] += (s.elapsedSeconds || 0);
      });

      const maxTodSec = Math.max(...Object.values(buckets), 1);
      Object.keys(buckets).forEach(k => {
        const sec = buckets[k];
        const pct = Math.round((sec / maxTodSec) * 100);
        const row = document.createElement('div');
        row.className = 'analytics-bar-row';
        row.innerHTML = `
          <div class="analytics-bar-row-info">
            <span class="analytics-bar-row-label">${k}</span>
            <span class="analytics-bar-row-val">${formatDurationZh(sec)}</span>
          </div>
          <div class="analytics-progress-track">
            <div class="analytics-progress-fill" style="width: ${pct}%;"></div>
          </div>
        `;
        todList.appendChild(row);
      });
    }
  }

  function renderAnalyticsIntent(sessions) {
    // 四象限
    const quadBars = document.getElementById('analyticsQuadrantBars');
    if (quadBars) {
      quadBars.innerHTML = '';
      const quadMap = {
        q2: { label: 'Q2 核心深耕 (重要 / 不緊急)', sec: 0, color: 'var(--accent-primary)' },
        q1: { label: 'Q1 緊急救火 (重要 / 緊急)', sec: 0, color: '#f87171' },
        q3: { label: 'Q3 突發瑣事 (不重要 / 緊急)', sec: 0, color: '#fbbf24' },
        q4: { label: 'Q4 閒置放鬆 (不重要 / 不緊急)', sec: 0, color: '#94a3b8' }
      };

      sessions.forEach(s => {
        const item = items.find(it => it.id === s.taskId);
        const qKey = (item && item.quadrant) ? item.quadrant.toLowerCase() : 'q2';
        if (quadMap[qKey]) {
          quadMap[qKey].sec += (s.elapsedSeconds || 0);
        } else {
          quadMap.q2.sec += (s.elapsedSeconds || 0);
        }
      });

      const maxQuadSec = Math.max(...Object.values(quadMap).map(q => q.sec), 1);
      Object.keys(quadMap).forEach(key => {
        const q = quadMap[key];
        const pct = Math.round((q.sec / maxQuadSec) * 100);
        const row = document.createElement('div');
        row.className = 'analytics-bar-row';
        row.innerHTML = `
          <div class="analytics-bar-row-info">
            <span class="analytics-bar-row-label" style="color: ${q.color};">${q.label}</span>
            <span class="analytics-bar-row-val">${formatDurationZh(q.sec)}</span>
          </div>
          <div class="analytics-progress-track">
            <div class="analytics-progress-fill" style="width: ${pct}%; background: ${q.color};"></div>
          </div>
        `;
        quadBars.appendChild(row);
      });
    }

    // 任務類型
    const typeBars = document.getElementById('analyticsTypeBars');
    if (typeBars) {
      typeBars.innerHTML = '';
      const typeMap = {};
      (rules.taskTypes || []).forEach(t => {
        typeMap[t.id] = { name: t.name, sec: 0 };
      });
      typeMap['other'] = { name: '其他 / 未分類', sec: 0 };

      sessions.forEach(s => {
        const item = items.find(it => it.id === s.taskId);
        const typeId = item && item.typeId ? item.typeId : 'other';
        if (typeMap[typeId]) {
          typeMap[typeId].sec += (s.elapsedSeconds || 0);
        } else {
          typeMap['other'].sec += (s.elapsedSeconds || 0);
        }
      });

      const maxTypeSec = Math.max(...Object.values(typeMap).map(t => t.sec), 1);
      Object.keys(typeMap).forEach(k => {
        const t = typeMap[k];
        if (t.sec === 0 && k === 'other') return;
        const pct = Math.round((t.sec / maxTypeSec) * 100);
        const row = document.createElement('div');
        row.className = 'analytics-bar-row';
        row.innerHTML = `
          <div class="analytics-bar-row-info">
            <span class="analytics-bar-row-label">${t.name}</span>
            <span class="analytics-bar-row-val">${formatDurationZh(t.sec)}</span>
          </div>
          <div class="analytics-progress-track">
            <div class="analytics-progress-fill" style="width: ${pct}%;"></div>
          </div>
        `;
        typeBars.appendChild(row);
      });
    }

    // 任務尺寸
    const sizeBars = document.getElementById('analyticsSizeBars');
    if (sizeBars) {
      sizeBars.innerHTML = '';
      const sizeMap = {
        micro: { name: '試水溫 (5-10m)', sec: 0, count: 0 },
        small: { name: '小任務 (15-30m)', sec: 0, count: 0 },
        medium: { name: '中任務 (1-2h)', sec: 0, count: 0 },
        large: { name: '大專案 (2h+)', sec: 0, count: 0 }
      };

      sessions.forEach(s => {
        const item = items.find(it => it.id === s.taskId);
        const sz = item && item.size ? item.size : 'micro';
        if (sizeMap[sz]) {
          sizeMap[sz].sec += (s.elapsedSeconds || 0);
          sizeMap[sz].count += 1;
        }
      });

      const maxSizeSec = Math.max(...Object.values(sizeMap).map(s => s.sec), 1);
      Object.keys(sizeMap).forEach(k => {
        const sz = sizeMap[k];
        const pct = Math.round((sz.sec / maxSizeSec) * 100);
        const row = document.createElement('div');
        row.className = 'analytics-bar-row';
        row.innerHTML = `
          <div class="analytics-bar-row-info">
            <span class="analytics-bar-row-label">${sz.name} (${sz.count} 次)</span>
            <span class="analytics-bar-row-val">${formatDurationZh(sz.sec)}</span>
          </div>
          <div class="analytics-progress-track">
            <div class="analytics-progress-fill" style="width: ${pct}%;"></div>
          </div>
        `;
        sizeBars.appendChild(row);
      });
    }
  }

  function renderAnalyticsFriction(sessions) {
    const frictionBars = document.getElementById('analyticsFrictionBars');
    const reasons = {
      ABORTED_TOO_LARGE: { label: '任務過大需拆解', count: 0, color: '#38bdf8' },
      ABORTED_POSTPONE: { label: '狀態不佳先擱著', count: 0, color: '#fbbf24' },
      ABORTED_QUIT: { label: '純粹不想做了退場', count: 0, color: '#94a3b8' }
    };

    sessions.forEach(s => {
      if (reasons[s.status]) {
        reasons[s.status].count += 1;
      }
    });

    const totalAborts = Object.values(reasons).reduce((acc, r) => acc + r.count, 0);

    if (frictionBars) {
      frictionBars.innerHTML = '';
      if (totalAborts === 0) {
        frictionBars.innerHTML = '<div class="analytics-empty-hint">目前無中斷記錄，所有專注皆順暢完成。</div>';
      } else {
        Object.keys(reasons).forEach(k => {
          const r = reasons[k];
          const pct = Math.round((r.count / totalAborts) * 100);
          const row = document.createElement('div');
          row.className = 'analytics-bar-row';
          row.innerHTML = `
            <div class="analytics-bar-row-info">
              <span class="analytics-bar-row-label" style="color: ${r.color};">${r.label}</span>
              <span class="analytics-bar-row-val">${r.count} 次 (${pct}%)</span>
            </div>
            <div class="analytics-progress-track">
              <div class="analytics-progress-fill" style="width: ${pct}%; background: ${r.color};"></div>
            </div>
          `;
          frictionBars.appendChild(row);
        });
      }
    }

    // 智能溫和回饋
    const insightText = document.getElementById('analyticsInsightText');
    if (insightText) {
      if (sessions.length === 0) {
        insightText.textContent = '尚無足夠的專注樣本。開工一次即可在此處看見認知回饋。';
      } else if (totalAborts === 0) {
        insightText.textContent = '專注完成率極高（100%）！您的步調非常穩定，請繼續保持這份動能。';
      } else if (reasons.ABORTED_TOO_LARGE.count >= reasons.ABORTED_POSTPONE.count && reasons.ABORTED_TOO_LARGE.count >= reasons.ABORTED_QUIT.count) {
        const pct = Math.round((reasons.ABORTED_TOO_LARGE.count / totalAborts) * 100);
        insightText.textContent = `近期中斷有 ${pct}% 源自任務拆解不足。建議在入桌專注前，先為卡片新增 2-3 個試水溫的微小步驟，有助於降低啟動阻力。`;
      } else if (reasons.ABORTED_POSTPONE.count >= reasons.ABORTED_TOO_LARGE.count) {
        const pct = Math.round((reasons.ABORTED_POSTPONE.count / totalAborts) * 100);
        insightText.textContent = `近期中斷有 ${pct}% 源自身心能量告急。這段時間請容許自己放慢步調，優先安排低耗能任務，或給自己充足的睡眠與休息。`;
      } else {
        insightText.textContent = '每一次自覺性的退場都是健康的選擇，誠實認可已付出的工時，大腦隨時可以重新開始。';
      }
    }

    // 接關筆記
    const notesList = document.getElementById('analyticsNotesList');
    if (notesList) {
      notesList.innerHTML = '';
      const notesWithText = sessions.filter(s => s.note && s.note.trim());
      if (notesWithText.length === 0) {
        notesList.innerHTML = '<div class="analytics-empty-hint">尚無接關便籤紀錄（在專注中點擊暫停即可留下筆記）。</div>';
      } else {
        notesWithText.forEach(s => {
          const d = new Date(s.endedAt || s.startedAt);
          const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          const item = document.createElement('div');
          item.className = 'analytics-note-item';
          item.innerHTML = `
            <div class="analytics-note-header">
              <span class="analytics-note-task">${escapeHtml(s.taskText || '任務')}</span>
              <span>${timeStr}</span>
            </div>
            <div class="analytics-note-content">${escapeHtml(s.note)}</div>
          `;
          notesList.appendChild(item);
        });
      }
    }
  }

  function renderAnalyticsLogs(sessions) {
    const tbody = document.getElementById('analyticsSessionsTbody');
    const emptyHint = document.getElementById('analyticsEmptyLogs');
    const countEl = document.getElementById('analyticsLogsCount');

    if (countEl) countEl.textContent = `共 ${sessions.length} 筆紀錄`;

    if (!tbody) return;
    tbody.innerHTML = '';

    if (sessions.length === 0) {
      if (emptyHint) emptyHint.style.display = 'block';
      return;
    }

    if (emptyHint) emptyHint.style.display = 'none';

    sessions.forEach(s => {
      const d = new Date(s.startedAt || s.endedAt);
      const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const durStr = formatDurationZh(s.elapsedSeconds || 0);

      let statusPillClass = 'status-completed';
      let statusLabel = '完成';
      if (s.status === 'ABORTED_TOO_LARGE') {
        statusPillClass = 'status-too-large';
        statusLabel = '過大拆解';
      } else if (s.status === 'ABORTED_POSTPONE') {
        statusPillClass = 'status-postpone';
        statusLabel = '狀態延後';
      } else if (s.status === 'ABORTED_QUIT') {
        statusPillClass = 'status-quit';
        statusLabel = '退場';
      }

      const item = items.find(it => it.id === s.taskId);
      const quadInfo = item ? getQuadrantInfo(item) : null;
      const catLabel = quadInfo ? quadInfo.badge : '核心深耕';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: var(--font-mono); white-space: nowrap;">${timeStr}</td>
        <td style="font-weight: 600;">${escapeHtml(s.taskText || '未命名任務')}</td>
        <td style="font-family: var(--font-mono); white-space: nowrap;">${durStr}</td>
        <td><span class="analytics-status-pill ${statusPillClass}">${statusLabel}</span></td>
        <td style="font-size: 0.75rem; color: var(--meta-text); white-space: nowrap;">${catLabel}</td>
        <td><button type="button" class="btn-session-delete" data-id="${s.id}">刪除</button></td>
      `;

      const btnDel = tr.querySelector('.btn-session-delete');
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          deleteFocusSession(s.id);
        });
      }

      tbody.appendChild(tr);
    });
  }

  function deleteFocusSession(sessionId) {
    const logs = getFocusSessions();
    const filtered = logs.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY_FOCUS_SESSIONS, JSON.stringify(filtered));
    renderAnalyticsDashboard();
    showToast('已刪除該筆專注紀錄');
  }

  function clearAllFocusSessions() {
    if (!confirm('確定要清空所有專注歷史紀錄嗎？此動作無法復原。')) return;
    localStorage.removeItem(STORAGE_KEY_FOCUS_SESSIONS);
    renderAnalyticsDashboard();
    showToast('已清空專注紀錄');
  }

  function exportFocusSessionsCsv() {
    const logs = getFocusSessions();
    if (logs.length === 0) {
      showToast('目前無任何專注紀錄可匯出');
      return;
    }
    const headers = ['ID', '任務名稱', '開始時間', '結束時間', '專注秒數', '專注分鐘', '結束狀態', '接關便籤'];
    const rows = logs.map(s => [
      `"${s.id || ''}"`,
      `"${(s.taskText || '').replace(/"/g, '""')}"`,
      `"${s.startedAt ? new Date(s.startedAt).toISOString() : ''}"`,
      `"${s.endedAt ? new Date(s.endedAt).toISOString() : ''}"`,
      s.elapsedSeconds || 0,
      s.elapsedMinutes || 0,
      `"${s.status || ''}"`,
      `"${(s.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskDesk_Focus_Sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已匯出專注日誌 CSV');
  }

  function exportFocusSessionsJson() {
    const logs = getFocusSessions();
    if (logs.length === 0) {
      showToast('目前無任何專注紀錄可匯出');
      return;
    }
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskDesk_Focus_Sessions_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已匯出專注日誌 JSON');
  }



  // --- 畫面渲染 ---
  function renderAll() {
    renderFocusLockBanner();
    renderWeekCounter();
    renderWorkbenchCounters();
    renderAmbientSuggestion();
    renderToday();
    renderWeek();
    updateDockBadges();
    const overlay = document.getElementById('drawerOverlay');
    if (overlay && overlay.style.display !== 'none') {
      renderDrawerContent();
    }
  }

  function renderWeekCounter() {
    const el = document.getElementById('weekCompletedText');
    if (el) {
      el.textContent = `本週已完成 ${getWeekCompletedCount()} 件`;
    }
  }

  // 渲染卡片共用函式
  function createCardElement(item, bucketContext) {
    const card = document.createElement('div');
    const hasActiveFocus = settings.focusLockEnabled && items.some(it => it.isNow && !it.done);
    const isMuted = hasActiveFocus && !item.isNow;
    card.className = `task-card ${item.isNow ? 'is-now' : ''} ${isMuted ? 'is-muted-by-focus' : ''}`;
    card.dataset.cardId = item.id;

    // 取得類型與資訊
    const typeObj = getTypeById(item.typeId);
    const subtasks = getSubtasks(item.id);
    const isAnalyzing = analyzingItemIds.has(item.id);

    // 卡片主行（核取方塊 + 文字）
    const mainRow = document.createElement('div');
    mainRow.className = 'card-main-row';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'card-check';
    check.checked = !!item.done;
    check.title = '標記完成';
    check.addEventListener('change', (e) => {
      toggleItemDone(item.id, e.target.checked);
    });

    const body = document.createElement('div');
    body.className = 'card-body';

    const textEl = document.createElement('div');
    textEl.className = 'card-text';
    textEl.textContent = item.text;

    // 點擊文字可就地編輯
    textEl.addEventListener('dblclick', () => {
      const newText = prompt('修改任務內容：', item.text);
      if (newText !== null && newText.trim()) {
        item.text = newText.trim();
        item.updatedAt = Date.now();
        saveItems();
        renderAll();
      }
    });

    // 標籤列 (類型 Chip, 現在 Badge, AI 協助 Badge, 子任務進度)
    const metaRow = document.createElement('div');
    metaRow.className = 'card-meta-row';

    // 現在標籤
    if (item.isNow) {
      const nowChip = document.createElement('span');
      nowChip.className = 'chip chip-now';
      nowChip.textContent = '● 現在做這個';
      metaRow.appendChild(nowChip);
    }

    // 類型 Chip
    const typeChip = document.createElement('span');
    typeChip.className = `chip ${isAnalyzing ? 'chip-guessing' : ''}`;
    typeChip.textContent = isAnalyzing ? '分析中…' : (typeObj ? typeObj.name : '未分類');
    typeChip.title = '點擊更換任務類型';
    typeChip.addEventListener('click', (e) => {
      e.stopPropagation();
      openTypePicker(item.id, typeChip);
    });
    metaRow.appendChild(typeChip);

    // 尺寸 Chip
    const itemSize = item.size || guessSize(item.text, item.typeId);
    const sizeChip = document.createElement('span');
    sizeChip.className = `chip chip-size chip-size-${itemSize}`;
    const sizeLabelMap = {
      micro: '試水溫 5-10m',
      small: '小 15-30m',
      medium: '中 1-2h',
      large: '大 2h+'
    };
    sizeChip.textContent = sizeLabelMap[itemSize] || '試水溫 5-10m';
    sizeChip.title = '點擊變更任務大小與耗時預估';
    sizeChip.addEventListener('click', (e) => {
      e.stopPropagation();
      openSizePicker(item.id, sizeChip);
    });
    metaRow.appendChild(sizeChip);

    // 每日習慣 Chip
    if (item.isRoutine) {
      const routineChip = document.createElement('span');
      routineChip.className = 'chip chip-routine';
      routineChip.textContent = '每日習慣';
      routineChip.title = '每日自動重設，依能量與時機浮出推薦';
      metaRow.appendChild(routineChip);
    }

    // 低刺激時間狀態標籤（平衡隱形死線與防止遺忘，採單色低對比呈現）
    if (item.deadline) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dlDate = new Date(item.deadline + 'T00:00:00');
      const diffDays = Math.round((dlDate - now) / (1000 * 60 * 60 * 24));
      const dlChip = document.createElement('span');
      dlChip.className = 'chip chip-deadline-risk';
      const monthDayStr = item.deadline.substring(5).replace('-', '/');
      if (diffDays < 0) {
        dlChip.textContent = `逾期 · ${monthDayStr}`;
        dlChip.classList.add('risk-overdue');
      } else if (diffDays === 0) {
        dlChip.textContent = `今天截止`;
        dlChip.classList.add('risk-today');
      } else if (diffDays === 1) {
        dlChip.textContent = `明天截止`;
        dlChip.classList.add('risk-near');
      } else if (diffDays <= 7) {
        dlChip.textContent = `本週 · ${monthDayStr}`;
        dlChip.classList.add('risk-week');
      } else {
        dlChip.textContent = `${monthDayStr}`;
        dlChip.classList.add('risk-far');
      }
      metaRow.appendChild(dlChip);
    }

    // AI 協助中性標籤
    if (typeObj && typeObj.aiAssist) {
      const aiChip = document.createElement('span');
      aiChip.className = 'chip chip-ai-assist';
      aiChip.textContent = '可用 AI 協助';
      metaRow.appendChild(aiChip);
    }

    // 子任務進度
    if (subtasks.length > 0) {
      const doneSubs = subtasks.filter(s => s.done).length;
      const progressChip = document.createElement('span');
      progressChip.className = 'chip chip-progress';
      progressChip.textContent = `${doneSubs}/${subtasks.length}`;
      metaRow.appendChild(progressChip);
    }

    body.appendChild(textEl);
    body.appendChild(metaRow);
    mainRow.appendChild(check);
    mainRow.appendChild(body);
    card.appendChild(mainRow);

    // 子任務展開區塊
    const subtasksContainer = document.createElement('div');
    subtasksContainer.className = 'subtasks-container';

    subtasks.forEach(sub => {
      const subItemEl = document.createElement('div');
      subItemEl.className = `subtask-item ${sub.done ? 'is-done' : ''}`;

      const subCheck = document.createElement('input');
      subCheck.type = 'checkbox';
      subCheck.className = 'subtask-check';
      subCheck.checked = !!sub.done;
      subCheck.addEventListener('change', (e) => {
        toggleItemDone(sub.id, e.target.checked);
      });

      const subTextEl = document.createElement('span');
      subTextEl.className = 'subtask-text';
      subTextEl.textContent = sub.text;

      const delSubBtn = document.createElement('button');
      delSubBtn.className = 'btn-delete-subtask';
      delSubBtn.innerHTML = '&times;';
      delSubBtn.title = '刪除子任務';
      delSubBtn.addEventListener('click', () => {
        deleteItem(sub.id);
      });

      subItemEl.appendChild(subCheck);
      subItemEl.appendChild(subTextEl);
      subItemEl.appendChild(delSubBtn);
      subtasksContainer.appendChild(subItemEl);
    });

    // 新增子任務輸入列
    const addSubForm = document.createElement('div');
    addSubForm.className = 'add-subtask-form';
    const subInput = document.createElement('input');
    subInput.type = 'text';
    subInput.className = 'add-subtask-input';
    subInput.placeholder = '+ 新增子步驟...';
    subInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addSubtask(item.id, subInput.value);
        subInput.value = '';
      }
    });

    const btnSubAdd = document.createElement('button');
    btnSubAdd.className = 'btn-add-subtask';
    btnSubAdd.textContent = '新增';
    btnSubAdd.addEventListener('click', () => {
      addSubtask(item.id, subInput.value);
      subInput.value = '';
    });

    addSubForm.appendChild(subInput);
    addSubForm.appendChild(btnSubAdd);
    subtasksContainer.appendChild(addSubForm);
    card.appendChild(subtasksContainer);

    // 卡片底行操作按鈕
    const actionsRow = document.createElement('div');
    actionsRow.className = 'card-actions-row';

    const triageBtns = document.createElement('div');
    triageBtns.className = 'card-triage-btns';

    if (bucketContext === 'inbox') {
      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '今日';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '這週';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '保溫';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '放生';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);
    } else if (bucketContext === 'today') {
      // 「現在」切換按鈕
      const btnNow = document.createElement('button');
      btnNow.className = `btn-now-toggle ${item.isNow ? 'is-active' : ''}`;
      btnNow.textContent = item.isNow ? '專注中' : '現在做';
      btnNow.title = item.isNow ? '取消當前專注' : '設為當前專注事項';
      btnNow.addEventListener('click', () => toggleItemNow(item.id));
      triageBtns.appendChild(btnNow);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '這週';
      btnToWeek.title = '移至這週工作桌';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '保溫';
      btnToKeep.title = '移至保溫抽屜';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '放生';
      btnToRelease.title = '移至放生抽屜';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '收集箱';
      btnToInbox.title = '退回收集箱抽屜';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    } else if (bucketContext === 'week') {
      // 「現在」切換按鈕
      const btnNow = document.createElement('button');
      btnNow.className = `btn-now-toggle ${item.isNow ? 'is-active' : ''}`;
      btnNow.textContent = item.isNow ? '專注中' : '現在做';
      btnNow.title = item.isNow ? '取消當前專注' : '設為當前專注事項';
      btnNow.addEventListener('click', () => toggleItemNow(item.id));
      triageBtns.appendChild(btnNow);

      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '今日';
      btnToToday.title = '移至今日工作桌';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '保溫';
      btnToKeep.title = '移至保溫抽屜';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '放生';
      btnToRelease.title = '移至放生抽屜';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '收集箱';
      btnToInbox.title = '退回收集箱抽屜';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    } else if (bucketContext === 'keep') {
      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '今日';
      btnToToday.title = '移至今日工作桌';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '這週';
      btnToWeek.title = '移至這週工作桌';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '放生';
      btnToRelease.title = '移至放生抽屜';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '收集箱';
      btnToInbox.title = '退回收集箱抽屜';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    } else if (bucketContext === 'release') {
      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '今日';
      btnToToday.title = '移至今日工作桌';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '這週';
      btnToWeek.title = '移至這週工作桌';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '保溫';
      btnToKeep.title = '移至保溫抽屜';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '收集箱';
      btnToInbox.title = '退回收集箱抽屜';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    }

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete-card';
    btnDelete.textContent = '刪除';
    btnDelete.addEventListener('click', () => {
      deleteItem(item.id);
    });

    actionsRow.appendChild(triageBtns);
    actionsRow.appendChild(btnDelete);
    card.appendChild(actionsRow);

    return card;
  }

  // 渲染工作桌頁籤計數
  function renderWorkbenchCounters() {
    const todayTabBadge = document.getElementById('todayTabBadge');
    const weekTabBadge = document.getElementById('weekTabBadge');

    const todayCount = items.filter(it => it.bucket === 'today' && !it.parentId && !it.done).length;
    const weekCount = items.filter(it => it.bucket === 'week' && !it.parentId && !it.done).length;

    if (todayTabBadge) todayTabBadge.textContent = todayCount;
    if (weekTabBadge) weekTabBadge.textContent = weekCount;
  }

  // 渲染「今日」清單
  function renderToday() {
    const listEl = document.getElementById('todayCardList');
    const badgeEl = document.getElementById('todayCountBadge');
    const noticeEl = document.getElementById('todayLimitNotice');
    if (!listEl) return;

    listEl.innerHTML = '';
    const todayItems = items.filter(it => it.bucket === 'today' && !it.parentId && !it.done);

    // 排序：將 isNow 項目排在最頂端
    todayItems.sort((a, b) => {
      if (a.isNow) return -1;
      if (b.isNow) return 1;
      return a.createdAt - b.createdAt;
    });

    const smallCount = todayItems.filter(it => ['small', 'micro'].includes(it.size || guessSize(it.text, it.typeId))).length;

    if (badgeEl) {
      badgeEl.textContent = `小/微型 ${smallCount} / ${settings.todaySmallLimit} · 總計 ${todayItems.length} 件`;
    }

    if (noticeEl) {
      if (smallCount >= settings.todaySmallLimit) {
        noticeEl.textContent = `今日小任務配額已滿 (${smallCount}/${settings.todaySmallLimit})，中大型推進任務仍可放入`;
        noticeEl.style.color = 'var(--accent-primary)';
      } else {
        noticeEl.textContent = `小/微型配額 ${settings.todaySmallLimit} 件 · 總計 ${todayItems.length} 件`;
        noticeEl.style.color = '';
      }
    }

    if (todayItems.length === 0) {
      const inboxItemsCount = items.filter(it => (!it.drawer || it.drawer === 'inbox') && !it.bucket && !it.done).length;
      const emptyWrap = document.createElement('div');
      emptyWrap.className = 'workbench-empty-guide';
      emptyWrap.style.cssText = 'padding: 24px 16px; text-align: center; border: 1px dashed var(--border-light); border-radius: 8px; margin: 8px 0; background: rgba(255,255,255,0.01);';
      emptyWrap.innerHTML = `
        <div class="empty-neutral" style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.88rem;">
          今日工作桌目前空空如也。<br>
          <span style="font-size: 0.78rem; color: var(--meta-text);">先將想法倒入收集箱，再挑選 1~3 件放上工作桌。</span>
        </div>
        <button type="button" class="btn-guide-open-inbox btn-secondary" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; font-size: 0.84rem; border-color: var(--border-light); cursor: pointer;">
          打開收集箱挑選任務 ${inboxItemsCount > 0 ? `(${inboxItemsCount})` : ''}
        </button>
      `;
      const btnGuide = emptyWrap.querySelector('.btn-guide-open-inbox');
      if (btnGuide) {
        btnGuide.addEventListener('click', () => openDrawer('inbox'));
      }
      listEl.appendChild(emptyWrap);
      return;
    }

    todayItems.forEach(item => {
      listEl.appendChild(createCardElement(item, 'today'));
    });
  }

  // 渲染「這週」清單
  function renderWeek() {
    const listEl = document.getElementById('weekCardList');
    const badgeEl = document.getElementById('weekCountBadge');
    const noticeEl = document.getElementById('weekLimitNotice');
    if (!listEl) return;

    listEl.innerHTML = '';
    const weekItems = items.filter(it => it.bucket === 'week' && !it.parentId && !it.done);

    // 排序：將 isNow 項目排在最頂端
    weekItems.sort((a, b) => {
      if (a.isNow) return -1;
      if (b.isNow) return 1;
      return a.createdAt - b.createdAt;
    });

    const medLargeCount = weekItems.filter(it => {
      const s = it.size || guessSize(it.text, it.typeId);
      return s === 'medium' || s === 'large';
    }).length;

    if (badgeEl) {
      badgeEl.textContent = `中/大型 ${medLargeCount} / ${settings.weekMediumLargeLimit} · 總計 ${weekItems.length} 件`;
    }

    if (noticeEl) {
      if (medLargeCount >= settings.weekMediumLargeLimit) {
        noticeEl.textContent = `本週中大任務配額已滿 (${medLargeCount}/${settings.weekMediumLargeLimit})，小型任務仍可放入`;
        noticeEl.style.color = 'var(--accent-primary)';
      } else {
        noticeEl.textContent = `中/大型配額 ${settings.weekMediumLargeLimit} 件 · 總計 ${weekItems.length} 件`;
        noticeEl.style.color = '';
      }
    }

    if (weekItems.length === 0) {
      const inboxItemsCount = items.filter(it => (!it.drawer || it.drawer === 'inbox') && !it.bucket && !it.done).length;
      const emptyWrap = document.createElement('div');
      emptyWrap.className = 'workbench-empty-guide';
      emptyWrap.style.cssText = 'padding: 24px 16px; text-align: center; border: 1px dashed var(--border-light); border-radius: 8px; margin: 8px 0; background: rgba(255,255,255,0.01);';
      emptyWrap.innerHTML = `
        <div class="empty-neutral" style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.88rem;">
          這週工作桌目前沒有項目。<br>
          <span style="font-size: 0.78rem; color: var(--meta-text);">可拉開收集箱挑選中長期或核心推進事項。</span>
        </div>
        <button type="button" class="btn-guide-open-inbox btn-secondary" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; font-size: 0.84rem; border-color: var(--border-light); cursor: pointer;">
          打開收集箱挑選任務 ${inboxItemsCount > 0 ? `(${inboxItemsCount})` : ''}
        </button>
      `;
      const btnGuide = emptyWrap.querySelector('.btn-guide-open-inbox');
      if (btnGuide) {
        btnGuide.addEventListener('click', () => openDrawer('inbox'));
      }
      listEl.appendChild(emptyWrap);
      return;
    }

    weekItems.forEach(item => {
      listEl.appendChild(createCardElement(item, 'week'));
    });
  }

  // --- 工作桌抽屜系統 (Desk Drawers: 收集箱 / 保溫 / 放生 / 歷史檔案) ---
  let currentDrawer = 'inbox'; // 'inbox' | 'keep' | 'release' | 'history'

  function openDrawer(drawerName) {
    if (document.body.classList.contains('body-focus-active')) {
      showToast('專注進行中：請先完成當前任務或解除鎖定再開啟抽屜');
      return;
    }
    currentDrawer = drawerName || 'inbox';
    const overlay = document.getElementById('drawerOverlay');
    const panel = document.getElementById('drawerPanel');
    if (!overlay || !panel) return;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      panel.classList.add('is-open');
    });

    switchDrawerTab(currentDrawer);
  }

  function closeDrawer() {
    const overlay = document.getElementById('drawerOverlay');
    const panel = document.getElementById('drawerPanel');
    if (!overlay || !panel) return;

    overlay.classList.remove('is-open');
    panel.classList.remove('is-open');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 280);
  }

  function switchDrawerTab(drawerName) {
    currentDrawer = drawerName;

    const drawerKeys = ['inbox', 'keep', 'release', 'history'];
    drawerKeys.forEach(d => {
      const tab = document.getElementById(`drawerTab${d.charAt(0).toUpperCase() + d.slice(1)}`);
      if (tab) {
        if (d === drawerName) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      }
    });

    const hintEl = document.getElementById('drawerHintText');
    const toolsEl = document.getElementById('drawerHistoryTools');
    const hints = {
      inbox: '新想法緩衝區・可將任務挑選移至今日或本週工作桌',
      keep: '常規維持項目・只求維持不退化，不強求大幅進步',
      release: '放生清單・有興趣但目前精力暫時放下的項目',
      history: '歷史檔案庫・已完成任務永久封存於此，可隨時復原或匯出'
    };
    if (hintEl) hintEl.textContent = hints[drawerName] || '';
    if (toolsEl) toolsEl.style.display = (drawerName === 'history') ? 'flex' : 'none';

    renderDrawerContent();
  }

  function renderDrawerContent() {
    const listEl = document.getElementById('drawerCardList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (currentDrawer === 'inbox') {
      const inboxItems = items.filter(it => it.bucket === 'inbox' && !it.parentId && !it.done);
      if (inboxItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-neutral';
        empty.textContent = '收集箱抽屜目前是空的。用上方輸入框記錄想法，會自動收納至此。';
        listEl.appendChild(empty);
      } else {
        inboxItems.forEach(it => listEl.appendChild(createCardElement(it, 'inbox')));
      }
    } else if (currentDrawer === 'keep') {
      const keepItems = items.filter(it => it.bucket === 'keep' && !it.parentId && !it.done);
      if (keepItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-neutral';
        empty.textContent = '保溫抽屜目前是空的。可將定期習慣或維持型事項移至此抽屜。';
        listEl.appendChild(empty);
      } else {
        keepItems.forEach(it => listEl.appendChild(createCardElement(it, 'keep')));
      }
    } else if (currentDrawer === 'release') {
      const releaseItems = items.filter(it => it.bucket === 'release' && !it.parentId && !it.done);
      if (releaseItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-neutral';
        empty.textContent = '放生抽屜目前是空的。暫時沒空執行的低優先事項可收納於此。';
        listEl.appendChild(empty);
      } else {
        releaseItems.forEach(it => listEl.appendChild(createCardElement(it, 'release')));
      }
    } else if (currentDrawer === 'history') {
      const doneItems = items.filter(it => it.done && !it.parentId);
      doneItems.sort((a, b) => (b.doneAt || b.updatedAt || 0) - (a.doneAt || a.updatedAt || 0));
      if (doneItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-neutral';
        empty.textContent = '歷史檔案抽屜目前是空的。當在工作桌勾選完成任務時，會自動歸檔於此。';
        listEl.appendChild(empty);
      } else {
        doneItems.forEach(it => listEl.appendChild(createHistoryCardElement(it)));
      }
    }
  }

  function updateDockBadges() {
    const inboxCount = items.filter(it => it.bucket === 'inbox' && !it.parentId && !it.done).length;
    const keepCount = items.filter(it => it.bucket === 'keep' && !it.parentId && !it.done).length;
    const releaseCount = items.filter(it => it.bucket === 'release' && !it.parentId && !it.done).length;
    const historyCount = items.filter(it => it.done && !it.parentId).length;

    const dInbox = document.getElementById('dockBadgeInbox');
    const dKeep = document.getElementById('dockBadgeKeep');
    const dRelease = document.getElementById('dockBadgeRelease');
    const dHist = document.getElementById('dockBadgeHistory');
    if (dInbox) dInbox.textContent = inboxCount;
    if (dKeep) dKeep.textContent = keepCount;
    if (dRelease) dRelease.textContent = releaseCount;
    if (dHist) dHist.textContent = historyCount;

    const tInbox = document.getElementById('drawerBadgeInbox');
    const tKeep = document.getElementById('drawerBadgeKeep');
    const tRelease = document.getElementById('drawerBadgeRelease');
    const tHist = document.getElementById('drawerBadgeHistory');
    if (tInbox) tInbox.textContent = inboxCount;
    if (tKeep) tKeep.textContent = keepCount;
    if (tRelease) tRelease.textContent = releaseCount;
    if (tHist) tHist.textContent = historyCount;
  }

  // --- 類型選擇下拉清單 (全域浮動層，脫離卡片與資料夾層疊限制) ---
  function openTypePicker(itemId, targetEl) {
    // 關閉既有的選單
    const existing = document.querySelector('.type-picker-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'type-picker-menu';

    const item = items.find(it => it.id === itemId);
    const currentTypeId = item ? item.typeId : null;

    // 未分類選項
    const unclassifiedOpt = document.createElement('div');
    unclassifiedOpt.className = `type-picker-item ${!currentTypeId ? 'active' : ''}`;
    unclassifiedOpt.textContent = '未分類 (無)';
    unclassifiedOpt.addEventListener('click', () => {
      updateItemType(itemId, null);
      menu.remove();
    });
    menu.appendChild(unclassifiedOpt);

    // rules 中的所有類型
    rules.taskTypes.forEach(t => {
      const opt = document.createElement('div');
      opt.className = `type-picker-item ${currentTypeId === t.id ? 'active' : ''}`;
      opt.textContent = t.name;
      opt.addEventListener('click', () => {
        updateItemType(itemId, t.id);
        menu.remove();
      });
      menu.appendChild(opt);
    });

    // 掛載至 body，避開任何 card 或 accordion 的 backdrop-filter 堆疊上下文阻擋
    document.body.appendChild(menu);

    const rect = targetEl.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = menu.offsetHeight || 260;

    let top = rect.bottom + 4;
    let left = rect.left;

    // 若下方空間不足（例如卡片靠近畫面底部），自動向上展開避開重疊
    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuHeight - 4);
    }

    // 靠右邊界防溢出
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== targetEl) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
        window.removeEventListener('scroll', closeHandler, true);
        window.removeEventListener('resize', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      window.addEventListener('scroll', closeHandler, true);
      window.addEventListener('resize', closeHandler);
    }, 10);
  }

  // --- 尺寸選擇下拉選單 (全域浮動層，脫離卡片與資料夾層疊限制) ---
  function openSizePicker(itemId, targetEl) {
    const existing = document.querySelector('.size-picker-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'type-picker-menu size-picker-menu';

    const item = items.find(it => it.id === itemId);
    const currentSize = item ? (item.size || guessSize(item.text, item.typeId)) : 'small';

    const sizeOptions = [
      { id: 'micro', title: '試水溫 (5-10m)', desc: '無法估算或模糊事項，先做 5-10 分鐘建立起步動能' },
      { id: 'small', title: '小 (15-30m)', desc: '微型任務、行政雜事、回信' },
      { id: 'medium', title: '中 (1-2h)', desc: '特定模組、中度專注時段' },
      { id: 'large', title: '大 (2h+)', desc: '重大專案、論文、深度研讀' }
    ];

    sizeOptions.forEach(opt => {
      const optEl = document.createElement('div');
      optEl.className = `type-picker-item ${currentSize === opt.id ? 'active' : ''}`;
      optEl.innerHTML = `<div style="font-weight: 600; font-family: var(--font-mono);">${opt.title}</div><div style="font-size: 0.72rem; color: var(--meta-text); line-height: 1.3; margin-top: 2px;">${opt.desc}</div>`;
      optEl.addEventListener('click', () => {
        if (item) {
          item.size = opt.id;
          item.updatedAt = Date.now();
          saveItems();
          renderAll();
        }
        menu.remove();
      });
      menu.appendChild(optEl);
    });

    // 截止死線設定項目 (從大小選單進入，卡片本身不呈現死線干擾)
    const divider = document.createElement('div');
    divider.style.borderTop = '1px solid var(--border-light)';
    divider.style.margin = '5px 0';
    menu.appendChild(divider);

    const dlOption = document.createElement('div');
    dlOption.className = 'type-picker-item';
    const dlText = item && item.deadline ? `截止死線：${item.deadline}` : '設定截止死線 (選填)';
    dlOption.innerHTML = `<div style="font-weight: 500; font-size: 0.74rem; color: var(--text-color);">${dlText}</div>`;
    dlOption.addEventListener('click', () => {
      menu.remove();
      openDeadlinePicker(itemId, targetEl);
    });
    menu.appendChild(dlOption);

    document.body.appendChild(menu);

    const rect = targetEl.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = menu.offsetHeight || 190;

    let top = rect.bottom + 4;
    let left = rect.left;

    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuHeight - 4);
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== targetEl) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
        window.removeEventListener('scroll', closeHandler, true);
        window.removeEventListener('resize', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      window.addEventListener('scroll', closeHandler, true);
      window.addEventListener('resize', closeHandler);
    }, 10);
  }

  // --- 四象限輕重緩急客觀自動判定引擎 ---
  // 支援手動指定與系統依「任務大小」與「截止死線」客觀自動分流
  function getComputedQuadrant(item) {
    if (!item) return 'q4';
    if (item.manualQuadrant && ['q1', 'q2', 'q3', 'q4'].includes(item.manualQuadrant.toLowerCase())) {
      return item.manualQuadrant.toLowerCase();
    }
    const size = item.size || guessSize(item.text, item.typeId) || 'small';
    const isImportant = (size === 'large' || size === 'medium');

    let isUrgent = false;
    if (item.deadline) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const deadlineDate = new Date(item.deadline + 'T23:59:59');
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      // 2 天內到期或已過期皆為緊急
      if (diffDays <= 2 || item.deadline <= todayStr) {
        isUrgent = true;
      }
    } else {
      // 若無死線，偵測任務標題是否有急迫字眼
      const text = (item.text || '').toLowerCase();
      if (text.includes('急') || text.includes('馬上') || text.includes('立刻') || text.includes('今天內') || text.includes('盡快') || text.includes('asap')) {
        isUrgent = true;
      }
    }

    if (isImportant && isUrgent) return 'q1';
    if (isImportant && !isUrgent) return 'q2';
    if (!isImportant && isUrgent) return 'q3';
    return 'q4';
  }

  function getQuadrantInfo(item) {
    const quadId = getComputedQuadrant(item);
    const isManual = !!(item.manualQuadrant && ['q1', 'q2', 'q3', 'q4'].includes(item.manualQuadrant.toLowerCase()));
    const size = item.size || guessSize(item.text, item.typeId) || 'small';
    const sizeMap = { micro: '試水溫 (5-10m 微步)', small: '小任務 (15-30m 瑣事)', medium: '中型任務 (1-2h 專注)', large: '大型任務 (深度專案)' };
    const sizeText = sizeMap[size] || '試水溫';

    let dlStatus = '未設定死線';
    if (item.deadline) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const diffMs = new Date(item.deadline + 'T23:59:59').getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0 || item.deadline <= todayStr) {
        dlStatus = `今日或已逾期 (${item.deadline})`;
      } else {
        dlStatus = `剩餘 ${diffDays} 天 (${item.deadline})`;
      }
    }

    const manualPrefix = isManual ? '【手動指定】' : '【系統判定】';

    if (quadId === 'q1') {
      return {
        id: 'q1',
        badge: '迫在眉睫',
        title: '重要且緊急',
        color: '#f87171',
        desc: isManual
          ? `${manualPrefix}已手動指定為 Q1 緊急重要，將同步至所有裝置。`
          : `${manualPrefix}屬於${sizeText}且【${dlStatus}】，具備高核心價值與急迫時限，判定為優先處置焦點。`
      };
    }
    if (quadId === 'q2') {
      return {
        id: 'q2',
        badge: '核心深耕',
        title: '重要不急',
        color: '#38bdf8',
        desc: isManual
          ? `${manualPrefix}已手動指定為 Q2 核心深耕，將同步至所有裝置。`
          : `${manualPrefix}屬於${sizeText}且【${dlStatus}】，具備高核心價值但無急迫壓力，是成長最重要的沉浸區。`
      };
    }
    if (quadId === 'q3') {
      return {
        id: 'q3',
        badge: '瑣事速辦',
        title: '緊急瑣事',
        color: '#fbbf24',
        desc: isManual
          ? `${manualPrefix}已手動指定為 Q3 瑣事速辦，將同步至所有裝置。`
          : `${manualPrefix}屬於${sizeText}且【${dlStatus}】，行政瑣事期限逼近，花少許時間順手清空即可。`
      };
    }
    return {
      id: 'q4',
      badge: '順手雜項',
      title: '低壓順手',
      color: '#94a3b8',
      desc: isManual
        ? `${manualPrefix}已手動指定為 Q4 餘裕順手，將同步至所有裝置。`
        : `${manualPrefix}屬於${sizeText}且【${dlStatus}】，低精神負擔備用清單，有餘力或零碎空檔再執行。`
    };
  }

  // --- 截止死線與象限設定浮動選單 ---
  function openDeadlinePicker(itemId, targetEl) {
    const existing = document.querySelector('.quadrant-picker-menu');
    if (existing) existing.remove();

    const item = items.find(it => it.id === itemId);
    if (!item) return;

    const menu = document.createElement('div');
    menu.className = 'quadrant-picker-menu';

    // 標題列
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';
    headerRow.style.justifyContent = 'space-between';

    const titleEl = document.createElement('div');
    titleEl.className = 'quadrant-picker-title';
    titleEl.textContent = '截止死線與象限設定';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-clear-deadline';
    closeBtn.innerHTML = '&times;';
    closeBtn.style.padding = '0 6px';
    closeBtn.style.fontSize = '1.1rem';
    closeBtn.addEventListener('click', () => menu.remove());

    headerRow.appendChild(titleEl);
    headerRow.appendChild(closeBtn);
    menu.appendChild(headerRow);

    const hintEl = document.createElement('div');
    hintEl.className = 'quadrant-picker-hint';
    hintEl.textContent = '預設由系統自動判定輕重緩急。您亦可於下方直接指定象限或死線，所有屬性皆可跨裝置同步。';
    menu.appendChild(hintEl);

    // 快捷日期標籤列
    const quickChips = document.createElement('div');
    quickChips.className = 'deadline-quick-chips';

    function formatDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const todayDate = new Date();
    const todayStr = formatDate(todayDate);

    const tmrDate = new Date();
    tmrDate.setDate(tmrDate.getDate() + 1);
    const tmrStr = formatDate(tmrDate);

    const friDate = new Date();
    const currentDay = friDate.getDay();
    const diffToFri = (5 - currentDay + 7) % 7;
    friDate.setDate(friDate.getDate() + (diffToFri === 0 ? 7 : diffToFri));
    const friStr = formatDate(friDate);

    const nextMonDate = new Date();
    const diffToNextMon = (1 - nextMonDate.getDay() + 7) % 7 || 7;
    nextMonDate.setDate(nextMonDate.getDate() + diffToNextMon);
    const monStr = formatDate(nextMonDate);

    const quickOptions = [
      { label: '今天', val: todayStr },
      { label: '明天', val: tmrStr },
      { label: '本週五', val: friStr },
      { label: '下週一', val: monStr },
      { label: '清除死線', val: null }
    ];

    // 日期輸入列
    const deadlineRow = document.createElement('div');
    deadlineRow.className = 'quadrant-deadline-row';

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'quadrant-date-input';
    dateInput.value = item.deadline || '';

    // 即時系統診斷區塊
    const infoBox = document.createElement('div');
    infoBox.className = 'deadline-auto-info';

    function updateInfoDisplay() {
      const qInfo = getQuadrantInfo(item);
      const isManual = !!(item.manualQuadrant && ['q1', 'q2', 'q3', 'q4'].includes(item.manualQuadrant.toLowerCase()));
      infoBox.innerHTML = `
        <div class="deadline-auto-badge" style="color: ${qInfo.color};">
          ${isManual ? '手動指定' : '自動推估'}：${qInfo.badge} (${qInfo.title})
        </div>
        <div class="deadline-auto-desc">${qInfo.desc}</div>
      `;
    }

    function applyDeadline(newVal) {
      item.deadline = newVal;
      if (!item.manualQuadrant) {
        item.quadrant = getComputedQuadrant(item);
      }
      item.updatedAt = Date.now();
      dateInput.value = newVal || '';
      saveItems();
      renderAll();
      updateInfoDisplay();
      const matrixModal = document.getElementById('modalMatrix');
      if (matrixModal && matrixModal.style.display === 'flex') {
        renderMatrixModal();
      }
    }

    quickOptions.forEach(opt => {
      const chipBtn = document.createElement('button');
      chipBtn.type = 'button';
      chipBtn.className = 'deadline-chip-btn';
      chipBtn.textContent = opt.label;
      chipBtn.addEventListener('click', () => {
        applyDeadline(opt.val);
        if (!opt.val) showToast('已清除死線');
        else showToast(`死線已設為 ${opt.label} (${opt.val})`);
      });
      quickChips.appendChild(chipBtn);
    });

    dateInput.addEventListener('change', (e) => {
      applyDeadline(e.target.value ? e.target.value : null);
    });

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn-clear-deadline';
    btnClear.textContent = '清除';
    btnClear.addEventListener('click', () => {
      applyDeadline(null);
      showToast('已清除死線');
    });

    deadlineRow.appendChild(dateInput);
    deadlineRow.appendChild(btnClear);

    menu.appendChild(quickChips);
    menu.appendChild(deadlineRow);

    // 象限自訂或自動推估列
    const quadRow = document.createElement('div');
    quadRow.className = 'quadrant-selector-row';

    const quadLabel = document.createElement('div');
    quadLabel.className = 'quadrant-selector-label';
    quadLabel.textContent = '輕重緩急象限設定：';
    quadRow.appendChild(quadLabel);

    const quadChips = document.createElement('div');
    quadChips.className = 'quadrant-chips-wrap';

    const quadOptions = [
      { id: null, label: '自動推估' },
      { id: 'q1', label: 'Q1 緊急重要' },
      { id: 'q2', label: 'Q2 核心深耕' },
      { id: 'q3', label: 'Q3 瑣事速辦' },
      { id: 'q4', label: 'Q4 餘裕順手' }
    ];

    function renderQuadChips() {
      quadChips.innerHTML = '';
      const currentManual = item.manualQuadrant ? item.manualQuadrant.toLowerCase() : null;
      quadOptions.forEach(qOpt => {
        const qBtn = document.createElement('button');
        qBtn.type = 'button';
        const isActive = (qOpt.id === currentManual) || (!qOpt.id && !currentManual);
        qBtn.className = `quadrant-chip-btn ${isActive ? 'active' : ''}`;
        qBtn.textContent = qOpt.label;
        qBtn.addEventListener('click', () => {
          item.manualQuadrant = qOpt.id;
          item.quadrant = getComputedQuadrant(item);
          item.updatedAt = Date.now();
          saveItems();
          renderAll();
          renderQuadChips();
          updateInfoDisplay();
          const matrixModal = document.getElementById('modalMatrix');
          if (matrixModal && matrixModal.style.display === 'flex') {
            renderMatrixModal();
          }
          showToast(qOpt.id ? `象限已手動指定為 ${qOpt.label}` : '已切換為系統自動推估象限');
        });
        quadChips.appendChild(qBtn);
      });
    }

    renderQuadChips();
    quadRow.appendChild(quadChips);
    menu.appendChild(quadRow);

    updateInfoDisplay();
    menu.appendChild(infoBox);

    // 完成按鈕
    const finishRow = document.createElement('div');
    finishRow.style.display = 'flex';
    finishRow.style.justifyContent = 'flex-end';
    finishRow.style.marginTop = '4px';

    const btnDone = document.createElement('button');
    btnDone.type = 'button';
    btnDone.className = 'btn-secondary';
    btnDone.style.padding = '4px 12px';
    btnDone.style.fontSize = '0.78rem';
    btnDone.textContent = '完成';
    btnDone.addEventListener('click', () => menu.remove());
    finishRow.appendChild(btnDone);
    menu.appendChild(finishRow);

    document.body.appendChild(menu);

    // 視窗邊界定位
    const rect = targetEl.getBoundingClientRect();
    const menuWidth = 295;
    const menuHeight = menu.offsetHeight || 330;

    let top = rect.bottom + 4;
    let left = rect.left;

    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuHeight - 4);
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== targetEl) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
        window.removeEventListener('scroll', closeHandler, true);
        window.removeEventListener('resize', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      window.addEventListener('scroll', closeHandler, true);
      window.addEventListener('resize', closeHandler);
    }, 10);
  }

  // --- 四象限矩陣總覽 (Eisenhower Matrix) ---
  let activeMatrixScope = 'active'; // 'active' | 'today' | 'week' | 'keep'

  function openMatrixModal() {
    renderMatrixModal();
    const modal = document.getElementById('modalMatrix');
    if (modal) modal.style.display = 'flex';
  }

  function renderMatrixModal() {
    const container = document.getElementById('matrixGridContainer');
    if (!container) return;
    container.innerHTML = '';

    // 依篩選範圍挑選項目
    let filteredItems = items.filter(it => !it.done && !it.parentId);
    if (activeMatrixScope === 'today') {
      filteredItems = filteredItems.filter(it => it.bucket === 'today');
    } else if (activeMatrixScope === 'week') {
      filteredItems = filteredItems.filter(it => it.bucket === 'week');
    } else if (activeMatrixScope === 'keep') {
      filteredItems = filteredItems.filter(it => it.bucket === 'keep');
    }

    const quadrantConfig = [
      { id: 'q1', title: '重要且緊急', subtitle: '燃眉之急・危機處理・立即攻克', color: '#f87171', borderClass: 'box-q1' },
      { id: 'q2', title: '重要不急', subtitle: '核心目標・長期價值・專注深耕', color: '#38bdf8', borderClass: 'box-q2' },
      { id: 'q3', title: '緊急瑣事', subtitle: '瑣碎突發・干擾事項・快速消化', color: '#fbbf24', borderClass: 'box-q3' },
      { id: 'q4', title: '低壓順手', subtitle: '低價值干擾・順便進行・考慮放生', color: '#94a3b8', borderClass: 'box-q4' }
    ];

    quadrantConfig.forEach(quad => {
      const qItems = filteredItems.filter(it => getComputedQuadrant(it) === quad.id);

      const box = document.createElement('div');
      box.className = `matrix-quadrant-box ${quad.borderClass}`;
      box.dataset.quadrant = quad.id;

      // 拖曳放置目標 (Drop Zone)
      box.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        box.classList.add('drag-over');
      });
      box.addEventListener('dragleave', (e) => {
        if (!box.contains(e.relatedTarget)) {
          box.classList.remove('drag-over');
        }
      });
      box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.classList.remove('drag-over');
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId) return;
        const targetItem = items.find(it => it.id === itemId);
        if (!targetItem) return;

        const targetQuadId = quad.id; // 'q1', 'q2', 'q3', 'q4'
        if (targetItem.manualQuadrant === targetQuadId) return;

        targetItem.manualQuadrant = targetQuadId;
        targetItem.quadrant = targetQuadId;
        targetItem.updatedAt = Date.now();
        saveItems();
        renderAll();
        renderMatrixModal();
        showToast(`已將任務移至 ${quad.title} (${quad.id.toUpperCase()})`);
      });

      const header = document.createElement('div');
      header.className = 'matrix-quadrant-header';

      const title = document.createElement('div');
      title.className = 'matrix-quadrant-title';
      title.style.color = quad.color;
      title.textContent = quad.title;

      const count = document.createElement('span');
      count.className = 'matrix-quadrant-count';
      count.textContent = `${qItems.length} 件`;

      header.appendChild(title);
      header.appendChild(count);
      box.appendChild(header);

      const desc = document.createElement('div');
      desc.className = 'matrix-quadrant-desc';
      desc.textContent = quad.subtitle;
      box.appendChild(desc);

      const itemsList = document.createElement('div');
      itemsList.className = 'matrix-quadrant-items';

      if (qItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-neutral';
        empty.style.padding = '24px 0';
        empty.style.fontSize = '0.78rem';
        empty.textContent = '此象限尚無待辦事項 (可將卡片拖曳至此)';
        itemsList.appendChild(empty);
      } else {
        qItems.forEach(it => {
          const card = document.createElement('div');
          card.className = `matrix-item-card ${it.isNow ? 'is-now' : ''}`;
          card.draggable = true;

          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', it.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('is-dragging');
          });
          card.addEventListener('dragend', () => {
            card.classList.remove('is-dragging');
            document.querySelectorAll('.matrix-quadrant-box').forEach(b => b.classList.remove('drag-over'));
          });

          const mainRow = document.createElement('div');
          mainRow.className = 'matrix-item-main';

          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.className = 'card-check';
          chk.checked = !!it.done;
          chk.addEventListener('change', (e) => {
            toggleItemDone(it.id, e.target.checked);
            renderMatrixModal();
          });

          const textEl = document.createElement('div');
          textEl.className = 'matrix-item-text';
          textEl.textContent = it.text;

          mainRow.appendChild(chk);
          mainRow.appendChild(textEl);
          card.appendChild(mainRow);

          // Meta Row
          const metaRow = document.createElement('div');
          metaRow.className = 'matrix-item-meta';

          const tagsWrap = document.createElement('div');
          tagsWrap.className = 'matrix-item-tags';

          const bucketLabels = { today: '今日', week: '這週', keep: '保溫', inbox: '收集箱', release: '放生' };
          const bucketTag = document.createElement('span');
          bucketTag.className = 'chip';
          bucketTag.style.background = 'rgba(255,255,255,0.05)';
          bucketTag.textContent = bucketLabels[it.bucket] || it.bucket;
          tagsWrap.appendChild(bucketTag);

          const sizeTag = document.createElement('span');
          const itSize = it.size || guessSize(it.text, it.typeId);
          sizeTag.className = `chip chip-size chip-size-${itSize}`;
          const sizeLabels = { small: '小', medium: '中', large: '大' };
          sizeTag.textContent = sizeLabels[itSize] || '小';
          tagsWrap.appendChild(sizeTag);

          // 在矩陣總覽視圖中，因屬宏觀規劃，顯示死線供調配
          if (it.deadline) {
            const dlTag = document.createElement('span');
            dlTag.className = 'chip';
            dlTag.style.background = 'rgba(192, 132, 252, 0.12)';
            dlTag.style.color = '#c084fc';
            dlTag.style.border = '1px solid rgba(192, 132, 252, 0.3)';
            dlTag.textContent = it.deadline.substring(5);
            tagsWrap.appendChild(dlTag);
          }

          metaRow.appendChild(tagsWrap);

          // Actions
          const actionsWrap = document.createElement('div');
          actionsWrap.className = 'matrix-item-actions';

          // 調整死線按鈕 (代替手動切換象限，讓系統自動重算象限)
          const btnDeadline = document.createElement('button');
          btnDeadline.className = 'btn-matrix-shift';
          btnDeadline.textContent = it.deadline ? it.deadline.substring(5) : '設死線';
          btnDeadline.title = '點擊設定或調整死線（系統會自動重新計算象限）';
          btnDeadline.addEventListener('click', (e) => {
            e.stopPropagation();
            openDeadlinePicker(it.id, btnDeadline);
          });
          actionsWrap.appendChild(btnDeadline);

          const btnNow = document.createElement('button');
          btnNow.className = `btn-matrix-shift ${it.isNow ? 'is-active' : ''}`;
          btnNow.style.color = it.isNow ? 'var(--accent-primary)' : 'inherit';
          btnNow.textContent = it.isNow ? '取消「現在」' : '設為「現在」';
          btnNow.addEventListener('click', () => {
            toggleItemNow(it.id);
            renderMatrixModal();
          });
          actionsWrap.appendChild(btnNow);

          metaRow.appendChild(actionsWrap);
          card.appendChild(metaRow);
          itemsList.appendChild(card);
        });
      }

      box.appendChild(itemsList);
      container.appendChild(box);
    });
  }

  // --- 幫我選：依條件推薦引擎 (Auto-Decide) ---
  let autoDecideCandidates = [];
  let autoDecideCurrentIndex = 0;
  let autoDecidePreviewItemId = null;

  function runAutoDecideTask() {
    // 優先挑選未完成之活躍項目 (今日 > 這週 > 保溫)
    const activeItems = items.filter(it => !it.done && !it.parentId);
    if (activeItems.length === 0) {
      showToast('工作桌目前沒有任何待辦任務，請先新增幾項任務！');
      return;
    }

    const todayItems = activeItems.filter(it => it.bucket === 'today');
    const weekItems = activeItems.filter(it => it.bucket === 'week');
    const keepItems = activeItems.filter(it => it.bucket === 'keep');

    let pool = [];
    if (todayItems.length > 0) {
      pool = todayItems;
    } else if (weekItems.length > 0) {
      pool = weekItems;
    } else if (keepItems.length > 0) {
      pool = keepItems;
    } else {
      pool = activeItems;
    }

    // 計算每個任務的加權分數與決策理由
    const scoredList = pool.map(item => {
      let score = 0;
      const reasons = [];

      // 1. 系統客觀判定四象限基本權重
      const quad = getComputedQuadrant(item);
      if (quad === 'q1') {
        score += 100;
        reasons.push('系統自動判定【Q1 迫在眉睫】核心焦點');
      } else if (quad === 'q2') {
        score += 70;
        reasons.push('系統自動判定【Q2 核心深耕】重要推進');
      } else if (quad === 'q3') {
        score += 40;
        reasons.push('系統自動判定【Q3 瑣事速辦】待快速消化');
      } else {
        score += 15;
        reasons.push('系統自動判定【Q4 順手雜項】備用項目');
      }

      // 2. 截止死線臨近度加權 (隱形死線)
      if (item.deadline) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const deadlineDate = new Date(item.deadline + 'T23:59:59');
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0 || item.deadline <= todayStr) {
          score += 85;
          reasons.push('截止死線就在今天（或已逾期），迫在眉睫');
        } else if (diffDays <= 2) {
          score += 50;
          reasons.push(`死線將在 ${diffDays} 天內到期`);
        } else if (diffDays <= 7) {
          score += 25;
          reasons.push('本週內有死線需要推進');
        } else {
          score += 10;
        }
      }

      // 3. 生理節律與當前時段適配
      const currentHour = (new Date()).getHours();
      const itemSize = item.size || guessSize(item.text, item.typeId);

      if (currentHour >= 6 && currentHour < 12) {
        // 早晨/上午：專注力最佳
        if (itemSize === 'large' && (quad === 'q1' || quad === 'q2')) {
          score += 30;
          reasons.push('早晨精神飽滿，是攻克大任務的最佳時機');
        } else if (itemSize === 'medium') {
          score += 20;
          reasons.push('上午時段適合中度專注推進');
        } else {
          score += 10;
        }
      } else if (currentHour >= 12 && currentHour < 18) {
        // 下午：穩定推進
        if (itemSize === 'medium') {
          score += 25;
          reasons.push('下午適合穩定推進 1-2 小時專注任務');
        } else if (itemSize === 'small') {
          score += 20;
          reasons.push('下午適合清理部分小任務');
        } else {
          score += 10;
        }
      } else {
        // 晚間/深夜 (18:00 - 05:00)：意志力遞減，避免心理壓力抗拒，優先推小任務
        if (itemSize === 'micro') {
          score += 40;
          reasons.push('晚間時段意志力有限，選 5-10m 試水溫起步阻力最低');
        } else if (itemSize === 'small') {
          score += 35;
          reasons.push('晚間時段適合推進 15-30m 小任務');
        } else if (item.typeId === 'tidy' || item.typeId === 'admin') {
          score += 25;
          reasons.push('晚間適合做整理或行政雜務');
        } else if (itemSize === 'large') {
          score -= 20; // 深夜降低大任務權重，防拖延崩潰
        }
      }

      // 4. 工作桌池加成
      if (item.bucket === 'today') {
        score += 40;
      } else if (item.bucket === 'week') {
        score += 10;
      }

      return {
        item,
        score,
        reasonSummary: reasons.slice(0, 2).join('，') + '。'
      };
    });

    // 依分數降序排列
    scoredList.sort((a, b) => b.score - a.score);

    autoDecideCandidates = scoredList;
    autoDecideCurrentIndex = 0;

    applyAutoDecideCandidate(0);
  }

  function applyAutoDecideCandidate(index) {
    if (!autoDecideCandidates || autoDecideCandidates.length === 0) return;
    if (index >= autoDecideCandidates.length) {
      index = 0;
    }
    autoDecideCurrentIndex = index;
    const candidate = autoDecideCandidates[index];
    const item = candidate.item;

    // 僅記錄預覽候選任務 ID，不提前更改任務狀態，待使用者確認才設為現在
    autoDecidePreviewItemId = item.id;

    // 填入彈窗內容
    const modal = document.getElementById('modalAutoDecide');
    const titleEl = document.getElementById('autoDecideTaskTitle');
    const quadBadge = document.getElementById('autoDecideQuadrantBadge');
    const sizeBadge = document.getElementById('autoDecideSizeBadge');
    const bucketBadge = document.getElementById('autoDecideBucketBadge');
    const reasonText = document.getElementById('autoDecideReasonText');

    if (titleEl) titleEl.textContent = item.text;

    const quadInfo = getQuadrantInfo(item);
    if (quadBadge) {
      quadBadge.className = `chip chip-quadrant chip-quadrant-${quadInfo.id}`;
      quadBadge.textContent = quadInfo.badge;
    }

    const itemSize = item.size || 'micro';
    const sizeLabels = { micro: '試水溫 5-10m', small: '小 15-30m', medium: '中 1-2h', large: '大 2h+' };
    if (sizeBadge) {
      sizeBadge.className = `chip chip-size chip-size-${itemSize}`;
      sizeBadge.textContent = sizeLabels[itemSize] || '試水溫 5-10m';
    }

    const bucketLabels = { today: '今日工作桌', week: '本週工作桌', keep: '保溫', inbox: '收集箱' };
    if (bucketBadge) {
      bucketBadge.textContent = bucketLabels[item.bucket] || '工作桌';
    }

    if (reasonText) {
      reasonText.textContent = `推薦理由：${candidate.reasonSummary}`;
    }

    if (modal) modal.style.display = 'flex';
  }

  // --- 常駐環境推薦引擎 (Ambient Suggestion Engine) ---
  function getAmbientCandidates() {
    const now = new Date();
    const currentHour = now.getHours();
    const todayStr = getTodayDateStr();

    // 候選池：
    // 1. 今日工作桌未完成主要任務
    // 2. 這週工作桌未完成主要任務
    // 3. 每日習慣未完成者 (isRoutine && !done)
    const pool = items.filter(it => {
      if (it.done || it.parentId) return false;
      if (it.isRoutine) {
        return true;
      }
      return it.bucket === 'today' || it.bucket === 'week';
    });

    if (pool.length === 0) return [];

    const scored = pool.map(item => {
      let score = 0;
      const reasons = [];

      if (item.isRoutine) {
        score += 65;
        const trigger = item.routineTrigger || 'recharge';
        if (trigger === 'recharge' && (currentUserState.energy === 'low' || currentUserState.flow === 'stuck')) {
          score += 55;
          reasons.push('身心疲憊或卡關時，適合執行此習慣重置大腦');
        } else if (trigger === 'high' && currentUserState.energy === 'high') {
          score += 45;
          reasons.push('目前體能充沛，適合進行高強度習慣');
        } else if (trigger === 'evening' && currentHour >= 17) {
          score += 45;
          reasons.push('傍晚晚間時段，是養成此生活習慣的黃金期');
        } else {
          score += 25;
          reasons.push('今日日常習慣待完成');
        }
      } else {
        const quad = getComputedQuadrant(item);
        const itemSize = item.size || guessSize(item.text, item.typeId);

        // 1. 四象限基礎權重
        if (quad === 'q1') {
          score += 90;
          reasons.push('Q1 迫在眉睫核心焦點');
        } else if (quad === 'q2') {
          score += 70;
          reasons.push('Q2 重要深耕項目');
        } else if (quad === 'q3') {
          score += 40;
          reasons.push('Q3 瑣事速辦');
        } else {
          score += 20;
          reasons.push('順手雜項');
        }

        // 2. 死線臨近度
        if (item.deadline) {
          if (item.deadline <= todayStr) {
            score += 60;
            reasons.push('死線就在今天');
          } else {
            const diffDays = Math.ceil((new Date(item.deadline + 'T23:59:59').getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 2) {
              score += 35;
              reasons.push(`${diffDays} 天內到期`);
            }
          }
        }

        // 3. 使用者當前身心二維狀態適配
        const { energy, flow } = currentUserState;
        if (energy === 'high' && flow === 'smooth') {
          if (itemSize === 'large' || itemSize === 'medium') {
            score += 45;
            reasons.push('精神飽滿且思緒順暢，是攻克大任務的最佳時機');
          }
        } else if (energy === 'high' && flow === 'stuck') {
          if (itemSize === 'micro' || itemSize === 'small' || item.typeId === 'hands_on') {
            score += 40;
            reasons.push('體能充足但思緒卡關，建議切換動手做或小題目');
          }
        } else if (energy === 'low' && flow === 'smooth') {
          if (itemSize === 'small' || item.typeId === 'admin' || item.typeId === 'tidy') {
            score += 40;
            reasons.push('手感順暢但已略感疲態，適合行政收尾與整理');
          }
        } else if (energy === 'low' && flow === 'stuck') {
          if (itemSize === 'micro') {
            score += 55;
            reasons.push('大腦疲憊過載，建議只花 5-10m 試水溫起步');
          } else if (itemSize === 'large') {
            score -= 50; // 降低大任務避免抗拒
          }
        }

        // 4. 工作桌位置加權
        if (item.bucket === 'today') {
          score += 30;
        } else if (item.bucket === 'week') {
          score += 10;
        }
      }

      return {
        item,
        score,
        reasonSummary: reasons.slice(0, 2).join(' · ') || '符合目前節奏'
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  function renderAmbientSuggestion() {
    const bar = document.getElementById('ambientSuggestionBar');
    if (!bar) return;

    if (ambientDismissed) {
      bar.style.display = 'none';
      return;
    }

    const stateTextEl = document.getElementById('ambientStateText');
    const prefixEl = document.getElementById('ambientTaskPrefix');
    const titleEl = document.getElementById('ambientTaskTitle');
    const chipsEl = document.getElementById('ambientTaskChips');
    const reasonEl = document.getElementById('ambientReasonText');
    const btnAccept = document.getElementById('btnAmbientAccept');

    const stateLabels = {
      'high_smooth': '狀態：充沛 · 順暢',
      'high_stuck': '狀態：充沛 · 卡關',
      'low_smooth': '狀態：疲憊 · 順暢',
      'low_stuck': '狀態：疲憊 · 卡關'
    };
    const key = `${currentUserState.energy}_${currentUserState.flow}`;
    if (stateTextEl) stateTextEl.textContent = stateLabels[key] || '狀態：點擊切換';

    const nowItem = items.find(it => it.isNow && !it.done);
    if (nowItem) {
      bar.style.display = 'block';
      if (prefixEl) prefixEl.textContent = '專注中';
      if (titleEl) titleEl.textContent = nowItem.text;
      if (chipsEl) {
        chipsEl.innerHTML = '';
        const chip = document.createElement('span');
        chip.className = 'chip chip-now';
        chip.textContent = '● 現在做這個';
        chipsEl.appendChild(chip);
      }
      if (reasonEl) reasonEl.textContent = '目前工作桌已鎖定此任務，點擊右側可直接開啟沉浸專注。';
      if (btnAccept) btnAccept.textContent = '進入專注';
      return;
    }

    const candidates = getAmbientCandidates();
    ambientCandidates = candidates;

    if (candidates.length === 0) {
      bar.style.display = 'none';
      return;
    }

    if (ambientCurrentIndex >= candidates.length) {
      ambientCurrentIndex = 0;
    }

    const pick = candidates[ambientCurrentIndex];
    const item = pick.item;

    bar.style.display = 'block';
    if (prefixEl) prefixEl.textContent = item.isRoutine ? '習慣推薦' : '環境推薦';
    if (titleEl) titleEl.textContent = item.text;
    if (chipsEl) {
      chipsEl.innerHTML = '';
      if (item.isRoutine) {
        const rChip = document.createElement('span');
        rChip.className = 'chip chip-routine';
        rChip.textContent = '每日習慣';
        chipsEl.appendChild(rChip);
      } else {
        const qInfo = getQuadrantInfo(item);
        const qChip = document.createElement('span');
        qChip.className = `chip chip-quadrant chip-quadrant-${qInfo.id}`;
        qChip.textContent = qInfo.badge;
        chipsEl.appendChild(qChip);
      }
    }
    if (reasonEl) reasonEl.textContent = pick.reasonSummary;
    if (btnAccept) btnAccept.textContent = '聚焦現在';
  }

  function handleAmbientAccept() {
    const nowItem = items.find(it => it.isNow && !it.done);
    if (nowItem) {
      openKairosFocusModal(nowItem);
      return;
    }

    if (!ambientCandidates || ambientCandidates.length === 0) return;
    const pick = ambientCandidates[ambientCurrentIndex];
    if (!pick) return;
    const item = pick.item;

    if (item.isRoutine) {
      item.bucket = 'today';
      setAsNow(item.id);
      showToast(`已將習慣「${item.text}」移至今日並聚焦現在！`);
    } else {
      setAsNow(item.id);
      showToast(`已採納推薦，聚焦「${item.text}」！`);
    }
    renderAll();
  }

  function handleAmbientNext() {
    if (!ambientCandidates || ambientCandidates.length === 0) return;
    ambientCurrentIndex = (ambientCurrentIndex + 1) % ambientCandidates.length;
    renderAmbientSuggestion();
  }

  function handleAmbientDismiss() {
    ambientDismissed = true;
    const bar = document.getElementById('ambientSuggestionBar');
    if (bar) bar.style.display = 'none';
  }

  // --- 每日習慣庫視窗管理 (Routines Management) ---
  function openRoutinesModal() {
    renderRoutinesModal();
    const modal = document.getElementById('modalRoutines');
    if (modal) modal.style.display = 'flex';
  }

  function closeRoutinesModal() {
    const modal = document.getElementById('modalRoutines');
    if (modal) modal.style.display = 'none';
  }

  function renderRoutinesModal() {
    const listArea = document.getElementById('routineListArea');
    if (!listArea) return;
    listArea.innerHTML = '';

    const routines = items.filter(it => it.isRoutine && !it.parentId);
    if (routines.length === 0) {
      listArea.innerHTML = '<div class="empty-neutral">目前尚無每日習慣。可在上方輸入習慣（例如：核心拉筋、慢跑 30 分鐘、讀論文 1 篇）！</div>';
      return;
    }

    const triggerLabels = {
      recharge: '疲憊/卡關時浮出',
      high: '精力充沛時浮出',
      evening: '傍晚時浮出',
      any: '任意契合時段浮出'
    };

    routines.forEach(r => {
      const row = document.createElement('div');
      row.className = 'routine-item-row';

      const info = document.createElement('div');
      info.className = 'routine-item-info';

      const title = document.createElement('div');
      title.className = 'routine-item-title';
      title.textContent = r.text;
      if (r.done) {
        title.style.textDecoration = 'line-through';
        title.style.opacity = '0.55';
      }

      const meta = document.createElement('div');
      meta.className = 'routine-item-meta';
      const triggerText = triggerLabels[r.routineTrigger || 'recharge'] || '任意時段';
      meta.textContent = `${triggerText} · 今日${r.done ? '已完成' : '待命推薦'}`;

      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'routine-item-actions';

      const btnToggle = document.createElement('button');
      btnToggle.className = 'btn-triage';
      btnToggle.textContent = r.done ? '重設' : '完成';
      btnToggle.addEventListener('click', () => {
        r.done = !r.done;
        r.doneAt = r.done ? Date.now() : null;
        r.updatedAt = Date.now();
        saveItems();
        renderRoutinesModal();
        renderAll();
        showToast(r.done ? `今日「${r.text}」已完成！` : `「${r.text}」已重設為待命`);
      });

      const btnDoNow = document.createElement('button');
      btnDoNow.className = 'btn-triage';
      btnDoNow.textContent = '現在做';
      btnDoNow.addEventListener('click', () => {
        closeRoutinesModal();
        r.bucket = 'today';
        setAsNow(r.id);
        renderAll();
        showToast(`已將習慣「${r.text}」設為現在！`);
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-delete-subtask';
      btnDel.innerHTML = '&times;';
      btnDel.title = '刪除此習慣';
      btnDel.addEventListener('click', () => {
        if (confirm(`確定要刪除習慣「${r.text}」嗎？`)) {
          deleteItem(r.id);
          renderRoutinesModal();
          renderAll();
        }
      });

      actions.appendChild(btnToggle);
      actions.appendChild(btnDoNow);
      actions.appendChild(btnDel);

      row.appendChild(info);
      row.appendChild(actions);
      listArea.appendChild(row);
    });
  }

  function addRoutine(text, trigger = 'recharge') {
    if (!text || !text.trim()) return;
    const item = {
      id: generateId(),
      text: text.trim(),
      size: 'micro',
      bucket: 'keep', // 平時收納，不干擾主工作桌
      isNow: false,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      typeId: guessTypeByKeywords(text.trim()) || 'physical',
      typeSource: 'rule',
      parentId: null,
      aiGenerated: false,
      manualQuadrant: null,
      quadrant: 'q2',
      deadline: null,
      isRoutine: true,
      routineTrigger: trigger,
      routineCadence: 'daily',
      lastResetDate: getTodayDateStr()
    };
    items.push(item);
    saveItems();
    renderRoutinesModal();
    renderAll();
    showToast(`已新增每日習慣「${item.text}」！`);
  }

  // --- 完成紀錄 Modal 渲染 ---
  function renderHistoryModal() {
    const listArea = document.getElementById('historyListArea');
    if (!listArea) return;
    listArea.innerHTML = '';

    const completedItems = items.filter(it => it.done && !it.parentId);
    if (completedItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '目前尚無完成紀錄。完成的項目會按週分類記錄於此。';
      listArea.appendChild(emptyMsg);
      return;
    }

    // 按週分組
    const groups = {};
    completedItems.forEach(it => {
      const key = it.doneAt ? getWeekKey(new Date(it.doneAt)) : '未知週別';
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });

    const sortedWeeks = Object.keys(groups).sort().reverse();

    sortedWeeks.forEach(weekKey => {
      const groupCard = document.createElement('div');
      groupCard.className = 'consult-card';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const title = document.createElement('div');
      title.className = 'consult-task-title';
      title.textContent = weekKey === '未知週別' ? '過去紀錄' : `${weekKey} (${getWeekDateRangeStr(weekKey)})`;

      const countBadge = document.createElement('span');
      countBadge.className = 'folder-badge';
      countBadge.textContent = `完成 ${groups[weekKey].length} 件`;

      header.appendChild(title);
      header.appendChild(countBadge);
      groupCard.appendChild(header);

      const itemsList = document.createElement('div');
      itemsList.style.display = 'flex';
      itemsList.style.flexDirection = 'column';
      itemsList.style.gap = '6px';
      itemsList.style.marginTop = '8px';

      groups[weekKey].forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.fontSize = '0.85rem';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.text;
        nameSpan.style.textDecoration = 'line-through';
        nameSpan.style.color = 'var(--text-muted)';

        const actWrap = document.createElement('div');
        actWrap.style.display = 'flex';
        actWrap.style.gap = '6px';

        const btnRestore = document.createElement('button');
        btnRestore.className = 'btn-triage';
        btnRestore.textContent = '復原';
        btnRestore.addEventListener('click', () => {
          toggleItemDone(item.id, false);
          renderHistoryModal();
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-delete-subtask';
        btnDel.innerHTML = '&times;';
        btnDel.title = '刪除此紀錄';
        btnDel.addEventListener('click', () => {
          deleteItem(item.id);
          renderHistoryModal();
        });

        actWrap.appendChild(btnRestore);
        actWrap.appendChild(btnDel);
        row.appendChild(nameSpan);
        row.appendChild(actWrap);
        itemsList.appendChild(row);
      });

      groupCard.appendChild(itemsList);
      listArea.appendChild(groupCard);
    });
  }

  // --- 歷史檔案卡片元素建構 ---
  function createHistoryCardElement(item) {
    const card = document.createElement('div');
    card.className = 'task-card is-done';
    card.dataset.cardId = item.id;
    card.style.opacity = '0.88';
    card.style.borderColor = 'rgba(255, 255, 255, 0.08)';

    const mainRow = document.createElement('div');
    mainRow.className = 'card-main-row';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'card-check';
    check.checked = true;
    check.title = '取消勾選可復原回工作桌';
    check.addEventListener('change', () => {
      toggleItemDone(item.id, false);
      showToast(`已將「${item.text}」復原回工作桌`);
    });

    const body = document.createElement('div');
    body.className = 'card-body';

    const textEl = document.createElement('div');
    textEl.className = 'card-text';
    textEl.style.textDecoration = 'line-through';
    textEl.style.color = 'var(--text-muted)';
    textEl.textContent = item.text;

    const metaRow = document.createElement('div');
    metaRow.className = 'card-meta-row';

    // 完成時間 Chip
    const timeChip = document.createElement('span');
    timeChip.className = 'chip';
    const doneDate = item.doneAt ? new Date(item.doneAt) : null;
    const timeStr = doneDate ? `${doneDate.getMonth() + 1}/${doneDate.getDate()} ${String(doneDate.getHours()).padStart(2, '0')}:${String(doneDate.getMinutes()).padStart(2, '0')} 完成` : '已完成';
    timeChip.textContent = timeStr;
    timeChip.style.color = 'var(--accent-secondary)';
    metaRow.appendChild(timeChip);

    // 尺寸 Chip
    const itemSize = item.size || guessSize(item.text, item.typeId);
    const sizeChip = document.createElement('span');
    sizeChip.className = `chip chip-size chip-size-${itemSize}`;
    const sizeMap = { micro: '試水溫 5-10m', small: '小 15-30m', medium: '中 1-2h', large: '大 2h+' };
    sizeChip.textContent = sizeMap[itemSize] || '小';
    metaRow.appendChild(sizeChip);

    // 原始分堆來源標籤
    const bucketChip = document.createElement('span');
    bucketChip.className = 'chip';
    const bucketMap = { today: '今日', week: '這週', inbox: '收集箱', keep: '保溫', release: '放生' };
    bucketChip.textContent = bucketMap[item.bucket] || '工作桌';
    metaRow.appendChild(bucketChip);

    body.appendChild(textEl);
    body.appendChild(metaRow);
    mainRow.appendChild(check);
    mainRow.appendChild(body);
    card.appendChild(mainRow);

    // 操作按鈕行
    const actionsRow = document.createElement('div');
    actionsRow.className = 'card-actions-row';

    const triageBtns = document.createElement('div');
    triageBtns.className = 'card-triage-btns';

    const btnRestoreToday = document.createElement('button');
    btnRestoreToday.className = 'btn-triage';
    btnRestoreToday.textContent = '回今日';
    btnRestoreToday.title = '復原至今日工作桌';
    btnRestoreToday.addEventListener('click', () => {
      item.done = false;
      item.doneAt = null;
      item.bucket = 'today';
      item.updatedAt = Date.now();
      saveItems();
      renderAll();
      showToast(`已將「${item.text}」復原至今日工作桌`);
    });
    triageBtns.appendChild(btnRestoreToday);

    const btnRestoreWeek = document.createElement('button');
    btnRestoreWeek.className = 'btn-triage';
    btnRestoreWeek.textContent = '回這週';
    btnRestoreWeek.title = '復原至這週工作桌';
    btnRestoreWeek.addEventListener('click', () => {
      item.done = false;
      item.doneAt = null;
      item.bucket = 'week';
      item.updatedAt = Date.now();
      saveItems();
      renderAll();
      showToast(`已將「${item.text}」復原至這週工作桌`);
    });
    triageBtns.appendChild(btnRestoreWeek);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-delete-card';
    btnDel.textContent = '刪除此紀錄';
    btnDel.addEventListener('click', () => {
      if (confirm(`確定要永久刪除「${item.text}」的紀錄嗎？`)) {
        deleteItem(item.id);
        showToast('已從歷史檔案中刪除');
      }
    });

    actionsRow.appendChild(triageBtns);
    actionsRow.appendChild(btnDel);
    card.appendChild(actionsRow);

    return card;
  }

  // --- 歷史檔案庫渲染 ---
  function renderHistoryArchive() {
    const listEl = document.getElementById('historyArchiveCardList');
    const badgeEl = document.getElementById('historyCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '';
    const completedItems = items.filter(it => it.done && !it.parentId);
    if (badgeEl) badgeEl.textContent = completedItems.length;

    if (completedItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '歷史檔案庫目前是空的。當在今日或這週勾選完成任務時，會自動歸檔於此，不直接刪除。';
      listEl.appendChild(emptyMsg);
      return;
    }

    // 依完成時間排序（最新完成的在最前）
    completedItems.sort((a, b) => (b.doneAt || b.updatedAt || 0) - (a.doneAt || a.updatedAt || 0));

    completedItems.forEach(item => {
      listEl.appendChild(createHistoryCardElement(item));
    });
  }

  // 匯出歷史封存檔案為 Markdown
  function exportHistoryMarkdown() {
    const completedItems = items.filter(it => it.done && !it.parentId);
    if (completedItems.length === 0) {
      showToast('目前尚無完成任務可供匯出');
      return;
    }

    const groups = {};
    completedItems.forEach(it => {
      const key = it.doneAt ? getWeekKey(new Date(it.doneAt)) : '未知週別';
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let md = `# Task Desk - 歷史完成任務封存檔案\n`;
    md += `*匯出時間：${now.toLocaleString()}*\n`;
    md += `*總完成件數：${completedItems.length} 件*\n\n---\n\n`;

    const sortedWeeks = Object.keys(groups).sort().reverse();
    sortedWeeks.forEach(weekKey => {
      const range = weekKey === '未知週別' ? '' : ` (${getWeekDateRangeStr(weekKey)})`;
      md += `## ${weekKey}${range} - 完成 ${groups[weekKey].length} 件\n\n`;
      groups[weekKey].forEach(it => {
        const doneTime = it.doneAt ? new Date(it.doneAt).toLocaleString() : '未知時間';
        const size = it.size || guessSize(it.text, it.typeId);
        const sizeMap = { small: '小 15-30m', medium: '中 1-2h', large: '大 2h+' };
        const typeObj = getTypeById(it.typeId);
        const typeName = typeObj ? typeObj.name : '未分類';
        md += `- [x] **${it.text}**\n  - 尺寸：${sizeMap[size] || size} | 類型：${typeName} | 完成時間：${doneTime}\n`;
      });
      md += `\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskDesk-History-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`已匯出 Markdown 歷史檔案 (${completedItems.length} 件)`);
  }

  // 匯出歷史封存檔案為 JSON
  function exportHistoryJson() {
    const completedItems = items.filter(it => it.done && !it.parentId);
    if (completedItems.length === 0) {
      showToast('目前尚無完成任務可供匯出');
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const data = {
      app: 'Task Desk',
      type: 'completed-tasks-archive',
      exportedAt: Date.now(),
      totalCount: completedItems.length,
      tasks: completedItems
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskDesk-History-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`已匯出 JSON 歷史檔案 (${completedItems.length} 件)`);
  }

  // --- 狀態諮詢介面互動 ---
  function openConsultModal() {
    consultState.turnsRemaining = 5;
    consultState.chatHistory = [];

    // 重設回點選表單狀態
    const formArea = document.getElementById('consultFormArea');
    const resultArea = document.getElementById('consultResultArea');
    const footer = document.getElementById('consultFooter');
    const modal = document.getElementById('modalConsult');

    if (formArea) formArea.style.display = 'block';
    if (resultArea) resultArea.style.display = 'none';
    if (footer) footer.style.display = 'flex';
    if (modal) modal.style.display = 'flex';
  }

  async function executeConsultation() {
    const userState = {
      place: consultState.selectedPlace,
      body: consultState.selectedBody,
      mind: consultState.selectedMind,
      time: parseInt(consultState.selectedTime, 10),
      later: consultState.selectedLater
    };

    const candidates = getConsultCandidates(userState);
    consultState.candidates = candidates;

    const formArea = document.getElementById('consultFormArea');
    const resultArea = document.getElementById('consultResultArea');
    const footer = document.getElementById('consultFooter');

    if (formArea) formArea.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (resultArea) {
      resultArea.style.display = 'flex';
      resultArea.innerHTML = '<div class="empty-neutral">正在依條件評估適合的選項…</div>';
    }

    // 若完全沒有符合的項目
    if (candidates.length === 0) {
      resultArea.innerHTML = '';
      const noMatchCard = document.createElement('div');
      noMatchCard.className = 'consult-card';
      noMatchCard.innerHTML = `
        <div class="consult-task-title">目前狀態下沒有符合的項目</div>
        <div class="consult-reason">根據您選擇的地點、時間與體力精神，目前「這週」清單中沒有完全相符的任務。保持中性，不勉強進行。</div>
        <div class="consult-card-actions" style="margin-top: 10px;">
          <button id="btnConsultRandomPick" class="btn-secondary">隨機挑一件（零力氣備案）</button>
          <button id="btnConsultCloseNone" class="btn-secondary">關閉</button>
        </div>
      `;
      resultArea.appendChild(noMatchCard);

      document.getElementById('btnConsultCloseNone').addEventListener('click', () => {
        document.getElementById('modalConsult').style.display = 'none';
      });

      document.getElementById('btnConsultRandomPick').addEventListener('click', () => {
        pickRandomWeekItem();
      });
      return;
    }

    // 符合項目存在：直接使用本機規則客觀推薦前 2 件
    const topPicks = candidates.slice(0, 2);
    const recommendations = topPicks.map(entry => ({
      entry,
      reason: '符合您目前設定的地點、可用時間與精神體力條件。'
    }));

    renderConsultResults(recommendations);
  }

  function pickRandomWeekItem() {
    const uncompletedActive = items.filter(it => (it.bucket === 'today' || it.bucket === 'week') && !it.parentId && !it.done);
    if (uncompletedActive.length === 0) {
      showToast('目前「今日」或「這週」沒有未完成項目');
      document.getElementById('modalConsult').style.display = 'none';
      return;
    }
    const chosen = uncompletedActive[Math.floor(Math.random() * uncompletedActive.length)];
    toggleItemNow(chosen.id);
    showToast(`已隨機將「${chosen.text}」設為「現在」`);
    document.getElementById('modalConsult').style.display = 'none';
  }

  function renderConsultResults(recommendations) {
    const resultArea = document.getElementById('consultResultArea');
    resultArea.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'consult-label';
    titleEl.textContent = '建議選項（只提供參考，由您決定）：';
    resultArea.appendChild(titleEl);

    recommendations.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'consult-card';

      const taskTitle = document.createElement('div');
      taskTitle.className = 'consult-task-title';
      taskTitle.textContent = rec.entry.displayText;

      const reason = document.createElement('div');
      reason.className = 'consult-reason';
      reason.textContent = rec.reason;

      const actions = document.createElement('div');
      actions.className = 'consult-card-actions';

      const btnAdopt = document.createElement('button');
      btnAdopt.className = 'btn-primary';
      btnAdopt.textContent = '採用（標為現在）';
      btnAdopt.addEventListener('click', () => {
        toggleItemNow(rec.entry.id);
        showToast(`已將「${rec.entry.itemRef.text}」設為「現在」`);
        document.getElementById('modalConsult').style.display = 'none';
      });

      actions.appendChild(btnAdopt);
      card.appendChild(taskTitle);
      card.appendChild(reason);
      card.appendChild(actions);
      resultArea.appendChild(card);
    });

    // 底部全域按鈕：都不要 / 隨機挑一件
    const bottomBar = document.createElement('div');
    bottomBar.className = 'consult-card-actions';
    bottomBar.style.marginTop = '10px';

    const btnRandom = document.createElement('button');
    btnRandom.className = 'btn-secondary';
    btnRandom.textContent = '隨機挑一件（離線備案）';
    btnRandom.addEventListener('click', () => pickRandomWeekItem());

    const btnDismiss = document.createElement('button');
    btnDismiss.className = 'btn-secondary';
    btnDismiss.textContent = '都不要';
    btnDismiss.addEventListener('click', () => {
      document.getElementById('modalConsult').style.display = 'none';
    });

    bottomBar.appendChild(btnRandom);
    bottomBar.appendChild(btnDismiss);
    resultArea.appendChild(bottomBar);
  }

  // --- 資料匯出與匯入 ---
  function exportBackupJson() {
    const payload = {
      app: 'Task Desk',
      version: 1,
      exportedAt: new Date().toISOString(),
      items: items,
      settings: settings
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskdesk-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('備份 JSON 匯出完成');
  }

  function importBackupJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data && Array.isArray(data.items)) {
          items = data.items;
          if (data.settings) {
            settings = Object.assign({}, settings, data.settings);
            saveSettings();
            applyTheme(settings.theme);
          }
          saveItems();
          renderAll();
          showToast(`成功還原備份（共 ${items.length} 筆資料）`);
          document.getElementById('modalSettings').style.display = 'none';
        } else {
          showToast('匯入檔案格式不正確');
        }
      } catch (err) {
        showToast('無法解析此 JSON 備份檔');
      }
    };
    reader.readAsText(file);
  }

  // --- 跨裝置手動同步 (GitHub Gist & Direct Sync Code) ---
  function updateSyncModalStatus() {
    const badge = document.getElementById('syncStatusBadge');
    const timeText = document.getElementById('syncLastTimeText');
    const tokenInput = document.getElementById('syncGithubToken');
    const gistIdInput = document.getElementById('syncGistId');
    const configBody = document.getElementById('syncConfigBody');
    const configChevron = document.getElementById('syncConfigChevron');
    const gistLinkRow = document.getElementById('syncGistLinkRow');
    const gistLink = document.getElementById('syncGistLink');
    const localCountText = document.getElementById('syncLocalCountText');

    if (tokenInput) tokenInput.value = syncConfig.githubToken || '';
    if (gistIdInput) gistIdInput.value = syncConfig.gistId || '';
    if (localCountText) localCountText.textContent = `${items.length} 筆`;

    if (badge) {
      if (syncConfig.githubToken && syncConfig.gistId) {
        badge.textContent = '已連接 Gist (雙向同步就緒)';
        badge.style.color = 'var(--accent-primary)';
        badge.style.borderColor = 'var(--accent-primary)';
      } else if (syncConfig.githubToken) {
        badge.textContent = '已填 Token (首次同步將自動綁定)';
        badge.style.color = 'var(--accent-secondary)';
        badge.style.borderColor = 'var(--accent-secondary)';
      } else {
        badge.textContent = '尚未設定 Token';
        badge.style.color = 'var(--meta-text)';
        badge.style.borderColor = 'var(--border-light)';
        // 若尚未設定 Token，預設自動展開連線設定供使用者輸入
        if (configBody && (!configBody.style.display || configBody.style.display === 'none')) {
          configBody.style.display = 'flex';
          if (configChevron) configChevron.style.transform = 'rotate(180deg)';
        }
      }
    }

    if (gistLinkRow && gistLink) {
      if (syncConfig.gistId) {
        gistLink.href = `https://gist.github.com/${syncConfig.gistId}`;
        gistLinkRow.style.display = 'block';
      } else {
        gistLinkRow.style.display = 'none';
      }
    }

    if (timeText) {
      if (syncConfig.lastSyncTime) {
        const d = new Date(syncConfig.lastSyncTime);
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        timeText.textContent = `最後同步：${formatted}`;
      } else {
        timeText.textContent = '最後同步：尚無紀錄';
      }
    }
  }

  // 檢查雲端 Gist 上的目前任務筆數與狀態
  async function checkRemoteGistStatus(showToastMsg = false) {
    const remoteCountText = document.getElementById('syncRemoteCountText');
    const token = syncConfig.githubToken ? syncConfig.githubToken.trim() : '';
    let gistId = syncConfig.gistId ? syncConfig.gistId.trim() : '';

    if (!token) {
      if (remoteCountText) remoteCountText.textContent = '雲端 Gist：尚未設定 Token';
      return;
    }

    if (!gistId) {
      gistId = await findUserExistingGist(token);
      if (gistId) {
        syncConfig.gistId = gistId;
        saveSyncConfig();
        updateSyncModalStatus();
      }
    }

    if (!gistId) {
      if (remoteCountText) remoteCountText.textContent = '雲端 Gist：尚未建立備份檔';
      if (showToastMsg) showToast('您的 GitHub 帳號尚未建立 Task Desk Gist，初次使用請點「智慧雙向合併」！');
      return;
    }

    if (remoteCountText) remoteCountText.textContent = '雲端 Gist：正在讀取…';

    try {
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!resp.ok) {
        if (remoteCountText) remoteCountText.textContent = `雲端 Gist：讀取失敗 (${resp.status})`;
        return;
      }
      const data = await resp.json();
      const fileData = data.files && data.files['taskdesk-sync.json'];
      if (!fileData || !fileData.content) {
        if (remoteCountText) remoteCountText.textContent = '雲端 Gist：無同步檔案';
        return;
      }
      const remotePayload = JSON.parse(fileData.content);
      const count = Array.isArray(remotePayload.items) ? remotePayload.items.length : 0;
      const syncTimeStr = remotePayload.syncedAt ? new Date(remotePayload.syncedAt).toLocaleTimeString() : '未知';
      if (remoteCountText) {
        remoteCountText.textContent = `雲端 Gist：共 ${count} 筆任務 (${syncTimeStr})`;
      }
      if (showToastMsg) {
        showToast(`雲端 Gist 目前儲存了 ${count} 筆任務`);
      }
    } catch (e) {
      if (remoteCountText) remoteCountText.textContent = '雲端 Gist：連線失敗，請檢查網路';
    }
  }

  // 檢查並預備 Gist 授權設定（自動從輸入框讀取、檢核 Token 格式）
  async function prepareGistAuth() {
    const tokenInput = document.getElementById('syncGithubToken');
    const gistIdInput = document.getElementById('syncGistId');
    if (tokenInput && tokenInput.value.trim()) {
      syncConfig.githubToken = tokenInput.value.trim();
    }
    if (gistIdInput && gistIdInput.value.trim()) {
      syncConfig.gistId = gistIdInput.value.trim();
    }

    const token = syncConfig.githubToken ? syncConfig.githubToken.trim() : '';
    if (!token) {
      const configBody = document.getElementById('syncConfigBody');
      const configChevron = document.getElementById('syncConfigChevron');
      if (configBody) configBody.style.display = 'flex';
      if (configChevron) configChevron.style.transform = 'rotate(180deg)';
      if (tokenInput) tokenInput.focus();
      showToast('請先展開「Gist 連線設定」輸入 GitHub Token (可點選連結一鍵產生)');
      return false;
    }

    if (token.startsWith('github_pat_')) {
      showToast('GitHub 細粒度 Token (github_pat_) 不支援 Gist，請使用 Classic Token (以 ghp_ 開頭)');
      return false;
    }

    saveSyncConfig();
    updateSyncModalStatus();
    return true;
  }

  // 自動搜尋使用者 GitHub 帳號中現有的 Task Desk Gist
  async function findUserExistingGist(token) {
    if (!token) return null;
    try {
      const resp = await fetch('https://api.github.com/gists?per_page=30', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!resp.ok) return null;
      const gists = await resp.json();
      if (!Array.isArray(gists)) return null;

      const candidates = gists.filter(g => {
        if (g.files && g.files['taskdesk-sync.json']) return true;
        if (g.description && g.description.includes('Task Desk')) return true;
        return false;
      });

      if (candidates.length === 0) return null;

      // 依據 taskdesk-sync.json 的檔案大小降序排序（優先選取真正存有任務的 Gist，避免選到 0 筆空檔）
      candidates.sort((a, b) => {
        const sizeA = a.files && a.files['taskdesk-sync.json'] ? (a.files['taskdesk-sync.json'].size || 0) : 0;
        const sizeB = b.files && b.files['taskdesk-sync.json'] ? (b.files['taskdesk-sync.json'].size || 0) : 0;
        return sizeB - sizeA;
      });

      return candidates[0].id;
    } catch (e) {
      console.warn('自動搜尋 Gist 失敗:', e);
      return null;
    }
  }

  // 智慧雙向合併演算法（無損雙向合併）
  function smartMergeItems(localList, remoteList) {
    const itemMap = new Map();

    // 1. 先載入本機所有項目（深拷貝並確保完成狀態為嚴格布林值）
    for (const it of (localList || [])) {
      if (it && it.id) {
        itemMap.set(it.id, Object.assign({}, it, {
          done: !!it.done,
          doneAt: it.done ? (it.doneAt || it.updatedAt || Date.now()) : null
        }));
      }
    }

    // 輔助查找：比對 ID、rawId 或同名任務（防跨裝置重複建立且同步狀態丟失）
    function findExistingMatch(rIt) {
      if (!rIt) return null;
      // 精準比對 ID
      if (itemMap.has(rIt.id)) {
        return { matchKey: rIt.id, item: itemMap.get(rIt.id) };
      }
      // 比對 rawId (Google Tasks 或外部 ID)
      if (rIt.rawId) {
        for (const [key, it] of itemMap.entries()) {
          if (it.rawId === rIt.rawId || it.id === `gt_${rIt.rawId}` || rIt.id === `gt_${it.rawId}`) {
            return { matchKey: key, item: it };
          }
        }
      }
      // 比對標題（同為母任務且標題完全一致）
      if (!rIt.parentId && rIt.text && rIt.text.trim()) {
        const cleanRText = rIt.text.trim().toLowerCase();
        for (const [key, it] of itemMap.entries()) {
          if (!it.parentId && it.text && it.text.trim().toLowerCase() === cleanRText) {
            return { matchKey: key, item: it };
          }
        }
      }
      return null;
    }

    // 2. 依據時間戳記與狀態合併遠端項目
    for (const rIt of (remoteList || [])) {
      if (!rIt || (!rIt.id && !rIt.text)) continue;

      const normalizedRIt = Object.assign({}, rIt, {
        done: !!rIt.done,
        doneAt: rIt.done ? (rIt.doneAt || rIt.updatedAt || Date.now()) : null
      });

      const match = findExistingMatch(normalizedRIt);

      if (!match) {
        // 本機不存在此項目：直接新增
        const newId = normalizedRIt.id || generateId();
        itemMap.set(newId, Object.assign({}, normalizedRIt, { id: newId }));
      } else {
        // 本機已存在此項目：進行智慧狀態融合
        const localIt = match.item;
        const matchKey = match.matchKey;

        // 計算兩端最後動作時間
        const localTime = Math.max(localIt.updatedAt || 0, localIt.doneAt || 0, localIt.createdAt || 0);
        const remoteTime = Math.max(normalizedRIt.updatedAt || 0, normalizedRIt.doneAt || 0, normalizedRIt.createdAt || 0);

        // 1. 判定完成狀態 (done & doneAt)
        let resolvedDone = false;
        let resolvedDoneAt = null;

        if (localIt.done === normalizedRIt.done) {
          // 兩端完成狀態一致
          resolvedDone = !!localIt.done;
          resolvedDoneAt = localIt.done ? (localIt.doneAt || normalizedRIt.doneAt || Math.max(localTime, remoteTime)) : null;
        } else {
          // 兩端完成狀態不一致：比對完成發生的時間與另一端的修改時間
          const doneItem = localIt.done ? localIt : normalizedRIt;
          const undoneItem = localIt.done ? normalizedRIt : localIt;
          const doneActionTime = Math.max(doneItem.doneAt || 0, doneItem.updatedAt || 0);
          const undoneActionTime = Math.max(undoneItem.updatedAt || 0, undoneItem.createdAt || 0);

          if (doneActionTime >= undoneActionTime) {
            // 完成動作發生在未完成的最後異動之後（或同時間）：判定為已完成
            resolvedDone = true;
            resolvedDoneAt = doneItem.doneAt || doneActionTime;
          } else {
            // 未完成一端有明確晚於完成時間的異動（例如使用者重新勾除/反完成）：判定為未完成
            resolvedDone = false;
            resolvedDoneAt = null;
          }
        }

        // 2. 各屬性無損合併（以較新變更為主，但確保欄位不丟失）
        const newerObj = remoteTime >= localTime ? normalizedRIt : localIt;
        const olderObj = remoteTime >= localTime ? localIt : normalizedRIt;

        // 保留有效的工作桌桶子（若一方有明確分類，避免被預設 inbox 沖刷）
        let resolvedBucket = newerObj.bucket || olderObj.bucket || 'inbox';
        if (resolvedBucket === 'inbox' && (olderObj.bucket === 'today' || olderObj.bucket === 'week' || olderObj.bucket === 'keep' || olderObj.bucket === 'release')) {
          if (remoteTime === localTime || !newerObj.updatedAt) {
            resolvedBucket = olderObj.bucket;
          }
        }

        const canonicalId = localIt.id || normalizedRIt.id;

        const mergedItem = Object.assign({}, olderObj, newerObj, {
          id: canonicalId,
          rawId: newerObj.rawId || olderObj.rawId || null,
          done: resolvedDone,
          doneAt: resolvedDoneAt,
          updatedAt: Math.max(localTime, remoteTime, resolvedDoneAt || 0, Date.now()),
          // 象限屬性 (手動指定與自動推估)
          manualQuadrant: (newerObj.manualQuadrant !== undefined) ? newerObj.manualQuadrant : olderObj.manualQuadrant,
          quadrant: newerObj.quadrant || olderObj.quadrant || getComputedQuadrant(newerObj),
          // 時間與尺寸設定 (大小、截止死線)
          size: newerObj.size || olderObj.size || 'small',
          deadline: (newerObj.deadline !== undefined) ? newerObj.deadline : olderObj.deadline,
          // 工作桌桶子、文字、備註
          bucket: resolvedBucket,
          text: (newerObj.text && newerObj.text.trim()) ? newerObj.text : olderObj.text,
          notes: (newerObj.notes !== undefined) ? newerObj.notes : olderObj.notes,
          typeId: newerObj.typeId || olderObj.typeId || null,
          parentId: (newerObj.parentId !== undefined) ? newerObj.parentId : olderObj.parentId
        });

        if (mergedItem.done && mergedItem.isNow) {
          mergedItem.isNow = false;
        }

        // 若 matchKey 與 canonicalId 不同，清除舊 key
        if (matchKey !== canonicalId) {
          itemMap.delete(matchKey);
        }
        itemMap.set(canonicalId, mergedItem);
      }
    }

    const merged = Array.from(itemMap.values());

    // 確保子任務與母任務完成狀態聯動：
    // 若母任務已完成，其所有子任務也一併標記為完成；若所有子任務皆完成，母任務也標記為完成
    const parentMap = new Map();
    for (const it of merged) {
      if (!it.parentId) {
        parentMap.set(it.id, it);
      }
    }
    for (const it of merged) {
      if (it.parentId && parentMap.has(it.parentId)) {
        const parent = parentMap.get(it.parentId);
        if (parent.done && !it.done) {
          it.done = true;
          it.doneAt = parent.doneAt || Date.now();
        }
      }
    }

    // 確保全域最多只有一個 isNow
    let foundNow = false;
    for (const it of merged) {
      if (it.isNow) {
        if (foundNow || it.done) {
          it.isNow = false;
        } else {
          foundNow = true;
        }
      }
    }

    return merged;
  }

  // GitHub Gist API: 上傳本機 (Push)
  async function pushToGist() {
    if (!(await prepareGistAuth())) return;
    const token = syncConfig.githubToken.trim();

    const payload = {
      app: 'Task Desk',
      version: 1,
      syncedAt: Date.now(),
      items: items,
      settings: settings
    };

    const filesBody = {
      'taskdesk-sync.json': {
        content: JSON.stringify(payload, null, 2)
      }
    };

    try {
      showToast(`正在上傳本機 ${items.length} 筆任務至 GitHub Gist…`);

      // 若未指定 Gist ID，先搜尋是否已有現成 Gist，避免重複建立
      if (!syncConfig.gistId || !syncConfig.gistId.trim()) {
        const existingId = await findUserExistingGist(token);
        if (existingId) {
          syncConfig.gistId = existingId;
          saveSyncConfig();
          updateSyncModalStatus();
        }
      }

      let resp;
      if (!syncConfig.gistId || !syncConfig.gistId.trim()) {
        // 首次建立私人 Gist
        resp = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            description: 'Task Desk Personal Synchronization',
            public: false,
            files: filesBody
          })
        });

        if (!resp.ok) {
          if (resp.status === 401) throw new Error('GitHub 認證失敗 (401)：Token 無效或過期，請確認為 Classic Token');
          if (resp.status === 403) throw new Error('權限不足 (403)：請確認 Token 具備 gist 權限');
          throw new Error(`建立 Gist 失敗 (${resp.status})`);
        }
        const data = await resp.json();
        syncConfig.gistId = data.id;
      } else {
        // 更新現有 Gist
        resp = await fetch(`https://api.github.com/gists/${syncConfig.gistId.trim()}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            description: 'Task Desk Personal Synchronization',
            files: filesBody
          })
        });

        if (!resp.ok) {
          if (resp.status === 401) throw new Error('GitHub 認證失敗 (401)：Token 無效或過期');
          if (resp.status === 404) throw new Error(`找不到 Gist (404)：Gist ID (${syncConfig.gistId}) 不存在或無權存取`);
          throw new Error(`更新 Gist 失敗 (${resp.status})`);
        }
      }

      syncConfig.lastSyncTime = Date.now();
      saveSyncConfig();
      updateSyncModalStatus();
      checkRemoteGistStatus(false);
      showToast(`上傳同步成功！已將本機 ${items.length} 筆任務推送到 Gist`);
    } catch (err) {
      console.error(err);
      showToast(err.message || '上傳失敗，請確認網路與 Token');
    }
  }

  // GitHub Gist API: 從雲端拉取 (Pull)
  async function pullFromGist() {
    if (!(await prepareGistAuth())) return;
    const token = syncConfig.githubToken.trim();
    let gistId = syncConfig.gistId ? syncConfig.gistId.trim() : '';

    // 若未填 Gist ID，自動在帳號中尋找現有 Task Desk Gist
    if (!gistId) {
      showToast('正在搜尋您 GitHub 上的備份 Gist…');
      const foundId = await findUserExistingGist(token);
      if (foundId) {
        gistId = foundId;
        syncConfig.gistId = foundId;
        saveSyncConfig();
        updateSyncModalStatus();
        showToast(`已自動連線至現有 Gist (${foundId.substring(0, 8)}…)！正在下載…`);
      } else {
        showToast('找不到現有 Task Desk Gist。若為初次使用，請先點擊「智慧雙向合併」進行初次建立');
        return;
      }
    }

    try {
      showToast('正在從 GitHub Gist 下載…');
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) {
        if (resp.status === 401) throw new Error('GitHub 認證失敗 (401)：Token 無效或已過期');
        if (resp.status === 404) throw new Error(`找不到 Gist (404)：Gist ID (${gistId}) 不存在`);
        throw new Error(`獲取 Gist 失敗 (${resp.status})`);
      }

      const data = await resp.json();
      const fileData = data.files && data.files['taskdesk-sync.json'];
      if (!fileData || !fileData.content) {
        throw new Error('此 Gist 中找不到 taskdesk-sync.json 檔案');
      }

      const remotePayload = JSON.parse(fileData.content);
      if (!remotePayload || !Array.isArray(remotePayload.items)) {
        throw new Error('Gist 中的資料格式不正確');
      }

      // 安全防護：若本地有任務但遠端為 0 筆，防止誤按 Pull 覆蓋清空
      if (items.length > 0 && remotePayload.items.length === 0) {
        const proceed = confirm(`警告：雲端 Gist 目前儲存了 0 筆任務，但您本機有 ${items.length} 筆任務！\n\n若強制「下載」將會覆蓋清空本機任務。\n建議改用「智慧雙向合併」即可將本機任務同步至雲端並保留。\n\n您確定仍要從雲端下載並清空本機嗎？`);
        if (!proceed) {
          showToast('已取消下載，保留本機現有任務');
          return;
        }
      }

      items = (remotePayload.items || []).map(it => Object.assign({}, it, {
        done: !!it.done,
        doneAt: it.done ? (it.doneAt || it.updatedAt || Date.now()) : null
      }));
      if (remotePayload.settings) {
        settings = Object.assign({}, settings, remotePayload.settings);
        saveSettings();
        applyTheme(settings.theme);
        applySafeTop(settings.safeTop);
      }
      saveItems();
      syncConfig.lastSyncTime = Date.now();
      saveSyncConfig();
      renderAll();
      updateSyncModalStatus();
      checkRemoteGistStatus(false);

      if (items.length === 0) {
        showToast('雲端下載成功，但該 Gist 目前內容為 0 筆任務。\n若任務在另一台裝置，請先在該裝置點擊「上傳本機 (Push)」！');
      } else {
        showToast(`雲端下載成功！（共 ${items.length} 筆任務）`);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || '下載失敗，請確認網路與設定');
    }
  }

  // GitHub Gist API: 智慧雙向合併 (Merge)
  async function mergeWithGist() {
    if (!(await prepareGistAuth())) return;
    const token = syncConfig.githubToken.trim();
    let gistId = syncConfig.gistId ? syncConfig.gistId.trim() : '';

    // 若未填 Gist ID，先檢查是否帳號已有現存的 TaskDesk Gist（避免跨裝置各自建出不同 Gist）
    if (!gistId) {
      showToast('正在偵測您 GitHub 上的現有備份…');
      const foundId = await findUserExistingGist(token);
      if (foundId) {
        gistId = foundId;
        syncConfig.gistId = foundId;
        saveSyncConfig();
        updateSyncModalStatus();
        showToast(`已找到現有 Gist (${foundId.substring(0, 8)}…)！正在進行雙向合併…`);
      } else {
        // 帳號中確實無 Gist，進行初次建立上傳
        await pushToGist();
        return;
      }
    }

    try {
      showToast('正在與雲端進行雙向合併…');
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) {
        if (resp.status === 401) throw new Error('GitHub 認證失敗 (401)：Token 無效或過期');
        if (resp.status === 404) throw new Error(`找不到 Gist (404)：Gist ID (${gistId}) 不存在`);
        throw new Error(`讀取遠端 Gist 失敗 (${resp.status})`);
      }

      const data = await resp.json();
      const fileData = data.files && data.files['taskdesk-sync.json'];
      let remoteItems = [];
      let remotePayload = null;
      if (fileData && fileData.content) {
        remotePayload = JSON.parse(fileData.content);
        if (remotePayload && Array.isArray(remotePayload.items)) {
          remoteItems = remotePayload.items;
        }
      }

      // 進行無失真時間戳雙向合併
      items = smartMergeItems(items, remoteItems);
      if (remotePayload && remotePayload.settings) {
        const localSettingsTime = settings.updatedAt || 0;
        const remoteSettingsTime = remotePayload.settings.updatedAt || 0;
        if (remoteSettingsTime >= localSettingsTime) {
          settings = Object.assign({}, settings, remotePayload.settings);
        } else {
          settings = Object.assign({}, remotePayload.settings, settings);
        }
        saveSettings();
        applyTheme(settings.theme);
        applySafeTop(settings.safeTop);
      }
      saveItems();

      // 將合併後的最新資料寫回 Gist
      const payload = {
        app: 'Task Desk',
        version: 1,
        syncedAt: Date.now(),
        items: items,
        settings: settings
      };

      const patchResp = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          description: 'Task Desk Personal Synchronization',
          files: {
            'taskdesk-sync.json': {
              content: JSON.stringify(payload, null, 2)
            }
          }
        })
      });

      if (!patchResp.ok) {
        throw new Error(`回寫雲端失敗 (${patchResp.status})`);
      }

      syncConfig.lastSyncTime = Date.now();
      saveSyncConfig();
      renderAll();
      updateSyncModalStatus();
      checkRemoteGistStatus(false);

      if (items.length === 0) {
        showToast('雙向合併完成，但兩端目前皆無任務（共 0 筆）。\n若任務在另一台裝置，請先在該裝置點擊「上傳本機 (Push)」！');
      } else {
        showToast(`雙向合併完成！保留兩端最新狀態（共 ${items.length} 筆任務）`);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || '合併同步中斷，請檢查網路');
    }
  }

  // 裝置直傳：複製本機同步碼
  function copySyncCode() {
    const payload = {
      app: 'Task Desk',
      version: 1,
      syncedAt: Date.now(),
      items: items,
      settings: settings
    };
    const jsonStr = JSON.stringify(payload);
    // Base64 編碼
    const base64Code = btoa(encodeURIComponent(jsonStr));
    navigator.clipboard.writeText(base64Code).then(() => {
      showToast('已複製同步碼！可在手機 App 點「貼上同步碼」');
    }).catch(() => {
      prompt('請手動複製下列同步碼：', base64Code);
    });
  }

  // 裝置直傳：解析並合併同步碼
  function applySyncCode(base64Str) {
    if (!base64Str || !base64Str.trim()) {
      showToast('請先貼上同步碼');
      return;
    }
    try {
      const decodedJson = decodeURIComponent(atob(base64Str.trim()));
      const data = JSON.parse(decodedJson);
      if (!data || !Array.isArray(data.items)) {
        showToast('同步碼內容無效');
        return;
      }
      items = smartMergeItems(items, data.items);
      if (data.settings) {
        settings = Object.assign({}, settings, data.settings);
        saveSettings();
        applyTheme(settings.theme);
        applySafeTop(settings.safeTop);
      }
      saveItems();
      renderAll();
      showToast(`同步碼合併成功！（目前共 ${items.length} 筆任務）`);
      document.getElementById('syncCodePasteArea').style.display = 'none';
      document.getElementById('syncCodeInput').value = '';
    } catch (e) {
      console.error(e);
      showToast('解析同步碼失敗，請確認格式');
    }
  }

  // --- 事件監聽配置 ---
  function setupEventListeners() {
    // 收集箱尺寸選擇器 (預設為 auto 自動推估，抓不準則自動歸為 5-10m 試水溫)
    let selectedCaptureSize = 'auto';
    let selectedCaptureDeadline = null;

    const sizeSelector = document.getElementById('captureSizeSelector');
    if (sizeSelector) {
      sizeSelector.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sizeSelector.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedCaptureSize = btn.dataset.size || 'auto';
        });
      });
    }

    // 截止死線切換 (僅背景加權，主介面卡片不直接顯示)
    const btnToggleDeadline = document.getElementById('btnToggleCaptureDeadline');
    const inputDeadline = document.getElementById('inputCaptureDeadline');
    const deadlineBadgeText = document.getElementById('captureDeadlineBadgeText');

    if (btnToggleDeadline && inputDeadline) {
      btnToggleDeadline.addEventListener('click', () => {
        const isHidden = inputDeadline.style.display === 'none';
        inputDeadline.style.display = isHidden ? 'inline-block' : 'none';
        if (isHidden) inputDeadline.focus();
      });

      inputDeadline.addEventListener('change', (e) => {
        selectedCaptureDeadline = e.target.value || null;
        if (selectedCaptureDeadline) {
          btnToggleDeadline.classList.add('has-deadline');
          if (deadlineBadgeText) deadlineBadgeText.textContent = selectedCaptureDeadline.substring(5);
        } else {
          btnToggleDeadline.classList.remove('has-deadline');
          if (deadlineBadgeText) deadlineBadgeText.textContent = '死線';
        }
      });
    }

    // 每日習慣標記切換
    const btnToggleRoutine = document.getElementById('btnToggleCaptureRoutine');
    const routineBadgeText = document.getElementById('captureRoutineBadgeText');
    if (btnToggleRoutine) {
      btnToggleRoutine.addEventListener('click', () => {
        isCaptureRoutineActive = !isCaptureRoutineActive;
        if (isCaptureRoutineActive) {
          btnToggleRoutine.classList.add('has-deadline');
          btnToggleRoutine.style.background = 'rgba(99, 102, 241, 0.2)';
          btnToggleRoutine.style.borderColor = 'rgba(99, 102, 241, 0.5)';
          if (routineBadgeText) routineBadgeText.textContent = '每日習慣';
        } else {
          btnToggleRoutine.classList.remove('has-deadline');
          btnToggleRoutine.style.background = '';
          btnToggleRoutine.style.borderColor = '';
          if (routineBadgeText) routineBadgeText.textContent = '習慣';
        }
      });
    }

    // 收集箱批次送出
    const btnCapture = document.getElementById('btnCaptureSubmit');
    const inputCapture = document.getElementById('inputCapture');

    const handleCapture = () => {
      const raw = inputCapture.value;
      if (!raw || !raw.trim()) return;
      const parsed = parseBatchInput(raw);
      if (parsed.length > 0) {
        addItemsToInbox(parsed, selectedCaptureSize, null, selectedCaptureDeadline);
        inputCapture.value = '';
        if (inputDeadline) {
          inputDeadline.value = '';
          inputDeadline.style.display = 'none';
        }
        selectedCaptureDeadline = null;
        if (btnToggleDeadline) btnToggleDeadline.classList.remove('has-deadline');
        if (deadlineBadgeText) deadlineBadgeText.textContent = '死線';

        if (isCaptureRoutineActive) {
          isCaptureRoutineActive = false;
          if (btnToggleRoutine) {
            btnToggleRoutine.classList.remove('has-deadline');
            btnToggleRoutine.style.background = '';
            btnToggleRoutine.style.borderColor = '';
          }
          if (routineBadgeText) routineBadgeText.textContent = '習慣';
          showToast(`已建立每日習慣（共 ${parsed.length} 件）！將於時機契合時自動浮出推薦`);
        } else {
          showToast(`已存入收集箱（共 ${parsed.length} 件）。點擊底座抽屜即可挑選移至工作桌！`);
        }
      }
    };

    btnCapture.addEventListener('click', handleCapture);
    inputCapture.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleCapture();
      }
    });

    // 工作桌頁籤切換 (今日 / 本週)
    const tabToday = document.getElementById('tabWorkbenchToday');
    const tabWeek = document.getElementById('tabWorkbenchWeek');
    if (tabToday) {
      tabToday.addEventListener('click', () => switchWorkbench('today'));
    }
    if (tabWeek) {
      tabWeek.addEventListener('click', () => switchWorkbench('week'));
    }

    // 工作桌抽屜底座 (Desk Drawers Dock)
    const dockBtns = [
      { id: 'dockBtnInbox', drawer: 'inbox' },
      { id: 'dockBtnKeep', drawer: 'keep' },
      { id: 'dockBtnRelease', drawer: 'release' },
      { id: 'dockBtnHistory', drawer: 'history' }
    ];
    dockBtns.forEach(d => {
      const btn = document.getElementById(d.id);
      if (btn) {
        btn.addEventListener('click', () => openDrawer(d.drawer));
      }
    });

    const dockIndicator = document.getElementById('dockIndicator');
    if (dockIndicator) {
      dockIndicator.addEventListener('click', () => openDrawer(currentDrawer || 'inbox'));
    }

    // 抽屜內標籤頁切換
    ['inbox', 'keep', 'release', 'history'].forEach(drawerKey => {
      const tabId = `drawerTab${drawerKey.charAt(0).toUpperCase() + drawerKey.slice(1)}`;
      const tabEl = document.getElementById(tabId);
      if (tabEl) {
        tabEl.addEventListener('click', () => switchDrawerTab(drawerKey));
      }
    });

    // 抽屜關閉 / 推回操作
    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
    const drawerPullBar = document.getElementById('drawerPullBar');
    if (drawerPullBar) drawerPullBar.addEventListener('click', closeDrawer);
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    // 抽屜內歷史檔案匯出按鈕
    const btnDrawerExpMd = document.getElementById('btnDrawerExportMd');
    if (btnDrawerExpMd) btnDrawerExpMd.addEventListener('click', exportHistoryMarkdown);
    const btnDrawerExpJson = document.getElementById('btnDrawerExportJson');
    if (btnDrawerExpJson) btnDrawerExpJson.addEventListener('click', exportHistoryJson);

    // --- 桌上工具選單 (Nav Tools Popover) ---
    function openNavTools() {
      const menu = document.getElementById('navToolsMenu');
      const backdrop = document.getElementById('navToolsBackdrop');
      const toggle = document.getElementById('btnNavToolsToggle');
      if (!menu || !backdrop) return;
      backdrop.style.display = 'block';
      menu.style.display = 'flex';
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }

    function closeNavTools() {
      const menu = document.getElementById('navToolsMenu');
      const backdrop = document.getElementById('navToolsBackdrop');
      const toggle = document.getElementById('btnNavToolsToggle');
      if (!menu || !backdrop) return;
      backdrop.style.display = 'none';
      menu.style.display = 'none';
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    const btnNavToolsToggle = document.getElementById('btnNavToolsToggle');
    if (btnNavToolsToggle) {
      btnNavToolsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('navToolsMenu');
        if (menu && menu.style.display !== 'none') {
          closeNavTools();
        } else {
          openNavTools();
        }
      });
    }

    const btnCloseNavTools = document.getElementById('btnCloseNavTools');
    if (btnCloseNavTools) {
      ['click', 'touchend'].forEach(evt => {
        btnCloseNavTools.addEventListener(evt, (e) => {
          e.stopPropagation();
          e.preventDefault();
          closeNavTools();
        });
      });
    }

    const btnDismissNavTools = document.getElementById('btnDismissNavTools');
    if (btnDismissNavTools) {
      ['click', 'touchend'].forEach(evt => {
        btnDismissNavTools.addEventListener(evt, (e) => {
          e.stopPropagation();
          e.preventDefault();
          closeNavTools();
        });
      });
    }

    const navToolsBackdrop = document.getElementById('navToolsBackdrop');
    if (navToolsBackdrop) {
      ['click', 'touchend', 'pointerdown'].forEach(evt => {
        navToolsBackdrop.addEventListener(evt, (e) => {
          e.stopPropagation();
          e.preventDefault();
          closeNavTools();
        });
      });
    }

    // 點擊選單外部區域隨時關閉防呆
    document.addEventListener('pointerdown', (e) => {
      const menu = document.getElementById('navToolsMenu');
      const toggle = document.getElementById('btnNavToolsToggle');
      if (!menu || menu.style.display === 'none') return;
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        closeNavTools();
      }
    });

    // 鍵盤 ESC 鍵關閉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('navToolsMenu');
        if (menu && menu.style.display !== 'none') {
          closeNavTools();
        }
      }
    });

    // 工具選單項目事件
    const mItemAnalytics = document.getElementById('menuItemAnalytics');
    if (mItemAnalytics) {
      mItemAnalytics.addEventListener('click', () => {
        closeNavTools();
        openAnalyticsModal();
      });
    }

    safeOn('btnCloseAnalytics', 'click', closeAnalyticsModal);
    safeOn('btnCloseAnalyticsFooter', 'click', closeAnalyticsModal);

    const timeFilter = document.getElementById('analyticsTimeFilter');
    if (timeFilter) {
      timeFilter.querySelectorAll('.analytics-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setAnalyticsTimeRange(btn.dataset.range);
        });
      });
    }

    document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchAnalyticsTab(btn.dataset.tab);
      });
    });

    safeOn('btnExportSessionsCsv', 'click', exportFocusSessionsCsv);
    safeOn('btnExportSessionsJson', 'click', exportFocusSessionsJson);
    safeOn('btnClearSessions', 'click', clearAllFocusSessions);

    const mItemMatrix = document.getElementById('menuItemMatrix');
    if (mItemMatrix) {
      mItemMatrix.addEventListener('click', () => {
        closeNavTools();
        openMatrixModal();
      });
    }

    const mItemStatus = document.getElementById('menuItemStatusConsult');
    if (mItemStatus) {
      mItemStatus.addEventListener('click', () => {
        closeNavTools();
        openConsultModal();
      });
    }

    const mItemSync = document.getElementById('menuItemSync');
    if (mItemSync) {
      mItemSync.addEventListener('click', () => {
        closeNavTools();
        updateSyncModalStatus();
        document.getElementById('modalSync').style.display = 'flex';
        checkRemoteGistStatus(false);
      });
    }

    const mItemImport = document.getElementById('menuItemImport');
    if (mItemImport) {
      mItemImport.addEventListener('click', () => {
        closeNavTools();
        document.getElementById('modalImport').style.display = 'flex';
        if (activeImportTab === 'text' && importTextArea) {
          setTimeout(() => importTextArea.focus(), 80);
        }
      });
    }

    const mItemHistory = document.getElementById('menuItemHistory');
    if (mItemHistory) {
      mItemHistory.addEventListener('click', () => {
        closeNavTools();
        openDrawer('history');
      });
    }

    const mItemSettings = document.getElementById('menuItemSettings');
    if (mItemSettings) {
      mItemSettings.addEventListener('click', () => {
        closeNavTools();
        openSettingsModal();
      });
    }

    const mItemRoutines = document.getElementById('menuItemRoutines');
    if (mItemRoutines) {
      mItemRoutines.addEventListener('click', () => {
        closeNavTools();
        openRoutinesModal();
      });
    }

    const btnOpenSyncFromSettings = document.getElementById('btnOpenSyncFromSettings');
    if (btnOpenSyncFromSettings) {
      btnOpenSyncFromSettings.addEventListener('click', () => {
        const modalSettings = document.getElementById('modalSettings');
        if (modalSettings) modalSettings.style.display = 'none';
        updateSyncModalStatus();
        const modalSync = document.getElementById('modalSync');
        if (modalSync) modalSync.style.display = 'flex';
        checkRemoteGistStatus(false);
      });
    }

    // 常駐環境推薦條 (Ambient Suggestion Bar)
    const btnAmbientAccept = document.getElementById('btnAmbientAccept');
    if (btnAmbientAccept) btnAmbientAccept.addEventListener('click', handleAmbientAccept);

    const btnAmbientNext = document.getElementById('btnAmbientNext');
    if (btnAmbientNext) btnAmbientNext.addEventListener('click', handleAmbientNext);

    const btnAmbientDismiss = document.getElementById('btnAmbientDismiss');
    if (btnAmbientDismiss) btnAmbientDismiss.addEventListener('click', handleAmbientDismiss);

    const ambientStatePill = document.getElementById('ambientStatePill');
    if (ambientStatePill) {
      ambientStatePill.addEventListener('click', () => {
        showPostTaskCheckin(null, false);
      });
    }

    // 任務後 / 開工身心二維狀態速評 (Post-Task Check-in)
    const btnClosePostTaskCheckin = document.getElementById('btnClosePostTaskCheckin');
    if (btnClosePostTaskCheckin) {
      btnClosePostTaskCheckin.addEventListener('click', closePostTaskCheckin);
    }

    const stateCards = document.querySelectorAll('.state-choice-card');
    stateCards.forEach(btn => {
      btn.addEventListener('click', () => {
        const energy = btn.dataset.energy;
        const flow = btn.dataset.flow;
        if (energy && flow) {
          setUserState(energy, flow);
        }
      });
    });

    // 每日習慣管理 (Routines Modal)
    const btnCloseRoutines = document.getElementById('btnCloseRoutines');
    if (btnCloseRoutines) btnCloseRoutines.addEventListener('click', closeRoutinesModal);

    const btnDismissRoutines = document.getElementById('btnDismissRoutines');
    if (btnDismissRoutines) btnDismissRoutines.addEventListener('click', closeRoutinesModal);

    const btnAddRoutine = document.getElementById('btnAddRoutine');
    const inputNewRoutineText = document.getElementById('inputNewRoutineText');
    const selectRoutineTrigger = document.getElementById('selectRoutineTrigger');

    if (btnAddRoutine && inputNewRoutineText) {
      const handleAddRoutine = () => {
        const text = inputNewRoutineText.value;
        const trigger = selectRoutineTrigger ? selectRoutineTrigger.value : 'recharge';
        if (text && text.trim()) {
          addRoutine(text, trigger);
          inputNewRoutineText.value = '';
        }
      };
      btnAddRoutine.addEventListener('click', handleAddRoutine);
      inputNewRoutineText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddRoutine();
      });
    }

    const mItemLock = document.getElementById('menuItemLock');
    if (mItemLock) {
      mItemLock.addEventListener('click', () => {
        closeNavTools();
        lockApp();
      });
    }

    const mItemDownloadApk = document.getElementById('menuItemDownloadApk');
    if (mItemDownloadApk) {
      mItemDownloadApk.addEventListener('click', () => {
        closeNavTools();
      });
    }

    // Header 按鈕：幫我選 (客觀直接自動決定並指派「現在做這個」)
    const btnOpenConsult = document.getElementById('btnOpenConsult');
    if (btnOpenConsult) {
      btnOpenConsult.addEventListener('click', runAutoDecideTask);
    }

    // Header 按鈕：狀態諮詢 (手動依 5 個問題評估條件推薦)
    const btnOpenStatusConsult = document.getElementById('btnOpenStatusConsult');
    if (btnOpenStatusConsult) {
      btnOpenStatusConsult.addEventListener('click', openConsultModal);
    }

    // Auto-Decide 結果視窗事件
    const btnCloseAutoDecide = document.getElementById('btnCloseAutoDecide');
    if (btnCloseAutoDecide) {
      btnCloseAutoDecide.addEventListener('click', () => {
        document.getElementById('modalAutoDecide').style.display = 'none';
        autoDecidePreviewItemId = null;
      });
    }

    const btnAutoDecideAccept = document.getElementById('btnAutoDecideAccept');
    if (btnAutoDecideAccept) {
      btnAutoDecideAccept.addEventListener('click', () => {
        document.getElementById('modalAutoDecide').style.display = 'none';
        if (autoDecidePreviewItemId) {
          setAsNow(autoDecidePreviewItemId);
          autoDecidePreviewItemId = null;
          showToast('已採用推薦，聚焦現在任務！');
        }
      });
    }

    const btnAutoDecideNext = document.getElementById('btnAutoDecideNext');
    if (btnAutoDecideNext) {
      btnAutoDecideNext.addEventListener('click', () => {
        applyAutoDecideCandidate(autoDecideCurrentIndex + 1);
      });
    }

    const btnAutoDecideManual = document.getElementById('btnAutoDecideManual');
    if (btnAutoDecideManual) {
      btnAutoDecideManual.addEventListener('click', () => {
        document.getElementById('modalAutoDecide').style.display = 'none';
        openConsultModal();
      });
    }

    // Header 按鈕：四象限矩陣總覽
    const btnOpenMatrix = document.getElementById('btnOpenMatrix');
    if (btnOpenMatrix) {
      btnOpenMatrix.addEventListener('click', openMatrixModal);
    }
    const btnCloseMatrix = document.getElementById('btnCloseMatrix');
    if (btnCloseMatrix) {
      btnCloseMatrix.addEventListener('click', () => {
        document.getElementById('modalMatrix').style.display = 'none';
      });
    }
    const btnCloseMatrixFooter = document.getElementById('btnCloseMatrixFooter');
    if (btnCloseMatrixFooter) {
      btnCloseMatrixFooter.addEventListener('click', () => {
        document.getElementById('modalMatrix').style.display = 'none';
      });
    }

    // 矩陣範圍篩選頁籤
    const matrixFilterChips = document.getElementById('matrixFilterChips');
    if (matrixFilterChips) {
      matrixFilterChips.querySelectorAll('.matrix-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          matrixFilterChips.querySelectorAll('.matrix-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeMatrixScope = btn.dataset.scope || 'active';
          renderMatrixModal();
        });
      });
    }

    // 狀態諮詢手動視窗關閉按鈕
    document.getElementById('btnCloseConsult').addEventListener('click', () => {
      document.getElementById('modalConsult').style.display = 'none';
    });

    // 狀態諮詢 Chip 選擇器事件
    document.querySelectorAll('.consult-chips').forEach(chipGroup => {
      const groupName = chipGroup.dataset.group;
      chipGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.consult-chip');
        if (!btn) return;

        chipGroup.querySelectorAll('.consult-chip').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');

        const val = btn.dataset.value;
        if (groupName === 'place') consultState.selectedPlace = val;
        if (groupName === 'body') consultState.selectedBody = val;
        if (groupName === 'mind') consultState.selectedMind = val;
        if (groupName === 'time') consultState.selectedTime = val;
        if (groupName === 'later') consultState.selectedLater = val;
      });
    });

    document.getElementById('btnRunConsult').addEventListener('click', executeConsultation);

    // Header 按鈕：完成紀錄 (開啟歷史檔案抽屜)
    const btnOpenHist = document.getElementById('btnOpenHistory');
    if (btnOpenHist) {
      btnOpenHist.addEventListener('click', () => {
        openDrawer('history');
      });
    }
    document.getElementById('btnCloseHistory').addEventListener('click', () => {
      document.getElementById('modalHistory').style.display = 'none';
    });
    document.getElementById('btnCloseHistoryFooter').addEventListener('click', () => {
      document.getElementById('modalHistory').style.display = 'none';
    });

    // Header 按鈕：任務匯入
    const tabImportFile = document.getElementById('tabImportFile');
    const tabImportText = document.getElementById('tabImportText');
    const viewImportFile = document.getElementById('viewImportFile');
    const viewImportText = document.getElementById('viewImportText');
    const importDropzone = document.getElementById('importDropzone');
    const inputGoogleTaskFile = document.getElementById('inputGoogleTaskFile');
    const googleTasksParsedContainer = document.getElementById('googleTasksParsedContainer');
    const googleTaskListsContainer = document.getElementById('googleTaskListsContainer');
    const importFileName = document.getElementById('importFileName');
    const importFileOnlyUncompleted = document.getElementById('importFileOnlyUncompleted');
    const importFileTotalSelectedCount = document.getElementById('importFileTotalSelectedCount');
    const btnSelectAllLists = document.getElementById('btnSelectAllLists');
    const btnDeselectAllLists = document.getElementById('btnDeselectAllLists');
    const importTextArea = document.getElementById('importTextArea');
    const importNotice = document.getElementById('importParsedCountNotice');

    let currentParsedGoogleLists = null;
    let activeImportTab = 'file';

    // 頁籤切換
    function switchImportTab(tab) {
      activeImportTab = tab;
      if (tab === 'file') {
        tabImportFile.classList.add('active');
        tabImportText.classList.remove('active');
        viewImportFile.style.display = 'flex';
        viewImportText.style.display = 'none';
      } else {
        tabImportText.classList.add('active');
        tabImportFile.classList.remove('active');
        viewImportText.style.display = 'flex';
        viewImportFile.style.display = 'none';
        if (importTextArea) setTimeout(() => importTextArea.focus(), 80);
      }
    }

    if (tabImportFile) tabImportFile.addEventListener('click', () => switchImportTab('file'));
    if (tabImportText) tabImportText.addEventListener('click', () => switchImportTab('text'));

    // Google Tasks JSON / .Tasks 結構解析器
    function parseGoogleTasksStructure(rawContent) {
      let data;
      try {
        data = JSON.parse(rawContent);
      } catch (e) {
        return null;
      }
      if (!data || typeof data !== 'object') return null;

      let rawLists = [];
      if (Array.isArray(data)) {
        rawLists = [{ id: 'list_root', title: '匯入清單', items: data }];
      } else if (data.kind === 'tasks#taskLists' || Array.isArray(data.items)) {
        if (Array.isArray(data.items) && data.items.length > 0 && !data.items[0].items && (data.items[0].title || data.items[0].status)) {
          rawLists = [{ id: data.id || 'list_root', title: data.title || '主要清單', items: data.items }];
        } else {
          rawLists = Array.isArray(data.items) ? data.items : [];
        }
      } else {
        return null;
      }

      const lists = [];
      rawLists.forEach((lst, idx) => {
        if (!lst || typeof lst !== 'object') return;
        const listTitle = lst.title || `清單 ${idx + 1}`;
        const rawItems = Array.isArray(lst.items) ? lst.items : [];
        const uncompletedTasks = [];
        const completedTasks = [];

        function pushTaskItem(item, itemIdx, overrideParentId = null) {
          if (!item || typeof item !== 'object') return;
          const title = (item.title || item.text || item.summary || '').trim();
          if (!title) return;
          const isDone = (item.status === 'completed' || item.done === true);
          let deadline = null;
          if (item.due && typeof item.due === 'string') {
            const datePart = item.due.substring(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
              deadline = datePart;
            }
          }
          const noteText = (item.notes && typeof item.notes === 'string') ? item.notes.trim() : '';
          if (!deadline && noteText) {
            const m = noteText.match(/#deadline:(\d{4}-\d{2}-\d{2})/i) || noteText.match(/#(\d{4}-\d{2}-\d{2})/);
            if (m) deadline = m[1];
          }

          let doneAt = null;
          if (isDone) {
            if (item.completed) doneAt = new Date(item.completed).getTime();
            else if (item.doneAt) doneAt = Number(item.doneAt);
            else doneAt = Date.now();
          }

          const parentRawId = overrideParentId || item.parent || item.parentId || null;

          const taskObj = {
            id: item.id ? `gt_${item.id}` : `gt_${idx}_${itemIdx}`,
            rawId: item.id || null,
            parentRawId: parentRawId,
            text: title,
            notes: noteText,
            done: isDone,
            doneAt: doneAt,
            deadline: deadline,
            listTitle: listTitle,
            updatedAt: item.updated ? new Date(item.updated).getTime() : Date.now(),
            starred: !!item.starred
          };

          if (isDone) {
            completedTasks.push(taskObj);
          } else {
            uncompletedTasks.push(taskObj);
          }

          // 支援巢狀子任務結構 (若檔案包含 items / subtasks 陣列)
          if (Array.isArray(item.items) || Array.isArray(item.subtasks)) {
            const nested = item.items || item.subtasks;
            nested.forEach((subIt, subIdx) => {
              pushTaskItem(subIt, `${itemIdx}_sub_${subIdx}`, item.id || taskObj.id);
            });
          }
        }

        rawItems.forEach((item, itemIdx) => {
          pushTaskItem(item, itemIdx);
        });

        lists.push({
          id: lst.id || `list_${idx}`,
          title: listTitle,
          totalCount: uncompletedTasks.length + completedTasks.length,
          uncompletedCount: uncompletedTasks.length,
          completedCount: completedTasks.length,
          uncompletedTasks: uncompletedTasks,
          completedTasks: completedTasks,
          allTasks: uncompletedTasks.concat(completedTasks),
          selected: uncompletedTasks.length > 0 && uncompletedTasks.length <= 500
        });
      });
      return lists;
    }

    function renderGoogleTasksPreview() {
      if (!currentParsedGoogleLists || !googleTaskListsContainer) return;
      googleTaskListsContainer.innerHTML = '';

      const onlyUncompleted = importFileOnlyUncompleted ? importFileOnlyUncompleted.checked : true;
      let totalSelectedTasks = 0;

      currentParsedGoogleLists.forEach((lst, idx) => {
        const count = onlyUncompleted ? lst.uncompletedCount : lst.totalCount;
        if (lst.selected) {
          totalSelectedTasks += count;
        }

        const card = document.createElement('div');
        card.className = 'google-list-card';

        const headerRow = document.createElement('div');
        headerRow.className = 'google-list-header';

        const titleWrap = document.createElement('label');
        titleWrap.className = 'google-list-title-wrap';
        titleWrap.style.cursor = 'pointer';

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = !!lst.selected;
        check.addEventListener('change', (e) => {
          lst.selected = e.target.checked;
          renderGoogleTasksPreview();
        });

        const nameSpan = document.createElement('span');
        nameSpan.style.fontSize = '0.86rem';
        nameSpan.style.fontWeight = '600';
        nameSpan.style.color = 'var(--text-color)';
        nameSpan.textContent = lst.title;

        titleWrap.appendChild(check);
        titleWrap.appendChild(nameSpan);

        const badgeWrap = document.createElement('div');
        badgeWrap.style.display = 'flex';
        badgeWrap.style.alignItems = 'center';
        badgeWrap.gap = '8px';

        const badge = document.createElement('span');
        badge.className = 'folder-badge';
        badge.style.fontFamily = 'var(--font-mono)';
        badge.style.fontSize = '0.74rem';
        badge.style.color = lst.uncompletedCount > 0 ? 'var(--accent-primary)' : 'var(--meta-text)';
        badge.textContent = onlyUncompleted
          ? `${lst.uncompletedCount} 件待辦`
          : `${lst.uncompletedCount} 待辦 / ${lst.completedCount} 完成`;

        const togglePreviewBtn = document.createElement('button');
        togglePreviewBtn.type = 'button';
        togglePreviewBtn.className = 'btn-secondary';
        togglePreviewBtn.style.padding = '2px 6px';
        togglePreviewBtn.style.fontSize = '0.7rem';
        togglePreviewBtn.textContent = '預覽';

        badgeWrap.appendChild(badge);
        badgeWrap.appendChild(togglePreviewBtn);

        headerRow.appendChild(titleWrap);
        headerRow.appendChild(badgeWrap);
        card.appendChild(headerRow);

        // 預覽任務列表 (預設收合)
        const previewBox = document.createElement('div');
        previewBox.className = 'google-list-tasks-preview';
        previewBox.style.display = 'none';
        const displayTasks = onlyUncompleted ? lst.uncompletedTasks : lst.allTasks;
        if (displayTasks.length === 0) {
          previewBox.textContent = '此清單無符合條件的任務。';
        } else {
          previewBox.textContent = displayTasks.slice(0, 30).map((t, i) => {
            const statusTag = t.done ? '[已完成] ' : '';
            const dlTag = t.deadline ? ` #${t.deadline}` : '';
            const subPrefix = t.parentRawId ? '  └ [子任務] ' : '';
            return `${subPrefix || `${i + 1}. `}${statusTag}${t.text}${dlTag}`;
          }).join('\n') + (displayTasks.length > 30 ? `\n... 等共 ${displayTasks.length} 件` : '');
        }
        card.appendChild(previewBox);

        togglePreviewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = previewBox.style.display === 'none';
          previewBox.style.display = isHidden ? 'block' : 'none';
          togglePreviewBtn.textContent = isHidden ? '收合' : '預覽';
        });

        googleTaskListsContainer.appendChild(card);
      });

      if (importFileTotalSelectedCount) {
        importFileTotalSelectedCount.textContent = `共選取 ${totalSelectedTasks} 件`;
      }
    }

    function handleGoogleFileLoad(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lists = parseGoogleTasksStructure(text);
        if (lists && lists.length > 0) {
          currentParsedGoogleLists = lists;
          if (importFileName) importFileName.textContent = file.name;
          if (googleTasksParsedContainer) googleTasksParsedContainer.style.display = 'flex';
          renderGoogleTasksPreview();
          showToast(`已成功讀取 Google Tasks 檔案，共 ${lists.length} 個清單`);
        } else {
          // 若非 Google Tasks 多清單 JSON，直接填入純文字模式
          switchImportTab('text');
          importTextArea.value = text;
          updateImportCountPreview();
          showToast(`已載入純文字檔案「${file.name}」`);
        }
      };
      reader.readAsText(file);
    }

    // 點擊與拖放上傳
    if (importDropzone && inputGoogleTaskFile) {
      importDropzone.addEventListener('click', () => {
        inputGoogleTaskFile.click();
      });
      inputGoogleTaskFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleGoogleFileLoad(e.target.files[0]);
          inputGoogleTaskFile.value = '';
        }
      });

      importDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        importDropzone.classList.add('dragover');
      });
      importDropzone.addEventListener('dragleave', () => {
        importDropzone.classList.remove('dragover');
      });
      importDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        importDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleGoogleFileLoad(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnSelectAllLists) {
      btnSelectAllLists.addEventListener('click', () => {
        if (currentParsedGoogleLists) {
          currentParsedGoogleLists.forEach(l => l.selected = true);
          renderGoogleTasksPreview();
        }
      });
    }

    if (btnDeselectAllLists) {
      btnDeselectAllLists.addEventListener('click', () => {
        if (currentParsedGoogleLists) {
          currentParsedGoogleLists.forEach(l => l.selected = false);
          renderGoogleTasksPreview();
        }
      });
    }

    if (importFileOnlyUncompleted) {
      importFileOnlyUncompleted.addEventListener('change', () => {
        renderGoogleTasksPreview();
      });
    }

    function updateImportCountPreview() {
      const text = importTextArea ? importTextArea.value : '';
      if (!text.trim()) {
        if (importNotice) importNotice.textContent = '';
        return;
      }
      const parsed = parseBatchInput(text, true);
      const subtaskCount = parsed.filter(p => p.isSubtask).length;
      const parentCount = parsed.length - subtaskCount;
      if (importNotice) {
        if (subtaskCount > 0) {
          importNotice.textContent = `偵測到 ${parentCount} 件主要任務，包含 ${subtaskCount} 件縮排子步驟`;
        } else {
          importNotice.textContent = `偵測到 ${parsed.length} 件任務`;
        }
      }
    }

    if (importTextArea) {
      importTextArea.addEventListener('input', updateImportCountPreview);
    }

    function safeOn(id, event, handler) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
      return el;
    }

    safeOn('btnOpenImport', 'click', () => {
      const modal = document.getElementById('modalImport');
      if (modal) modal.style.display = 'flex';
      if (activeImportTab === 'text' && importTextArea) {
        setTimeout(() => importTextArea.focus(), 80);
      }
    });
    safeOn('btnCloseImport', 'click', () => {
      const modal = document.getElementById('modalImport');
      if (modal) modal.style.display = 'none';
    });
    safeOn('btnCancelImport', 'click', () => {
      const modal = document.getElementById('modalImport');
      if (modal) modal.style.display = 'none';
    });

    // 智慧 Google Tasks 結構化匯入（保留完成狀態、所屬工作桌、子任務層級與屬性）
    function importStructuredGoogleTasks(tasksToImport) {
      if (!tasksToImport || tasksToImport.length === 0) return { added: 0, updated: 0 };

      let updatedCount = 0;
      let addedCount = 0;

      // 建立原始 ID 對應至系統項目 ID 之對照表
      const idMap = new Map();
      const parentTasks = [];
      const subTasks = [];

      tasksToImport.forEach(task => {
        if (task.parentRawId) {
          subTasks.push(task);
        } else {
          parentTasks.push(task);
        }
      });

      // 內部執行單項任務匯入
      function processSingleTask(task, resolvedParentId = null) {
        // 判定目標分類
        let targetBucket = 'inbox';
        const lt = (task.listTitle || '').toLowerCase();
        if (lt.includes('今日') || lt.includes('今天') || lt.includes('today')) {
          targetBucket = 'today';
        } else if (lt.includes('這週') || lt.includes('本週') || lt.includes('week')) {
          targetBucket = 'week';
        } else if (lt.includes('保溫') || lt.includes('keep')) {
          targetBucket = 'keep';
        } else if (lt.includes('放生') || lt.includes('release')) {
          targetBucket = 'release';
        }

        // 若為子任務且母任務有特定工作桌，繼承母任務之 bucket
        if (resolvedParentId) {
          const parentItem = items.find(it => it.id === resolvedParentId);
          if (parentItem) {
            targetBucket = parentItem.bucket;
          }
        }

        // 檢查是否已存在相同的任務（以 ID 或文字匹配）
        let existing = null;
        if (task.id) existing = items.find(it => it.id === task.id);
        if (!existing && task.rawId) {
          existing = items.find(it => it.rawId === task.rawId || it.id === `gt_${task.rawId}`);
        }
        if (!existing) {
          if (resolvedParentId) {
            // 子任務比對相同 parentId 下同名者
            existing = items.find(it => it.parentId === resolvedParentId && it.text && it.text.trim() === task.text.trim());
          } else {
            // 母任務比對同標題且非子任務
            existing = items.find(it => it.text && it.text.trim() === task.text.trim() && !it.parentId);
          }
        }

        let currentItemId = null;
        if (existing) {
          existing.done = !!task.done;
          existing.doneAt = task.done ? (task.doneAt || Date.now()) : null;
          if (task.deadline) existing.deadline = task.deadline;
          if (task.notes && !existing.notes) existing.notes = task.notes;
          if (resolvedParentId) existing.parentId = resolvedParentId;
          existing.quadrant = getComputedQuadrant(existing);
          existing.updatedAt = Math.max(existing.updatedAt || 0, task.updatedAt || Date.now());
          currentItemId = existing.id;
          updatedCount++;
        } else {
          const keywordType = guessTypeByKeywords(task.text);
          const itemSize = resolvedParentId ? 'micro' : guessSize(task.text, keywordType);
          const newItem = {
            id: task.id || generateId(),
            rawId: task.rawId || null,
            text: task.text,
            notes: task.notes || '',
            size: itemSize,
            bucket: targetBucket,
            isNow: false,
            done: !!task.done,
            doneAt: task.done ? (task.doneAt || Date.now()) : null,
            createdAt: task.updatedAt || Date.now(),
            updatedAt: task.updatedAt || Date.now(),
            typeId: keywordType,
            typeSource: keywordType ? 'rule' : 'ai',
            parentId: resolvedParentId,
            aiGenerated: false,
            deadline: task.deadline || null,
            manualQuadrant: null
          };
          newItem.quadrant = getComputedQuadrant(newItem);
          items.push(newItem);
          currentItemId = newItem.id;
          addedCount++;
        }

        // 登記到 idMap 便於子任務關聯
        if (task.rawId) idMap.set(task.rawId, currentItemId);
        if (task.id) idMap.set(task.id, currentItemId);
        return currentItemId;
      }

      // 第一階段：先建立或更新所有母任務
      parentTasks.forEach(t => processSingleTask(t, null));

      // 第二階段：關聯並建立子任務
      subTasks.forEach(t => {
        let parentId = null;
        if (t.parentRawId) {
          parentId = idMap.get(t.parentRawId) ||
                     idMap.get(`gt_${t.parentRawId}`) ||
                     items.find(it => it.rawId === t.parentRawId || it.id === `gt_${t.parentRawId}` || it.id === t.parentRawId)?.id || null;
        }
        processSingleTask(t, parentId);
      });

      // 第三階段：確保母任務與子任務完成狀態一致
      for (const it of items) {
        if (!it.parentId) {
          const subs = getSubtasks(it.id);
          if (subs.length > 0 && subs.every(s => s.done) && !it.done) {
            it.done = true;
            it.doneAt = Date.now();
          }
        }
      }

      saveItems();
      renderAll();
      return { added: addedCount, updated: updatedCount };
    }

    safeOn('btnDoImport', 'click', () => {
      if (activeImportTab === 'file' && currentParsedGoogleLists) {
        const onlyUncompleted = importFileOnlyUncompleted ? importFileOnlyUncompleted.checked : true;
        const selectedTasks = [];
        currentParsedGoogleLists.forEach(lst => {
          if (lst.selected) {
            const listItems = onlyUncompleted ? lst.uncompletedTasks : lst.allTasks;
            selectedTasks.push(...listItems);
          }
        });

        if (selectedTasks.length > 0) {
          const res = importStructuredGoogleTasks(selectedTasks);
          showToast(`已成功匯入 ${res.added} 件新任務，同步更新 ${res.updated} 件狀態！`);
          const modal = document.getElementById('modalImport');
          if (modal) modal.style.display = 'none';
        } else {
          showToast('請至少勾選一個具有任務的清單');
        }
      } else {
        const text = importTextArea ? importTextArea.value : '';
        const lines = parseBatchInput(text, true);
        if (lines.length > 0) {
          addItemsToInbox(lines);
          const subCount = lines.filter(l => l.isSubtask).length;
          const parentCount = lines.length - subCount;
          if (subCount > 0) {
            showToast(`已匯入 ${parentCount} 件主要任務，包含 ${subCount} 件子步驟`);
          } else {
            showToast(`已匯入 ${lines.length} 件項目至收集箱`);
          }
          const modal = document.getElementById('modalImport');
          if (modal) modal.style.display = 'none';
        } else {
          showToast('請輸入文字或選擇 Google Tasks 檔案');
        }
      }
    });

    // 設定 Modal 操作函式
    function openSettingsModal() {
      const modalSettings = document.getElementById('modalSettings');
      if (!modalSettings) return;

      const inputTodaySmall = document.getElementById('settingTodaySmallLimit');
      if (inputTodaySmall) inputTodaySmall.value = settings.todaySmallLimit || 3;
      const inputWeekMedLarge = document.getElementById('settingWeekMediumLargeLimit');
      if (inputWeekMedLarge) inputWeekMedLarge.value = settings.weekMediumLargeLimit || 3;

      const settingThemeEl = document.getElementById('settingTheme');
      if (settingThemeEl) settingThemeEl.value = settings.theme;
      const safeTopVal = settings.safeTop || 56;
      const inputSafeTop = document.getElementById('settingSafeTop');
      const valSafeTopText = document.getElementById('settingSafeTopVal');
      if (inputSafeTop) inputSafeTop.value = safeTopVal;
      if (valSafeTopText) valSafeTopText.textContent = `${safeTopVal}px`;

      const settingIncludeKeepEl = document.getElementById('settingIncludeKeep');
      if (settingIncludeKeepEl) settingIncludeKeepEl.checked = settings.includeKeepInConsult;

      const settingFocusLockEl = document.getElementById('settingFocusLock');
      if (settingFocusLockEl) settingFocusLockEl.checked = settings.focusLockEnabled !== false;

      const settingKairosEl = document.getElementById('settingKairosEnabled');
      if (settingKairosEl) settingKairosEl.checked = !!settings.kairosEnabled;

      const kairosConfigGroup = document.getElementById('kairosConfigGroup');
      if (kairosConfigGroup) kairosConfigGroup.style.display = settings.kairosEnabled ? 'block' : 'none';

      const settingKairosUrlEl = document.getElementById('settingKairosUrl');
      if (settingKairosUrlEl) settingKairosUrlEl.value = settings.kairosUrl || 'http://127.0.0.1:5050';

      const kairosConnStatus = document.getElementById('kairosConnStatusText');
      if (kairosConnStatus) kairosConnStatus.textContent = '';

      const settingPinLockEl = document.getElementById('settingPinLock');
      if (settingPinLockEl) settingPinLockEl.checked = !!settings.pinLock;
      const pinGroup = document.getElementById('pinInputGroup');
      if (pinGroup) pinGroup.style.display = settings.pinLock ? 'block' : 'none';
      const pinPassEl = document.getElementById('settingPinPass');
      if (pinPassEl) pinPassEl.value = '';

      // 更新 Android 守護狀態
      const androidStatusText = document.getElementById('androidGuardianStatusText');
      const androidStatusSub = document.getElementById('androidGuardianStatusSub');
      const btnOpenAccessibility = document.getElementById('btnOpenAndroidAccessibility');
      const androidBadge = document.getElementById('androidGuardianBadge');

      if (window.AndroidWidgetBridge && typeof window.AndroidWidgetBridge.isAccessibilityGranted === 'function') {
        const granted = window.AndroidWidgetBridge.isAccessibilityGranted();
        if (granted) {
          if (androidStatusText) androidStatusText.textContent = '守護中 (無障礙服務已啟用)';
          if (androidStatusSub) androidStatusSub.textContent = '專注時將自動攔截 YouTube、IG、TikTok 等分心 App';
          if (androidBadge) {
            androidBadge.textContent = '守護運作中';
            androidBadge.style.color = 'var(--accent-teal)';
            androidBadge.style.borderColor = 'rgba(45, 212, 191, 0.4)';
          }
          if (btnOpenAccessibility) {
            btnOpenAccessibility.style.display = 'inline-block';
            btnOpenAccessibility.textContent = '重新檢查';
          }
        } else {
          if (androidStatusText) androidStatusText.textContent = '尚未授權無障礙服務';
          if (androidStatusSub) androidStatusSub.textContent = '點擊前往手機設定開啟 TaskDesk 專注守護者權限';
          if (androidBadge) {
            androidBadge.textContent = '待授權';
            androidBadge.style.color = '#f59e0b';
            androidBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          }
          if (btnOpenAccessibility) {
            btnOpenAccessibility.style.display = 'inline-block';
            btnOpenAccessibility.textContent = '前往設定授權';
          }
        }
      } else {
        if (androidStatusText) androidStatusText.textContent = '未偵測到原生 Android 環境';
        if (androidStatusSub) androidStatusSub.textContent = '安裝下方 Android APK 即可享有系統級跨 App 鎖定守護';
        if (btnOpenAccessibility) btnOpenAccessibility.style.display = 'none';
      }

      modalSettings.style.display = 'flex';
    }

    safeOn('btnOpenAndroidAccessibility', 'click', () => {
      if (window.AndroidWidgetBridge && typeof window.AndroidWidgetBridge.openAccessibilitySettings === 'function') {
        window.AndroidWidgetBridge.openAccessibilitySettings();
      } else {
        showToast('目前非 Android App 環境');
      }
    });

    // 常駐設定按鈕 (桌面/手機均可直接點擊)
    safeOn('btnOpenSettings', 'click', openSettingsModal);

    const settingSafeTop = document.getElementById('settingSafeTop');
    if (settingSafeTop) {
      settingSafeTop.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const valText = document.getElementById('settingSafeTopVal');
        if (valText) valText.textContent = `${val}px`;
        applySafeTop(val);
      });
    }

    safeOn('settingPinLock', 'change', (e) => {
      const pinGroup = document.getElementById('pinInputGroup');
      if (pinGroup) pinGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    safeOn('settingKairosEnabled', 'change', (e) => {
      const kairosConfigGroup = document.getElementById('kairosConfigGroup');
      if (kairosConfigGroup) kairosConfigGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    safeOn('btnTestKairosConn', 'click', async () => {
      const urlInput = document.getElementById('settingKairosUrl');
      const statusText = document.getElementById('kairosConnStatusText');
      const testUrl = urlInput ? urlInput.value.trim() : '';
      if (statusText) {
        statusText.textContent = '連線測試中...';
        statusText.style.color = 'var(--meta-text)';
      }
      const res = await testKairosConnection(testUrl);
      if (statusText) {
        statusText.textContent = res.message;
        statusText.style.color = res.success ? '#10b981' : '#f87171';
      }
    });

    // Kairos Mode v2.0 控制項綁定
    safeOn('btnKairosDone', 'click', handleKairosDone);
    safeOn('btnKairosPause', 'click', handleKairosPause);
    safeOn('btnKairosResume', 'click', handleKairosResume);
    safeOn('btnKairosAbort', 'click', handleKairosAbort);
    safeOn('btnAbortTooLarge', 'click', () => executeAbort('TOO_LARGE'));
    safeOn('btnAbortPostpone', 'click', () => executeAbort('POSTPONE'));
    safeOn('btnAbortQuit', 'click', () => executeAbort('QUIT'));
    safeOn('btnAbortCancel', 'click', closeKairosAbortModal);
    safeOn('kairosbrainDumpClose', 'click', closeBrainDump);

    const brainDumpInput = document.getElementById('kairosbrainDumpInput');
    if (brainDumpInput) {
      brainDumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitBrainDump();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeBrainDump();
        }
      });
    }

    const resumeNoteInput = document.getElementById('kairosResumeNote');
    if (resumeNoteInput) {
      resumeNoteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleKairosResume();
        }
      });
    }

    // 統一關閉所有非主畫面覆蓋層 (Modals, Drawers, Nav Tools, Popups) 返回主工作桌
    function closeAllNonMainOverlays() {
      let closedSomething = false;

      // 1. 關閉所有彈出 Modal
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        if (modal.style.display && modal.style.display !== 'none') {
          modal.style.display = 'none';
          closedSomething = true;
        }
      });

      // 2. 關閉桌上工具選單 (Nav Tools)
      const navToolsMenu = document.getElementById('navToolsMenu');
      if (navToolsMenu && navToolsMenu.style.display && navToolsMenu.style.display !== 'none') {
        closeNavTools();
        closedSomething = true;
      }

      // 3. 關閉所有底座抽屜
      const openDrawers = document.querySelectorAll('.drawer.open');
      if (openDrawers.length > 0) {
        openDrawers.forEach(drawer => drawer.classList.remove('open'));
        const backdrop = document.getElementById('drawerBackdrop');
        if (backdrop) backdrop.style.display = 'none';
        closedSomething = true;
      }

      // 4. 關閉浮動彈出選單
      document.querySelectorAll('.deadline-menu-popup, .context-menu-popup').forEach(popup => {
        popup.remove();
        closedSomething = true;
      });

      // 5. 關閉大腦暫存器
      const dump = document.getElementById('kairosbrainDump');
      if (dump && dump.style.display === 'block') {
        closeBrainDump();
        closedSomething = true;
      }

      // 6. 關閉任務後狀態評估卡片
      const checkin = document.getElementById('postTaskCheckin');
      if (checkin && checkin.style.display && checkin.style.display !== 'none') {
        closePostTaskCheckin();
        closedSomething = true;
      }

      return closedSomething;
    }

    // 全域大腦暫存器快捷鍵 (Ctrl/Cmd + K) 與 全域 ESC 返回主畫面
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isEditingOther = (activeTag === 'input' || activeTag === 'textarea') &&
          document.activeElement.id !== 'kairosbrainDumpInput';

        if (!isEditingOther) {
          e.preventDefault();
          const dump = document.getElementById('kairosbrainDump');
          if (dump && dump.style.display === 'block') {
            closeBrainDump();
          } else {
            openBrainDump();
          }
        }
      } else if (e.key === 'Escape') {
        // 只要是非主畫面的選單/彈窗/抽屜，按 ESC 均可直接返回主畫面
        const closed = closeAllNonMainOverlays();
        if (closed) {
          e.preventDefault();
        }
      }
    });

    // 相容舊版按鈕
    safeOn('btnFocusComplete', 'click', handleKairosDone);
    safeOn('btnFocusUnlock', 'click', () => {
      const nowItem = items.find(it => it.isNow && !it.done);
      if (nowItem) {
        nowItem.isNow = false;
        nowItem.updatedAt = Date.now();
        stopFocusTimer();
        saveItems();
        renderAll();
        showToast('已暫停專注，解除鎖定。');
      }
    });

    safeOn('btnTogglePinShow', 'click', () => {
      const input = document.getElementById('settingPinPass');
      const btn = document.getElementById('btnTogglePinShow');
      if (!input || !btn) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '隱藏';
      } else {
        input.type = 'password';
        btn.textContent = '顯示';
      }
    });

    const settingTheme = document.getElementById('settingTheme');
    if (settingTheme) {
      settingTheme.addEventListener('change', (e) => {
        applyTheme(e.target.value);
      });
    }

    safeOn('btnCloseSettings', 'click', () => {
      applyTheme(settings.theme);
      const modalSettings = document.getElementById('modalSettings');
      if (modalSettings) modalSettings.style.display = 'none';
    });

    safeOn('btnSaveSettings', 'click', async () => {
      const inputTodaySmall = document.getElementById('settingTodaySmallLimit');
      if (inputTodaySmall) {
        const val = parseInt(inputTodaySmall.value, 10);
        if (!isNaN(val) && val > 0) settings.todaySmallLimit = val;
      }
      const inputWeekMedLarge = document.getElementById('settingWeekMediumLargeLimit');
      if (inputWeekMedLarge) {
        const val = parseInt(inputWeekMedLarge.value, 10);
        if (!isNaN(val) && val > 0) {
          settings.weekMediumLargeLimit = val;
          settings.weekLimit = val;
        }
      }
      const settingThemeEl = document.getElementById('settingTheme');
      if (settingThemeEl) settings.theme = settingThemeEl.value;

      const inputSafeTop = document.getElementById('settingSafeTop');
      if (inputSafeTop) {
        const val = parseInt(inputSafeTop.value, 10);
        if (!isNaN(val)) {
          settings.safeTop = val;
          applySafeTop(settings.safeTop);
        }
      }

      const settingIncludeKeepEl = document.getElementById('settingIncludeKeep');
      if (settingIncludeKeepEl) settings.includeKeepInConsult = settingIncludeKeepEl.checked;

      const settingFocusLockEl = document.getElementById('settingFocusLock');
      if (settingFocusLockEl) settings.focusLockEnabled = settingFocusLockEl.checked;

      const settingKairosEl = document.getElementById('settingKairosEnabled');
      if (settingKairosEl) settings.kairosEnabled = settingKairosEl.checked;

      const settingKairosUrlEl = document.getElementById('settingKairosUrl');
      if (settingKairosUrlEl) settings.kairosUrl = settingKairosUrlEl.value.trim() || 'http://127.0.0.1:5050';

      const settingPinLockEl = document.getElementById('settingPinLock');
      const isPinLocked = settingPinLockEl ? settingPinLockEl.checked : false;
      const pinPassEl = document.getElementById('settingPinPass');
      const newPin = pinPassEl ? pinPassEl.value.trim() : '';

      if (isPinLocked) {
        if (newPin) {
          settings.pinHash = await hashPin(newPin);
          settings.pinLock = true;
        } else if (settings.pinHash) {
          settings.pinLock = true;
        } else {
          showToast('請先輸入 PIN 解鎖密碼');
          return;
        }
      } else {
        settings.pinLock = false;
      }

      settings.updatedAt = Date.now();
      saveSettings();
      applyTheme(settings.theme);
      checkLockOnStartup();
      renderAll();
      const modalSettings = document.getElementById('modalSettings');
      if (modalSettings) modalSettings.style.display = 'none';
      showToast('設定已儲存');
    });

    // 密碼鎖定與解鎖事件
    safeOn('btnLockApp', 'click', lockApp);
    safeOn('formUnlock', 'submit', unlockApp);
    safeOn('btnDoUnlock', 'click', unlockApp);

    // 匯出 / 匯入 JSON
    safeOn('btnExportJson', 'click', exportBackupJson);
    const inputImportJson = document.getElementById('inputImportJson');
    safeOn('btnImportJsonTrigger', 'click', () => {
      if (inputImportJson) inputImportJson.click();
    });
    if (inputImportJson) {
      inputImportJson.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          importBackupJson(e.target.files[0]);
          inputImportJson.value = '';
        }
      });
    }

    // 清除全部資料（兩階段確認）
    let clearConfirmPending = false;
    const btnClearAll = document.getElementById('btnClearAllData');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        if (!clearConfirmPending) {
          clearConfirmPending = true;
          btnClearAll.textContent = '確定要清除嗎？再點一次確認';
          setTimeout(() => {
            clearConfirmPending = false;
            btnClearAll.textContent = '清除全部資料';
          }, 4000);
        } else {
          items = [];
          saveItems();
          renderAll();
          const modalSettings = document.getElementById('modalSettings');
          if (modalSettings) modalSettings.style.display = 'none';
          clearConfirmPending = false;
          btnClearAll.textContent = '清除全部資料';
          showToast('已清空所有任務資料');
        }
      });
    }

    // Header /選單按鈕：跨裝置手動同步
    safeOn('btnOpenSync', 'click', () => {
      updateSyncModalStatus();
      const modalSync = document.getElementById('modalSync');
      if (modalSync) modalSync.style.display = 'flex';
      checkRemoteGistStatus(false);
    });

    safeOn('btnCheckRemoteGist', 'click', () => checkRemoteGistStatus(true));
    safeOn('btnCloseSync', 'click', () => {
      const modalSync = document.getElementById('modalSync');
      if (modalSync) modalSync.style.display = 'none';
    });
    safeOn('btnCloseSyncFooter', 'click', () => {
      const modalSync = document.getElementById('modalSync');
      if (modalSync) modalSync.style.display = 'none';
    });

    // Gist 連線設定展開/收合
    const toggleConfigHeader = document.getElementById('syncToggleConfigHeader');
    const configBody = document.getElementById('syncConfigBody');
    const configChevron = document.getElementById('syncConfigChevron');
    if (toggleConfigHeader && configBody) {
      toggleConfigHeader.addEventListener('click', () => {
        const isHidden = configBody.style.display === 'none' || !configBody.style.display;
        configBody.style.display = isHidden ? 'flex' : 'none';
        if (configChevron) configChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      });
    }

    // 顯示/隱藏 Token
    safeOn('btnToggleSyncTokenShow', 'click', () => {
      const input = document.getElementById('syncGithubToken');
      const btn = document.getElementById('btnToggleSyncTokenShow');
      if (!input || !btn) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '隱藏';
      } else {
        input.type = 'password';
        btn.textContent = '顯示';
      }
    });

    // 儲存 Gist 設定
    safeOn('btnSaveSyncConfig', 'click', () => {
      const tokenInput = document.getElementById('syncGithubToken');
      const gistInput = document.getElementById('syncGistId');
      if (tokenInput) syncConfig.githubToken = tokenInput.value.trim();
      if (gistInput) syncConfig.gistId = gistInput.value.trim();
      saveSyncConfig();
      updateSyncModalStatus();
      showToast('Gist 連線設定已儲存');
    });

    // 自動搜尋 Gist 按鈕
    safeOn('btnAutoFindGist', 'click', async () => {
      if (!(await prepareGistAuth())) return;
      showToast('正在搜尋您的 GitHub Gist…');
      const found = await findUserExistingGist(syncConfig.githubToken.trim());
      if (found) {
        syncConfig.gistId = found;
        saveSyncConfig();
        updateSyncModalStatus();
        showToast(`已成功找到並綁定 Gist (${found.substring(0, 8)}…)！`);
      } else {
        showToast('在您的帳號中未找到現有備份。請直接點擊「智慧雙向合併」進行初次建立');
      }
    });

    // 複製 Gist ID 按鈕
    safeOn('btnCopyGistId', 'click', () => {
      const gistInput = document.getElementById('syncGistId');
      const gistId = syncConfig.gistId || (gistInput ? gistInput.value.trim() : '');
      if (!gistId) {
        showToast('目前尚無 Gist ID 可複製。請先點擊「上傳本機」或「智慧雙向合併」進行初次建立');
        return;
      }
      navigator.clipboard.writeText(gistId).then(() => {
        showToast('Gist ID 已複製！請在手機貼上此 ID 即可對齊同一雲端置物櫃');
      }).catch(() => {
        showToast(`Gist ID: ${gistId}`);
      });
    });

    // 同步操作按鈕
    safeOn('btnSyncMerge', 'click', mergeWithGist);
    safeOn('btnSyncPush', 'click', pushToGist);
    safeOn('btnSyncPull', 'click', pullFromGist);

    // 裝置直傳碼
    safeOn('btnCopySyncCode', 'click', copySyncCode);
    const pasteArea = document.getElementById('syncCodePasteArea');
    safeOn('btnPasteSyncTrigger', 'click', () => {
      if (pasteArea) pasteArea.style.display = 'flex';
      const input = document.getElementById('syncCodeInput');
      if (input) input.focus();
    });
    safeOn('btnCancelPasteSync', 'click', () => {
      if (pasteArea) pasteArea.style.display = 'none';
    });
    safeOn('btnApplyPasteSync', 'click', () => {
      const input = document.getElementById('syncCodeInput');
      const val = input ? input.value : '';
      applySyncCode(val);
    });

    // 點擊 Modal 遮罩關閉
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    // 背景分頁切換回復時，即時刷新真實專注秒數
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && kairosSession.status === 'FOCUSING') {
        syncKairosElapsedSeconds();
        updateKairosTimerDisplay();
      }
    });
    window.addEventListener('focus', () => {
      if (kairosSession.status === 'FOCUSING') {
        syncKairosElapsedSeconds();
        updateKairosTimerDisplay();
      }
    });

    // 監聽 Focus Guardian Extension 連線訊號
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data) return;
      if (event.data.type === 'TASKDESK_GUARDIAN_READY' || event.data.type === 'TASKDESK_GUARDIAN_PONG') {
        guardianExtensionOnline = true;
        updateFocusGuardStatusBadge();
      }
    });
    try {
      window.postMessage({ type: 'TASKDESK_PING_GUARDIAN' }, '*');
    } catch (e) {}
  }

  // 啟動應用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
