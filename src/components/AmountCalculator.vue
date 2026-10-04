<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Calculator, Delete, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue?: number | string | ''
  inline?: boolean             // 是否常駐內嵌展示 (例如記帳主表單)
  title?: string              // 彈出層標題
  placeholder?: string        // 欄位預設文字
  disabled?: boolean          // 是否停用
  currency?: string          // 幣別代號
  okText?: string             // OK 按鈕文字
  min?: number                // 最小值
  allowEmpty?: boolean        // 是否允許為空值
}>(), {
  modelValue: 0,
  inline: false,
  title: '🧮 金額計算機',
  placeholder: '0',
  disabled: false,
  currency: 'TWD',
  okText: 'OK 🐾',
  min: 0,
  allowEmpty: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: number | ''): void
  (e: 'change', val: number): void
  (e: 'submit', val: number): void
}>()

// 彈出層開關狀態
const isOpen = ref(false)

// 內部算式與數值管理
const displayFormula = ref('0')
const displayResult = ref(0)
const isNewInput = ref(true)

// 將數字加上千分位逗號
const formatCurrency = (val: number | string | ''): string => {
  if (val === '' || val === null || val === undefined) return '0'
  const num = typeof val === 'number' ? val : parseFloat(val)
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(num)
}

// 欄位是否有值
const hasValue = computed(() => {
  return props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined
})

// 輸入框顯示的文字
const formattedInputValue = computed(() => {
  if (!hasValue.value) return ''
  return formatCurrency(props.modelValue)
})

// 看板結果顯示文字
const formattedDisplayResult = computed(() => {
  return formatCurrency(displayResult.value)
})

// 從 props 初始化算式與數值
const syncFromProps = () => {
  if (props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined) {
    const num = typeof props.modelValue === 'number' ? props.modelValue : parseFloat(props.modelValue)
    if (!isNaN(num)) {
      displayFormula.value = String(num)
      displayResult.value = num
      isNewInput.value = true
      return
    }
  }
  displayFormula.value = '0'
  displayResult.value = 0
  isNewInput.value = true
}

// 監聽外部傳入的 modelValue
watch(() => props.modelValue, () => {
  if (!isOpen.value && !props.inline) {
    syncFromProps()
  } else if (props.inline && isNewInput.value) {
    syncFromProps()
  }
}, { immediate: true })

// 開啟計算機彈窗
const openCalculator = () => {
  if (props.disabled) return
  syncFromProps()
  isOpen.value = true
}

// 取消計算並關閉（還原原值，不保存變更）
const cancelCalculator = () => {
  syncFromProps()
  isOpen.value = false
}

// 點擊背景遮罩關閉（與按 X 一致，並阻止事件冒泡，防止底層彈窗被連帶關閉）
const handleBackdropClick = (e?: Event) => {
  if (e) {
    e.stopPropagation()
    e.preventDefault()
  }
  cancelCalculator()
}

// 安全四則運算解析器 (先乘除後加減)
const safeEval = (str: string): number => {
  try {
    const tokens = str.match(/(\d*\.?\d+)|([\+\-\*\/])/g) || []
    if (tokens.length === 0) return 0

    // 乘除法
    const queue: (string | number)[] = []
    let i = 0
    while (i < tokens.length) {
      const token = tokens[i]
      if (token === '*' || token === '/') {
        const prev = parseFloat(queue.pop() as string)
        const next = parseFloat(tokens[i + 1])
        const res = token === '*' ? prev * next : (next !== 0 ? prev / next : 0)
        queue.push(res)
        i += 2
      } else {
        queue.push(token)
        i++
      }
    }

    // 加減法
    let result = typeof queue[0] === 'number' ? queue[0] : parseFloat(queue[0] as string)
    let op = '+'
    for (let j = 1; j < queue.length; j++) {
      const token = queue[j]
      if (token === '+' || token === '-') {
        op = token
      } else {
        const val = typeof token === 'number' ? token : parseFloat(token)
        if (op === '+') result += val
        else result -= val
      }
    }
    return Math.max(result, props.min)
  } catch (e) {
    return 0
  }
}

// 即時計算
const instantCalculate = () => {
  try {
    const sanitized = displayFormula.value.replace(/[^0-9\.\+\-×÷]/g, '')
    if (!sanitized) {
      displayResult.value = 0
      return
    }
    let toEval = sanitized
    if (sanitized.endsWith('+') || sanitized.endsWith('-') || sanitized.endsWith('×') || sanitized.endsWith('÷')) {
      toEval = sanitized.slice(0, -1)
    }
    const formulaToCalc = toEval.replace(/×/g, '*').replace(/÷/g, '/')
    displayResult.value = safeEval(formulaToCalc)
  } catch (e) {
    // 忽略錯誤
  }
}

