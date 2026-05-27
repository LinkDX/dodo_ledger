<script setup lang="ts">
import { Wallet, Landmark, CreditCard, Compass, Check } from 'lucide-vue-next'
import type { Account } from '../types'

const props = defineProps<{
  modelValue: string    // account id
  accounts: Account[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const select = (id: string) => emit('update:modelValue', id)

const formatBalance = (val: number) =>
  new Intl.NumberFormat('zh-TW').format(Math.abs(val))

const typeLabel = (t: Account['type']) => {
  if (t === 'cash') return '現金'
  if (t === 'bank') return '銀行'
  if (t === 'credit_card') return '信用卡'
  return '電子票證'
}

const balanceLabel = (acct: Account) => {
  if (acct.type === 'credit_card') {
    const avail = Math.max((acct.cardDetails?.creditLimit || 0) - Math.abs(acct.balance), 0)
    return `可用 $${formatBalance(avail)}`
  }
  return `$${formatBalance(acct.balance)}`
}
</script>

<template>
  <div class="account-picker">
    <div class="picker-scroll">
      <button
        v-for="acct in accounts"
        :key="acct.id"
        class="btn-jelly acct-card"
        :class="[acct.color, { 'is-selected': modelValue === acct.id }]"
        @click="select(acct.id)"
      >
        <!-- 帳戶 Avatar -->
        <div class="acct-avatar">
          <span v-if="acct.avatar" class="avatar-emoji">{{ acct.avatar }}</span>
          <template v-else>
            <Wallet v-if="acct.type === 'cash'" :size="18" />
            <Landmark v-else-if="acct.type === 'bank'" :size="18" />
            <CreditCard v-else-if="acct.type === 'credit_card'" :size="18" />
            <Compass v-else :size="18" />
          </template>
        </div>

        <!-- 帳戶資訊 -->
        <div class="acct-info">
          <span class="acct-name">{{ acct.name }}</span>
          <span class="acct-type">{{ typeLabel(acct.type) }}</span>
          <span class="acct-balance">{{ balanceLabel(acct) }}</span>
        </div>

        <!-- 選中勾勾 -->
        <div v-if="modelValue === acct.id" class="selected-check">
          <Check :size="12" stroke-width="4" />
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.account-picker {
  width: 100%;
}

.picker-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 6px 4px 6px 4px; /* 增加邊距以容納 hover/選取浮起效果，防止邊緣被切 */
}

.picker-scroll::-webkit-scrollbar {
  height: 4px;
}
.picker-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

.acct-card {
  flex-shrink: 0;
  min-width: 100px;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px !important;
  border-radius: var(--border-radius-md) !important;
  background-color: var(--color-bg-warm) !important;
  position: relative;
  align-items: center;
  text-align: center;
  border-width: 2px;
}

.acct-card.is-selected {
  border-width: 3px;
  box-shadow: var(--shadow-jelly) !important;
}

/* 馬卡龍卡片配色類別 (對應 AccountManager 的 cardColors) */
.acct-card.card-gold   { background-color: #FFDAC1 !important; }
.acct-card.card-pink   { background-color: #FFB4B4 !important; }
.acct-card.card-blue   { background-color: #A9C9FF !important; }
.acct-card.card-purple { background-color: #E2C6FF !important; }
.acct-card.card-mint   { background-color: #C7F2E6 !important; }
.acct-card.card-peach  { background-color: #FFCBA4 !important; }
.acct-card.card-lemon  { background-color: #FFF3B0 !important; }
.acct-card.card-rose   { background-color: #FFADC7 !important; }
.acct-card.card-sky    { background-color: #C1E1FF !important; }
.acct-card.card-lilac  { background-color: #D4BAFF !important; }
.acct-card.card-sage   { background-color: #D6EAC0 !important; }
.acct-card.card-cocoa  { background-color: #E8D5C4 !important; }
.acct-card.card-coral  { background-color: #FFBBA8 !important; }

.acct-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.65);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-emoji {
  font-size: 18px;
  line-height: 1;
}

.acct-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.acct-name {
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 84px;
}

.acct-type {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.acct-balance {
  font-size: 10px;
  font-weight: 800;
}

.selected-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--color-income);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
