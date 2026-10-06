# Dodo Ledger 記帳服務 —— 系統規格書 (SPEC)

本文件詳細記載 Dodo Ledger 記帳服務的系統規格、核心商業邏輯演算法與資料庫 Schema 定義。旨在為 Web SPA 端與未來 Android App 端提供一致性的業務邏輯標準。

---

## 1. 系統架構與技術棧

- **前端框架**：Vite + Vue 3 + TypeScript
- **樣式方案**：Vanilla CSS + Scoped Styles（繪本插畫風設計，大圓角、果凍微動畫、逗逗貓主視覺）
- **自動化測試**：Vitest 測試框架
- **資料儲存**：雙模式（LocalStorage 本地體驗模式 / Firebase 雲端同步模式）
- **自動化記帳邊緣 API (Edge API)**：基於 Cloudflare Workers 的 Zero Host 邊緣端點，提供 AI Agent (Claude, GPTs, Antigravity) 及自動化腳本 (iOS 捷徑, Webhook) 執行原子化自動記帳，支援 OpenAPI 3.1 規範 (`public/api-spec.json`) 與 `llms.txt`。
- **多使用者身分 (User Profiles)**：支援「多本地身分選擇與切換」。在 LocalStorage 中，所有資料皆以 `userId` 為 Key 進行分流隔離；登入 Firebase 時，則直接與 Firebase Auth 的 `uid` 綁定。

---

## 1.4 多使用者身分與資料隔離機制
第一版為提供無縫的「免登入多帳號體驗」：
1. **身分建立**：使用者可建立多個本地 Profile（包含自訂名字與逗逗貓頭像）。系統會為每個 Profile 產生唯一的 `userId` (例如 `user_local_1716700000000`)。
2. **切換身分**：首頁提供可愛的頭像切換器，使用者可隨時切換或登出，返回身分選擇牆。
3. **資料庫分流**：
   - 本地模式：資料在 LocalStorage 中以 `dodo_ledger_{userId}_accounts` 和 `dodo_ledger_{userId}_transactions` 等格式隔離儲存。
   - 雲端模式：當使用者為某個 Profile 綁定 Firebase 後，該 `userId` 會升級為 Firebase Auth 的 `uid`，資料自動上傳至雲端對應的 Firestore 集合中。


## 2. 資料庫 Schema 規格 (Firestore)

> **正規化架構說明**：所有實體以子集合（subcollection）形式儲存於 `ledgers/dodo_shared_ledger/` 路徑下，避免單一文件超過 Firestore 1MB 限制，並支援即時監聽（`onSnapshot`）與分頁查詢。所有財務操作使用原子批次寫入（`writeBatch` + `increment()`），確保多裝置並發時帳戶餘額與交易記錄一致性。

```
ledgers/
  dodo_shared_ledger/
    accounts/      {accountId}     ← Account 文件
    transactions/  {transactionId} ← Transaction 文件
    recurring/     {recurringId}   ← RecurringTransaction 文件
    categories/    {categoryId}    ← Category 文件（共享，不隨身分複製）
    profiles/      {profileId}     ← UserProfile 文件（不含 categories）
    logs/          {logId}         ← SystemLog 文件
```

### 2.1 使用者設定檔 (`/profiles/{profileId}`)
儲存使用者基本資訊與全域設定。

| 欄位名稱 | 型態 | 說明 |
| :--- | :--- | :--- |
| `id` | string | 使用者唯一識別碼 |
| `name` | string | 使用者顯示名稱 |
| `avatar` | string | 逗逗貓可愛頭像編號或 CSS 漸層色 |
| `createdAt` | number | 建立時間戳記 |
| `settings` | object | 使用者全域配置（貨幣、主題、月預算） |

#### `settings` 結構：
```json
{
  "currency": "TWD",
  "theme": "warm-light",
  "monthlyBudget": 20000,
  "hiddenAccountTypes": ["electronic_ticket"] // 已被使用者隱藏的帳戶類型
}
```

### 2.2 收支分類 (`/categories/{categoryId}`)
共享的雙層記帳分類，所有成員共用同一份分類列表，首次載入時自動以預設分類填充。

| 欄位名稱 | 型態 | 說明 |
| :--- | :--- | :--- |
| `id` | string | 分類唯一識別碼 |
| `name` | string | 主分類名稱，如「餐飲」 |
| `type` | string | `expense` (支出) 或 `income` (收入) |
| `icon` | string | Lucide 圖示名稱 |
| `subCategories` | string[] | 子分類名稱陣列，如 `["早餐", "午餐", "晚餐"]` |
| `sortOrder` | number? | 使用者自訂顯示順序（同 type 內升冪排列，無此欄位者排末） |

- **系統預設分類庫**：
  - **支出 (`expense`)**：餐飲食品、交通出行、購物消費、居家生活、醫療保健、娛樂休閒、教育學習（包含「學雜費、補習/課程、書籍教科書、文具用品、線上訂閱」等預設子分類）。
  - **收入 (`income`)**：薪資收入、其他收入。
- **可愛圖示對照庫 (Cute Icons)**：
  - 系統內建 20 個精美圖示（包括 `Sparkles`, `Utensils`, `Car`, `ShoppingBag`, `Home`, `DollarSign`, `TrendingUp`, `Gift`, `Briefcase`, `Heart`, `Smile`, `Activity`, `GraduationCap`, `PiggyBank`, `Coins`, `Cat`, `Dumbbell`, `Plane`, `Gamepad`, `Coffee`）。
  - 由 `useLedger.ts` 內的 `getIconEmoji` 進行 Emoji 的轉譯（例如將 `GraduationCap` 轉為 🎓，將 `Utensils` 轉為 🍔），確保 UI 元件（如 `CategoryManager` 與 `TransactionForm`）中圖示呈現的一致性。

### 2.3 帳戶檔案 (`/accounts/{accountId}`)
記錄現金、銀行、信用卡、電子票證之帳戶參數。

