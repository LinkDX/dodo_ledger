# Dodo Ledger —— AI 協同開發手冊 (GEMINI)

本手冊專為 Gemini 系列模型（如 Antigravity 助理）或任何其他大型語言模型 (LLM) 設計，記錄了 Dodo Ledger 專案的開發設計共識與脈絡，以便在後續的功能擴展、Android 原生整合、圖示更新或 CI/CD 維護中，維持完全一致的程式風格與品質。

---

> [!CAUTION]
> ## ⚠️ 每次 `npm install` 後的強制必做事項
>
> 本專案的開發環境使用私有 npm registry（`npm.synology.inc`），**每次執行 `npm install` 或安裝新套件後，`package-lock.json` 都會被自動污染為私有 registry 網址**。
> 若直接 push 到 GitHub，GitHub Actions 將因 `ENOTFOUND npm.synology.inc` 錯誤而立即失敗。
>
> **每次 commit 前，必須先執行下列指令修正：**
> ```bash
> sed -i 's|https://npm.synology.inc|https://registry.npmjs.org|g' package-lock.json
> ```
> 驗證方法：執行完畢後，確認下方指令輸出為 `0`，代表已完全清乾淨：
> ```bash
> grep -c "synology" package-lock.json
> ```

---

## 1. 專案開發風格共識

當您（AI 助理）為本專案新增或修改程式碼時，請務必遵循以下規範：

### 1.1 Vue 3 程式風格
- **Composition API**：一律使用 `<script setup lang="ts">` 語法糖。
- **類型宣告**：嚴格使用 TypeScript，並在 `src/types/index.ts` 中定義完整的業務介面。
- **狀態管理**：全域狀態一律透過 `src/composables/useLedger.ts` 管理。元件內使用解構賦值獲取需要的響應式資料與方法：
  ```typescript
  import { useLedger } from '@/composables/useLedger'
  const { accounts, transactions, addTransaction } = useLedger()
  ```

### 1.2 樣式與動畫設計規範
- **CSS 隔離**：一律使用 SFC 的 `<style scoped>` 撰寫元件樣式。
- **設計系統變數**：在 `src/index.css` 定義了馬卡龍配色系統與圓角規格。請一律使用 `var(--color-...)` 形式，禁止硬編碼 (Hardcode) 顏色：
  - 背景色：`var(--color-bg-warm)`（`#FFF8EC` 奶油黃）
  - 支出/粉紅：`var(--color-expense)`
  - 收入/薄荷綠：`var(--color-income)`
  - 轉帳/科技藍：`var(--color-transfer)`
  - 文字/深灰褐：`var(--color-text-dark)`
- **QQ 果凍效果動畫**：
  在需要點擊反饋的按鈕或卡片上，請套用果凍彈性動畫類別 `.btn-jelly` 或以下 CSS：
  ```css
  .btn-jelly:active {
    transform: scale(0.92);
    transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  ```

### 1.3 逗逗貓 (Dodo Cat) SVG 渲染規範
- 逗逗貓吉祥物實作於 `src/components/DodoCat.vue`。
- 其表情是透過 Vue 的 `computed` 屬性動態切換 SVG 內部路徑（例如眼睛的彎度、耳朵的傾斜度、嘴巴的形狀，或直接變換整張貓咪 SVG）。
- 當新增貓咪表情時，請遵循**「用簡單乾淨的扁平 SVG 線條」**來繪製，並加上 CSS `.cat-wiggle` 以提供貓咪慵懶擺尾的呼吸微動畫。

