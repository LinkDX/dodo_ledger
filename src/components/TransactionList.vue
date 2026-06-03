<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useLedger } from '../composables/useLedger'
import { useConfirm } from '../composables/useConfirm'
import {
  Trash2,
  PlusCircle,
  ArrowLeftRight,
  Sparkles,
  Pencil,
  Check,
  X,
  Search,
  ArrowUpDown,
  Layers,
  ChevronDown
} from 'lucide-vue-next'
import MonthYearPicker from './MonthYearPicker.vue'
import DatePicker from './DatePicker.vue'

const props = defineProps<{
  activeTab?: string
}>()

const emit = defineEmits<{
  (e: 'change-tab', tab: string): void
}>()

const { 
  transactions, 
  accounts, 
  visibleAccounts,
  categories: allCategories, 
  deleteTransaction, 
  editTransaction, 
  isTransactionPaid,
  addTxPrefilledDate 
} = useLedger()
const { showConfirm } = useConfirm()

// 篩選類型
type FilterType = 'all' | 'expense' | 'income' | 'transfer'
const activeFilter = ref<FilterType>('all')

// 排序方式
type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
const sortMode = ref<SortMode>('date-desc')

const sortOptions: { key: SortMode; label: string }[] = [
  { key: 'date-desc',   label: '📅 最新' },
  { key: 'date-asc',    label: '📅 最舊' },
  { key: 'amount-desc', label: '💰 高→低' },
  { key: 'amount-asc',  label: '💰 低→高' },
]

// UI 面板開關
const searchOpen = ref(false)
const sortOpen = ref(false)
const viewModeOpen = ref(false)

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) searchQuery.value = ''
  sortOpen.value = false
  viewModeOpen.value = false
}

function toggleSort() {
  sortOpen.value = !sortOpen.value
  searchOpen.value = false
  viewModeOpen.value = false
}

function toggleViewModeDropdown() {
  viewModeOpen.value = !viewModeOpen.value
  searchOpen.value = false
  sortOpen.value = false
}

function selectSort(key: SortMode) {
  sortMode.value = key
  sortOpen.value = false
}