| 欄位名稱 | 型態 | 說明 |
| :--- | :--- | :--- |
| `id` | string | 帳戶唯一識別碼 |
| `name` | string | 帳戶名稱（如：台新 Richart、生活現金） |
| `type` | string | 類型：`cash` (現金), `bank` (銀行), `credit_card` (信用卡), `electronic_ticket` (悠遊卡/一卡通等) |
| `balance` | number | 當前帳戶餘額（信用卡此欄位記錄已消費未還款之負值） |
| `icon` | string | 帳戶圖示名稱 |
| `color` | string | 卡片漸層配色代碼 (CSS Class 或 Hex) |
| `currency` | string | 貨幣，如 `TWD` |
| `createdAt` | timestamp | 建立時間 |
| `updatedAt` | number? | 最後更新時間戳記（離線優先防衝突） |
| `sortOrder` | number? | 使用者自訂顯示順序（升冪排列，無此欄位者排末） |
| `cardDetails`| object | 信用卡專屬配置（僅在 type == "credit_card" 時存在） |

#### `cardDetails` 結構：
```json
{
  "creditLimit": 100000,          // 信用額度
  "billingCycleDate": 10,         // 每月結帳日 (例如每月 10 號)
  "paymentDueDate": 25,           // 每月繳款截止日 (例如每月 25 號)
  "linkedBankAccountId": "acct_1" // 自動扣繳連結的銀行帳戶 ID (可選)
}
```

### 2.4 交易明細 (`/transactions/{transactionId}`)
記錄每一筆收支、轉帳、信用卡分期的明細。

| 欄位名稱 | 型態 | 說明 |
| :--- | :--- | :--- |
| `id` | string | 交易唯一識別碼 |
| `type` | string | 交易類型：`income` (收入), `expense` (支出), `transfer` (轉帳) |
| `amount` | number | 交易金額 |
| `fee` | number? | 轉帳手續費（僅轉帳適用） |
| `category` | string | 主分類名稱或 ID |
| `subCategory`| string? | 子分類名稱或 ID |
| `fromAccountId`| string? | 扣款帳戶 ID (支出、轉帳的來源) |
| `toAccountId` | string? | 存款帳戶 ID (收入、轉帳的目的) |
| `date` | number | 交易發生的時間戳記（毫秒） |
| `note` | string | 備註說明 |
| `tags` | string[] | 標籤陣列，如 `["日常", "旅行"]` |
| `isRecurring`| boolean? | 是否為週期性自動記帳所產生的交易 |
| `recurringId`| string? | 關聯的週期設定 ID |
| `createdBy` | string? | 記帳人暱稱（共同記帳多人追蹤） |
| `createdByAvatar`| string? | 記帳人頭像 Emoji（共同記帳多人追蹤） |
| `updatedAt` | number? | 最後更新時間戳記（離線優先防衝突） |
| `creditCardDetails`| object? | 信用卡專屬分期與帳單期數資訊 |
| `isPaid` | boolean? | 信用卡消費交易是否已繳清（當信用卡帳單連動一鍵繳款後，該期交易會被設為 `true`，明細旁邊會自動標記亮麗的「✓ 已繳清」馬卡龍綠 jelly 標籤） |

#### `creditCardDetails` 結構：
```json
{
  "isInstallment": true,       // 是否為分期付款
  "installmentTerm": 3,        // 總期數
  "currentInstallment": 1,     // 當前期數
  "billPeriod": "2026-05"      // 歸屬的信用卡帳單月份 (YYYY-MM)
}
```

### 2.5 週期性自動記帳設定 (`/recurring/{recurringId}`)
排程紀錄，用於定期執行扣款。

| 欄位名稱 | 型態 | 說明 |
| :--- | :--- | :--- |
| `id` | string | 週期設定唯一識別碼 |
| `title` | string | 扣款項目名稱 (例如：Netflix 訂閱) |
| `type` | string | `expense` (支出) 或 `income` (收入) |
| `amount` | number | 每次執行的金額 |
| `category` | string | 主分類 |
| `subCategory`| string | 子分類 |
| `fromAccountId`| string | 扣款帳戶 ID |
| `frequency` | string | 頻率：`daily` (每日), `weekly` (每週), `monthly` (每月) |
| `interval` | number | 間隔（如 frequency='monthly', interval=2 代表每兩個月一次） |
| `startDate` | timestamp | 開始生效日期 |
| `nextExecutionDate`| timestamp | 下一次預計自動扣款的時間 |
| `isActive` | boolean | 此排程是否啟用中 |

---

## 3. 核心商業邏輯與計算演算法

### 3.1 帳戶轉帳與手續費處理演算法
當使用者進行帳戶互轉（例如銀行帳戶轉至悠遊卡）時：
1. **來源帳戶** `fromAccountId` 扣除 `amount + fee`。
2. **目的帳戶** `toAccountId` 增加 `amount`。
3. 建立一筆 `transfer` 交易：金額為 `amount`。
4. **手續費獨立支出化**：如果 `fee > 0`，系統在建立轉帳交易的同時，會**自動額外新增一筆獨立的 `expense` 交易**：
   - 金額 = `fee`
   - 分類 = `交通` 或 `其他` 內的子分類 `轉帳手續費`。
   - 扣款帳戶 = `fromAccountId`。
   - 備註 = `轉帳至 [目的帳戶名稱] 的手續費`。
   - 這能確保手續費被正確歸類至月度支出統計，且不會干擾主轉帳金額的對帳。

