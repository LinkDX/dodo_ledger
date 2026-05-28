<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useLedger } from '../composables/useLedger'
import { useConfirm } from '../composables/useConfirm'
import type { Account, AccountType } from '../types'
import { 
  Plus, 
  ArrowLeftRight, 
  Wallet, 
  Landmark, 
  CreditCard, 
  Compass, 
  Check,
  Sparkles,
  Calendar,
  CheckCircle,
  Pencil,
  GripVertical,
  X
} from 'lucide-vue-next'
import MonthYearPicker from './MonthYearPicker.vue'
import AccountPicker from './AccountPicker.vue'

const { 
  accounts,
  transactions,
  addAccount,
  deleteAccount,
  editAccount,
  reorderAccounts,
  addTransaction,
  payCreditCardBill,
  getBillPeriodForCard,
  getCreditCardBillPeriod
} = useLedger()

const { showConfirm } = useConfirm()

const handleDeleteAccount = async (acctId: string) => {
  const acct = accounts.value.find(a => a.id === acctId)
  const acctName = acct ? acct.name : '此帳戶'
  const confirmed = await showConfirm(
    `刪除「${acctName}」將會連同該帳戶下的所有記帳明細一起刪除，且無法復原喔！確定要刪除嗎？喵？`,
    '🐱 確定要刪除帳戶嗎？'
  )
  if (confirmed) {
    await deleteAccount(acctId)
  }
}

// 內部 Tab: 帳戶 / 信用卡帳單
const activeSection = ref<'accounts' | 'credit'>('accounts')

// 帳戶專屬馬卡龍漸層配色選項
const cardColors = [
  { class: 'card-gold',   value: '#FFDAC1', name: '卡士達金' },
  { class: 'card-pink',   value: '#FFB4B4', name: '櫻桃粉' },
  { class: 'card-blue',   value: '#A9C9FF', name: '天空藍' },
  { class: 'card-purple', value: '#E2C6FF', name: '薰衣草紫' },
  { class: 'card-mint',   value: '#C7F2E6', name: '薄荷綠' },
  { class: 'card-peach',  value: '#FFCBA4', name: '蜜桃橘' },
  { class: 'card-lemon',  value: '#FFF3B0', name: '檸檬黃' },
  { class: 'card-rose',   value: '#FFADC7', name: '玫瑰紅' },
  { class: 'card-sky',    value: '#C1E1FF', name: '粉霧藍' },
  { class: 'card-lilac',  value: '#D4BAFF', name: '丁香紫' },
  { class: 'card-sage',   value: '#D6EAC0', name: '鼠尾草綠' },
  { class: 'card-cocoa',  value: '#E8D5C4', name: '可可奶茶' },
  { class: 'card-coral',  value: '#FFBBA8', name: '珊瑚橘' },
]

// 帳戶可選 Emoji Avatar
const avatarOptions = ['🏦','💳','💰','🪙','💵','💴','🏧','💼','🛍️','🌟','🐱','🎯','🚀','🎁','🍵','🏠','📦','🎪','🌈','⭐']

// 狀態控制
const showAddModal = ref(false)
const showTransferModal = ref(false)
const showEditModal = ref(false)

// 新增帳戶表單狀態
const newName = ref('')
const newType = ref<AccountType>('cash')
const newBalance = ref<number | ''>('')
const newAvatar = ref('')
const selectedColorIdx = ref(0)
// 信用卡專屬表單
const creditLimit = ref<number>(50000)
const billingCycleDate = ref<number>(10)
const paymentDueDate = ref<number>(25)

// 帳戶互轉表單狀態
const fromAccountId = ref('')
const toAccountId = ref('')
const transferAmount = ref<number | ''>('')
const transferFee = ref<number>(0)
const transferNote = ref('')

// 編輯帳戶表單狀態
const editingAcctId = ref('')
const editName = ref('')
const editAvatar = ref('')
const editColorIdx = ref(0)
const editBalance = ref<number | ''>('')
const editType = ref('cash')

const toggleAddModal = () => {
  showAddModal.value = !showAddModal.value
  if (showAddModal.value) {
    newName.value = ''
    newType.value = 'cash'
    newBalance.value = ''
    newAvatar.value = ''
    selectedColorIdx.value = 0
    creditLimit.value = 50000
    billingCycleDate.value = 10
    paymentDueDate.value = 25
  }
}

const toggleTransferModal = () => {
  showTransferModal.value = !showTransferModal.value
  if (showTransferModal.value) {
    fromAccountId.value = accounts.value[0]?.id || ''
    toAccountId.value = accounts.value[1]?.id || ''
    transferAmount.value = ''
    transferFee.value = 0
    transferNote.value = ''
  }
}

const openEditModal = (acct: Account) => {
  editingAcctId.value = acct.id
  editName.value = acct.name
  editAvatar.value = acct.avatar || ''
  editColorIdx.value = cardColors.findIndex(c => c.class === acct.color)
  if (editColorIdx.value < 0) editColorIdx.value = 0
  editBalance.value = acct.type === 'credit_card' ? -acct.balance : acct.balance
  editType.value = acct.type
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingAcctId.value = ''
}

