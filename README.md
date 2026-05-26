# Dodo Ledger 記帳服務 🐱💸

> 歡迎來到「Dodo Ledger」—— 這是一個溫馨插畫繪本風格、由超軟萌「逗逗貓」陪伴您記帳的個人理財服務。
> 第一版透過 Vite + Vue 3 + TypeScript 打造，支援免登入本地體驗，並能無縫升級 Firebase 雲端同步，保留後續移植 Android App 的完美彈性！

---

## 🎨 專案特色

1. **🐱 逗逗貓療癒看板**：首頁最上方是逗逗貓的大版面生活秀，貓咪會隨著您的預算消耗程度改變表情（玩毛線、流汗、貓爪遮眼哭哭），還會在自動週期扣款時伸懶腰喵喵叫報告！
2. **🧮 QQ 果凍計算機鍵盤**：胖乎乎的大按鈕自訂虛擬鍵盤，支援邊記邊算，點擊時更有果凍般的 QQ 彈性縮放反饋。
3. **📂 嚴謹雙層分類**：支援「主分類 ➜ 子分類」的雙層分類結構（如：餐飲 ➜ 早餐/午餐），滿足對帳務細緻度要求極高的您。
4. **💳 信用卡完整生命週期**：支援「額度當下全扣，分月攤還」嚴謹分期邏輯、未出帳/已出帳單自動歸屬、結帳日繳款日管理，以及一鍵扣繳連動還款交易。
5. **🔄 雙資料存取模式**：預設免登入、免填寫金鑰，直接在 LocalStorage 體驗完整功能，逗逗貓貼身相伴；隨時可在設定中輸入 Firebase 設定一鍵備份升級至雲端。
6. **🛡️ 業界級 DevOps 機制**：內建 Vitest 單元測試，配置 GitHub Actions CI/CD，發布到 GitHub Pages 前會進行 100% 自動化測試與 TypeScript 編譯驗證。

---

## 🚀 快速開始

為了簡化您的開發操作，我們提供了**一鍵自動化腳本**：

### 1. 本地啟動與開發重啟
您不需要手動輸入繁瑣的 `npm run dev`，我們提供了一鍵啟動腳本 `./run.sh`。
此腳本會自動為您安裝相依性套件（如果未安裝），並啟動/重啟 Vite 本地伺服器：
```bash
# 啟動或重啟開發環境
./run.sh
```

### 2. 本地手動部署
如果您需要手動將目前的成果打包並部署到 GitHub Pages，可以直接執行：
```bash
# 執行自動測試、建置並發布
./deploy.sh
```

### 3. 🔑 安全部署設定工具
在發布到 GitHub Pages 前，如果您需要設定全域解鎖密碼、產出本地設定，可以使用極速準備腳本：
```bash
# 直接於根目錄執行，免去 npm run
./prepare-deploy
```

### 4. 📊 雲端日誌財務稽核
如果您啟用了雲端多人共同記帳，可以在 Terminal 中直接拉取最新近期的財務異動與身分操作稽核：
```bash
# 直接於根目錄執行，連線並印出精美日誌表格
./view-logs
```

---

## 🧪 自動化測試與 CI/CD

本專案採用 **Vitest** 作為測試引擎，核心的轉帳手續費折算、信用卡分期分攤算法皆有完整測試覆蓋。

- **執行測試**：`npm run test`
- **執行測試並產生報告**：`npm run test:run`

當您將專案推送至 GitHub 時，`.github/workflows/deploy.yml` 工作流會自動觸發：
`TS 編譯檢查` ➔ `Vitest 測試` ➔ `Vite 編譯建置` ➔ `自動部署至 gh-pages 分支`。如果測試未通過，將自動攔截發布，確保 GitHub Pages 線上版本永遠健康無 Bug！

---

## 📂 目錄結構

