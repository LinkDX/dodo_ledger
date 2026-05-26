<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLedger } from '../composables/useLedger'
import {
  Trash2,
  PlusCircle,
  ArrowLeftRight,
  Sparkles,
  ChevronDown
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'change-tab', tab: string): void
}>()

const { transactions, accounts, deleteTransaction } = useLedger()

// 篩選類型
type FilterType = 'all' | 'expense' | 'income' | 'transfer'
const activeFilter = ref<FilterType>('all')

// 月份篩選 (預設本月)
const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

// 自動產生可用月份列表 (最近 12 個月)
const availableMonths = computed(() => {
  const set = new Set<string>()
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(now.getMonth() - i)
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  // 也補上交易資料中有的月份
  transactions.value.forEach(tx => {
    const d = new Date(tx.date)
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  })
  return [...set].sort().reverse()
})

// 經過篩選後的交易清單
const filteredTransactions = computed(() => {
  return [...transactions.value]
    .filter(tx => {
      // 月份篩選
      const d = new Date(tx.date)
      const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (txMonth !== selectedMonth.value) return false
      // 類型篩選
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
</script>

<template>
  <div class="tx-list-page pop-jelly">
    <!-- 頁首 -->
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 收支明細</h2>
    </div>

    <!-- 月份選取 -->
    <div class="month-selector-wrap card-jelly">
      <ChevronDown :size="14" class="select-chevron" />
      <select v-model="selectedMonth" class="month-select input-jelly">
        <option v-for="m in availableMonths" :key="m" :value="m">{{ m }} 帳單</option>
      </select>
    </div>

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

        <!-- 右側：金額 + 日期 + 刪除 -->
        <div class="tx-right">
          <span class="tx-amount" :style="{ color: getTxStyle(tx).color }">
            {{ getTxStyle(tx).prefix }}${{ formatCurrency(tx.amount) }}
          </span>
          <span class="tx-date">
            {{ new Date(tx.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) }}
          </span>
          <button class="btn-delete btn-jelly" @click="handleDelete(tx.id)" title="刪除此筆">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tx-list-page {
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

/* 月份選擇器 */
.month-selector-wrap {
  position: relative;
  background-color: #fff;
  padding: 0 !important;
  margin-bottom: 12px;
  overflow: hidden;
}

.select-chevron {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-text-muted);
}

.month-select {
  width: 100%;
  background-color: #fff;
  border: none;
  box-shadow: none;
  appearance: none;
  padding: 10px 36px 10px 14px;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 0;
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

.btn-delete {
  margin-top: 4px;
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
</style>
