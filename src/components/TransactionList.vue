<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLedger } from '../composables/useLedger'
import {
  Trash2,
  PlusCircle,
  ArrowLeftRight,
  Sparkles,
  Pencil,
  Check,
  X
} from 'lucide-vue-next'
import MonthYearPicker from './MonthYearPicker.vue'
import DatePicker from './DatePicker.vue'

const emit = defineEmits<{
  (e: 'change-tab', tab: string): void
}>()

const { transactions, accounts, categories: allCategories, deleteTransaction, editTransaction } = useLedger()

// 篩選類型
type FilterType = 'all' | 'expense' | 'income' | 'transfer'
const activeFilter = ref<FilterType>('all')

// 月份篩選 (預設本月)
const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

// 可選月份（從交易資料中動態收集，以最早有交易資料的月份為起點）
const availableMonths = computed(() => {
  const set = new Set<string>()
  const now = new Date()

  if (transactions.value.length === 0) {
    // 若無資料，預設包含最近 12 個月
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  } else {
    // 找出最早與最晚的交易年月
    let minYear = now.getFullYear()
    let minMonth = now.getMonth()
    let maxYear = now.getFullYear()
    let maxMonth = now.getMonth()

    transactions.value.forEach(tx => {
      const d = new Date(tx.date)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = d.getMonth()
        if (y < minYear || (y === minYear && m < minMonth)) {
          minYear = y
          minMonth = m
        }
        if (y > maxYear || (y === maxYear && m > maxMonth)) {
          maxYear = y
          maxMonth = m
        }
      }
    })

    // 生成 min 到 max 區間內所有的月份
    let currYear = minYear
    let currMonth = minMonth
    while (currYear < maxYear || (currYear === maxYear && currMonth <= maxMonth)) {
      set.add(`${currYear}-${String(currMonth + 1).padStart(2, '0')}`)
      currMonth++
      if (currMonth > 11) {
        currMonth = 0
        currYear++
      }
    }
  }

  return [...set].sort().reverse()
})

// 經過篩選後的交易清單
const filteredTransactions = computed(() => {
  return [...transactions.value]
    .filter(tx => {
      const d = new Date(tx.date)
      const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (txMonth !== selectedMonth.value) return false
      if (activeFilter.value !== 'all' && tx.type !== activeFilter.value) return false
      return true
    })
    .sort((a, b) => b.date - a.date)
})

// 本月小計
const monthSummary = computed(() => {
  const list = filteredTransactions.value
  const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  return { expense, income, net: income - expense }
})