### 1.4 品牌圖示規範（App Icon / Favicon）
- **主要品牌圖示**（完整版）：`public/dodo-icon.svg` — 逗逗貓抱著薄荷綠錢包、配戴薰衣草領圈的全身插畫版，奶油黃圓角背景。
- **瀏覽器 Favicon**：`public/favicon.svg` — 32x32 精簡臉部版，保留關鍵特徵（大眼、腮紅、錢包），小尺寸仍可辨識。
- **圖示調色板（固定，勿任意更改）**：
  - 背景：`#FFF8EC`（奶油黃）
  - 貓身/臉：`#FDF6EE`（乳白）
  - 耳內/腮紅：`#F9C4C4`（粉桃）
  - 錢包：`#A8E6CF`（薄荷綠）
  - 扣環/裝飾：`#F4C842`（奶油黃金）
  - 領圈：`#C3B1E1`（薰衣草）
  - 輪廓線：`#3D2B1F`（深灰褐）
- **圖示重新生成**：若需更新圖示，修改 `public/dodo-icon.svg` 後，執行 `npm run generate:icons` 自動重新產出所有 Android 密度的 mipmap PNG，無需手動逐一處理：
  ```bash
  npm run generate:icons
  # 自動輸出至 android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
  ```
- **Splash Screen 重新生成**：若需更新啟動畫面，執行 `npm run generate:splash`，自動依照各 drawable 資料夾的解析度規格批次輸出：
  ```bash
  npm run generate:splash
  # 自動輸出至 android/app/src/main/res/drawable-{port,land}-{mdpi,hdpi,...}/
  ```

### 1.5 功能變更文件同步規範
- **文件即時更新**：每次進行核心邏輯優化、介面改版或新功能開發等變更時，**務必同步更新與維護專案相關文件**（包括 `CHANGELOG.md`、`SPEC.md` 以及本協同開發手冊 `GEMINI.md` 等），確保後續與 AI 元件協同開發時能維持最高度的專案脈絡一致性。

### 1.6 禁止使用原生 UI 元件原則
- **手製高度統一風格元件**：為了本專案獨特的手繪、馬卡龍配色與 Q 彈果凍（Jelly）動畫的美學統一性，**禁止使用任何瀏覽器原生 UI 元件（包含但不限於原生下拉選單 select、alert 提示框、confirm 確認窗等）**。所有基礎 UI 元件皆必須使用 SFC（Vue 單檔案元件）搭配 CSS 果凍特效與馬卡龍調色板自行實作。

---

## 2. Android 行動端整合架構（已正式實作）

> ⚠️ **重要更新**：本專案已完成 Android 移植，**不再只是「未來展望」**。以下為已上線的實際架構，維護與擴展時請嚴格遵循。

### 2.1 Capacitor 混合式打包架構
- **套件名稱**：`com.luke.dodoleddger`
- **Capacitor 設定檔**：`capacitor.config.ts`
- **原生 Android 專案**：`android/`（由 Capacitor 生成與管理）
- **一鍵自愈打包腳本**：`./build-apk.sh` — 自動偵測並安裝 JDK 17、同步資源、編譯 Release APK
- **產物輸出**：`build-artifacts/dodo-ledger-v{版號}.apk` 與 `build-artifacts/dodo-ledger-latest.apk`

### 2.2 Android 版號管理規範（與 Web 脫鉤）
- **唯一版本定義來源**：`android-version.json`（不得改動 `package.json` 來管控 Android 版本）
  ```json
  { "version": "1.0.0", "buildNumber": 1 }
  ```
- **Gradle 動態對接**：`android/app/build.gradle` 在編譯時自動解析此檔案，同步 APK 內部的 `versionName` 與 `versionCode`。
- **發布流程**：只需修改 `android-version.json` 並 push → GitHub Actions 自動觸發編譯，同時發布：
  - `android-vX.Y.Z` Release Tag（保存歷史記錄）
  - `latest` Release Tag（永遠指向最新版，固定下載連結）

### 2.3 離線優先與雙向同步架構
- **IndexedDB 離線快取**：`src/services/db.ts` 在未連網時自動啟用 Firestore 本地快取，離線記帳零延遲，上線後自動雙向同步。
- **Last-Write-Wins 衝突解決**：所有交易均帶 `updatedAt` 毫秒時間戳記與防衝突隨機 ID，保障多裝置同步的資料一致性。
- **SharedPreferences 解鎖持久化**：`src/composables/useAppLock.ts` — App 滑掉重開免重複解鎖；手動鎖定或更改密碼時立即重設。

