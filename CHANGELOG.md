# Dodo Ledger 記帳服務 —— 版本變更日誌 (CHANGELOG)

本專案遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html) 規範，詳細記錄各個版本的更新明細。

## [Web 1.9.6] - 2026-05-27

### 📡 熱更新監控閣優化 (Hot Update Improvements)
- **修正更新卡住問題**：啟用 `CapacitorHttp` 插件，透過原生管道下載更新包，徹底繞過 Android WebView 的 CORS 限制與重新導向問題。
- **強化錯誤診斷**：新增 `updateError` 狀態與 UI 顯示，讓使用者能清楚看見下載失敗的原因（如 HTTP 404 或網路超時）。
- **異常自愈機制**：下載失敗時會自動重設進度條，不再永久卡在 10%。
- **新增維護功能**：於監控閣新增「🧹 清除熱更新快取」按鈕，方便一鍵重置回 APK 內建版本以解決損壞問題。
- **程式碼健壯性**：優化 `useLiveUpdates` 的異常捕獲邏輯，加入更多詳細的 `[LiveUpdate]` 除錯日誌。

## [Web 1.9.5] - 2026-05-27

### 🐱 逗逗貓互動與成就系統 (Dodo Cat Game System)
- **全新精力值機制**：新增精力值 (Energy) 限制與自然恢復邏輯，防止洗成就並增加儀式感。
- **成長與經驗值系統**：新增等級 (Level) 與 XP 系統，等級提升可增加精力上限。
- **成就判定引擎**：實作「公開成就」與「隱藏彩蛋」判定（如：摸摸大師、破產求生等）。
- **記帳連動獎勵**：新增交易可恢復貓咪精力並獲得高額 XP，將記帳行為與養成遊戲深度結合。
- **User 獨立狀態**：確保每位使用者擁有獨立的貓咪親密度與成就，即使在共同記帳模式下亦然。
- **技術文件同步**：新增 `SPEC_CAT_SYSTEM.md` 詳細定義系統邏輯與平衡性參數。

## [Android 1.0.2 / Build 3] - 2026-05-27

### 🔑 換鑰強制重裝版（簽名金鑰安全隔離）

> ⚠️ **此版本更換了 APK 簽名金鑰，請先完整解除安裝舊版，再安裝此版本。** 此後所有後續版本皆以同一把共享金鑰持續簽名，可直接覆蓋安裝，不再需要重裝。

### Fixed
- **Android 金鑰密碼同步修復**：修正 `scripts/prepare-deploy.cjs` 缺少密碼變更偵測的問題，現在變更密碼後會自動備份舊金鑰並重新產生 `dodo-shared.keystore`。
- **變數名稱統一化**：全面將金鑰與儲存庫密碼變數統一為 `DODO_SIGNING_PASSWORD` (env) 與 `dodo.signing.password` (properties)，符合 `SPEC_ANDROID.md` 規範。
- **配置合併邏輯優化**：修復 `.env.local` 會被完整覆蓋的問題，改為智慧合併現有配置，避免遺失 Firebase 等手動設定變數。

- **更換共享簽名金鑰**：重新產生了 `android/app/dodo-shared.keystore`，確保本地開發、CI/CD 管線與所有未來版本皆使用同一把金鑰，徹底解決新舊 APK 因金鑰衝突導致「無法覆蓋安裝」的問題。
- **簽名密碼與進入密碼統一**：新金鑰的解鎖密碼已與 App 進入鎖定密碼設定為一致，透過 `npm run prepare` 互動式設定流程自動完成，密碼完全不寫入程式碼。
- **網頁功能同步自 Web 1.9.4**：熱更新引擎閉環、滾動容器 Padding 修復、更換頭像 Dialog 模態彈窗等功能同步搭載。

---

## [Web 1.9.4 / Android 1.0.1] - 2026-05-27


### 📡 究極自建熱更新引擎閉環與介面美化

- **補齊自建熱更新引擎後半段 (Android 原生 Java 閉環)**：
  - **版本信箱傳遞**：在 `useLiveUpdates.ts` 內下載熱更新包成功後，新增自動寫入 `current_hot_version.txt` 版本指標文字檔的邏輯，作為前端與原生的通訊信道。
  - **原生極速解壓縮**：在原生 Android `MainActivity.java` 中補齊了未完工的熱更新重定向與解壓模組。在啟動時自動讀取版本指標，如果發現新版 ZIP 原始包，會調用 Java 底層 `ZipInputStream` 進行**閃電解壓縮（解壓 dist 僅需 20 毫秒）**，解壓完畢自動刪除 ZIP 包。
  - **資安合規保護**：原生 Java 解壓核心中內建了 **「防範 Zip Slip 漏洞路徑穿越攻擊」** 的安全校驗，防止惡意 ZIP 包穿越複寫系統重要檔案，保障金庫最高防護。
  - **WebView 實時重定向**：解壓縮完備後，自動執行 `this.bridge.setServerUrl()` 動態將 WebView 指向沙盒目錄底下的 `index.html`，真正達成了「Web 更新，Android 自動更新」的極致離線優先閉環！
  - **域名大修正**：將 App 熱更新向遠端連線獲取 `version.json` 的域名從 luke.github.io 修正為當前新專案 Repo 的 **linkdx.github.io**，徹底打通更新源。
