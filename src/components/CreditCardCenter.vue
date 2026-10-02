<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLedger } from '../composables/useLedger'
import { useConfirm } from '../composables/useConfirm'
import type { Transaction } from '../types'
import { 
  CreditCard, 
  Calendar, 
  CheckCircle,
  Sparkles,
  Pencil,
  Trash2,
  X,
  Check
} from 'lucide-vue-next'
import DatePicker from './DatePicker.vue'
import AccountDropdown from './AccountDropdown.vue'

const { 
  visibleAccounts, 
  transactions, 
  categories,
  editTransaction,
  deleteTransaction,
  payCreditCardBill 
} = useLedger()

const { showConfirm } = useConfirm()

// 篩選出所有信用卡帳戶
const creditCards = computed(() => {
  return visibleAccounts.value.filter(a => a.type === 'credit_card')
})

// 選定的信用卡 ID 與選定的帳單月份 (預設為第一張卡與本月)
const selectedCardId = ref('')
const selectedPeriod = ref('')

// 當有信用卡時，進行預設選取
const initDefaults = () => {
  if (creditCards.value.length > 0) {
    if (!selectedCardId.value) selectedCardId.value = creditCards.value[0].id
    
    if (!selectedPeriod.value) {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      selectedPeriod.value = `${y}-${m}`
    }
  }
}

// 監聽變更
const activeCard = computed(() => {
  return creditCards.value.find(a => a.id === selectedCardId.value)
})

// 產生最近 6 個月的帳單月份清單，以利切換查詢
const billPeriods = computed(() => {
  const list = []
  const d = new Date()
  for (let i = -3; i <= 2; i++) {
    const date = new Date()
    date.setMonth(d.getMonth() + i)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    list.push(`${y}-${m}`)
  }
  return list
})

// 篩選出目前選定卡片、在選定月份已出帳的交易明細
const billedTransactions = computed(() => {
  if (!selectedCardId.value || !selectedPeriod.value) return []
  return transactions.value.filter(tx => {
    return tx.fromAccountId === selectedCardId.value && 
           tx.creditCardDetails?.billPeriod === selectedPeriod.value
  })
})

// 本期帳單總金額
const billTotalAmount = computed(() => {
  return billedTransactions.value.reduce((sum, tx) => sum + tx.amount, 0)
})

// 還款彈窗控制
const showPayModal = ref(false)
const linkedBankId = ref('')

// 篩選可用於扣款的銀行/現金帳戶
const bankAccounts = computed(() => {
  return visibleAccounts.value.filter(a => a.type === 'bank' || a.type === 'cash')
})

const openPayModal = () => {
  if (billTotalAmount.value <= 0) return
  
  // 尋找信用卡本身設定的自動扣繳銀行，或預設選取第一個銀行
  if (activeCard.value?.cardDetails?.linkedBankAccountId) {
    linkedBankId.value = activeCard.value.cardDetails.linkedBankAccountId
  } else {
    linkedBankId.value = bankAccounts.value[0]?.id || ''
  }
  
  showPayModal.value = true
}

const handlePayBill = async () => {
  if (!selectedCardId.value || !linkedBankId.value || !selectedPeriod.value) return
  
  await payCreditCardBill(selectedCardId.value, linkedBankId.value, selectedPeriod.value)
  showPayModal.value = false
}

// 格式化千分位金額
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}

// ========== 編輯信用卡消費明細邏輯 ==========
const showEditTxModal = ref(false)
const editingTx = ref<Transaction | null>(null)
const editTxAmount = ref<number | ''>('')
const editTxNote = ref('')
const editTxDateStr = ref('')
const editTxCategory = ref('')
const editTxSubCategory = ref('')
const editTxFromAccountId = ref('')

const expenseCategories = computed(() =>
  categories.value.filter(c => c.type === 'expense')
)

const subCategoryOptionsForEditTx = computed(() => {
  const cat = categories.value.find(c => c.name === editTxCategory.value && c.type === 'expense')
  return cat?.subCategories || []
})

const selectEditTxCategory = (catName: string) => {
  editTxCategory.value = catName
  const cat = categories.value.find(c => c.name === catName && c.type === 'expense')
  editTxSubCategory.value = cat?.subCategories?.[0] || ''
}

