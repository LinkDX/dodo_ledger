<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useLedger } from '../composables/useLedger'
import type { TransactionType } from '../types'
import { 
  Check, 
  Tag, 
  Sparkles,
  Calculator
} from 'lucide-vue-next'

const { currentProfile } = useAuth()
const { accounts, addTransaction } = useLedger()

// 1. 交易類型：支出 / 收入
const txType = ref<TransactionType>('expense')

// 2. 帳戶選取 (過濾掉信用卡如果是收入，支出則可選信用卡或一般)
const availableAccounts = computed(() => {
  if (txType.value === 'income') {
    return accounts.value.filter(a => a.type !== 'credit_card')
  }
  return accounts.value
})

const selectedAccountId = ref('')

// 當帳戶列表載入或類型改變時，預設選取第一個帳戶
watch([availableAccounts, txType], () => {
  if (availableAccounts.value.length > 0) {
    // 盡量保持之前的選擇，否則選第一個
    const found = availableAccounts.value.find(a => a.id === selectedAccountId.value)
    if (!found) {
      selectedAccountId.value = availableAccounts.value[0].id
    }
  } else {
    selectedAccountId.value = ''
  }
}, { immediate: true })

const activeAccount = computed(() => {
  return accounts.value.find(a => a.id === selectedAccountId.value)
})

// 3. 嚴謹雙層分類選擇
const categories = computed(() => {
  const allCats = currentProfile.value?.settings.categories || []
  return allCats.filter(c => c.type === txType.value)
})

const selectedCatId = ref('')
const selectedSubCat = ref('')

// 監聽類別變更，重置子類別
watch(categories, () => {
  if (categories.value.length > 0) {
    selectedCatId.value = categories.value[0].id
    selectedSubCat.value = categories.value[0].subCategories[0] || ''
  } else {
    selectedCatId.value = ''
    selectedSubCat.value = ''
  }
}, { immediate: true })

const activeCategory = computed(() => {
  return categories.value.find(c => c.id === selectedCatId.value)
})

const handleSelectCat = (catId: string) => {
  selectedCatId.value = catId
  const cat = categories.value.find(c => c.id === catId)
  selectedSubCat.value = cat?.subCategories[0] || ''
}

// 4. 計算機鍵盤狀態管理 (邊記邊算)
const displayFormula = ref('0') // 顯示的算式
const displayResult = ref(0)   // 當前計算出的金額結果
const isNewInput = ref(true)    // 是否為新輸入

