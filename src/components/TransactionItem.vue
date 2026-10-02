<script setup lang="ts">
import { ArrowLeftRight, Pencil, Trash2 } from 'lucide-vue-next'
import { useLedger } from '../composables/useLedger'
import type { Transaction } from '../types'

const props = withDefaults(defineProps<{
  transaction: Transaction
  showDate?: boolean
  showActions?: boolean
  borderless?: boolean
}>(), {
  showDate: false,
  showActions: true,
  borderless: false
})

const emit = defineEmits<{
  (e: 'edit', tx: Transaction): void
  (e: 'delete', txId: string): void
  (e: 'click', tx: Transaction): void
}>()

const { accounts, isTransactionPaid } = useLedger()

const getAccountName = (id?: string) => {
  if (!id) return ''
  return accounts.value.find(a => a.id === id)?.name || ''
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('zh-TW').format(Math.abs(val))

const getTxStyle = (tx: Transaction) => {
  if (tx.type === 'expense') return { color: 'var(--color-expense-text, #FF5A5A)', prefix: '-', bg: '#FFDADA', icon: '💸' }
  if (tx.type === 'income')  return { color: 'var(--color-income-text, #2C8C67)',  prefix: '+', bg: '#E1F8EB', icon: '💰' }
  return { color: '#4A7FE0', prefix: '', bg: '#E3EFFF', icon: '🔄' }
}
</script>

<template>
  <div 
    class="tx-item"
    :class="{ 'card-jelly': !borderless, 'tx-borderless': borderless }"
    @click="emit('click', transaction)"
  >
    <!-- 左側：icon + 分類資訊 -->
    <div class="tx-left">
      <!-- 左側 Avatar 與記帳人垂直頭像區 -->
      <div class="tx-avatar-area">
        <div class="tx-icon-circle" :style="{ backgroundColor: getTxStyle(transaction).bg }">
          <ArrowLeftRight v-if="transaction.type === 'transfer'" :size="18" :stroke="'#4A7FE0'" />
          <span v-else class="tx-emoji">{{ getTxStyle(transaction).icon }}</span>
        </div>
        <span 
          v-if="transaction.createdBy" 
          class="creator-tag-micro" 
          :title="transaction.createdBy"
        >
          {{ transaction.createdByAvatar }}{{ transaction.createdBy }}
        </span>
      </div>

      <div class="tx-info">
        <div class="tx-category-row">
          <span class="tx-category">
            {{ transaction.category }}{{ transaction.subCategory ? ` ➜ ${transaction.subCategory}` : '' }}
          </span>
          <span v-if="isTransactionPaid(transaction)" class="tag-jelly paid-tag">
            ✓ 已繳清
          </span>
          <span v-if="transaction.creditCardDetails?.isInstallment" class="tag-jelly installment-tag">
            分期 {{ transaction.creditCardDetails.currentInstallment }}/{{ transaction.creditCardDetails.installmentTerm }} 期
          </span>
        </div>
        <span class="tx-note">{{ transaction.note || '無備註' }}</span>
        
        <!-- 帳戶資訊 -->
        <div class="tx-details-row">
          <template v-if="transaction.type === 'transfer'">
            <div class="tx-account-info transfer-line">
              <span class="transfer-label transfer-from">從</span>
              <span class="acct-name-pill">{{ getAccountName(transaction.fromAccountId) }}</span>
            </div>
            <div class="tx-account-info transfer-line">
              <span class="transfer-label transfer-to">到</span>
              <span class="acct-name-pill">{{ getAccountName(transaction.toAccountId) }}</span>
            </div>
          </template>
          <template v-else>
            <span class="tx-account-info">
              <span class="acct-name-pill">{{ getAccountName(transaction.fromAccountId || transaction.toAccountId) }}</span>
            </span>
          </template>
        </div>
      </div>
    </div>

    <!-- 右側：金額 + 日期 + 操作 -->
    <div class="tx-right">
      <span class="tx-amount" :style="{ color: getTxStyle(transaction).color }">
        {{ getTxStyle(transaction).prefix }}${{ formatCurrency(transaction.amount) }}
      </span>
      <span v-if="showDate" class="tx-date">
        {{ new Date(transaction.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) }}
      </span>
      <div v-if="showActions" class="tx-actions">
        <button class="btn-edit btn-jelly" @click.stop="emit('edit', transaction)" title="編輯此筆" type="button">
          <Pencil :size="13" :stroke-width="2.5" />
        </button>
        <button class="btn-delete btn-jelly" @click.stop="emit('delete', transaction.id)" title="刪除此筆" type="button">
          <Trash2 :size="13" :stroke-width="2.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tx-item {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px !important;
  margin-bottom: 0 !important;
  background-color: #FFFFFF;
  border-radius: var(--border-radius-md);
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-jelly-sm);
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.15s ease;
  width: 100%;
  box-sizing: border-box;
}