#### 3.1.1 轉帳下拉選單 UI 設計與 RWD 防跑版
自定義選單 `AccountDropdown.vue` 徹底替代原生 select，以滿足高視覺度與行動端螢幕流暢性：
1. **馬卡龍與頭像設計**：結合帳戶類型的 Emoji / Lucide 圖示及馬卡龍色卡片背景做為頭像 avatar，並自定義圓角與 Jelly 微震點擊手感。
2. **長名稱與餘額雙行佈局**：
   - 傳統 select 容易在手機寬度（< 360px）下因 `[帳戶名稱] + [餘額]` 字數過長而向外撐爆容器或導致 chevron 箭頭被擠出螢幕。
   - 自定義元件採用 Flex 容器，並將「名稱」與「金額」改為上下雙行排列。對名稱設定極致的 CSS 防護：
     `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`，配合 `min-width: 0` 和 `flex: 1`。
   - 這使得當帳戶名稱過長時，會優雅地以 `...` 截斷，而金額維持在下一行，Chevron 箭頭依然在最右側，完全保證 RWD 手機版面的高度一致性。

#### 3.1.2 帳戶資金互轉多類別篩選與一鍵對調 (Swap) 規格
為提供快速對帳與流暢的轉帳體驗，帳戶資金互轉彈窗提供獨立分類篩選與一鍵帳戶對調機制：
1. **來源與目的帳戶獨立分類篩選列**：
   - 於扣款（來源）與存入（目的）下拉選單上方，分別提供手繪馬卡龍風格的分類膠囊按鈕列：`全部 ✨`、`現金 💵`、`銀行 🏦`、`信用卡 💳` 與 `票證 🎫`。
   - **動態類別感知**：系統自動讀取使用者的隱藏帳戶設定 (`hiddenAccountTypes`)，並僅動態呈現目前帳本內「存在有效帳戶」的類別標籤，杜絕空分類按鈕。
   - **切換自動選取與精準連動**：當使用者切換分類標籤時，若當前選取的帳戶不在該分類內，自動智慧切換為該分類的第一個帳戶；點開下拉選單時，選項亦自動限定於該分類帳戶。
2. **一鍵快速對調帳戶 (Swap)**：
   - 於來源帳戶與目的帳戶區間配置 `⇅ 對調帳戶` 按鈕，點擊時原子交換兩側的選取帳戶 ID，並同步校正兩側所屬的分類標籤選取狀態，免去手動重複挑選之繁瑣。
3. **超輕量 RWD 適配**：
   - 標籤列採用 22px 緊湊高度，即使在小螢幕手機上亦無需縱向滾動即可完整操作金額、手續費、備註與送出按鈕。

### 3.2 信用卡帳單週期與分期攤還演算法

#### 3.2.1 信用卡帳單歸屬月份計算
當一筆信用卡消費發生在日期 $D$（例如 2026-05-15），卡片結帳日為 $C$（每月 $C$ 號，例如 10 號）：
1. 取得消費日 $D$ 的年份 $Y$、月份 $M$、以及日期 $d$。
2. 比對 $d$ 與 $C$：
   - 若 $d \le C$，則此消費歸屬於當前月份的帳單。帳單歸屬月份 $P = Y\text{-}M$（例如消費日 5/8 歸屬於 `"2026-05"` 帳單）。
   - 若 $d > C$，則此消費已過結帳日，歸屬於下個月的帳單。帳單歸屬月份 $P = \text{下一個月份}(Y, M)$（例如消費日 5/15 歸屬於 `"2026-06"` 帳單）。
3. 若該筆交易為一般信用卡支出（非分期），系統在建立交易時即自動寫入 `creditCardDetails.billPeriod = P`，前端帳單頁不得要求使用者手動指定帳單月份。

#### 3.2.2 信用卡分期額度與帳單分攤計算
若消費金額為 $A$，分期總數為 $T$（例如 3 期）：
1. **可用額度扣減**：信用卡的可用額度在消費當下**立即扣減全額 $A$**（防止使用者刷爆）。已佔用額度增加 $A$。
2. **各期帳單金額計算**：
   - 每一期攤還金額 = $\lfloor A / T \rfloor$。
   - 第一期金額調整（處理除不盡的餘數）：第一期金額 $A_1 = (A - \sum_{i=2}^{T} \lfloor A / T \rfloor)$，其餘各期 $A_i = \lfloor A / T \rfloor$。
3. **帳單月份分攤**：
   - 第一期歸屬帳單月份為當前消費計算出的帳單月份 $P_1$。
   - 第 $i$ 期的歸屬帳單月份為 $P_1$ 再往後推 $i-1$ 個月。
   - 系統會在交易明細中，一次性產生 $T$ 筆相關的「分期明細交易」（標註 `currentInstallment = i` 與對應的 `billPeriod`），但在首頁與帳單介面上，僅會把 `billPeriod` 符合當前查詢月份的金額納入該月的信用卡帳單。

#### 3.2.3 信用卡一鍵還款（繳納帳單）邏輯
當使用者要繳納信用卡 `"2026-05"` 帳單：
1. 計算該帳單月份所有已出帳的信用卡交易金額之總和 $S$。
2. 扣款：使用者指定還款的銀行帳戶 `bankAccountId` 扣除 $S$。
3. 還款：信用卡的已消費金額減少 $S$（即卡片可用額度恢復 $S$）。
4. 建立交易：產生一筆 `transfer` 還款交易：
   - 來源帳戶 = `bankAccountId`
   - 目的帳戶 = 該信用卡帳戶 ID
   - 金額 = $S$
   - 備註 = `繳納信用卡 2026-05 帳單`
5. 信用卡帳單頁僅呈現信用卡帳單相關內容：上方可切換信用卡與帳單月份，下方顯示該月份已出帳明細；一般帳戶清單不得混入此視圖。
6. **帳單明細項目編輯與編輯畫面全站共用**：本期已出帳明細清單維持專屬簡潔卡片排版（展示分類、備註、分期標籤、金額、消費日與鉛筆編輯鈕），點擊卡片或編輯按鈕時，全面與收支明細共用 `TransactionEditModal` 編輯畫面，展示置中編輯對話框，可修改金額、備註、日期、主分類、子分類與扣款帳戶，或執行刪除，右上角配備專用正圓關閉按鈕；更新後依據原子操作規範即時連動帳戶餘額與帳單總額。
7. **帳單標註**：當還款交易完成後，該月份所有屬於該期應還款之信用卡消費明細，其 `isPaid` 欄位會自動更新為 `true`，前端渲染時會相應在分類旁邊展示「✓ 已繳清」馬卡龍綠 jelly 標籤。

