# 多人並發衝突解決架構規格書

> **適用版本**：Web 2.2.0+  
> **最後更新**：2025-01  
> **相關實作**：`src/services/db.ts`、`src/composables/useLedger.ts`

---

## 1. 背景與問題定義

本專案為多人共同記帳應用，2-4 位家庭成員可能同時在不同裝置上操作。原有架構使用 `writeCollection` 全量覆寫模式（讀取所有文件 → 比對 ID → 刪除缺少的 → 覆寫全部），在並發場景下存在嚴重的資料一致性風險。

### 1.1 已識別的衝突場景

| # | 衝突場景 | 根本原因 | 嚴重度 |
|---|---|---|---|
| 1 | 多人同時記帳導致交易丟失 | 全量覆寫刪除了其他裝置剛新增的文件 | 🔴 Critical |
| 2 | 帳戶餘額並發漂移 | 以絕對值覆寫 `balance` 欄位，丟失其他裝置的增減 | 🔴 Critical |
| 3 | 編輯/刪除交易時餘額不一致 | 交易刪除與餘額回滾分兩步完成，中間可能崩潰 | 🔴 Critical |
| 4 | 跨文件操作非原子 | 寫入交易成功但餘額更新失敗（網路中斷） | 🟡 High |
| 5 | 週期記帳多裝置重複執行 | 多台裝置同時冷啟動，各自觸發同一筆週期交易 | 🟡 High |
| 6 | 信用卡繳款與新消費並發 | 繳款寫入瞬間另一裝置新增消費，餘額計算錯誤 | 🟡 High |
| 7 | 離線重連覆蓋雲端資料 | 離線期間本地快取過時，重連後全量覆寫雲端 | 🟡 High |
| 8 | 分類修改互相覆蓋 | 兩人同時編輯分類列表，後者覆蓋前者 | 🟠 Medium |
| 9 | 系統日誌互相覆蓋 | 日誌寫入使用陣列覆寫模式 | 🟠 Medium |

---

## 2. 核心設計原則

### 2.1 原子寫入（Atomic Batch Write）
所有涉及「交易文件 + 帳戶餘額」的操作必須在同一原子邊界內完成。Firestore `writeBatch` 提供「全或無」語義——batch 內的所有操作要麼全部成功，要麼全部失敗回滾。

**禁止**：先 `syncTransactions()` 再 `syncAccounts()` 的兩步驟模式。

### 2.2 增量式餘額（Delta-based Balance）
帳戶餘額變更一律使用 Firestore `increment()` 原子運算子（或本地模式的 delta 累加），**禁止以完整 `balance` 值覆寫**。

`increment()` 是 Firestore 提供的伺服器端原子運算，即使多個客戶端同時對同一欄位執行 increment，結果都是正確的累加值。

### 2.3 Per-document 操作（非全量覆寫）
新增/修改/刪除操作一律針對單一文件，禁止使用 `writeCollection` 全量覆寫模式。`writeCollection` 僅保留於初始化/批次匯入場景。

### 2.4 即時同步（Real-time Sync）
帳戶、交易、週期記帳、分類四大集合全面啟用 Firestore `onSnapshot` 即時監聽，確保任何裝置的變更在數秒內同步至所有已連線的客戶端。

### 2.5 樂觀更新 + 遠端確認
UI 立即更新本地狀態（樂觀更新），同時原子寫入 Firestore。遠端確認通過 `onSnapshot` 回調自動回補，確保即使本地操作失敗也能自動恢復至正確狀態。

---

## 3. DatabaseService 原子 API 規範

### 3.1 介面定義

```typescript
interface DatabaseService {
  // === 單一文件 CRUD（不影響其他文件）===
  addDocument<T extends { id: string }>(colName: string, item: T): Promise<void>;
  updateDocument<T extends { id: string }>(colName: string, id: string, data: Partial<T>): Promise<void>;
  deleteDocument(colName: string, id: string): Promise<void>;

  // === 原子批次：交易 + 餘額在同一事務中完成 ===
  atomicBatchWrite(ops: AtomicOp[]): Promise<void>;

  // === 條件寫入：防止週期記帳重複執行 ===
  claimDocument<T extends { id: string }>(colName: string, item: T): Promise<boolean>;

  // === 即時同步訂閱 ===
  subscribeCollection<T>(colName: string, callback: (items: T[]) => void): () => void;

  // === 日誌追加（不讀取-覆蓋）===
  appendLog(log: SystemLog): Promise<void>;
}
```