const openEditTxModal = (tx: Transaction) => {
  editingTx.value = tx
  editTxAmount.value = tx.amount
  editTxNote.value = tx.note || ''
  editTxDateStr.value = new Date(tx.date).toISOString().split('T')[0]
  editTxCategory.value = tx.category
  editTxSubCategory.value = tx.subCategory || ''
  editTxFromAccountId.value = tx.fromAccountId || ''
  showEditTxModal.value = true
}

const closeEditTxModal = () => {
  showEditTxModal.value = false
  editingTx.value = null
}

const handleSaveEditTx = async () => {
  if (!editingTx.value) return
  const amt = Number(editTxAmount.value)
  if (isNaN(amt) || amt <= 0) return

  await editTransaction(editingTx.value.id, {
    amount: amt,
    note: editTxNote.value.trim(),
    date: new Date(editTxDateStr.value).getTime(),
    category: editTxCategory.value,
    subCategory: editTxSubCategory.value || undefined,
    fromAccountId: editTxFromAccountId.value || undefined
  })

  closeEditTxModal()
}

const handleDeleteEditTx = async () => {
  if (!editingTx.value) return
  const tx = editingTx.value
  const confirmed = await showConfirm(
    `確定要刪除這筆「${tx.category}${tx.note ? ' - ' + tx.note : ''}」$${formatCurrency(tx.amount)} 的明細嗎？刪除後信用卡額度與帳單金額將自動釋放與更新喔！喵？`,
    '🐱 確定刪除此筆明細？'
  )
  if (!confirmed) return

  await deleteTransaction(tx.id)
  closeEditTxModal()
}

// 初始化
initDefaults()
</script>