const handleSaveEdit = async () => {
  if (!editingAcctId.value || !editName.value.trim()) return
  const balanceVal = Number(editBalance.value) || 0
  await editAccount(editingAcctId.value, {
    name: editName.value.trim(),
    avatar: editAvatar.value || undefined,
    color: cardColors[editColorIdx.value].class,
    balance: editType.value === 'credit_card' ? -balanceVal : balanceVal
  })
  closeEditModal()
}

const handleAddAccount = async () => {
  if (!newName.value.trim()) return
  
  const balanceVal = Number(newBalance.value) || 0
  
  const acctData: any = {
    name: newName.value.trim(),
    type: newType.value,
    balance: newType.value === 'credit_card' ? -balanceVal : balanceVal,
    icon: newType.value === 'cash' ? 'Wallet' : newType.value === 'bank' ? 'Landmark' : newType.value === 'credit_card' ? 'CreditCard' : 'Compass',
    color: cardColors[selectedColorIdx.value].class,
    avatar: newAvatar.value || undefined,
    currency: 'TWD'
  }

  if (newType.value === 'credit_card') {
    acctData.cardDetails = {
      creditLimit: Number(creditLimit.value) || 50000,
      billingCycleDate: Number(billingCycleDate.value) || 10,
      paymentDueDate: Number(paymentDueDate.value) || 25
    }
  }

  await addAccount(acctData)
  toggleAddModal()
}

const handleTransfer = async () => {
  const amt = Number(transferAmount.value)
  if (!amt || !fromAccountId.value || !toAccountId.value) return
  if (fromAccountId.value === toAccountId.value) return

  await addTransaction({
    type: 'transfer',
    amount: amt,
    fee: Number(transferFee.value) || 0,
    category: '轉帳',
    fromAccountId: fromAccountId.value,
    toAccountId: toAccountId.value,
    date: Date.now(),
    note: transferNote.value.trim() || '資金互轉',
    tags: ['轉帳']
  })

  toggleTransferModal()
}

// 格式化千分位金額
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}

// 取得可用額度比例 (信用卡專屬)
const getCreditAvailableRatio = (acct: Account) => {
  if (!acct.cardDetails) return 0
  const limit = acct.cardDetails.creditLimit
  const debt = Math.abs(acct.balance)
  const available = Math.max(limit - debt, 0)
  return available / limit
}

// ========== 信用卡帳單區塊邏輯 ==========

const creditCards = computed(() => accounts.value.filter(a => a.type === 'credit_card'))

const selectedCardId = ref('')
const selectedPeriod = ref('')

const getFallbackPeriod = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const getDefaultBillPeriod = (cardId: string) => {
  return getBillPeriodForCard(cardId, Date.now()) || getFallbackPeriod()
}

const initCreditDefaults = () => {
  if (creditCards.value.length === 0) {
    selectedCardId.value = ''
    selectedPeriod.value = ''
    return
  }

  if (!creditCards.value.some(card => card.id === selectedCardId.value)) {
    selectedCardId.value = creditCards.value[0].id
  }

  if (!selectedPeriod.value || !billPeriods.value.includes(selectedPeriod.value)) {
    selectedPeriod.value = billPeriods.value.includes(getDefaultBillPeriod(selectedCardId.value))
      ? getDefaultBillPeriod(selectedCardId.value)
      : billPeriods.value[billPeriods.value.length - 1]
  }
}

const activeCard = computed(() => creditCards.value.find(a => a.id === selectedCardId.value))

const billPeriods = computed(() => {
  const periods = new Set<string>()

  if (selectedCardId.value) {
    const anchor = new Date(`${getDefaultBillPeriod(selectedCardId.value)}-01T00:00:00`)
    for (let i = -4; i <= 2; i++) {
      const date = new Date(anchor)
      date.setMonth(anchor.getMonth() + i)
      periods.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
  } else {
    periods.add(getFallbackPeriod())
  }

  for (const tx of transactions.value) {
    if (tx.fromAccountId !== selectedCardId.value) continue
    const period = getCreditCardBillPeriod(tx)
    if (period) {
      periods.add(period)
    }
  }

  return [...periods].sort()
})

const billedTransactions = computed(() => {
  if (!selectedCardId.value || !selectedPeriod.value) return []
  return transactions.value
    .filter(tx =>
      tx.type === 'expense' &&
      tx.fromAccountId === selectedCardId.value &&
      getCreditCardBillPeriod(tx) === selectedPeriod.value
    )
    .sort((a, b) => {
      const floorDay = (ts: number) => {
        const d = new Date(ts)
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      }
      const diff = floorDay(b.date) - floorDay(a.date)
      return diff !== 0 ? diff : (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    })
})

const billTotalAmount = computed(() =>
  billedTransactions.value.reduce((sum, tx) => sum + tx.amount, 0)
)

const bankAccounts = computed(() => accounts.value.filter(a => a.type === 'bank' || a.type === 'cash'))

const showPayModal = ref(false)
const linkedBankId = ref('')

const openPayModal = () => {
  if (billTotalAmount.value <= 0) return
  linkedBankId.value = activeCard.value?.cardDetails?.linkedBankAccountId || bankAccounts.value[0]?.id || ''
  showPayModal.value = true
}

const handlePayBill = async () => {
  if (!selectedCardId.value || !linkedBankId.value || !selectedPeriod.value) return
  await payCreditCardBill(selectedCardId.value, linkedBankId.value, selectedPeriod.value)
  showPayModal.value = false
}

const switchToCredit = () => {
  activeSection.value = 'credit'
  initCreditDefaults()
}

watch(creditCards, initCreditDefaults, { immediate: true })
watch(selectedCardId, (newCardId, oldCardId) => {
  if (!newCardId) return
  if (!oldCardId || !selectedPeriod.value || !billPeriods.value.includes(selectedPeriod.value)) {
    selectedPeriod.value = getDefaultBillPeriod(newCardId)
  }
})

// 搜尋與篩選狀態
const searchQuery = ref('')
const activeFilter = ref<'all' | AccountType>('all')

const filteredAccounts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return accounts.value.filter(acct => {
    // 1. 類型篩選
    if (activeFilter.value !== 'all' && acct.type !== activeFilter.value) {
      return false
    }

    // 2. 關鍵字搜尋篩選
    if (query) {
      const nameMatch = acct.name.toLowerCase().includes(query)
      const typeText = (
        acct.type === 'cash' ? '現金' :
        acct.type === 'bank' ? '銀行' :
        acct.type === 'credit_card' ? '信用卡' :
        '電子票證'
      ).toLowerCase()
      
      const typeTextAlt = (
        acct.type === 'cash' ? '現金' :
        acct.type === 'bank' ? '銀行存款' :
        acct.type === 'credit_card' ? '信用卡' :
        '電子票證'
      ).toLowerCase()

      const typeMatch = typeText.includes(query) || typeTextAlt.includes(query)
      const avatarMatch = acct.avatar && acct.avatar.includes(query)
      
      if (!nameMatch && !typeMatch && !avatarMatch) {
        return false
      }
    }
    return true
  })
})

