<script setup lang="ts">
import { useConfirm } from '../composables/useConfirm'
import { HelpCircle } from 'lucide-vue-next'

const { state, handleConfirm } = useConfirm()
</script>

<template>
  <Transition name="fade-confirm">
    <div v-if="state.isOpen" class="confirm-overlay" @click="handleConfirm(false)">
      <div class="confirm-card card-jelly" @click.stop>
        <div class="confirm-header">
          <HelpCircle class="confirm-icon" :size="36" />
          <h3 class="confirm-title">{{ state.title }}</h3>
        </div>
        <p class="confirm-message">{{ state.message }}</p>
        <div class="confirm-actions">
          <button 
            class="btn-jelly btn-cancel" 
            @click="handleConfirm(false)" 
            type="button"
          >
            {{ state.cancelText }}
          </button>
          <button 
            class="btn-jelly btn-ok" 
            @click="handleConfirm(true)" 
            type="button"
          >
            {{ state.okText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999; /* 超級置頂，確保蓋住所有彈窗和鍵盤 */
  background-color: rgba(44, 30, 27, 0.4); /* 巧克力灰半透明遮罩 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(3px); /* 朦朧毛玻璃效果 */
}

.confirm-card {
  width: 100%;
  max-width: 320px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-jelly);
  padding: 22px 18px !important;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: center;
  margin-bottom: 0 !important;
}

.confirm-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.confirm-icon {
  color: var(--color-text-muted);
  animation: floatIcon 2s ease-in-out infinite;
}

@keyframes floatIcon {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-4px) rotate(4deg); }
}

.confirm-title {
  font-size: 16px;
  font-weight: 900;
  color: var(--color-text-dark);
}

.confirm-message {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.5;
  white-space: pre-line; /* 支持 \n 換行 */
}

.confirm-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.btn-cancel, .btn-ok {
  flex: 1;
  padding: 8px 12px !important;
  font-size: 13px !important;
  margin-bottom: 0 !important;
}

.btn-cancel {
  background-color: var(--color-bg-warm) !important;
}

.btn-ok {
  background-color: var(--color-expense) !important; /* 支出粉桃紅，亮眼醒目 */
  border-width: 2.5px !important;
}

/* Vue Transition 動畫 */
.fade-confirm-enter-active,
.fade-confirm-leave-active {
  transition: opacity 0.2s ease;
}

.fade-confirm-enter-active .confirm-card {
  animation: popJellyConfirm 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.fade-confirm-leave-active .confirm-card {
  transition: transform 0.15s ease;
  transform: scale(0.9);
}

.fade-confirm-enter-from,
.fade-confirm-leave-to {
  opacity: 0;
}

@keyframes popJellyConfirm {
  0% { transform: scale(0.75); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