### 3.2 AtomicOp 操作類型

```typescript
type AtomicOp =
  | { type: 'addTransaction'; transaction: Transaction }
  | { type: 'deleteTransaction'; transactionId: string }
  | { type: 'updateTransaction'; transactionId: string; data: Partial<Transaction> }
  | { type: 'balanceDelta'; deltas: BalanceDelta[] }  // increment() 原子增減
  | { type: 'updateRecurring'; recurringId: string; data: Partial<RecurringTransaction> }

interface BalanceDelta {
  accountId: string;
  delta: number;  // 正值=增加，負值=減少
}
```

### 3.3 各方法行為說明

| 方法 | Firestore 實作 | 原子性保證 | 失敗行為 |
|---|---|---|---|
| `addDocument` | `setDoc(doc(ref, id), data)` | 單文件原子 | 拋出異常 |
| `updateDocument` | `setDoc(doc(ref, id), data, { merge: true })` | 單文件原子 | 拋出異常 |
| `deleteDocument` | `deleteDoc(doc(ref, id))` | 單文件原子 | 拋出異常 |
| `atomicBatchWrite` | `writeBatch` + `increment()` | 多文件全或無 | 全部回滾 |
| `claimDocument` | `runTransaction` (讀-判-寫) | 序列化隔離 | 回傳 `false` |
| `subscribeCollection` | `onSnapshot(collection)` | 最終一致 | 自動重連 |
| `appendLog` | `setDoc(doc(ref, id), data)` | 單文件原子 | 拋出異常 |

---

## 4. 使用範式

### 4.1 記帳操作原子寫入

凡是新增/刪除/編輯交易，一律使用 `atomicWriteTransactionWithBalance` helper：

```typescript
// ✅ 正確：原子寫入（交易 + 餘額在同一 batch）
await atomicWriteTransactionWithBalance(
  [{ type: 'addTransaction', transaction: newTx }],
  [{ accountId: 'acct_cash', delta: -500 }]  // 使用 increment()
)

// ❌ 禁止：兩步驟寫入（有並發漂移風險）
await syncTransactions()
await syncAccounts()
```

### 4.2 編輯交易的增量計算

編輯交易時，需計算「舊交易的反向 delta + 新交易的正向 delta」：

```typescript
// 範例：將 500 元支出改為 300 元支出
const oldDelta = +500  // 反向：支出回沖（增加餘額）
const newDelta = -300  // 正向：新支出（減少餘額）

await atomicWriteTransactionWithBalance(
  [{ type: 'updateTransaction', transactionId: tx.id, data: updatedFields }],
  [{ accountId: tx.accountId, delta: oldDelta + newDelta }]  // net: +200
)
```

### 4.3 週期記帳防重複執行

```typescript
// 確定性 ID 確保全球唯一
const txId = `tx_auto_${rec.id}_${nextRunDate}`

// claimDocument: 只有第一個到達的裝置能成功寫入
const claimed = await db.claimDocument('transactions', { id: txId, ...txData })

if (claimed) {
  // 寫入成功 → 繼續更新餘額
  await db.atomicBatchWrite([
    { type: 'balanceDelta', deltas: [{ accountId, delta }] },
    { type: 'updateRecurring', recurringId: rec.id, data: { lastRun: nextRunDate } }
  ])
} else {
  // 其他裝置已執行 → 靜默跳過
}
```

### 4.4 轉帳操作（雙帳戶原子性）

```typescript
// 轉帳：來源扣款 + 目標入帳，必須在同一 batch
await atomicWriteTransactionWithBalance(
  [{ type: 'addTransaction', transaction: transferTx }],
  [
    { accountId: fromAccount, delta: -amount },
    { accountId: toAccount, delta: +amount }
  ]
)
```

---

## 5. 即時同步訂閱架構