### 2.4 自建熱更新 (Live Updates) 引擎
- **實作位置**：`src/composables/useLiveUpdates.ts`，並於 `src/App.vue` 的 `onMounted` 中整合觸發。
- **工作原理**：每次 App 啟動時，背景向當前專案遠端 `https://linkdx.github.io/dodo_ledger/version.json` 對帳比對版本。若發現新版，則默默在背景下載 `app-update.zip` 寫入沙盒，並同時產生 `current_hot_version.txt` 版本信箱指標。
- **原生極速解壓縮與重定向**：下一次 App 啟動（冷啟動）時，原生 Android 端 (`MainActivity.java`) 會在啟動第一時間讀取該指標，並使用 Java 原生 `ZipInputStream` 進行 **20ms 極速原生解壓縮**，解壓完畢自動掃除 ZIP 原始檔以節省硬碟空間，隨後動態執行 `this.bridge.setServerUrl()` 將 WebView 重新導向至沙盒 `index.html`，實現完美的無感熱更新閉環。
- **資安合規防禦**：原生解壓縮代碼中內建了 **「防範 Zip Slip 漏洞路徑穿越攻擊」** 的安全過濾機制，100% 阻斷非法跨目錄寫入，確保金融級系統底座安全性。
- **離線降級**：斷網或伺服器異常時自動跳過更新檢查，秒進 App 載入本地最新加載成功的沙盒版本或預置 bundled 資源，絕不影響任何既有功能。
- **不依賴付費服務**：完全自建，無需 Appflow 或 Capgo 等第三方訂閱。

### 2.5 本地通知規範
- **插件**：`@capacitor/local-notifications`
- **觸發時機**：App 重啟後，補記週期自動扣款成功時，發送系統層原生通知。
- **注意事項**：一律使用動態 `import()` 引入 Capacitor 插件，確保 Web 端瀏覽器相容性：
  ```typescript
  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.schedule({ ... })
  })
  ```

### 2.6 Android 移植 LLM Prompt 模組

若需進行更深度的原生化移植（如改寫為 Kotlin / Jetpack Compose），可使用以下 Prompt：

> **介面與資料層移植 Prompt：**
> ```markdown
> 你現在是高階 Android 專家。我們正在將一個名為 "Dodo Ledger" 的 Vue 3 記帳服務移植到 Android 原生系統。
> 請參考 Vue 3 的狀態管理 Composable `src/composables/useLedger.ts` 以及系統規格 `SPEC.md`。
>
> 請執行以下任務：
> 1. 用 Kotlin 建立對應的 Firestore Data Class，並使用 Firebase Android SDK。
> 2. 建立一個 Android Repository 模式的 `LedgerRepository`，實作「IndexedDB 快取 + Firestore 雙向同步」的雙儲存層架構。
> 3. 特別注意：用 Kotlin 實作 SPEC.md 中規定的「信用卡額度當下全扣，分月攤還」以及「轉帳手續費獨立支出化」演算法。
> ```

> **UI 樣式與動畫移植 Prompt：**
> ```markdown
> 你現在是 Android UI 設計專家。請參考 Dodo Ledger 的 `src/index.css`、`DodoCat.vue`，以及 `public/dodo-icon.svg`（品牌圖示設計規範）。
>
> 請執行以下任務：
> 1. 在 Android 中，將 CSS 變數定義的馬卡龍色系（奶油黃 #FFF8EC、粉桃紅 #F9C4C4、薄荷綠 #A8E6CF）轉換為 Jetpack Compose 的 `Color.kt` 與 `Theme.kt`。
> 2. 使用 Compose 的 `Animatable` 與 `Spring` 彈簧物理動畫，重現 Web 端的「QQ 果凍按鈕點擊反饋（Jelly Effect）」。
> 3. 用 Compose `Canvas` 或 `Image` 配合 Lottie，重現逗逗貓在不同預算比例（玩毛線、流汗、遮眼哭哭）下的動態表情與泡泡對話框。
> ```

