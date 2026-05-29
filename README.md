# Dodo Ledger 記帳服務 🐱💸

> 歡迎來到 **「Dodo Ledger」 (逗逗記帳)** —— 這是一個溫馨手繪繪本風格、由超軟萌「逗逗貓」貼心陪伴您理財的個人記帳服務。
> 
> 本專案已全面升級為 **Vite + Vue 3 + TypeScript Web App** 與 **Capacitor 混合式 Android 原生雙端發布架構**！支援免登入本地多身分隔離體驗，並能無縫升級 Firebase 雲端多人並發同步。

---

## 🎨 專案特色

### 1. 🐱 逗逗貓暖心陪伴看板
* **無 CD 互動與防抖同步**：首頁最上方是逗逗貓的生活秀，完全移除了精力與等級限制，可隨時自由無限點擊。摸摸（摸摸頭、捏肉球、揉肚子、搔下巴、順貓毛）與餵食互動均支援無 CD 連點，並實作 **1000ms 雲端同步防抖機制 (Debounce)**，在連點期間只更新本地狀態，停止連點 1 秒後才一次性寫入 Firestore，徹底保護雲端資料庫。
* **貼心智能情境陪伴**：30% 機率觸發情境陪伴對話。能自動偵測現實時間提供「早上/下午/晚上/深夜」的日常貼心問候，並在主人淨資產為負值時提供溫馨的「財務打氣與陪伴對話」。
* **成就系統與解鎖大稱讚**：解鎖成就（如摸摸大師、米其林飼養員、凌晨點擊「擾人清夢」彩蛋、10 秒連點 50 次的「⚡ 幻影無影手」隱藏彩蛋）時，逗逗貓對主人的長篇大稱讚與悄悄話，會透過自製的馬卡龍色 `Alert Dialog` 進行隆重彈出，賦予解鎖成就更高的儀式感與尊榮體驗。對話氣泡更在 CSS 層面限制最大高度並配備客製化馬卡龍風極細捲軸，防止溢出。

### 2. 📂 雙層分類、級聯編輯與拖曳自訂排序
* **智慧級聯更新 (Cascading Update)**：支援「主分類 ➜ 子分類」的雙層結構。修改或更新主分類/子分類名稱或 icon 時，歷史交易明細與週期自動記帳設定會自動在背景同步更新，確保過往帳目永不失效。
* **原地直接編輯**：使用者可以直接在主分類 Accordion header 上點擊極致對齊的 Pencil 按鈕編輯其名稱與重新選擇可愛的 emoji icon。每個子分類 pill 內部亦設有 Pencil 編輯小按鈕，點擊即可原地進入編輯輸入框，操作直觀流暢！
* **拖曳自訂排序**：主分類卡片、子分類 pill 以及「我的錢包」中的帳戶卡片均支援 **`⠿` 把手流暢拖曳自訂排序**，並完美持久化至雲端，消除排序進行中的畫面視覺抖動。

### 3. 📊 每日彙整與極致排版
* **每日彙整卡片 (預設首選)**：提供「日區塊逐項展開」與「每日彙整卡片」雙檢視模式。預設首選極簡的每日彙整卡片，將相同帳戶項目加總，點擊卡片即可原地展開原始明細，並附有編輯/刪除按鈕。
* **一體化檢視模式切換**：頂部 `page-header` 工具列整合全新一體化的 **「檢視模式🥞（Layers 圖示）」** 按鈕，點擊彈出果凍風下拉選單，並支援點擊外部自動收合，極具洗鍊專業感。
* **明細項目排版優雅化**：單筆明細項目完美繼承正圓形 42px 大 icon 與清晰字體排版，解決了以往圖示橫向拉扁的痛點。
* **剔除原生 HTML `<select>`**：編輯明細彈窗中的「支付帳戶」與「存入帳戶」下拉選單，重構為 100% 自訂的馬卡龍色果凍風下拉選單，支援精緻 Emoji 頭像與 click-outside 自動關閉。
* **乾淨備註設計**：新增記帳且沒有輸入備註時，系統不再自動填入分類名稱作為預設備註，直接留空，讓帳目更加乾淨純粹。

