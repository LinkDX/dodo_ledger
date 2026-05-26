<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLedger } from '../composables/useLedger'
import { Sparkles, PieChart, TrendingUp, AlertCircle, BarChart2, CalendarDays } from 'lucide-vue-next'
import MonthYearPicker from './MonthYearPicker.vue'

const { transactions } = useLedger()

// ─── 模式切換 & 時間選擇 ───────────────────────────
type ViewMode = 'monthly' | 'yearly'
const viewMode = ref<ViewMode>('monthly')

const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const selectedYear  = ref(now.getFullYear())

const selectedYearStr = computed({
  get: () => String(selectedYear.value),
  set: (val: string) => {
    const y = parseInt(val)
    if (!isNaN(y)) {
      selectedYear.value = y
    }
  }
})

// 可選月份（從交易資料中動態收集，以最早有交易資料的月份為起點）
const availableMonths = computed(() => {
  const set = new Set<string>()
  const now = new Date()

  if (transactions.value.length === 0) {
    // 若無資料，預設包含最近 12 個月
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  } else {
    // 找出最早與最晚的交易年月
    let minYear = now.getFullYear()
    let minMonth = now.getMonth()
    let maxYear = now.getFullYear()
    let maxMonth = now.getMonth()

    transactions.value.forEach(tx => {
      const d = new Date(tx.date)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = d.getMonth()
        if (y < minYear || (y === minYear && m < minMonth)) {
          minYear = y
          minMonth = m
        }
        if (y > maxYear || (y === maxYear && m > maxMonth)) {
          maxYear = y
          maxMonth = m
        }
      }
    })

    // 生成 min 到 max 區間內所有的月份
    let currYear = minYear
    let currMonth = minMonth
    while (currYear < maxYear || (currYear === maxYear && currMonth <= maxMonth)) {
      set.add(`${currYear}-${String(currMonth + 1).padStart(2, '0')}`)
      currMonth++
      if (currMonth > 11) {
        currMonth = 0
        currYear++
      }
    }
  }

  return [...set].sort().reverse()
})


// ─── 分類配色 palette ────────────────────────────
const EXPENSE_PALETTE = [
  '#FFB4B4', '#FFDAC1', '#E2C6FF', '#FFADC7',
  '#FFA07A', '#FFD700', '#FF7F7F', '#E8B4B8',
  '#FFCBA4', '#F4A7B9', '#E8D5C4', '#FFC5A1'
]
const INCOME_PALETTE = [
  '#B5EAD7', '#A9C9FF', '#C1E1FF', '#D6EAC0',
  '#B0E0E6', '#98D8C8', '#AAE0CC', '#C5E8D4',
  '#9FD5C0', '#B8DFE8', '#A8D8EA', '#C3E8D0'
]
const getCatColor = (palette: string[], idx: number) => palette[idx % palette.length]

// ─── 1a. 支出篩選 ────────────────────────────────
const filteredExpenseTxs = computed(() => {
  if (viewMode.value === 'monthly') {
    return transactions.value.filter(tx => {
      if (tx.creditCardDetails?.isInstallment)
        return tx.creditCardDetails.billPeriod === selectedMonth.value
      const p = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`
      return tx.type === 'expense' && p === selectedMonth.value
    })
  } else {
    return transactions.value.filter(tx => {
      if (tx.creditCardDetails?.isInstallment)
        return tx.creditCardDetails.billPeriod?.startsWith(String(selectedYear.value))
      return tx.type === 'expense' && new Date(tx.date).getFullYear() === selectedYear.value
    })
  }
})

// ─── 1b. 收入篩選 ────────────────────────────────
const filteredIncomeTxs = computed(() =>
  transactions.value.filter(tx => {
    if (viewMode.value === 'monthly') {
      const p = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`
      return tx.type === 'income' && p === selectedMonth.value
    }
    return tx.type === 'income' && new Date(tx.date).getFullYear() === selectedYear.value
  })
)

const periodTotalExpense = computed(() =>
  filteredExpenseTxs.value.reduce((s, tx) => s + tx.amount, 0)
)
const periodTotalIncome = computed(() =>
  filteredIncomeTxs.value.reduce((s, tx) => s + tx.amount, 0)
)

// ─── 2. 分類彙總工具 ─────────────────────────────
const buildCategoryList = (txs: typeof filteredExpenseTxs.value, total: number, palette: string[]) => {
  const map: Record<string, number> = {}
  for (const tx of txs) {
    const cat = tx.category || '其他'
    map[cat] = (map[cat] || 0) + tx.amount
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], idx) => ({
      name, amount,
      color: getCatColor(palette, idx),
      ratio: total > 0 ? amount / total : 0
    }))
}

