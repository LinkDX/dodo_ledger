<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppLock } from '../composables/useAppLock'
import DodoCat, { type CatMood } from './DodoCat.vue'
import { Lock, Unlock, Delete, CornerDownLeft } from 'lucide-vue-next'

const { verifyPassword, isGlobalLockEnabled } = useAppLock()

// 輸入的密碼值
const passwordInput = ref('')
const isVerifying = ref(false)
const isError = ref(false)
const errorCount = ref(0)

// 貓咪當前的表情狀態與話語
const catMood = ref<CatMood>('sleeping')
const catSpeech = ref('')

// 動態對話內容
const updateCatResponse = () => {
  if (isError.value) {
    if (errorCount.value >= 5) {
      catMood.value = 'crying'
      catSpeech.value = '嗚喵…已經錯了這麼多次，難道你不是逗逗貓的主人嗎？( 😭 )'
    } else {
      catMood.value = 'scared'
      catSpeech.value = '喵嗚！不對不對！這不是正確的解鎖金鑰！( >﹏< )'
    }
  } else if (passwordInput.value.length > 0) {
    catMood.value = 'happy'
    catSpeech.value = '按鍵點得真好！看起來快要解開了，繼續加油～'
  } else {
    catMood.value = 'sleeping'
    if (isGlobalLockEnabled.value) {
      catSpeech.value = '哈啊～此網站已啟用「全域密鑰保護」，請輸入正確密碼以進入記帳閣喔～'
    } else {
      catSpeech.value = '呼喵～金庫已被主人上鎖了！請輸入密碼以解鎖您的專屬帳本～'
    }
  }
}

// 初始化話語
updateCatResponse()

// 密碼圓點狀態
const maxDots = computed(() => {
  // 本地密碼通常是 4 或 6 位，全域則無上限，我們畫面上最多顯示 6 個點
  return Math.max(6, passwordInput.value.length)
})

// 處理鍵盤按鈕點擊
const handleKeyClick = (num: string) => {
  if (isVerifying.value || isError.value) return
  
  // 限制長度上限 20，防範暴打
  if (passwordInput.value.length < 20) {
    passwordInput.value += num
    updateCatResponse()
  }
}

// 刪除最後一位
const handleBackspace = () => {
  if (isVerifying.value || isError.value) return
  if (passwordInput.value.length > 0) {
    passwordInput.value = passwordInput.value.slice(0, -1)
    updateCatResponse()
  }
}

// 清除所有輸入
const handleClear = () => {
  if (isVerifying.value || isError.value) return
  passwordInput.value = ''
  updateCatResponse()
}

// 提交驗證
const handleSubmit = async () => {
  if (isVerifying.value || isError.value || !passwordInput.value) return
  
  isVerifying.value = true
  catMood.value = 'nervous'
  catSpeech.value = '正在核對金鑰雜湊中，請稍候喵…'
  
  // 稍微延遲 300 毫秒，給貓咪表情運作和計算一個喘息空間，更顯實感
  setTimeout(async () => {
    const success = await verifyPassword(passwordInput.value)
    isVerifying.value = false
    
    if (success) {
      catMood.value = 'happy'
      catSpeech.value = '喵嗚！密碼完全吻合！歡迎回到 Dodo Ledger 記帳閣！🎉'
    } else {
      isError.value = true
      errorCount.value++
      updateCatResponse()
      
      // 800 毫秒後清除震動狀態與密碼，讓使用者重打
      setTimeout(() => {
        isError.value = false
        passwordInput.value = ''
        updateCatResponse()
      }, 850)
    }
  }, 400)
}

