<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useLedger } from '../composables/useLedger'
import DodoCat, { type CatMood } from './DodoCat.vue'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  LogOut, 
  PlusCircle,
  ArrowLeftRight,
  Award,
  Eye,
  EyeOff
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'change-tab', tab: string): void
}>()

const { currentProfile, logout } = useAuth()
const { 
  transactions,
  accounts,
  totalAssets, 
  totalLiabilities, 
  netWorth, 
  monthlyExpense, 
  monthlyIncome,
  budgetRatio,
  dodoCatMood: globalCatMood,
  dodoCatSpeech: globalCatSpeech,
  catProfile,
  interactWithCat
} = useLedger()

// ─── 🪄 逗貓棒互動系統反應式狀態 ───
import { onUnmounted } from 'vue'

const isTeasingMode = ref(false)
const currentWand = ref<'feather' | 'laser' | 'bell'>('feather')
const catExcitement = ref(0)
const isPouncing = ref(false)
const isPounceSuccess = ref(false)
const isTickled = ref(false)

// 本地動態臨時互動表情與說話（解決全域 computed 唯讀寫入報錯問題）
const localCatMood = ref<CatMood | null>(null)
const localCatSpeech = ref<string | null>(null)

const dodoCatMood = computed<CatMood>({
  get: () => {
    return localCatMood.value !== null ? localCatMood.value : globalCatMood.value
  },
  set: (val) => {
    localCatMood.value = val
  }
})

const dodoCatSpeech = computed<string>({
  get: () => {
    return localCatSpeech.value !== null ? localCatSpeech.value : globalCatSpeech.value
  },
  set: (val) => {
    localCatSpeech.value = val
  }
})

// 本地包裝交互處理函式，確保進行常規互動時清空臨時本地表情
const handleInteract = async (action: 'pet' | 'feed_fish' | 'feed_can' | 'play_teaser') => {
  localCatMood.value = null
  localCatSpeech.value = null
  await interactWithCat(action)
}

// ─── 🪄 玩逗貓棒時的智慧型動態簡短氣泡管理 ───
const teasingSpeech = ref('')
let teasingSpeechTimer: any = null
let teasingPlayInterval: any = null

const playTeasingQuotes = [
  '看我靈巧的無影貓爪！🐾',
  '喵哈！別想逃出我的視線！👁️',
  '好玩好玩！主人再揮快點喵！⚡',
  '呼呼～看我左右擺動！💨',
  '這個玩具太棒了喵！💖'
]

const showTeasingSpeech = (text: string) => {
  if (teasingSpeechTimer) {
    clearTimeout(teasingSpeechTimer)
    teasingSpeechTimer = null
  }
  teasingSpeech.value = text
  
  // 3.5 秒後自動消失，完全不佔空間，釋放左右揮動區域
  teasingSpeechTimer = setTimeout(() => {
    teasingSpeech.value = ''
  }, 3500)
}

const startTeasingQuotes = () => {
  if (teasingPlayInterval) clearInterval(teasingPlayInterval)
  teasingPlayInterval = setInterval(() => {
    if (isTeasingMode.value && !isPouncing.value && !isTickled.value && lookAtOffset.value !== null) {
      const idx = Math.floor(Math.random() * playTeasingQuotes.length)
      showTeasingSpeech(playTeasingQuotes[idx])
    }
  }, 4800) // 每隔 4.8 秒說一句簡短的內心戲
}

const stopTeasingQuotes = () => {
  if (teasingPlayInterval) {
    clearInterval(teasingPlayInterval)
    teasingPlayInterval = null
  }
}

// 當滑鼠移出或觸碰結束時（躲貓貓彩蛋）
const handleTeaserLeave = () => {
  lookAtOffset.value = null
  if (isTeasingMode.value && !isPouncing.value) {
    showTeasingSpeech('咦？玩具去哪裡了喵？🐾')
  }
}

// 逗貓棒在 mascot-board 卡片內的相對/絕對位置
const teaserPos = ref({ x: 0, y: 0 })
const lookAtOffset = ref<{ x: number; y: number } | null>(null)

// 粒子特效
interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  rotation: number
  rotSpeed: number
  color?: string
  type: 'feather' | 'laser_ripple' | 'bell_note' | 'heart'
}
const particles = ref<Particle[]>([])
let particleIdCounter = 0
let particleAnimationId: number | null = null

// 速度偵測與搔癢偵測
let lastMousePos = { x: 0, y: 0, time: 0 }
let tickleTimer: any = null
const isPounceCooldown = ref(false)
let decayInterval: any = null

// 興奮度自然衰減定時器
const startExcitementDecay = () => {
  if (decayInterval) clearInterval(decayInterval)
  decayInterval = setInterval(() => {
    if (!isTeasingMode.value) {
      if (decayInterval) clearInterval(decayInterval)
      return
    }
    if (catExcitement.value > 0 && !isPouncing.value) {
      // 每 300ms 自然衰減 1 點
      catExcitement.value = Math.max(0, catExcitement.value - 1)
    }
  }, 300)
}

// 粒子生成與物理引擎
const createParticle = (x: number, y: number, type: Particle['type'], color?: string) => {
  particleIdCounter++
  const angle = Math.random() * Math.PI * 2
  const speed = Math.random() * 1.5 + 0.5
  particles.value.push({
    id: particleIdCounter,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (type === 'feather' ? 0.3 : 0),
    size: Math.random() * 12 + 10,
    opacity: 1,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 6,
    color,
    type
  })

  if (particles.value.length > 60) {
    particles.value.shift()
  }

  startParticleAnimation()
}

const updateParticles = () => {
  if (particles.value.length === 0) {
    if (particleAnimationId) {
      cancelAnimationFrame(particleAnimationId)
      particleAnimationId = null
    }
    return
  }

  particles.value = particles.value
    .map(p => {
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotSpeed
      
      if (p.type === 'laser_ripple') {
        p.size += 2.5
        p.opacity -= 0.06
      } else if (p.type === 'feather') {
        p.vx *= 0.98
        p.vy = p.vy * 0.98 + 0.02
        p.opacity -= 0.012
      } else {
        p.opacity -= 0.02
      }
      return p
    })
    .filter(p => p.opacity > 0)

  particleAnimationId = requestAnimationFrame(updateParticles)
}

const startParticleAnimation = () => {
  if (!particleAnimationId) {
    particleAnimationId = requestAnimationFrame(updateParticles)
  }
}