### 4. 💳 信用卡理財中心
* 支援「額度當下全扣，分月攤還」嚴謹分期邏輯、未出帳/已出帳單自動歸屬、結帳日繳款日管理，以及一鍵扣繳連動還款交易。信用卡繳清後，明細會自動標記亮麗的「✓ 已繳清」馬卡龍綠 jelly 標籤。

### 5. 👁️ 淨資產隱藏保護
* 首頁資產看板支援一鍵「眼睛」開關 (Eye / EyeOff)，隱藏時所有敏感帳戶餘額、資產與負債將安全顯示為 `***`，且隱藏狀態會經由 `localStorage` 自動記憶。

### 6. 🔄 雙資料存取與多本地身分隔離
* 預設免登入、免填寫金鑰，支援多個本地身分隨時切換（包含自訂名字與逗逗貓頭像，資料在 LocalStorage 中以 `userId` 為 Key 隔離分流獨立儲存），隨時可在設定中輸入 Firebase 設定一鍵備份升級至雲端多人並發同步。

### 7. 🤖 Android 原生深度打包與熱更新系統
* **📲 一鍵自動化 APK 建置**：專案根目錄內置了自癒式建置腳本 `./build-apk.sh`。此腳本具備環境自動偵測與自癒修復能力，會自動安裝與配置 JDK 17 編譯環境，完成 Web 專案打包、同步至 Android 原生 Gradle 專案，並自動產出發布用的 Release 正式版 APK 到 `build-artifacts/dodo-ledger-v{version}.apk`。
* **🔄 雙緩衝自建熱更新 (Live Updates) 引擎**：在不依賴第三方付費服務的前提下，獨立設計並實作了靜默式熱更新機制。App 在啟動時會於背景比對 GitHub Pages 上的 `version.json`，自動下載並解壓縮 `app-update.zip` 至沙盒目錄，並在使用者下一次啟動時無感套用，且具備斷網時的優雅降級保護與 Zip Slip 路徑穿越安全防護。
* **🔏 SharedPreferences 原生安全鎖**：利用 Capacitor 提供的持久化機制，實現了 SharedPreferences 等級的 App 密碼解鎖狀態儲存。App 滑掉重開免重複輸入密碼；手動鎖定或於設定頁變更密碼時立即安全重設。
* **🔔 逗逗貓本地通知系統**：整合原生 `@capacitor/local-notifications` 機制。當 App 於背景或重啟後，補記自動扣款週期帳務成功時，會發送系統層的原生本地通知（🐱 逗逗貓理財報告），兼顧行動端的使用者互動。
* **📱 App 內原生覆蓋安裝更新**：原生平台下，`Settings.vue` 顯示「📱 原生 Android 系統更新」卡片。它會遍歷 GitHub Releases 列表，尋找第一個含 `.apk` 附件的 Release（避開純 Web 更新），透過 `Filesystem.downloadFile()` 下載至 Cache 目錄，再調用 `MainActivity.java` 註冊的 `DodoInstaller.installApk({ filePath })` 進行覆蓋安裝，安全使用 FileProvider 原生權限。

---

## 🚀 快速開始

為了簡化您的開發操作，我們提供了**一鍵自動化指令與腳本**：

### 1. 本地啟動與開發重啟
您不需要手動輸入繁瑣的 `npm run dev`，我們提供了一鍵啟動腳本 `./run.sh`。此腳本會自動為您安裝相依性套件（如果未安裝），並啟動/重啟 Vite 本地伺服器：
```bash
# 啟動或重啟開發環境
./run.sh
```

### 2. 🤖 本地建置 APK
您只需在專案根目錄下執行：
```bash
# 自動化安裝環境、同步並建置 Android APK
./build-apk.sh
```
建置完成後，產出的 APK 會自動根據版本命名並存放在：
👉 **`build-artifacts/dodo-ledger-v{version}.apk`**