#### 3.2.4 分類管理原地編輯與歷史交易級聯更新演算法
為了保障理財分析資料的完整性，系統提供「主分類」與「子分類」的原地編輯功能，並實作智慧級聯更新（Cascading Update）：
1. **原地編輯**：使用者可在分類管理畫面上，直接點擊 Pencil 按鈕修改分類名稱、重選 emoji，此動作會更新對應分類文件。
2. **智慧級聯關聯**：
   - **主分類級聯**：當主分類名稱從 $C_{old}$ 修改為 $C_{new}$ 時，系統會主動在後台搜尋所有主分類為 $C_{old}$ 的交易明細（`/transactions`）與週期記帳設定（`/recurring`），並以原子批次操作（`writeBatch` 或 `atomicBatch`）將其主分類欄位一併更新為 $C_{new}$。
   - **子分類級聯**：當某個主分類 $C$ 下的子分類 $S_{old}$ 修改為 $S_{new}$ 時，系統會主動在後台搜尋所有主分類為 $C$ 且子分類為 $S_{old}$ 的交易明細與週期記帳設定，並將其子分類欄位一併更新為 $S_{new}$。
3. **無損關聯**：此機制保障了已產生的歷史帳目不會因為分類重命名而遺失分類關聯，維護了歷史統計圖表的精準性。

#### 3.2.5 記帳表單快速新增分類與智慧狀態處理機制
為優化日常記帳流暢度，避免因缺少分類而必須中斷跳出記帳流程之缺憾，記帳表單 (`TransactionForm.vue`) 全面內建「主/子分類快速新增功能」：
1. **主分類快速新增流程**：
   - 使用者在記帳表單中點擊「➕ 新增分類」按鈕，即可喚起快速新增 Dialog。
   - 支援輸入分類名稱，並能點選精美的 20 種分類圖示（對接 `cuteIconsList`），點擊確認後在後台非同步寫入新分類文件。
   - **重複性防禦**：寫入前系統會進行同收支類型（`type`）下重名檢查，若已存在該名稱之分類則拋出警告，防止資料庫重複。
   - **智慧自動選取**：新增成功後，表單會自動在 100ms 後將 `selectedCatId` 指向該剛新增的分類，並重設選中子分類，免去使用者手動尋找之繁瑣。
2. **子分類快速新增流程**：
   - 在選取某主分類時，子分類膠囊列表尾部會自動浮現「➕ 新增子分類」按鈕。
   - 點擊後會鎖定目前選定之主分類，支援輸入子分類名稱，並在確認後於後台非同步將其追加至主分類的 `subCategories` 陣列中。
   - **重複性防禦**：自動檢查該主分類下是否已存在同名子分類。
   - **智慧自動選取**：新增成功後，表單會全自動將選定子分類（`selectedSubCat`）指向剛新增之子分類。
3. **與新增帳戶一致的 Teleport 置中 Modal 彈窗規格**：
   - 快速新增主/子分類 Dialog 採用與「新增帳戶」100% 一致的置中對話框卡片結構（套用 `.modal-overlay` 與 `.modal-card` 樣式），並使用 **`<Teleport to="#app">`** 掛載於 `#app` 的最頂層。
   - **徹底消除遮擋**：由於 Teleport 掛載，該 Dialog 不再受限於記帳表單或底部 TabBar 的層疊上下文（z-index）與排版限制，100% 確保不會被底部的 TabBar 遮擋。
   - **防禦虛擬鍵盤擠壓**：`.modal-overlay` 具備頂部起點對齊（`align-items: flex-start`）與垂直溢出滾動（`overflow-y: auto`）機制，配合卡片的 `margin: auto 0` 自動垂直置中，使得當手機彈起虛擬鍵盤擠壓視區時，對話框會平滑地上推，且使用者可流暢地上下滾動，100% 確保按鈕永遠不會跑到看不見的地方。
   - **精緻局部的圖示選擇器**：主分類圖示選擇器 (`.icon-selector-grid`) 限制 `max-height: 120px` 並配備可愛的小滾動條，維持 Dialog 整體小巧精緻的視覺感。

#### 3.2.6 全站共用金額計算機 (`AmountCalculator`) 規格
為提供兼具童趣手感與精準計算的記帳體驗，系統以 `AmountCalculator.vue` 取代全站所有原本的傳統 HTML 數字輸入框（`input type="number"`），並制定全域排版與互動規範：
1. **雙模式架構**：
   - **常駐內嵌模式 (`inline: true`)**：應用於主頁記帳表單（`TransactionForm.vue`），在畫面上直接展示看板與 5x4 鍵盤，提供零點擊成本的即時輸入體驗。
   - **果凍抽屜彈出模式 (`inline: false`)**：應用於各類彈窗（`TransactionEditModal.vue`、`AccountManager.vue` 新增/編輯/轉帳、`Settings.vue` 預算）。外觀維持 48px 標準輸入框高度，包含 `TWD $` 前綴與 🧮 計算機微標章。點擊時透過 `<Teleport to="#app">` 以頂層 z-index (9999) 喚起全功能計算機面板，在手機版呈現貼合底部的 Bottom Sheet，徹底避免破壞對話框佈局與高度。
2. **算式與運算大腦**：
   - 內建安全四則運算解析器（先乘除、後加減，金額非負下限保護），支援小數點與即時預覽計算。
3. **取消還原與確認更新機制**：
   - 在彈出模式下，抽屜內的運算操作不提前污染外部表單狀態。
   - **取消**：點擊右上角「X」關閉按鈕或點擊背景遮罩時，視為取消放棄，**自動還原為開啟前的原始數值**，不觸發資料更新。
   - **確認**：點擊「OK 🐾」鍵時，結算最終數值並透過 `emit('update:modelValue')`、`emit('change')` 與 `emit('submit')` 更新至父層。