---

## 3. 自動化測試與 CI/CD 保護網

為了確保專案長期維護的健康度：
- **測試**：每次修改核心帳務計算、分期或轉帳邏輯時，必須執行 `npm run test:run`。
- **CI 提交**：在提交代碼前，請確認已通過 TypeScript 編譯檢查與 Vitest 自動化測試。這在 GitHub Actions 中有強制檢驗，若未通過將無法成功部署至 GitHub Pages。
- **更新 CHANGELOG**：每次完成新功能交付，請隨手在 `CHANGELOG.md` 中留下簡短的版本紀錄。

### 3.1 CI/CD 雙管線架構（Web 與 Android 分流）

| 管線 | 設定檔 | 觸發條件 | 產物 |
|---|---|---|---|
| Web 部署 | `.github/workflows/deploy.yml` | `src/**`、`public/**`、`index.html`、`package.json`、`package-lock.json` | GitHub Pages |
| Android 建置 | `.github/workflows/android.yml` | `android-version.json`、`android/**`、`build-apk.sh`、`capacitor.config.ts` | Release APK（帶版號 Tag + latest） |

> [!IMPORTANT]
> **兩條管線完全獨立**：修改網頁端代碼不會觸發 Android 編譯；發布新 Android 版本只需修改 `android-version.json`，不影響網頁 CI。

### 3.2 財務日誌與核心安全稽核共識
- **日誌過濾原則**：**絕不在 `SystemLog` 中記錄娛樂性質的操作（如摸貓、餵貓等）**。日誌應專注於核心財務與成員變更，以確保對帳與稽核資料的純粹性與高效性。
- **日誌寫入時機**：務必在所有核心財務操作的 Vue Composable 方法中（記帳、刪除、還款、週期性自動執行）與身分管理（新增、刪除身分、預算變更、記帳分類變更）中，第一時間呼叫 `addSystemLog`。
- **CLI 稽核運行**：稽核日誌工具 `./view-logs` 採用輕量化的 Firestore REST API，免去了在終端機安裝龐大 Firebase SDK 的複雜度。後續維護或移植時，請保持此 RESTful 高效連線設計，避免引入不必要的 Node 相依性套件。

### 3.3 package-lock.json 官方 Registry 規範（強制事項）

> [!CAUTION]
> 這是本專案最頻繁發生的 CI 失敗原因。**每次安裝新 npm 套件後都必須執行修正。**

- **根本原因**：開發機環境設定了私有 npm registry（`npm.synology.inc`），每次 `npm install` 都會將新套件的下載路徑寫入 `package-lock.json` 為私有網址。GitHub Actions Runner 無法連線此私有位址，導致 `ENOTFOUND` 錯誤。
- **觸發情境**：以下任一操作都會污染 `package-lock.json`：
  - `npm install`（更新所有相依套件）
  - `npm install <package>`（安裝單一新套件，如 `sharp`、`@capacitor/xxx`）
  - `npm install -g <package>`（全域安裝後影響 lock 結構）
- **修正指令**：每次 commit 前，**必須執行**：
  ```bash
  sed -i 's|https://npm.synology.inc|https://registry.npmjs.org|g' package-lock.json
  ```
- **驗證指令**：確認輸出為 `0` 代表已清乾淨：
  ```bash
  grep -c "synology" package-lock.json
  ```
- **建議工作流程**：
  ```bash
  npm install <new-package> --legacy-peer-deps
  sed -i 's|https://npm.synology.inc|https://registry.npmjs.org|g' package-lock.json
  git add package.json package-lock.json
  git commit -m "chore: 安裝 <new-package> 並修正 registry"
  ```