- **自建熱更新狀態實時監控閣 (Live Updates Console)**：
  - 於 `Settings.vue` 的進階管理員面板（神秘彩蛋）最上方，獨家整合了 **「📡 逗逗貓自建熱更新監控閣」**。
  - 實時展示當前加載平台（Web/Android 沙盒）、本地熱更新版號（Code）、伺服器連線狀態，以及**背景默默下載時的實時進度百分比（如 80%）與薄荷綠進度條**！
  - 提供 Q 彈的 `🐾 手動檢查並下載更新` 按鈕，點擊立刻對帳下載，下載完成高亮提示重啟 App，徹底終結更新進度的黑盒體驗！
- **滾動容器 Padding 優化與防切邊修復**：
  - 修正了 `AccountPicker.vue` 中的 `.picker-scroll` 滾動區域以及 `TransactionForm.vue` 中的 `.main-categories-list` 滾動區域的 padding 定義，增設了適度的 `padding-top` 和水平 padding。
  - 完美容納了帳戶卡片與分類按鈕在 hover 選取或 active 物理彈跳時的向上位移，**100% 解決了 hover 彈起時頂部與左右邊緣被橫向滾動容器（overflow）硬生生切掉的缺陷**。
- **更換頭像面板 Dialog 模態彈窗化**：
  - 重構 `Settings.vue` 設定畫面的頭像更換區，移除大面積展開的頭像 emoji 選取列表，改為簡潔清爽的單行頭像顯示與 Q 彈的 `🐾 選擇新頭像` 按鈕。
  - 點擊按鈕後彈出精緻手製的模態對話框（Modal Dialog），採用磨砂玻璃背景與馬卡龍邊框，選定後自動更新並靜默關閉，視覺體驗極為高級。
- **CI/CD 工作流 Web 自動 Release 升級**：
  - 升級了 `.github/workflows/deploy.yml` 部署管線，在每次推送發布網頁端時，自動將 `dist/` 網頁檔壓縮成 `app-update.zip`，並根據 `package.json` 的版號**以演算法自動換算為唯一整數 `versionCode`**（如 `1.9.4` 對應 `10904`）。
  - 自動生成最新的 `version.json` 寫入 `dist/` Pages 目錄，並**自動建立名為 `web-v*` 的 GitHub Release，將 `app-update.zip` 作為 Release Asset 上傳**，實現了超高速 GitHub CDN 下載分流。
- **🔒 Android APK 簽名金鑰安全隔離與互動式密碼一致性方案**：
  - **共享簽名金鑰納入 Git 版控**：建立 `android/app/dodo-shared.keystore` 並 commit 至 Repo，確保本地與 CI/CD 管線使用同一把金鑰，從根本解決新舊 APK 簽名衝突導致的「無法覆蓋安裝」問題。
  - **密碼完全從程式碼抽離**：修改 `android/app/build.gradle` 的 `signingConfigs.shared`，完全移除所有硬編碼密碼，改為優先讀取系統環境變數（`DODO_STORE_PASSWORD`/`DODO_KEY_PASSWORD`），其次讀取 Git 排除的 `android/local.properties`。
  - **新增 `npm run prepare` 生命週期自癒腳本** (`scripts/prepare.cjs`)：每次 `npm install` 後自動執行，功能包含：
    1. **互動式密碼設定**（本地 TTY 環境）：詢問 App 進入密碼，同時作為 Android 金鑰密碼，計算 SHA-256 Hash 寫入 `.env.local`，明文密碼同步寫入 `android/local.properties`。
    2. **金鑰自動備份與重新產生**：偵測到密碼變更或金鑰缺失時，自動備份舊金鑰並用新密碼重新產生 `dodo-shared.keystore`。
    3. **`package-lock.json` 自動自癒**：自動掃描並將私有 registry `npm.synology.inc` 替換為官方 `registry.npmjs.org`，杜絕 CI/CD 因私有網址而失敗。
  - **CI/CD 單一 Secret 設計**：將 `android.yml` 的 Gradle 編譯步驟統一為單一 `DODO_SIGNING_PASSWORD` secret，同時注入 store/key 兩個密碼，GitHub Secrets 設定極簡化。
  - **`npm run prepare-deploy` 同步修正**：顯示的 `DODO_SIGNING_PASSWORD` 值改為沿用使用者實際輸入的進入密碼，keystore 生成也改用同一組密碼，消除所有殘留硬編碼。

---

## [Web 1.9.3] - 2026-05-27

### 🎨 記帳與身分選擇體驗大升級

- **身分載入中狀態提示 (Loading State)**：
  - 在 `useAuth.ts` 中新增了 `isLoading` 載入狀態，追蹤 Profiles 的讀取過程。
  - 在 `UserSelection.vue` 中當讀取時展示「🐱 資料讀取中... / 逗逗貓正努力載入主人資料，請等一下下喔！」提示卡片與 Spinner 旋轉動畫，解決雲端/本地載入期間畫面空白的突兀感。
- **記帳的 DatePicker 徹底移除原生 Select 元件**：
  - 徹底移除 `DatePicker.vue` 中的所有 HTML 原生 `<select>` 元素。
  - 改用手繪果凍質感的年份與月份自定義 Popover 滾動選單清單，具備馬卡龍色系（薄荷綠）、自訂精緻滾動條與 Q 彈物理按壓反饋，完美維持 UI 統一度。
