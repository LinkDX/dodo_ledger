<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Check, ChevronDown, Trash2 } from 'lucide-vue-next'
import { useLedger } from '../composables/useLedger'
import { useConfirm } from '../composables/useConfirm'
import DatePicker from './DatePicker.vue'
import type { Transaction } from '../types'

const props = defineProps<{
  modelValue: boolean
  transaction: Transaction | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved', tx: Transaction): void
  (e: 'deleted', txId: string): void
}>()

const {
  visibleAccounts,
  categories: allCategories,
  editTransaction,
  deleteTransaction
} = useLedger()

const { showConfirm } = useConfirm()

const editAmount = ref<number | ''>(0)
const editNote = ref('')
const editDateStr = ref('')
const editCategory = ref('')
const editSubCategory = ref('')
const editFromAccountId = ref('')
const editToAccountId = ref('')
const editType = ref<'expense' | 'income' | 'transfer'>('expense')

// 下拉選單開關
const editFromAccountOpen = ref(false)
const editToAccountOpen = ref(false)

const expenseAccounts = computed(() => visibleAccounts.value)
const incomeAccounts = computed(() => visibleAccounts.value.filter(a => a.type !== 'credit_card'))

const selectedFromAccount = computed(() =>
  expenseAccounts.value.find(a => a.id === editFromAccountId.value)
)

const selectedToAccount = computed(() =>
  incomeAccounts.value.find(a => a.id === editToAccountId.value)
)

const categoryOptions = computed(() =>
  allCategories.value.filter(c => c.type === editType.value)
)

const subCategoryOptions = computed(() => {
  const cat = allCategories.value.find(c => c.name === editCategory.value && c.type === editType.value)
  return cat?.subCategories || []
})

watch(() => props.transaction, (tx) => {
  if (tx) {
    editAmount.value = tx.amount
    editNote.value = tx.note || ''
    editDateStr.value = new Date(tx.date).toISOString().split('T')[0]
    editCategory.value = tx.category
    editSubCategory.value = tx.subCategory || ''
    editFromAccountId.value = tx.fromAccountId || ''
    editToAccountId.value = tx.toAccountId || ''
    editType.value = tx.type
  }
}, { immediate: true })

const close = () => {
  emit('update:modelValue', false)
  editFromAccountOpen.value = false
  editToAccountOpen.value = false
}

const handleSave = async () => {
  if (!props.transaction) return
  const amt = Number(editAmount.value)
  if (isNaN(amt) || amt <= 0) return

  await editTransaction(props.transaction.id, {
    amount: amt,
    note: editNote.value.trim(),
    date: new Date(editDateStr.value).getTime(),
    category: editCategory.value,
    subCategory: editSubCategory.value || undefined,
    fromAccountId: editFromAccountId.value || undefined,
    toAccountId: editToAccountId.value || undefined
  })

  emit('saved', {
    ...props.transaction,
    amount: amt,
    note: editNote.value.trim(),
    date: new Date(editDateStr.value).getTime(),
    category: editCategory.value,
    subCategory: editSubCategory.value || undefined,
    fromAccountId: editFromAccountId.value || undefined,
    toAccountId: editToAccountId.value || undefined
  })

  close()
}

const handleDelete = async () => {
  if (!props.transaction) return
  const tx = props.transaction
  const confirmed = await showConfirm(
    `確定要刪除這筆「${tx.category}${tx.note ? ' - ' + tx.note : ''}」$${tx.amount} 的記帳明細嗎？此操作無法復原！`,
    '🗑️ 確定刪除此筆明細？'
  )
  if (!confirmed) return

  await deleteTransaction(tx.id)
  emit('deleted', tx.id)
  close()
}
</script>

<template>
  <Teleport to="#app">
    <Transition name="fade">
      <div v-if="modelValue" class="modal-overlay" @click="close">
        <div class="modal-card card-jelly pop-jelly" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">✏️ 編輯記帳明細</h3>
            <button class="btn-jelly btn-close-modal" @click="close" type="button">
              <X :size="16" />
            </button>
          </div>

          <!-- 分期交易提示 -->
          <div v-if="transaction?.creditCardDetails?.isInstallment" class="installment-notice card-jelly">
            <span>💡 此筆為分期消費（第 {{ transaction.creditCardDetails.currentInstallment }}/{{ transaction.creditCardDetails.installmentTerm }} 期），修改金額將更新本期分攤金額。</span>
          </div>

          <!-- 金額 -->
          <div class="form-group">
            <label class="label-cute">金額</label>
            <input v-model.number="editAmount" type="number" min="0" class="input-jelly" placeholder="0" />
          </div>

          <!-- 備註 -->
          <div class="form-group">
            <label class="label-cute">備註說明</label>
            <input v-model="editNote" type="text" class="input-jelly" maxlength="40" placeholder="例如：生活日用品" />
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

          <!-- 支付帳戶 (支出或轉帳) -->
          <div v-if="editType === 'expense' || editType === 'transfer'" class="form-group" style="position: relative;">
            <label class="label-cute">支付帳戶</label>
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

            <!-- 全螢幕遮罩 -->
            <div 
              v-if="editFromAccountOpen" 
              class="select-dropdown-overlay" 
              @click="editFromAccountOpen = false"
            ></div>

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

          <!-- 存入帳戶 (收入或轉帳) -->
          <div v-if="editType === 'income' || editType === 'transfer'" class="form-group" style="position: relative;">
            <label class="label-cute">存入帳戶</label>
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

          <!-- 底部操作按鈕 -->
          <div class="modal-actions-between">
            <button
              class="btn-jelly btn-delete-tx"
              @click="handleDelete"
              type="button"
            >
              <Trash2 :size="14" /> 刪除此筆
            </button>
            <div class="right-buttons">
              <button class="btn-jelly btn-secondary" @click="close" type="button">取消 🐾</button>
              <button
                class="btn-jelly btn-primary"
                :disabled="!editAmount || Number(editAmount) <= 0"
                @click="handleSave"
                type="button"
              >
                儲存修改
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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
  max-width: 420px;
  background: #FFFFFF;
  padding: 24px;
  box-sizing: border-box;
  text-align: left;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-jelly-lg);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: 900;
  margin: 0;
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
}

.form-group {
  margin-bottom: 14px;
}

.label-cute {
  display: block;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.input-jelly {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: 14px;
  font-weight: 700;
  background: var(--color-bg-warm);
  outline: none;
}

.installment-notice {
  background-color: #FFF3CD;
  border: 1.5px solid #FFEEBA;
  border-radius: var(--border-radius-sm);
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 700;
  color: #856404;
  margin-bottom: 14px;
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
  transition: all 0.15s ease;
}

.chip-btn.active {
  background: var(--color-primary);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.12);
}

.inline-check {
  margin-left: 2px;
}

/* 自訂果凍下拉選單 */
.select-cute-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-jelly-sm);
  cursor: pointer;
  box-sizing: border-box;
}

.select-btn-val {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-dark);
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
}

.select-dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 210;
}

.select-dropdown-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-jelly-lg);
  padding: 6px;
  max-height: 180px;
  overflow-y: auto;
  z-index: 220;
}

.select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--border-radius-sm);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.select-option:hover {
  background-color: var(--color-bg-warm);
}

.select-option.selected {
  background-color: var(--color-primary-light, #FFF3CD);
}

.modal-actions-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  gap: 8px;
}

.right-buttons {
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

.btn-secondary {
  padding: 8px 14px;
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
}

.btn-primary {
  padding: 8px 18px;
  background-color: var(--color-primary);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
