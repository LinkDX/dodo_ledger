<script setup lang="ts">
import { computed } from 'vue'
import { useLedger } from '../composables/useLedger'
import { Sparkles, PieChart, TrendingUp, AlertCircle } from 'lucide-vue-next'

const { transactions, monthlyExpense } = useLedger()

// 1. 本月分類支出統計
const categoryExpenses = computed(() => {
  const map: Record<string, { amount: number, color: string }> = {}
  
  // 主分類固定配色
  const catColors: Record<string, string> = {
    '餐飲': '#FFB4B4',      // 粉紅
    '交通': '#A9C9FF',      // 天空藍
    '購物': '#FFDAC1',      // 奶油黃
    '居住生活': '#E2C6FF',  // 薰衣草紫
    '娛樂休閒': '#B5EAD7',  // 薄荷綠
    '其他': '#E8E8E8'
  }

  // 篩選本月支出 (包含信用卡分期)
  const d = new Date()
  const currentPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  const monthlyTxs = transactions.value.filter(tx => {
    if (tx.creditCardDetails?.isInstallment) {
      return tx.creditCardDetails.billPeriod === currentPeriod
    }
    return tx.type === 'expense' && 
      `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}` === currentPeriod
  })

  // 累加
  for (const tx of monthlyTxs) {
    const catName = tx.category || '其他'
    if (!map[catName]) {
      map[catName] = { amount: 0, color: catColors[catName] || '#E8E8E8' }
    }
    map[catName].amount += tx.amount
  }

  // 轉為陣列並按金額排序
  return Object.entries(map).map(([name, val]) => {
    return {
      name,
      amount: val.amount,
      color: val.color,
      ratio: monthlyExpense.value > 0 ? val.amount / monthlyExpense.value : 0
    }
  }).sort((a, b) => b.amount - a.amount)
})

// 2. 計算動態 SVG 圓環圖的各切片參數 (Donut Chart)
// 圓形周長為 2 * pi * r = 2 * 3.14159 * 50 = 314.16
const donutRadius = 50
const donutCircumference = 314.16

const donutSlices = computed(() => {
  let accumulatedRatio = 0
  return categoryExpenses.value.map(cat => {
    const strokeDasharray = `${cat.ratio * donutCircumference} ${donutCircumference}`
    // offset 決定起始旋轉點
    const strokeDashoffset = -accumulatedRatio * donutCircumference
    accumulatedRatio += cat.ratio
    return {
      ...cat,
      strokeDasharray,
      strokeDashoffset
    }
  })
})

// 3. 趨勢折線圖 (最近 6 天)
const dailyTrendData = computed(() => {
  const data = []
  const now = new Date()
  
  // 建立最近 6 天的空殼
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setDate(now.getDate() - i)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000
    
    // 累計當天支出
    const dayAmount = transactions.value
      .filter(tx => tx.type === 'expense' && tx.date >= startOfDay && tx.date < endOfDay)
      .reduce((sum, tx) => sum + tx.amount, 0)

    data.push({
      dateStr,
      amount: dayAmount
    })
  }
  return data
})

// 將最近 6 天支出映射到 SVG 折線圖的座標點中 (viewBox = 0 0 240 100)
const trendPathD = computed(() => {
  const data = dailyTrendData.value
  const maxVal = Math.max(...data.map(d => d.amount), 500) // 預設最小高度上限 500 元
  
  const points = data.map((d, idx) => {
    const x = 20 + idx * 40
    // SVG 座標中 y 軸是向下生長的，因此需用 80 減去映射值
    const y = 80 - (d.amount / maxVal) * 60
    return { x, y }
  })

  if (points.length === 0) return ''
  
  // 畫出圓滑的折線 path d
  return points.reduce((path, p, idx) => {
    if (idx === 0) return `M ${p.x} ${p.y}`
    return `${path} L ${p.x} ${p.y}`
  }, '')
})

// 取得折線圓點
const trendPoints = computed(() => {
  const data = dailyTrendData.value
  const maxVal = Math.max(...data.map(d => d.amount), 500)
  return data.map((d, idx) => {
    const x = 20 + idx * 40
    const y = 80 - (d.amount / maxVal) * 60
    return { x, y, amount: d.amount, dateStr: d.dateStr }
  })
})

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}
</script>