- **帳戶編輯支援修改餘額 / 當前數值 (Balance Editing)**：
  - 升級 `AccountManager.vue` 帳戶編輯 Modal，新增「目前金額 (餘額)」或「當前已刷金額 (負債)」輸入欄位，支援隨時校正餘額數值。
  - 具備智慧帳戶類型識別，若是信用卡會自動在儲存時轉換為負值，與新增帳戶的金融演算法 100% 契合。
- **記帳編輯 Modal 超出畫面修復 (Transaction Overlay Scroll Fix)**：
  - 重構 `TransactionList.vue` 中的交易編輯 Modal 樣式，將 Overlay 設為 `align-items: flex-start` 與 `overflow-y: auto`。
  - 將 Card 改為置中 `margin: auto 0` 且賦予完整四邊圓角，完美解決小螢幕或手機上高度超出、儲存按鈕被遮擋且無法滾動的問題。
- **首頁 Mascot 佈局與氣泡遮擋完美根治 (Flex 物理排列)**：
  - 徹底重構 `DodoCat.vue` 的 DOM 與 CSS 結構，將原本的絕對定位佈局改為健全的 CSS Flexbox 物理排列（`flex-direction: row`）。
  - 將貓咪固定放置於左側（`flex-shrink: 0` 防止受擠壓變形），可愛的手繪對話泡泡置於右側，利用 `gap: 20px` 以及彈性寬度限制（`flex: 1; max-width: 180px; min-width: 120px`），從物理層面**徹底根除對話框蓋住貓咪的 Overlapping 缺陷**！
  - 將玩毛線球的小道具 (`yarn-ball-container`) 移動至貓咪 SVG 容器內部，使其定位與貓咪完全綁定，不論氣泡是否出現，毛線球都永遠緊緊靠在貓咪左下腳，不再發生貓咪移動而毛線球留在原地分離的 bug。
  - 修復了 CSS 結尾處存在的 `.bubble-fad` 語法截斷錯誤，並將 `DatePicker.vue` 中未使用的 `displayHeader` 變數移除，使專案完全無警告順暢通過生產環境編譯（`vue-tsc -b && vite build`）。
- **記帳 DatePicker 年份折行問題修正**：
  - 去除 `DatePicker.vue` 中年份按鈕 label（`{{ year }}年`）及月份按鈕 label（`{{ month }}月`）裡的多餘空格，徹底杜絕瀏覽器在小螢幕空間受限時於空格處自動折行成兩行的瑕疵，確保年份永遠完美呈現在單行。
- **記帳編輯 Modal 垂直居中對齊優化**：
  - 將 `TransactionList.vue` 的編輯 Modal Overlay 修改為 `align-items: center`，使編輯明細彈窗在垂直與水平方向皆能完美居中對齊，徹底消除在交易明細偏少、畫面無法撐滿時彈窗出現折痕或布局異常，與錢包的新增卡片彈窗風格達到極致的視覺統一。
- **高級管理員彩蛋與版本資訊**：
  - 於設定頁最下方放置 App (v1.0.0) 與 Web (v1.9.3) 版號。連點 5 次 `Web Version` 觸發解鎖神祕彩蛋，開啟華麗金棕色漸層的「逗逗貓超高級管理介面」。
  - 普通模式下會自動隱藏「雲端備份防護」與「安全防護門禁」卡片，解鎖後它們會顯示於管理介面中，並內建全新的 **「Dodo Cat 系統稽核日誌檢視器」**，支援手動更新與時間倒序的操作日誌滾動列表。
- **開發美學規範與協同開發手冊升級**：
  - 於 `GEMINI.md` 的 `1. 專案開發風格共識` 中，除了 `1.5 功能變更文件同步規範` 之外，更追加了 **「1.6 禁止使用原生 UI 元件原則」**，規定本專案禁止使用任何瀏覽器原生 UI，一律必須自行使用 SFC 實作統一風格的高級自訂元件，保障極致美學。

---

## [Android 1.0.0 / Web 1.9.2] - 2026-05-26

### 🏷️ Android 版號獨立化與帶版號 Release Tag 系統

- **版本脫鉤**：新增 `android-version.json` 作為 Android 行動端的唯一版本定義來源（Single Source of Truth），與網頁版的 `package.json` 徹底脫鉤。日後升級 Android 版本只需修改此檔案，完全不影響網頁版本發布流程。
- **Gradle 動態版號**：`android/app/build.gradle` 改為在編譯時動態解析 `android-version.json`，確保 APK 內部的 `versionName` / `versionCode` 與定義檔 100% 同步，告別硬編碼。
- **雙重 GitHub Release 策略**：
  - **帶版號 Release**：每次建置成功，自動發布 `android-vX.Y.Z` 的獨立 Release，APK 檔名為 `dodo-ledger-vX.Y.Z.apk`，完整保留歷史版本下載記錄。
  - **`latest` Release 保留**：同時覆蓋更新 `latest` Release，永遠指向最新版本，讓使用者可透過固定連結一鍵下載最新版，無需手動翻找版號。
- **CI/CD 觸發條件分流**：重構 `android.yml` 的 `paths`，Android 編譯管線完全與 `src/**` 等網頁端的變動脫鉤，改為僅在 `android-version.json`、`android/**`、`build-apk.sh`、`capacitor.config.ts` 或 CI 設定本身有更動時才自動觸發，大幅節省 GitHub Actions Runner 資源。
- **本地腳本帶版號命名**：更新 `build-apk.sh`，本地建置同樣動態讀取版號，自動輸出 `dodo-ledger-v{版號}.apk` 與 `dodo-ledger-latest.apk` 兩份至 `build-artifacts/`，方便同時辨識版本與快速測試。