const generateWandParticles = (x: number, y: number) => {
  if (currentWand.value === 'feather') {
    if (Math.random() < 0.25) {
      createParticle(x, y, 'feather')
    }
  } else if (currentWand.value === 'bell') {
    if (Math.random() < 0.3) {
      createParticle(x, y, 'bell_note')
    }
  } else if (currentWand.value === 'laser') {
    if (Math.random() < 0.4) {
      const colors = ['#FF4B4B', '#FF8F4B', '#FF367E']
      const c = colors[Math.floor(Math.random() * colors.length)]
      createParticle(x, y, 'laser_ripple', c)
    }
  }
}

// 實時追隨座標計算與速度/搔癢/飛撲判定
const handleTeaserMove = (e: MouseEvent | TouchEvent) => {
  if (!isTeasingMode.value) return

  const board = (e.currentTarget || e.target) as HTMLElement
  if (!board) return
  const rect = board.getBoundingClientRect()

  let clientX = 0
  let clientY = 0
  if (e instanceof MouseEvent) {
    clientX = e.clientX
    clientY = e.clientY
  } else if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    return
  }

  const x = clientX - rect.left
  const y = clientY - rect.top
  teaserPos.value = { x, y }

  // 當玩逗貓棒時，貓咪在最中間 (Flex居中)，因此頭部中心就是卡片寬度的中央
  // 非玩耍時則位於平常的左側 82px 處
  const catCenterX = isTeasingMode.value ? (rect.width / 2) : 82
  const catCenterY = 146
  
  // 標準化眼神追隨坐標，dx/dy 除以合適的比例因子，讓眼神能在道具靠近時完美精確對準
  const dx = x - catCenterX
  const dy = y - catCenterY
  
  // 加上微小的平滑算法，限制最大偏轉範圍，讓偏轉歪頭自然絲滑
  const lookX = Math.max(-1.1, Math.min(1.1, dx / 90))
  const lookY = Math.max(-1.1, Math.min(1.1, dy / 70))
  lookAtOffset.value = { x: lookX, y: lookY }

  const now = Date.now()
  
  // 飛撲中或冷卻中，滑鼠只更新座標和視線，不重複累積興奮度或觸發二次飛撲與搔癢
  if (isPouncing.value || isPounceCooldown.value) {
    lastMousePos = { x, y, time: now }
    return
  }

  if (lastMousePos.time > 0) {
    const dt = now - lastMousePos.time
    if (dt > 15) {
      const dxMouse = x - lastMousePos.x
      const dyMouse = y - lastMousePos.y
      const dist = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)
      const speed = dist / dt // px/ms

      if (speed > 0.05) {
        // 大幅調柔和累積速度 (原 speed * 12 太快，調為 speed * 1.6)
        let excitementGain = speed * 1.6
        if (currentWand.value === 'laser') excitementGain *= 1.5
        if (currentWand.value === 'bell') excitementGain *= 1.1

        catExcitement.value = Math.min(100, catExcitement.value + excitementGain)
        generateWandParticles(x, y)
        
        if (tickleTimer) {
          clearTimeout(tickleTimer)
          tickleTimer = null
        }
        isTickled.value = false
      }
    }
  }
  lastMousePos = { x, y, time: now }

  // 臉部搔癢偵測
  const isNearFace = Math.abs(lookX) < 0.35 && lookY > -0.2 && lookY < 0.4
  if (isNearFace && !isTickled.value && !isPouncing.value) {
    if (!tickleTimer) {
      tickleTimer = setTimeout(() => {
        isTickled.value = true
        showTeasingSpeech('呼嚕嚕～好癢好舒服喵～💖')
        dodoCatMood.value = 'happy'
        for (let i = 0; i < 4; i++) {
          createParticle(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, 'heart')
        }
      }, 1000)
    }
  } else {
    if (!isNearFace) {
      if (tickleTimer) {
        clearTimeout(tickleTimer)
        tickleTimer = null
      }
    }
  }

  // 興奮度滿點觸發飛撲
  if (catExcitement.value >= 100 && !isPouncing.value && !isPounceCooldown.value) {
    triggerPounce()
  }
}

// 飛撲物理學
const triggerPounce = () => {
  if (isPouncing.value || isPounceCooldown.value) return
  isPouncing.value = true
  isPounceCooldown.value = true
  isTickled.value = false

  if (tickleTimer) {
    clearTimeout(tickleTimer)
    tickleTimer = null
  }

  dodoCatMood.value = 'happy'
  showTeasingSpeech('瞄哈！看我的無影飛撲！抓！💨')

  setTimeout(() => {
    // 撲出時判定是否在貓咪周圍
    const currentDist = Math.sqrt(Math.pow(lookAtOffset.value?.x || 1.5, 2) + Math.pow(lookAtOffset.value?.y || 1.5, 2))
    const isCatch = lookAtOffset.value !== null && currentDist < 0.78

    if (isCatch) {
      isPounceSuccess.value = true
      interactWithCat('play_teaser')
      showTeasingSpeech('喵哈！抓到了！主人最棒了喵！💖')
      for (let i = 0; i < 20; i++) {
        const px = teaserPos.value.x + (Math.random() - 0.5) * 50
        const py = teaserPos.value.y + (Math.random() - 0.5) * 50
        createParticle(px, py, 'heart')
      }
    } else {
      isPounceSuccess.value = false
      dodoCatMood.value = 'nervous'
      showTeasingSpeech('喵嗚！撲空了…主人動作太快了喵！🐾')
    }

    setTimeout(() => {
      isPouncing.value = false
      isPounceSuccess.value = false
      catExcitement.value = 0
      setTimeout(() => {
        isPounceCooldown.value = false
      }, 500)
    }, 1200)

  }, 450)
}

// 控制面板函式
const startTeasing = () => {
  isTeasingMode.value = true
  catExcitement.value = 0
  isTickled.value = false
  isPouncing.value = false
  isPounceSuccess.value = false
  dodoCatMood.value = 'happy'
  showTeasingSpeech('哇！是逗貓棒喵！🪄 快陪我玩！🐾')
  startExcitementDecay()
  startTeasingQuotes() // 啟動隨機內心戲台詞
}