<template>
  <div class="analytics-page-container pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><Sparkles class="icon-inline" /> 逗逗貓手繪統計</h2>
      <p class="page-subtitle">這是本月您的資金消費流向與最近六天趨勢喵！</p>
    </div>

    <!-- 0. 本月無支出提示 -->
    <div v-if="monthlyExpense === 0" class="empty-placeholder card-jelly">
      <div class="alert-icon-circle">
        <AlertCircle :size="32" />
      </div>
      <p class="empty-text">主人，這個月還沒有任何支出紀錄喔喵～</p>
      <p class="empty-hint">先去「記帳」頁面寫下一筆消費，逗逗貓才能幫您手繪圖表喔！</p>
    </div>

    <div v-else class="analytics-core">
      <!-- 1. 🐱 可愛手繪風 Donut 圓環圖 -->
      <div class="chart-box card-jelly">
        <h3 class="chart-box-title"><PieChart :size="16" class="icon-inline" /> 本月消費分類佔比</h3>
        
        <div class="donut-chart-layout">
          <!-- 純動態 SVG 圓環 (100% 手繪繪本風) -->
          <div class="svg-container">
            <svg viewBox="0 0 140 140" class="donut-svg">
              <g transform="rotate(-90 70 70)">
                <!-- 底部背景灰色圓環 -->
                <circle 
                  cx="70" 
                  cy="70" 
                  r="50" 
                  fill="none" 
                  stroke="#E8E8E8" 
                  stroke-width="14" 
                />
                <!-- 各分類動態切片 (粗巧克力邊界) -->
                <circle 
                  v-for="(slice, idx) in donutSlices" 
                  :key="idx"
                  cx="70" 
                  cy="70" 
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
              <!-- 中心白色圓心與總支出 (打造Donut效果) -->
              <circle cx="70" cy="70" r="38" fill="#FFFFFF" stroke="#2C1E1B" stroke-width="2.5" />
              <!-- 中心文字 -->
              <text x="70" y="65" text-anchor="middle" font-size="9" font-weight="800" fill="#7E6E6A">本月總支出</text>
              <text x="70" y="82" text-anchor="middle" font-size="12" font-weight="900" fill="#2C1E1B">${{ formatCurrency(monthlyExpense) }}</text>
            </svg>
          </div>

          <!-- 分類圖例與數據列表 -->
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

      <!-- 2. 📈 可愛手繪風 6 日趨勢折線圖 -->
      <div class="chart-box card-jelly">
        <h3 class="chart-box-title"><TrendingUp :size="16" class="icon-inline" /> 最近 6 天支出趨勢</h3>
        
        <div class="trend-chart-layout">
          <!-- 純 SVG 手動折線圖 -->
          <svg viewBox="0 0 240 100" class="trend-svg">
            <!-- 網格橫線 -->
            <line x1="10" y1="20" x2="230" y2="20" stroke="#E8E8E8" stroke-width="1.5" stroke-dasharray="4" />
            <line x1="10" y1="50" x2="230" y2="50" stroke="#E8E8E8" stroke-width="1.5" stroke-dasharray="4" />
            <line x1="10" y1="80" x2="230" y2="80" stroke="#2C1E1B" stroke-width="2" />

            <!-- 漸層填充區 path -->
            <path 
              v-if="trendPathD" 
              :d="`${trendPathD} L ${trendPoints[trendPoints.length - 1].x} 80 L ${trendPoints[0].x} 80 Z`" 
              fill="url(#trendGrad)" 
              opacity="0.2"
            />

            <!-- 主趨勢折線 (粗巧克力繪本線條) -->
            <path 
              v-if="trendPathD"
              :d="trendPathD" 
              fill="none" 
              stroke="#2C1E1B" 
              stroke-width="3" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />

            <!-- 趨勢圓點 (可愛小圓點) -->
            <g v-for="(p, idx) in trendPoints" :key="idx">
              <!-- 外層手繪感邊圈 -->
              <circle :cx="p.x" :cy="p.y" r="5.5" fill="#2C1E1B" />
              <!-- 內層馬卡龍點 -->
              <circle :cx="p.x" :cy="p.y" r="3.5" fill="#FFDAC1" />
              
              <!-- 折線上的金額微標記 -->
              <text 
                :x="p.x" 
                :y="p.y - 8" 
                text-anchor="middle" 
                font-size="6.5" 
                font-weight="900" 
                fill="#2C1E1B"
              >
                {{ p.amount > 0 ? `$${p.amount}` : '' }}
              </text>

              <!-- X 軸日期標籤 -->
              <text 
                :x="p.x" 
                y="92" 
                text-anchor="middle" 
                font-size="7" 
                font-weight="800" 
                fill="#7E6E6A"
              >
                {{ p.dateStr }}
              </text>
            </g>

            <!-- 定義漸層配色 -->
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FFDAC1" />
                <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <p class="trend-tip-text">🐱 逗逗貓小報告：折線爬得越高，代表主人那天的花銷越兇猛喔喵！</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-page-container {
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 20px;
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

.empty-placeholder {
  text-align: center;
  padding: 40px 20px !important;
}

.alert-icon-circle {
  width: 54px;
  height: 54px;
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px auto;
  box-shadow: var(--shadow-jelly-sm);
}

.empty-text {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
}

/* 圖表面板 */
.chart-box {
  padding: 16px !important;
  background-color: #FFFFFF;
}

.chart-box-title {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

/* 圓環圖排版 */
.donut-chart-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.svg-container {
  width: 160px;
  height: 160px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.donut-svg {
  width: 100%;
  height: 100%;
}

.donut-slice {
  transition: stroke-dashoffset 0.5s ease;
  cursor: pointer;
}

.chart-legend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

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

.legend-name {
  font-size: 12px;
  font-weight: 800;
}

.legend-amount {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
}

/* 趨勢折線圖排版 */
.trend-chart-layout {
  width: 100%;
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  box-shadow: var(--shadow-jelly-sm);
  display: flex;
  justify-content: center;
  align-items: center;
}

.trend-svg {
  width: 100%;
  max-width: 320px;
  height: auto;
}

.trend-tip-text {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  text-align: center;
  margin-top: 12px;
}
</style>