---

## [1.9.1] - 2026-05-26

### 🤖 Android 建置全面升級為 Release 版本

- **Gradle 簽名配置最佳化**：在 `android/app/build.gradle` 中為 `release` 建置類型指定 `signingConfig signingConfigs.debug`，實現「免自備私密金鑰」且符合 Release 編譯規範的 APK 簽署。
- **Release 編譯輸出**：更新一鍵打包指令腳本 `build-apk.sh` 與 GitHub Actions 管線配置，將編譯目標全面由 `assembleDebug` 升級為 `assembleRelease`，產出的 APK 具備最佳的程式混淆、體積壓縮與運行效能。
- **一鍵下載網址更新**：GitHub Release 的下載檔名與專案說明連結全面改為 `dodo-ledger-release.apk`，讓測試與使用體驗更加完美。

---

## [1.9.0] - 2026-05-26

### 📱 Android 行動端移植與自建雙緩衝熱更新系統

#### 🌟 Capacitor 行動端原生整合 (Phase 1)
- **環境初始化**：成功引進並設定 Capacitor。生成全套 Android 原生 Gradle 專案，指定套件 Package ID 為 `com.luke.dodoleddger`。
- **IndexedDB 離線安全快取**：重構資料層 `src/services/db.ts`。在未連網時，自動啟用 Firebase Firestore 的離線快取，支援手機離線記帳，連網後雙向同步，保障極致的資料安全性與 Last-Write-Wins 衝突自癒。
- **SharedPreferences 解鎖持久化**：重構 `useAppLock.ts` 安全鎖模組。解鎖狀態支援透過原生儲存機制進行 SharedPreferences 等級持久化。App 關閉重開無須重複輸入解鎖密碼，唯有手動鎖定或變更密碼時才重設，大幅提升操作順暢度。
- **一鍵自動化自癒打包腳本**：新增 `build-apk.sh`，具備環境偵測與 Java 17 JDK 自動化建置、自癒安裝與修復能力。產出的 APK 會自動重命名並安全輸出至 `build-artifacts/dodo-ledger-debug.apk`。

#### 🔄 自建靜默熱更新與本地通知系統 (Phase 2)
- **自建 Live Updates 引擎**：於 `useLiveUpdates.ts` 實作雙緩衝背景熱更新下載。每次啟動時自動背景比對 `version.json`，若有新版便靜默下載 `app-update.zip` 至沙盒，並在下次啟動時加載，具備斷網離線優雅降級機制。
- **貓咪原生本地通知**：整合 `@capacitor/local-notifications`。當 App 重啟或於背景補記週期自動扣款成功時，會發送系統層的原生本地通知（🐱 逗逗貓理財報告），增添溫馨療癒互動感。
- **Android CI/CD 工作流**：新增專屬 `.github/workflows/android.yml` 自動化 APK 建置管線，於 master 提交時自動驗證與編譯原生 APK。

#### 🛠️ GitHub Actions 與 npm 官方註冊表修復
- **鎖定檔 Registry 修正**：將 `package-lock.json` 中被鎖定的私有註冊表 `npm.synology.inc` 全面修復為 npm 官方的 `registry.npmjs.org`，徹底排除 GitHub Actions 於編譯下載時報錯 `ENOTFOUND` 的連網問題。
- **工作流 paths 觸發條件優化**：在 `deploy.yml` 與 `android.yml` 的路徑過濾器中，加入 `package-lock.json`，以確保日後相依性鎖定檔更新時，CI/CD 管線能自動靈敏地執行最新測試與建置。

---

## [1.8.0] - 2026-05-26

### 🔍 全新收支明細搜尋功能與跨月份智慧檢索

#### 🌟 智慧模糊搜尋與多維度匹配
- **模糊比對篩選**：支援即時對備註（`tx.note`）、分類（`tx.category`）、子分類（`tx.subCategory`）、交易金額（`tx.amount`）、支付/存入帳戶名稱以及記帳成員進行多維度模糊匹配。
- **隨打隨搜 (Real-time Filtering)**：輸入關鍵字後立即即時篩選，無需手動點擊確認，大幅提升對帳效率。

#### 🌐 跨月份智慧檢索與月份選取器聯動
- **跨月份搜尋開關**：當輸入搜尋關鍵字時，自動滑出精緻的「🌐 跨月份搜尋」切換按鈕（預設開啟），方便使用者直接跨月尋找歷史交易。
- **選取器半透明禁用**：在啟用跨月搜尋時，頂部的 `MonthYearPicker` 自動套用半透明並禁用操作（`opacity: 0.55; pointer-events: none`），以極具人性化的視覺引導提示使用者此時為全期檢索。

#### 📊 搜尋結果即時小計與空狀態優化
- **結果小計動態更新**：當有搜尋字串時，小計卡標籤將會智慧切換為「結果收入」、「結果支出」與「結果結餘」，並動態計算並展示所有搜尋匹配項目的金額小計。
- **貼心空狀態引導**：優化了搜尋無結果時的空狀態顯示，會提示「找不到符合關鍵字『...』的記帳喔～🐾」，並提供「清除搜尋條件 🧹」按鈕，一鍵恢復預設檢索。

## [1.7.0] - 2026-05-26

### 📅 全新 MonthYearPicker 下拉彈出與年份直選面板重構