const stopTeasing = () => {
  isTeasingMode.value = false
  lookAtOffset.value = null
  isTickled.value = false
  isPouncing.value = false
  isPounceSuccess.value = false
  catExcitement.value = 0
  particles.value = []
  
  if (particleAnimationId) {
    cancelAnimationFrame(particleAnimationId)
    particleAnimationId = null
  }
  
  if (tickleTimer) {
    clearTimeout(tickleTimer)
    tickleTimer = null
  }

  if (teasingSpeechTimer) {
    clearTimeout(teasingSpeechTimer)
    teasingSpeechTimer = null
  }
  teasingSpeech.value = ''
  
  stopTeasingQuotes() // 停止隨機內心戲台詞

  if (decayInterval) {
    clearInterval(decayInterval)
    decayInterval = null
  }
  
  dodoCatSpeech.value = '呼～玩得好累，但是好開心喵！謝謝主人陪我玩！🐾'
  dodoCatMood.value = 'happy'
}

const selectWand = (wand: 'feather' | 'laser' | 'bell') => {
  currentWand.value = wand
  if (wand === 'feather') {
    showTeasingSpeech('🌸 粉嫩的羽毛飄啊飄…最經典喵！')
  } else if (wand === 'laser') {
    showTeasingSpeech('🔴 哇！是紅點點！看我抓爆它喵！⚡')
  } else if (wand === 'bell') {
    showTeasingSpeech('🔔 鈴鈴鈴～這個鈴聲好好聽喵！🐾')
  }
}