const categoryExpenses = computed(() =>
  buildCategoryList(filteredExpenseTxs.value, periodTotalExpense.value, EXPENSE_PALETTE)
)
const categoryIncomes = computed(() =>
  buildCategoryList(filteredIncomeTxs.value, periodTotalIncome.value, INCOME_PALETTE)
)

// ─── 3. 圓環圖 SVG 切片 ──────────────────────────
const donutRadius = 50
const donutCircumference = 314.16

const buildDonutSlices = (cats: typeof categoryExpenses.value) => {
  let acc = 0
  return cats.map(cat => {
    const strokeDasharray = `${cat.ratio * donutCircumference} ${donutCircumference}`
    const strokeDashoffset = -acc * donutCircumference
    acc += cat.ratio
    return { ...cat, strokeDasharray, strokeDashoffset }
  })
}

const donutSlices        = computed(() => buildDonutSlices(categoryExpenses.value))
const incomeDonutSlices  = computed(() => buildDonutSlices(categoryIncomes.value))

// ─── 3a. 月統計：最近 6 天趨勢折線 ──────────────
const dailyTrendData = computed(() => {
  const data = []
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setDate(now.getDate() - i)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const end   = start + 86400000
    const amount = transactions.value
      .filter(tx => tx.type === 'expense' && tx.date >= start && tx.date < end)
      .reduce((s, tx) => s + tx.amount, 0)
    data.push({ dateStr, amount })
  }
  return data
})

const dailyMaxVal = computed(() => Math.max(...dailyTrendData.value.map(d => d.amount), 500))

const trendPoints = computed(() =>
  dailyTrendData.value.map((d, idx) => ({
    x: 20 + idx * 40,
    y: 80 - (d.amount / dailyMaxVal.value) * 60,
    amount: d.amount,
    dateStr: d.dateStr
  }))
)