// ===== 帳戶拖曳排序 =====
const dragSrcId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const onAcctDragStart = (acct: Account) => { dragSrcId.value = acct.id }
const onAcctDragOver = (acct: Account) => { dragOverId.value = acct.id }
const onAcctDragLeave = () => { dragOverId.value = null }
const onAcctDragEnd = () => { dragSrcId.value = null; dragOverId.value = null }

const onAcctDrop = async (targetAcct: Account) => {
  const src = dragSrcId.value
  dragSrcId.value = null
  dragOverId.value = null
  if (!src || src === targetAcct.id) return

  const newOrder = [...accounts.value]
  const srcIdx = newOrder.findIndex(a => a.id === src)
  const dstIdx = newOrder.findIndex(a => a.id === targetAcct.id)
  const [item] = newOrder.splice(srcIdx, 1)
  newOrder.splice(dstIdx, 0, item)
  await reorderAccounts(newOrder)
}
</script>

<template>
  <div class="accounts-page-container pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 我的錢包</h2>

      <!-- 內部 Tab 切換 -->
      <div class="inner-tabs">
        <button
          class="inner-tab btn-jelly"
          :class="{ active: activeSection === 'accounts' }"
          @click="activeSection = 'accounts'"
        >
          <Wallet :size="14" /> 帳戶管理
        </button>
        <button
          class="inner-tab btn-jelly"
          :class="{ active: activeSection === 'credit' }"
          @click="switchToCredit()"
        >
          <CreditCard :size="14" /> 信用卡帳單
        </button>
      </div>

      <!-- 帳戶區：新增 / 互轉按鈕 -->
      <div v-show="activeSection === 'accounts'" class="action-buttons-row">
        <button class="btn-jelly btn-action btn-add" @click="toggleAddModal">
          <Plus :size="16" /> 新增帳戶
        </button>
        <button 
          class="btn-jelly btn-action btn-transfer" 
          :disabled="accounts.length < 2"
          @click="toggleTransferModal"
        >
          <ArrowLeftRight :size="16" /> 帳戶互轉
        </button>
      </div>
    </div>

    <!-- 搜尋欄 -->
    <div v-show="activeSection === 'accounts' && accounts.length > 0" class="search-bar card-jelly">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋帳戶名稱、類型..."
          class="search-input"
        />
        <button v-if="searchQuery" class="btn-clear btn-jelly" @click="searchQuery = ''" title="清除搜尋">
          <X :size="12" />
        </button>
      </div>
      <div v-if="searchQuery" class="search-options">
        <span class="results-count">
          共 {{ filteredAccounts.length }} 個帳戶
        </span>
      </div>
    </div>

    <!-- 類型篩選 Tab -->
    <div v-show="activeSection === 'accounts' && accounts.length > 0" class="filter-tabs">
      <button
        v-for="f in ([
          { key: 'all',                label: '全部' },
          { key: 'cash',               label: '現金' },
          { key: 'bank',               label: '銀行' },
          { key: 'credit_card',        label: '信用卡' },
          { key: 'electronic_ticket',  label: '電子票證' }
        ] as const)"
        :key="f.key"
        class="filter-tab btn-jelly"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- 帳戶列表展示 (大圓角馬卡龍卡片) -->
    <div v-show="activeSection === 'accounts'" class="accounts-list">
      <div v-if="accounts.length === 0" class="empty-placeholder card-jelly">
        <p class="empty-text">主人目前還沒有建立任何帳戶喔喵～</p>
        <p class="empty-hint">請點擊上方「新增帳戶」建立第一個記帳卡片吧！</p>
      </div>
      <div v-else-if="filteredAccounts.length === 0" class="empty-placeholder card-jelly">
        <p class="empty-emoji">🔍</p>
        <p class="empty-text">找不到符合條件的理財帳戶喔～喵🐾</p>
        <button class="btn-jelly btn-clear-search" @click="searchQuery = ''; activeFilter = 'all'">
          清除搜尋篩選條件 🧹
        </button>
      </div>

      <div 
        v-for="acct in filteredAccounts" 
        :key="acct.id"
        class="account-card card-jelly"
        :class="[acct.color, { 'is-dragging': dragSrcId === acct.id, 'drag-over': dragOverId === acct.id }]"
        @dragover.prevent="onAcctDragOver(acct)"
        @dragleave="onAcctDragLeave"
        @drop.prevent="onAcctDrop(acct)"
        @dragend="onAcctDragEnd"
      >
        <div class="card-main-row">
          <!-- 左：拖曳把手 + avatar + 帳戶名 -->
          <div class="card-left">
            <span
              class="drag-handle"
              draggable="true"
              @dragstart="onAcctDragStart(acct)"
              title="拖曳調整順序"
            >
              <GripVertical :size="14" />
            </span>
            <span v-if="acct.avatar" class="card-avatar-emoji">{{ acct.avatar }}</span>
            <template v-else>
              <Wallet v-if="acct.type === 'cash'" :size="18" class="card-type-icon" />
              <Landmark v-else-if="acct.type === 'bank'" :size="18" class="card-type-icon" />
              <CreditCard v-else-if="acct.type === 'credit_card'" :size="18" class="card-type-icon" />
              <Compass v-else :size="18" class="card-type-icon" />
            </template>
            <span class="card-name">{{ acct.name }}</span>
          </div>
          <!-- 右：操作按鈕 -->
          <div class="card-top-actions">
            <button class="btn-edit-card" @click="openEditModal(acct)" title="編輯帳戶">
              <Pencil :size="13" />
            </button>
            <button class="btn-delete-card" @click="handleDeleteAccount(acct.id)">
              ×
            </button>
          </div>
        </div>

        <!-- 餘額列 -->
        <div class="card-balance-row">
          <!-- 左：類型 badge + 幣別 -->
          <div class="card-meta">
            <span class="card-badge">
              <Wallet v-if="acct.type === 'cash'" :size="12" />
              <Landmark v-else-if="acct.type === 'bank'" :size="12" />
              <CreditCard v-else-if="acct.type === 'credit_card'" :size="12" />
              <Compass v-else :size="12" />
              {{ acct.type === 'cash' ? '現金' : acct.type === 'bank' ? '銀行存款' : acct.type === 'credit_card' ? '信用卡' : '電子票證' }}
            </span>
            <span class="currency-tag">TWD</span>
          </div>
          <!-- 右：餘額 -->
          <div v-if="acct.type === 'credit_card'" class="credit-balance-info">
            <div class="debt-amount">負債 ${{ formatCurrency(Math.abs(acct.balance)) }}</div>
            <div class="limit-amount">額度 ${{ formatCurrency(Math.max((acct.cardDetails?.creditLimit || 50000) - Math.abs(acct.balance), 0)) }}</div>
            <div class="credit-progress-section">
              <div class="progress-bar-container">
                <div
                  class="progress-bar-fill"
                  :style="{
                    width: `${getCreditAvailableRatio(acct) * 100}%`,
                    backgroundColor: getCreditAvailableRatio(acct) <= 0.2 ? '#FF7B7B' : '#B5EAD7'
                  }"
                ></div>
              </div>
            </div>
            <div class="card-details-small">
              結帳 {{ acct.cardDetails?.billingCycleDate }} 號 · 繳款 {{ acct.cardDetails?.paymentDueDate }} 號
            </div>
          </div>
          <div v-else class="general-balance" :class="{ 'negative-val': acct.balance < 0 }">
            ${{ formatCurrency(acct.balance) }}
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 信用卡帳單區塊 ========== -->
    <div v-show="activeSection === 'credit'" class="credit-section">
      <!-- 無信用卡提示 -->
      <div v-if="creditCards.length === 0" class="empty-placeholder card-jelly">
        <div class="alert-icon-circle"><CreditCard :size="32" /></div>
        <p class="empty-text">主人還沒有信用卡帳戶喵～</p>
        <p class="empty-hint">請切換回「帳戶管理」，新增一張類型為信用卡的帳戶！</p>
      </div>

      <div v-else class="credit-core-layout">
        <!-- 卡片與月份篩選列 -->
        <div class="selectors-row card-jelly">
          <div class="select-group bill-card-picker">
            <label class="label-cute">選擇信用卡</label>
            <AccountPicker v-model="selectedCardId" :accounts="creditCards" />
          </div>
          <div class="select-group">
            <label class="label-cute">帳單月份</label>
            <MonthYearPicker v-model="selectedPeriod" :available-months="billPeriods" />
          </div>
        </div>

        <!-- 當期帳單狀態看板 -->
        <div class="bill-status-board card-jelly" :class="activeCard?.color">
          <div class="board-top">
            <span class="board-period-badge">
              <Calendar :size="12" /> {{ selectedPeriod }} 帳單
            </span>
            <span class="board-due-date">每月 {{ activeCard?.cardDetails?.paymentDueDate }} 號截止</span>
          </div>
          <div class="board-amount-section">
            <span class="amount-label">本期應繳總額</span>
            <h2 class="amount-value">${{ formatCurrency(billTotalAmount) }}</h2>
          </div>
          <div class="board-progress-section">
            <div class="progress-labels">
              <span>可用額度百分比</span>
              <span>
                TWD ${{ formatCurrency(Math.max((activeCard?.cardDetails?.creditLimit || 50000) - Math.abs(activeCard?.balance || 0), 0)) }}
                / ${{ formatCurrency(activeCard?.cardDetails?.creditLimit || 50000) }}
              </span>
            </div>
            <div class="progress-bar-container">
              <div 
                class="progress-bar-fill"
                :style="{ 
                  width: `${(activeCard ? Math.max(activeCard.cardDetails!.creditLimit - Math.abs(activeCard.balance), 0) / activeCard.cardDetails!.creditLimit : 1) * 100}%`,
                  backgroundColor: '#FFFDF9'
                }"
              />
            </div>
          </div>
          <div class="board-actions">
            <div v-if="billTotalAmount === 0" class="pay-success-status pop-jelly">
              <CheckCircle :size="16" class="icon-success" /> 本期已繳清或無消費，棒棒噠！
            </div>
            <button v-else class="btn-jelly btn-pay-bill pop-jelly" @click="openPayModal">
              一鍵扣款繳納帳單 ➜
            </button>
          </div>
        </div>

        <!-- 本期帳單明細 -->
        <div class="bill-details-section card-jelly">
          <h3 class="section-subtitle">本期已出帳明細 ({{ billedTransactions.length }} 筆)</h3>
          <div v-if="billedTransactions.length === 0" class="empty-bill-details">
            <p class="empty-text-small">本期帳單沒有消費明細喔～🐾</p>
          </div>
          <div v-else class="bill-list">
            <div 
              v-for="tx in billedTransactions" 
              :key="tx.id"
              class="bill-tx-item card-jelly"
            >
              <div class="bill-tx-left">
                <span class="bill-tx-cat">
                  {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
                </span>
                <span class="bill-tx-note">{{ tx.note }}</span>
                <span v-if="tx.creditCardDetails?.isInstallment" class="tag-jelly installment-tag">
                  分期 {{ tx.creditCardDetails.currentInstallment }}/{{ tx.creditCardDetails.installmentTerm }} 期
                </span>
              </div>
              <div class="bill-tx-right">
                <span class="bill-tx-amount">${{ formatCurrency(tx.amount) }}</span>
                <span class="bill-tx-date">
                  {{ new Date(tx.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 一鍵還款彈窗 ========== -->
    <Teleport to="#app">
      <div v-if="showPayModal" class="modal-overlay">
        <div class="modal-card card-jelly pop-jelly">
          <div class="mascot-pay-header">
            <span class="cat-pop-emoji">🐱</span>
            <p class="cat-speech-bubble">「喵嗚～主人！本期帳單要從哪一個銀行帳戶扣款繳納呢？」</p>
          </div>
          <div class="pay-amount-summary">
            <span class="summary-label">繳納帳單月份</span>
            <span class="summary-period">{{ selectedPeriod }} 帳單</span>
            <h3 class="summary-amount">${{ formatCurrency(billTotalAmount) }}</h3>
          </div>
          <div class="form-group">
            <label class="label-cute">扣款銀行 / 現金帳戶</label>
            <AccountPicker v-model="linkedBankId" :accounts="bankAccounts" />
          </div>
          <div class="modal-actions">
            <button class="btn-jelly btn-cancel" @click="showPayModal = false">取消</button>
            <button 
              class="btn-jelly btn-confirm-pay" 
              :disabled="!linkedBankId || bankAccounts.length === 0"
              @click="handlePayBill"
            >
              確認扣款還卡費 ➜
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 1. 新增帳戶可愛彈窗 -->
    <Teleport to="#app">
      <div v-if="showAddModal" class="modal-overlay">
        <div class="modal-card card-jelly pop-jelly">
          <h3 class="modal-title">新增理財帳戶</h3>
          
          <div class="form-group">
            <label class="label-cute">帳戶名稱</label>
            <input v-model="newName" type="text" placeholder="例如：生活現金、Richart 存款" class="input-jelly" maxlength="15" />
          </div>

          <div class="form-group">
            <label class="label-cute">帳戶類型</label>
            <div class="type-selector-grid">
              <button 
                v-for="t in (['cash', 'bank', 'credit_card', 'electronic_ticket'] as AccountType[])" 
                :key="t"
                class="btn-jelly btn-type-select"
                :class="{ active: newType === t }"
                @click="newType = t"
              >
                {{ t === 'cash' ? '現金' : t === 'bank' ? '銀行' : t === 'credit_card' ? '信用卡' : '電子票證' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="label-cute">
              {{ newType === 'credit_card' ? '已消費欠款金額' : '初始餘額' }}
            </label>
            <input v-model="newBalance" type="number" placeholder="0" class="input-jelly" />
          </div>

          <!-- 信用卡專屬欄位 (動態展開) -->
          <Transition name="expand-details">
            <div v-if="newType === 'credit_card'" class="credit-exclusive-fields card-jelly">
              <h4 class="sub-fields-title">💳 信用卡參數設定</h4>
              <div class="form-group">
                <label class="label-cute">信用額度</label>
                <input v-model="creditLimit" type="number" placeholder="50000" class="input-jelly" />
              </div>
              <div class="fields-row">
                <div class="form-group half-width">
                  <label class="label-cute">每月結帳日</label>
                  <input v-model="billingCycleDate" type="number" min="1" max="31" placeholder="10" class="input-jelly" />
                </div>
                <div class="form-group half-width">
                  <label class="label-cute">每月繳款截止日</label>
                  <input v-model="paymentDueDate" type="number" min="1" max="31" placeholder="25" class="input-jelly" />
                </div>
              </div>
            </div>
          </Transition>

          <div class="form-group">
            <label class="label-cute">帳戶 Emoji 頭像（可選）</label>
            <div class="avatar-picker-grid">
              <button
                class="btn-jelly avatar-option"
                :class="{ active: newAvatar === '' }"
                @click="newAvatar = ''"
              >
                —
              </button>
              <button
                v-for="em in avatarOptions"
                :key="em"
                class="btn-jelly avatar-option"
                :class="{ active: newAvatar === em }"
                @click="newAvatar = em"
              >
                {{ em }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="label-cute">卡片配色</label>
            <div class="color-picker-grid">
              <div 
                v-for="(col, idx) in cardColors" 
                :key="idx"
                class="color-dot btn-jelly"
                :class="{ active: selectedColorIdx === idx }"
                :style="{ backgroundColor: col.value }"
                @click="selectedColorIdx = idx"
              >
                <Check v-if="selectedColorIdx === idx" :size="14" stroke-width="4" stroke="#2C1E1B" />
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-jelly btn-cancel" @click="toggleAddModal">取消</button>
            <button class="btn-jelly btn-confirm" :disabled="!newName.trim()" @click="handleAddAccount">建立卡片</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 2. 帳戶互轉可愛彈窗 -->
    <Teleport to="#app">
      <div v-if="showTransferModal" class="modal-overlay">
        <div class="modal-card card-jelly pop-jelly">
          <h3 class="modal-title">資金帳戶互轉</h3>

          <div class="form-group">
            <label class="label-cute">來源帳戶 (扣款)</label>
            <select v-model="fromAccountId" class="input-jelly">
              <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }} (${{ formatCurrency(a.balance) }})</option>
            </select>
          </div>

          <div class="form-group">
            <label class="label-cute">目的帳戶 (存款)</label>
            <select v-model="toAccountId" class="input-jelly">
              <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }} (${{ formatCurrency(a.balance) }})</option>
            </select>
          </div>

          <div class="form-group">
            <label class="label-cute">轉帳金額</label>
            <input v-model="transferAmount" type="number" placeholder="金額..." class="input-jelly" />
          </div>

          <div class="form-group">
            <label class="label-cute">轉帳手續費 (將計為一筆獨立支出)</label>
            <input v-model="transferFee" type="number" placeholder="0" class="input-jelly" />
          </div>

          <div class="form-group">
            <label class="label-cute">備註</label>
            <input v-model="transferNote" type="text" placeholder="轉零用錢、存錢..." class="input-jelly" />
          </div>

          <div class="modal-actions">
            <button class="btn-jelly btn-cancel" @click="toggleTransferModal">取消</button>
            <button 
              class="btn-jelly btn-confirm-transfer" 
              :disabled="!transferAmount || fromAccountId === toAccountId"
              @click="handleTransfer"
            >
              確認轉帳 ➜
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 3. 編輯帳戶彈窗 -->
    <Teleport to="#app">
      <div v-if="showEditModal" class="modal-overlay">
        <div class="modal-card card-jelly pop-jelly">
          <div class="modal-header-row">
            <h3 class="modal-title">✏️ 編輯帳戶</h3>
            <button class="btn-jelly btn-close-edit" @click="closeEditModal">
              <X :size="14" />
            </button>
          </div>

          <div class="form-group">
            <label class="label-cute">帳戶名稱</label>
            <input v-model="editName" type="text" class="input-jelly" maxlength="15" />
          </div>

          <div class="form-group">
            <label class="label-cute">
              {{ editType === 'credit_card' ? '當前已刷金額 (負債)' : '目前金額 (餘額)' }}
            </label>
            <input v-model.number="editBalance" type="number" class="input-jelly" placeholder="0" />
          </div>

          <div class="form-group">
            <label class="label-cute">Emoji 頭像</label>
            <div class="avatar-picker-grid">
              <button
                class="btn-jelly avatar-option"
                :class="{ active: editAvatar === '' }"
                @click="editAvatar = ''"
              >
                —
              </button>
              <button
                v-for="em in avatarOptions"
                :key="em"
                class="btn-jelly avatar-option"
                :class="{ active: editAvatar === em }"
                @click="editAvatar = em"
              >
                {{ em }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="label-cute">卡片配色</label>
            <div class="color-picker-grid">
              <div
                v-for="(col, idx) in cardColors"
                :key="idx"
                class="color-dot btn-jelly"
                :class="{ active: editColorIdx === idx }"
                :style="{ backgroundColor: col.value }"
                @click="editColorIdx = idx"
              >
                <Check v-if="editColorIdx === idx" :size="14" stroke-width="4" stroke="#2C1E1B" />
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-jelly btn-cancel" @click="closeEditModal">取消</button>
            <button class="btn-jelly btn-confirm" :disabled="!editName.trim()" @click="handleSaveEdit">儲存 ✔</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.accounts-page-container {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 12px;
}

/* 內部 Tab 切換 */
.inner-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.inner-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 8px !important;
  font-size: 12px;
  background-color: #fff;
}

.inner-tab.active {
  background-color: var(--color-accent-gold) !important;
  border-width: 2.5px;
}

.action-buttons-row {
  display: flex;
  gap: 12px;
}

.btn-action {
  flex: 1;
  gap: 6px;
  font-size: 13px;
  padding: 12px !important;
}

.btn-add {
  background-color: var(--color-accent-gold) !important;
}

.btn-transfer {
  background-color: var(--color-transfer) !important;
}

.btn-transfer:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

/* 信用卡帳單區塊 */
.credit-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.alert-icon-circle {
  width: 54px;
  height: 54px;
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px auto;
  box-shadow: var(--shadow-jelly-sm);
}

.selectors-row {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px !important;
  background-color: #FFFFFF;
}

.select-group {
  flex: 1;
}

.bill-card-picker :deep(.acct-card) {
  min-width: 116px;
  padding: 10px 10px !important;
  gap: 6px;
}

.bill-card-picker :deep(.acct-avatar) {
  width: 30px;
  height: 30px;
}

.bill-card-picker :deep(.acct-name) {
  font-size: 14px;
  max-width: 98px;
}

.bill-card-picker :deep(.acct-balance) {
  font-size: 12px;
}

.bill-status-board {
  margin-bottom: 0;
}

.board-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.board-period-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background-color: rgba(44, 30, 27, 0.1);
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 800;
}

.board-due-date {
  font-size: 14px;
  font-weight: 800;
}

.board-amount-section {
  text-align: center;
  margin: 20px 0;
}

.amount-label {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.amount-value {
  font-size: 44px;
  font-weight: 800;
  margin-top: 8px;
  letter-spacing: -1px;
  line-height: 1;
}

.board-progress-section {
  margin-bottom: 18px;
}

.board-progress-section .progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 6px;
}

.board-progress-section .progress-bar-container {
  height: 12px;
  border-width: 1.5px;
  background-color: rgba(44, 30, 27, 0.05);
}

.board-actions {
  display: flex;
  justify-content: center;
}

.pay-success-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
  color: #2C8C67;
  background-color: rgba(46, 176, 134, 0.15);
  border: 1.5px solid #2C8C67;
  padding: 8px 14px;
  border-radius: 20px;
}

.icon-success { color: #2C8C67; }

.btn-pay-bill {
  width: 100%;
  background-color: #FFFFFF !important;
  padding: 14px !important;
  font-size: 16px;
  letter-spacing: 0.3px;
}

.bill-details-section.card-jelly {
  margin-top: 0;
}

.section-subtitle {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 12px;
}

.empty-bill-details {
  text-align: center;
  padding: 24px 0;
}

.empty-text-small {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.bill-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bill-tx-item {
  display: flex !important;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px !important;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.bill-tx-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bill-tx-cat {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
}

.bill-tx-note {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.installment-tag {
  font-size: 11px !important;
  padding: 2px 8px !important;
  background-color: var(--color-expense) !important;
  margin-top: 4px;
  width: fit-content;
}

.bill-tx-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.bill-tx-amount {
  font-size: 18px;
  font-weight: 800;
  color: #FF5A5A;
}

.bill-tx-date {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

/* 還款彈窗 */
.mascot-pay-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  margin-bottom: 16px;
}

.cat-pop-emoji { font-size: 24px; }

.cat-speech-bubble {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.pay-amount-summary {
  text-align: center;
  border-bottom: 1.5px dashed var(--color-border);
  padding-bottom: 12px;
  margin-bottom: 14px;
}

.summary-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.summary-period {
  display: block;
  font-size: 12px;
  font-weight: 800;
  margin-top: 2px;
}

.summary-amount {
  font-size: 24px;
  font-weight: 800;
  margin-top: 4px;
}

.btn-confirm-pay {
  flex: 1;
  background-color: var(--color-income) !important;
}

.btn-confirm-pay:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

/* 帳戶卡片清單 */
.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-placeholder {
  text-align: center;
  padding: 30px 20px !important;
}

.empty-text {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
}

/* 繪本插畫風格帳戶卡片 */
.account-card {
  padding: 10px 14px !important;
  margin-bottom: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: opacity 0.15s, box-shadow 0.15s;
}

.account-card.is-dragging {
  opacity: 0.4;
}

.account-card.drag-over {
  box-shadow: 0 0 0 2.5px var(--color-text-dark) !important;
}

.account-card :deep(.progress-bar-container) {
  height: 10px !important;
}

/* Row 1：帳戶名 + 操作按鈕 */
.card-main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.card-name {
  font-size: 18px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-type-icon {
  opacity: 0.6;
  flex-shrink: 0;
}

/* Row 2：badge + 幣別 / 餘額 */
.card-balance-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-top: 2px;
}

.card-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  background-color: rgba(44, 30, 27, 0.08);
  border: 1.5px solid var(--color-border);
  padding: 2px 7px;
  border-radius: 20px;
}

.drag-handle {
  display: flex;
  align-items: center;
  cursor: grab;
  opacity: 0.35;
  padding: 2px 2px;
  border-radius: 4px;
  flex-shrink: 0;
  touch-action: none;
}

.drag-handle:hover {
  opacity: 0.7;
  background-color: rgba(0, 0, 0, 0.06);
}

.drag-handle:active {
  cursor: grabbing;
}

.btn-delete-card {
  width: 28px;
  height: 28px;
  background-color: #fff;
  border: var(--border-width) solid var(--color-border);
  border-radius: 50%;
  font-size: 16px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
  transition: all 0.1s ease;
}

.btn-delete-card:active {
  transform: scale(0.9);
}

.btn-edit-card {
  width: 28px;
  height: 28px;
  background-color: #EEF4FF;
  border: var(--border-width) solid #A9C9FF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
  color: #4A7FE0;
  transition: all 0.1s ease;
}

.btn-edit-card:active {
  transform: scale(0.9);
}

.card-top-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.card-avatar-emoji {
  font-size: 20px;
  flex-shrink: 0;
}

/* Avatar picker */
.avatar-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.avatar-option {
  width: 34px;
  height: 34px;
  padding: 0 !important;
  font-size: 16px;
  background-color: var(--color-bg-warm) !important;
  border-radius: var(--border-radius-sm) !important;
}

.avatar-option.active {
  background-color: var(--color-income) !important;
  border-width: 2.5px;
}

/* Edit modal header row */
.modal-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.btn-close-edit {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: 50% !important;
}

.currency-tag {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  border: 1.5px solid var(--color-border);
  padding: 2px 5px;
  border-radius: 4px;
}

.general-balance {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.negative-val {
  color: #FF5A5A;
}

/* 信用卡專屬卡片欄位 */
.credit-balance-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.debt-amount {
  font-size: 12px;
  font-weight: 800;
  color: #C66230;
}

.limit-amount {
  font-size: 15px;
  font-weight: 800;
}

.credit-progress-section {
  width: 100%;
  max-width: 160px;
  margin-top: 4px;
}

.credit-progress-section .progress-bar-container {
  height: 8px;
  border-width: 1.5px;
}

.card-details-small {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* 馬卡龍卡片背景色配色系統 */
.card-gold   { background-color: var(--color-accent-gold)   !important; }
.card-pink   { background-color: var(--color-expense)        !important; }
.card-blue   { background-color: var(--color-transfer)       !important; }
.card-purple { background-color: var(--color-accent-purple)  !important; }
.card-mint   { background-color: var(--color-accent-mint)    !important; }
.card-peach  { background-color: var(--color-accent-peach)   !important; }
.card-lemon  { background-color: var(--color-accent-lemon)   !important; }
.card-rose   { background-color: var(--color-accent-rose)    !important; }
.card-sky    { background-color: var(--color-accent-sky)     !important; }
.card-lilac  { background-color: var(--color-accent-lilac)   !important; }
.card-sage   { background-color: var(--color-accent-sage)    !important; }
.card-cocoa  { background-color: var(--color-accent-cocoa)   !important; }
.card-coral  { background-color: var(--color-accent-coral)   !important; }

/* 彈窗樣式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(44, 30, 27, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.modal-card {
  width: 100%;
  max-width: 360px;
  background-color: #FFFFFF;
  margin: auto 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 16px;
  text-align: center;
}

.form-group {
  margin-bottom: 14px;
  width: 100%;
}

.label-cute {
  font-size: 12px;
  font-weight: 800;
  display: block;
  margin-bottom: 6px;
  padding-left: 4px;
}

.type-selector-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.btn-type-select {
  padding: 8px !important;
  font-size: 12px;
  background-color: var(--color-bg-warm) !important;
}

.btn-type-select.active {
  background-color: var(--color-accent-gold) !important;
  border-width: 3px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn-cancel {
  flex: 1;
  background-color: #FFF;
  color: var(--color-text-muted);
}

.btn-confirm {
  flex: 1;
  background-color: var(--color-income) !important;
}

.btn-confirm-transfer {
  flex: 1;
  background-color: var(--color-transfer) !important;
}

.btn-confirm:disabled,
.btn-confirm-transfer:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

/* 信用卡專屬子面板動畫 */
.credit-exclusive-fields {
  background-color: var(--color-bg-warm) !important;
  padding: 12px !important;
  border-radius: var(--border-radius-md);
  margin-top: 10px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.sub-fields-title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 8px;
}

.fields-row {
  display: flex;
  gap: 10px;
}

.half-width {
  flex: 1;
}

/* 卡片配色選擇 */
.color-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-dot {
  width: 32px;
  height: 32px;
  border-radius: 50% !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
}

.color-dot.active {
  transform: scale(1.1);
  border-width: 3px;
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

.results-count {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  background-color: var(--color-bg-warm);
  padding: 3px 10px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
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

/* 搜尋為空時的按鈕樣式 */
.btn-clear-search {
  margin-top: 10px;
  background-color: var(--color-accent-gold) !important;
  padding: 8px 16px !important;
  font-size: 12px;
}

.empty-emoji {
  font-size: 32px;
  margin-bottom: 8px;
}
</style>