// 取得帳戶名稱
const getAccountName = (id?: string) => {
  if (!id) return ''
  return accounts.value.find(a => a.id === id)?.name || ''
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('zh-TW').format(Math.abs(val))

const getTxStyle = (tx: any) => {
  if (tx.type === 'expense') return { color: 'var(--color-expense-text, #FF5A5A)', prefix: '-', bg: '#FFDADA', icon: '💸' }
  if (tx.type === 'income')  return { color: 'var(--color-income-text, #2C8C67)',  prefix: '+', bg: '#E1F8EB', icon: '💰' }
  return { color: '#4A7FE0', prefix: '', bg: '#E3EFFF', icon: '🔄' }
}

const handleDelete = async (txId: string) => {
  if (confirm('確定要刪除這筆記帳紀錄嗎？此操作無法復原！')) {
    await deleteTransaction(txId)
  }
}

// ===== 編輯交易功能 =====
const showEditModal = ref(false)
const editingTxId = ref('')
const editNote = ref('')
const editDateStr = ref('')
const editCategory = ref('')
const editSubCategory = ref('')
const editAmount = ref(0)
const editFromAccountId = ref('')
const editToAccountId = ref('')
const editType = ref<'expense' | 'income' | 'transfer'>('expense')

const openEditModal = (tx: any) => {
  editingTxId.value = tx.id
  editNote.value = tx.note
  editDateStr.value = new Date(tx.date).toISOString().split('T')[0]
  editCategory.value = tx.category
  editSubCategory.value = tx.subCategory || ''
  editAmount.value = tx.amount
  editFromAccountId.value = tx.fromAccountId || ''
  editToAccountId.value = tx.toAccountId || ''
  editType.value = tx.type
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingTxId.value = ''
}

const handleEditSave = async () => {
  if (!editingTxId.value) return
  if (editAmount.value <= 0) return

  await editTransaction(editingTxId.value, {
    note: editNote.value,
    date: new Date(editDateStr.value).getTime(),
    category: editCategory.value,
    subCategory: editSubCategory.value || undefined,
    amount: editAmount.value,
    fromAccountId: editFromAccountId.value || undefined,
    toAccountId: editToAccountId.value || undefined
  })
  closeEditModal()
}

// 分類選項 (根據交易類型)
const categoryOptions = computed(() =>
  allCategories.value.filter(c => c.type === editType.value)
)

const subCategoryOptions = computed(() => {
  const cat = allCategories.value.find(c => c.name === editCategory.value)
  return cat?.subCategories || []
})

// 可選帳戶
const expenseAccounts = computed(() => accounts.value)
const incomeAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'))
</script>

<template>
  <div class="tx-list-page pop-jelly">
    <!-- 頁首 -->
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 收支明細</h2>
    </div>

    <!-- 月份選取 (MonthYearPicker) -->
    <MonthYearPicker
      v-model="selectedMonth"
      :available-months="availableMonths"
      class="mb-picker"
    />

    <!-- 本月小計卡 -->
    <div class="summary-strip card-jelly">
      <div class="summary-item">
        <span class="summary-label">收入</span>
        <span class="summary-value income-val">+${{ formatCurrency(monthSummary.income) }}</span>
      </div>
      <div class="summary-divider" />
      <div class="summary-item">
        <span class="summary-label">支出</span>
        <span class="summary-value expense-val">-${{ formatCurrency(monthSummary.expense) }}</span>
      </div>
      <div class="summary-divider" />
      <div class="summary-item">
        <span class="summary-label">結餘</span>
        <span class="summary-value" :class="monthSummary.net >= 0 ? 'income-val' : 'expense-val'">
          {{ monthSummary.net >= 0 ? '+' : '-' }}${{ formatCurrency(monthSummary.net) }}
        </span>
      </div>
    </div>

    <!-- 類型篩選 Tab -->
    <div class="filter-tabs">
      <button
        v-for="f in ([
          { key: 'all',      label: '全部' },
          { key: 'expense',  label: '支出' },
          { key: 'income',   label: '收入' },
          { key: 'transfer', label: '轉帳' }
        ] as const)"
        :key="f.key"
        class="filter-tab btn-jelly"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- 交易清單 -->
    <div class="tx-list-area">
      <!-- 空狀態 -->
      <div v-if="filteredTransactions.length === 0" class="empty-state card-jelly">
        <p class="empty-emoji">🐾</p>
        <p class="empty-text">這個月還沒有符合條件的記帳喔～</p>
        <button class="btn-jelly btn-go-add" @click="emit('change-tab', 'add')">
          <PlusCircle :size="14" /> 立刻記第一筆！
        </button>
      </div>

      <!-- 交易項目 -->
      <div
        v-for="tx in filteredTransactions"
        :key="tx.id"
        class="tx-item card-jelly"
      >
        <!-- 左側：icon + 分類資訊 -->
        <div class="tx-left">
          <div class="tx-icon-circle" :style="{ backgroundColor: getTxStyle(tx).bg }">
            <ArrowLeftRight v-if="tx.type === 'transfer'" :size="15" :stroke="'#4A7FE0'" />
            <span v-else class="tx-emoji">{{ getTxStyle(tx).icon }}</span>
          </div>
          <div class="tx-info">
            <span class="tx-category">
              {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
            </span>
            <span class="tx-note">{{ tx.note || '無備註' }}</span>
            <!-- 帳戶資訊 -->
            <span class="tx-account-info">
              <template v-if="tx.type === 'transfer'">
                {{ getAccountName(tx.fromAccountId) }} → {{ getAccountName(tx.toAccountId) }}
              </template>
              <template v-else-if="tx.fromAccountId">
                {{ getAccountName(tx.fromAccountId) }}
              </template>
              <template v-else-if="tx.toAccountId">
                {{ getAccountName(tx.toAccountId) }}
              </template>
            </span>
            <!-- 記帳人標記 -->
            <span v-if="tx.createdBy" class="tag-jelly creator-tag">
              ✍️ {{ tx.createdByAvatar }} {{ tx.createdBy }}
            </span>
          </div>
        </div>

        <!-- 右側：金額 + 日期 + 操作 -->
        <div class="tx-right">
          <span class="tx-amount" :style="{ color: getTxStyle(tx).color }">
            {{ getTxStyle(tx).prefix }}${{ formatCurrency(tx.amount) }}
          </span>
          <span class="tx-date">
            {{ new Date(tx.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) }}
          </span>
          <div class="tx-actions">
            <button class="btn-edit btn-jelly" @click="openEditModal(tx)" title="編輯此筆">
              <Pencil :size="11" />
            </button>
            <button class="btn-delete btn-jelly" @click="handleDelete(tx.id)" title="刪除此筆">
              <Trash2 :size="11" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 編輯交易彈窗 ===== -->
    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal-card card-jelly pop-jelly">
        <div class="modal-header">
          <h3 class="modal-title">✏️ 編輯記帳明細</h3>
          <button class="btn-jelly btn-close-modal" @click="closeEditModal">
            <X :size="14" />
          </button>
        </div>

        <!-- 金額 -->
        <div class="form-group">
          <label class="label-cute">金額</label>
          <input v-model.number="editAmount" type="number" min="0" class="input-jelly" />
        </div>

        <!-- 備註 -->
        <div class="form-group">
          <label class="label-cute">備註</label>
          <input v-model="editNote" type="text" class="input-jelly" maxlength="30" />
        </div>

        <!-- 日期 -->
        <div class="form-group">
          <label class="label-cute">日期</label>
          <DatePicker v-model="editDateStr" />
        </div>

        <!-- 主分類 -->
        <div class="form-group">
          <label class="label-cute">主分類</label>
          <div class="cat-chips">
            <button
              v-for="cat in categoryOptions"
              :key="cat.id"
              class="btn-jelly chip-btn"
              :class="{ active: editCategory === cat.name }"
              @click="editCategory = cat.name; editSubCategory = cat.subCategories[0] || ''"
            >
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- 子分類 -->
        <div v-if="subCategoryOptions.length" class="form-group">
          <label class="label-cute">子分類</label>
          <div class="cat-chips">
            <button
              v-for="sub in subCategoryOptions"
              :key="sub"
              class="btn-jelly chip-btn"
              :class="{ active: editSubCategory === sub }"
              @click="editSubCategory = sub"
            >
              {{ sub }}
              <Check v-if="editSubCategory === sub" :size="10" stroke-width="4" />
            </button>
          </div>
        </div>

        <!-- 來源/目的帳戶 -->
        <div v-if="editType === 'expense' || editType === 'transfer'" class="form-group">
          <label class="label-cute">支付帳戶</label>
          <select v-model="editFromAccountId" class="input-jelly">
            <option value="">(不指定)</option>
            <option v-for="a in expenseAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div v-if="editType === 'income' || editType === 'transfer'" class="form-group">
          <label class="label-cute">存入帳戶</label>
          <select v-model="editToAccountId" class="input-jelly">
            <option value="">(不指定)</option>
            <option v-for="a in incomeAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn-jelly btn-cancel" @click="closeEditModal">取消</button>
          <button
            class="btn-jelly btn-confirm"
            :disabled="editAmount <= 0"
            @click="handleEditSave"
          >
            儲存變更 ✔
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tx-list-page {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 14px;
}

.page-title {
  font-size: 20px;
  font-weight: 800;
}

/* 月份選取器 */
.mb-picker {
  margin-bottom: 12px;
}

/* 小計欄 */
.summary-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12px !important;
  background-color: #fff;
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.summary-label {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.summary-value {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.income-val  { color: #2C8C67; }
.expense-val { color: #FF5A5A; }

.summary-divider {
  width: 1px;
  height: 32px;
  background-color: var(--color-border);
}

/* 類型篩選 Tab */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.filter-tab {
  flex: 1;
  padding: 8px 4px !important;
  font-size: 12px;
  background-color: #fff;
}

.filter-tab.active {
  background-color: var(--color-accent-gold) !important;
  border-width: 2.5px;
}

/* 交易清單 */
.tx-list-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 空狀態 */
.empty-state {
  text-align: center;
  padding: 40px 20px !important;
}

.empty-emoji {
  font-size: 36px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 16px;
  color: var(--color-text-muted);
}

.btn-go-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-accent-gold) !important;
  padding: 10px 20px !important;
  font-size: 13px;
}

/* 交易項目卡 */
.tx-item {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px !important;
  margin-bottom: 0 !important;
  background-color: #fff;
}

.tx-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.tx-icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: var(--border-width) solid var(--color-border);
}

.tx-emoji {
  font-size: 16px;
}

.tx-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tx-category {
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-note {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-account-info {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.creator-tag {
  font-size: 9px !important;
  padding: 1px 6px !important;
  width: fit-content;
}

/* 右側 */
.tx-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 10px;
}

.tx-amount {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.tx-date {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.tx-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.btn-edit {
  width: 26px;
  height: 26px;
  padding: 0 !important;
  background-color: #EEF4FF !important;
  color: #4A7FE0;
  border-color: #A9C9FF !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-delete {
  width: 26px;
  height: 26px;
  padding: 0 !important;
  background-color: #FFF0F0 !important;
  color: #FF5A5A;
  border-color: #FFB4B4 !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-inline {
  width: 18px;
  height: 18px;
  vertical-align: -3px;
  margin-right: 4px;
}

/* ===== 編輯彈窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 30, 27, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 0;
}

.modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  overflow-y: auto;
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  padding: 20px !important;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: 800;
}

.btn-close-modal {
  width: 30px;
  height: 30px;
  padding: 0 !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: 50% !important;
}

.form-group {
  margin-bottom: 14px;
}

.label-cute {
  font-size: 12px;
  font-weight: 800;
  display: block;
  margin-bottom: 6px;
  padding-left: 2px;
}

.cat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-btn {
  padding: 4px 10px !important;
  font-size: 11px;
  background-color: var(--color-bg-warm) !important;
  border-radius: 20px !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.chip-btn.active {
  background-color: var(--color-income) !important;
  border-width: 2.5px;
  font-weight: 800;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.btn-cancel {
  flex: 1;
  background-color: var(--color-bg-warm) !important;
  padding: 12px !important;
}

.btn-confirm {
  flex: 2;
  background-color: var(--color-income) !important;
  padding: 12px !important;
  font-size: 13px;
  font-weight: 800;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}
</style>