### 5.1 訂閱初始化

在 `loadLedgerData` 中，對四大集合建立 `onSnapshot` 監聽：

```typescript
// 帳戶即時同步
unsubAccounts = db.subscribeCollection<Account>('accounts', (items) => {
  accounts.value = items
})

// 交易即時同步
unsubTransactions = db.subscribeCollection<Transaction>('transactions', (items) => {
  transactions.value = items
})

// 週期記帳即時同步
unsubRecurring = db.subscribeCollection<RecurringTransaction>('recurring', (items) => {
  recurringTransactions.value = items
})

// 分類即時同步
unsubCategories = db.subscribeCollection<Category>('categories', (items) => {
  categories.value = items
})
```

### 5.2 防無限更新迴圈

`subscribeCollection` 的回調中使用 `JSON.stringify` 比對，僅在資料實際變更時觸發 Vue 響應式更新，避免 `onSnapshot` 頻繁觸發造成的無限渲染迴圈。

### 5.3 生命週期管理

- 登入/切換身分時：呼叫 `loadLedgerData` 建立訂閱
- 登出/清除時：呼叫 `clearLedgerData` 取消所有訂閱（執行 `unsub()` 函數）

---

## 6. 解決方案對照表

| # | 衝突場景 | 解決方案 | 實作位置 |
|---|---|---|---|
| 1 | 多人同時記帳導致交易丟失 | Per-document `addDocument` | `useLedger.ts` → `addTransaction` |
| 2 | 帳戶餘額並發漂移 | `increment()` 原子運算 | `db.ts` → `atomicBatchWrite` |
| 3 | 編輯/刪除交易餘額不一致 | `atomicBatchWrite` 原子邊界 | `useLedger.ts` → `editTransaction` / `deleteTransaction` |
| 4 | 跨文件操作非原子（崩潰中斷） | `writeBatch` 全或無語義 | `db.ts` → `FirestoreDatabaseService` |
| 5 | 週期記帳多裝置重複執行 | `claimDocument` + `runTransaction` | `useLedger.ts` → `checkAndTriggerRecurring` |
| 6 | 信用卡繳款與新消費並發 | 原子繳款寫入 | `useLedger.ts` → `payCreditCardBill` |
| 7 | 離線重連覆蓋雲端資料 | `onSnapshot` 即時同步 + per-doc | `useLedger.ts` → `loadLedgerData` |
| 8 | 分類修改互相覆蓋 | `updateDocument` merge 模式 | `db.ts` → `updateDocument` |
| 9 | 系統日誌互相覆蓋 | `appendLog` 單文件追加 | `db.ts` → `appendLog` |

---

## 7. 測試覆蓋

衝突解決相關測試位於 `tests/conflict-resolution.test.ts`，包含 16 項測試案例：

| 測試群組 | 測試內容 |
|---|---|
| 原子 API 基礎 | addDocument、updateDocument、deleteDocument |
| claimDocument | 首次成功、重複 claim 回傳 false |
| atomicBatchWrite | 多操作原子寫入 |
| appendLog | 日誌追加不覆寫 |
| 並發新增 | 兩筆獨立交易互不干擾 |
| 轉帳原子性 | 雙帳戶同步增減 |
| 刪除回滾 | 刪除交易時餘額正確回沖 |
| 編輯 delta | 舊值反向 + 新值正向的 net delta |
| 帳戶切換 | 切換身分後清除訂閱 |

---

## 8. 未來擴展方向

以下為目前已識別但尚未實作的進階衝突解決策略（家庭記帳場景下優先度較低）：

- **伺服器端時間戳記 (`serverTimestamp()`)**：目前使用客戶端 `Date.now()`，在裝置時鐘偏差較大時可能影響排序。家庭場景可接受。
- **欄位級衝突偵測（Field-level CAS）**：目前為文件級原子操作。若未來需要同時編輯同一交易的不同欄位，可引入 Firestore Security Rules + 欄位版本號。
- **離線佇列與衝突合併 UI**：目前離線操作依賴 Firestore 內建的離線持久化。若需更精細的衝突提示（如「張三剛刪除了這筆交易」），可擴展本地操作佇列。