// 搜尋功能
const searchQuery = ref('')
const searchCrossMonth = ref(true) // 預設開啟跨月搜尋

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
  const query = searchQuery.value.trim().toLowerCase()
  return [...transactions.value]
    .filter(tx => {
      // 1. 月份篩選（在未輸入關鍵字，或使用者未勾選「跨月份搜尋」時啟用）
      if (!query || !searchCrossMonth.value) {
        const d = new Date(tx.date)
        const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (txMonth !== selectedMonth.value) return false
      }

      // 2. 類型篩選
      if (activeFilter.value !== 'all' && tx.type !== activeFilter.value) return false

      // 3. 搜尋關鍵字篩選
      if (query) {
        const noteMatch = tx.note?.toLowerCase().includes(query)
        const catMatch = tx.category?.toLowerCase().includes(query)
        const subCatMatch = tx.subCategory?.toLowerCase().includes(query)
        const amountMatch = String(tx.amount).includes(query)
        
        // 帳戶名稱比對
        const fromAccountName = getAccountName(tx.fromAccountId).toLowerCase()
        const toAccountName = getAccountName(tx.toAccountId).toLowerCase()
        const accountMatch = fromAccountName.includes(query) || toAccountName.includes(query)
        
        // 記帳人比對
        const creatorMatch = tx.createdBy?.toLowerCase().includes(query)

        if (!noteMatch && !catMatch && !subCatMatch && !amountMatch && !accountMatch && !creatorMatch) {
          return false
        }
      }
      return true
    })
    .sort((a, b) => {
      // 先把 date 截斷到「本地當日零時」，避免轉帳用 Date.now() 和一般交易用 UTC midnight 混排
      const floorDay = (ts: number) => {
        const d = new Date(ts)
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      }
      switch (sortMode.value) {
        case 'date-asc': {
          const diff = floorDay(a.date) - floorDay(b.date)
          return diff !== 0 ? diff : (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
        }
        case 'amount-desc': return b.amount - a.amount
        case 'amount-asc':  return a.amount - b.amount
        default: {  // date-desc
          const diff = floorDay(b.date) - floorDay(a.date)
          return diff !== 0 ? diff : (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        }
      }
    })
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
  if (await showConfirm('確定要刪除這筆記帳紀錄嗎？此操作無法復原！', '🗑️ 刪除交易紀錄')) {
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

// 自訂帳戶選單狀態
const editFromAccountOpen = ref(false)
const editToAccountOpen = ref(false)

const selectedFromAccount = computed(() => {
  return expenseAccounts.value.find(a => a.id === editFromAccountId.value)
})

const selectedToAccount = computed(() => {
  return incomeAccounts.value.find(a => a.id === editToAccountId.value)
})

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
  editFromAccountOpen.value = false
  editToAccountOpen.value = false
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
const expenseAccounts = computed(() => visibleAccounts.value)
const incomeAccounts = computed(() => visibleAccounts.value.filter(a => a.type !== 'credit_card'))

// ===== 檢視模式與分組彙整邏輯 =====
import { type TransactionType, type Transaction } from '../types'
const viewMode = ref<'detailed' | 'aggregated'>((localStorage.getItem('tx_list_view_mode') as any) || 'aggregated')

const setViewMode = (mode: 'detailed' | 'aggregated') => {
  viewMode.value = mode
  localStorage.setItem('tx_list_view_mode', mode)
}

const expandedDays = ref<Record<string, boolean>>({})
const toggleDayExpand = (dateStr: string) => {
  expandedDays.value[dateStr] = !expandedDays.value[dateStr]
}

// 每日彙整相同帳戶收支與轉帳項目
interface AggregatedItem {
  id: string
  accountId?: string
  toAccountId?: string
  type: TransactionType
  amount: number
  count: number
  accountName: string
  toAccountName?: string
  isTransfer: boolean
}

const aggregateDayTransactions = (txs: Transaction[]): AggregatedItem[] => {
  const map = new Map<string, AggregatedItem>()
  
  txs.forEach(tx => {
    let key = ''
    if (tx.type === 'expense') {
      key = `expense_${tx.fromAccountId || 'unknown'}`
    } else if (tx.type === 'income') {
      key = `income_${tx.toAccountId || 'unknown'}`
    } else { // transfer
      key = `transfer_${tx.fromAccountId || 'unknown'}_${tx.toAccountId || 'unknown'}`
    }
    
    if (map.has(key)) {
      const item = map.get(key)!
      item.amount += tx.amount
      item.count += 1
    } else {
      map.set(key, {
        id: key,
        accountId: tx.type === 'expense' || tx.type === 'transfer' ? tx.fromAccountId : undefined,
        toAccountId: tx.type === 'income' || tx.type === 'transfer' ? tx.toAccountId : undefined,
        type: tx.type,
        amount: tx.amount,
        count: 1,
        accountName: tx.type === 'income' ? getAccountName(tx.toAccountId) : getAccountName(tx.fromAccountId),
        toAccountName: tx.type === 'transfer' ? getAccountName(tx.toAccountId) : undefined,
        isTransfer: tx.type === 'transfer'
      })
    }
  })
  
  return Array.from(map.values())
}

// 分組交易資料
const groupedTransactions = computed(() => {
  const groups: {
    dateStr: string
    dateLabel: string
    relativeLabel: string
    items: Transaction[]
    aggregatedItems: AggregatedItem[]
    incomeTotal: number
    expenseTotal: number
    isExpanded: boolean
  }[] = []
  
  const txs = filteredTransactions.value
  
  // 建立日期 Map
  const map = new Map<string, Transaction[]>()
  txs.forEach(tx => {
    const d = new Date(tx.date)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map.has(dateStr)) {
      map.set(dateStr, [])
    }
    map.get(dateStr)!.push(tx)
  })
  
  // 保持排序順序
  const processedDays = new Set<string>()
  txs.forEach(tx => {
    const d = new Date(tx.date)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    
    if (processedDays.has(dateStr)) return
    processedDays.add(dateStr)
    
    const dayTxs = map.get(dateStr) || []
    const incomeTotal = dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expenseTotal = dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const aggregatedItems = aggregateDayTransactions(dayTxs)
    
    const dateObj = new Date(tx.date)
    const month = dateObj.getMonth() + 1
    const date = dateObj.getDate()
    const dayNames = ['日', '一', '二', '三', '四', '五', '六']
    const dayOfWeek = dayNames[dateObj.getDay()]
    const dateLabel = `${month}月${date}日 星期${dayOfWeek}`
    
    let relativeLabel = ''
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    if (dateStr === todayStr) {
      relativeLabel = '今天 🐾'
    } else if (dateStr === yesterdayStr) {
      relativeLabel = '昨天'
    }
    
    groups.push({
      dateStr,
      dateLabel,
      relativeLabel,
      items: dayTxs,
      aggregatedItems,
      incomeTotal,
      expenseTotal,
      isExpanded: !!expandedDays.value[dateStr]
    })
  })
  
  return groups
})

// ===== 快速記帳直接帶入日期 =====
const quickAddForDate = (dateStr: string) => {
  addTxPrefilledDate.value = dateStr
  emit('change-tab', 'add')
}

// ===== 快速定位跳轉日期 =====
const locateOpen = ref(false)
const flashingDay = ref('')

const toggleLocate = () => {
  locateOpen.value = !locateOpen.value
  searchOpen.value = false
  sortOpen.value = false
  viewModeOpen.value = false
}

// 用於快速跳轉的日期列表 (按日期升序排列，即 1 日在最前)
const sortedGroupsForJump = computed(() => {
  return [...groupedTransactions.value].sort((a, b) => {
    return new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
  })
})

const scrollToDay = async (dateStr: string) => {
  locateOpen.value = false
  
  // 取得目標元素
  await nextTick()
  const el = document.getElementById(`day-card-${dateStr}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    
    // 觸發閃爍特效
    flashingDay.value = dateStr
    setTimeout(() => {
      flashingDay.value = ''
    }, 1500)
  }
}

// ===== 回到頂部功能 =====
const showScrollTopBtn = ref(false)

const handleScroll = () => {
  // 1. 如果當前不是明細分頁，按鈕絕對不可以出現！
  if (props.activeTab !== 'transactions') {
    showScrollTopBtn.value = false
    return
  }
  
  // 2. 同時測量主容器與 window/body 滾動高度，滿足其一即代表已下捲
  const mainEl = document.querySelector('.app-main-content')
  const mainScrollTop = mainEl ? mainEl.scrollTop : 0
  const winScrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
  
  showScrollTopBtn.value = mainScrollTop > 300 || winScrollTop > 300
}

const scrollToTop = () => {
  // 1. 點擊瞬間立即使按鈕消失，提供零延遲的反饋感！
  showScrollTopBtn.value = false
  
  // 2. 一鍵平滑滾動所有可能的滾動載體，保證 100% 成功回到頂部
  window.scrollTo({ top: 0, behavior: 'smooth' })
  document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
  document.body.scrollTo({ top: 0, behavior: 'smooth' })
  
  const mainEl = document.querySelector('.app-main-content')
  if (mainEl) {
    mainEl.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 監聽 Tab 切換，自動收合每日彙整項目，並同步檢查/重設回到頂部按鈕狀態
watch(() => props.activeTab, async (newTab) => {
  if (newTab === 'transactions') {
    expandedDays.value = {}
    await nextTick()
    handleScroll()
  } else {
    showScrollTopBtn.value = false
  }
})

onMounted(() => {
  // 使用捕獲（capture: true）以確保不論在哪個容器滾動，都能精準監聽到滾動事件
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<template>
  <div class="tx-list-page pop-jelly">
    <!-- 頁首 + 搜尋/檢視模式/排序按鈕 -->
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 收支明細</h2>
      <div class="toolbar-actions">
        <!-- 搜尋按鈕 -->
        <button
          class="toolbar-icon-btn btn-jelly"
          :class="{ active: searchOpen || searchQuery }"
          @click="toggleSearch"
          title="搜尋"
        >
          <Search :size="16" />
        </button>

        <!-- 檢視模式按鈕 + 下拉 (放在搜尋與排序中間) -->
        <div class="sort-wrapper">
          <button
            class="toolbar-icon-btn btn-jelly"
            :class="{ active: viewModeOpen }"
            @click="toggleViewModeDropdown"
            title="檢視模式"
          >
            <Layers :size="16" />
          </button>
          <!-- 檢視模式下拉選單 -->
          <Transition name="dropdown">
            <div v-if="viewModeOpen" class="sort-dropdown card-jelly" style="min-width: 120px; right: 0;">
              <button
                class="sort-option btn-jelly"
                :class="{ active: viewMode === 'aggregated' }"
                @click="setViewMode('aggregated'); viewModeOpen = false"
              >
                📊 每日彙整
              </button>
              <button
                class="sort-option btn-jelly"
                :class="{ active: viewMode === 'detailed' }"
                @click="setViewMode('detailed'); viewModeOpen = false"
              >
                📑 逐項明細
              </button>
            </div>
          </Transition>
        </div>

        <!-- 排序按鈕 + 下拉 -->
        <div class="sort-wrapper">
          <button
            class="toolbar-icon-btn btn-jelly"
            :class="{ active: sortOpen || sortMode !== 'date-desc' }"
            @click="toggleSort"
            title="排序"
          >
            <ArrowUpDown :size="16" />
          </button>
          <!-- 排序下拉選單 -->
          <Transition name="dropdown">
            <div v-if="sortOpen" class="sort-dropdown card-jelly">
              <button
                v-for="s in sortOptions"
                :key="s.key"
                class="sort-option btn-jelly"
                :class="{ active: sortMode === s.key }"
                @click="selectSort(s.key)"
              >
                {{ s.label }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- 快速定位按鈕 + 下拉 -->
        <div class="sort-wrapper">
          <button
            class="toolbar-icon-btn btn-jelly"
            :class="{ active: locateOpen }"
            @click="toggleLocate"
            title="快速跳轉日期"
          >
            <span style="font-size: 16px; display: inline-block; transform: translateY(-1px);">📍</span>
          </button>
          <!-- 快速定位日期網格下拉選單 -->
          <Transition name="dropdown">
            <div v-if="locateOpen" class="sort-dropdown card-jelly" style="min-width: 220px; right: 0; padding: 12px !important;">
              <div style="font-size: 11px; font-weight: 800; margin-bottom: 6px; color: var(--color-text-dark); text-align: left;">
                📅 當月有記帳日期快速定位：
              </div>
              <div v-if="sortedGroupsForJump.length === 0" style="font-size: 10px; color: var(--color-text-muted); text-align: center; padding: 10px 0;">
                (本月尚無記帳紀錄)
              </div>
              <div v-else class="locate-days-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 160px; overflow-y: auto; padding: 2px;">
                <button
                  v-for="group in sortedGroupsForJump"
                  :key="group.dateStr"
                  class="btn-jelly"
                  style="font-size: 10px; padding: 5px 0 !important; background-color: var(--color-bg-warm) !important; border: 1.2px solid var(--color-border); border-radius: 8px; font-weight: 800; text-align: center; white-space: nowrap;"
                  @click="scrollToDay(group.dateStr)"
                >
                  {{ new Date(group.dateStr).getDate() }}日
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- 月份選取 (全寬) -->
    <MonthYearPicker
      v-model="selectedMonth"
      :available-months="availableMonths"
      class="mb-picker"
      :style="searchQuery && searchCrossMonth ? 'opacity: 0.55; pointer-events: none;' : ''"
    />

    <!-- 搜尋欄（折疊） -->
    <Transition name="slide-down">
      <div v-if="searchOpen" class="search-bar card-jelly">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋備註、分類、帳戶、金額..."
            class="search-input"
            autofocus
          />
          <button v-if="searchQuery" class="btn-clear btn-jelly" @click="searchQuery = ''" title="清除搜尋">
            <X :size="12" />
          </button>
        </div>
        <div v-if="searchQuery" class="search-options">
          <label class="search-toggle btn-jelly">
            <input type="checkbox" v-model="searchCrossMonth" />
            <span class="toggle-text">🌐 跨月份搜尋</span>
          </label>
          <span class="results-count">
            共 {{ filteredTransactions.length }} 筆
          </span>
        </div>
      </div>
    </Transition>

    <!-- 排序、定位與檢視模式下拉遮罩 -->
    <div v-if="sortOpen" class="sort-overlay" @click="sortOpen = false" />
    <div v-if="viewModeOpen" class="sort-overlay" @click="viewModeOpen = false" />
    <div v-if="locateOpen" class="sort-overlay" @click="locateOpen = false" />

    <!-- 本月小計卡 -->
    <div class="summary-strip card-jelly">
      <div class="summary-item">
        <span class="summary-label">{{ searchQuery ? '結果收入' : '收入' }}</span>
        <span class="summary-value income-val">+${{ formatCurrency(monthSummary.income) }}</span>
      </div>
      <div class="summary-divider" />
      <div class="summary-item">
        <span class="summary-label">{{ searchQuery ? '結果支出' : '支出' }}</span>
        <span class="summary-value expense-val">-${{ formatCurrency(monthSummary.expense) }}</span>
      </div>
      <div class="summary-divider" />
      <div class="summary-item">
        <span class="summary-label">{{ searchQuery ? '結果結餘' : '結餘' }}</span>
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
        <p class="empty-emoji">{{ searchQuery ? '🔍' : '🐾' }}</p>
        <p class="empty-text">
          {{ searchQuery ? `找不到符合關鍵字「${searchQuery}」的記帳喔～` : '這個月還沒有符合條件的記帳喔～' }}
        </p>
        <button v-if="!searchQuery" class="btn-jelly btn-go-add" @click="emit('change-tab', 'add')">
          <PlusCircle :size="14" /> 立刻記第一筆！
        </button>
        <button v-else class="btn-jelly btn-go-add" @click="searchQuery = ''">
          清除搜尋條件 🧹
        </button>
      </div>

      <!-- 情況 1：使用金額排序，降級為扁平展示 -->
      <template v-else-if="sortMode.includes('amount')">
        <div
          v-for="tx in filteredTransactions"
          :key="tx.id"
          class="tx-item card-jelly"
        >
          <!-- 左側：icon + 分類資訊 -->
          <div class="tx-left" style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
            <!-- 左側 Avatar 與記帳人垂直頭像區 -->
            <div class="tx-avatar-area" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; width: 44px; min-width: 44px; max-width: 44px;">
              <div class="tx-icon-circle" :style="{ backgroundColor: getTxStyle(tx).bg }" style="margin-bottom: 0;">
                <ArrowLeftRight v-if="tx.type === 'transfer'" :size="18" :stroke="'#4A7FE0'" />
                <span v-else class="tx-emoji">{{ getTxStyle(tx).icon }}</span>
              </div>
              <span 
                v-if="tx.createdBy" 
                class="creator-tag-micro" 
                style="font-size: 8px; font-weight: 800; color: var(--color-text-dark); background-color: var(--color-bg-warm); border: 1.2px solid var(--color-border); border-radius: 6px; padding: 1.5px 2px; white-space: nowrap; max-width: 100%; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; text-align: center; display: block;"
                :title="tx.createdBy"
              >
                {{ tx.createdByAvatar }}{{ tx.createdBy }}
              </span>
            </div>
            <div class="tx-info">
              <div class="tx-category-row" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                <span class="tx-category">
                  {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
                </span>
                <span v-if="isTransactionPaid(tx)" class="tag-jelly paid-tag" style="background-color: #E1F8EB; color: #2C8C67; font-size: 8px; padding: 1px 4px; font-weight: 800; border: 1.2px solid #2C8C67; border-radius: 8px; display: inline-flex; align-items: center; gap: 2px;">
                  ✓ 已繳清
                </span>
              </div>
              <span class="tx-note">{{ tx.note || '無備註' }}</span>
              <!-- 帳戶資訊 -->
              <div class="tx-details-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%;">
                <template v-if="tx.type === 'transfer'">
                  <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                    <span class="transfer-label" style="background-color: #E3EFFF; color: #4A7FE0; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">從</span>
                    <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId) }}</span>
                  </div>
                  <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                    <span class="transfer-label" style="background-color: #E1F8EB; color: #2C8C67; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">到</span>
                    <span class="acct-name-pill">{{ getAccountName(tx.toAccountId) }}</span>
                  </div>
                </template>
                <template v-else>
                  <span class="tx-account-info">
                    <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId || tx.toAccountId) }}</span>
                  </span>
                </template>
              </div>
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
            <div class="tx-actions" style="display: flex; align-items: center; gap: 6px;">
              <button class="btn-edit btn-jelly" @click="openEditModal(tx)" title="編輯此筆">
                <Pencil :size="11" />
              </button>
              <button class="btn-delete btn-jelly" @click="handleDelete(tx.id)" title="刪除此筆">
                <Trash2 :size="11" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- 情況 2：日期排序，且 viewMode 為 detailed (日區塊逐項展開模式) -->
      <template v-else-if="viewMode === 'detailed'">
        <div 
          v-for="group in groupedTransactions" 
          :key="group.dateStr"
          :id="'day-card-' + group.dateStr"
          class="day-group-card card-jelly"
          :class="{ 'flash-highlight': flashingDay === group.dateStr }"
          style="margin-bottom: 14px; padding: 0 !important; overflow: hidden; background-color: #fff; text-align: left;"
        >
          <!-- 區塊 Header -->
          <div class="day-group-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background-color: var(--color-bg-warm); border-bottom: 1.5px solid var(--color-border);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="day-group-date" style="font-size: 12px; font-weight: 800; color: var(--color-text-dark);">
                {{ group.dateLabel }}
              </span>
              <span v-if="group.relativeLabel" class="tag-jelly" style="font-size: 9px; padding: 1px 6px; background-color: var(--color-accent-gold);">
                {{ group.relativeLabel }}
              </span>
              <button 
                class="btn-jelly" 
                style="font-size: 9px; padding: 2px 6px !important; background-color: var(--color-income) !important; border: 1.2px solid var(--color-border); border-radius: 8px; font-weight: 800; display: inline-flex; align-items: center; gap: 2px; color: var(--color-text-dark);"
                @click.stop="quickAddForDate(group.dateStr)"
                title="在此日新增記帳"
              >
                ➕ 記一筆
              </button>
            </div>
            <div class="day-group-totals" style="font-size: 11px; font-weight: 800; display: flex; gap: 8px;">
              <span v-if="group.incomeTotal > 0" class="income-val" style="color: var(--color-income-text, #2C8C67);">
                +${{ formatCurrency(group.incomeTotal) }}
              </span>
              <span v-if="group.expenseTotal > 0" class="expense-val" style="color: var(--color-expense-text, #FF5A5A);">
                -${{ formatCurrency(group.expenseTotal) }}
              </span>
            </div>
          </div>
          
          <!-- 區塊內單筆明細 (以虛線/細線分隔) -->
          <div class="day-group-items">
            <div 
              v-for="(tx, idx) in group.items" 
              :key="tx.id"
              class="tx-item"
              style="background-color: transparent !important; padding: 12px 14px !important;"
              :style="idx > 0 ? 'border-top: 1px dashed var(--color-border);' : ''"
            >
              <!-- 左側：icon + 分類資訊 -->
              <div class="tx-left" style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
                <!-- 左側 Avatar 與記帳人垂直頭像區 -->
                <div class="tx-avatar-area" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; width: 44px; min-width: 44px; max-width: 44px;">
                  <div class="tx-icon-circle" :style="{ backgroundColor: getTxStyle(tx).bg }" style="margin-bottom: 0;">
                    <ArrowLeftRight v-if="tx.type === 'transfer'" :size="18" :stroke="'#4A7FE0'" />
                    <span v-else class="tx-emoji">{{ getTxStyle(tx).icon }}</span>
                  </div>
                  <span 
                    v-if="tx.createdBy" 
                    class="creator-tag-micro" 
                    style="font-size: 8px; font-weight: 800; color: var(--color-text-dark); background-color: var(--color-bg-warm); border: 1.2px solid var(--color-border); border-radius: 6px; padding: 1.5px 2px; white-space: nowrap; max-width: 100%; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; text-align: center; display: block;"
                    :title="tx.createdBy"
                  >
                    {{ tx.createdByAvatar }}{{ tx.createdBy }}
                  </span>
                </div>
                <div class="tx-info">
                  <div class="tx-category-row" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <span class="tx-category">
                      {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
                    </span>
                    <span v-if="isTransactionPaid(tx)" class="tag-jelly paid-tag" style="background-color: #E1F8EB; color: #2C8C67; font-size: 8px; padding: 1px 4px; font-weight: 800; border: 1.2px solid #2C8C67; border-radius: 8px; display: inline-flex; align-items: center; gap: 2px;">
                      ✓ 已繳清
                    </span>
                  </div>
                  <span class="tx-note">{{ tx.note || '無備註' }}</span>
                  <!-- 帳戶資訊 -->
                  <div class="tx-details-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%;">
                    <template v-if="tx.type === 'transfer'">
                      <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                        <span class="transfer-label" style="background-color: #E3EFFF; color: #4A7FE0; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">從</span>
                        <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId) }}</span>
                      </div>
                      <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                        <span class="transfer-label" style="background-color: #E1F8EB; color: #2C8C67; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">到</span>
                        <span class="acct-name-pill">{{ getAccountName(tx.toAccountId) }}</span>
                      </div>
                    </template>
                    <template v-else>
                      <span class="tx-account-info">
                        <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId || tx.toAccountId) }}</span>
                      </span>
                    </template>
                  </div>
                </div>
              </div>

              <!-- 右側：金額 + 操作 -->
              <div class="tx-right">
                <span class="tx-amount" :style="{ color: getTxStyle(tx).color }">
                  {{ getTxStyle(tx).prefix }}${{ formatCurrency(tx.amount) }}
                </span>
                <div class="tx-actions" style="display: flex; align-items: center; gap: 6px;">
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
        </div>
      </template>

      <!-- 情況 3：日期排序，且 viewMode 為 aggregated (每日彙整卡片模式) -->
      <template v-else-if="viewMode === 'aggregated'">
        <div 
          v-for="group in groupedTransactions" 
          :key="group.dateStr"
          :id="'day-card-' + group.dateStr"
          class="day-group-card card-jelly"
          :class="{ 'flash-highlight': flashingDay === group.dateStr }"
          style="margin-bottom: 14px; padding: 12px !important; background-color: #fff; cursor: pointer; text-align: left;"
          @click="toggleDayExpand(group.dateStr)"
        >
          <!-- 彙整 Header -->
          <div class="day-group-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="day-group-date" style="font-size: 13px; font-weight: 800; color: var(--color-text-dark);">
                {{ group.dateLabel }}
              </span>
              <span v-if="group.relativeLabel" class="tag-jelly" style="font-size: 9px; padding: 1px 6px; background-color: var(--color-accent-gold);">
                {{ group.relativeLabel }}
              </span>
              <button 
                class="btn-jelly" 
                style="font-size: 9px; padding: 2px 6px !important; background-color: var(--color-income) !important; border: 1.2px solid var(--color-border); border-radius: 8px; font-weight: 800; display: inline-flex; align-items: center; gap: 2px; color: var(--color-text-dark);"
                @click.stop="quickAddForDate(group.dateStr)"
                title="在此日新增記帳"
              >
                ➕ 記一筆
              </button>
            </div>
            <div class="day-group-totals" style="font-size: 12px; font-weight: 800; display: flex; gap: 8px;">
              <span v-if="group.incomeTotal > 0" class="income-val" style="color: var(--color-income-text, #2C8C67);">
                +${{ formatCurrency(group.incomeTotal) }}
              </span>
              <span v-if="group.expenseTotal > 0" class="expense-val" style="color: var(--color-expense-text, #FF5A5A);">
                -${{ formatCurrency(group.expenseTotal) }}
              </span>
            </div>
          </div>

          <!-- 彙整加總列表 (同一天合併相同帳戶後的項目) -->
          <div class="aggregated-items-list" style="display: flex; flex-direction: column; gap: 8px; background-color: var(--color-bg-warm); padding: 10px 14px; border-radius: var(--border-radius-sm); border: 1.5px solid var(--color-border); margin-bottom: 6px; box-shadow: var(--shadow-jelly-sm);">
            <div 
              v-for="item in group.aggregatedItems" 
              :key="item.id"
              style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 800;"
            >
              <div style="display: flex; align-items: center; gap: 6px;">
                <span v-if="item.type === 'expense'">💸</span>
                <span v-else-if="item.type === 'income'">💰</span>
                <span v-else>🔄</span>
                <span>
                  <template v-if="item.isTransfer">
                    {{ item.accountName }} ➜ {{ item.toAccountName }}
                  </template>
                  <template v-else>
                    {{ item.accountName }}
                  </template>
                </span>
                <span style="font-size: 10px; color: var(--color-text-muted); font-weight: 700;">
                  ({{ item.count }} 筆)
                </span>
              </div>
              <span :style="{ color: item.type === 'expense' ? 'var(--color-expense-text, #FF5A5A)' : item.type === 'income' ? 'var(--color-income-text, #2C8C67)' : '#4A7FE0' }">
                {{ item.type === 'expense' ? '-' : item.type === 'income' ? '+' : '' }}${{ formatCurrency(item.amount) }}
              </span>
            </div>
          </div>

          <!-- 展開/折疊指示 -->
          <div style="text-align: center; font-size: 10px; font-weight: 800; color: var(--color-text-muted); padding-top: 4px;">
            {{ group.isExpanded ? '🐾 點擊收合原始明細 ⬆️' : '🐾 點擊展開原始明細 (' + group.items.length + ' 筆) ⬇️' }}
          </div>

          <!-- 展開顯示當天原始明細，方便進行刪除/編輯等調整 -->
          <div v-if="group.isExpanded" @click.stop style="margin-top: 10px; border-top: 1.5px dashed var(--color-border); padding-top: 10px;">
            <div class="day-group-items">
              <div 
                v-for="(tx, idx) in group.items" 
                :key="tx.id"
                class="tx-item"
                style="background-color: transparent !important; padding: 12px 0 !important;"
                :style="idx > 0 ? 'border-top: 1px dashed var(--color-border);' : ''"
              >
                <!-- 左側：icon + 分類資訊 -->
                <div class="tx-left" style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
                  <!-- 左側 Avatar 與記帳人垂直頭像區 -->
                  <div class="tx-avatar-area" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; width: 44px; min-width: 44px; max-width: 44px;">
                    <div class="tx-icon-circle" :style="{ backgroundColor: getTxStyle(tx).bg }" style="margin-bottom: 0;">
                      <ArrowLeftRight v-if="tx.type === 'transfer'" :size="18" :stroke="'#4A7FE0'" />
                      <span v-else class="tx-emoji">{{ getTxStyle(tx).icon }}</span>
                    </div>
                    <span 
                      v-if="tx.createdBy" 
                      class="creator-tag-micro" 
                      style="font-size: 8px; font-weight: 800; color: var(--color-text-dark); background-color: var(--color-bg-warm); border: 1.2px solid var(--color-border); border-radius: 6px; padding: 1.5px 2px; white-space: nowrap; max-width: 100%; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; text-align: center; display: block;"
                      :title="tx.createdBy"
                    >
                      {{ tx.createdByAvatar }}{{ tx.createdBy }}
                    </span>
                  </div>
                  <div class="tx-info">
                    <div class="tx-category-row" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                      <span class="tx-category">
                        {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
                      </span>
                      <span v-if="isTransactionPaid(tx)" class="tag-jelly paid-tag" style="background-color: #E1F8EB; color: #2C8C67; font-size: 8px; padding: 1px 4px; font-weight: 800; border: 1.2px solid #2C8C67; border-radius: 8px; display: inline-flex; align-items: center; gap: 2px;">
                        ✓ 已繳清
                      </span>
                    </div>
                    <span class="tx-note">{{ tx.note || '無備註' }}</span>
                    <!-- 帳戶資訊 -->
                    <div class="tx-details-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%;">
                      <template v-if="tx.type === 'transfer'">
                        <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                          <span class="transfer-label" style="background-color: #E3EFFF; color: #4A7FE0; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">從</span>
                          <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId) }}</span>
                        </div>
                        <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                          <span class="transfer-label" style="background-color: #E1F8EB; color: #2C8C67; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">到</span>
                          <span class="acct-name-pill">{{ getAccountName(tx.toAccountId) }}</span>
                        </div>
                      </template>
                      <template v-else>
                        <span class="tx-account-info">
                          <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId || tx.toAccountId) }}</span>
                        </span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- 右側：金額 + 操作 -->
                <div class="tx-right">
                  <span class="tx-amount" :style="{ color: getTxStyle(tx).color }">
                    {{ getTxStyle(tx).prefix }}${{ formatCurrency(tx.amount) }}
                  </span>
                  <div class="tx-actions" style="display: flex; align-items: center; gap: 6px;">
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
          </div>
        </div>
      </template>
      </div>

    <!-- ===== 編輯交易彈窗 (Teleport 全螢幕 Modal Dialog) ===== -->
    <Teleport to="#app">
      <Transition name="fade">
        <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
          <div class="modal-card card-jelly pop-jelly" @click.stop>
            <div class="modal-header">
              <h3 class="modal-title">✏️ 編輯記帳明細</h3>
              <button class="btn-jelly btn-close-modal" @click="closeEditModal" type="button">
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
                  type="button"
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
                  type="button"
                >
                  {{ sub }}
                  <Check v-if="editSubCategory === sub" :size="10" stroke-width="4" class="inline-check" />
                </button>
              </div>
            </div>

            <!-- 來源/目的帳戶 -->
            <div v-if="editType === 'expense' || editType === 'transfer'" class="form-group" style="position: relative;">
              <label class="label-cute">支付帳戶</label>
              <!-- 自訂果凍下拉選單選取框 -->
              <div 
                class="select-cute-btn btn-jelly" 
                :class="{ active: editFromAccountOpen }"
                @click="editFromAccountOpen = !editFromAccountOpen; editToAccountOpen = false"
              >
                <span v-if="selectedFromAccount" class="select-btn-val">
                  <span class="account-avatar-emoji" style="margin-right: 4px;">{{ selectedFromAccount.avatar || '💰' }}</span>
                  <span class="account-name-text">{{ selectedFromAccount.name }}</span>
                </span>
                <span v-else class="select-btn-val placeholder">(不指定)</span>
                <ChevronDown :size="16" class="select-arrow" />
              </div>

              <!-- 全螢幕遮罩 (僅在選單展開時存在，用於點擊外部收合) -->
              <div 
                v-if="editFromAccountOpen" 
                class="select-dropdown-overlay" 
                @click="editFromAccountOpen = false"
              ></div>

              <!-- 下拉選項氣泡面板 -->
              <Transition name="fade-drop">
                <div v-if="editFromAccountOpen" class="select-dropdown-panel card-jelly pop-jelly">
                  <div 
                    class="select-option btn-jelly" 
                    :class="{ selected: editFromAccountId === '' }"
                    @click="editFromAccountId = ''; editFromAccountOpen = false"
                  >
                    <span>(不指定)</span>
                    <Check v-if="editFromAccountId === ''" :size="14" stroke-width="3" />
                  </div>
                  <div 
                    v-for="a in expenseAccounts" 
                    :key="a.id"
                    class="select-option btn-jelly"
                    :class="{ selected: editFromAccountId === a.id }"
                    @click="editFromAccountId = a.id; editFromAccountOpen = false"
                  >
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="account-avatar-emoji">{{ a.avatar || '💰' }}</span>
                      <span>{{ a.name }}</span>
                    </div>
                    <Check v-if="editFromAccountId === a.id" :size="14" stroke-width="3" />
                  </div>
                </div>
              </Transition>
            </div>

            <div v-if="editType === 'income' || editType === 'transfer'" class="form-group" style="position: relative;">
              <label class="label-cute">存入帳戶</label>
              <!-- 自訂果凍下拉選單選取框 -->
              <div 
                class="select-cute-btn btn-jelly" 
                :class="{ active: editToAccountOpen }"
                @click="editToAccountOpen = !editToAccountOpen; editFromAccountOpen = false"
              >
                <span v-if="selectedToAccount" class="select-btn-val">
                  <span class="account-avatar-emoji" style="margin-right: 4px;">{{ selectedToAccount.avatar || '💰' }}</span>
                  <span class="account-name-text">{{ selectedToAccount.name }}</span>
                </span>
                <span v-else class="select-btn-val placeholder">(不指定)</span>
                <ChevronDown :size="16" class="select-arrow" />
              </div>

              <!-- 全螢幕遮罩 -->
              <div 
                v-if="editToAccountOpen" 
                class="select-dropdown-overlay" 
                @click="editToAccountOpen = false"
              ></div>

              <!-- 下拉選項氣泡面板 -->
              <Transition name="fade-drop">
                <div v-if="editToAccountOpen" class="select-dropdown-panel card-jelly pop-jelly">
                  <div 
                    class="select-option btn-jelly" 
                    :class="{ selected: editToAccountId === '' }"
                    @click="editToAccountId = ''; editToAccountOpen = false"
                  >
                    <span>(不指定)</span>
                    <Check v-if="editToAccountId === ''" :size="14" stroke-width="3" />
                  </div>
                  <div 
                    v-for="a in incomeAccounts" 
                    :key="a.id"
                    class="select-option btn-jelly"
                    :class="{ selected: editToAccountId === a.id }"
                    @click="editToAccountId = a.id; editToAccountOpen = false"
                  >
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="account-avatar-emoji">{{ a.avatar || '💰' }}</span>
                      <span>{{ a.name }}</span>
                    </div>
                    <Check v-if="editToAccountId === a.id" :size="14" stroke-width="3" />
                  </div>
                </div>
              </Transition>
            </div>

            <div class="modal-actions">
              <button class="btn-jelly btn-cancel" @click="closeEditModal" type="button">取消 🐾</button>
              <button
                class="btn-jelly btn-confirm"
                :disabled="editAmount <= 0"
                @click="handleEditSave"
                type="button"
              >
                儲存變更 🐾
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- ===== 回到頂部懸浮貓爪按鈕 🐾 ===== -->
    <Teleport to="#app">
      <Transition name="fade">
        <button 
          v-if="showScrollTopBtn" 
          class="btn-jelly btn-scroll-top animate-bounce-slow"
          @click="scrollToTop"
          title="回到頂部"
        >
          🐾 頂部
        </button>
      </Transition>
    </Teleport>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-title {
  font-size: 20px;
  font-weight: 800;
}

/* 月份選取器（全寬） */
.mb-picker {
  margin-bottom: 10px;
}

.toolbar-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.toolbar-icon-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  padding: 0 !important;
  border-radius: 12px !important;
  color: var(--color-text-dark);
}

.toolbar-icon-btn.active {
  background-color: var(--color-accent-gold) !important;
  border-width: 2.5px;
}

/* 排序 Wrapper（相對定位，讓 dropdown 定錨在按鈕下方） */
.sort-wrapper {
  position: relative;
}

/* 排序下拉遮罩（透明，點擊關閉） */
.sort-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* 排序下拉面板 */
.sort-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px !important;
  background-color: #fff;
  min-width: 110px;
  white-space: nowrap;
}

.sort-option {
  padding: 7px 12px !important;
  font-size: 13px;
  background-color: var(--color-bg-warm);
  text-align: left;
}

.sort-option.active {
  background-color: var(--color-accent-gold) !important;
  font-weight: 700;
  border-width: 2px;
}

/* 搜尋欄（折疊展開） */
.search-bar {
  margin-bottom: 10px;
  background-color: #fff;
  padding: 10px 14px !important;
}

/* Dropdown 動畫 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 搜尋欄展開動畫 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.2s, max-height 0.2s;
  overflow: hidden;
  max-height: 120px;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}

/* 小計欄 */
.summary-strip {
  display: flex;
  align-items: center;
  padding: 12px !important;
  background-color: #fff;
  margin-bottom: 12px;
}

.summary-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}

.summary-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.summary-value {
  font-size: clamp(13px, 3.8vw, 17px);
  font-weight: 800;
  letter-spacing: -0.5px;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.income-val  { color: #2C8C67; }
.expense-val { color: #FF5A5A; }

.summary-divider {
  width: 1px;
  height: 32px;
  background-color: var(--color-border);
  flex-shrink: 0;
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
  gap: 8px;
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
  width: 42px;
  height: 42px;
  min-width: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: var(--border-width) solid var(--color-border);
}

.tx-emoji {
  font-size: 20px;
}

.tx-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tx-category-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.tx-category {
  font-size: 18px;
  font-weight: 800;
  white-space: normal;
  word-break: break-word;
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}

@media (max-width: 360px) {
  .tx-category {
    font-size: 16px;
  }
}

.tx-note {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-dark); /* 稍微加深顏色提升易讀性 */
  opacity: 0.8;
  white-space: normal;
  word-break: break-word;
}

.tx-account-info {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
}

.acct-name-pill {
  display: inline-block;
  vertical-align: middle;
  font-weight: 700;
  word-break: break-all;
}



.tx-details-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.creator-tag {
  font-size: 12px !important;
  padding: 1px 6px !important;
  width: fit-content;
  flex-shrink: 0;
}

/* 右側 */
.tx-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
  margin-left: 10px;
}

.tx-amount {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.3px;
}

.tx-date {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.tx-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.btn-edit {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  background-color: #EEF4FF !important;
  color: #4A7FE0;
  border-color: #A9C9FF !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-delete {
  width: 28px;
  height: 28px;
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
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
  overflow-y: auto;
  backdrop-filter: blur(4px);
}

.modal-card {
  width: 100%;
  max-width: 380px;
  background-color: #FFFFFF;
  margin: auto 0;
  border-radius: var(--border-radius-lg) !important;
  padding: 20px !important;
  overflow-y: visible;
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

/* ===== 搜尋欄設計 ===== */
.search-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px !important;
  margin-bottom: 12px;
  background-color: #fff;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-icon {
  font-size: 16px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-dark);
  outline: none;
  padding: 2px 0;
}

.search-input::placeholder {
  color: var(--color-text-muted);
  font-weight: 600;
  opacity: 0.65;
}

.btn-clear {
  padding: 4px !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: 50% !important;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none !important;
  border-width: 1.5px !important;
  flex-shrink: 0;
}

.btn-clear:active {
  transform: scale(0.9);
}

.search-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1.5px dashed var(--color-border);
  padding-top: 10px;
  margin-top: 4px;
}

.search-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px 10px !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: 20px !important;
  border-width: 1.5px !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.search-toggle input {
  cursor: pointer;
  accent-color: var(--color-transfer);
  width: 13px;
  height: 13px;
  margin: 0;
}

.results-count {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  background-color: var(--color-bg-warm);
  padding: 3px 10px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
}

/* 自訂果凍下拉選單 */
.select-cute-btn {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 42px;
  padding: 0 14px !important;
  border: var(--border-width) solid var(--color-border) !important;
  border-radius: var(--border-radius-sm) !important;
  background-color: #fff !important;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-dark);
  cursor: pointer;
  box-shadow: none !important;
}

.select-cute-btn:active {
  transform: scale(0.97) !important;
}

.select-cute-btn.active {
  border-color: var(--color-accent-gold) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.select-btn-val {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-btn-val.placeholder {
  color: var(--color-text-muted);
  font-weight: 700;
}

.select-arrow {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.select-cute-btn.active .select-arrow {
  transform: rotate(180deg);
  color: var(--color-text-dark);
}

.select-dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 98; /* 低於選單面板 99，高於其他 */
  background: transparent;
}

.select-dropdown-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background-color: #fff !important;
  border: var(--border-width) solid var(--color-border) !important;
  border-radius: var(--border-radius-sm) !important;
  padding: 6px !important;
  z-index: 99 !important;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: var(--shadow-jelly) !important;
}

.select-option {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px !important;
  margin-bottom: 4px !important;
  border-radius: var(--border-radius-xs) !important;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-dark);
  cursor: pointer;
  background: transparent !important;
  border: 1.5px solid transparent !important;
  box-shadow: none !important;
}

.select-option:last-child {
  margin-bottom: 0 !important;
}

.select-option:hover {
  background-color: var(--color-bg-warm) !important;
  border-color: var(--color-border) !important;
}

.select-option.selected {
  background-color: #FFF2D6 !important;
  border-color: var(--color-accent-gold) !important;
  color: var(--color-accent-gold) !important;
}

/* 下拉淡入動畫 */
.fade-drop-enter-active,
.fade-drop-leave-active {
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}
.fade-drop-enter-from,
.fade-drop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* 回到頂部按鈕極速淡入淡出動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 快速定位日期的閃爍特效 */
@keyframes flashHighlight {
  0% { 
    background-color: var(--color-accent-gold) !important; 
    transform: scale(1.02); 
    box-shadow: 0 0 15px var(--color-accent-gold) !important;
  }
  50% {
    background-color: #FFFDF9 !important;
    transform: scale(0.99);
  }
  100% { 
    background-color: #fff !important; 
    transform: scale(1); 
    box-shadow: var(--shadow-jelly) !important;
  }
}
.flash-highlight {
  animation: flashHighlight 1.5s cubic-bezier(0.25, 1, 0.5, 1);
  border: 2.5px solid var(--color-accent-gold) !important;
  z-index: 10;
}

/* 回到頂部懸浮貓爪按鈕 */
.btn-scroll-top {
  position: fixed;
  bottom: 95px; /* 在底欄 Tab 上方 */
  right: 20px;
  z-index: 90;
  width: 48px;
  height: 48px;
  border-radius: 50% !important;
  background-color: var(--color-accent-gold) !important;
  border: var(--border-width) solid var(--color-border) !important;
  box-shadow: var(--shadow-jelly) !important;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 !important;
}

@media (min-width: 480px) {
  .btn-scroll-top {
    /* 當螢幕寬度大於 480px 時，始終保持在 APP 框線範圍內的右下角 */
    right: calc(50% - 240px + 20px) !important;
  }
}

.btn-scroll-top:active {
  transform: scale(0.9) !important;
  box-shadow: var(--shadow-jelly-active) !important;
}

/* 軟萌慢速彈跳動畫 */
@keyframes bounceSlow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.animate-bounce-slow {
  animation: bounceSlow 2s ease-in-out infinite;
}

/* 定位日期的網格滾動條美化 */
.locate-days-grid::-webkit-scrollbar {
  width: 4px;
}
.locate-days-grid::-webkit-scrollbar-track {
  background: transparent;
}
.locate-days-grid::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}
</style>