#### 3.2.7 全站彈窗遮罩關閉與多層事件隔離規範
全站所有對話框與彈窗（包括 `AccountManager` 的編輯/新增/轉帳/繳款/顯示設定、`Settings` 的密碼鎖、`TransactionForm` 的快速新增分類、`Dashboard` 的成就牆、以及 `AmountCalculator` 的計算機抽屜）統一遵循以下互動規範：
1. **點擊遮罩關閉 (Click Outside to Close)**：
   - 所有彈窗的背景遮罩層必須監聽 `@click.self`（或 `@click.stop="handleBackdropClick"`），當使用者點擊對話框卡片以外的空白半透明遮罩處時，等同點擊右上角的「X」關閉按鈕，安全取消或關閉彈窗。
2. **多層彈窗事件防穿透隔離 (Nested Modal Isolation)**：
   - 所有內部對話框卡片本體（`.modal-card`、`.calc-modal-sheet`、`.lock-modal-card`、`.achievement-modal` 等）一律綁定 `@click.stop`、`@mousedown.stop` 與 `@touchstart.stop`，保證卡片內部的一切互動與點擊事件絕對不會冒泡至遮罩層。
   - 當彈窗內再次喚起子彈窗（例如在編輯帳戶對話框內打開金額計算機抽屜）時，子彈窗的遮罩層全面阻斷事件冒泡，使用者點擊子彈窗以外區域時僅會關閉子彈窗，底層父級彈窗 100% 保持開啟。

### 3.3 週期性自動記帳觸發演算法
為避免前端輪詢造成的效能浪費，週期性自動記帳採用**「啟動時懶惰檢查 (Lazy-check on Startup)」**機制：
1. 當使用者打開網頁 (App 啟動) 時，從資料庫載入所有啟用的週期設定 `/recurring`。
2. 取得當前伺服器/本地時間 $T_{now}$。
3. 對於每一個週期設定 $R$：
   - 若 $T_{now} \ge R.nextExecutionDate$：
     - 建立一筆新的交易，複製 $R$ 的金額、收支分類與帳戶資訊，時間設為 $R.nextExecutionDate$，標記 `isRecurring = true`。
     - 更新該帳戶的餘額。
     - 計算下一個執行時間 $T_{next}$。根據 `frequency` (daily/weekly/monthly) 與 `interval`，將 `nextExecutionDate` 往後推移。
     - 重複上述步驟，直到 `nextExecutionDate > T_{now}`（防止使用者長達數月未登入，系統能一次補齊所有漏記的週期性交易）。
     - 更新資料庫中 $R$ 的 `nextExecutionDate`。
     - **逗逗貓通知**：將該筆自動執行的交易名稱與金額，加入「逗逗貓待報告清單」中，首頁載入完成時，逗逗貓會伸懶腰彈出對話框說：「喵～主人！剛才我趁您不在，幫您付了 $R.title$ 共 $R.amount$ 元喔！」

### 3.3.1 統計分析特定帳戶篩選機制
在「統計分析」（`Analytics.vue`）中，除了支援「月統計 / 年統計」與時間選取外，全面支援「統計帳戶範圍篩選」：
1. **帳戶範圍選擇**：
   - 透過具備 `allowAll` 模式的 `AccountDropdown` 元件，提供「全部帳戶 (所有資產)」與各個個別帳戶（現金、銀行、信用卡等）選擇。
2. **多維度獨立對帳計算**：
   - **支出交易篩選**：當指定帳戶時，僅計入扣款帳戶（`fromAccountId`）相符之支出項目。
   - **收入交易篩選**：當指定帳戶時，僅計入存入帳戶（`toAccountId`）相符之收入項目。
   - **即時圖表連動**：總支出、總收入、收支結餘、支出分類圓環佔比、收入分類圓環佔比、近 6 日支出趨勢折線圖以及年度 12 個月收支對比與明細小表皆完全即時過濾並動態重算。
3. **空狀態與情境適配**：當指定帳戶在選取週期內無任何收支紀錄時，動態顯示該帳戶專屬之空狀態提示文案。

### 3.4 錢包帳戶管理之搜尋與篩選演算法
為了在擁有多個理財帳戶時提供流暢的檢視體驗，「我的錢包」之「帳戶管理」提供高效率的搜尋與篩選：
1. **類型過濾**：使用者可透過標籤 Tab 篩選全部 (`all`) 或特定的帳戶類型：`cash` (現金), `bank` (銀行), `credit_card` (信用卡), `electronic_ticket` (電子票證)。
2. **多維度關鍵字搜尋**：當輸入搜尋 query 時，系統將對帳戶進行以下模糊比對：
   - 帳戶名稱：`name` 欄位不區分大小寫之局部匹配。
   - 帳戶 Emoji 頭像：`avatar` 欄位之精確匹配。
   - 帳戶類型名稱：比對該帳戶的類型文字（如「現金」、「銀行」、「銀行存款」、「信用卡」、「電子票證」）。
3. **無結果空狀態與自適應**：若帳戶總數為 0，則隱藏過濾與搜尋區塊以維持畫面的極簡；若有帳戶但過濾後為空，則顯示可愛貓咪插畫空狀態提示，並提供一鍵重設按鈕。

### 3.5 明細列表顯示排序演算法
使用者可透過標題列右側的 ↕️ 排序圖示按鈕開啟下拉面板，選擇以下四種排序模式之一。排序結果與類型篩選（全部 / 支出 / 收入 / 轉帳）及關鍵字搜尋正交疊加（先過濾，後排序）：

| 排序模式 (`SortMode`) | 說明 | 排序欄位 | 方向 |
| :--- | :--- | :--- | :--- |
| `date-desc` | 📅 最新（預設） | `date` | 降冪 (新→舊) |
| `date-asc`  | 📅 最舊 | `date` | 升冪 (舊→新) |
| `amount-desc`| 💰 高→低 | `amount` | 降冪 (大→小) |
| `amount-asc` | 💰 低→高 | `amount` | 升冪 (小→大) |