```text
├── .github/workflows/   # GitHub Actions CI/CD 設定
├── src/
│   ├── assets/          # 靜態資源 (馬卡龍配色插畫等)
│   ├── components/      # UI 元件 (DodoCat, Dashboard, CreditCardCenter)
│   ├── composables/     # 全域狀態管理 (useLedger.ts 核心業務邏輯)
│   ├── services/        # 資料存取層 (db.ts，LocalStorage 與 Firebase 雙核心)
│   ├── types/           # TypeScript 類型定義
│   ├── App.vue          # 主頁面與 Tab 導航
│   ├── index.css        # 設計系統與 QQ 果凍動畫樣式
│   └── main.ts          # 專案入口
├── tests/               # Vitest 自動化測試檔案
├── run.sh               # 一鍵啟動/重啟腳本
├── deploy.sh            # 一鍵打包部署腳本
├── SPEC.md              # 系統規格與演算法定義文件
├── GEMINI.md            # AI 協同開發手冊
└── CHANGELOG.md         # 版本變更日誌
```

---

## 📱 Android 原生打包與熱更新系統 🚀

本專案已正式整合 **Capacitor 混合式一鍵打包與原生整合架構**。不只是一般的網頁包殼，我們更深度實作了以下行動端專屬的核心特色：

1. **📲 一鍵自動化 APK 建置**：
   專案根目錄內置了自癒式建置腳本 `./build-apk.sh`。此腳本具備環境自動偵測與自癒修復能力，會自動安裝與配置 JDK 17 編譯環境，完成 Web 專案打包、同步至 Android 專案，並自動產出發布用的 Release 正式版 APK 到 `build-artifacts/dodo-ledger-release.apk`。
2. **🔄 雙緩衝自建熱更新 (Live Updates) 引擎**：
   在不依賴第三方付費服務（如 Appflow）的前提下，獨立設計並實作了靜默式熱更新機制。App 在啟動時會於背景比對 GitHub Pages 上的 `version.json`，自動下載並解壓縮 `app-update.zip` 至沙盒目錄，並在使用者下一次啟動時無感套用，且具備斷網時的優雅降級保護。
3. **🔏 SharedPreferences 安全鎖持久化**：
   基於行動裝置操作體驗，利用 `Capacitor` 提供的持久化機制，實現了 SharedPreferences 等級的 App 密碼解鎖狀態儲存。App 滑掉重開免重複輸入密碼；手動鎖定或於設定頁變更密碼時立即安全重設。
4. **🔔 逗逗貓本地通知系統**：
   整合原生 `@capacitor/local-notifications` 機制。當 App 於背景或重啟後，補記自動扣款週期帳務成功時，會發送系統層的原生本地通知（🐱 逗逗貓理財報告），兼顧行動端的使用者互動。

### 🤖 如何在本地建置 APK？
您只需在專案根目錄下執行：
```bash
# 自動化安裝環境、同步並建置 APK
./build-apk.sh
```
建置完成後，產出的 APK 會自動命名並存放在：
👉 **`build-artifacts/dodo-ledger-release.apk`**

---

## 📂 目錄結構

```text
├── .github/workflows/   # GitHub Actions CI/CD 設定 (含自動化 Web 與 Android APK 管線)
├── android/             # Capacitor 生成之 Android 原生 Gradle 專案
├── build-artifacts/     # APK 建置產物輸出目錄
├── src/
│   ├── assets/          # 靜態資源 (馬卡龍配色插畫等)
│   ├── components/      # UI 元件 (DodoCat, Dashboard, CreditCardCenter)
│   ├── composables/     # 全域狀態管理與業務邏輯 (含 useLiveUpdates.ts 熱更新模組)
│   ├── services/        # 資料存取層 (db.ts，LocalStorage 與 Firebase 雙核心)
│   ├── types/           # TypeScript 類型定義
│   ├── App.vue          # 主頁面與 Tab 導航
│   ├── index.css        # 設計系統與 QQ 果凍動畫樣式
│   └── main.ts          # 專案入口
├── tests/               # Vitest 自動化測試檔案 (100% 通過)
├── build-apk.sh         # Android APK 一鍵打包自癒建置腳本
├── run.sh               # 一鍵啟動/重啟腳本
├── deploy.sh            # 一鍵打包部署腳本
├── SPEC.md              # 系統規格與演算法定義文件
├── SPEC_ANDROID.md      # Android 行動端專屬規格與熱更新機制文件
├── GEMINI.md            # AI 協同開發手冊
└── CHANGELOG.md         # 版本變更日誌
```