const trendPathD = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return ''
  return pts.reduce((path, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`, '')
})

// ─── 3b. 年統計：12 個月長條圖 ───────────────────
const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const monthlyBarData = computed(() => {
  return MONTH_LABELS.map((label, idx) => {
    const monthStr = `${selectedYear.value}-${String(idx + 1).padStart(2, '0')}`
    const expense = transactions.value
      .filter(tx => {
        if (tx.creditCardDetails?.isInstallment)
          return tx.creditCardDetails.billPeriod === monthStr
        const p = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`
        return tx.type === 'expense' && p === monthStr
      })
      .reduce((s, tx) => s + tx.amount, 0)
    const income = transactions.value
      .filter(tx => {
        const p = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`
        return tx.type === 'income' && p === monthStr
      })
      .reduce((s, tx) => s + tx.amount, 0)
    return { label, expense, income }
  })
})

// SVG 長條圖參數
// viewBox: 0 0 300 110  —— 12 根 bar + x 軸 + y 標籤
const barChartMax = computed(() =>
  Math.max(...monthlyBarData.value.flatMap(d => [d.expense, d.income]), 1000)
)

const BAR_CHART_H = 75   // bar 可畫高度
const BAR_W = 10
const BAR_GAP = 14       // 每個月佔的 x 寬（兩根 bar + 間距）
const BAR_START_X = 20

const barItems = computed(() =>
  monthlyBarData.value.map((d, idx) => {
    const baseX = BAR_START_X + idx * BAR_GAP
    const eH = (d.expense / barChartMax.value) * BAR_CHART_H
    const iH = (d.income  / barChartMax.value) * BAR_CHART_H
    return {
      ...d,
      expenseBar: { x: baseX,          y: 80 - eH, h: eH },
      incomeBar:  { x: baseX + BAR_W / 2 + 1, y: 80 - iH, h: iH },
      labelX: baseX + BAR_W / 2
    }
  })
)

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
</script>

<template>
  <div class="analytics-page-container pop-jelly">
    <!-- 頁首 -->
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 逗逗貓手繪統計</h2>
    </div>

    <!-- 模式切換 + 時間選擇器 -->
    <div class="period-control-bar card-jelly">
      <div class="mode-toggle-row">
        <button
          class="btn-jelly mode-btn"
          :class="{ active: viewMode === 'monthly' }"
          @click="viewMode = 'monthly'"
        >
          <CalendarDays :size="13" /> 月統計
        </button>
        <button
          class="btn-jelly mode-btn"
          :class="{ active: viewMode === 'yearly' }"
          @click="viewMode = 'yearly'"
        >
          <BarChart2 :size="13" /> 年統計
        </button>
      </div>

      <!-- 月份選擇器 -->
      <MonthYearPicker
        v-if="viewMode === 'monthly'"
        v-model="selectedMonth"
        mode="month"
        :available-months="availableMonths"
      />

      <!-- 年份選擇器 -->
      <MonthYearPicker
        v-else
        v-model="selectedYearStr"
        mode="year"
        :available-months="availableMonths"
      />
    </div>

    <!-- 空狀態 -->
    <div v-if="periodTotalExpense === 0 && periodTotalIncome === 0" class="empty-placeholder card-jelly">
      <div class="alert-icon-circle"><AlertCircle :size="32" /></div>
      <p class="empty-text">這個{{ viewMode === 'monthly' ? '月' : '年' }}還沒有任何收支紀錄喔喵～</p>
      <p class="empty-hint">先去記帳頁面新增幾筆，逗逗貓才能幫您手繪圖表喔！</p>
    </div>

    <div v-else class="analytics-core">

      <!-- ── 收支小計橫條 ── -->
      <div class="summary-strip card-jelly">
        <div class="summary-item">
          <span class="summary-label">收入</span>
          <span class="summary-value income-val">+${{ formatCurrency(periodTotalIncome) }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <span class="summary-label">支出</span>
          <span class="summary-value expense-val">-${{ formatCurrency(periodTotalExpense) }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <span class="summary-label">結餘</span>
          <span
            class="summary-value"
            :class="periodTotalIncome - periodTotalExpense >= 0 ? 'income-val' : 'expense-val'"
          >
            {{ periodTotalIncome - periodTotalExpense >= 0 ? '+' : '-' }}${{ formatCurrency(Math.abs(periodTotalIncome - periodTotalExpense)) }}
          </span>
        </div>
      </div>

      <!-- ── 1a. 支出分類圓環圖 ── -->
      <div v-if="categoryExpenses.length > 0" class="chart-box card-jelly">
        <h3 class="chart-box-title">
          <PieChart :size="16" class="icon-inline" />
          {{ viewMode === 'monthly' ? selectedMonth : selectedYear + ' 年' }} 支出分類佔比
        </h3>

        <div class="donut-chart-layout">
          <div class="svg-container">
            <svg viewBox="0 0 140 140" class="donut-svg">
              <g transform="rotate(-90 70 70)">
                <circle cx="70" cy="70" r="50" fill="none" stroke="#E8E8E8" stroke-width="14" />
                <circle
                  v-for="(slice, idx) in donutSlices"
                  :key="idx"
                  cx="70" cy="70"
                  :r="donutRadius"
                  fill="none"
                  :stroke="slice.color"
                  stroke-width="14"
                  :stroke-dasharray="slice.strokeDasharray"
                  :stroke-dashoffset="slice.strokeDashoffset"
                  stroke-linecap="round"
                  class="donut-slice"
                />
              </g>
              <circle cx="70" cy="70" r="38" fill="#FFFFFF" stroke="#2C1E1B" stroke-width="2.5" />
              <text x="70" y="63" text-anchor="middle" font-size="8" font-weight="800" fill="#FF5A5A">💸 總支出</text>
              <text x="70" y="80" text-anchor="middle" font-size="11" font-weight="900" fill="#2C1E1B">${{ formatCurrency(periodTotalExpense) }}</text>
            </svg>
          </div>

          <div class="chart-legend-list">
            <div
              v-for="cat in categoryExpenses"
              :key="cat.name"
              class="legend-item card-jelly"
              :style="{ borderLeftColor: cat.color, borderLeftWidth: '8px' }"
            >
              <span class="legend-name">{{ cat.name }}</span>
              <span class="legend-amount">${{ formatCurrency(cat.amount) }} ({{ Math.round(cat.ratio * 100) }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 1b. 收入分類圓環圖 ── -->
      <div v-if="categoryIncomes.length > 0" class="chart-box card-jelly">
        <h3 class="chart-box-title">
          <PieChart :size="16" class="icon-inline" />
          {{ viewMode === 'monthly' ? selectedMonth : selectedYear + ' 年' }} 收入分類佔比
        </h3>

        <div class="donut-chart-layout">
          <div class="svg-container">
            <svg viewBox="0 0 140 140" class="donut-svg">
              <g transform="rotate(-90 70 70)">
                <circle cx="70" cy="70" r="50" fill="none" stroke="#E8E8E8" stroke-width="14" />
                <circle
                  v-for="(slice, idx) in incomeDonutSlices"
                  :key="idx"
                  cx="70" cy="70"
                  :r="donutRadius"
                  fill="none"
                  :stroke="slice.color"
                  stroke-width="14"
                  :stroke-dasharray="slice.strokeDasharray"
                  :stroke-dashoffset="slice.strokeDashoffset"
                  stroke-linecap="round"
                  class="donut-slice"
                />
              </g>
              <circle cx="70" cy="70" r="38" fill="#FFFFFF" stroke="#2C1E1B" stroke-width="2.5" />
              <text x="70" y="63" text-anchor="middle" font-size="8" font-weight="800" fill="#2C8C67">🌿 總收入</text>
              <text x="70" y="80" text-anchor="middle" font-size="11" font-weight="900" fill="#2C1E1B">${{ formatCurrency(periodTotalIncome) }}</text>
            </svg>
          </div>

          <div class="chart-legend-list">
            <div
              v-for="cat in categoryIncomes"
              :key="cat.name"
              class="legend-item card-jelly"
              :style="{ borderLeftColor: cat.color, borderLeftWidth: '8px' }"
            >
              <span class="legend-name">{{ cat.name }}</span>
              <span class="legend-amount">${{ formatCurrency(cat.amount) }} ({{ Math.round(cat.ratio * 100) }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 2a. 月統計：6 天趨勢折線 ── -->
      <div v-if="viewMode === 'monthly'" class="chart-box card-jelly">
        <h3 class="chart-box-title"><TrendingUp :size="16" class="icon-inline" /> 最近 6 天支出趨勢</h3>
        <div class="trend-chart-layout">
          <svg viewBox="0 0 240 100" class="trend-svg">
            <line x1="10" y1="20" x2="230" y2="20" stroke="#E8E8E8" stroke-width="1.5" stroke-dasharray="4" />
            <line x1="10" y1="50" x2="230" y2="50" stroke="#E8E8E8" stroke-width="1.5" stroke-dasharray="4" />
            <line x1="10" y1="80" x2="230" y2="80" stroke="#2C1E1B" stroke-width="2" />

            <path
              v-if="trendPathD"
              :d="`${trendPathD} L ${trendPoints[trendPoints.length-1].x} 80 L ${trendPoints[0].x} 80 Z`"
              fill="url(#trendGrad)" opacity="0.2"
            />
            <path
              v-if="trendPathD"
              :d="trendPathD"
              fill="none" stroke="#2C1E1B" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round"
            />

            <g v-for="(p, idx) in trendPoints" :key="idx">
              <circle :cx="p.x" :cy="p.y" r="5.5" fill="#2C1E1B" />
              <circle :cx="p.x" :cy="p.y" r="3.5" fill="#FFDAC1" />
              <text :x="p.x" :y="p.y - 8" text-anchor="middle" font-size="6.5" font-weight="900" fill="#2C1E1B">
                {{ p.amount > 0 ? `$${p.amount}` : '' }}
              </text>
              <text :x="p.x" y="92" text-anchor="middle" font-size="7" font-weight="800" fill="#7E6E6A">
                {{ p.dateStr }}
              </text>
            </g>

            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FFDAC1" />
                <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <p class="trend-tip-text">🐱 折線越高，代表那天花越兇喔喵！</p>
      </div>

      <!-- ── 2b. 年統計：12 個月收支長條圖 ── -->
      <div v-else class="chart-box card-jelly">
        <h3 class="chart-box-title"><BarChart2 :size="16" class="icon-inline" /> {{ selectedYear }} 年月度收支對比</h3>

        <div class="bar-legend-row">
          <span class="bar-legend-dot" style="background:#FF7B7B"></span><span class="bar-legend-label">支出</span>
          <span class="bar-legend-dot" style="background:#B5EAD7"></span><span class="bar-legend-label">收入</span>
        </div>

        <div class="trend-chart-layout">
          <svg viewBox="0 0 188 105" class="trend-svg">
            <!-- 背景橫格線 -->
            <line x1="18" y1="10" x2="185" y2="10" stroke="#E8E8E8" stroke-width="1" stroke-dasharray="3" />
            <line x1="18" y1="35" x2="185" y2="35" stroke="#E8E8E8" stroke-width="1" stroke-dasharray="3" />
            <line x1="18" y1="60" x2="185" y2="60" stroke="#E8E8E8" stroke-width="1" stroke-dasharray="3" />
            <!-- X 軸底線 -->
            <line x1="18" y1="80" x2="185" y2="80" stroke="#2C1E1B" stroke-width="1.5" />

            <!-- 長條 -->
            <g v-for="(item, idx) in barItems" :key="idx">
              <!-- 支出 bar（紅色） -->
              <rect
                v-if="item.expenseBar.h > 0"
                :x="item.expenseBar.x"
                :y="item.expenseBar.y"
                :width="5"
                :height="item.expenseBar.h"
                rx="2"
                fill="#FF7B7B"
              />
              <!-- 收入 bar（綠色） -->
              <rect
                v-if="item.incomeBar.h > 0"
                :x="item.incomeBar.x"
                :y="item.incomeBar.y"
                :width="5"
                :height="item.incomeBar.h"
                rx="2"
                fill="#B5EAD7"
              />
              <!-- 月份標籤 -->
              <text
                :x="item.labelX"
                y="90"
                text-anchor="middle"
                font-size="5.5"
                font-weight="800"
                fill="#7E6E6A"
              >{{ item.label }}</text>
            </g>
          </svg>
        </div>

        <!-- 12 個月明細小表 -->
        <div class="year-table">
          <div
            v-for="(item, idx) in monthlyBarData"
            :key="idx"
            class="year-table-row"
            :class="{ 'zero-row': item.expense === 0 && item.income === 0 }"
          >
            <span class="year-table-month">{{ item.label }}</span>
            <span class="year-table-income income-val">+${{ formatCurrency(item.income) }}</span>
            <span class="year-table-expense expense-val">-${{ formatCurrency(item.expense) }}</span>
            <span
              class="year-table-net"
              :class="item.income - item.expense >= 0 ? 'income-val' : 'expense-val'"
            >
              {{ item.income - item.expense >= 0 ? '+' : '' }}${{ formatCurrency(item.income - item.expense) }}
            </span>
          </div>
        </div>
        <p class="trend-tip-text">🐱 綠柱＝收入，紅柱＝支出，越對稱代表收支越平衡喔喵！</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.analytics-page-container {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  padding-bottom: 90px;
}

.page-header { margin-bottom: 14px; }
.page-title  { font-size: 20px; font-weight: 800; margin-bottom: 4px; }

/* 模式控制列 */
.period-control-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px !important;
  background: #fff;
  margin-bottom: 12px;
}

.mode-toggle-row {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
  padding: 8px 0 !important;
  background: var(--color-bg-warm);
}

.mode-btn.active {
  background: var(--color-accent-gold) !important;
}

.period-select {
  width: 100%;
  font-weight: 800;
  margin-bottom: 0;
  font-size: 13px;
}

/* 收支小計 */
.summary-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12px !important;
  background-color: #fff;
  margin-bottom: 12px;
}
.summary-item   { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.summary-label  { font-size: 10px; font-weight: 700; color: var(--color-text-muted); }
.summary-value  { font-size: 13px; font-weight: 900; }
.summary-divider{ width: 1px; height: 30px; background: var(--color-border); }
.income-val     { color: #2C8C67; }
.expense-val    { color: #FF5A5A; }

/* 空狀態 */
.empty-placeholder { text-align: center; padding: 40px 20px !important; }
.alert-icon-circle {
  width: 54px; height: 54px;
  background: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
  box-shadow: var(--shadow-jelly-sm);
}
.empty-text { font-size: 14px; font-weight: 800; margin-bottom: 6px; }
.empty-hint { font-size: 11px; font-weight: 700; color: var(--color-text-muted); }

/* 圖表面板 */
.chart-box       { padding: 16px !important; background: #fff; margin-bottom: 14px; }
.chart-box-title { font-size: 15px; font-weight: 800; margin-bottom: 16px; display: flex; align-items: center; }

/* 圓環圖 */
.donut-chart-layout { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; }
.svg-container { width: 160px; height: 160px; display: flex; justify-content: center; align-items: center; }
.donut-svg { width: 100%; height: 100%; }
.donut-slice { transition: stroke-dashoffset 0.5s ease; }
.chart-legend-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.legend-item {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px !important;
  margin-bottom: 0 !important;
  border-left: 8px solid var(--color-border);
  box-shadow: var(--shadow-jelly-sm) !important;
  background-color: var(--color-bg-warm) !important;
}
.legend-name   { font-size: 12px; font-weight: 800; }
.legend-amount { font-size: 11px; font-weight: 800; color: var(--color-text-muted); }

/* 趨勢折線 & 長條圖共用 */
.trend-chart-layout {
  width: 100%;
  background: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  box-shadow: var(--shadow-jelly-sm);
  display: flex; justify-content: center; align-items: center;
}
.trend-svg { width: 100%; max-width: 360px; height: auto; }
.trend-tip-text { font-size: 10px; font-weight: 800; color: var(--color-text-muted); text-align: center; margin-top: 12px; }

/* 年統計長條圖圖例 */
.bar-legend-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 11px; font-weight: 800; }
.bar-legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.bar-legend-label { color: var(--color-text-muted); }

/* 12 個月明細表 */
.year-table { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; }
.year-table-row {
  display: grid;
  grid-template-columns: 2.5rem 1fr 1fr 1fr;
  align-items: center;
  font-size: 11px;
  font-weight: 800;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--color-bg-warm);
  border: 1px solid var(--color-border);
}
.year-table-row.zero-row { opacity: 0.4; }
.year-table-month   { color: var(--color-text-muted); }
.year-table-income,
.year-table-expense,
.year-table-net     { text-align: right; }
</style>