- **預設值**：`date-desc`（最新日期優先），與使用者最常查閱近期消費的習慣一致。
- **排序欄位定義**：`amount` 排序使用交易本體金額（`Transaction.amount`），手續費（`fee`）不納入排序計算。
- **用戶端狀態**：排序偏好僅儲存於本地元件狀態（`ref`），不持久化至 Firestore，每次開啟頁面重設為預設值。
- **下拉面板行為**：點擊排序圖示按鈕展開面板；選擇選項後自動關閉；點擊面板外部透明遮罩亦可關閉。當前排序非預設值時，排序按鈕以金色高亮標示。

### 3.5.1 明細列表搜尋收合行為
搜尋功能以收合方式呈現，預設隱藏以保持畫面簡潔：
- 點擊標題列右側 🔍 搜尋圖示按鈕展開搜尋輸入框（自動 focus）。
- 再次點擊搜尋按鈕或清空關鍵字後，輸入框以動畫收起。
- 有搜尋關鍵字時，按鈕以金色高亮提示搜尋中狀態。
- 搜尋中可勾選「🌐 跨月份搜尋」，跨月搜尋期間月份選取器自動灰化禁用。

### 3.5.2 明細列表之檢視模式（日區塊與每日彙整卡片）與排版規格
收支明細清單提供兩種檢視模式，可透過頂部 Toolbar 工具列中「搜尋🔍」與「排序📅」按鈕中間的 **「檢視模式🥞（Layers 圖示）」** 進行切換：
1. **日區塊逐項展開模式 (`detailed`)**：
   - 系統依交易的「日期（本地當日零時）」進行分組，將同一天產生的所有收支交易與轉帳明細彙整於同一個白色果凍卡片內。
   - 卡片 Header 顯示該日期的本地化標籤（例如 `5月29日`、相對時間如 `今天`）以及該日發生的總支出與總收入加總。
   - 卡片內部以虛線細線分隔各筆原始交易，直接平舖展示。
2. **每日彙整卡片模式 (`aggregated` —— 全系統預設)**：
   - 系統將同一天發生的明細進行**高度加總彙整**。在卡片主體中，會將「同一天、相同交易類型、相同扣款/存款帳戶」的交易進行金額合併加總。
   - 在卡片內展示合併後的項目清單（例如：`💸 台新 Richart (3 筆) -$1,200`），讓使用者一眼看清當天各個錢包帳戶的淨金流異動，而不被瑣碎的零星交易干擾。
   - 點擊該彙整卡片，即可展開當天的原始明細列表（包含編輯與刪除等操作按鈕），並支援再次點擊收合。
3. **單筆項目極致排版規格**：
   - 無論在 `detailed` 或是 `aggregated` 展開後的明細列表中，單筆交易項目均使用統一的 `.tx-item` 樣式結構。
   - **正圓形 Icon 規格**：使用 `width: 42px; height: 42px; min-width: 42px` 容器，以 flex 居中，防拉伸變形。
   - **字體清晰度**：分類文字為 `18px/16px`、備註文字為 `14px`、帳戶與記帳人文字為 `13px`。
   - **自訂帳戶下拉選單**：在編輯交易彈窗中，全面剔除原生的 HTML `<select>` 元件，重構為 100% 自訂的馬卡龍色果凍風下拉選單，點擊時伴有 `fade-drop` 動畫與箭頭旋轉反饋，且支援點擊全螢幕遮罩自動收合。

### 3.6 帳戶與分類自訂排序機制
帳戶和收支分類的顯示順序由使用者透過拖曳介面自由排列，並持久化至 Firestore。

**`sortOrder` 欄位賦值規則：**
1. **拖曳完成時**：依照拖曳操作後的新陣列順序，對每個文件以其在陣列中的 index 值（0, 1, 2 …）寫入 `sortOrder`。
2. **顯示時排序**：`sortOrder` 升冪排列；**未設定此欄位的項目視為 `Infinity`，排列於末尾**，確保舊資料不喪失可見性。
3. **並發保護**：拖曳更新進行中（`isReordering = true`）時，Firestore `onSnapshot` 回呼暫時忽略遠端更新，防止本地排序被覆蓋，拖曳完成後自動解除暫停。

**分類拖曳作用域：**
- **主分類**：僅在同一 `type`（支出 `expense` 或收入 `income`）內跨項目拖曳，排序互不影響。
- **子分類**：僅在同一主分類下的子分類 pill 間拖曳，無法跨主分類移動。子分類的順序以陣列（`string[]`）位置儲存，並無獨立的 `sortOrder` 欄位。

### 3.7 分類預設帳戶自動對應與成員獨立記憶機制
為加速日常記帳流程，系統提供以家庭成員為維度的分類帳戶偏好記憶與管理機制：
1. **多成員隔離 (Per-User Mapping)**：
   - 每位家庭成員 Profile 擁有獨立的 `categoryAccountMap`（儲存於 Profile settings，並具備離線優先持久化保護）。
   - 相同分類不同成員可綁定不同預設帳戶（如成員 A 記錄「捷運」預設「悠遊卡 A」，成員 B 記錄「捷運」預設「悠遊卡 B」）。
2. **階層匹配與 Fallback 策略**：
   - 記帳選取分類時，優先比對「主分類 > 子分類」專屬規則；若無特定規則，自動 Fallback 至「主分類」通用預設帳戶。
   - 收入交易自動過濾排除信用卡；帳戶若遭刪除則不予帶入。
3. **無感切換與平滑滾動**：
   - 選取分類自動帶入帳戶時，帳戶選取器（`AccountPicker`）會自動以平滑滾動（`scrollIntoView`）將選中卡片置中對齊，並呈現徽章微提示。
   - 記帳流程仍 100% 允許手動自由選擇其他帳戶；送出成功後系統自動更新當前成員此分類之最新帳戶對應。
