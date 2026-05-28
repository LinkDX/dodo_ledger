# Dodo Ledger 記帳服務 —— 系統規格書 (SPEC)

本文件詳細記載 Dodo Ledger 記帳服務的系統規格、核心商業邏輯演算法與資料庫 Schema 定義。旨在為 Web SPA 端與未來 Android App 端提供一致性的業務邏輯標準。

---

## 1. 系統架構與技術棧

- **前端框架**：Vite + Vue 3 + TypeScript
- **樣式方案**：Vanilla CSS + Scoped Styles（繪本插畫風設計，大圓角、果凍微動畫、逗逗貓主視覺）
- **自動化測試**：Vitest 測試框架
- **資料儲存**：雙模式（LocalStorage 本地體驗模式 / Firebase 雲端同步模式）
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
  "monthlyBudget": 20000
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

### 3.4 錢包帳戶管理之搜尋與篩選演算法
為了在擁有多個理財帳戶時提供流暢的檢視體驗，「我的錢包」之「帳戶管理」提供高效率的搜尋與篩選：
1. **類型過濾**：使用者可透過標籤 Tab 篩選全部 (`all`) 或特定的帳戶類型：`cash` (現金), `bank` (銀行), `credit_card` (信用卡), `electronic_ticket` (電子票證)。
2. **多維度關鍵字搜尋**：當輸入搜尋 query 時，系統將對帳戶進行以下模糊比對：
   - 帳戶名稱：`name` 欄位不區分大小寫之局部匹配。
   - 帳戶 Emoji 頭像：`avatar` 欄位之精確匹配。
   - 帳戶類型名稱：比對該帳戶的類型文字（如「現金」、「銀行」、「銀行存款」、「信用卡」、「電子票證」）。
3. **無結果空狀態與自適應**：若帳戶總數為 0，則隱藏過濾與搜尋區塊以維持畫面的極簡；若有帳戶但過濾後為空，則顯示可愛貓咪插畫空狀態提示，並提供一鍵重設按鈕。

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
所有全域核心操作記錄於雲端 Firestore 與本地 LocalStorage 下的 `logs` 欄位（排除任何趣味摸貓/餵食娛樂日誌）。

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