// 計算最終結果
const calculateResult = () => {
  instantCalculate()
  displayFormula.value = String(displayResult.value)
}

// 處理鍵盤按鍵
const handleKeyPress = (key: string) => {
  if (key === 'C') {
    displayFormula.value = '0'
    displayResult.value = 0
    isNewInput.value = true
    if (props.inline) {
      emit('update:modelValue', 0)
    }
    return
  }

  if (key === '⌫') {
    if (displayFormula.value.length <= 1 || isNewInput.value) {
      displayFormula.value = '0'
      displayResult.value = 0
      isNewInput.value = true
    } else {
      displayFormula.value = displayFormula.value.slice(0, -1)
      instantCalculate()
    }
    if (props.inline) {
      emit('update:modelValue', displayResult.value)
    }
    return
  }

  if (key === 'OK') {
    calculateResult()
    const finalVal = displayResult.value
    emit('update:modelValue', finalVal)
    emit('change', finalVal)
    emit('submit', finalVal)
    if (!props.inline) {
      isOpen.value = false
    }
    return
  }

  // 處理 00 輸入
  if (key === '00') {
    if (isNewInput.value || displayFormula.value === '0') {
      displayFormula.value = '0'
      isNewInput.value = true
    } else {
      displayFormula.value += '00'
      isNewInput.value = false
      instantCalculate()
    }
    if (props.inline) {
      emit('update:modelValue', displayResult.value)
    }
    return
  }

  // 處理運算子 (+, -, ×, ÷)
  if (key === '+' || key === '-' || key === '×' || key === '÷') {
    calculateResult()
    const lastChar = displayFormula.value.slice(-1)
    if (lastChar === '+' || lastChar === '-' || lastChar === '×' || lastChar === '÷') {
      displayFormula.value = displayFormula.value.slice(0, -1) + key
    } else {
      displayFormula.value += key
    }
    isNewInput.value = false
    return
  }

  // 處理小數點
  if (key === '.') {
    const parts = displayFormula.value.split(/[\+\-×÷]/)
    const currentNum = parts[parts.length - 1]
    if (currentNum.includes('.')) return
    displayFormula.value += '.'
    isNewInput.value = false
    return
  }

  // 處理數字輸入
  if (isNewInput.value || displayFormula.value === '0') {
    displayFormula.value = key
    isNewInput.value = false
  } else {
    displayFormula.value += key
  }

  instantCalculate()
  if (props.inline) {
    emit('update:modelValue', displayResult.value)
  }
}

// 重設方法提供給父層
const reset = () => {
  displayFormula.value = '0'
  displayResult.value = 0
  isNewInput.value = true
  emit('update:modelValue', 0)
}

defineExpose({
  reset,
  calculateResult,
  displayResult,
  displayFormula
})
</script>