4. **管理視窗 (`CategoryAccountMapModal`)**：
   - 於設定頁提供專屬入口，支援查看所有漸出規則、直接下拉更換帳戶、垃圾桶刪除按鈕直線對齊、固定常駐統計標頭、手動新增規則、以及一鍵從歷史記帳紀錄中提煉學習。

---

## 4. 逗逗貓吉祥物表情與互動規格

首頁上方的「逗逗貓療癒生活看板」將是一個高互動性的插畫區域。

### 4.1 表情狀態對應表
| 狀態名稱 | 表情圖示 (SVG) | 觸發條件 | 逗逗貓對話泡泡內容範例 |
| :--- | :--- | :--- | :--- |
| **開心地玩毛線** | 雙眼瞇起、微笑、逗弄毛線球 | 當月預算消耗小於 60% | 「喵～今天也是省錢的好日子呢！」<br>「主人棒棒，繼續保持喔～」 |
| **有些小緊張** | 耳朵垂下、眼神看向旁邊 | 當月預算消耗 60% ~ 80% | 「喵…預算已經花掉大半了耶…」<br>「主人要小心貓罐頭不夠吃喔…」 |
| **流汗驚嚇** | 眼睛張大、額頭流一滴汗 | 當月預算消耗 80% ~ 100% | 「喵！再花下去就沒有小魚乾了！」<br>「主人！我們要吃土了喵！」 |
| **遮眼大哭** | 貓爪捂住哭泣的眼睛 | 當月預算消耗大於 100% (超支) | 「嗚喵！！！超支啦！！！」<br>「不管了啦！逗逗貓要把信用卡藏起來了！」 |
| **伸懶腰報告** | 伸懶腰、打哈欠、搖尾巴 | 當啟動時有週期記帳自動觸發 | 「喵～主人早安！我剛剛幫您處理了 [項目] 喔！」 |

---

## 5. 全域系統操作日誌與財務稽核規格

為確保多人共同記帳時帳目清晰，專案引入了「財務核心稽核日誌」防護機制：

### 5.1 日誌 Schema 定義 (`SystemLog`)
所有全域核心操作記錄於雲端 Firestore 的 `logs` 集合與本地 LocalStorage 下（排除任何趣味摸貓/餵食娛樂日誌）。

> **🔒 Append-Only 日誌寫入機制與非阻塞背景執行**：
> - 為防止多裝置並發寫入時日誌互相覆寫，且避免離線狀態下因讀取全量日誌導致核心記帳流程卡死，系統日誌寫入一律採用 **Append-Only（單文件 `setDoc` 追加）** 模式，直接呼叫 `appendLog` 寫入，禁止「讀取全量日誌 ➔ 記憶體裁切 ➔ 覆寫全量」的雙步驟模式。
> - **⚡ 全量日常操作寫入非阻塞背景化**：為了徹底解決在離線狀態下，由於 Firestore 的 `writeBatch.commit()`、`setDoc`、或批次讀取等在等待網路時處於 `pending` 狀態，進而導致所有日常管理表單卡死、無法清空或無法彈出成功對話框的缺陷。在**所有日常管理流程（包含記帳、編輯與刪除交易、信用卡還款、新增/編輯/刪除/排序帳戶、新增/編輯/刪除/排序主子分類、週期記帳設定、以及首次載入初始化寫入等）**中，所有對資料庫寫入的操作（包括 `addDocument`、`updateDocument`、`deleteDocument`、`syncCategories`、`syncRecurring`、`saveTransactions` 等）**一律不加 `await`，改為非阻塞背景非同步執行**，並補全 `.catch` 異常處理。這保障了任何無網環境下，使用者的任何記帳、編輯、排序、刪除等操作皆可在**數毫秒內極速樂觀響應完成並彈出對話框**，網路恢復時自動由 Firestore SDK 在背景佇列中同步。

| 欄位名稱 | 型態 | 說明 |
| :--- | :--- | :--- |
| `id` | string | 日誌唯一 ID (UUID) |
| `operator` | string | 執行操作的成員暱稱（若尚未登入/系統產生則標記為 "系統自動"，週期自動扣款則標記為 "逗逗貓"） |
| `operatorAvatar`| string | 執行操作成員的可愛頭像/圖示 |
| `action` | string | 操作型態代碼（如 `create_profile`, `add_expense`, `delete_transaction` 等） |
| `description` | string | 詳細語意異動描述（詳載金額、主子分類、扣繳帳戶與期數資訊） |
| `date` | number | 操作發生的時間戳記 |

### 5.2 核心日誌觸發範疇
- **成員異動**：身分建立 (`create_profile`)、身分刪除 (`delete_profile`)、理財預算更新 (`update_budget`)、記帳雙層分類調整 (`update_categories`)。
- **核心財務**：新增支出/收入/轉帳 (`add_expense`, `add_income`, `add_transfer`)、新增信用卡分期 (`add_expense_installment`)、刪除核心明細 (`delete_transaction`, `delete_expense_installment`)、繳納信用卡帳單 (`pay_credit_card`)。
- **自動週期性扣款**：由逗逗貓為您服務記帳所產生的核心扣款交易 (`auto_recurring`)。

### 5.3 終端機日誌稽核工具
使用者可在終端機直接執行 `./view-logs`，從 Firebase 雲端資料庫拉取最新 logs，印出美輪美奐的 ANSI 彩色時間軸、操作成員暱稱與財務稽核表格。

---

## 6. 原生 Android 整合與 Live Updates 熱更新機制

為實現「離線優先」與「即時功能更新」的極致體驗，本系統設計了自建雙緩衝熱更新 (Live Updates) 與原生 WebView 橋接機制。