#### 🌟 彈出式面板與點擊外部自動收起
- **`MonthYearPicker.vue`**：由原本預設常駐顯示，重構為**精美彈出式 (Popover/Dropdown) 面板**，僅在點擊按鈕（如 `[📅 2026 年 5 月 ▼]`）時展開。
- 整合全域 `click` 監聽與 `ref` 定位，當點擊選擇器外部任何區域時，**自動平滑收起面板**，兼顧簡潔美觀與人機互動體驗。

#### 🗓️ 月份與年份網格直選 (3x4 與 3x3 網格)
- **月份直選模式**：點擊後以 **3x4 月份網格**（1月 - 12月）呈現，搭配頂部年份導覽列（`← 2026 年 →`），免去繁瑣的逐月翻頁。
- **年份直選模式 (`mode="year"`)**：點擊後以 **3x3 年份網格**呈現，搭配頂部年份區間導覽（如 `← 2020 - 2028 →`），解決原本年份極難挑選的痛點，實現跨越年度的高效切換。
- **交易活躍限制**：完美支援 `availableMonths` prop 限制。在月份與年份模式下，自動禁用（Disable）無任何帳務交易之年月格子，以優雅的灰度樣式呈現。
- **動態交易歷史區間**：徹底拔除了原本硬編碼「只能顯示最近 12/24 個月」的限制。改以所有交易資料中的「最早交易月份」與「最新交易月份」作為動態區間，自動生成無縫、完整的月份選取清單（若無資料，則預設保留最近 12 個月）。已在「收支明細頁面」與「統計頁面」全面生效！

#### 📊 全面整合至統計頁面 (Analytics.vue)
- **統計頁全面革新**：徹底剝離並廢除 `Analytics.vue` 原本老舊的 HTML `<select>` 下拉選單。
- 在「月統計」與「年統計」切換時，自動對接新版 `MonthYearPicker`。月統計顯示 3x4 月份面板，年統計顯示 3x3 年份面板，使整體手繪風 UI 達到極致的高度協調.
- 順利清除了 `Analytics.vue` 內部因為升級而被廢棄的 `availableYears` computed 變數，維持程式碼的純粹性。

### 🎨 UI 體驗與防溢出重構

#### 📅 彈出式 DatePicker 日期選擇器
- **`DatePicker.vue`**：重構為與 `MonthYearPicker` 交互一致的**彈出式 (Popover/Dropdown) 面板**，平日在表單中僅以單行按鈕呈現（如 `📅 2026 年 5 月 26 日`）。
- 點擊按鈕後才展開日曆格，並且在選取完日期後，**面板自動智慧收起**。此優化大幅釋放了「記帳功能表單」以及「交易編輯彈窗」中的縱向空間，免去擠爆螢幕的問題。

#### 📱 彈窗高度限制與防溢出滾動
- 為「建立新身分彈窗 (`UserSelection.vue`)」與「帳戶管理彈窗群 (`AccountManager.vue`)」的 `.modal-card` 加上 **`max-height: 90vh`** 與 **`overflow-y: auto`** 的物理防溢出限制。
- 徹底解決在手機小螢幕、或當虛擬鍵盤彈起時，Dialog 下方按鈕被擠出視窗、點擊不到的重大排版痛點，確保在任何高寬比的手機上皆能完美滾動並安全操作。

#### 👤 支援身分選擇牆直接刪除帳號身分
- **`UserSelection.vue`**：在記帳身分選擇牆的每張主人卡片右側，新增獨立的 **🗑️ 刪除按鈕**（Trash2 圖示）。
- 整合 `@click.stop` 阻斷點擊冒泡事件，避免在刪除時誤觸發身分切換登入。
- 點擊後會彈出 `window.confirm` 二次防呆提示，點擊確認即可調用 `deleteProfile()` 徹底將該帳號身分從資料庫與本地快取中安全抹除，並自動記錄 SystemLog。

---

## [1.6.0] - 2026-05-26

### 🎨 自訂選擇器元件、計算機回退鍵、帳戶頭像、完整編輯支援

#### 🗓️ 自訂 MonthYearPicker / DatePicker / AccountPicker 元件
- **`MonthYearPicker.vue`**：取代原生 `<select>` 的月份選擇器。以果凍風格 `← 年月 →` 導航列呈現，當傳入 `availableMonths` prop 時自動限制可選範圍。已整合至「收支明細」頁月份篩選與「信用卡帳單」頁帳單月份選擇。
- **`DatePicker.vue`**：取代 `<input type="date">` 的日期選擇器。提供內嵌月曆格、月份導航箭頭，已選日期以薄荷綠標示，今日以卡士達金標示。已整合至「記帳」頁與「明細編輯」彈窗。
- **`AccountPicker.vue`**：取代帳戶 `<select>` 的橫向捲動卡片選取列。每張卡片顯示帳戶 Emoji 頭像（或 Lucide 圖示）、帳戶名稱、類型標籤與餘額，已選帳戶右上角加上勾勾徽章。已整合至「記帳」頁帳戶選取區。

#### ⌫ 計算機鍵盤回退鍵
- 在記帳頁計算機鍵盤第四列新增 **⌫ 回退鍵**（使用 Lucide `Delete` 圖示），可逐字刪除最後一個輸入字元；若僅剩一位或剛完成新輸入則直接清零。第四列排列調整為：`⌫ 0 . OK`（OK 不再需要橫跨兩格）。

