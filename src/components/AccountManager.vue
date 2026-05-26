<script setup lang="ts">
import { ref } from 'vue'
import { useLedger } from '../composables/useLedger'
import type { Account, AccountType } from '../types'
import { 
  Plus, 
  ArrowLeftRight, 
  Wallet, 
  Landmark, 
  CreditCard, 
  Compass, 
  Check,
  Sparkles
} from 'lucide-vue-next'

const { 
  accounts, 
  addAccount, 
  deleteAccount,
  addTransaction 
} = useLedger()

// 帳戶專屬馬卡龍漸層配色選項
const cardColors = [
  { class: 'card-gold', value: '#FFDAC1', name: '奶油黃' },
  { class: 'card-pink', value: '#FFB4B4', name: '櫻桃粉' },
  { class: 'card-blue', value: '#A9C9FF', name: '天空藍' },
  { class: 'card-purple', value: '#E2C6FF', name: '薰衣草紫' }
]

// 狀態控制
const showAddModal = ref(false)
const showTransferModal = ref(false)

// 新增帳戶表單狀態
const newName = ref('')
const newType = ref<AccountType>('cash')
const newBalance = ref<number | ''>('')
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

const toggleAddModal = () => {
  showAddModal.value = !showAddModal.value
  if (showAddModal.value) {
    newName.value = ''
    newType.value = 'cash'
    newBalance.value = ''
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

const handleAddAccount = async () => {
  if (!newName.value.trim()) return
  
  const balanceVal = Number(newBalance.value) || 0
  
  const acctData: any = {
    name: newName.value.trim(),
    type: newType.value,
    balance: newType.value === 'credit_card' ? -balanceVal : balanceVal, // 信用卡餘額初始為負值 (已消費金額)
    icon: newType.value === 'cash' ? 'Wallet' : newType.value === 'bank' ? 'Landmark' : newType.value === 'credit_card' ? 'CreditCard' : 'Compass',
    color: cardColors[selectedColorIdx.value].class,
    currency: 'TWD'
  }

  // 信用卡專屬規格
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
</script>

<template>
  <div class="accounts-page-container pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 帳戶與資產管理</h2>
      <div class="action-buttons-row">
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

    <!-- 帳戶列表展示 (大圓角馬卡龍卡片) -->
    <div class="accounts-list">
      <div v-if="accounts.length === 0" class="empty-placeholder card-jelly">
        <p class="empty-text">主人目前還沒有建立任何帳戶喔喵～</p>
        <p class="empty-hint">請點擊上方「新增帳戶」建立第一個記帳卡片吧！</p>
      </div>

      <div 
        v-for="acct in accounts" 
        :key="acct.id"
        class="account-card card-jelly"
        :class="acct.color"
      >
        <div class="card-top-row">
          <div class="card-badge">
            <Wallet v-if="acct.type === 'cash'" :size="16" />
            <Landmark v-else-if="acct.type === 'bank'" :size="16" />
            <CreditCard v-else-if="acct.type === 'credit_card'" :size="16" />
            <Compass v-else :size="16" />
            <span class="type-text">
              {{ acct.type === 'cash' ? '現金' : acct.type === 'bank' ? '銀行存款' : acct.type === 'credit_card' ? '信用卡' : '電子票證' }}
            </span>
          </div>
          <button class="btn-delete-card" @click="deleteAccount(acct.id)">
            ×
          </button>
        </div>

        <h3 class="card-name">{{ acct.name }}</h3>

        <!-- 餘額與額度呈現 -->
        <div class="card-balance-block">
          <span class="currency-tag">TWD</span>
          <!-- 信用卡顯示可用額度 / 總負債 -->
          <div v-if="acct.type === 'credit_card'" class="credit-balance-info">
            <div class="debt-amount">已刷負債: ${{ formatCurrency(Math.abs(acct.balance)) }}</div>
            <div class="limit-amount">
              可用額度: ${{ formatCurrency(Math.max((acct.cardDetails?.creditLimit || 50000) - Math.abs(acct.balance), 0)) }}
              / ${{ formatCurrency(acct.cardDetails?.creditLimit || 50000) }}
            </div>
            
            <!-- 額度進度條 -->
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
              結帳日: 每月 {{ acct.cardDetails?.billingCycleDate }} 號 | 繳款日: 每月 {{ acct.cardDetails?.paymentDueDate }} 號
            </div>
          </div>

          <!-- 一般帳戶顯示正餘額 -->
          <div v-else class="general-balance" :class="{ 'negative-val': acct.balance < 0 }">
            ${{ formatCurrency(acct.balance) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 1. 新增帳戶可愛彈窗 -->
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

    <!-- 2. 帳戶互轉可愛彈窗 -->
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
  </div>
</template>

<style scoped>
.accounts-page-container {
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 12px;
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

/* 帳戶卡片清單 */
.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  padding: 18px !important;
  margin-bottom: 0 !important;
  display: flex;
  flex-direction: column;
}

.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(44, 30, 27, 0.1);
  padding: 4px 8px;
  border-radius: 20px;
  border: 1.5px solid var(--color-border);
}

.type-text {
  font-size: 10px;
  font-weight: 800;
}

.btn-delete-card {
  width: 22px;
  height: 22px;
  background: none;
  border: var(--border-width) solid var(--color-border);
  border-radius: 50%;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
  background-color: #FFF;
  transition: all 0.1s ease;
}

.btn-delete-card:active {
  transform: scale(0.9);
}

.card-name {
  font-size: 18px;
  font-weight: 800;
  margin-top: 12px;
}

.card-balance-block {
  margin-top: 14px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.currency-tag {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  border: 1.5px solid var(--color-border);
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: auto;
}

.general-balance {
  font-size: 24px;
  font-weight: 800;
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
  width: calc(100% - 60px);
}

.debt-amount {
  font-size: 11px;
  font-weight: 700;
  color: #C66230;
}

.limit-amount {
  font-size: 13px;
  font-weight: 800;
  margin-top: 2px;
}

.credit-progress-section {
  width: 100%;
  max-width: 200px;
  margin-top: 6px;
}

.credit-progress-section .progress-bar-container {
  height: 10px;
  border-width: 1.5px;
}

.card-details-small {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 6px;
}

/* 馬卡龍卡片背景色配色系統 */
.card-gold { background-color: var(--color-accent-gold) !important; }
.card-pink { background-color: var(--color-expense) !important; }
.card-blue { background-color: var(--color-transfer) !important; }
.card-purple { background-color: var(--color-accent-purple) !important; }

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
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal-card {
  width: 100%;
  max-width: 360px;
  background-color: #FFFFFF;
  margin-bottom: 0;
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
</style>
