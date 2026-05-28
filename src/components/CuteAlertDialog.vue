<script setup lang="ts">
import { useAlert } from '../composables/useAlert'
import { Sparkles } from 'lucide-vue-next'

const { state, handleAlert } = useAlert()
</script>

<template>
  <Transition name="fade-alert">
    <div v-if="state.isOpen" class="alert-overlay" @click="handleAlert">
      <div class="alert-card card-jelly" @click.stop>
        <div class="alert-header">
          <Sparkles class="alert-icon" :size="36" />
          <h3 class="alert-title">{{ state.title }}</h3>
        </div>
        <p class="alert-message">{{ state.message }}</p>
        <div class="alert-actions">
          <button 
            class="btn-jelly btn-ok" 
            @click="handleAlert" 
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
.alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999; /* 比 confirm 更置頂，確保絕對覆蓋 */
  background-color: rgba(44, 30, 27, 0.45); /* 巧克力灰半透明遮罩 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(3px); /* 朦朧毛玻璃效果 */
}

.alert-card {
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

.alert-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.alert-icon {
  color: var(--color-accent-gold);
  filter: drop-shadow(1px 1px 0px var(--color-border));
  animation: floatIcon 2.2s ease-in-out infinite;
}

@keyframes floatIcon {
  0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
  50% { transform: translateY(-5px) scale(1.05) rotate(6deg); }
}

.alert-title {
  font-size: 16px;
  font-weight: 900;
  color: var(--color-text-dark);
}

.alert-message {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.5;
  white-space: pre-line; /* 支援 \n 換行 */
}

.alert-actions {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 4px;
}

.btn-ok {
  width: 100%;
  max-width: 160px;
  padding: 8px 12px !important;
  font-size: 13px !important;
  font-weight: 800;
  background-color: var(--color-accent-gold) !important; /* 卡士達金，溫暖親切 */
  border-width: 2.5px !important;
  margin-bottom: 0 !important;
}

.btn-ok:active {
  transform: scale(0.92);
  transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Vue Transition 動畫 */
.fade-alert-enter-active,
.fade-alert-leave-active {
  transition: opacity 0.2s ease;
}

.fade-alert-enter-active .alert-card {
  animation: popJellyAlert 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.fade-alert-leave-active .alert-card {
  transition: transform 0.15s ease;
  transform: scale(0.9);
}

.fade-alert-enter-from,
.fade-alert-leave-to {
  opacity: 0;
}

@keyframes popJellyAlert {
  0% { transform: scale(0.75); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