.tx-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-jelly-md);
}

.tx-borderless {
  background-color: transparent !important;
  box-shadow: none !important;
  border: none !important;
  border-radius: 0 !important;
}

.tx-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.tx-avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  width: 44px;
  min-width: 44px;
  max-width: 44px;
}

.tx-icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-jelly-sm);
  margin-bottom: 0;
  flex-shrink: 0;
}

.tx-emoji {
  font-size: 18px;
}

.creator-tag-micro {
  font-size: 8px;
  font-weight: 800;
  color: var(--color-text-dark);
  background-color: var(--color-bg-warm);
  border: 1.2px solid var(--color-border);
  border-radius: 6px;
  padding: 1.5px 3px;
  white-space: nowrap;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
  text-align: center;
  display: block;
}

.tx-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.tx-category-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.tx-category {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-dark);
  line-height: 1.35;
}

.paid-tag {
  background-color: #E1F8EB !important;
  color: #2C8C67 !important;
  font-size: 8px !important;
  padding: 1px 5px !important;
  font-weight: 800;
  border: 1.2px solid #2C8C67 !important;
  border-radius: 8px !important;
  display: inline-flex;
  align-items: center;
}

.installment-tag {
  background-color: #FFF3CD !important;
  color: #856404 !important;
  font-size: 8px !important;
  padding: 1px 5px !important;
  font-weight: 800;
  border: 1.2px solid #FFEEBA !important;
  border-radius: 8px !important;
  display: inline-flex;
  align-items: center;
}

.tx-note {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-details-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
}

.tx-account-info {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  color: var(--color-text-muted);
  background-color: var(--color-bg-warm);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1px 6px;
  max-width: 100%;
}

.transfer-line {
  display: flex;
  align-items: center;
  gap: 4px;
}

.transfer-label {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 800;
}

.transfer-from {
  background-color: #E3EFFF;
  color: #4A7FE0;
}

.transfer-to {
  background-color: #E1F8EB;
  color: #2C8C67;
}

.acct-name-pill {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -0.3px;
}

.tx-date {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.tx-actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.btn-edit {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  background-color: #EEF4FF !important;
  color: #4A7FE0 !important;
  border: 1.5px solid #A9C9FF !important;
  border-radius: 50% !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 1px 1px 0px rgba(44, 30, 27, 0.15);
  flex-shrink: 0;
}

.btn-delete {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  background-color: #FFF0F0 !important;
  color: #FF5A5A !important;
  border: 1.5px solid #FFB4B4 !important;
  border-radius: 50% !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 1px 1px 0px rgba(44, 30, 27, 0.15);
  flex-shrink: 0;
}

.btn-edit :deep(svg),
.btn-delete :deep(svg),
.btn-edit svg,
.btn-delete svg {
  display: block;
  flex-shrink: 0;
  pointer-events: none;
}

.btn-edit:hover {
  background-color: #DDEBFF !important;
}

.btn-delete:hover {
  background-color: #FFE0E0 !important;
}
</style>
