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

  let rules = DEFAULT_RULES;
  let items = [];
  let settings = {
    todaySmallLimit: 3,
    weekMediumLargeLimit: 3,
    weekLimit: 3, // 相容舊版
    theme: 'dark',
    safeTop: 56,
    includeKeepInConsult: false,
    pinLock: false,
    pinHash: ''
  };

  let activeWorkbench = 'today'; // 'today' | 'week'

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
    loadSyncConfig();
    applyTheme(settings.theme);
    applySafeTop(settings.safeTop);
    loadItems();
    await loadRules();
    setupEventListeners();
    setupPWA();
    renderAll();
    checkLockOnStartup();
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
            it.quadrant = 'q2'; // 預設重要不緊急 (核心推進)
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

  // --- 批次輸入解析 (支援換行純文字、符號分割、及 Google Tasks Takeout JSON) ---
  function parseBatchInput(rawText, onlyUncompleted = true) {
    if (!rawText || !rawText.trim()) return [];
    const trimmed = rawText.trim();

    // 嘗試解析 JSON (例如 Google Tasks Takeout 或陣列)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const tasksFound = [];

        function processTaskObject(task) {
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
            tasksFound.push(fullText);
          }
        }

        if (Array.isArray(parsed)) {
          parsed.forEach(it => {
            if (typeof it === 'string' && it.trim()) {
              tasksFound.push(it.trim());
            } else if (typeof it === 'object') {
              processTaskObject(it);
            }
          });
        } else if (typeof parsed === 'object') {
          // Google Takeout tasks#taskLists 格式
          if (Array.isArray(parsed.items)) {
            parsed.items.forEach(item => {
              if (Array.isArray(item.items)) {
                item.items.forEach(t => processTaskObject(t));
              } else {
                processTaskObject(item);
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

    // 依換行、頓號、逗號、分號分割
    const lines = rawText.split(/[\r\n、，,；;]+/);
    const result = [];
    for (let line of lines) {
      line = line.trim();
      // 清除項目符號如 - * 1. 2. •
      line = line.replace(/^[-*•]\s+/, '').replace(/^\d+[\.、]\s*/, '').trim();
      if (line.length > 0) {
        result.push(line);
      }
    }
    return result;
  }

  // --- 核心業務邏輯：新增項目 ---
  async function addItemsToInbox(rawTexts, explicitSize, explicitQuadrant, explicitDeadline) {
    if (!rawTexts || rawTexts.length === 0) return;

    const newItems = [];
    for (let text of rawTexts) {
      let parsedQuadrant = explicitQuadrant || null;
      let parsedDeadline = explicitDeadline || null;

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

      // 立即使用本機關鍵字備案作為初值
      const keywordGuessedType = guessTypeByKeywords(text);
      const isAuto = (!explicitSize || explicitSize === 'auto');
      const itemSize = isAuto ? guessSize(text, keywordGuessedType) : explicitSize;
      const item = {
        id: generateId(),
        text: text,
        size: itemSize, // 'small' | 'medium' | 'large'
        bucket: 'inbox',
        isNow: false,
        done: false,
        doneAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        typeId: keywordGuessedType,
        typeSource: keywordGuessedType ? 'rule' : 'ai',
        parentId: null,
        aiGenerated: false,
        quadrant: parsedQuadrant || getComputedQuadrant({ text: text, size: itemSize, deadline: parsedDeadline }),
        deadline: parsedDeadline || null
      };
      items.push(item);
      newItems.push(item);
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
        showToast(`已完成「${item.text}」，已永久歸檔至歷史檔案庫`);
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

  // --- 畫面渲染 ---
  function renderAll() {
    renderWeekCounter();
    renderWorkbenchCounters();
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
    card.className = `task-card ${item.isNow ? 'is-now' : ''}`;
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

    // 主介面卡片不顯示象限標籤與死線（避免造成輕重緩急焦慮，僅在總覽視窗與自動選演算法使用）

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
      btnNow.textContent = item.isNow ? '取消「現在」' : '設為「現在」';
      btnNow.addEventListener('click', () => toggleItemNow(item.id));
      triageBtns.appendChild(btnNow);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '移至這週';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '移至保溫';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '移至放生';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '退回收集箱';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    } else if (bucketContext === 'week') {
      // 「現在」切換按鈕
      const btnNow = document.createElement('button');
      btnNow.className = `btn-now-toggle ${item.isNow ? 'is-active' : ''}`;
      btnNow.textContent = item.isNow ? '取消「現在」' : '設為「現在」';
      btnNow.addEventListener('click', () => toggleItemNow(item.id));
      triageBtns.appendChild(btnNow);

      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '移至今日';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '移至保溫';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '移至放生';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '退回收集箱';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    } else if (bucketContext === 'keep') {
      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '移至今日';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '移至這週';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToRelease = document.createElement('button');
      btnToRelease.className = 'btn-triage';
      btnToRelease.textContent = '移至放生';
      btnToRelease.addEventListener('click', () => moveItemBucket(item.id, 'release'));
      triageBtns.appendChild(btnToRelease);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '退回收集箱';
      btnToInbox.addEventListener('click', () => moveItemBucket(item.id, 'inbox'));
      triageBtns.appendChild(btnToInbox);
    } else if (bucketContext === 'release') {
      const btnToToday = document.createElement('button');
      btnToToday.className = 'btn-triage';
      btnToToday.textContent = '移至今日';
      btnToToday.addEventListener('click', () => moveItemBucket(item.id, 'today'));
      triageBtns.appendChild(btnToToday);

      const btnToWeek = document.createElement('button');
      btnToWeek.className = 'btn-triage';
      btnToWeek.textContent = '移至這週';
      btnToWeek.addEventListener('click', () => moveItemBucket(item.id, 'week'));
      triageBtns.appendChild(btnToWeek);

      const btnToKeep = document.createElement('button');
      btnToKeep.className = 'btn-triage';
      btnToKeep.textContent = '移至保溫';
      btnToKeep.addEventListener('click', () => moveItemBucket(item.id, 'keep'));
      triageBtns.appendChild(btnToKeep);

      const btnToInbox = document.createElement('button');
      btnToInbox.className = 'btn-triage';
      btnToInbox.textContent = '退回收集箱';
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
      badgeEl.textContent = `${smallCount} / ${settings.todaySmallLimit} (小 / 試水溫)`;
    }

    if (noticeEl) {
      if (smallCount >= settings.todaySmallLimit) {
        noticeEl.textContent = `小任務/試水溫已達上限（${settings.todaySmallLimit} 件）`;
        noticeEl.style.color = 'var(--accent-primary)';
      } else {
        noticeEl.textContent = `小任務/試水溫上限 ${settings.todaySmallLimit} 件（總計 ${todayItems.length} 件）`;
        noticeEl.style.color = '';
      }
    }

    if (todayItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '今日工作桌目前沒有項目。可從收集箱點選「今日」移入。';
      listEl.appendChild(emptyMsg);
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
      badgeEl.textContent = `${medLargeCount} / ${settings.weekMediumLargeLimit} (中/大)`;
    }

    if (noticeEl) {
      if (medLargeCount >= settings.weekMediumLargeLimit) {
        noticeEl.textContent = `中/大任務已達上限（${settings.weekMediumLargeLimit} 件）`;
        noticeEl.style.color = 'var(--accent-primary)';
      } else {
        noticeEl.textContent = `中/大任務上限 ${settings.weekMediumLargeLimit} 件（總計 ${weekItems.length} 件）`;
        noticeEl.style.color = '';
      }
    }

    if (weekItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '這週目前沒有挑選的項目。可從收集箱點選移入。';
      listEl.appendChild(emptyMsg);
      return;
    }

    weekItems.forEach(item => {
      listEl.appendChild(createCardElement(item, 'week'));
    });
  }

  // --- 工作桌抽屜系統 (Desk Drawers: 收集箱 / 保溫 / 放生 / 歷史檔案) ---
  let currentDrawer = 'inbox'; // 'inbox' | 'keep' | 'release' | 'history'

  function openDrawer(drawerName) {
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
  // 使用者無需自行判斷 Q1/Q2/Q3/Q4，系統依「任務大小」與「截止死線」客觀自動分流
  function getComputedQuadrant(item) {
    if (!item) return 'q4';
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

    if (quadId === 'q1') {
      return {
        id: 'q1',
        badge: '迫在眉睫',
        title: '重要且緊急',
        color: '#f87171',
        desc: `系統判定理由：屬於${sizeText}且【${dlStatus}】，具備高核心價值與急迫時限，判定為優先處置焦點。`
      };
    }
    if (quadId === 'q2') {
      return {
        id: 'q2',
        badge: '核心深耕',
        title: '重要不急',
        color: '#38bdf8',
        desc: `系統判定理由：屬於${sizeText}且【${dlStatus}】，具備高核心價值但無急迫火燒眉毛壓力，是成長最重要的沉浸區。`
      };
    }
    if (quadId === 'q3') {
      return {
        id: 'q3',
        badge: '瑣事速辦',
        title: '緊急瑣事',
        color: '#fbbf24',
        desc: `系統判定理由：屬於${sizeText}且【${dlStatus}】，行政瑣事期限逼近，花少許時間順手清空即可。`
      };
    }
    return {
      id: 'q4',
      badge: '順手雜項',
      title: '低壓順手',
      color: '#94a3b8',
      desc: `系統判定理由：屬於${sizeText}且【${dlStatus}】，低精神負擔備用清單，有餘力或零碎空檔再執行。`
    };
  }

  // --- 截止死線設定浮動選單 (免自己選象限，系統依死線自動計算) ---
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
    titleEl.textContent = '📅 截止死線設定';

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
    hintEl.textContent = '💡 不用您自己選象限！只要設定死線，系統會根據任務大小與剩餘天數自動判定輕重緩急。死線在主介面卡片隱藏不顯示。';
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
      infoBox.innerHTML = `
        <div class="deadline-auto-badge" style="color: ${qInfo.color};">
          🤖 系統自動判定：${qInfo.badge}
        </div>
        <div class="deadline-auto-desc">${qInfo.desc}</div>
      `;
    }

    function applyDeadline(newVal) {
      item.deadline = newVal;
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
        empty.textContent = '此象限尚無待辦事項';
        itemsList.appendChild(empty);
      } else {
        qItems.forEach(it => {
          const card = document.createElement('div');
          card.className = `matrix-item-card ${it.isNow ? 'is-now' : ''}`;

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
            dlTag.textContent = `📅 ${it.deadline.substring(5)}`;
            tagsWrap.appendChild(dlTag);
          }

          metaRow.appendChild(tagsWrap);

          // Actions
          const actionsWrap = document.createElement('div');
          actionsWrap.className = 'matrix-item-actions';

          // 調整死線按鈕 (代替手動切換象限，讓系統自動重算象限)
          const btnDeadline = document.createElement('button');
          btnDeadline.className = 'btn-matrix-shift';
          btnDeadline.textContent = it.deadline ? `📅 ${it.deadline.substring(5)}` : '📅 設死線';
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

  // --- 幫我選：客觀自動決策引擎 (Auto-Decide) ---
  let autoDecideCandidates = [];
  let autoDecideCurrentIndex = 0;

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

    // 直接在系統中將此任務指派為「現在做這個」
    setAsNow(item.id);

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
      reasonText.textContent = `根據條件評估：${candidate.reasonSummary} 已為您直接設定為「現在」，即刻專注於此！`;
    }

    if (modal) modal.style.display = 'flex';
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
    timeChip.textContent = `✓ ${timeStr}`;
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
    btnRestoreToday.textContent = '復原至今日';
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
    btnRestoreWeek.textContent = '復原至這週';
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
      showToast('⚠️ GitHub 細粒度 Token (github_pat_) 不支援 Gist，請使用 Classic Token (以 ghp_ 開頭)');
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
    // 先載入本機所有項目
    for (const it of localList) {
      itemMap.set(it.id, Object.assign({}, it));
    }
    // 依據時間戳記與狀態合併遠端項目
    for (const rIt of remoteList) {
      if (!itemMap.has(rIt.id)) {
        itemMap.set(rIt.id, Object.assign({}, rIt));
      } else {
        const localIt = itemMap.get(rIt.id);
        const localTime = localIt.updatedAt || localIt.createdAt || 0;
        const remoteTime = rIt.updatedAt || rIt.createdAt || 0;
        // 遠端比本機新：採納遠端
        if (remoteTime > localTime) {
          itemMap.set(rIt.id, Object.assign({}, rIt));
        } else if (remoteTime === localTime) {
          // 時間相同時，已完成或設定 isNow 優先
          if (rIt.done && !localIt.done) {
            itemMap.set(rIt.id, Object.assign({}, rIt));
          } else if (rIt.isNow && !localIt.isNow) {
            itemMap.set(rIt.id, Object.assign({}, rIt));
          }
        }
      }
    }

    const merged = Array.from(itemMap.values());

    // 確保全域最多只有一個 isNow
    let foundNow = false;
    for (const it of merged) {
      if (it.isNow) {
        if (foundNow) {
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
        const proceed = confirm(`⚠️ 警告：雲端 Gist 目前儲存了 0 筆任務，但您本機有 ${items.length} 筆任務！\n\n若強制「下載」將會覆蓋清空本機任務。\n建議改用「智慧雙向合併」即可將本機任務同步至雲端並保留。\n\n您確定仍要從雲端下載並清空本機嗎？`);
        if (!proceed) {
          showToast('已取消下載，保留本機現有任務');
          return;
        }
      }

      items = remotePayload.items;
      if (remotePayload.settings) {
        settings = Object.assign({}, settings, remotePayload.settings);
        saveSettings();
        applyTheme(settings.theme);
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
      if (fileData && fileData.content) {
        const remotePayload = JSON.parse(fileData.content);
        if (Array.isArray(remotePayload.items)) {
          remoteItems = remotePayload.items;
        }
      }

      // 進行無失真時間戳雙向合併
      items = smartMergeItems(items, remoteItems);
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
        showToast(`已將 ${parsed.length} 件項目收進「收集箱」抽屜`);
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
      });
    }

    const btnAutoDecideAccept = document.getElementById('btnAutoDecideAccept');
    if (btnAutoDecideAccept) {
      btnAutoDecideAccept.addEventListener('click', () => {
        document.getElementById('modalAutoDecide').style.display = 'none';
        showToast('🎯 已為您聚焦現在任務，開始專注！');
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

      if (data.kind === 'tasks#taskLists' || Array.isArray(data.items)) {
        const lists = [];
        const rawLists = Array.isArray(data.items) ? data.items : [];
        rawLists.forEach((lst, idx) => {
          if (!lst || typeof lst !== 'object') return;
          const listTitle = lst.title || `清單 ${idx + 1}`;
          const rawItems = Array.isArray(lst.items) ? lst.items : [];
          const uncompletedTasks = [];
          const completedTasks = [];

          rawItems.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const title = (item.title || item.text || item.summary || '').trim();
            if (!title) return;
            let fullText = title;
            if (item.notes && typeof item.notes === 'string' && item.notes.trim()) {
              fullText += ` (${item.notes.trim()})`;
            }
            if (item.due && typeof item.due === 'string') {
              const datePart = item.due.substring(0, 10);
              if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                fullText += ` #deadline:${datePart}`;
              }
            }
            if (item.status === 'completed' || item.done === true) {
              completedTasks.push(fullText);
            } else {
              uncompletedTasks.push(fullText);
            }
          });

          lists.push({
            id: lst.id || `list_${idx}`,
            title: listTitle,
            totalCount: rawItems.length,
            uncompletedCount: uncompletedTasks.length,
            completedCount: completedTasks.length,
            uncompletedTasks: uncompletedTasks,
            allTasks: uncompletedTasks.concat(completedTasks),
            // 預設選取有待辦且非超龐大重複循環清單 (大於 500 件如 Daily Quest 預設不勾，保護流暢度)
            selected: uncompletedTasks.length > 0 && uncompletedTasks.length <= 500
          });
        });
        return lists;
      }
      return null;
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
        badgeWrap.style.gap = '8px';

        const badge = document.createElement('span');
        badge.className = 'folder-badge';
        badge.style.fontFamily = 'var(--font-mono)';
        badge.style.fontSize = '0.74rem';
        badge.style.color = lst.uncompletedCount > 0 ? 'var(--accent-primary)' : 'var(--meta-text)';
        badge.textContent = `${count} 件${onlyUncompleted ? '待辦' : '任務'}`;

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
          previewBox.textContent = displayTasks.slice(0, 30).map((t, i) => `${i + 1}. ${t}`).join('\n') +
            (displayTasks.length > 30 ? `\n... 等共 ${displayTasks.length} 件` : '');
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
      if (importNotice) {
        importNotice.textContent = `偵測到 ${parsed.length} 件任務`;
      }
    }

    if (importTextArea) {
      importTextArea.addEventListener('input', updateImportCountPreview);
    }

    document.getElementById('btnOpenImport').addEventListener('click', () => {
      document.getElementById('modalImport').style.display = 'flex';
      if (activeImportTab === 'text' && importTextArea) {
        setTimeout(() => importTextArea.focus(), 80);
      }
    });
    document.getElementById('btnCloseImport').addEventListener('click', () => {
      document.getElementById('modalImport').style.display = 'none';
    });
    document.getElementById('btnCancelImport').addEventListener('click', () => {
      document.getElementById('modalImport').style.display = 'none';
    });

    document.getElementById('btnDoImport').addEventListener('click', () => {
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
          addItemsToInbox(selectedTasks);
          showToast(`已成功匯入 ${selectedTasks.length} 件任務至收集箱`);
          document.getElementById('modalImport').style.display = 'none';
        } else {
          showToast('請至少勾選一個具有任務的清單');
        }
      } else {
        const text = importTextArea ? importTextArea.value : '';
        const lines = parseBatchInput(text, true);
        if (lines.length > 0) {
          addItemsToInbox(lines);
          showToast(`已匯入 ${lines.length} 件項目至收集箱`);
          document.getElementById('modalImport').style.display = 'none';
        } else {
          showToast('請輸入文字或選擇 Google Tasks 檔案');
        }
      }
    });

    // Header 按鈕：設定
    const modalSettings = document.getElementById('modalSettings');
    document.getElementById('btnOpenSettings').addEventListener('click', () => {
      const inputTodaySmall = document.getElementById('settingTodaySmallLimit');
      if (inputTodaySmall) inputTodaySmall.value = settings.todaySmallLimit || 3;
      const inputWeekMedLarge = document.getElementById('settingWeekMediumLargeLimit');
      if (inputWeekMedLarge) inputWeekMedLarge.value = settings.weekMediumLargeLimit || 3;

      document.getElementById('settingTheme').value = settings.theme;
      const safeTopVal = settings.safeTop || 56;
      const inputSafeTop = document.getElementById('settingSafeTop');
      const valSafeTopText = document.getElementById('settingSafeTopVal');
      if (inputSafeTop) inputSafeTop.value = safeTopVal;
      if (valSafeTopText) valSafeTopText.textContent = `${safeTopVal}px`;

      document.getElementById('settingIncludeKeep').checked = settings.includeKeepInConsult;
      document.getElementById('settingPinLock').checked = !!settings.pinLock;
      document.getElementById('pinInputGroup').style.display = settings.pinLock ? 'block' : 'none';
      document.getElementById('settingPinPass').value = '';
      modalSettings.style.display = 'flex';
    });

    const settingSafeTop = document.getElementById('settingSafeTop');
    if (settingSafeTop) {
      settingSafeTop.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const valText = document.getElementById('settingSafeTopVal');
        if (valText) valText.textContent = `${val}px`;
        applySafeTop(val);
      });
    }

    document.getElementById('settingPinLock').addEventListener('change', (e) => {
      document.getElementById('pinInputGroup').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('btnTogglePinShow').addEventListener('click', () => {
      const input = document.getElementById('settingPinPass');
      const btn = document.getElementById('btnTogglePinShow');
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

    document.getElementById('btnCloseSettings').addEventListener('click', () => {
      applyTheme(settings.theme);
      modalSettings.style.display = 'none';
    });

    document.getElementById('btnSaveSettings').addEventListener('click', async () => {
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
          settings.weekLimit = val; // 同步維持相容
        }
      }
      settings.theme = document.getElementById('settingTheme').value;

      const inputSafeTop = document.getElementById('settingSafeTop');
      if (inputSafeTop) {
        const val = parseInt(inputSafeTop.value, 10);
        if (!isNaN(val)) {
          settings.safeTop = val;
          applySafeTop(settings.safeTop);
        }
      }

      settings.includeKeepInConsult = document.getElementById('settingIncludeKeep').checked;

      const isPinLocked = document.getElementById('settingPinLock').checked;
      const newPin = document.getElementById('settingPinPass').value.trim();

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

      saveSettings();
      applyTheme(settings.theme);
      checkLockOnStartup();
      renderAll();
      modalSettings.style.display = 'none';
      showToast('設定已儲存');
    });

    // 密碼鎖定與解鎖事件
    document.getElementById('btnLockApp').addEventListener('click', lockApp);
    document.getElementById('formUnlock').addEventListener('submit', unlockApp);
    document.getElementById('btnDoUnlock').addEventListener('click', unlockApp);

    // 匯出 / 匯入 JSON
    document.getElementById('btnExportJson').addEventListener('click', exportBackupJson);
    const inputImportJson = document.getElementById('inputImportJson');
    document.getElementById('btnImportJsonTrigger').addEventListener('click', () => {
      inputImportJson.click();
    });
    inputImportJson.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importBackupJson(e.target.files[0]);
        inputImportJson.value = '';
      }
    });

    // 清除全部資料（兩階段確認）
    let clearConfirmPending = false;
    const btnClearAll = document.getElementById('btnClearAllData');
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
        modalSettings.style.display = 'none';
        clearConfirmPending = false;
        btnClearAll.textContent = '清除全部資料';
        showToast('已清空所有任務資料');
      }
    });

    // Header 按鈕：跨裝置手動同步
    const modalSync = document.getElementById('modalSync');
    document.getElementById('btnOpenSync').addEventListener('click', () => {
      updateSyncModalStatus();
      modalSync.style.display = 'flex';
      checkRemoteGistStatus(false);
    });

    const btnCheckRemote = document.getElementById('btnCheckRemoteGist');
    if (btnCheckRemote) {
      btnCheckRemote.addEventListener('click', () => checkRemoteGistStatus(true));
    }

    document.getElementById('btnCloseSync').addEventListener('click', () => {
      modalSync.style.display = 'none';
    });
    document.getElementById('btnCloseSyncFooter').addEventListener('click', () => {
      modalSync.style.display = 'none';
    });

    // Gist 連線設定展開/收合
    const toggleConfigHeader = document.getElementById('syncToggleConfigHeader');
    const configBody = document.getElementById('syncConfigBody');
    const configChevron = document.getElementById('syncConfigChevron');
    toggleConfigHeader.addEventListener('click', () => {
      const isHidden = configBody.style.display === 'none' || !configBody.style.display;
      configBody.style.display = isHidden ? 'flex' : 'none';
      configChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    // 顯示/隱藏 Token
    document.getElementById('btnToggleSyncTokenShow').addEventListener('click', () => {
      const input = document.getElementById('syncGithubToken');
      const btn = document.getElementById('btnToggleSyncTokenShow');
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '隱藏';
      } else {
        input.type = 'password';
        btn.textContent = '顯示';
      }
    });

    // 儲存 Gist 設定
    document.getElementById('btnSaveSyncConfig').addEventListener('click', () => {
      syncConfig.githubToken = document.getElementById('syncGithubToken').value.trim();
      syncConfig.gistId = document.getElementById('syncGistId').value.trim();
      saveSyncConfig();
      updateSyncModalStatus();
      showToast('Gist 連線設定已儲存');
    });

    // 自動搜尋 Gist 按鈕
    const btnAutoFind = document.getElementById('btnAutoFindGist');
    if (btnAutoFind) {
      btnAutoFind.addEventListener('click', async () => {
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
    }

    // 複製 Gist ID 按鈕
    const btnCopyGist = document.getElementById('btnCopyGistId');
    if (btnCopyGist) {
      btnCopyGist.addEventListener('click', () => {
        const gistId = syncConfig.gistId || document.getElementById('syncGistId').value.trim();
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
    }

    // 同步操作按鈕
    document.getElementById('btnSyncMerge').addEventListener('click', mergeWithGist);
    document.getElementById('btnSyncPush').addEventListener('click', pushToGist);
    document.getElementById('btnSyncPull').addEventListener('click', pullFromGist);

    // 裝置直傳碼
    document.getElementById('btnCopySyncCode').addEventListener('click', copySyncCode);
    const pasteArea = document.getElementById('syncCodePasteArea');
    document.getElementById('btnPasteSyncTrigger').addEventListener('click', () => {
      pasteArea.style.display = 'flex';
      document.getElementById('syncCodeInput').focus();
    });
    document.getElementById('btnCancelPasteSync').addEventListener('click', () => {
      pasteArea.style.display = 'none';
    });
    document.getElementById('btnApplyPasteSync').addEventListener('click', () => {
      const val = document.getElementById('syncCodeInput').value;
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
  }

  // 啟動應用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