const getParticleStyle = (p: Particle) => {
  return {
    position: 'absolute' as const,
    left: `${p.x}px`,
    top: `${p.y}px`,
    transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.opacity})`,
    opacity: p.opacity,
    pointerEvents: 'none' as const,
    fontSize: `${p.size}px`,
    zIndex: 25,
    transition: p.type === 'laser_ripple' ? 'none' : 'transform 0.05s linear'
  }
}

onUnmounted(() => {
  if (decayInterval) clearInterval(decayInterval)
  if (tickleTimer) clearTimeout(tickleTimer)
  if (particleAnimationId) cancelAnimationFrame(particleAnimationId)
})

// 淨資產隱藏開關
const isNetWorthHidden = ref(localStorage.getItem('net_worth_hidden') === 'true')
const toggleNetWorthHidden = () => {
  isNetWorthHidden.value = !isNetWorthHidden.value
  localStorage.setItem('net_worth_hidden', String(isNetWorthHidden.value))
}

// 切換身分泡泡選單控制
const showUserMenu = ref(false)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const handleLogout = () => {
  showUserMenu.value = false
  logout()
}

const openAchievements = () => {
  showUserMenu.value = false
  showAchievements.value = true
}

// 取得帳戶名稱
const getAccountName = (id?: string) => {
  if (!id) return ''
  return accounts.value.find(a => a.id === id)?.name || ''
}

// 取得近 3 筆交易紀錄
const recentTransactions = computed(() => {
  const floorDay = (ts: number) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  return [...transactions.value]
    .sort((a, b) => {
      const diff = floorDay(b.date) - floorDay(a.date)
      return diff !== 0 ? diff : (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    })
    .slice(0, 3)
})

// 格式化千分位金額
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}

// 根據交易類型取得可愛的金額樣式
const getTxAmountStyle = (tx: any) => {
  if (tx.type === 'expense') return { color: '#FF7B7B', prefix: '-' }
  if (tx.type === 'income') return { color: '#2EB086', prefix: '+' }
  return { color: '#3A86C8', prefix: '' }
}

// 🏆 成就徽章牆控制與定義
const showAchievements = ref(false)

const achievementList = [
  // 摸摸大師系列 (檢討後門檻提升，以配合無 CD 機制)
  { id: 'pet_100', title: '初級鏟屎官', desc: '累計摸摸逗逗貓 100 次。', emoji: '👋' },
  { id: 'pet_500', title: '得心應手', desc: '累計摸摸逗逗貓 500 次。', emoji: '💆' },
  { id: 'pet_2000', title: '貓咪按摩師', desc: '累計摸摸逗逗貓 2000 次。', emoji: '🖐️' },
  { id: 'pet_10000', title: '皇家擼貓聖手', desc: '累計摸摸逗逗貓 10000 次。', emoji: '👑' },

  // 米其林飼養員系列 (檢討後門檻提升，以配合無 CD 機制)
  { id: 'feed_50', title: '見習飼養員', desc: '累計餵食（魚乾或罐罐） 50 次。', emoji: '🐟' },
  { id: 'feed_200', title: '特級主廚', desc: '累計餵食（魚乾或罐罐） 200 次。', emoji: '🧑‍🍳' },
  { id: 'feed_1000', title: '皇家御膳房總管', desc: '累計餵食（魚乾或罐罐） 1000 次。', emoji: '🍣' },

  // 長情陪伴系列
  { id: 'streak_3', title: '三日溫存', desc: '連續 3 天開啟 App 並與逗逗貓互動。', emoji: '🌱' },
  { id: 'streak_7', title: '全職貓奴', desc: '連續 7 天開啟 App 並與逗逗貓互動。', emoji: '📅' },
  { id: 'streak_30', title: '終身伴侶', desc: '連續 30 天開啟 App 並與逗逗貓互動。', emoji: '💖' },

  // 健康理財系列
  { id: 'wealth_100k', title: '金庫滿盈', desc: '個人總資產首次突破或達到 TWD $100,000 大關！', emoji: '💎' },
  { id: 'saving_master', title: '存錢大師', desc: '當月記帳「收入」大於「支出」的兩倍。', emoji: '💰' },
  { id: 'zero_debt', title: '無債一身輕', desc: '個人淨資產為正值，且所有信用卡負債皆已全數清空！', emoji: '🕊️' },
  { id: 'saver_10', title: '省錢達人', desc: '當月總支出低於理財預算的 10%（需已設定月預算且當月有記帳支出）。', emoji: '🛡️' },
  { id: 'debt_buster', title: '負債剋星', desc: '單筆還清信用卡款項超過 TWD $10,000。', emoji: '💥' },

  // 隱藏彩蛋
  { id: 'cat_vault', title: '貓咪保險箱', desc: '成功建立並啟用至少一個「週期性自動記帳」設定項目。', emoji: '🔐', isHidden: true },
  { id: 'disturbed_sleep', title: '擾人清夢', desc: '在凌晨 02:00 ~ 05:00 之間，點擊睡覺中的貓咪 20 次。', emoji: '⏰', isHidden: true },
  { id: 'cold_war', title: '冷戰期', desc: '超過 7 天未開啟 App 後重新回來陪伴。', emoji: '❄️', isHidden: true },
  { id: 'combo_50', title: '幻影無影手', desc: '在 10 秒內連續摸摸逗逗貓 50 次！⚡', emoji: '⚡', isHidden: true }
]

const isAchievementUnlocked = (id: string) => {
  if (!catProfile.value || !catProfile.value.unlockedAchievementIds) return false
  return catProfile.value.unlockedAchievementIds.includes(id)
}
</script>

<template>
  <div class="dashboard-container">
    <!-- 頂部 Header & 身分切換 -->
    <div class="dashboard-header">
      <div class="header-left-actions">
        <div class="user-profile-widget">
          <div class="avatar-badge btn-jelly" @click="toggleUserMenu">
            <span class="avatar-emoji">{{ currentProfile?.avatar }}</span>
            <span class="user-name">{{ currentProfile?.name }}</span>
          </div>
          
          <!-- 身分切換/登出可愛下拉選單 -->
          <Transition name="fade-menu">
            <div v-if="showUserMenu" class="user-dropdown-menu card-jelly pop-jelly">
              <button class="menu-item btn-jelly" @click="handleLogout">
                <LogOut :size="14" class="menu-icon" /> 🚪 登出/切換身分
              </button>
            </div>
          </Transition>
        </div>

        <button class="btn-jelly btn-header-action btn-achievement" @click="openAchievements">
          <Award :size="14" class="menu-icon" /> 成就
        </button>
      </div>

      <div class="app-logo-cute">
        <span class="logo-emoji">🐱</span> Dodo Ledger
      </div>
    </div>

    <!-- 1. 🐱 逗逗貓療癒生活看板 (最上方 30-40% 畫面高) -->
    <div 
      class="mascot-board card-jelly"
      :class="{ 
        'board-teasing-active': isTeasingMode, 
        'board-cat-wiggle-furious': isTeasingMode && catExcitement >= 75 && !isPouncing 
      }"
      @mousemove="handleTeaserMove"
      @touchmove.prevent="handleTeaserMove"
      @mouseleave="handleTeaserLeave"
      @touchend="handleTeaserLeave"
    >
      <!-- 貓咪陪伴狀態列 (拿掉精力與等級，改為溫馨相伴指標) -->
      <div v-if="catProfile && !isTeasingMode" class="cat-status-overlay pop-jelly">
        <div class="status-bars" style="min-width: 100px; gap: 4px;">
          <div class="companion-stat-item" style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800;">
            <span class="companion-label" style="color: var(--color-text-muted);">相伴天數</span>
            <span class="companion-value" style="color: var(--color-expense); background: rgba(0,0,0,0.05); padding: 0 4px; border-radius: 4px;">{{ catProfile.stats.streakDays }} 天</span>
          </div>
          <div class="companion-stat-item" style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800;">
            <span class="companion-label" style="color: var(--color-text-muted);">親密互動</span>
            <span class="companion-value" style="color: var(--color-income); background: rgba(0,0,0,0.05); padding: 0 4px; border-radius: 4px;">{{ catProfile.stats.totalPets + catProfile.stats.totalFeeds + (catProfile.stats.totalPlays || 0) }} 次</span>
          </div>
        </div>
      </div>

      <!-- 🐱 貓咪興奮度膠囊型進度條 (只在 teasing 模式下顯示，完美放置於左上角，絕不遮擋貓身) -->
      <div v-if="isTeasingMode" class="cat-status-overlay pop-jelly excitement-overlay">
        <div class="status-bars" style="width: 110px; gap: 3px;">
          <div class="companion-stat-item" style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; margin-bottom: 2px;">
            <span class="companion-label" style="color: var(--color-text-dark);">⚡ 興奮度</span>
            <span class="companion-value" style="color: var(--color-expense); background: rgba(255,107,107,0.1); padding: 0 4px; border-radius: 4px;">{{ Math.round(catExcitement) }}%</span>
          </div>
          <!-- 迷你進度條軌道 -->
          <div class="excitement-track" style="width: 100%; height: 7px; background-color: rgba(0, 0, 0, 0.06); border-radius: 4px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05);">
            <div 
              class="excitement-fill" 
              :style="{ width: `${catExcitement}%` }"
              :class="{ 'excitement-full-glow': catExcitement >= 100 }"
              style="height: 100%; border-radius: 4px; transition: width 0.08s ease-out;"
            ></div>
          </div>
          <!-- 迷你提示 -->
          <div class="excitement-mini-hint" style="font-size: 8px; font-weight: 800; color: var(--color-text-muted); text-align: center; margin-top: 1px;">
            <template v-if="catExcitement >= 100">🔥 準備飛撲！</template>
            <template v-else-if="isTickled">💖 搔癢舒服中</template>
            <template v-else>🪄 揮動累積</template>
          </div>
        </div>
      </div>

      <!-- 🪄 逗貓棒粒子特效 -->
      <div v-if="isTeasingMode" class="teaser-particles-container">
        <div 
          v-for="p in particles" 
          :key="p.id" 
          class="teaser-particle" 
          :style="getParticleStyle(p)"
        >
          <span v-if="p.type === 'feather'">🌸</span>
          <span v-else-if="p.type === 'bell_note'">♪</span>
          <span v-else-if="p.type === 'heart'">💖</span>
          <div 
            v-else-if="p.type === 'laser_ripple'" 
            class="laser-ripple-ring"
            :style="{ borderColor: p.color }"
          ></div>
        </div>
      </div>

      <DodoCat 
        :mood="dodoCatMood" 
        :speech="isTeasingMode ? teasingSpeech : dodoCatSpeech" 
        :look-at="isTeasingMode ? lookAtOffset : null"
        :is-pouncing="isPouncing"
        :is-pounce-success="isPounceSuccess"
        :is-tickled="isTickled"
        :current-wand="currentWand"
        :is-teasing="isTeasingMode"
        @pet="handleInteract('pet')" 
      />

      <!-- 🪄 跟隨滑鼠/手指的可愛手繪逗貓棒/雷射紅點 -->
      <div 
        v-if="isTeasingMode && lookAtOffset !== null" 
        class="floating-teaser-wand"
        :style="{ left: `${teaserPos.x}px`, top: `${teaserPos.y}px` }"
        :class="`wand-type-${currentWand}`"
      >
        <template v-if="currentWand === 'feather'">
          <svg class="feather-wand-svg" viewBox="0 0 40 40" width="36" height="36">
            <line x1="35" y1="35" x2="18" y2="18" stroke="#8E7A6B" stroke-width="3" stroke-linecap="round" />
            <path d="M 18 18 Q 8 10 12 4 Q 18 8 18 18" fill="#FFB7B2" stroke="#3D2B1F" stroke-width="1.8" />
            <path d="M 18 18 Q 14 12 6 12 Q 10 18 18 18" fill="#FFDAC1" stroke="#3D2B1F" stroke-width="1.8" />
            <circle cx="18" cy="18" r="3.5" fill="#F4C842" stroke="#3D2B1F" stroke-width="1.2" />
          </svg>
        </template>
        <template v-else-if="currentWand === 'laser'">
          <div class="laser-center-dot"></div>
        </template>
        <template v-else-if="currentWand === 'bell'">
          <svg class="bell-wand-svg" viewBox="0 0 40 40" width="36" height="36">
            <line x1="35" y1="35" x2="20" y2="20" stroke="#8E7A6B" stroke-width="3" stroke-linecap="round" />
            <circle cx="20" cy="20" r="6" fill="#F4C842" stroke="#3D2B1F" stroke-width="1.8" />
            <line x1="17" y1="20" x2="23" y2="20" stroke="#3D2B1F" stroke-width="1.2" />
            <path d="M 20 25 Q 15 32 22 36" fill="none" stroke="#B5EAD7" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 20 25 Q 25 32 18 36" fill="none" stroke="#FF9AA2" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </template>
      </div>
      
      <!-- 🐾 逗逗貓趣味互動餵食箱 & 逗貓棒操作面板 (動態切換) -->
      <div class="cat-interaction-bar pop-jelly">
        <template v-if="!isTeasingMode">
          <button 
            class="btn-interact btn-jelly" 
            @click="handleInteract('feed_fish')"
          >
            🐟 餵小魚乾
          </button>
          <button 
            class="btn-interact btn-jelly" 
            @click="handleInteract('feed_can')"
          >
            🥫 餵好罐罐
          </button>
          <button 
            class="btn-interact btn-jelly btn-teaser-start" 
            @click="startTeasing"
          >
            🪄 玩逗貓棒
          </button>
        </template>
        
        <template v-else>
          <div class="wand-selector pop-jelly">
            <button 
              class="btn-wand-pill" 
              :class="{ active: currentWand === 'feather' }"
              @click="selectWand('feather')"
            >
              🌸 羽毛
            </button>
            <button 
              class="btn-wand-pill" 
              :class="{ active: currentWand === 'laser' }"
              @click="selectWand('laser')"
            >
              🔴 雷射
            </button>
            <button 
              class="btn-wand-pill" 
              :class="{ active: currentWand === 'bell' }"
              @click="selectWand('bell')"
            >
              🔔 鈴鐺
            </button>
          </div>
          <button 
            class="btn-interact btn-jelly btn-teaser-stop" 
            @click="stopTeasing"
          >
            ❌ 收起玩具
          </button>
        </template>
      </div>
    </div>

    <!-- 2. 🧮 淨資產與收支看板 -->
    <div class="networth-card card-jelly">
      <div class="networth-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <div class="networth-label" style="margin-bottom: 0;">
          <Wallet :size="16" class="icon-net" /> 淨資產淨值
        </div>
        <button 
          class="btn-jelly btn-eye-toggle" 
          @click="toggleNetWorthHidden" 
          style="background: none; border: none; padding: 4px; display: inline-flex; align-items: center; cursor: pointer; color: var(--color-text-muted);"
          title="切換隱藏資產"
        >
          <Eye v-if="!isNetWorthHidden" :size="16" />
          <EyeOff v-else :size="16" />
        </button>
      </div>
      <div class="networth-amount" :class="{ 'negative-wealth': netWorth < 0 }">
        <template v-if="isNetWorthHidden">***</template>
        <template v-else>TWD ${{ formatCurrency(netWorth) }}</template>
      </div>
      <div class="assets-debts-grid">
        <div class="grid-sub-item">
          <span class="sub-label">總資產 (正值)</span>
          <span class="sub-amount asset-green">
            <template v-if="isNetWorthHidden">***</template>
            <template v-else>${{ formatCurrency(totalAssets) }}</template>
          </span>
        </div>
        <div class="grid-sub-item">
          <span class="sub-label">總負債 (卡費等)</span>
          <span class="sub-amount liability-orange">
            <template v-if="isNetWorthHidden">***</template>
            <template v-else>${{ formatCurrency(totalLiabilities) }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- 3. 📊 本月收支與預算進度條 -->
    <div class="budget-analytics card-jelly">
      <h3 class="card-inner-title">本月收支概覽</h3>
      <div class="income-expense-row">
        <div class="cash-flow-box income-box">
          <div class="flow-header">
            <TrendingUp :size="14" stroke-width="3" class="flow-icon icon-inc" />
            <span>本月總收入</span>
          </div>
          <p class="flow-amount">${{ formatCurrency(monthlyIncome) }}</p>
        </div>
        <div class="cash-flow-box expense-box">
          <div class="flow-header">
            <TrendingDown :size="14" stroke-width="3" class="flow-icon icon-exp" />
            <span>本月總支出</span>
          </div>
          <p class="flow-amount">${{ formatCurrency(monthlyExpense) }}</p>
        </div>
      </div>

      <!-- 預算進度條 -->
      <div class="budget-progress-section">
        <div class="progress-labels">
          <span class="progress-title">月度預算使用進度</span>
          <span class="progress-ratio-text">
            {{ Math.round(budgetRatio * 100) }}% 
            ({{ formatCurrency(monthlyExpense) }} / {{ formatCurrency(currentProfile?.settings.monthlyBudget || 20000) }})
          </span>
        </div>
        <div class="progress-bar-container">
          <div 
            class="progress-bar-fill" 
            :style="{ 
              width: `${Math.min(budgetRatio * 100, 100)}%`,
              backgroundColor: budgetRatio >= 1.0 ? '#FF7B7B' : budgetRatio >= 0.8 ? '#FFC77B' : '#B5EAD7'
            }"
          ></div>
        </div>
        <p v-if="budgetRatio >= 1.0" class="budget-alert-text pop-jelly">⚠️ 喵！主人，您這個月花超支啦！要克制喔！</p>
      </div>
    </div>

    <!-- 4. 📝 近期交易紀錄 (近 3 筆) -->
    <div class="recent-transactions-section card-jelly">
      <div class="section-header">
        <h3 class="card-inner-title">近期收支明細</h3>
        <button class="btn-jelly btn-view-all" @click="emit('change-tab', 'transactions')">
          查看全部
        </button>
      </div>

      <div v-if="recentTransactions.length === 0" class="empty-tx-placeholder">
        <p class="empty-text">目前還沒有記帳明細喔～🐾</p>
        <button class="btn-jelly btn-go-add" @click="emit('change-tab', 'add')">
          <PlusCircle :size="14" class="menu-icon" /> 讓逗逗貓幫您記第一筆！
        </button>
      </div>

      <div v-else class="tx-list-cute">
        <div 
          v-for="tx in recentTransactions" 
          :key="tx.id"
          class="tx-item-cute card-jelly"
        >
          <!-- 交易主子分類與 icon -->
          <div class="tx-left-side" style="display: flex; align-items: center; gap: 10px;">
            <!-- 左側 Avatar 與記帳人垂直頭像區 -->
            <div class="tx-avatar-area" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; width: 44px; min-width: 44px; max-width: 44px;">
              <div 
                class="tx-icon-circle"
                :style="{ 
                  backgroundColor: tx.type === 'expense' ? '#FFDADA' : tx.type === 'income' ? '#E1F8EB' : '#E3EFFF'
                }"
                style="margin-bottom: 0;"
              >
                <ArrowLeftRight v-if="tx.type === 'transfer'" :size="16" />
                <span v-else class="tx-type-dot">{{ tx.type === 'expense' ? '💸' : '💰' }}</span>
              </div>
              <span 
                v-if="tx.createdBy" 
                class="creator-tag-micro" 
                style="font-size: 8px; font-weight: 800; color: var(--color-text-dark); background-color: var(--color-bg-warm); border: 1.2px solid var(--color-border); border-radius: 6px; padding: 1.5px 2px; white-space: nowrap; max-width: 100%; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; text-align: center; display: block;"
                :title="tx.createdBy"
              >
                {{ tx.createdByAvatar }}{{ tx.createdBy }}
              </span>
            </div>
            <div class="tx-info-block">
              <div class="tx-category-row" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                <span class="tx-category-tag">
                  {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
                </span>
              </div>
              <div class="tx-note-row">
                <span class="tx-note">{{ tx.note || '無備註' }}</span>
              </div>
              <div class="tx-details-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%;">
                <template v-if="tx.type === 'transfer'">
                  <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                    <span class="transfer-label" style="background-color: #E3EFFF; color: #4A7FE0; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">從</span>
                    <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId) }}</span>
                  </div>
                  <div class="tx-account-info transfer-line" style="display: flex; align-items: center; gap: 4px;">
                    <span class="transfer-label" style="background-color: #E1F8EB; color: #2C8C67; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 800;">到</span>
                    <span class="acct-name-pill">{{ getAccountName(tx.toAccountId) }}</span>
                  </div>
                </template>
                <template v-else>
                  <span class="tx-account-info">
                    <span class="acct-name-pill">{{ getAccountName(tx.fromAccountId || tx.toAccountId) }}</span>
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- 交易金額與日期 -->
          <div class="tx-right-side">
            <span 
              class="tx-amount-text"
              :style="{ color: getTxAmountStyle(tx).color }"
            >
              {{ getTxAmountStyle(tx).prefix }}${{ formatCurrency(tx.amount) }}
            </span>
            <span class="tx-date-small">
              {{ new Date(tx.date).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'}) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 🏆 成就徽章彈出面板 -->
    <Transition name="fade-modal">
      <div v-if="showAchievements" class="modal-overlay" @click.self="showAchievements = false">
        <div class="achievement-modal card-jelly">
          <div class="modal-header">
            <h3 class="modal-title">🏆 逗逗貓成就徽章牆</h3>
            <button class="btn-close-circle btn-jelly" @click="showAchievements = false">×</button>
          </div>
          
          <div class="achievements-list">
            <div 
              v-for="ach in achievementList" 
              :key="ach.id" 
              class="achievement-item card-jelly"
              :class="{ 
                'ach-locked': !isAchievementUnlocked(ach.id),
                'ach-hidden-locked': ach.isHidden && !isAchievementUnlocked(ach.id)
              }"
            >
              <div class="ach-badge-icon">
                <span class="ach-emoji">{{ isAchievementUnlocked(ach.id) ? ach.emoji : '🔒' }}</span>
              </div>
              <div class="ach-info">
                <div class="ach-name">
                  {{ (ach.isHidden && !isAchievementUnlocked(ach.id)) ? '🐱 隱藏成就' : ach.title }}
                  <span v-if="!isAchievementUnlocked(ach.id)" class="ach-locked-tag">
                    {{ ach.isHidden ? '未探索' : '鎖定中' }}
                  </span>
                  <span v-else class="ach-unlocked-tag">已達成 🎉</span>
                </div>
                <div class="ach-desc">
                  {{ (ach.isHidden && !isAchievementUnlocked(ach.id)) ? '？？？（這是一個神秘的隱藏彩蛋，努力探索吧喵！）' : ach.desc }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 16px;
  padding-bottom: 90px; /* 預留底欄高度 */
}

/* 頂部 Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  position: relative;
  z-index: 100;
}

.header-left-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-profile-widget {
  position: relative;
}

.avatar-badge {
  padding: 6px 12px !important;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #FFFFFF;
}

.avatar-emoji {
  font-size: 20px;
}

.user-name {
  font-size: 13px;
  font-weight: 800;
}

.user-dropdown-menu {
  position: absolute;
  top: 48px;
  left: 0;
  z-index: 110;
  width: 170px;
  padding: 10px !important;
  background-color: #FFFFFF;
  margin-bottom: 0;
}

.menu-item {
  width: 100% !important;
  padding: 8px !important;
  font-size: 12px;
  justify-content: flex-start;
  gap: 6px;
  background-color: var(--color-bg-warm) !important;
}

.menu-icon {
  color: var(--color-text-muted);
}

.btn-header-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px !important;
  font-size: 13px;
  font-weight: 800;
  background-color: #FFFFFF !important;
}

.app-logo-cute {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.logo-emoji {
  font-size: 18px;
}

/* 逗逗貓生活看板區 */
.mascot-board {
  padding: 12px !important;
  background-color: var(--color-card-bg);
  overflow: visible; /* 移除 hidden，防止氣泡被截斷 */
  height: 240px; /* 增加高度，給氣泡充足的顯示空間 */
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative; /* 方便內部互動按鈕定位 */
}

/* 🐾 逗逗貓趣味互動工具列 */
.cat-interaction-bar {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 30;
}

/* 🐾 貓咪狀態疊加層 */
.cat-status-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 6px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--color-border);
  z-index: 30;
  backdrop-filter: blur(4px);
}

.level-badge {
  background-color: var(--color-accent-gold);
  color: var(--color-text-dark);
  font-weight: 800;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1.5px solid var(--color-border);
}

.status-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 80px;
}

.bar-label {
  font-size: 9px;
  font-weight: 800;
  color: var(--color-text-muted);
  line-height: 1;
  display: flex;
  justify-content: space-between;
}

.bar-track {
  height: 6px;
  background-color: #E0E0E0;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.energy-fill { background-color: var(--color-income); }
.xp-fill { background-color: #C3B1E1; } /* 薰衣草紫 */

.cost-tag {
  font-size: 10px;
  background-color: rgba(0,0,0,0.1);
  padding: 0px 4px;
  border-radius: 4px;
  margin-left: 2px;
}

.btn-disabled {
  opacity: 0.5;
  filter: grayscale(0.8);
  cursor: not-allowed;
}

.btn-interact {
  padding: 5px 10px !important;
  font-size: 13px !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: var(--border-radius-sm) !important;
  box-shadow: 1.5px 1.5px 0px 0px #2C1E1B !important;
  font-weight: 800 !important;
}

.btn-interact:hover {
  transform: translateY(-1px) !important;
  box-shadow: 2px 2px 0px 0px #2C1E1B !important;
}

.btn-interact:active {
  transform: translateY(1px) !important;
  box-shadow: 1px 1px 0px 0px #2C1E1B !important;
}

/* 淨資產卡片 */
.networth-card {
  background-color: var(--color-accent-gold) !important;
  text-align: center;
}

.networth-label {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.icon-net {
  color: var(--color-text-muted);
}

.networth-amount {
  font-size: 30px;
  font-weight: 800;
  margin: 10px 0;
  letter-spacing: -0.5px;
}

.negative-wealth {
  color: #FF5A5A !important;
}

.assets-debts-grid {
  display: flex;
  border-top: 1.5px dashed var(--color-border);
  margin-top: 10px;
  padding-top: 10px;
}

.grid-sub-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.grid-sub-item:first-child {
  border-right: 1.5px dashed var(--color-border);
}

.sub-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.sub-amount {
  font-size: 16px;
  font-weight: 800;
  margin-top: 2px;
}

.asset-green { color: #2C8C67; }
.liability-orange { color: #C66230; }

/* 本月收支與預算 */
.card-inner-title {
  font-size: 17px;
  font-weight: 800;
  margin-bottom: 12px;
}

.income-expense-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.cash-flow-box {
  flex: 1;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  box-shadow: var(--shadow-jelly-sm);
}

.income-box { background-color: var(--color-income); }
.expense-box { background-color: var(--color-expense); }

.flow-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.flow-icon {
  stroke-width: 3.5px;
}

.flow-amount {
  font-size: 19px;
  font-weight: 800;
  margin-top: 4px;
}

/* 預算進度條 */
.budget-progress-section {
  border-top: 1.5px dashed var(--color-border);
  padding-top: 14px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 6px;
}

.progress-ratio-text {
  color: var(--color-text-muted);
}

.budget-alert-text {
  font-size: 15px;
  font-weight: 800;
  color: #FF5A5A;
  margin-top: 6px;
  text-align: center;
}

/* 近期交易紀錄 */
.recent-transactions-section {
  padding-bottom: 10px !important;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.btn-view-all {
  padding: 4px 10px !important;
  font-size: 14px;
  background-color: var(--color-bg-warm) !important;
}

.empty-tx-placeholder {
  text-align: center;
  padding: 24px 0;
}

.empty-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.btn-go-add {
  font-size: 12px;
  background-color: var(--color-accent-gold) !important;
  gap: 6px;
}

.tx-list-cute {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tx-item-cute {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px !important;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.tx-left-side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tx-icon-circle {
  width: 32px;
  height: 32px;
  border: 1.5px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.tx-info-block {
  display: flex;
  flex-direction: column;
}

.tx-category-tag {
  font-size: 14px;
  font-weight: 800;
  white-space: normal;
  word-break: break-word;
  line-height: 1.3;
}

.tx-note {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.tx-account-info {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
}

.acct-name-pill {
  display: inline-block;
  vertical-align: middle;
  font-weight: 700;
  word-break: break-all;
}



.tx-details-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  margin-top: 1px;
  min-width: 0;
}

.tx-right-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.tx-amount-text {
  font-size: 17px;
  font-weight: 800;
}

.tx-date-small {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* 下拉選單過渡動畫 */
.fade-menu-enter-active,
.fade-menu-leave-active {
  transition: all 0.2s ease;
}
.fade-menu-enter-from,
.fade-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.tx-note-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  margin-top: 2px;
  min-width: 0;
}

.tx-creator-badge {
  font-size: 13px !important;
  font-weight: 800;
  color: var(--color-text-muted);
  background-color: var(--color-bg-warm);
  padding: 1px 6px !important;
  border-radius: 10px;
  line-height: 1.4;
  flex-shrink: 0;
}

/* 🏆 成就按鈕樣式 */
.btn-achievement {
  background-color: #FFF2CC !important;
  color: var(--color-text-dark) !important;
}

.btn-achievement:hover {
  background-color: var(--color-accent-gold) !important;
}

/* 成就彈窗 Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(44, 30, 27, 0.4); /* 手繪風深褐色透明背景 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  backdrop-filter: blur(4px);
  padding: 20px;
  box-sizing: border-box;
}

/* 成就彈窗本體 */
.achievement-modal {
  background-color: var(--color-bg-warm);
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  padding: 20px !important;
  overflow: visible;
  position: relative;
}

/* 彈窗 Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 2px dashed var(--color-border);
  padding-bottom: 10px;
}

.modal-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-dark);
  margin: 0;
}

.btn-close-circle {
  width: 28px;
  height: 28px;
  border-radius: 50% !important;
  border: var(--border-width) solid var(--color-border) !important;
  background-color: var(--color-expense) !important;
  color: var(--color-text-dark) !important;
  font-size: 18px !important;
  font-weight: 800 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 !important;
  box-shadow: 1.5px 1.5px 0px 0px #2C1E1B !important;
}

.btn-close-circle:active {
  transform: scale(0.9) !important;
}

/* 成就列表滾動區 */
.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 成就單個卡片 */
.achievement-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px !important;
  background-color: #FFFFFF !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  transition: all 0.2s ease;
}

/* 鎖定狀態 */
.ach-locked {
  background-color: #F5F5F5 !important;
  opacity: 0.75;
  filter: grayscale(0.9);
}

/* 徽章圖示 */
.ach-badge-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: var(--border-width) solid var(--color-border);
  background-color: var(--color-bg-warm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 1px 1px 0px 0px #2C1E1B;
}

.achievement-item:not(.ach-locked) .ach-badge-icon {
  background-color: #FFF2CC;
  animation: badgePulse 2s infinite ease-in-out;
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* 成就文字資訊 */
.ach-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.ach-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ach-desc {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* 標籤 */
.ach-unlocked-tag {
  font-size: 10px;
  background-color: var(--color-income);
  color: var(--color-text-dark);
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.ach-locked-tag {
  font-size: 10px;
  background-color: #E0E0E0;
  color: #757575;
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid #BDBDBD;
}

/* 彈窗過渡動畫 */
.fade-modal-enter-active,
.fade-modal-leave-active {
  transition: opacity 0.25s ease;
}

.fade-modal-enter-from,
.fade-modal-leave-to {
  opacity: 0;
}

.fade-modal-enter-active .achievement-modal {
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.fade-modal-leave-active .achievement-modal {
  animation: popOut 0.2s ease-in;
}

@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes popOut {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
}

/* ─── 🪄 逗貓棒互動系統特製樣式 ─── */
.board-teasing-active {
  cursor: none !important; /* 隱藏原生滑鼠指針，用可愛的懸浮道具代替 */
}

/* 手機觸控時仍隱藏滑鼠游標，且整張卡片禁止預設行為 */
.board-teasing-active * {
  touch-action: none;
}

/* 強烈扭屁股震動效果 */
.board-cat-wiggle-furious {
  animation: boardCatWiggleFurious 0.15s ease-in-out infinite;
}

@keyframes boardCatWiggleFurious {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(-1.5px, 0.5px) rotate(-0.5deg); }
  50% { transform: translate(1.5px, -0.5px) rotate(0.5deg); }
  75% { transform: translate(-0.5px, -1px) rotate(-0.3deg); }
}

/* 懸浮跟隨道具 */
.floating-teaser-wand {
  position: absolute;
  pointer-events: none;
  z-index: 999;
  transform: translate(-50%, -50%); /* 中心點對齊滑鼠 */
  transition: transform 0.04s ease-out;
}

/* 羽毛棒隨滑鼠稍微搖擺的動畫 */
.wand-type-feather {
  animation: featherWiggle 2.5s ease-in-out infinite alternate;
}

@keyframes featherWiggle {
  0% { transform: translate(-50%, -50%) rotate(-5deg); }
  100% { transform: translate(-50%, -50%) rotate(10deg); }
}

/* 雷射發光中心點 */
.laser-center-dot {
  width: 12px;
  height: 12px;
  background-color: #FF3B30;
  border-radius: 50%;
  border: 1.5px solid #FFFFFF;
  box-shadow: 0 0 10px #FF3B30, 0 0 20px #FF3B30;
  animation: laserPulse 0.4s ease-in-out infinite alternate;
}

@keyframes laserPulse {
  0% { transform: scale(0.9); box-shadow: 0 0 8px #FF3B30, 0 0 16px #FF3B30; }
  100% { transform: scale(1.1); box-shadow: 0 0 14px #FF3B30, 0 0 25px #FF3B30; }
}

/* 雷射擴散圈粒子樣式 */
.laser-ripple-ring {
  width: 24px;
  height: 24px;
  border: 2px solid #FF4B4B;
  border-radius: 50%;
  box-sizing: border-box;
  animation: laserRippleExpand 0.45s ease-out forwards;
}

@keyframes laserRippleExpand {
  0% { transform: scale(0.2); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}

/* 鈴鐺隨滑鼠稍微搖動 */
.wand-type-bell {
  animation: bellJingle 0.6s ease-in-out infinite alternate;
}

@keyframes bellJingle {
  0% { transform: translate(-50%, -50%) rotate(-12deg); }
  100% { transform: translate(-50%, -50%) rotate(8deg); }
}

/* 粒子容器與粒子 */
.teaser-particles-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 25;
  overflow: hidden;
}

.teaser-particle {
  pointer-events: none;
}

/* 興奮度進度條左上角膠囊樣式 */
.excitement-overlay {
  background-color: rgba(255, 255, 255, 0.92) !important;
  border: 1.5px solid var(--color-border);
  box-shadow: var(--shadow-jelly-sm);
  z-index: 32;
  backdrop-filter: blur(4px);
}

/* 興奮度進度條容器 */
.excitement-bar-container {
  position: absolute;
  bottom: 48px; /* 避開底部互動按鈕 */
  left: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.85);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 6px 10px;
  z-index: 28;
  box-shadow: var(--shadow-jelly-sm);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.excitement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.excitement-title {
  color: var(--color-text-muted);
}

.excitement-value {
  color: var(--color-expense);
  background: rgba(255, 107, 107, 0.1);
  padding: 0px 4px;
  border-radius: 4px;
}

.excitement-track {
  width: 100%;
  height: 8px;
  background-color: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.excitement-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFB7B2 0%, #FF9AA2 100%);
  border-radius: 4px;
  transition: width 0.08s ease-out;
}

.excitement-full-glow {
  background: linear-gradient(90deg, #FF8F4B 0%, #FF3B30 100%);
  animation: barPulse 0.4s ease-in-out infinite alternate;
}

@keyframes barPulse {
  0% { filter: brightness(1); }
  100% { filter: brightness(1.2) drop-shadow(0 0 2px rgba(255, 59, 48, 0.5)); }
}

.excitement-hint {
  font-size: 8px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-align: center;
}

/* 藥丸道具切換面板 */
.wand-selector {
  display: flex;
  background-color: rgba(255, 255, 255, 0.9);
  border: 1.5px solid var(--color-border);
  border-radius: 20px;
  padding: 2px;
  gap: 2px;
  box-shadow: var(--shadow-jelly-sm);
  margin-right: 6px;
}

.btn-wand-pill {
  border: none;
  background: none;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  padding: 4px 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.btn-wand-pill.active {
  background-color: var(--color-accent-gold);
  color: var(--color-text-dark);
  box-shadow: var(--shadow-jelly-sm);
}

.btn-wand-pill:active {
  transform: scale(0.9);
}

.btn-teaser-start {
  background-color: #C3B1E1 !important; /* 薰衣草紫色，與領圈呼應 */
  color: var(--color-text-dark) !important;
}

.btn-teaser-stop {
  background-color: #FFB4B4 !important; /* 溫馨馬卡龍粉紅 */
  color: var(--color-text-dark) !important;
}
</style>
