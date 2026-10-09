# Task Desk (個人任務工作桌)

> 一個低壓力、高專注的個人任務工作桌與單工沉浸引擎。  
> 拒絕假性生產力拖延，將零散想法快速倒入抽屜，並在單一焦點下平穩推進真正重要的事情。

[![Release](https://img.shields.io/github/v/release/Annie04082020/TaskDesk?style=flat-square&color=38bdf8)](https://github.com/Annie04082020/TaskDesk/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20%7C%20Android-10b981?style=flat-square)](https://github.com/Annie04082020/TaskDesk)

📖 **完整詳細教學請參閱：[詳細使用說明書 (USER_GUIDE.md)](./USER_GUIDE.md)**

---

## 核心設計理念與優勢

1. **實體工作桌隱喻 (Physical Desk Metaphor)**：工作桌面絕不堆積成百上千條清單。只留「今天」與「本週」能消化的限量卡片，其餘項目一律歸入底座抽屜。
2. **單工沉浸優先 (Single-Tasking Engine)**：點擊「現在做這個」即啟動全頁沉浸模式，自動遮蔽並封鎖工作桌其餘卡片的編輯與切換，阻斷在待辦清單中來回整理的「假性生產力」拖延。
3. **正向累積，拒絕焦慮 (Positive Time Accumulation)**：採用正向計時累積實打實的專注時長，沒有倒數計時即將歸零的急促警報壓力。
4. **工作記憶保護機制 (Working Memory Protection)**：
   * **呼吸態接關便籤**：暫停時留下「等一下回來第一步要做什麼」，降低重新啟動的切換阻力。
   * **大腦雜念暫存器 (`Ctrl/Cmd + K`)**：專注心流中閃現的瑣事一秒存入收集箱，不中斷當前任務。
5. **後台工時與認知分析儀表板 (Focus & Workload Analytics)**：獨立後台數據中心，追蹤四象限時間投資比、生理開工時段、中斷結構與接關筆記歷史，支援一鍵匯出 CSV / JSON。
6. **客觀自動決策 (Auto-Decide) 消除選擇疲勞**：點擊「幫我選」，系統依據時段節律、死線迫近與四象限權重，0.1 秒客觀推薦當前最佳任務。
7. **極簡單色美學 (Monochrome Distraction-Free UI)**：純文字高對比排版，全面移除彩色圖標與表情符號，使大腦視覺刺激降至最低。
8. **完全離線優先與隱私安全 (Local-First Privacy)**：零第三方雲端儲存、零追蹤器、支援本機 PIN 碼加密鎖定與 GitHub Gist 雙向同步。

---

## 核心功能亮點

### 1. 雙工作桌容量防爆限制 (Dual Workbench Limits)
* **今日工作桌 (Today)**：消化當天具體行動，預設小任務限額 3 件，防止大腦超載。
* **本週工作桌 (Week)**：推進本週核心專案，預設中/大任務限額 3 件。
* **卡片尺寸階梯**：試水溫 (5-10m)、小 (15-30m)、中 (1-2h)、大 (2h+)。

### 2. 底座實體抽屜系統 (Desk Drawers)
工作桌下方設有可隨時拉開檢視的 4 格抽屜：
* **收集箱 (Inbox)**：靈感沉澱池，支援多行批次快速貼上。
* **保溫夾 (Keep)**：保留追蹤但這週不急著啟動的事項。
* **放生池 (Release)**：目前評估不執行或暫停的項目，移出注意力範圍。
* **歷史檔案庫 (History)**：已完成卡片自動按週別封存歸類，永不遺失，支援復原與 Markdown 週報匯出。

### 3. 單工沉浸引擎 (Single-Tasking Immersion Engine)
* **全頁沉浸遮罩**：鎖定外部卡片互動，只專注於單一主任務。
* **呼吸態暫停 (Graceful Pause)**：專注中斷時溫和過渡，輸入接關便籤以保留思維切入點。
* **全域閃念盒 (`Ctrl+K`)**：任何時刻快速傾倒腦中突發念頭進收集箱。
* **零羞恥退場診斷**：遇阻力時溫和退場（任務過大拆解、能量告急延後、自覺退出），已投入時間完整計入分析。

### 4. 專注與工時分析儀表板 (Focus Analytics Dashboard)
位於右上角「桌上工具 ➔ 專注與工時分析」的專屬後台：
* **總覽 (Overview)**：總時數、沉浸次數、平均時長、每日工時長條圖、生理開工時段分佈。
* **意圖分佈 (Intent)**：四象限時間投資比 (Q1-Q4)、任務類型配置比例、任務尺寸分佈。
* **摩擦力診斷 (Friction)**：中斷原因結構、智能溫和回饋引導、工作記憶接關簿回顧。
* **日誌明細 (Logs)**：流水帳紀錄、單筆刪除、一鍵 CSV / JSON 完整匯出。

### 5. 艾森豪四象限矩陣與隱形死線 (Eisenhower Matrix)
* **客觀自動推估**：依據「任務尺寸 × 死線迫近程度」客觀分配象限（Q1 緊急重要、Q2 核心深耕、Q3 瑣事速辦、Q4 餘裕順手）。
* **隱形死線 (Invisible Deadlines)**：主卡片不顯示死線倒數文字，維持零焦慮工作桌面；死線僅於後台作權重加成。
* **2x2 矩陣總覽視圖**：宏觀盤點各象限任務分佈與調整排程。

### 6. 多端同步與安全防護
* **GitHub Gist 私人同步**：透過 Personal Access Token 實現無伺服器雲端雙向合併。
* **裝置代碼直傳**：免 Token 複製 Base64 代碼，跨設備即時合併。
* **本機 PIN 碼鎖定**：原生 Web Crypto SHA-256 單向雜湊，公用設備防窺。
* **Google Tasks 匯入**：支援 Google Takeout `.Tasks` / `.json` 與純文字清單解析。

### 7. 原生 Android App 與桌面小工具 (Widgets)
* 隨時於 [Releases 頁面](https://github.com/Annie04082020/TaskDesk/releases/latest) 下載 APK 安裝。
* 內建 3 款原生桌面小工具：
  * **今日任務小工具 (4x2 / 3x2)**：桌面直觀檢視今日待辦、進度與新增。
  * **當前專注小工具 (2x1)**：大字置頂顯示目前焦點任務。
  * **快速收集小工具 (2x1 / 4x1)**：桌面一鍵呼叫輸入框捕捉想法。

---

## 鍵盤快捷鍵

| 快捷鍵 | 作用範圍 | 說明 |
| :--- | :--- | :--- |
| **`Ctrl + Enter`** / **`Cmd + Enter`** | 頂部收集箱 | 快速儲存任務至收集箱 |
| **`Ctrl + K`** / **`Cmd + K`** | 全域任何畫面 | 開啟／收合 大腦雜念暫存器 (Brain Dump) |
| **`Escape`** | 全域任何畫面 | 關閉開啟中的彈窗或雜念暫存盒 |
| **`Enter`** | 雜念暫存器 | 送出雜念並自動關閉暫存盒 |

---

## 本地開發與建置

本專案採用純前端靜態架構，無繁複建置流程：

### 1. 啟動本機伺服器
```bash
# 使用 Python 內建伺服器
python -m http.server 8080

# 或使用 Node.js
npx serve .
```
開啟瀏覽器前往 `http://localhost:8080` 即可使用。

### 2. 同步靜態資源至 Android 目錄
```bash
node build.js
```

### 3. 建置 Android APK (Capacitor)
```bash
# 安裝相依套件
npm install

# 同步資源至 Android 專案
npx cap sync android

# 編譯 Debug APK
cd android
./gradlew assembleDebug
```
編譯完成的 APK 位於：`android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 電腦端專注守護擴充功能 (TaskDesk Focus Guardian Extension)

若於電腦瀏覽器（Chrome / Edge）上使用，可搭配專屬擴充功能實現**跨分頁分心攔截**與**背景精準計時**：

1. **功能亮點**：
   * **跨分頁網站攔截**：專注啟動時自動阻擋 YouTube、Bilibili、Reddit、社群媒體等干擾網站。
   * **冷靜沉浸阻擋頁**：分心開啟 YouTube 時自動切換為極簡沉浸提醒頁面，清楚標示當前進行任務，支援一鍵回桌。
   * **彈性查資料通行 (Friction Pass)**：支援 5 秒深呼吸冷卻後放行 3 分鐘，杜絕逆反反彈。
   * **背景免凍結計時**：獨立 Service Worker 執行緒與真實時間戳記差值，切換視窗寫作業工時絕不中斷漏計。
   * **工具列徽章 (Badge)**：瀏覽器圖示即時顯示專注狀態與通行剩餘時間。

2. **安裝使用方式 (開發者模式一鍵載入)**：
   * 在 Edge 網址列輸入 `edge://extensions`（或 Chrome 輸入 `chrome://extensions`）。
   * 開啟右上角的「**開發人員模式 (Developer mode)**」。
   * 點擊「**載入未封裝項目 (Load unpacked)**」，選擇專案中的 `extension/` 資料夾。
   * 開啟 TaskDesk 網頁，啟動專注即可享受完整的跨分頁防護！

---

## 資料安全性與同步架構說明

* **100% 儲存於設備本機 (Local-First)**：所有任務項目、自訂標籤、專注工時與系統設定均儲存於瀏覽器或設備本機之 `LocalStorage`。無外部第三方分析或後端伺服器，無隱私外洩疑慮。
* **本機儲存維護建議**：若執行瀏覽器的「清除網站儲存空間／Cookie」操作，可能會重設本機資料；強烈建議定期於系統設定點擊「**匯出備份 (JSON)**」留存自備檔案。
* **GitHub Gist 私人同步**：採用無中繼伺服器直連架構，Personal Access Token (Classic) 100% 僅儲存於當前設備本機 `LocalStorage`。建議建立僅具備 `gist` 最小權限之專用 Token，且不建議於公用設備保存。
* **裝置代碼直傳**：免 Token 複製字串即可在跨設備間快速對齊最新進度。同步碼為 Base64 格式編碼（非非對稱端到端加密），適用於個人信任之私人裝置間對齊傳遞。

---

## 授權條款

本專案基於 [MIT License](LICENSE) 開源授權發布。