#### 👤 帳戶 Emoji 頭像 (Avatar)
- **`Account` 型別**新增 `avatar?: string` 欄位，可儲存任意 Emoji。
- 「新增帳戶」與「編輯帳戶」彈窗均提供 **20 個 Emoji 選項**（🏦 💳 💰 🪙 等）的可愛頭像選取格，也可選擇「不設定」（以 Lucide 圖示退場）。
- 帳戶卡片 Badge 優先顯示 Emoji 頭像，`AccountPicker` 元件亦同步顯示。

#### ✏️ 明細編輯功能（TransactionList）
- 每筆交易卡片右側新增 **✏️ 藍色編輯按鈕**（緊靠刪除按鈕旁）。
- 點擊後開啟底部上滑「編輯記帳明細」彈窗，可修改：金額、備註、日期（使用 DatePicker）、主分類、子分類、支付帳戶、存入帳戶。
- `useLedger.editTransaction()`：先回退舊交易的餘額影響，再套用新值，並寫入 `SystemLog` 稽核紀錄。

#### ✏️ 帳戶編輯功能（AccountManager）
- 每張帳戶卡片右上角新增 **✏️ 藍色圓形編輯按鈕**（與 × 刪除按鈕並列）。
- 點擊後開啟「編輯帳戶」彈窗，可修改：帳戶名稱、Emoji 頭像、卡片配色。金額與類型因涉及複雜餘額調整，仍須透過刪除後重建。

---

## [1.5.0] - 2026-05-26


### 🗄️ 資料庫架構正規化：分類獨立化 + Firestore 子集合重構

#### 🔧 正規化前後對照

| 項目 | 舊架構 | 新架構 |
|---|---|---|
| Firestore 儲存方式 | 全部資料壓縮在單一文件 `ledgers/dodo_shared_ledger` | 每種實體各自儲存於子集合 `accounts/`, `transactions/`, `categories/`, `profiles/`, `logs/` |
| 分類管理 | 嵌入 `UserProfile.settings.categories`，隨每個 Profile 複製一份 | 獨立子集合 `categories/`，全帳本共享一份 |
| 1MB 文件限制 | 面臨超限風險（帳目一多即爆） | 每個文件獨立，無限制 |
| 未來擴充 | 無法分頁、無法即時監聽 | 可直接加入 `onSnapshot` 即時監聽、支援分頁 |

#### 📦 變更明細
- **`DatabaseService` 介面**：新增 `getCategories()` / `saveCategories()` 方法。
- **`FirestoreDatabaseService`**：重構為子集合架構，每次 `saveX()` 使用 `writeBatch` 進行差異刪除與全量寫入，並支援超過 500 筆的批次分割。
- **`MockDatabaseService`**（LocalStorage）：新增 `dodo_ledger_shared_categories` 鍵，同步支援分類的本地讀寫。
- **`UserProfile.settings`**：移除 `categories` 欄位，分類不再與 Profile 耦合。
- **`useLedger.ts`**：新增 `categories` 響應式狀態；`loadLedgerData` 首次載入時若分類為空則自動以預設分類填充；新增 `addCategory`, `deleteCategory`, `addSubCategory`, `deleteSubCategory` 四個管理方法。
- **`CategoryManager.vue`**：改由 `useLedger` 讀寫分類，移除對 `useAuth.updateProfileSettings` 的依賴。
- **`TransactionForm.vue`**：分類來源改為 `useLedger.categories`，不再讀取 `currentProfile.settings.categories`。

## [1.4.0] - 2026-05-26

### ☁️ 雲端身分與稽核日誌同步、終端彩色 CLI 稽核工具與獨立分類 Tab 上線！

在本次版本中，我們完成了一次高質量的軟體工程重構，大幅提升了多人共同記帳時的資料透明度、操作稽核、底欄排版黃金美學，並修復了核心載入 Bug：

#### ☁️ 雲端成員身分檔與核心日誌同步
- **實作 `profiles` 與 `logs` 資料庫同步**：擴充 `DatabaseService`，讓成員列表配置（包含月預算、分類調整）與財務操作日誌在 LocalStorage 與 Firebase 雲端自動同步，實現多人記帳無縫連動。
- **全域 `SystemLog` 財務稽核日誌**：專注記錄記帳、刪除、還款、身分建立與刪除等財務核心操作，並詳細記錄由哪位成員於何時異動。**完全排除摸貓、餵貓等無關痛癢的娛樂日誌**。

#### 📊 雙直接執行之 CLI 終端工具 (`./prepare-deploy` & `./view-logs`)
- **根目錄極速執行**：新增根目錄可直接執行的 `./prepare-deploy`（安全打包設定）與 `./view-logs`，免去 `npm run` 的麻煩。
- **極速 REST API 與精緻 ANSI 表格**：`./view-logs` 直接透過 Firestore REST API 發送 GET 請求，徹底免除 node 終端安裝巨大 Firebase SDK 的繁雜度，並以繽紛的 ANSI 彩色時間軸、成員頭像與財務操作型態印出精緻稽核表格，視覺體驗極佳！

#### ✨ 獨立記帳分類 Tab 與黃金對稱 7 鍵底欄
- **獨立 `CategoryManager.vue` 元件**：將雙層收支分類摺疊面板、主分類圖示選取、手動自訂子分類功能完全剝離並封裝成獨立元件，精簡了原有的 `Settings.vue`。
- **正中央「記帳」圓形按鈕**：底欄導航重組為 7 個 Tabs 導航列，使核心「記帳」圓圈按鈕完美坐落在**最正中央的第 4 個鍵**（左右對稱各三個），極致黃金對稱美學。