// 實體鍵盤輸入監聽
const handleKeyDown = (e: KeyboardEvent) => {
  if (isVerifying.value || isError.value) return
  
  if (e.key >= '0' && e.key <= '9') {
    handleKeyClick(e.key)
  } else if (e.key === 'Backspace') {
    handleBackspace()
  } else if (e.key === 'Enter') {
    handleSubmit()
  } else if (e.key === 'Escape') {
    handleClear()
  } else if (isGlobalLockEnabled.value && e.key.length === 1 && /^[a-zA-Z!@#$%^&*]$/.test(e.key)) {
    // 若為全域鎖定，因可能有英數密碼，故額外允許英文與一般字元輸入
    handleKeyClick(e.key)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="lock-screen-container" :class="{ 'shake-active': isError }">
    <div class="lock-card pop-jelly">
      <!-- 鎖頭 Icon 與安全提示 -->
      <div class="lock-header">
        <div class="lock-badge" :class="{ 'global-badge': isGlobalLockEnabled }">
          <Lock v-if="!isVerifying" :size="20" class="icon-lock" />
          <Unlock v-else :size="20" class="icon-unlock" />
          <span>{{ isGlobalLockEnabled ? '全域安全防護' : '本地金庫上鎖' }}</span>
        </div>
      </div>

      <!-- 逗逗貓吉祥物 -->
      <div class="cat-lock-area">
        <DodoCat :mood="catMood" :speech="catSpeech" />
      </div>

      <!-- 密碼輸入圓點指示燈 -->
      <div class="dots-container" :class="{ 'dots-error': isError }">
        <span 
          v-for="idx in maxDots" 
          :key="idx" 
          class="dot-indicator" 
          :class="{ 
            'filled': passwordInput.length >= idx,
            'extra-filled': passwordInput.length > 6 && idx === maxDots
          }"
        ></span>
      </div>

      <!-- 密碼明文遮罩提示 (針對全域英數鎖) -->
      <div v-if="isGlobalLockEnabled && passwordInput.length > 0" class="text-length-hint">
        已輸入 {{ passwordInput.length }} 個字元
      </div>

      <!-- 果凍數字鍵盤 -->
      <div class="numpad-grid">
        <button 
          v-for="n in 9" 
          :key="n" 
          class="numpad-btn btn-jelly"
          @click="handleKeyClick(n.toString())"
          :disabled="isVerifying"
        >
          {{ n }}
        </button>

        <!-- 退格鍵 -->
        <button 
          class="numpad-btn btn-jelly btn-control"
          @click="handleBackspace"
          :disabled="isVerifying || passwordInput.length === 0"
          title="刪除"
        >
          <Delete :size="20" />
        </button>

        <!-- 數字 0 -->
        <button 
          class="numpad-btn btn-jelly"
          @click="handleKeyClick('0')"
          :disabled="isVerifying"
        >
          0
        </button>

        <!-- 確認解鎖鍵 -->
        <button 
          class="numpad-btn btn-jelly btn-submit"
          @click="handleSubmit"
          :disabled="isVerifying || passwordInput.length === 0"
          title="確認解鎖"
        >
          <CornerDownLeft :size="22" />
        </button>
      </div>

      <div class="lock-footer">
        <p v-if="isGlobalLockEnabled" class="footer-tip">
          💻 您也可以直接使用「實體電腦鍵盤」輸入英數密碼並按 Enter 送出。
        </p>
        <p v-else class="footer-tip">
          💡 請輸入您在設定中自訂的數字密碼以開啟主畫面。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lock-screen-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  background-color: var(--color-bg-warm);
  padding: 20px;
  box-sizing: border-box;
}

.lock-card {
  width: 100%;
  max-width: 420px;
  background-color: var(--color-card-bg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-large);
  padding: 30px 24px;
  box-shadow: var(--shadow-jelly-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lock-header {
  margin-bottom: 8px;
}

.lock-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #FFF0E0;
  border: 2px solid var(--color-border);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 800;
  color: #B45B3E;
}

.lock-badge.global-badge {
  background-color: #E6F4FE;
  color: #2F6B9E;
  border-color: var(--color-border);
}

.cat-lock-area {
  width: 100%;
  margin-bottom: 24px;
  margin-top: 140px; /* 保留對話泡泡渲染所需空間，防溢出 */
  display: flex;
  justify-content: center;
}

/* 密碼指示燈圓點 */
.dots-container {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  justify-content: center;
  align-items: center;
  height: 24px;
}

.dot-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #E2DDD5;
  border: 2px solid var(--color-border);
  transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dot-indicator.filled {
  background-color: var(--color-accent-gold);
  transform: scale(1.15);
}

.dot-indicator.extra-filled {
  background-color: var(--color-expense); /* 當全域輸入超過6個字時，最後一個點變粉色警示 */
}

.dots-error .dot-indicator.filled {
  background-color: var(--color-expense) !important;
}

.text-length-hint {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

/* 果凍數字鍵盤配置 */
.numpad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 320px;
  margin-bottom: 20px;
}

.numpad-btn {
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-medium);
  height: 58px;
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text-dark);
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.numpad-btn:active {
  transform: scale(0.92);
  background-color: var(--color-bg-warm);
}

.numpad-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.numpad-btn.btn-control {
  background-color: #FFF0ED;
  color: #B4463E;
}

.numpad-btn.btn-submit {
  background-color: #EEF8F3;
  color: #2F8A5D;
}

.numpad-btn.btn-submit:active {
  background-color: var(--color-income);
}

.lock-footer {
  text-align: center;
  max-width: 320px;
}

.footer-tip {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

/* Shake 錯誤抖動動畫類別 */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%, 45%, 75% { transform: translateX(-8px); }
  30%, 60%, 90% { transform: translateX(8px); }
}

.shake-active {
  animation: shake 0.45s ease-in-out;
}
</style>