### 3. 本地手動網頁部署
如果您需要手動將目前的成果打包並部署到 GitHub Pages，可以直接執行：
```bash
# 執行自動測試、建置並發布網頁端
./deploy.sh
```

### 4. 🔑 安全部署與金鑰準備工具
在發布到 GitHub Pages 前，如果您需要設定全域解鎖密碼、產出本地設定、或者在密碼變更或金鑰缺失時自動備份重建 `dodo-shared.keystore`，可以使用極速準備腳本：
```bash
# 直接於根目錄執行，免去手動設定
./prepare-deploy
```

### 5. 📊 雲端日誌財務稽核
如果您啟用了雲端多人共同記帳，可以在 Terminal 中直接拉取最新近期的財務異動與身分操作稽核：
```bash
# 直接於根目錄執行，連線並印出精美日誌表格
./view-logs
```

---

## 🧪 自動化測試與 CI/CD

本專案採用 **Vitest** 作為測試引擎，核心的轉帳手續費折算、信用卡分期分攤算法皆有完整測試覆蓋。

* **執行測試**：`npm run test`
* **執行測試並產生報告**：`npm run test:run`

當您將專案推送至 GitHub 時，將自動觸發**雙軌 CI/CD 管線**：
* **Web 端自動部署管線** (`.github/workflows/deploy.yml`)：觸發條件為網頁端代碼變更。執行流程為 `TS 編譯檢查` ➔ `Vitest 測試` ➔ `Vite 編譯建置` ➔ `自動部署至 gh-pages 分支`。如果測試未通過，將自動攔截發布，確保 GitHub Pages 線上版本永遠健康無 Bug！
* **Android 原生發版管線** (`.github/workflows/android.yml`)：觸發條件為 `android-version.json` 變更。執行流程為讀取版號 ➔ 使用 `dodo-shared.keystore` 簽名 ➔ 自動編譯發布 Release APK 並標記 version tag 與 `latest` 標籤於 GitHub Releases。

---

## 📂 目錄結構

```text
├── .github/workflows/     # GitHub Actions CI/CD 設定 (含自動化 Web 與 Android APK 雙管線)
├── android/               # Capacitor 生成之 Android 原生 Gradle 專案
├── build-artifacts/       # APK 建置產物輸出目錄
├── scripts/               # 專案準備與構建自動化腳本
├── src/
│   ├── assets/            # 靜態資源 (馬卡龍配色插畫、Dodo 圖標等)
│   ├── components/        # UI 元件 (DodoCat, Dashboard, CreditCardCenter 等)
│   ├── composables/       # 全域狀態管理與業務邏輯 (含 useLedger.ts、useLiveUpdates.ts 等)
│   ├── services/          # 資料存取層 (db.ts，LocalStorage 與 Firebase 雙核心)
│   ├── types/             # TypeScript 類型定義
│   ├── App.vue            # 主頁面與 Tab 導航
│   ├── index.css          # 設計系統、馬卡龍色票與 QQ 果凍動畫樣式
│   └── main.ts            # 專案入口
├── tests/                 # Vitest 自動化測試檔案 (100% 通過)
├── android-version.json   # Android 原生版本號唯一管理來源
├── build-apk.sh           # Android APK 一鍵打包自癒建置腳本
├── run.sh                 # 一鍵啟動/重啟腳本
├── deploy.sh              # 一鍵打包部署腳本
├── view-logs              # 雲端日誌財務稽核拉取工具
├── SPEC.md                # 系統規格與演算法定義文件
├── SPEC_ANDROID.md        # Android 行動端專屬規格與熱更新機制文件
├── SPEC_CONFLICT_RESOLUTION.md # 多人並發衝突解決策略規格書
├── GEMINI.md              # AI 協同開發手冊
└── CHANGELOG.md           # 版本變更日誌
```
