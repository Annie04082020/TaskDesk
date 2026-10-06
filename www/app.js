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
    weekLimit: 3,
    theme: 'dark',
    autoGuess: true,
    includeKeepInConsult: false,
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash'
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
    loadSyncConfig();
    applyTheme(settings.theme);
    loadItems();
    await loadRules();
    setupEventListeners();
    setupPWA();
    renderAll();
  }

  // --- 載入與儲存 ---
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        settings = Object.assign({}, settings, JSON.parse(saved));
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

  function loadItems() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (saved) {
        items = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('載入任務失敗:', e);
      items = [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('儲存任務失敗:', e);
    }
  }

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

  // --- 批次輸入解析 ---
  function parseBatchInput(rawText) {
    if (!rawText || !rawText.trim()) return [];
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
  async function addItemsToInbox(rawTexts) {
    if (!rawTexts || rawTexts.length === 0) return;

    const newItems = [];
    for (const text of rawTexts) {
      // 立即使用本機關鍵字備案作為初值
      const keywordGuessedType = guessTypeByKeywords(text);
      const item = {
        id: generateId(),
        text: text,
        bucket: 'inbox',
        isNow: false,
        done: false,
        doneAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        typeId: keywordGuessedType,
        typeSource: keywordGuessedType ? 'rule' : 'ai',
        parentId: null,
        aiGenerated: false
      };
      items.push(item);
      newItems.push(item);
    }

    saveItems();
    renderAll();

    // 若設定開啟自動猜測且具備 API Key，進行非同步批次呼叫
    if (settings.autoGuess && settings.geminiApiKey && settings.geminiApiKey.trim()) {
      newItems.forEach(it => analyzingItemIds.add(it.id));
      renderInbox(); // 顯示分析中狀態

      // 非同步批次猜測，不阻礙任何使用者操作
      runBatchAiGuess(newItems).then(() => {
        newItems.forEach(it => analyzingItemIds.delete(it.id));
        saveItems();
        renderAll();
      }).catch((err) => {
        console.warn('AI 批次猜測中斷或錯誤，保留關鍵字備案:', err);
        newItems.forEach(it => analyzingItemIds.delete(it.id));
        renderAll();
      });
    }
  }

  // --- Gemini API 批次猜類型與拆子任務 ---
  async function runBatchAiGuess(batchItems) {
    const apiKey = settings.geminiApiKey.trim();
    const model = settings.geminiModel || 'gemini-2.5-flash';

    const typeSummary = rules.taskTypes.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description
    }));

    const itemsPayload = batchItems.map((it, idx) => ({
      index: idx,
      text: it.text
    }));

    const promptText = `你是任務分類助手。以下是使用者剛輸入的項目清單（以 index 編號），以及可用的任務類型（id、名稱、說明）：
可選類型：${JSON.stringify(typeSummary)}

使用者輸入項目：
${JSON.stringify(itemsPayload)}

請對每個項目：
(1) 挑最接近的 type id，若都不像請回傳 null；
(2) 只有當該項目明顯包含多個步驟時，才拆出最多 5 個子任務（動詞開頭的短句），否則回傳空陣列 []。
不要改寫原文，不要新增或刪除項目，不要加任何評論。只回傳 JSON，不要有其他文字，也不要用 markdown 程式碼區塊。
格式範例：[{"index":0,"typeId":"...","subtasks":["..."]}]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!resp.ok) {
      throw new Error(`Gemini API 回應錯誤狀態碼: ${resp.status}`);
    }

    const data = await resp.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('未收到有效的候選文字');
    }

    // 清理可能的 markdown 圍欄
    let cleanJson = candidateText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsedResults = JSON.parse(cleanJson);
    if (!Array.isArray(parsedResults)) return;

    for (const res of parsedResults) {
      if (typeof res.index !== 'number' || res.index < 0 || res.index >= batchItems.length) continue;
      const targetItem = batchItems[res.index];
      if (!targetItem) continue;

      // 檢查使用者是否已手動更改過類型，手動確認者不得覆蓋
      if (targetItem.typeSource !== 'user') {
        if (res.typeId && rules.taskTypes.some(t => t.id === res.typeId)) {
          targetItem.typeId = res.typeId;
          targetItem.typeSource = 'ai';
        } else if (!targetItem.typeId) {
          targetItem.typeId = null;
        }
      }

      // 拆解子任務
      if (Array.isArray(res.subtasks) && res.subtasks.length > 0) {
        // 檢查是否已有現存子任務
        const existingSubtasks = getSubtasks(targetItem.id);
        if (existingSubtasks.length === 0) {
          res.subtasks.slice(0, 5).forEach(subText => {
            if (typeof subText === 'string' && subText.trim()) {
              items.push({
                id: generateId(),
                text: subText.trim(),
                bucket: targetItem.bucket,
                isNow: false,
                done: false,
                doneAt: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                typeId: targetItem.typeId,
                typeSource: 'ai',
                parentId: targetItem.id,
                aiGenerated: true
              });
            }
          });
        }
      }
    }
  }

  // --- 分堆與狀態移動 ---
  function moveItemBucket(itemId, targetBucket) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    item.updatedAt = Date.now();

    if (targetBucket === 'week') {
      // 檢查「這週」上限（母任務+子任務僅算一件頂層項目）
      const currentWeekCount = items.filter(it => it.bucket === 'week' && !it.parentId && !it.done).length;
      if (item.bucket !== 'week' && currentWeekCount >= settings.weekLimit) {
        showToast(`這週已滿 ${settings.weekLimit} 件，要先移走一件或完成一件`);
        return;
      }
    } else {
      // 若移出「這週」，取消其「現在」標記
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
      // 確保該項目在「這週」
      if (item.bucket !== 'week') {
        const currentWeekCount = items.filter(it => it.bucket === 'week' && !it.parentId && !it.done).length;
        if (currentWeekCount >= settings.weekLimit) {
          showToast(`這週已滿 ${settings.weekLimit} 件，無法將此項目移至這週`);
          item.isNow = false;
          saveItems();
          renderAll();
          return;
        }
        item.bucket = 'week';
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
      if (it.bucket === 'week') return true;
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

  // 呼叫 Gemini 進行狀態諮詢
  async function callGeminiConsult(candidates, userState) {
    const apiKey = settings.geminiApiKey.trim();
    const model = settings.geminiModel || 'gemini-2.5-flash';

    const placeNames = { home: '家', school: '學校', outdoors: '外面', transit: '移動中' };
    const levelNames = { low: '低', mid: '中', high: '高' };
    const laterNames = { none: '沒有後續行程', within1h: '1 小時內有行程', later: '今天稍晚有行程' };

    const stateSummary = `地點: ${placeNames[userState.place] || userState.place}，體力: ${levelNames[userState.body]}，精神: ${levelNames[userState.mind]}，可用時間: ${userState.time} 分鐘，後續行程: ${laterNames[userState.later]}`;

    const candidateSummary = candidates.map((c, i) => ({
      index: i,
      id: c.id,
      text: c.displayText
    }));

    const systemPrompt = `你是任務選擇的輔助。使用者會給你本週任務清單與目前狀態（地點、體力、精神、可用時間、之後的行程）。請從清單中挑最多 2 件適合現在做的事，每件用一句話說明理由。你只提供選項，不要下命令，不要鼓勵或催促，不要說教。不要新增清單以外的任務。若狀態顯示很疲累，可以建議最輕的一件，或建議先休息，並保持中性語氣。回覆簡短。
