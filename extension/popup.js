/**
 * TaskDesk Focus Guardian - Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const activeTaskSection = document.getElementById('activeTaskSection');
  const activeTaskText = document.getElementById('activeTaskText');
  const btnQuickOpenDesk = document.getElementById('btnQuickOpenDesk');
  const toggleGuardian = document.getElementById('toggleGuardian');
  const passRow = document.getElementById('passRow');
  const passDescText = document.getElementById('passDescText');
  const btnTriggerPass = document.getElementById('btnTriggerPass');
  const domainChipsContainer = document.getElementById('domainChipsContainer');
  const blockedCount = document.getElementById('blockedCount');
  const addDomainForm = document.getElementById('addDomainForm');
  const newDomainInput = document.getElementById('newDomainInput');
  const distractionCountText = document.getElementById('distractionCountText');

  let currentBlockedDomains = [];

  // 讀取當前狀態
  async function loadState() {
    const data = await chrome.storage.local.get([
      'focusActive',
      'activeTask',
      'guardianEnabled',
      'blockedDomains',
      'emergencyPassUntil',
      'distractionLogs'
    ]);

    currentBlockedDomains = data.blockedDomains || [
      'youtube.com', 'bilibili.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com'
    ];

    // 1. 守護開關
    toggleGuardian.checked = data.guardianEnabled !== false;

    // 2. 狀態顯示
    const isPass = data.emergencyPassUntil && Date.now() < data.emergencyPassUntil;
    statusIndicator.className = 'status-indicator';

    if (isPass) {
      statusIndicator.classList.add('is-pass');
      const remainMin = Math.ceil((data.emergencyPassUntil - Date.now()) / 60000);
      statusText.textContent = `通行中 (餘 ${remainMin}m)`;
      passDescText.textContent = `臨時放行中，剩餘約 ${remainMin} 分鐘`;
      btnTriggerPass.textContent = '延長 3m';
    } else if (data.focusActive) {
      statusIndicator.classList.add('is-focusing');
      statusText.textContent = '專注保護中';
      passDescText.textContent = '需要查資料時暫時解除攔截 3 分鐘';
      btnTriggerPass.textContent = '通行 3m';
    } else {
      statusText.textContent = '待命中 (等待開工)';
      passDescText.textContent = '需要查資料時暫時解除攔截 3 分鐘';
      btnTriggerPass.textContent = '通行 3m';
    }

    // 3. 當前任務
    if (data.focusActive && data.activeTask) {
      activeTaskSection.style.display = 'block';
      activeTaskText.textContent = data.activeTask.text || '專注任務中';
    } else {
      activeTaskSection.style.display = 'none';
    }

    // 4. 黑名單標籤
    renderDomainChips();

    // 5. 攔截紀錄統計
    const logs = data.distractionLogs || [];
    distractionCountText.textContent = `累計攔截 ${logs.length} 次分心衝動`;
  }

  // 渲染黑名單標籤
  function renderDomainChips() {
    domainChipsContainer.innerHTML = '';
    blockedCount.textContent = currentBlockedDomains.length;

    currentBlockedDomains.forEach(domain => {
      const chip = document.createElement('div');
      chip.className = 'domain-chip';
      const label = document.createElement('span');
      label.textContent = domain;
      const removeBtn = document.createElement('span');
      removeBtn.className = 'chip-remove';
      removeBtn.textContent = '×';
      removeBtn.dataset.domain = domain;
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      domainChipsContainer.appendChild(chip);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 切換守護開關
  toggleGuardian.addEventListener('change', async () => {
    await chrome.storage.local.set({ guardianEnabled: toggleGuardian.checked });
    loadState();
  });

  // 申請臨時通行
  btnTriggerPass.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'GUARDIAN_REQUEST_PASS',
      durationMinutes: 3
    }, () => {
      loadState();
    });
  });

  // 快速切換回 TaskDesk 分頁
  btnQuickOpenDesk.addEventListener('click', async () => {
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
      await chrome.tabs.update(taskDeskTab.id, { active: true });
      if (taskDeskTab.windowId) {
        await chrome.windows.update(taskDeskTab.windowId, { focused: true });
      }
      window.close();
    } else {
      await chrome.tabs.create({ url: 'https://annie04082020.github.io/TaskDesk/' });
      window.close();
    }
  });

  // 移除網域
  domainChipsContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('chip-remove')) {
      const targetDomain = e.target.getAttribute('data-domain');
      currentBlockedDomains = currentBlockedDomains.filter(d => d !== targetDomain);
      await chrome.storage.local.set({ blockedDomains: currentBlockedDomains });
      renderDomainChips();
    }
  });

  // 新增網域
  addDomainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let val = newDomainInput.value.trim().toLowerCase();
    if (!val) return;
    try {
      if (val.startsWith('http://') || val.startsWith('https://')) {
        val = new URL(val).hostname;
      }
    } catch (err) {}
    val = val.replace(/^www\./, '');

    if (!currentBlockedDomains.includes(val) && /^[a-z0-9.-]+$/i.test(val)) {
      currentBlockedDomains.push(val);
      await chrome.storage.local.set({ blockedDomains: currentBlockedDomains });
      renderDomainChips();
    }
    newDomainInput.value = '';
  });

  // 初次加載
  loadState();
});