<template>
  <div class="dodo-amount-calculator" :class="{ 'is-inline': inline }">
    <!-- 模式 1：一般欄位外觀 (inline: false) -->
    <div
      v-if="!inline"
      class="amount-field-trigger btn-jelly"
      :class="{ 'is-disabled': disabled, 'is-active': isOpen }"
      tabindex="0"
      @click="openCalculator"
      @keydown.enter.prevent="openCalculator"
    >
      <div class="field-left-tag">
        <span class="currency-tag">{{ currency }}</span>
        <span class="currency-symbol">$</span>
      </div>

      <div class="field-value-area">
        <span v-if="hasValue && modelValue !== ''" class="amount-number">
          {{ formattedInputValue }}
        </span>
        <span v-else class="amount-placeholder">
          {{ placeholder }}
        </span>
      </div>

      <div class="field-right-icon">
        <span class="calc-icon-bubble" title="開啟計算機">
          <Calculator :size="16" />
        </span>
      </div>
    </div>

    <!-- 模式 1 的彈出式計算機抽屜 (Teleport to #app，確保完全不被父層剪裁) -->
    <Teleport to="#app">
      <Transition name="calc-backdrop-fade">
        <div 
          v-if="!inline && isOpen" 
          class="calc-modal-backdrop" 
          @click.stop="handleBackdropClick"
          @mousedown.stop
          @touchstart.stop
        >
          <Transition name="calc-sheet-slide">
            <div 
              v-if="isOpen" 
              class="calc-modal-sheet card-jelly"
              @click.stop
              @mousedown.stop
              @touchstart.stop
            >
              <!-- 手機頂部小拉桿 -->
              <div class="sheet-pull-handle"></div>

              <!-- 面板頂部標題與關閉按鈕 -->
              <div class="sheet-top-bar">
                <div class="sheet-title">
                  <span class="sheet-cat-emoji">🐾</span>
                  <span>{{ title }}</span>
                </div>
                <button 
                  type="button" 
                  class="btn-jelly btn-close-sheet" 
                  @click.stop="cancelCalculator" 
                  title="取消並關閉"
                >
                  <X :size="16" />
                </button>
              </div>

              <!-- 算式與金額顯示看板 -->
              <div class="calc-display-board">
                <div class="formula-line">
                  <Calculator :size="13" class="icon-calc" /> {{ displayFormula }}
                </div>
                <div class="result-line">
                  <span class="currency-label">{{ currency }}</span> ${{ formattedDisplayResult }}
                </div>
              </div>

              <!-- 5x4 可愛果凍計算機按鍵群 -->
              <div class="calc-keyboard-grid">
                <!-- 第一橫列：全部為運算子 -->
                <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('+')">+</button>
                <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('-')">-</button>
                <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('×')">×</button>
                <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('÷')">÷</button>

                <!-- 第二橫列：7, 8, 9 加上退格 ⌫ -->
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('7')">7</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('8')">8</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('9')">9</button>
                <button type="button" class="btn-jelly key-btn key-backspace" @click="handleKeyPress('⌫')">
                  <Delete :size="18" />
                </button>

                <!-- 第三橫列：4, 5, 6 加上清除 C -->
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('4')">4</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('5')">5</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('6')">6</button>
                <button type="button" class="btn-jelly key-btn key-clear" @click="handleKeyPress('C')">C</button>

                <!-- 第四橫列：1、2、3 以及跨兩列的 OK 🐾 鍵 -->
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('1')">1</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('2')">2</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('3')">3</button>
                <button 
                  type="button"
                  class="btn-jelly key-btn key-confirm" 
                  @click="handleKeyPress('OK')"
                  style="grid-row: span 2; height: auto;"
                >
                  {{ okText }}
                </button>

                <!-- 第五橫列：0、00、. (OK鍵佔了最右邊一格) -->
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('0')">0</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('00')">00</button>
                <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('.')">.</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- 模式 2：常駐內嵌展示 (inline: true) -->
    <div v-if="inline" class="calculator-panel card-jelly">
      <!-- 算式與金額顯示看板 -->
      <div class="calc-display-board">
        <div class="formula-line">
          <Calculator :size="14" class="icon-calc" /> {{ displayFormula }}
        </div>
        <div class="result-line">
          <span class="currency-label">{{ currency }}</span> ${{ formattedDisplayResult }}
        </div>
      </div>

      <!-- 5x4 可愛果凍計算機按鍵群 -->
      <div class="calc-keyboard-grid">
        <!-- 第一橫列：全部為運算子 -->
        <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('+')">+</button>
        <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('-')">-</button>
        <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('×')">×</button>
        <button type="button" class="btn-jelly key-btn key-operator" @click="handleKeyPress('÷')">÷</button>

        <!-- 第二橫列：7, 8, 9 加上退格 ⌫ -->
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('7')">7</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('8')">8</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('9')">9</button>
        <button type="button" class="btn-jelly key-btn key-backspace" @click="handleKeyPress('⌫')">
          <Delete :size="18" />
        </button>

        <!-- 第三橫列：4, 5, 6 加上清除 C -->
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('4')">4</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('5')">5</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('6')">6</button>
        <button type="button" class="btn-jelly key-btn key-clear" @click="handleKeyPress('C')">C</button>

        <!-- 第四橫列：1、2、3 以及跨兩列的 OK 🐾 鍵 -->
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('1')">1</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('2')">2</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('3')">3</button>
        <button 
          type="button"
          class="btn-jelly key-btn key-confirm" 
          @click="handleKeyPress('OK')"
          style="grid-row: span 2; height: auto;"
        >
          {{ okText }}
        </button>

        <!-- 第五橫列：0、00、. (OK鍵佔了最右邊一格) -->
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('0')">0</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('00')">00</button>
        <button type="button" class="btn-jelly key-btn" @click="handleKeyPress('.')">.</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dodo-amount-calculator {
  width: 100%;
  box-sizing: border-box;
}

/* 模式 1：取代原本 input 的果凍輸入觸發器 */
.amount-field-trigger {
  width: 100%;
  min-height: 48px;
  box-sizing: border-box;
  padding: 8px 14px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-jelly-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  user-select: none;
}

.amount-field-trigger:focus,
.amount-field-trigger.is-active {
  border-color: var(--color-transfer);
  background-color: #FFFDF9;
  box-shadow: 0 0 0 3px rgba(169, 201, 255, 0.35);
  outline: none;
}

.amount-field-trigger.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.field-left-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.currency-tag {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  background: var(--color-bg-warm);
  border: 1px solid var(--color-border);
  padding: 1px 5px;
  border-radius: 4px;
}

.currency-symbol {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.field-value-area {
  flex: 1;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount-number {
  font-size: 19px;
  font-weight: 800;
  color: var(--color-text-dark);
  letter-spacing: 0.5px;
}

.amount-placeholder {
  font-size: 16px;
  font-weight: 600;
  color: #A09080;
}

.field-right-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.calc-icon-bubble {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: var(--color-accent-gold);
  border: 1px solid var(--color-border);
  color: var(--color-text-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.amount-field-trigger:hover .calc-icon-bubble {
  transform: scale(1.1);
}

/* ================= 模式 1 彈出抽屜 (Bottom Sheet / Modal) ================= */
.calc-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(44, 30, 27, 0.55);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
}

@media (min-width: 601px) {
  .calc-modal-backdrop {
    align-items: center;
    padding: 20px;
  }
}

.calc-modal-sheet {
  width: 100%;
  max-width: 420px;
  background-color: var(--color-text-dark);
  border: var(--border-width) solid var(--color-border);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.35);
  padding: 16px 16px 24px 16px;
  box-sizing: border-box;
  animation: sheetBounce 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.2);
}

@media (min-width: 601px) {
  .calc-modal-sheet {
    border-radius: 20px;
    padding: 16px;
  }
}

.sheet-pull-handle {
  width: 36px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 0 auto 10px auto;
}

@media (min-width: 601px) {
  .sheet-pull-handle {
    display: none;
  }
}

.sheet-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #FFFDF9;
}

.sheet-title {
  font-size: 15px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sheet-cat-emoji {
  font-size: 16px;
}

.btn-close-sheet {
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  min-height: 30px !important;
  border-radius: 50% !important;
  background-color: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: #FFFDF9 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  cursor: pointer !important;
}

.btn-close-sheet:hover {
  background-color: rgba(255, 255, 255, 0.25) !important;
}

/* ================= 模式 2 & 共用：計算機看板與按鈕 ================= */
.calculator-panel {
  padding: 10px !important;
  background-color: var(--color-text-dark) !important;
  border-color: var(--color-border);
  border-radius: var(--border-radius-md);
  box-sizing: border-box;
}

.calc-display-board {
  background-color: #FFFDF9;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 8px 12px;
  text-align: right;
  margin-bottom: 10px;
  box-shadow: var(--shadow-jelly-sm);
}

.formula-line {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.result-line {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-text-dark);
  margin-top: 2px;
  letter-spacing: 0.5px;
}

.currency-label {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 1px 4px;
  border-radius: 4px;
  vertical-align: middle;
}

.calc-keyboard-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.key-btn {
  height: 44px;
  font-size: 18px;
  font-weight: 800;
  background-color: #FFFFFF !important;
  border-color: var(--color-border) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  color: var(--color-text-dark) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  user-select: none;
  cursor: pointer;
}

.key-operator {
  background-color: var(--color-transfer) !important;
}

.key-clear {
  background-color: var(--color-expense) !important;
}

.key-backspace {
  background-color: var(--color-accent-gold) !important;
}

.key-confirm {
  background-color: var(--color-income) !important;
  font-size: 14px;
}

.key-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ================= 彈出動畫 ================= */
.calc-backdrop-fade-enter-active,
.calc-backdrop-fade-leave-active {
  transition: opacity 0.2s ease;
}

.calc-backdrop-fade-enter-from,
.calc-backdrop-fade-leave-to {
  opacity: 0;
}

.calc-sheet-slide-enter-active {
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.calc-sheet-slide-leave-active {
  transition: transform 0.2s ease-in;
}

.calc-sheet-slide-enter-from,
.calc-sheet-slide-leave-to {
  transform: translateY(100%);
}

@media (min-width: 601px) {
  .calc-sheet-slide-enter-from,
  .calc-sheet-slide-leave-to {
    transform: scale(0.92);
    opacity: 0;
  }
}
</style>