const handleKeyPress = (key: string) => {
  if (key === 'C') {
    // 清除
    displayFormula.value = '0'
    displayResult.value = 0
    isNewInput.value = true
    return
  }

  if (key === 'OK') {
    // 按下 OK 其實就是等號，計算最終結果
    calculateResult()
    isNewInput.value = true
    return
  }

  // 處理運算子 (+, -)
  if (key === '+' || key === '-') {
    calculateResult()
    const lastChar = displayFormula.value.slice(-1)
    if (lastChar === '+' || lastChar === '-') {
      // 替換運算子
      displayFormula.value = displayFormula.value.slice(0, -1) + key
    } else {
      displayFormula.value += key
    }
    isNewInput.value = false
    return
  }

  // 處理小數點
  if (key === '.') {
    const parts = displayFormula.value.split(/[\+\-]/)
    const currentNum = parts[parts.length - 1]
    if (currentNum.includes('.')) return // 防止重複小數點
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

  // 即時計算當前結果
  instantCalculate()
}

// 即時計算 (不影響算式，只更新預覽金額)
const instantCalculate = () => {
  try {
    // 替換簡單加減進行 eval 模擬 (安全解析，僅包含數字、小數與加減)
    const sanitized = displayFormula.value.replace(/[^0-9\.\+\-]/g, '')
    if (!sanitized) {
      displayResult.value = 0
      return
    }
    // 結尾若是運算子，先去掉再算
    let toEval = sanitized
    if (sanitized.endsWith('+') || sanitized.endsWith('-')) {
      toEval = sanitized.slice(0, -1)
    }
    // 用簡單的手寫加減解析器代替危險的 eval
    displayResult.value = safeEval(toEval)
  } catch (e) {
    // 解析失敗時不更新
  }
}

const calculateResult = () => {
  instantCalculate()
  displayFormula.value = String(displayResult.value)
}

// 簡單安全的手寫加減數學解析器 (防範安全性漏洞)
const safeEval = (str: string): number => {
  // 將字串拆分為數字與運算子
  const tokens = str.match(/([+-]?\d*\.?\d+)|([+-])/g) || []
  let result = 0
  let currentOp = '+'

  for (const token of tokens) {
    if (token === '+' || token === '-') {
      currentOp = token
    } else {
      const val = parseFloat(token)
      if (currentOp === '+') result += val
      else result -= val
    }
  }
  return Math.max(result, 0) // 金額不能為負數
}

// 5. 信用卡分期付款配置
const isInstallment = ref(false)
const installmentTerm = ref(3) // 預設 3 期

// 監聽帳戶改變，若非信用卡，自動取消分期勾選
watch(selectedAccountId, (newId) => {
  const acct = accounts.value.find(a => a.id === newId)
  if (acct?.type !== 'credit_card') {
    isInstallment.value = false
  }
})

// 6. 其他表單欄位
const note = ref('')
const dateStr = ref(new Date().toISOString().split('T')[0]) // 預設今天

// 7. 送出交易
const handleSubmit = async () => {
  calculateResult() // 確保計算最終金額
  const finalAmount = displayResult.value
  
  if (finalAmount <= 0) return
  if (!selectedAccountId.value || !selectedCatId.value) return

  const txData: any = {
    type: txType.value,
    amount: finalAmount,
    category: activeCategory.value?.name || '其他',
    subCategory: selectedSubCat.value,
    fromAccountId: txType.value === 'expense' ? selectedAccountId.value : undefined,
    toAccountId: txType.value === 'income' ? selectedAccountId.value : undefined,
    date: new Date(dateStr.value).getTime(),
    note: note.value.trim() || `${activeCategory.value?.name}-${selectedSubCat.value}`,
    tags: []
  }

  // 信用卡分期
  if (txType.value === 'expense' && activeAccount.value?.type === 'credit_card' && isInstallment.value) {
    txData.creditCardDetails = {
      isInstallment: true,
      installmentTerm: Number(installmentTerm.value),
      currentInstallment: 1,
      billPeriod: '' // 記帳大腦會自動推算
    }
  }

  await addTransaction(txData)

  // 記帳成功，清空表單
  displayFormula.value = '0'
  displayResult.value = 0
  note.value = ''
  isInstallment.value = false
  isNewInput.value = true
  alert('🐱 喵！成功記下一筆帳囉！')
}
</script>

<template>
  <div class="transaction-form-page pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 讓逗逗貓幫您記帳</h2>
      <p class="page-subtitle">請選擇您的消費分類，並在下方鍵盤輸入金額喔！</p>
    </div>

    <!-- 1. 交易類型切換 (支出/收入) -->
    <div class="tx-type-switch-container card-jelly">
      <button 
        class="btn-jelly btn-switch" 
        :class="{ active: txType === 'expense', 'btn-expense-active': txType === 'expense' }"
        @click="txType = 'expense'"
      >
        💸 支出模式
      </button>
      <button 
        class="btn-jelly btn-switch" 
        :class="{ active: txType === 'income', 'btn-income-active': txType === 'income' }"
        @click="txType = 'income'"
      >
        💰 收入模式
      </button>
    </div>

    <!-- 2. 收支參數設定區 (帳戶、日期、備註) -->
    <div class="form-core-details card-jelly">
      <div class="fields-grid">
        <!-- 帳戶選取 -->
        <div class="form-group">
          <label class="label-cute">選擇支付/收款帳戶</label>
          <select v-model="selectedAccountId" class="input-jelly select-cute">
            <option v-for="a in availableAccounts" :key="a.id" :value="a.id">
              {{ a.name }} (餘額: ${{ a.balance }})
            </option>
          </select>
        </div>

        <!-- 日期選擇 -->
        <div class="form-group">
          <label class="label-cute">記帳日期</label>
          <input v-model="dateStr" type="date" class="input-jelly" />
        </div>
      </div>

      <!-- 備註輸入 -->
      <div class="form-group">
        <label class="label-cute">交易備註</label>
        <input v-model="note" type="text" placeholder="例如：午餐麥當勞、買逗逗貓罐罐..." class="input-jelly" maxlength="30" />
      </div>

      <!-- 信用卡分期配置 (自適應展開) -->
      <Transition name="expand-details">
        <div 
          v-if="txType === 'expense' && activeAccount?.type === 'credit_card'" 
          class="credit-installment-box card-jelly"
        >
          <div class="checkbox-row">
            <input v-model="isInstallment" type="checkbox" id="chk-installment" class="cute-checkbox" />
            <label for="chk-installment" class="label-cute chk-label">
              💳 我要設定「信用卡分期付款」
            </label>
          </div>
          
          <Transition name="expand-details">
            <div v-if="isInstallment" class="installment-slider-group">
              <label class="label-cute">選擇分期期數：<span class="term-bold">{{ installmentTerm }} 期</span></label>
              <div class="term-selector-row">
                <button 
                  v-for="t in [3, 6, 12, 24]" 
                  :key="t"
                  class="btn-jelly btn-term-select"
                  :class="{ active: installmentTerm === t }"
                  @click="installmentTerm = t"
                >
                  {{ t }}期
                </button>
              </div>
              <p class="installment-desc">
                * 系統將立即佔用額度，但帳單會自動按月攤還，首期自動補足餘數。
              </p>
            </div>
          </Transition>
        </div>
      </Transition>
    </div>

    <!-- 3. 雙層分類選擇區 (主分類 ➔ 滑出子分類) -->
    <div class="categories-panel card-jelly">
      <h3 class="panel-subtitle"><Tag :size="14" class="icon-inline" /> 選擇交易分類</h3>
      
      <!-- 主分類滾動列 -->
      <div class="main-categories-list">
        <button 
          v-for="cat in categories" 
          :key="cat.id"
          class="btn-jelly btn-cat-main"
          :class="{ active: selectedCatId === cat.id }"
          @click="handleSelectCat(cat.id)"
        >
          <span class="cat-icon-emoji">{{ cat.type === 'expense' ? '🔴' : '🟢' }}</span>
          <span class="cat-name">{{ cat.name }}</span>
        </button>
      </div>

      <!-- 子分類動態展開膠囊標籤 (RWD 彈性包裝) -->
      <div class="sub-categories-wrapper card-jelly">
        <p class="sub-cat-hint">點選子分類：</p>
        <div class="sub-categories-grid">
          <button 
            v-for="sub in activeCategory?.subCategories" 
            :key="sub"
            class="btn-jelly btn-sub-tag"
            :class="{ active: selectedSubCat === sub }"
            @click="selectedSubCat = sub"
          >
            {{ sub }}
            <Check v-if="selectedSubCat === sub" :size="10" stroke-width="4" class="sub-check" />
          </button>
        </div>
      </div>
    </div>

    <!-- 4. 🧮 金額顯示看板與自訂 QQ 果凍計算機鍵盤 -->
    <div class="calculator-panel card-jelly">
      <!-- 算式與金額顯示看板 -->
      <div class="calc-display-board">
        <div class="formula-line">
          <Calculator :size="14" class="icon-calc" /> {{ displayFormula }}
        </div>
        <div class="result-line">
          <span class="currency-label">TWD</span> ${{ displayResult }}
        </div>
      </div>

      <!-- 4x4 可愛果凍按鍵群 -->
      <div class="calc-keyboard-grid">
        <!-- 第一橫列 -->
        <button class="btn-jelly key-btn" @click="handleKeyPress('7')">7</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('8')">8</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('9')">9</button>
        <button class="btn-jelly key-btn key-operator" @click="handleKeyPress('+')">+</button>

        <!-- 第二橫列 -->
        <button class="btn-jelly key-btn" @click="handleKeyPress('4')">4</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('5')">5</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('6')">6</button>
        <button class="btn-jelly key-btn key-operator" @click="handleKeyPress('-')">-</button>

        <!-- 第三橫列 -->
        <button class="btn-jelly key-btn" @click="handleKeyPress('1')">1</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('2')">2</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('3')">3</button>
        <button class="btn-jelly key-btn key-clear" @click="handleKeyPress('C')">C</button>

        <!-- 第四橫列 -->
        <button class="btn-jelly key-btn" @click="handleKeyPress('0')">0</button>
        <button class="btn-jelly key-btn" @click="handleKeyPress('.')">.</button>
        <button 
          class="btn-jelly key-btn key-confirm" 
          :disabled="displayResult <= 0"
          @click="handleSubmit"
        >
          OK 🐾
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transaction-form-page {
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

/* 交易類型切換 */
.tx-type-switch-container {
  display: flex;
  gap: 12px;
  padding: 12px !important;
  background-color: #FFFFFF;
}

.btn-switch {
  flex: 1;
  font-size: 14px;
  padding: 12px !important;
  background-color: var(--color-bg-warm) !important;
}

.btn-expense-active {
  background-color: var(--color-expense) !important;
  border-width: 3px;
}

.btn-income-active {
  background-color: var(--color-income) !important;
  border-width: 3px;
}

/* 表單設定區 */
.form-core-details {
  padding: 16px !important;
}

.fields-grid {
  display: flex;
  gap: 12px;
}

.form-group {
  flex: 1;
  margin-bottom: 14px;
}

.label-cute {
  font-size: 12px;
  font-weight: 800;
  display: block;
  margin-bottom: 6px;
  padding-left: 4px;
}

.select-cute {
  font-weight: 700;
  background-color: var(--color-bg-warm);
}

/* 信用卡分期模組 */
.credit-installment-box {
  background-color: var(--color-bg-warm) !important;
  padding: 12px !important;
  margin-top: 10px;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cute-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-border);
}

.chk-label {
  margin-bottom: 0 !important;
  cursor: pointer;
}

.installment-slider-group {
  margin-top: 12px;
  border-top: 1.5px dashed var(--color-border);
  padding-top: 10px;
}

.term-bold {
  color: #FF5A5A;
  font-size: 14px;
  font-weight: 800;
}

.term-selector-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.btn-term-select {
  flex: 1;
  padding: 6px !important;
  font-size: 11px;
  background-color: #FFFFFF !important;
}

.btn-term-select.active {
  background-color: var(--color-expense) !important;
  border-width: 3px;
}

.installment-desc {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 8px;
}

/* 雙層分類面板 */
.categories-panel {
  padding: 16px !important;
}

.panel-subtitle {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 10px;
}

.main-categories-list {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 8px;
  width: 100%;
}

.btn-cat-main {
  flex-shrink: 0;
  display: flex !important;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 12px !important;
  font-size: 12px;
  background-color: var(--color-bg-warm) !important;
  margin-bottom: 0 !important;
}

.btn-cat-main.active {
  background-color: var(--color-accent-gold) !important;
  border-width: 3px;
}

.cat-icon-emoji {
  font-size: 14px;
}

/* 子分類膠囊區 */
.sub-categories-wrapper {
  background-color: var(--color-bg-warm) !important;
  padding: 10px !important;
  margin-top: 10px;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.sub-cat-hint {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.sub-categories-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-sub-tag {
  padding: 4px 10px !important;
  font-size: 11px;
  background-color: #FFFFFF !important;
  border-radius: 20px !important;
  display: flex !important;
  align-items: center;
  gap: 4px;
  box-shadow: var(--shadow-jelly-sm-sm) !important;
}

.btn-sub-tag.active {
  background-color: var(--color-income) !important;
  border-width: 2px;
  font-weight: 800;
}

.sub-check {
  color: var(--color-text-dark);
}

/* 計算機與鍵盤 */
.calculator-panel {
  padding: 14px !important;
  background-color: var(--color-text-dark) !important; /* 深黑底，凸顯數字鍵盤 */
  border-color: var(--color-border);
}

.calc-display-board {
  background-color: #FFFDF9;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 12px;
  text-align: right;
  margin-bottom: 14px;
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
  margin-top: 4px;
}

.currency-label {
  font-size: 12px;
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
  height: 48px;
  font-size: 18px;
  font-weight: 800;
  background-color: #FFFFFF !important;
  border-color: var(--color-border) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.key-operator {
  background-color: var(--color-transfer) !important;
}

.key-clear {
  background-color: var(--color-expense) !important;
}

.key-confirm {
  grid-column: span 2; /* 佔據兩格 */
  background-color: var(--color-income) !important;
  font-size: 15px;
}

.key-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}
</style>