#### 🔧 解決開機與登入不顯示資料之重大 Bug
- **開機全自動載入**：在 `App.vue` 增加 `watch(isLoggedIn, ...)` 監聽與 `immediate: true` 載入。一旦使用者登入，或是重載網頁時原本就處於登入狀態，**全自動觸發 `loadLedgerData` 載入與渲染完整雲端/本地資料**，完美解決有資料卻需要手動觸發的體驗缺失！

---

## [1.3.0] - 2026-05-26

### ☁️ 真正 Firebase 雲端資料庫多人共同記帳功能大開通！

在本次版本中，我們正式將資料讀寫連通至 Firebase Firestore 資料庫，實現了真正的多人同步記帳，並針對手機觸控與 UI 進行了深度體驗升級：

#### ☁️ 真正雲端資料庫儲存 (Firebase Firestore)
- **實作真正的 `FirestoreDatabaseService`**：完成與 Firebase Firestore 雲端資料庫的無縫讀寫，帳戶餘額、交易明細、自動扣款設定全部真正寫入雲端，保障資料永不遺失。
- **全自動雲端連通與環境偵測**：移除繁瑣手動連線按鈕。只要偵測到環境中配置了真實的 Firebase 金鑰，網頁在啟動時即會**自動完成雲端連線並重載資料**。
- **極簡自動化狀態卡片**：`Settings.vue` 重構為純粹的狀態報卡，自動偵測並展示 `☁️ Firebase 雲端同步模式` 或 `📟 LocalStorage 本地儲存模式`。

#### 📱 行動端體驗重大優化 ── 英文虛擬鍵盤喚醒
- **隱藏真實 Input 聚焦控制**：解決了手機上無法叫出虛擬鍵盤輸入英文密碼的大缺陷。在解鎖介面 `AppLock.vue` 秘密埋入透明隱藏的真正的 `<input type="text">`，點擊畫面任意處即可自動聚焦並**彈出手機內建的英文/符號軟鍵盤**，雙軌完美相容行動端。

---

## [1.2.0] - 2026-05-26

### 🔒 Dodo Gatekeeper 雙層安全認證解鎖防護系統上線！

在本次版本中，我們為專案導入了專為 GitHub Pages 靜態環境設計的防護門禁，防止未授權訪客存取：

#### 🔑 雙層安全認證
- **全域訪問金鑰鎖 (VITE_APP_PASSWORD_HASH)**：針對 GitHub Pages 靜態託管環境，採用單向 SHA-256 雜湊技術。建置時僅注入密碼雜湊，前端單向比對，即使 JS 程式碼被公開下載，也絕對無法反推明文密碼，高安全性。
- **本地私有密碼鎖 (Local Passcode)**：免配置環境變數，使用者可在「設定」中自行啟用 4~8 位數字密碼，雜湊安全加密儲存於 `localStorage`。
- **Session 暫存機制**：解鎖狀態儲存於 `sessionStorage`，同分頁重整時免重打密碼，兼顧便利。

#### 🎨 萌系解鎖畫面與設定卡片
- **DodoCat 守門表情氣泡**：全新製作 `AppLock.vue` 畫面，貓咪依據輸入狀態（輸入中、輸入正確、密碼錯誤）表現 `sleeping`、`happy`、`scared`、`crying` 表情與逗趣語氣。
- **果凍物理鍵盤**：提供點擊具物理回彈的果凍數字鍵盤，且支援實體鍵盤英數輸入與 Enter 送出。
- **安全防護設定面板**：在 `Settings.vue` 整合卡片，提供本地密碼設定、修改、停用與「立即測試鎖定」按鈕。

#### 🛠️ 自動化部署準備腳本
- **`npm run prepare-deploy` CLI 工具**：新增 `scripts/prepare-deploy.js` 互動式命令行工具。自動計算密碼雜湊、生成本地 `.env.local` 檔案，並以精美 Terminal 表格引導使用者設定 GitHub Secrets，實現無痛安全發布。

---

## [1.1.0] - 2026-05-26

### 🐾 逗逗貓互動系統與分類管理大師上線！

在本次版本中，我們針對使用者的實際體驗進行了極具溫度的功能擴展與細節微調：

#### 🎨 視覺排版與大字型易讀性優化
- **全面放大偏小字型**：檢索全域與各元件的 CSS，將所有原本小於 `12px` 的字型（如 `8px`, `9px`, `10px`, `11px` 的說明標籤、交易備註、記帳人簽名、底欄導航、預算警示等）全面調大至 `12px` 或 `13px`。
- **優化對話框版面空間**：貓咪對話氣泡內的文字大小調大至 `15px`，並將對話框的 `bottom` 位置拉升至 `140px`，確保字型變大時泡泡不壓頭且排版極致美觀！
- **完美版面平衡**：微調了餵食按鈕與子分類膠囊標籤的邊距 (Padding)，使字體變大後的 UI 配置依然保持著高雅溫馨的繪本氣息。