<template>
  <div class="credit-card-page pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 信用卡理財中心</h2>
      <p class="page-subtitle">管理您的信用卡帳單、分期攤還與可用額度</p>
    </div>

    <!-- 0. 無信用卡提示 -->
    <div v-if="creditCards.length === 0" class="empty-placeholder card-jelly">
      <div class="alert-icon-circle">
        <CreditCard :size="32" />
      </div>
      <p class="empty-text">主人目前還沒有建立任何信用卡帳戶喔喵～</p>
      <p class="empty-hint">請至「資產管理」新增一張類型為信用卡的卡片吧！</p>
    </div>

    <div v-else class="credit-core-layout">
      <!-- 1. 卡片與月份快速篩選列 -->
      <div class="selectors-row card-jelly">
        <!-- 卡片選取 -->
        <div class="select-group">
          <label class="label-cute">選擇信用卡</label>
          <select v-model="selectedCardId" class="input-jelly select-cute">
            <option v-for="c in creditCards" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- 帳單月份選取 -->
        <div class="select-group">
          <label class="label-cute">帳單月份</label>
          <select v-model="selectedPeriod" class="input-jelly select-cute">
            <option v-for="p in billPeriods" :key="p" :value="p">{{ p }} 帳單</option>
          </select>
        </div>
      </div>

      <!-- 2. 當期帳單狀態看板 -->
      <div class="bill-status-board card-jelly" :class="activeCard?.color">
        <div class="board-top">
          <span class="board-period-badge">
            <Calendar :size="12" /> {{ selectedPeriod }} 帳單
          </span>
          <span class="board-due-date">
            每月 {{ activeCard?.cardDetails?.paymentDueDate }} 號截止繳納
          </span>
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
            ></div>
          </div>
        </div>

        <!-- 繳款操作區 -->
        <div class="board-actions">
          <div v-if="billTotalAmount === 0" class="pay-success-status pop-jelly">
            <CheckCircle :size="16" class="icon-success" /> 本期已繳清或無消費紀錄，棒棒噠！
          </div>
          
          <button 
            v-else 
            class="btn-jelly btn-pay-bill pop-jelly"
            @click="openPayModal"
          >
            一鍵扣款繳納帳單 ➜
          </button>
        </div>
      </div>

      <!-- 3. 本期已出帳明細清單 -->
      <div class="bill-details-section card-jelly">
        <h3 class="section-subtitle">
          本期已出帳明細 ({{ billedTransactions.length }} 筆)
        </h3>

        <div v-if="billedTransactions.length === 0" class="empty-bill-details">
          <p class="empty-text-small">本期帳單沒有發現任何消費明細喔～🐾</p>
        </div>

        <div v-else class="bill-list">
          <div 
            v-for="tx in billedTransactions" 
            :key="tx.id"
            class="bill-tx-item card-jelly"
            @click="openEditTxModal(tx)"
            title="點擊編輯明細"
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
              <div class="bill-tx-amount-group">
                <span class="bill-tx-amount">${{ formatCurrency(tx.amount) }}</span>
                <span class="bill-tx-date">
                  消費日: {{ new Date(tx.date).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'}) }}
                </span>
              </div>
              <button
                class="btn-edit-tx btn-jelly"
                @click.stop="openEditTxModal(tx)"
                title="編輯明細"
                type="button"
              >
                <Pencil :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 可愛一鍵還款引導彈窗 -->
    <div v-if="showPayModal" class="modal-overlay">
      <div class="modal-card card-jelly pop-jelly">
        <div class="mascot-pay-header">
          <span class="cat-pop-emoji">🐱</span>
          <p class="cat-speech-bubble">
            「喵嗚～主人！本期帳單要從哪一個銀行帳戶扣款繳納呢？請選擇一個有足夠小魚乾的帳戶喔！」
          </p>
        </div>

        <div class="pay-amount-summary">
          <span class="summary-label">繳納帳單月份</span>
          <span class="summary-period">{{ selectedPeriod }} 帳單</span>
          <h3 class="summary-amount">${{ formatCurrency(billTotalAmount) }}</h3>
        </div>

        <div class="form-group">
          <label class="label-cute">扣款銀行/現金帳戶</label>
          <select v-model="linkedBankId" class="input-jelly">
            <option v-for="b in bankAccounts" :key="b.id" :value="b.id">
              {{ b.name }} (餘額: ${{ formatCurrency(b.balance) }})
            </option>
          </select>
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

    <!-- 5. 編輯信用卡消費明細彈窗 -->
    <Teleport to="#app">
      <div v-if="showEditTxModal" class="modal-overlay" @click="closeEditTxModal">
        <div class="modal-card card-jelly pop-jelly" @click.stop>
          <div class="modal-header-with-close">
            <h3 class="modal-title">✏️ 編輯消費明細</h3>
            <button class="btn-jelly btn-close-modal" @click="closeEditTxModal" type="button">
              <X :size="16" />
            </button>
          </div>

          <!-- 分期交易提示 -->
          <div v-if="editingTx?.creditCardDetails?.isInstallment" class="installment-notice card-jelly">
            <span>💡 此筆為分期消費（第 {{ editingTx.creditCardDetails.currentInstallment }}/{{ editingTx.creditCardDetails.installmentTerm }} 期），修改金額將更新本期分攤金額。</span>
          </div>

          <!-- 金額 -->
          <div class="form-group">
            <label class="label-cute">消費金額</label>
            <input v-model.number="editTxAmount" type="number" min="0" class="input-jelly" placeholder="0" />
          </div>

          <!-- 備註 -->
          <div class="form-group">
            <label class="label-cute">備註說明</label>
            <input v-model="editTxNote" type="text" class="input-jelly" maxlength="40" placeholder="例如：生活日用品" />
          </div>

          <!-- 日期 -->
          <div class="form-group">
            <label class="label-cute">消費日期</label>
            <DatePicker v-model="editTxDateStr" />
          </div>

          <!-- 扣款卡片 / 帳戶 -->
          <div class="form-group">
            <label class="label-cute">扣款信用卡 / 帳戶</label>
            <AccountDropdown
              v-model="editTxFromAccountId"
              :accounts="visibleAccounts"
              placeholder="選擇扣款信用卡或帳戶..."
            />
          </div>

          <!-- 主分類 -->
          <div class="form-group">
            <label class="label-cute">主分類</label>
            <div class="cat-chips">
              <button
                v-for="cat in expenseCategories"
                :key="cat.id"
                class="btn-jelly chip-btn"
                :class="{ active: editTxCategory === cat.name }"
                @click="selectEditTxCategory(cat.name)"
                type="button"
              >
                {{ cat.name }}
              </button>
            </div>
          </div>

          <!-- 子分類 -->
          <div v-if="subCategoryOptionsForEditTx.length" class="form-group">
            <label class="label-cute">子分類</label>
            <div class="cat-chips">
              <button
                v-for="sub in subCategoryOptionsForEditTx"
                :key="sub"
                class="btn-jelly chip-btn"
                :class="{ active: editTxSubCategory === sub }"
                @click="editTxSubCategory = sub"
                type="button"
              >
                {{ sub }}
                <Check v-if="editTxSubCategory === sub" :size="10" stroke-width="4" class="inline-check" />
              </button>
            </div>
          </div>

          <!-- 底部操作按鈕 -->
          <div class="modal-actions-between">
            <button
              class="btn-jelly btn-delete-tx"
              @click="handleDeleteEditTx"
              type="button"
            >
              <Trash2 :size="14" /> 刪除此筆
            </button>
            <div class="right-buttons">
              <button class="btn-jelly btn-secondary" @click="closeEditTxModal" type="button">取消</button>
              <button class="btn-jelly btn-primary" @click="handleSaveEditTx" type="button">儲存修改</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.credit-card-page {
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.empty-placeholder {
  text-align: center;
  padding: 40px 20px !important;
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

/* 篩選列 */
.selectors-row {
  display: flex;
  gap: 12px;
  padding: 12px !important;
  background-color: #FFFFFF;
}

.select-group {
  flex: 1;
}

.select-cute {
  font-weight: 700;
  background-color: var(--color-bg-warm);
}

/* 信用卡大卡片看板 */
.bill-status-board {
  margin-bottom: 20px;
}

.board-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.board-period-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: rgba(44, 30, 27, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 800;
}

.board-due-date {
  font-size: 9px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.board-amount-section {
  text-align: center;
  margin: 20px 0;
}

.amount-label {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.amount-value {
  font-size: 32px;
  font-weight: 800;
  margin-top: 4px;
  letter-spacing: -0.5px;
}

.board-progress-section {
  margin-bottom: 18px;
}

.board-progress-section .progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 800;
  margin-bottom: 4px;
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
  font-size: 12px;
  font-weight: 800;
  color: #2C8C67;
  background-color: rgba(46, 176, 134, 0.15);
  border: 1.5px solid #2C8C67;
  padding: 6px 12px;
  border-radius: 20px;
}

.icon-success {
  color: #2C8C67;
}

.btn-pay-bill {
  width: 100%;
  background-color: #FFFFFF !important;
  padding: 10px !important;
  font-size: 13px;
  letter-spacing: 0.5px;
}

/* 帳單明細清單 */
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
  align-items: center;
  padding: 10px 14px !important;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.15s ease;
}

.bill-tx-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-jelly-md) !important;
}

.bill-tx-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.bill-tx-cat {
  font-size: 13px;
  font-weight: 800;
}

.bill-tx-note {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.installment-tag {
  font-size: 9px !important;
  padding: 1px 6px !important;
  background-color: var(--color-expense) !important;
  margin-top: 4px;
  width: fit-content;
}

.bill-tx-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bill-tx-amount-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.bill-tx-amount {
  font-size: 14px;
  font-weight: 800;
  color: #FF5A5A;
}

.bill-tx-date {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.btn-edit-tx {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: var(--border-width) solid var(--color-border);
  background-color: var(--color-bg-warm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-dark);
  box-shadow: var(--shadow-jelly-sm);
  cursor: pointer;
  flex-shrink: 0;
}

.btn-edit-tx:hover {
  background-color: var(--color-primary);
}

/* 編輯明細彈窗專用樣式 */
.modal-header-with-close {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.btn-close-modal {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-dark);
  box-shadow: var(--shadow-jelly-sm);
}

.btn-close-modal:hover {
  background: var(--color-primary);
}

.installment-notice {
  background-color: #FFF3CD;
  border: 1.5px solid #FFEEBA;
  border-radius: var(--border-radius-sm);
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 700;
  color: #856404;
  margin-bottom: 12px;
  line-height: 1.4;
}

.cat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px;
}

.chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--border-radius-sm);
  background: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.chip-btn.active {
  background: var(--color-primary);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.12);
}

.inline-check {
  margin-left: 2px;
  color: var(--color-text-dark);
}

.modal-actions-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  gap: 8px;
}

.modal-actions-between .right-buttons {
  display: flex;
  gap: 8px;
}

.btn-delete-tx {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background-color: #FFEAE8;
  color: #D9383A;
  border: var(--border-width) solid #FFCCD2;
  border-radius: var(--border-radius-md);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
}

.btn-delete-tx:hover {
  background-color: #FFD4D0;
}

.bill-tx-date {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* 配色與背景 */
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

.cat-pop-emoji {
  font-size: 24px;
}

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
</style>