回傳格式限定 JSON：[{"index": 0, "reason": "一句中性理由"}]，不含 markdown 標籤。`;

    const userPrompt = `目前狀態：${stateSummary}
候選清單：${JSON.stringify(candidateSummary)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!resp.ok) {
      throw new Error(`Gemini 諮詢連線失敗: ${resp.status}`);
    }

    const data = await resp.json();
    const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textPart) throw new Error('無諮詢內容');

    let clean = textPart.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const recs = JSON.parse(clean);
    const results = [];
    if (Array.isArray(recs)) {
      for (const r of recs.slice(0, 2)) {
        if (typeof r.index === 'number' && candidates[r.index]) {
          results.push({
            entry: candidates[r.index],
            reason: r.reason || '符合當前狀態與條件'
          });
        }
      }
    }
    return results;
  }

  // --- 畫面渲染 ---
  function renderAll() {
    renderWeekCounter();
    renderWeek();
    renderInbox();
    renderKeep();
    renderRelease();
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
    } else if (bucketContext === 'week') {
      // 「現在」切換按鈕
      const btnNow = document.createElement('button');
      btnNow.className = `btn-now-toggle ${item.isNow ? 'is-active' : ''}`;
      btnNow.textContent = item.isNow ? '取消「現在」' : '設為「現在」';
      btnNow.addEventListener('click', () => toggleItemNow(item.id));
      triageBtns.appendChild(btnNow);

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

    badgeEl.textContent = `${weekItems.length} / ${settings.weekLimit}`;

    if (weekItems.length >= settings.weekLimit) {
      noticeEl.textContent = `已達上限（${settings.weekLimit} 件）`;
    } else {
      noticeEl.textContent = '';
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

  // 渲染「收集箱」清單
  function renderInbox() {
    const listEl = document.getElementById('inboxCardList');
    const badgeEl = document.getElementById('inboxCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '';
    const inboxItems = items.filter(it => it.bucket === 'inbox' && !it.parentId && !it.done);
    badgeEl.textContent = inboxItems.length;

    if (inboxItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '收集箱是空的。用上方輸入框記錄想法。';
      listEl.appendChild(emptyMsg);
      return;
    }

    inboxItems.forEach(item => {
      listEl.appendChild(createCardElement(item, 'inbox'));
    });
  }

  // 渲染「保溫」清單
  function renderKeep() {
    const listEl = document.getElementById('keepCardList');
    const badgeEl = document.getElementById('keepCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '';
    const keepItems = items.filter(it => it.bucket === 'keep' && !it.parentId && !it.done);
    badgeEl.textContent = keepItems.length;

    if (keepItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '目前沒有保溫項目。';
      listEl.appendChild(emptyMsg);
      return;
    }

    keepItems.forEach(item => {
      listEl.appendChild(createCardElement(item, 'keep'));
    });
  }

  // 渲染「放生」清單
  function renderRelease() {
    const listEl = document.getElementById('releaseCardList');
    const badgeEl = document.getElementById('releaseCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '';
    const releaseItems = items.filter(it => it.bucket === 'release' && !it.parentId && !it.done);
    badgeEl.textContent = releaseItems.length;

    if (releaseItems.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-neutral';
      emptyMsg.textContent = '目前沒有放生項目。';
      listEl.appendChild(emptyMsg);
      return;
    }

    releaseItems.forEach(item => {
      listEl.appendChild(createCardElement(item, 'release'));
    });
  }

  // --- 類型選擇下拉清單 ---
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

    targetEl.parentElement.style.position = 'relative';
    targetEl.parentElement.appendChild(menu);

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== targetEl) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 10);
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

  // --- 狀態諮詢介面互動 ---
  function openConsultModal() {
    consultState.turnsRemaining = 5;
    consultState.chatHistory = [];

    // 重設回點選表單狀態
    document.getElementById('consultFormArea').style.display = 'block';
    document.getElementById('consultResultArea').style.display = 'none';
    document.getElementById('consultDialogArea').style.display = 'none';
    document.getElementById('consultFooter').style.display = 'flex';
    document.getElementById('modalConsult').style.display = 'flex';
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
    const dialogArea = document.getElementById('consultDialogArea');
    const footer = document.getElementById('consultFooter');

    formArea.style.display = 'none';
    footer.style.display = 'none';
    resultArea.style.display = 'flex';
    resultArea.innerHTML = '<div class="empty-neutral">正在依條件評估適合的選項…</div>';

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

    // 符合項目存在：優先嘗試 Gemini API，失敗或無金鑰則使用本機規則建議
    let recommendations = [];
    if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
      try {
        recommendations = await callGeminiConsult(candidates, userState);
      } catch (err) {
        console.warn('Gemini 諮詢呼叫失敗，改用本機規則推薦:', err);
      }
    }

    // 若無 Gemini 結果或 API 失敗：本機挑選前 2 件
    if (recommendations.length === 0) {
      const topPicks = candidates.slice(0, 2);
      recommendations = topPicks.map(entry => ({
        entry,
        reason: '符合您目前設定的地點、可用時間與精神體力條件。'
      }));
    }

    renderConsultResults(recommendations);
  }

  function pickRandomWeekItem() {
    const uncompletedWeek = items.filter(it => it.bucket === 'week' && !it.parentId && !it.done);
    if (uncompletedWeek.length === 0) {
      showToast('目前「這週」沒有未完成項目');
      document.getElementById('modalConsult').style.display = 'none';
      return;
    }
    const chosen = uncompletedWeek[Math.floor(Math.random() * uncompletedWeek.length)];
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

    // 顯示追問區域（若有 API 金鑰）
    if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
      const dialogArea = document.getElementById('consultDialogArea');
      dialogArea.style.display = 'flex';
      updateFollowupInputState();
    }
  }

  function updateFollowupInputState() {
    const input = document.getElementById('consultFollowupInput');
    const btn = document.getElementById('btnSendFollowup');
    if (!input || !btn) return;

    if (consultState.turnsRemaining <= 0) {
      input.disabled = true;
      input.placeholder = '已達對話輪數上限（5 輪）';
      btn.disabled = true;
    } else {
      input.placeholder = `簡短詢問或備註（剩餘 ${consultState.turnsRemaining} 輪）`;
    }
  }

  async function sendConsultFollowup() {
    if (consultState.turnsRemaining <= 0) return;
    const input = document.getElementById('consultFollowupInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    consultState.turnsRemaining -= 1;
    updateFollowupInputState();

    const messagesArea = document.getElementById('dialogMessages');
    const userMsg = document.createElement('div');
    userMsg.className = 'dialog-bubble-user';
    userMsg.textContent = text;
    messagesArea.appendChild(userMsg);

    const aiMsg = document.createElement('div');
    aiMsg.className = 'dialog-bubble-ai';
    aiMsg.textContent = '思考中…';
    messagesArea.appendChild(aiMsg);

    try {
      const apiKey = settings.geminiApiKey.trim();
      const model = settings.geminiModel || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `你是任務選擇的輔助。保持簡短、中性、只給選項、不下命令。
使用者說：${text}
目前候選清單：${consultState.candidates.map(c => c.displayText).join('、')}
請用一到兩句話簡短中性回覆。`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 150 }
        })
      });

      const data = await resp.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '無回覆內容';
      aiMsg.textContent = answer.trim();
    } catch (e) {
      aiMsg.textContent = '回覆失敗或網路離線。請保持中性，自行決定是否採用。';
    }
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

    if (tokenInput) tokenInput.value = syncConfig.githubToken || '';
    if (gistIdInput) gistIdInput.value = syncConfig.gistId || '';

    if (badge) {
      if (syncConfig.githubToken && syncConfig.gistId) {
        badge.textContent = '已連接 Gist';
        badge.style.color = 'var(--accent-primary)';
        badge.style.borderColor = 'var(--accent-primary)';
      } else if (syncConfig.githubToken) {
        badge.textContent = '已填 Token (未綁定 Gist)';
        badge.style.color = 'var(--accent-secondary)';
        badge.style.borderColor = 'var(--border-light)';
      } else {
        badge.textContent = '未設定';
        badge.style.color = 'var(--meta-text)';
        badge.style.borderColor = 'var(--border-light)';
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
    const token = syncConfig.githubToken ? syncConfig.githubToken.trim() : '';
    if (!token) {
      showToast('請先展開「Gist 連線設定」輸入 GitHub Token');
      return;
    }

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
      showToast('正在上傳至 GitHub Gist…');
      let resp;
      if (!syncConfig.gistId || !syncConfig.gistId.trim()) {
        // 首次建立私人 Gist
        resp = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
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
          throw new Error(`建立 Gist 失敗 (${resp.status})，請確認 Token 具備 gist 權限`);
        }
        const data = await resp.json();
        syncConfig.gistId = data.id;
      } else {
        // 更新現有 Gist
        resp = await fetch(`https://api.github.com/gists/${syncConfig.gistId.trim()}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            description: 'Task Desk Personal Synchronization',
            files: filesBody
          })
        });

        if (!resp.ok) {
          throw new Error(`更新 Gist 失敗 (${resp.status})，請檢查 Token 或 Gist ID 是否正確`);
        }
      }

      syncConfig.lastSyncTime = Date.now();
      saveSyncConfig();
      updateSyncModalStatus();
      showToast(`上傳同步成功！（已推送到 Gist）`);
    } catch (err) {
      console.error(err);
      showToast(err.message || '上傳失敗，請確認網路與 Token');
    }
  }

  // GitHub Gist API: 從雲端拉取 (Pull)
  async function pullFromGist() {
    const token = syncConfig.githubToken ? syncConfig.githubToken.trim() : '';
    const gistId = syncConfig.gistId ? syncConfig.gistId.trim() : '';
    if (!token || !gistId) {
      showToast('請先輸入 GitHub Token 與 Gist ID');
      return;
    }

    try {
      showToast('正在從 GitHub Gist 下載…');
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) {
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
      showToast(`雲端下載成功！（共 ${items.length} 筆任務）`);
    } catch (err) {
      console.error(err);
      showToast(err.message || '下載失敗，請確認網路與設定');
    }
  }

  // GitHub Gist API: 智慧雙向合併 (Merge)
  async function mergeWithGist() {
    const token = syncConfig.githubToken ? syncConfig.githubToken.trim() : '';
    const gistId = syncConfig.gistId ? syncConfig.gistId.trim() : '';

    // 若尚未建立 Gist，則直接進行 push
    if (!gistId) {
      await pushToGist();
      return;
    }

    try {
      showToast('正在與雲端進行雙向合併…');
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) {
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

      await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
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

      syncConfig.lastSyncTime = Date.now();
      saveSyncConfig();
      renderAll();
      updateSyncModalStatus();
      showToast(`雙向合併完成！保留兩端最新狀態（共 ${items.length} 筆任務）`);
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
    // 收集箱批次送出
    const btnCapture = document.getElementById('btnCaptureSubmit');
    const inputCapture = document.getElementById('inputCapture');

    const handleCapture = () => {
      const raw = inputCapture.value;
      if (!raw || !raw.trim()) return;
      const parsed = parseBatchInput(raw);
      if (parsed.length > 0) {
        addItemsToInbox(parsed);
        inputCapture.value = '';
        showToast(`已將 ${parsed.length} 件項目加入收集箱`);
      }
    };

    btnCapture.addEventListener('click', handleCapture);
    inputCapture.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleCapture();
      }
    });

    // 折疊區塊切換 (Inbox, Keep, Release)
    ['folderInbox', 'folderKeep', 'folderRelease'].forEach(folderId => {
      const folderEl = document.getElementById(folderId);
      const headerEl = document.getElementById(folderId + 'Header');
      if (folderEl && headerEl) {
        headerEl.addEventListener('click', () => {
          folderEl.classList.toggle('is-open');
        });
      }
    });

    // Header 按鈕：幫我選 (狀態諮詢)
    document.getElementById('btnOpenConsult').addEventListener('click', openConsultModal);
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
    document.getElementById('btnSendFollowup').addEventListener('click', sendConsultFollowup);
    document.getElementById('consultFollowupInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendConsultFollowup();
    });

    // Header 按鈕：完成紀錄
    document.getElementById('btnOpenHistory').addEventListener('click', () => {
      renderHistoryModal();
      document.getElementById('modalHistory').style.display = 'flex';
    });
    document.getElementById('btnCloseHistory').addEventListener('click', () => {
      document.getElementById('modalHistory').style.display = 'none';
    });
    document.getElementById('btnCloseHistoryFooter').addEventListener('click', () => {
      document.getElementById('modalHistory').style.display = 'none';
    });

    // Header 按鈕：文字匯入
    document.getElementById('btnOpenImport').addEventListener('click', () => {
      document.getElementById('importTextArea').value = '';
      document.getElementById('modalImport').style.display = 'flex';
    });
    document.getElementById('btnCloseImport').addEventListener('click', () => {
      document.getElementById('modalImport').style.display = 'none';
    });
    document.getElementById('btnCancelImport').addEventListener('click', () => {
      document.getElementById('modalImport').style.display = 'none';
    });
    document.getElementById('btnDoImport').addEventListener('click', () => {
      const text = document.getElementById('importTextArea').value;
      const lines = parseBatchInput(text);
      if (lines.length > 0) {
        addItemsToInbox(lines);
        showToast(`已匯入 ${lines.length} 件項目至收集箱`);
        document.getElementById('modalImport').style.display = 'none';
      } else {
        showToast('請輸入或貼上文字');
      }
    });

    // Header 按鈕：設定
    const modalSettings = document.getElementById('modalSettings');
    document.getElementById('btnOpenSettings').addEventListener('click', () => {
      document.getElementById('settingWeekLimit').value = settings.weekLimit;
      document.getElementById('settingTheme').value = settings.theme;
      document.getElementById('settingAutoGuess').checked = settings.autoGuess;
      document.getElementById('settingIncludeKeep').checked = settings.includeKeepInConsult;
      document.getElementById('settingApiKey').value = settings.geminiApiKey || '';
      document.getElementById('settingModel').value = settings.geminiModel || 'gemini-2.5-flash';
      modalSettings.style.display = 'flex';
    });

    document.getElementById('btnCloseSettings').addEventListener('click', () => {
      modalSettings.style.display = 'none';
    });

    document.getElementById('btnToggleApiKeyShow').addEventListener('click', () => {
      const input = document.getElementById('settingApiKey');
      const btn = document.getElementById('btnToggleApiKeyShow');
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '隱藏';
      } else {
        input.type = 'password';
        btn.textContent = '顯示';
      }
    });

    document.getElementById('btnSaveSettings').addEventListener('click', () => {
      const newLimit = parseInt(document.getElementById('settingWeekLimit').value, 10);
      if (!isNaN(newLimit) && newLimit > 0) {
        settings.weekLimit = newLimit;
      }
      settings.theme = document.getElementById('settingTheme').value;
      settings.autoGuess = document.getElementById('settingAutoGuess').checked;
      settings.includeKeepInConsult = document.getElementById('settingIncludeKeep').checked;
      settings.geminiApiKey = document.getElementById('settingApiKey').value.trim();
      settings.geminiModel = document.getElementById('settingModel').value;

      saveSettings();
      applyTheme(settings.theme);
      renderAll();
      modalSettings.style.display = 'none';
      showToast('設定已儲存');
    });

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
    });

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