#### 🐱 逗逗貓與趣味互動
- **首頁看板高度拉伸**：將 `.mascot-board` 高度調整為 `240px` 並設置 `overflow: visible`，徹底解決首頁貓咪氣泡被截斷的問題。
- **貓咪點擊摸摸 (Poke)**：為逗逗貓 SVG 綁定點擊事件，觸發 **QQ 果凍物理彈性收縮動畫 (`catJellyPop`)**；摸摸時隨機展現開心或瞌睡表情，並隨機說出貼心對話，4秒後自動回復原本狀態。
- **趣味餵食大餐 (Feed)**：看板下方新增「餵魚乾 🐟」與「餵罐罐 🥫」按鈕，餵食可累積次數至 LocalStorage，貓咪會大口享用並告知是第幾次吃到大餐！

#### 🧮 記帳分類手動管理大師
- **主子分類完全手動控制**：在設定頁面底部實作了高互動的「記帳分類管理大師」摺疊面板，可隨時自由新增與刪除主分類與子分類。
- **新增主分類圖示選取**：支援為新增的主分類點選格狀 Grid 指派 12 種可愛的預設手繪圖示（🍔、🚗、🛍️、🏠、💵 等）。

#### ☁️ Firebase 配置專案內置化
- **免除網頁欄位輸入**：建立專案配置檔 `src/config/firebase.ts`，Settings 頁面全面移除 API Key、Project ID 與 Auth Domain 等三個填寫框，改為直接偵測專案設定，提供極簡一鍵備份體驗。

---

## [1.0.0-alpha] - 2026-05-26

### 🐾 Dodo Ledger 1.0 完美功能大爆發！

我們以最高標準的軟體工程規格，為您打造了這個既軟萌又強大的個人與多人理財天地。以下是本次 alpha 版本正式交付的所有功能明細：

#### 🎨 視覺與互動體驗
- **溫馨插畫繪本風**：完成 `src/style.css` 樣式架構，引入 Outfit/Nunito 可愛字型、大圓角幾何設計、朱古力手繪線框，以及點擊時的「QQ 果凍物理彈性縮放動畫」。
- **🐱 逗逗貓療癒看板**：實作 `DodoCat.vue` 元件，以扁平手繪 SVG 畫出可愛的逗逗貓！貓咪會根據本月預算的消耗比例變換 5 種生動表情（玩毛線球、緊張垂耳、受驚噴汗、貓爪遮眼大哭、伸懶腰報告），並能隨時彈出對話泡泡提醒主人！
- **🧮 QQ 彈性計算機鍵盤**：在 `TransactionForm.vue` 中自訂胖胖的 4x4 虛擬數字鍵盤，按鍵自帶果凍點擊動畫。內建安全的手寫加減解析器，支援「邊記邊算」與一鍵 OK 送出！

#### 👥 共同記帳與多人追蹤
- **身分選擇牆 (`UserSelection.vue`)**：支援免登入註冊多個本地 Profile，可任選奶油黃🐱、蜜桃粉🍑、冰晶藍🧊、薰衣草紫🍇 陪伴小貓，並能隨時切換。
- **🏦 資產帳本全域共享**：所有的理財卡片帳戶、信用卡額度與交易明細在全域共享，不同身分共同維護「同一個家庭資產池」！
- **✍️ 記帳留名紀錄**：每筆交易皆會自動標記記帳人的姓名與可愛頭像，在近期明細卡片中以精美留名徽章展示。週期自動扣款則由 🐱 **「逗逗貓」** 親自記帳留名！

#### 💳 進階理財與自動化邏輯
- **信用卡分期攤還**：實作嚴謹分期算法，可用額度消費當下全扣，但各期帳單金額依結帳日（Billing Cycle）自動推移歸屬到各月帳單，首期自動補足除不盡的餘數。
- **一鍵扣繳平帳**：在信用卡中心（`CreditCardCenter.vue`）中，提供一鍵還款彈窗，可自選銀行存款帳戶扣除當期卡費，自動連動還款交易。
- **轉帳手續費獨立支出**：轉帳時如有手續費，自動在背景拆分出一筆獨立支出，手續費標記為由 ⚙️「系統自動」記帳。
- **週期自動記帳 Lazy-check**：系統啟動時（`loadLedgerData`）自動懶惰檢查漏扣的定期訂閱（如 Netflix），自動補齊扣款並由逗逗貓向您發出對話泡泡報告！

#### 🛡️ 開發腳本、防禦工程與 CI/CD
- **一鍵腳本**：交付 `./run.sh`（一鍵檢查套件並啟動開發伺服器）與 `./deploy.sh`（一鍵在本地進行 TypeScript 檢驗、單元測試並打包編譯）。
- **無 DOM 環境防禦性設計**：`useAuth.ts` 與 `db.ts` 全面加上防禦性檢查，確保能相容 Node.js / SSR 伺服器端加載而不崩潰。
- **Vitest 100% 綠燈通過**：編寫 `tests/ledger.test.ts` 覆蓋共同記帳、手續費拆算、信用卡分攤與還款測試，全部極速通過！
- **Vite 0 錯誤打包**：生產環境完美編譯通過，產出高壓縮的 HTML/JS/CSS 靜態成果！
- **GitHub Actions 自動化**：配置 `.github/workflows/deploy.yml`，在 push 時自動在雲端跑測試與 TS 驗證，成功後一鍵自動部署至 GitHub Pages！

---

> 🐱 **逗逗貓終點站報告**：喵嗚！我們攜手完成了一個無比驚豔、同時在軟體工程與自動化測試上達到頂級質感的記帳專案！現在只要執行 `./run.sh` 就能進入這個可愛的主人小天地囉！喵～ 🐾