### 6.1 雙緩衝背景默默下載 (Double-Buffer Background Update)
1. **版本對帳**：App 啟動時或點擊檢查更新時，會發起對雲端 `version.json` 的請求，比對遠端的 `versionCode` 與本地 `localStorage` 記錄的 `dodo_app_hot_version_code`。
2. **無感背景下載**：若遠端有新版，Web 端會利用 `CapacitorHttp` 將更新包 (Base64 ZIP) 下載，寫入手機私有沙盒檔案 `update_pack_{versionCode}.zip`。
3. **實體版本指標**：下載完成後，會將新版號寫入沙盒 `current_hot_version.txt`，並更新本機 LocalStorage 標記。此時，熱更新套件已在背景部署完畢。

### 6.2 WebView basePath 重定向與實時熱重載 (Hot Reload)
為解決傳統「熱更新完必須重啟 App 才能套用」的缺陷，本系統在自訂原生插件 `DodoInstaller` 中實作了免重開即時熱重載：
1. **沙盒原生解壓**：在背景執行 ZIP 壓縮包的原生閃電解壓（若尚未解壓）。
2. **WebViewBasePath 重定向**：原生端切換 `WebViewLocalServer` 的 `BasePath` 為解壓後的沙盒路徑，重定向 WebView 加載根目錄。
3. **快取完全清除與重載**：
   - 由於 WebView 的內部快取，單純 reload 容易導致 WebView 持續加載舊的靜態資源，產生「點擊重載但完全沒有任何反應」的 Bug。
   - **核心解決方案**：原生端在重定向 basePath 後，強制調用 `activity.getBridge().getWebView().clearCache(true)` 徹底清空快取，接著執行 `activity.getBridge().getWebView().reload()`。這保證了網頁重新載入時 100% 採用沙盒中的最新資源。
4. **狀態回饋與 UI 自癒**：
   - 原生熱重載方法在 WebView 發起刷新後 resolve Promise。
   - 若原生端熱重載失敗（例如沙盒寫入失敗、檔案損毀），Web 端不再靜默失敗，而是會主動顯示可愛 of Dodo Alert 彈窗，提示使用者手動重開以完成更新。

### 6.3 原生一鍵 APK 覆蓋升級機制

為確保主人在需要升級 App 原生核心功能時，無須繁瑣地下載並手動安裝，本專案在 `DodoInstaller` 原生插件中全新實作並優化了一鍵 APK 覆蓋更新機制：

1. **強健路徑解析**：
   - 手機下載 APK 時，因不同作業系統與 Capacitor Filesystem 版本差異，檔案路徑可能帶有百分比 URL 編碼（例如 `%20` 空白）或 `file://` 與 `file:/` 等多重格式歧義。
   - **防禦性設計**：原生層接收到路徑後，強制使用 `URLDecoder.decode` 與 `Uri.parse().getPath()` 還原出 100% 準確的本機絕對實體路徑，並提供 substring 備用兜底解析，確保 100% 成功取得 APK 檔案，杜絕靜默失敗。
2. **Activity-Based 喚起機制 (ROM 相容性防禦)**：
   - 在部分高度安全限制或特殊定製的手機 ROM 中（如小米 HyperOS/MIUI、華為 HarmonyOS 等），使用 Application Context 發起 `ACTION_VIEW` 安裝 Intent 容易被系統以安全理由攔截或直接靜默忽視。
   - **核心方案**：優先使用 `getActivity().startActivity(intent)` 喚起安裝程序，並在 FileProvider 中額外補全了 `<files-path>` 設定（對應 `context.getFilesDir()`），保證安裝 Intent 的喚起率與相容性達到 100%。
3. **UI 異常回饋閉環**：
   - 當背景下載失敗或原生端發生任何權限 reject 錯誤時，Web 端將拋出錯誤並透過馬卡龍自訂 Alert 彈窗顯式告知使用者失敗原因，確保優秀的互動透明度。

---

## 7. 自動化記帳邊緣 API (Edge API) 與開放整合規範

為支援 AI Agent、iOS 捷徑、Webhook 及第三方服務進行無人化、高可靠度的自動記帳，系統在維持 Zero Host（0 主機伺服器費用）原則下，於 `cloudflare-worker/` 提供邊緣運算 API。

### 7.1 核心架構與邊緣鑑權 (Token-to-User)
1. **Google Service Account 簽署**：Worker 於邊緣快取 Google OAuth2 Access Token，直接透過 Firestore REST API `commit` 端點發送原子批次事務，不載入肥大 Firebase SDK。
2. **Token-to-User 邊緣身分防護**：
   - 每位家庭成員或 AI Agent 獲發獨立 API Token（例如 `Authorization: Bearer <TOKEN>`）。
   - Cloudflare Worker 記憶體中的 `DODO_API_USERS` 字典將 Token 嚴格映射至特定成員（包含 `userId`、`name`、`avatar`），呼叫端完全無法篡改記帳人身分，並可隨時獨立吊銷單一 Token。

### 7.2 交易原子性與餘額防漂移保證
當呼叫 `POST /api/transactions`、`PUT /api/transactions/{id}` 或 `DELETE /api/transactions/{id}` 時：
1. **單一 Commit 批次**：Worker 同時將「新增/更新/刪除 Transaction 文件」、「以 `transform.increment` 增減對應 Account 餘額」以及「追加 SystemLog 稽核日誌」打包於單一 Firestore `commit` 請求。
2. **零餘額漂移**：若資料庫任何一步操作失敗，整體事務全數回滾，杜絕傳統多步 HTTP 造成的金額失準。
3. **模糊名稱智慧匹配**：支援呼叫端傳入常用簡稱（如傳「現金」自動匹配至「倫現金」），降低 AI Agent 或捷徑輸入之難度。

### 7.3 開放標準與文件索引
- **OpenAPI 3.1 規範**：隨 Web 構建發布至 `public/api-spec.json`，供 GPT Actions、LangChain、n8n 一鍵匯入。
- **AI 檢索標準**：發布 `public/llms.txt`，供各類 LLM Agent 即時檢索專案 API 上下文。
- **詳細技術手冊**：完整 API 規格、參數定義與錯誤碼請參閱 [`API.md`](./API.md)。

