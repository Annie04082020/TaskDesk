/**
 * TaskDesk Focus Guardian - Blocked Interception Screen Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get('target') || '';
  const taskText = urlParams.get('task') || '';

  const activeTaskTitle = document.getElementById('activeTaskTitle');
  const targetSiteText = document.getElementById('targetSiteText');
  const btnReturnDesk = document.getElementById('btnReturnDesk');
  const btnFrictionPass = document.getElementById('btnFrictionPass');
  const btnCloseTab = document.getElementById('btnCloseTab');
  const frictionOverlay = document.getElementById('frictionCountdown');
  const countdownNumber = document.getElementById('countdownNumber');

  // 渲染任務名稱與目標網域
  if (taskText) {
    activeTaskTitle.textContent = taskText;
  } else {
    // 從 storage 再次確認最新任務
    chrome.storage.local.get(['activeTask'], (data) => {
      if (data.activeTask && data.activeTask.text) {
        activeTaskTitle.textContent = data.activeTask.text;
      }
    });
  }

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      targetSiteText.textContent = `攔截分心目標：${parsed.hostname}`;
    } catch (e) {
      targetSiteText.textContent = `攔截分心目標：外部網站`;
    }
  }

  // 1. 返回 TaskDesk 工作桌
  btnReturnDesk.addEventListener('click', async () => {
    // 尋找是否已有開啟的 TaskDesk 分頁
    const tabs = await chrome.tabs.query({});
    const taskDeskTab = tabs.find(t => {
      if (!t.url) return false;
      return t.url.includes('localhost') || 
             t.url.includes('127.0.0.1') || 
             t.url.includes('TaskDesk') || 
             t.title.includes('TaskDesk') || 
             t.title.includes('個人任務工作桌');
    });

    if (taskDeskTab) {
      // 切換至現有分頁並關閉當前攔截分頁
      await chrome.tabs.update(taskDeskTab.id, { active: true });
      if (taskDeskTab.windowId) {
        await chrome.windows.update(taskDeskTab.windowId, { focused: true });
      }
      window.close();
    } else {
      // 開啟預設 TaskDesk 網址
      await chrome.tabs.create({ url: 'https://annie04082020.github.io/TaskDesk/' });
      window.close();
    }
  });

  // 2. 深呼吸 5 秒冷卻通行 (Friction Pass)
  btnFrictionPass.addEventListener('click', () => {
    if (!targetUrl) return;
    frictionOverlay.style.display = 'flex';
    let count = 5;
    countdownNumber.textContent = count;

    const interval = setInterval(async () => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
      } else {
        clearInterval(interval);
        // 通知 Background 申請緊急通行 3 分鐘
        chrome.runtime.sendMessage({
          type: 'GUARDIAN_REQUEST_PASS',
          durationMinutes: 3
        }, () => {
          // 放行跳轉至原目標網址
          window.location.href = targetUrl;
        });
      }
    }, 1000);
  });

  // 3. 關閉此分頁
  btnCloseTab.addEventListener('click', () => {
    window.close();
  });
});
