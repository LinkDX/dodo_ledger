<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Wallet, Landmark, CreditCard, Compass, Check, ChevronDown } from 'lucide-vue-next'
import type { Account } from '../types'

const props = defineProps<{
  modelValue: string    // account id
  accounts: Account[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const selectedAccount = computed(() => {
  return props.accounts.find(a => a.id === props.modelValue)
})

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (id: string) => {
  emit('update:modelValue', id)
  isOpen.value = false
}

const formatBalance = (val: number) =>
  new Intl.NumberFormat('zh-TW').format(Math.abs(val))

const getBalanceText = (acct: Account) => {
  if (acct.type === 'credit_card') {
    const avail = Math.max((acct.cardDetails?.creditLimit || 0) - Math.abs(acct.balance), 0)
    return `可用 $${formatBalance(avail)}`
  }
  return `$${formatBalance(acct.balance)}`
}

// 點擊外部關閉
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<template>
  <div class="account-dropdown-container" ref="dropdownRef">
    <!-- 觸發按鈕 -->
    <button 
      class="dropdown-trigger" 
      :class="{ 'has-value': !!selectedAccount }"
      @click="toggle" 
      type="button"
    >
      <div class="trigger-left">
        <!-- 帳戶 Avatar -->
        <div 
          class="acct-avatar" 
          :class="selectedAccount?.color || 'card-default'"
        >
          <span v-if="selectedAccount?.avatar" class="avatar-emoji">{{ selectedAccount.avatar }}</span>
          <template v-else-if="selectedAccount">
            <Wallet v-if="selectedAccount.type === 'cash'" :size="14" />
            <Landmark v-else-if="selectedAccount.type === 'bank'" :size="14" />
            <CreditCard v-else-if="selectedAccount.type === 'credit_card'" :size="14" />
            <Compass v-else :size="14" />
          </template>
          <template v-else>
            <Compass :size="14" class="default-icon" />
          </template>
        </div>

        <!-- 帳戶文字資訊 -->
        <div class="acct-text-info">
          <span class="acct-name">
            {{ selectedAccount ? selectedAccount.name : (placeholder || '請選擇帳戶...') }}
          </span>
          <span v-if="selectedAccount" class="acct-balance">
            {{ getBalanceText(selectedAccount) }}
          </span>
        </div>
      </div>
      <ChevronDown :size="16" class="arrow-icon" :class="{ 'arrow-up': isOpen }" />
    </button>

    <!-- 下拉面板 -->
    <transition name="fade">
      <div v-if="isOpen" class="dropdown-panel card-jelly">
        <div class="options-container">
          <button
            v-for="a in accounts"
            :key="a.id"
            class="dropdown-option btn-jelly"
            :class="[a.color, { 'is-active': modelValue === a.id }]"
            @click="select(a.id)"
            type="button"
          >
            <div class="option-left">
              <div class="acct-avatar-inner">
                <span v-if="a.avatar" class="avatar-emoji">{{ a.avatar }}</span>
                <template v-else>
                  <Wallet v-if="a.type === 'cash'" :size="12" />
                  <Landmark v-else-if="a.type === 'bank'" :size="12" />
                  <CreditCard v-else-if="a.type === 'credit_card'" :size="12" />
                  <Compass v-else :size="12" />
                </template>
              </div>
              <div class="option-text-info">
                <span class="option-name">{{ a.name }}</span>
                <span class="option-balance">{{ getBalanceText(a) }}</span>
              </div>
            </div>
            <!-- 選中勾勾 -->
            <div v-if="modelValue === a.id" class="selected-check">
              <Check :size="8" stroke-width="4" stroke="#FFF" />
            </div>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.account-dropdown-container {
  position: relative;
  display: block;
  width: 100%;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-jelly-sm);
  cursor: pointer;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  min-height: 48px;
  box-sizing: border-box;
}

.dropdown-trigger:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-jelly-active);
}

.trigger-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.acct-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-jelly-sm);
}

.card-default {
  background-color: var(--color-bg-warm);
}

.default-icon {
  color: var(--color-text-muted);
}

.avatar-emoji {
  font-size: 13px;
  line-height: 1;
}

.acct-text-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0; /* 極為關鍵！能讓 Flex 內部的 text-overflow 生效 */
  flex: 1;
}

.acct-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.acct-balance {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  line-height: 1.2;
}

.arrow-icon {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  margin-left: 8px;
}

.arrow-up {
  transform: rotate(180deg);
}

/* 下拉面板 */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 250; /* 確保在 modal-card 內部能蓋在其他內容之上 */
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-jelly);
  padding: 8px;
  max-height: 220px;
  overflow-y: auto;
  box-sizing: border-box;
}

/* 自訂捲軸樣式，與系統一致 */
.dropdown-panel::-webkit-scrollbar {
  width: 6px;
}
.dropdown-panel::-webkit-scrollbar-track {
  background: transparent;
}
.dropdown-panel::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 3px;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dropdown-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px !important;
  border-radius: var(--border-radius-md) !important;
  background-color: var(--color-bg-warm) !important;
  border-width: 2.5px;
  cursor: pointer;
  position: relative;
  text-align: left;
  box-sizing: border-box;
}

.dropdown-option.is-active {
  border-width: 2.5px;
  border-color: var(--color-text-dark) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.option-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.acct-avatar-inner {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.7);
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.option-text-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.option-name {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-balance {
  font-size: 9px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.selected-check {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--color-income);
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 馬卡龍卡片配色類別 */
.dropdown-option.card-gold   { background-color: #FFDAC1 !important; }
.dropdown-option.card-pink   { background-color: #FFB4B4 !important; }
.dropdown-option.card-blue   { background-color: #A9C9FF !important; }
.dropdown-option.card-purple { background-color: #E2C6FF !important; }
.dropdown-option.card-mint   { background-color: #C7F2E6 !important; }
.dropdown-option.card-peach  { background-color: #FFCBA4 !important; }
.dropdown-option.card-lemon  { background-color: #FFF3B0 !important; }
.dropdown-option.card-rose   { background-color: #FFADC7 !important; }
.dropdown-option.card-sky    { background-color: #C1E1FF !important; }
.dropdown-option.card-lilac  { background-color: #D4BAFF !important; }
.dropdown-option.card-sage   { background-color: #D6EAC0 !important; }
.dropdown-option.card-cocoa  { background-color: #E8D5C4 !important; }
.dropdown-option.card-coral  { background-color: #FFBBA8 !important; }

/* 頭像背景同步馬卡龍色 */
.acct-avatar.card-gold   { background-color: #FFDAC1 !important; }
.acct-avatar.card-pink   { background-color: #FFB4B4 !important; }
.acct-avatar.card-blue   { background-color: #A9C9FF !important; }
.acct-avatar.card-purple { background-color: #E2C6FF !important; }
.acct-avatar.card-mint   { background-color: #C7F2E6 !important; }
.acct-avatar.card-peach  { background-color: #FFCBA4 !important; }
.acct-avatar.card-lemon  { background-color: #FFF3B0 !important; }
.acct-avatar.card-rose   { background-color: #FFADC7 !important; }
.acct-avatar.card-sky    { background-color: #C1E1FF !important; }
.acct-avatar.card-lilac  { background-color: #D4BAFF !important; }
.acct-avatar.card-sage   { background-color: #D6EAC0 !important; }
.acct-avatar.card-cocoa  { background-color: #E8D5C4 !important; }
.acct-avatar.card-coral  { background-color: #FFBBA8 !important; }

/* 動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
