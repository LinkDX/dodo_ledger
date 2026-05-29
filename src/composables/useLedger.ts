import { ref, computed } from 'vue'
import type { Account, Transaction, RecurringTransaction, CatMood, Category, DodoCatProfile } from '../types'
import type { AtomicOp, BalanceDelta } from '../services/db'
import { useAuth } from './useAuth'
import { useAlert } from './useAlert'
import { getDatabaseService, addSystemLog } from '../services/db'
import { DEFAULT_CATEGORIES } from './useAuth'

// 核心響應式狀態 (Singleton 全域共享，維護同一個資產紀錄)
const accounts = ref<Account[]>([])
const transactions = ref<Transaction[]>([])
const recurringTransactions = ref<RecurringTransaction[]>([])
const categories = ref<Category[]>([])
const triggeredReports = ref<string[]>([]) // 逗逗貓待報告的週期記帳清單
const isDataLoaded = ref(false)
const addTxPrefilledDate = ref<string | null>(null)

// 抑制重新排序期間的 snapshot 回呼，防止中間態觸發畫面抖動
let isReordering = false

/** 依 sortOrder 升冪排列；無 sortOrder 的項目排至最後 */
const sortByOrder = <T extends { sortOrder?: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))

// 🐱 逗逗貓核心狀態
const catProfile = ref<DodoCatProfile | null>(null)
const temporaryMood = ref<CatMood | null>(null)
const temporarySpeech = ref<string | null>(null)
let interactionTimeoutId: any = null
let petClickTimestamps: number[] = [] // 摸摸點擊時間戳記，用於偵測 10 秒 50 次連點
let syncCatTimeout: any = null // 貓咪狀態同步防抖 Timer
let catProfileUnsubscribe: (() => void) | null = null // 貓咪狀態訂閱退訂函數
let disturbedClickCount = 0 // 凌晨點擊計數

// 🔒 即時同步訂閱控制器（多裝置即時同步）
let accountsUnsubscribe: (() => void) | null = null
let transactionsUnsubscribe: (() => void) | null = null
let recurringUnsubscribe: (() => void) | null = null
let categoriesUnsubscribe: (() => void) | null = null

// 預設貓咪狀態
const DEFAULT_CAT_PROFILE: DodoCatProfile = {
  level: 1,
  currentXP: 0,
  maxXP: 100,
  energy: {
    current: 10,
    max: 10,
    lastRefillAt: Date.now()
  },
  stats: {
    totalPets: 0,
    totalFeeds: 0,
    totalFish: 0,
    totalCans: 0,
    totalPlays: 0,
    streakDays: 0,
    lastInteractDate: '',
    dailyRecoveryCount: 0,
    lastRecoveryDate: ''
  },
  unlockedAchievementIds: []
}

export function useLedger() {
  const { currentProfile } = useAuth()
  const db = getDatabaseService()

  // 1. 📂 顯式資料載入方法
  const loadLedgerData = async () => {
    isDataLoaded.value = false
    const userId = currentProfile.value?.id || 'default_user'
    
    // 清除舊的訂閱
    if (catProfileUnsubscribe) { catProfileUnsubscribe(); catProfileUnsubscribe = null }
    if (accountsUnsubscribe) { accountsUnsubscribe(); accountsUnsubscribe = null }
    if (transactionsUnsubscribe) { transactionsUnsubscribe(); transactionsUnsubscribe = null }
    if (recurringUnsubscribe) { recurringUnsubscribe(); recurringUnsubscribe = null }
    if (categoriesUnsubscribe) { categoriesUnsubscribe(); categoriesUnsubscribe = null }

    const [accts, txs, recs, cats, catProf] = await Promise.all([
      db.getAccounts(),
      db.getTransactions(),
      db.getRecurring(),
      db.getCategories(),
      db.getCatProfile(userId)
    ])

    accounts.value = sortByOrder(accts)
    transactions.value = txs
    recurringTransactions.value = recs

    // 首次載入時自動以預設分類填充
    if (cats.length === 0) {
      categories.value = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
      await db.saveCategories(categories.value)
    } else {
      categories.value = sortByOrder(cats)
    }

    // 貓咪狀態處理
    if (!catProf) {
      catProfile.value = JSON.parse(JSON.stringify(DEFAULT_CAT_PROFILE))
      await db.saveCatProfile(userId, catProfile.value!)
    } else {
      catProfile.value = catProf
      if (catProfile.value.stats && catProfile.value.stats.totalPlays === undefined) {
        catProfile.value.stats.totalPlays = 0
      }
      // 執行自然恢復精力檢查
      checkNaturalEnergyRecovery()
    }

    // 執行一次性冷戰期與理財成就檢查
    checkColdWarAchievement()
    checkFinancialAchievements()

    // 🚀 啟動即時同步訂閱，確保多裝置資料 100% 一致
    catProfileUnsubscribe = db.subscribeCatProfile(userId, (newProfile) => {
      if (newProfile && newProfile.stats && newProfile.stats.totalPlays === undefined) {
        newProfile.stats.totalPlays = 0
      }
      if (JSON.stringify(newProfile) !== JSON.stringify(catProfile.value)) {
        console.log('[Dodo Ledger] 🐱 偵測到雲端貓咪狀態更新，已自動同步等級與 XP！')
        catProfile.value = newProfile
      }
    })

    // 🔒 訂閱帳戶集合即時變更（多裝置餘額同步）
    accountsUnsubscribe = db.subscribeCollection<Account>('accounts', (remoteAccounts) => {
      if (isReordering) return
      const sorted = sortByOrder(remoteAccounts)
      if (JSON.stringify(sorted) !== JSON.stringify(accounts.value)) {
        console.log('[Dodo Ledger] 💰 偵測到雲端帳戶資料更新，已自動同步！')
        accounts.value = sorted
      }
    })

    // 🔒 訂閱交易集合即時變更（多裝置交易同步）
    transactionsUnsubscribe = db.subscribeCollection<Transaction>('transactions', (remoteTxs) => {
      if (JSON.stringify(remoteTxs) !== JSON.stringify(transactions.value)) {
        console.log('[Dodo Ledger] 📝 偵測到雲端交易資料更新，已自動同步！')
        transactions.value = remoteTxs
      }
    })

    // 🔒 訂閱週期記帳集合即時變更
    recurringUnsubscribe = db.subscribeCollection<RecurringTransaction>('recurring', (remoteRecs) => {
      if (JSON.stringify(remoteRecs) !== JSON.stringify(recurringTransactions.value)) {
        console.log('[Dodo Ledger] 🔄 偵測到雲端週期記帳更新，已自動同步！')
        recurringTransactions.value = remoteRecs
      }
    })

    // 🔒 訂閱分類集合即時變更
    categoriesUnsubscribe = db.subscribeCollection<Category>('categories', (remoteCats) => {
      if (isReordering) return
      const sorted = sortByOrder(remoteCats)
      if (JSON.stringify(sorted) !== JSON.stringify(categories.value)) {
        console.log('[Dodo Ledger] 🏷️ 偵測到雲端分類資料更新，已自動同步！')
        categories.value = sorted
      }
    })

    isDataLoaded.value = true
    
    // 觸發週期性自動記帳的 Lazy-check
    await checkAndTriggerRecurring()
  }

  // 1.1 精力自然恢復邏輯 (每 30 分鐘 1 點)
  const checkNaturalEnergyRecovery = () => {
    if (!catProfile.value) return
    const now = Date.now()
    const lastRefill = catProfile.value.energy.lastRefillAt
    const diffMs = now - lastRefill
    const intervalMs = 30 * 60 * 1000 // 30 分鐘
    
    if (diffMs >= intervalMs) {
      const recoveryPoints = Math.floor(diffMs / intervalMs)
      if (recoveryPoints > 0) {
        catProfile.value.energy.current = Math.min(
          catProfile.value.energy.max,
          catProfile.value.energy.current + recoveryPoints
        )
        catProfile.value.energy.lastRefillAt = lastRefill + (recoveryPoints * intervalMs)
        syncCatProfile()
      }
    }
  }

  // 2. 清空全域資料方法 (一般共同記帳下不需要清空帳本，僅重置加載狀態)
  const clearLedgerData = () => {
    if (catProfileUnsubscribe) { catProfileUnsubscribe(); catProfileUnsubscribe = null }
    if (accountsUnsubscribe) { accountsUnsubscribe(); accountsUnsubscribe = null }
    if (transactionsUnsubscribe) { transactionsUnsubscribe(); transactionsUnsubscribe = null }
    if (recurringUnsubscribe) { recurringUnsubscribe(); recurringUnsubscribe = null }
    if (categoriesUnsubscribe) { categoriesUnsubscribe(); categoriesUnsubscribe = null }
    accounts.value = []
    transactions.value = []
    recurringTransactions.value = []
    categories.value = []
    triggeredReports.value = []
    catProfile.value = null
    isDataLoaded.value = false
  }

  // 3. 資料同步回資料庫的方法
  //    ⚠️ 全量寫入方法（saveAccounts / saveTransactions）僅用於初始化/批次匯入場景，
  //    日常操作一律使用原子 API（atomicBatchWrite / addDocument / updateDocument）

  const syncRecurring = async () => {
    await db.saveRecurring(recurringTransactions.value)
  }

  const syncCategories = async () => {
    await db.saveCategories(categories.value)
  }

  /**
   * 🔒 原子記帳操作：同時寫入交易文件 + 帳戶餘額增減，保證跨文件一致性。
   * 取代舊的 syncAccounts() + syncTransactions() 雙步驟模式。
   */
  const atomicWriteTransactionWithBalance = async (
    txOps: AtomicOp[],
    deltas: BalanceDelta[]
  ) => {
    const ops: AtomicOp[] = [...txOps]
    if (deltas.length > 0) {
      ops.push({ type: 'balanceDelta', deltas })
    }
    await db.atomicBatchWrite(ops)
    checkFinancialAchievements()
  }

  const syncCatProfile = async () => {
    const userId = currentProfile.value?.id || 'default_user'
    if (catProfile.value) {
      await db.saveCatProfile(userId, catProfile.value)
    }
  }

  const syncCatProfileDebounced = () => {
    if (syncCatTimeout) clearTimeout(syncCatTimeout)
    syncCatTimeout = setTimeout(async () => {
      const userId = currentProfile.value?.id || 'default_user'
      if (catProfile.value) {
        await db.saveCatProfile(userId, catProfile.value)
      }
    }, 1000)
  }

  // 4. 核心運算看板欄位 (Computed)
  
  // 總資產
  const totalAssets = computed(() => {
    return accounts.value
      .filter(a => a.type !== 'credit_card' && a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0)
  })

  // 總負債
  const totalLiabilities = computed(() => {
    const cardDebt = accounts.value
      .filter(a => a.type === 'credit_card')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0)
    
    const otherDebt = accounts.value
      .filter(a => a.type !== 'credit_card' && a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0)

    return cardDebt + otherDebt
  })

  // 淨資產
  const netWorth = computed(() => totalAssets.value - totalLiabilities.value)

  // 本月總收支與預算消耗
  const currentMonthPeriod = computed(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })

  // 本月總支出
  const monthlyExpense = computed(() => {
    const currentPeriod = currentMonthPeriod.value
    return transactions.value
      .filter(tx => {
        const txDate = new Date(tx.date)
        const y = txDate.getFullYear()
        const m = String(txDate.getMonth() + 1).padStart(2, '0')
        const period = `${y}-${m}`
        
        if (tx.creditCardDetails?.isInstallment) {
          return tx.creditCardDetails.billPeriod === currentPeriod
        }
        return tx.type === 'expense' && period === currentPeriod
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  })

  // 本月總收入
  const monthlyIncome = computed(() => {
    const currentPeriod = currentMonthPeriod.value
    return transactions.value
      .filter(tx => {
        const txDate = new Date(tx.date)
        const y = txDate.getFullYear()
        const m = String(txDate.getMonth() + 1).padStart(2, '0')
        const period = `${y}-${m}`
        return tx.type === 'income' && period === currentPeriod
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  })

  // 預算消耗比例
  const budgetRatio = computed(() => {
    const budget = currentProfile.value?.settings.monthlyBudget || 20000
    if (budget <= 0) return 0
    return monthlyExpense.value / budget
  })

  const dodoCatMood = computed<CatMood>(() => {
    if (temporaryMood.value) return temporaryMood.value
    const ratio = budgetRatio.value
    if (ratio >= 1.0) return 'crying'
    if (ratio >= 0.8) return 'scared'
    if (ratio >= 0.6) return 'nervous'
    return 'happy'
  })

  // 逗逗貓對話提示
  const dodoCatSpeech = computed(() => {
    if (temporarySpeech.value) return temporarySpeech.value

    if (triggeredReports.value.length > 0) {
      const firstReport = triggeredReports.value[0]
      return `喵～主人！趁您不在，我剛剛幫您處理了「${firstReport}」的週期扣款喔！喵嗚～`
    }

    const ratio = budgetRatio.value
    const percent = Math.round(ratio * 100)
    if (ratio >= 1.0) {
      return `嗚喵！！！這個月預算已經超支了啦 (${percent}%)！逗逗貓要把主人的信用卡藏起來了喵！哭哭 (ㄒoㄒ)`
    }
    if (ratio >= 0.8) {
      return `喵！主人才剛過一半，預算就已經花掉 ${percent}% 了！再花下去我們就只能吃土了喵！∑(O_O;)`
    }
    if (ratio >= 0.6) {
      return `喵嗚…預算已經花掉 ${percent}% 囉…主人最近花錢有點大方，逗逗貓有點小擔心罐罐不夠吃了喵…(・_・;)`
    }
    return `喵～這個月只花了 ${percent}% 的預算！主人真是理財高手！繼續保持，逗逗貓最愛您了喵～(❀◕ ▾ ◕)`
  })

  // 🏆 成就系統核心輔助函數

  // 解鎖成就
  const unlockAchievement = async (id: string, title: string, desc: string) => {
    if (!catProfile.value || catProfile.value.unlockedAchievementIds.includes(id)) return
    catProfile.value.unlockedAchievementIds.push(id)
    
    // 設計豐富的主人讚美庫
    const praises = [
      '主人真的太優秀了喵！逗逗貓在一旁看著覺得好崇拜您喔！🐾(❀◕ ▾ ◕)',
      '天啊！主人怎麼可以這麼有毅力又這麼棒！您是世界上最棒的主人喵！(=^·^=)',
      '嗚哇～主人又往前邁進了一大步！逗逗貓能陪在這麼厲害的主人身邊，真的好幸福喵！(>◡<)',
      '主人散發著閃閃發光的魅力喵！這都是主人努力應得的成果，逗逗貓為您瘋狂搖尾巴！🐾(〃＞◡＜〃)',
      '主人真的好溫柔又好有恆心喔，逗逗貓決定今晚要在主人懷裡呼嚕嚕一整晚來獎勵主人喵！(ᴗ̤ . ᴗ̤ )'
    ]
    
    // 根據成就類型給予特定的稱讚
    let specificPraise = praises[Math.floor(Math.random() * praises.length)]
    
    if (id.startsWith('pet_')) {
      specificPraise = '主人摸我的手法真的太溫柔、太舒服了喵！這滿滿的愛意逗逗貓全部都收到了喔！主人是世界上最棒的暖心鏟屎官喵！🐾(=^·^=)'
    } else if (id.startsWith('feed_')) {
      specificPraise = '主人把我養得白白胖胖的，真的太幸福了喵！謝謝主人總是給我最美味的款待，主人是全世界最大方、最貼心的飼養員喵！(๑＞ڡ＜๑)'
    } else if (id.startsWith('streak_')) {
      specificPraise = '連續這麼多天都來陪我，主人真的太有毅力了喵！每天能看到主人是我最期待的事，謝謝主人的長情陪伴，我們要一直在一起喔喵！💖(ᴗ̤ . ᴗ̤ )'
    } else if (id === 'combo_50') {
      specificPraise = '天啊主人！您的手指是裝了火箭發動機嗎？這手速簡直是幻影喵！⚡(〃＞◡＜〃) 逗逗貓被摸得整隻貓都要飛起來了喵！主人太強了！'
    } else if (id === 'wealth_100k' || id === 'saving_master' || id === 'zero_debt' || id === 'saver_10' || id === 'debt_buster') {
      specificPraise = '哇！主人在理財上簡直是絕世天才喵！看著這些閃亮亮的資產數據，主人真的太有智慧了！逗逗貓要把您當成一輩子的偶像喵！💎💰(=^·^=)'
    }

    temporarySpeech.value = `🎉 主人！您剛剛解鎖了【${title}】成就喵！快看看逗逗貓對您的悄悄話～🐾`
    temporaryMood.value = 'happy'

    const { showAlert } = useAlert()
    showAlert(
      `「${desc}」\n\n🐱 逗逗貓對主人的悄悄話：\n\n「${specificPraise}」`,
      `🎉 恭喜解鎖成就：【${title}】！`
    )
    
    console.log(`🎉 解鎖成就：【${title}】 - ${desc}`)
    await syncCatProfile()
  }

  // 檢查次數類成就（摸摸、餵食、連續天數）
  const checkCountAchievements = () => {
    if (!catProfile.value) return
    const { totalPets, totalFeeds, streakDays } = catProfile.value.stats
    const totalPlays = catProfile.value.stats.totalPlays || 0
    
    // 摸摸大師系列 (檢討後門檻提升，以配合無 CD 機制)
    if (totalPets >= 100) unlockAchievement('pet_100', '初級鏟屎官', '累計摸摸 100 次。')
    if (totalPets >= 500) unlockAchievement('pet_500', '得心應手', '累計摸摸 500 次。')
    if (totalPets >= 2000) unlockAchievement('pet_2000', '貓咪按摩師', '累計摸摸 2000 次。')
    if (totalPets >= 10000) unlockAchievement('pet_10000', '皇家擼貓聖手', '累計摸摸 10000 次。')

    // 米其林飼養員系列 (檢討後門檻提升，以配合無 CD 機制)
    if (totalFeeds >= 50) unlockAchievement('feed_50', '見習飼養員', '累計餵食 50 次。')
    if (totalFeeds >= 200) unlockAchievement('feed_200', '特級主廚', '累計餵食 200 次。')
    if (totalFeeds >= 1000) unlockAchievement('feed_1000', '皇家御膳房總管', '累計餵食 1000 次。')

    // 逗貓棒系列
    if (totalPlays >= 10) unlockAchievement('play_10', '捕風捉影', '累計使用逗貓棒玩耍 10 次。')
    if (totalPlays >= 50) unlockAchievement('play_50', '飛簷走壁', '累計使用逗貓棒玩耍 50 次。')
    if (totalPlays >= 200) unlockAchievement('play_200', '訓貓大師', '累計使用逗貓棒玩耍 200 次。')

    // 長情陪伴系列
    if (streakDays >= 3) unlockAchievement('streak_3', '三日溫存', '連續 3 天陪伴逗逗貓。')
    if (streakDays >= 7) unlockAchievement('streak_7', '全職貓奴', '連續 7 天陪伴逗逗貓。')
    if (streakDays >= 30) unlockAchievement('streak_30', '終身伴侶', '連續 30 天陪伴逗逗貓。')
  }

  // 檢查理財類成就
  const checkFinancialAchievements = () => {
    if (!catProfile.value) return

    // 1. 金庫滿盈 (總資產 >= 100,000)
    if (totalAssets.value >= 100000) {
      unlockAchievement('wealth_100k', '金庫滿盈', '個人總資產首次突破或達到 TWD $100,000 大關！')
    }

    // 2. 無債一身輕 (淨資產為正值，且所有信用卡負債餘額皆為 0)
    const cardDebt = accounts.value
      .filter(a => a.type === 'credit_card')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0)
    if (netWorth.value > 0 && cardDebt === 0) {
      unlockAchievement('zero_debt', '無債一身輕', '個人淨資產為正值，且所有信用卡負債皆已全數清空！')
    }

    // 3. 存錢大師 (當月收入大於支出的兩倍)
    if (monthlyIncome.value > 0 && monthlyExpense.value > 0 && monthlyIncome.value >= monthlyExpense.value * 2) {
      unlockAchievement('saving_master', '存錢大師', '當月記帳「收入」大於「支出」的兩倍。')
    }

    // 4. 省錢達人 (當月總支出低於理財預算的 10%)
    const budget = currentProfile.value?.settings?.monthlyBudget || 0
    if (budget > 0 && monthlyExpense.value > 0 && monthlyExpense.value < budget * 0.1) {
      unlockAchievement('saver_10', '省錢達人', '當月總支出低於理財預算的 10%。')
    }
  }

  // 檢查冷戰期成就 (超過 7 天未上線)
  const checkColdWarAchievement = () => {
    if (!catProfile.value) return
    const lastInteract = catProfile.value.stats.lastInteractDate
    if (lastInteract) {
      const todayStr = new Date().toISOString().split('T')[0]
      const lastDate = new Date(lastInteract)
      const todayDate = new Date(todayStr)
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > 7 && !catProfile.value.unlockedAchievementIds.includes('cold_war')) {
        unlockAchievement('cold_war', '冷戰期', '超過 7 天未開啟 App 後重新回來陪伴。')
      }
    }
  }

  // 5. 輔助函數：計算信用卡的帳單歸屬月份
  const calculateBillPeriod = (dateMs: number, billingCycleDate: number): string => {
    const date = new Date(dateMs)
    const y = date.getFullYear()
    const m = date.getMonth()
    const d = date.getDate()

    let targetYear = y
    let targetMonth = m

    if (d > billingCycleDate) {
      targetMonth += 1
      if (targetMonth > 11) {
        targetMonth = 0
        targetYear += 1
      }
    }

    const finalMonthStr = String(targetMonth + 1).padStart(2, '0')
    return `${targetYear}-${finalMonthStr}`
  }

  const getCreditCardAccount = (accountId?: string) => {
    if (!accountId) return undefined
    return accounts.value.find(
      (account): account is Account => account.id === accountId && account.type === 'credit_card'
    )
  }

  const getBillPeriodForCard = (cardId: string, dateMs: number = Date.now()) => {
    const cardAcct = getCreditCardAccount(cardId)
    if (!cardAcct?.cardDetails) return null
    return calculateBillPeriod(dateMs, cardAcct.cardDetails.billingCycleDate)
  }

  const getCreditCardBillPeriod = (tx: Pick<Transaction, 'type' | 'fromAccountId' | 'date' | 'creditCardDetails'>) => {
    if (tx.type !== 'expense') {
      return tx.creditCardDetails?.billPeriod || null
    }

    if (tx.creditCardDetails?.billPeriod) {
      return tx.creditCardDetails.billPeriod
    }

    if (!tx.fromAccountId) return null
    return getBillPeriodForCard(tx.fromAccountId, tx.date)
  }

  // 6. 記帳核心方法（🔒 原子操作防衝突版本）
  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdBy' | 'createdByAvatar'>) => {
    const txId = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4)
    const creatorName = currentProfile.value?.name || '未知主人'
    const creatorAvatar = currentProfile.value?.avatar || '🐱'

    // a. 轉帳手續費處理 (手續費支出同樣記名)
    if (txData.type === 'transfer' && txData.fee && txData.fee > 0) {
      const feeTx: Transaction = {
        id: 'tx_fee_' + Date.now() + Math.random().toString(36).substr(2, 4),
        type: 'expense',
        amount: txData.fee,
        category: '居住生活',
        subCategory: '網路電話',
        fromAccountId: txData.fromAccountId,
        date: txData.date,
        note: `轉帳手續費 (轉至 ${accounts.value.find(a => a.id === txData.toAccountId)?.name || '未知帳戶'})`,
        tags: ['手續費'],
        createdBy: '系統自動',
        createdByAvatar: '⚙️',
        updatedAt: Date.now()
      }
      transactions.value.push(feeTx)
      
      // 樂觀更新本地餘額
      const fromAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      if (fromAcct) fromAcct.balance -= txData.fee

      // 🔒 原子寫入：手續費交易 + 餘額增減
      const feeDeltas: BalanceDelta[] = txData.fromAccountId
        ? [{ accountId: txData.fromAccountId, delta: -txData.fee }]
        : []
      await atomicWriteTransactionWithBalance(
        [{ type: 'addTransaction', transaction: feeTx }],
        feeDeltas
      )
    }

    const creditCardBillPeriod =
      txData.type === 'expense' && txData.fromAccountId
        ? getBillPeriodForCard(txData.fromAccountId, txData.date)
        : null

    // b. 信用卡分期付款處理 (分期各期數明細同樣記名)
    if (txData.type === 'expense' && txData.creditCardDetails?.isInstallment) {
      const cardAcct = getCreditCardAccount(txData.fromAccountId)
      if (cardAcct && cardAcct.type === 'credit_card' && cardAcct.cardDetails) {
        const totalAmount = txData.amount
        const T = txData.creditCardDetails.installmentTerm
        
        // 樂觀更新本地餘額
        cardAcct.balance -= totalAmount

        const baseShare = Math.floor(totalAmount / T)
        const firstShare = totalAmount - (baseShare * (T - 1))
        
        const installmentTxs: Transaction[] = []
        for (let i = 1; i <= T; i++) {
          const installmentAmount = (i === 1) ? firstShare : baseShare
          
          const billDate = new Date(txData.date)
          billDate.setMonth(billDate.getMonth() + (i - 1))
          const currentBillPeriod = calculateBillPeriod(billDate.getTime(), cardAcct.cardDetails.billingCycleDate)

          const installmentTx: Transaction = {
            id: `${txId}_inst_${i}`,
            type: 'expense',
            amount: installmentAmount,
            category: txData.category,
            subCategory: txData.subCategory,
            fromAccountId: txData.fromAccountId,
            date: txData.date,
            note: `${txData.note} (分期 ${i}/${T})`,
            tags: [...txData.tags, '分期'],
            createdBy: creatorName,
            createdByAvatar: creatorAvatar,
            creditCardDetails: {
              isInstallment: true,
              installmentTerm: T,
              currentInstallment: i,
              billPeriod: currentBillPeriod
            },
            updatedAt: Date.now()
          }
          installmentTxs.push(installmentTx)
          transactions.value.push(installmentTx)
        }
        
        // 🔒 原子寫入：所有分期交易 + 信用卡餘額一次扣完
        await atomicWriteTransactionWithBalance(
          installmentTxs.map(tx => ({ type: 'addTransaction' as const, transaction: tx })),
          [{ accountId: cardAcct.id, delta: -totalAmount }]
        )
        
        await addSystemLog(
          creatorName,
          creatorAvatar,
          'add_expense_installment',
          `新增分期支出：${txData.category}/${txData.subCategory || '未分類'} 總金額 ${txData.amount} 元 (分 ${T} 期，扣款卡片: ${cardAcct.name})`
        )
        return
      }
    }

    // c. 一般交易餘額增減邏輯 (記名寫入)
    const newTx: Transaction = { 
      ...txData, 
      id: txId,
      createdBy: creatorName,
      createdByAvatar: creatorAvatar,
      updatedAt: Date.now()
    }

    if (txData.type === 'expense' && creditCardBillPeriod) {
      newTx.creditCardDetails = {
        isInstallment: false,
        installmentTerm: 1,
        currentInstallment: 1,
        ...txData.creditCardDetails,
        billPeriod: creditCardBillPeriod
      }
    }

    // 樂觀更新本地狀態
    transactions.value.push(newTx)

    // 計算餘額增減量
    const deltas: BalanceDelta[] = []
    if (txData.type === 'expense') {
      const fromAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      if (fromAcct) {
        fromAcct.balance -= txData.amount
        deltas.push({ accountId: txData.fromAccountId!, delta: -txData.amount })
      }
    } else if (txData.type === 'income') {
      const toAcct = accounts.value.find(a => a.id === txData.toAccountId)
      if (toAcct) {
        toAcct.balance += txData.amount
        deltas.push({ accountId: txData.toAccountId!, delta: txData.amount })
      }
    } else if (txData.type === 'transfer') {
      const fromAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      const toAcct = accounts.value.find(a => a.id === txData.toAccountId)
      if (fromAcct) {
        fromAcct.balance -= txData.amount
        deltas.push({ accountId: txData.fromAccountId!, delta: -txData.amount })
      }
      if (toAcct) {
        toAcct.balance += txData.amount
        deltas.push({ accountId: txData.toAccountId!, delta: txData.amount })
      }
    }

    // 🔒 原子寫入：交易文件 + 帳戶餘額增減在同一批次完成
    await atomicWriteTransactionWithBalance(
      [{ type: 'addTransaction', transaction: newTx }],
      deltas
    )



    const fromAcctName = accounts.value.find(a => a.id === txData.fromAccountId)?.name || '未知帳戶'
    const toAcctName = accounts.value.find(a => a.id === txData.toAccountId)?.name || '未知帳戶'

    if (txData.type === 'expense') {
      await addSystemLog(
        creatorName,
        creatorAvatar,
        'add_expense',
        `新增支出：${txData.category}/${txData.subCategory || '未分類'} ${txData.amount} 元 (扣款帳戶: ${fromAcctName})`
      )
    } else if (txData.type === 'income') {
      await addSystemLog(
        creatorName,
        creatorAvatar,
        'add_income',
        `新增收入：${txData.category}/${txData.subCategory || '未分類'} ${txData.amount} 元 (存入帳戶: ${toAcctName})`
      )
    } else if (txData.type === 'transfer') {
      await addSystemLog(
        creatorName,
        creatorAvatar,
        'add_transfer',
        `帳戶轉帳：從 ${fromAcctName} 轉至 ${toAcctName} ${txData.amount} 元${txData.fee ? ` (手續費 ${txData.fee} 元)` : ''}`
      )
    }
  }

  // 7. 刪除交易（🔒 原子操作防衝突版本）
  const deleteTransaction = async (txId: string) => {
    const idx = transactions.value.findIndex(tx => tx.id === txId)
    if (idx === -1) return

    const tx = transactions.value[idx]
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'

    if (tx.creditCardDetails?.isInstallment) {
      const baseTxId = txId.split('_inst_')[0]
      const relatedInsts = transactions.value.filter(t => t.id.startsWith(baseTxId))
      
      const totalAmount = relatedInsts.reduce((sum, t) => sum + t.amount, 0)
      const cardAcct = accounts.value.find(a => a.id === tx.fromAccountId)
      
      // 樂觀更新本地
      if (cardAcct) cardAcct.balance += totalAmount
      transactions.value = transactions.value.filter(t => !t.id.startsWith(baseTxId))

      // 🔒 原子寫入：刪除所有分期交易 + 回退信用卡餘額
      const deleteOps: AtomicOp[] = relatedInsts.map(t => ({
        type: 'deleteTransaction' as const,
        transactionId: t.id
      }))
      const deltas: BalanceDelta[] = tx.fromAccountId
        ? [{ accountId: tx.fromAccountId, delta: totalAmount }]
        : []
      await atomicWriteTransactionWithBalance(deleteOps, deltas)

      await addSystemLog(
        operatorName,
        operatorAvatar,
        'delete_expense_installment',
        `刪除分期支出：${tx.category}/${tx.subCategory || '未分類'} 總金額 ${totalAmount} 元`
      )
    } else {
      // 計算餘額回退量
      const deltas: BalanceDelta[] = []
      const deleteOps: AtomicOp[] = [{ type: 'deleteTransaction', transactionId: txId }]

      if (tx.type === 'expense') {
        const fromAcct = accounts.value.find(a => a.id === tx.fromAccountId)
        if (fromAcct) {
          fromAcct.balance += tx.amount
          deltas.push({ accountId: tx.fromAccountId!, delta: tx.amount })
        }
      } else if (tx.type === 'income') {
        const toAcct = accounts.value.find(a => a.id === tx.toAccountId)
        if (toAcct) {
          toAcct.balance -= tx.amount
          deltas.push({ accountId: tx.toAccountId!, delta: -tx.amount })
        }
      } else if (tx.type === 'transfer') {
        const fromAcct = accounts.value.find(a => a.id === tx.fromAccountId)
        const toAcct = accounts.value.find(a => a.id === tx.toAccountId)
        
        // 同時刪除關聯手續費交易
        if (tx.fee && tx.fee > 0) {
          const feeTxIdx = transactions.value.findIndex(t => t.id === 'tx_fee_' + tx.id.replace('tx_', ''))
          if (feeTxIdx !== -1) {
            const feeTx = transactions.value[feeTxIdx]
            if (fromAcct) {
              fromAcct.balance += feeTx.amount
              deltas.push({ accountId: tx.fromAccountId!, delta: feeTx.amount })
            }
            transactions.value.splice(feeTxIdx, 1)
            deleteOps.push({ type: 'deleteTransaction', transactionId: feeTx.id })
          }
        }

        if (fromAcct) {
          fromAcct.balance += tx.amount
          deltas.push({ accountId: tx.fromAccountId!, delta: tx.amount })
        }
        if (toAcct) {
          toAcct.balance -= tx.amount
          deltas.push({ accountId: tx.toAccountId!, delta: -tx.amount })
        }
      }

      transactions.value.splice(idx, 1)

      // 🔒 原子寫入：刪除交易 + 回退帳戶餘額
      await atomicWriteTransactionWithBalance(deleteOps, deltas)

      await addSystemLog(
        operatorName,
        operatorAvatar,
        'delete_transaction',
        `刪除${tx.type === 'expense' ? '支出' : tx.type === 'income' ? '收入' : '轉帳'}：${tx.category}/${tx.subCategory || '未分類'} ${tx.amount} 元`
      )
    }
  }

  // 8. 信用卡一鍵繳款（🔒 原子操作防衝突版本）
  const payCreditCardBill = async (cardId: string, linkedBankId: string, billPeriod: string) => {
    const cardAcct = accounts.value.find(a => a.id === cardId)
    const bankAcct = accounts.value.find(a => a.id === linkedBankId)
    
    if (!cardAcct || cardAcct.type !== 'credit_card' || !bankAcct) return

    const billAmount = transactions.value
      .filter(tx => tx.fromAccountId === cardId && getCreditCardBillPeriod(tx) === billPeriod)
      .reduce((sum, tx) => sum + tx.amount, 0)

    if (billAmount <= 0) return

    // 樂觀更新本地
    bankAcct.balance -= billAmount
    bankAcct.updatedAt = Date.now()
    cardAcct.balance += billAmount
    cardAcct.updatedAt = Date.now()

    const payTx: Transaction = {
      id: 'tx_pay_' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'transfer',
      amount: billAmount,
      category: '轉帳',
      fromAccountId: linkedBankId,
      toAccountId: cardId,
      date: Date.now(),
      note: `繳納信用卡 ${billPeriod} 帳單`,
      tags: ['信用卡繳款'],
      createdBy: currentProfile.value?.name || '系統自動',
      createdByAvatar: currentProfile.value?.avatar || '🐱',
      updatedAt: Date.now()
    }
    transactions.value.push(payTx)

    // 🔒 原子寫入：繳款交易 + 銀行帳戶扣款 + 信用卡餘額加回
    await atomicWriteTransactionWithBalance(
      [{ type: 'addTransaction', transaction: payTx }],
      [
        { accountId: linkedBankId, delta: -billAmount },
        { accountId: cardId, delta: billAmount }
      ]
    )

    if (billAmount >= 10000) {
      unlockAchievement('debt_buster', '負債剋星', '單筆還清信用卡款項超過 TWD $10,000。')
    }

    await addSystemLog(
      currentProfile.value?.name || '系統自動',
      currentProfile.value?.avatar || '⚙️',
      'pay_credit_card',
      `繳納信用卡帳單：帳本「${cardAcct.name}」已使用「${bankAcct.name}」繳納 ${billPeriod} 帳單共 ${billAmount} 元`
    )
  }

  // 9. 週期自動記帳 Lazy-check 機制（🔒 防重複執行：使用 claimDocument 原子搶佔）
  const checkAndTriggerRecurring = async () => {
    if (!currentProfile.value) return
    
    const now = Date.now()
    let hasTriggered = false
    triggeredReports.value = []

    for (const rec of recurringTransactions.value) {
      if (!rec.isActive) continue

      let nextRun = rec.nextExecutionDate
      let triggerCount = 0

      while (now >= nextRun) {
        const autoTx: Transaction = {
          id: `tx_auto_${rec.id}_${nextRun}`,
          type: rec.type as any,
          amount: rec.amount,
          category: rec.category,
          subCategory: rec.subCategory,
          fromAccountId: rec.fromAccountId,
          date: nextRun,
          note: `${rec.title} (自動扣款)`,
          tags: ['定期定額', '自動記帳'],
          isRecurring: true,
          recurringId: rec.id,
          createdBy: '逗逗貓',
          createdByAvatar: '🐱',
          updatedAt: Date.now()
        }

        // 🔒 防重複執行：只有首個搶到文件的裝置才執行餘額扣減
        const claimed = await db.claimDocument('transactions', autoTx)
        
        if (claimed) {
          triggerCount++
          transactions.value.push(autoTx)

          // 樂觀更新本地
          const acct = accounts.value.find(a => a.id === rec.fromAccountId)
          if (acct) {
            acct.balance -= rec.amount
            acct.updatedAt = Date.now()
          }

          // 🔒 原子扣減餘額（與交易文件在不同批次，但 claimDocument 保證只執行一次）
          await db.atomicBatchWrite([
            { type: 'balanceDelta', deltas: [{ accountId: rec.fromAccountId, delta: -rec.amount }] }
          ])
        }

        const date = new Date(nextRun)
        if (rec.frequency === 'daily') {
          date.setDate(date.getDate() + rec.interval)
        } else if (rec.frequency === 'weekly') {
          date.setDate(date.getDate() + (rec.interval * 7))
        } else if (rec.frequency === 'monthly') {
          date.setMonth(date.getMonth() + rec.interval)
        }
        nextRun = date.getTime()
      }

      if (triggerCount > 0) {
        rec.nextExecutionDate = nextRun
        triggeredReports.value.push(`${rec.title} (x${triggerCount})`)
        hasTriggered = true

        // 🔒 原子更新週期記帳的 nextExecutionDate
        await db.updateDocument<RecurringTransaction>('recurring', rec.id, { nextExecutionDate: nextRun })

        const fromAcctName = accounts.value.find(a => a.id === rec.fromAccountId)?.name || '未知帳戶'
        await addSystemLog(
          '逗逗貓',
          '🐱',
          'auto_recurring',
          `自動週期扣款：執行「${rec.title}」自動扣款 ${rec.amount * triggerCount} 元 (扣款帳戶: ${fromAcctName}${triggerCount > 1 ? `，共扣款 ${triggerCount} 次` : ''})`
        )
      }
    }

    if (hasTriggered) {
      // 📱 原生系統本地通知 (手機 App 環境專用，動態導入以兼顧 Web 端相容性)
      if (typeof window !== 'undefined' && triggeredReports.value.length > 0) {
        import('@capacitor/core').then(({ Capacitor }) => {
          if (Capacitor.isNativePlatform()) {
            import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
              LocalNotifications.requestPermissions().then((permission) => {
                if (permission.display === 'granted') {
                  const reportSummary = triggeredReports.value.join('、')
                  LocalNotifications.schedule({
                    notifications: [
                      {
                        title: '🐱 逗逗貓理財報告',
                        body: `喵～主人！剛剛我趁您不在，幫您付了 ${reportSummary} 喔！`,
                        id: Math.floor(Math.random() * 1000000),
                        schedule: { at: new Date(Date.now() + 500) },
                        sound: 'beep.wav'
                      }
                    ]
                  })
                }
              })
            })
          }
        })
      }
      
      setTimeout(() => {
        triggeredReports.value = []
      }, 8000)
    }
  }

  // 10. 帳戶管理方法（🔒 使用 per-document 原子操作）
  const addAccount = async (acctData: Omit<Account, 'id' | 'createdAt'>) => {
    const newAcct: Account = {
      ...acctData,
      id: 'acct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    accounts.value.push(newAcct)
    await db.addDocument('accounts', newAcct)
  }

  const deleteAccount = async (acctId: string) => {
    accounts.value = accounts.value.filter(a => a.id !== acctId)
    const relatedTxIds = transactions.value
      .filter(tx => tx.fromAccountId === acctId || tx.toAccountId === acctId)
      .map(tx => tx.id)
    transactions.value = transactions.value.filter(tx => tx.fromAccountId !== acctId && tx.toAccountId !== acctId)
    
    // 逐一刪除文件，不覆蓋其他裝置新增的文件
    await db.deleteDocument('accounts', acctId)
    for (const txId of relatedTxIds) {
      await db.deleteDocument('transactions', txId)
    }
  }

  const editAccount = async (acctId: string, updated: Partial<Account>) => {
    const idx = accounts.value.findIndex(a => a.id === acctId)
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...updated, updatedAt: Date.now() }
      // 🔒 只更新單一文件的變更欄位（merge 模式），不影響其他裝置的 balance 增減
      await db.updateDocument('accounts', acctId, { ...updated, updatedAt: Date.now() })
    }
  }

  /** 使用者拖曳排序帳戶，新順序以 sortOrder 欄位持久化 */
  const reorderAccounts = async (newOrder: Account[]) => {
    isReordering = true
    accounts.value = newOrder
    await Promise.all(
      newOrder.map((acct, idx) =>
        db.updateDocument<Account>('accounts', acct.id, { sortOrder: idx })
      )
    )
    isReordering = false
  }

  /** 使用者拖曳排序分類（type 限定：只調整同類型的順序），持久化 sortOrder */
  const reorderCategories = async (newOrder: Category[], type: 'expense' | 'income') => {
    isReordering = true
    const withSortOrder = newOrder.map((cat, idx) => ({ ...cat, sortOrder: idx }))
    const others = categories.value.filter(c => c.type !== type)
    categories.value = [...others, ...withSortOrder]
    await syncCategories()
    isReordering = false
  }

  /** 使用者拖曳排序某主分類底下的子分類 */
  const reorderSubCategories = async (catId: string, newSubs: string[]) => {
    const cat = categories.value.find(c => c.id === catId)
    if (!cat) return
    cat.subCategories = newSubs
    await syncCategories()
  }

  // editTransaction（🔒 原子操作防衝突版本）：支援修改 note/date/category/subCategory/amount 等欄位
  // 若金額或帳戶發生變動，以 delta 方式原子回退舊餘額並套用新值
  const editTransaction = async (txId: string, updated: Partial<Pick<Transaction, 'amount' | 'note' | 'date' | 'category' | 'subCategory' | 'fromAccountId' | 'toAccountId'>>) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    const idx = transactions.value.findIndex(tx => tx.id === txId)
    if (idx === -1) return

    const old = transactions.value[idx]
    const deltas: BalanceDelta[] = []

    // 計算回退舊餘額的 delta
    if (old.type === 'expense' && old.fromAccountId) {
      deltas.push({ accountId: old.fromAccountId, delta: old.amount })
      const acct = accounts.value.find(a => a.id === old.fromAccountId)
      if (acct) acct.balance += old.amount
    } else if (old.type === 'income' && old.toAccountId) {
      deltas.push({ accountId: old.toAccountId, delta: -old.amount })
      const acct = accounts.value.find(a => a.id === old.toAccountId)
      if (acct) acct.balance -= old.amount
    } else if (old.type === 'transfer') {
      if (old.fromAccountId) {
        deltas.push({ accountId: old.fromAccountId, delta: old.amount })
        const acct = accounts.value.find(a => a.id === old.fromAccountId)
        if (acct) acct.balance += old.amount
      }
      if (old.toAccountId) {
        deltas.push({ accountId: old.toAccountId, delta: -old.amount })
        const acct = accounts.value.find(a => a.id === old.toAccountId)
        if (acct) acct.balance -= old.amount
      }
    }

    // 合併更新欄位
    const merged: Transaction = { ...old, ...updated, updatedAt: Date.now() }
    transactions.value[idx] = merged

    // 計算套用新餘額的 delta
    if (merged.type === 'expense' && merged.fromAccountId) {
      deltas.push({ accountId: merged.fromAccountId, delta: -merged.amount })
      const acct = accounts.value.find(a => a.id === merged.fromAccountId)
      if (acct) acct.balance -= merged.amount
    } else if (merged.type === 'income' && merged.toAccountId) {
      deltas.push({ accountId: merged.toAccountId, delta: merged.amount })
      const acct = accounts.value.find(a => a.id === merged.toAccountId)
      if (acct) acct.balance += merged.amount
    } else if (merged.type === 'transfer') {
      if (merged.fromAccountId) {
        deltas.push({ accountId: merged.fromAccountId, delta: -merged.amount })
        const acct = accounts.value.find(a => a.id === merged.fromAccountId)
        if (acct) acct.balance -= merged.amount
      }
      if (merged.toAccountId) {
        deltas.push({ accountId: merged.toAccountId, delta: merged.amount })
        const acct = accounts.value.find(a => a.id === merged.toAccountId)
        if (acct) acct.balance += merged.amount
      }
    }

    // 🔒 原子寫入：更新交易文件 + 套用餘額差值
    await atomicWriteTransactionWithBalance(
      [{ type: 'updateTransaction', transactionId: txId, data: merged }],
      deltas
    )

    await addSystemLog(
      operatorName,
      operatorAvatar,
      'edit_transaction',
      `編輯${merged.type === 'expense' ? '支出' : merged.type === 'income' ? '收入' : '轉帳'}：${merged.category}/${merged.subCategory || '未分類'} ${merged.amount} 元`
    )
  }

  // 11. 週期性記帳設定管理
  const addRecurring = async (recData: Omit<RecurringTransaction, 'id' | 'isActive'>) => {
    const newRec: RecurringTransaction = {
      ...recData,
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      isActive: true
    }
    recurringTransactions.value.push(newRec)
    await syncRecurring()
    await checkAndTriggerRecurring()

    // 解鎖週期自動記帳成就 (貓咪保險箱)
    unlockAchievement('cat_vault', '貓咪保險箱', '成功建立並啟用至少一個「週期性自動記帳」設定項目。')
  }

  const toggleRecurringActive = async (recId: string) => {
    const found = recurringTransactions.value.find(r => r.id === recId)
    if (found) {
      found.isActive = !found.isActive
      await syncRecurring()
    }
  }

  const deleteRecurring = async (recId: string) => {
    recurringTransactions.value = recurringTransactions.value.filter(r => r.id !== recId)
    await syncRecurring()
  }

  // 12. 🐾 分類管理方法 (新增 / 刪除主分類 / 子分類)
  const addCategory = async (catData: Omit<Category, 'id'>) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    const newCat: Category = {
      ...catData,
      id: 'cat_custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    }
    categories.value.push(newCat)
    await syncCategories()
    await addSystemLog(operatorName, operatorAvatar, 'update_categories', `新增主分類「${newCat.name}」`)
  }

  const deleteCategory = async (catId: string) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    const cat = categories.value.find(c => c.id === catId)
    if (!cat) return
    categories.value = categories.value.filter(c => c.id !== catId)
    await syncCategories()
    await addSystemLog(operatorName, operatorAvatar, 'update_categories', `刪除主分類「${cat.name}」及其所有子分類`)
  }

  const addSubCategory = async (catId: string, subName: string) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    const cat = categories.value.find(c => c.id === catId)
    if (!cat || cat.subCategories.includes(subName)) return
    cat.subCategories.push(subName)
    await syncCategories()
    await addSystemLog(operatorName, operatorAvatar, 'update_categories', `在「${cat.name}」下新增子分類「${subName}」`)
  }

  const deleteSubCategory = async (catId: string, subName: string) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    const cat = categories.value.find(c => c.id === catId)
    if (!cat) return
    cat.subCategories = cat.subCategories.filter(s => s !== subName)
    await syncCategories()
    await addSystemLog(operatorName, operatorAvatar, 'update_categories', `從「${cat.name}」刪除子分類「${subName}」`)
  }

  // 12.5 🐾 編輯分類與繳費檢測方法
  const editCategory = async (catId: string, updatedData: { name: string; icon: string }) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    
    const cat = categories.value.find(c => c.id === catId)
    if (!cat) return
    
    const oldName = cat.name
    const newName = updatedData.name.trim()
    if (!newName) return
    
    cat.name = newName
    cat.icon = updatedData.icon
    
    let affectedTxCount = 0
    if (oldName !== newName) {
      transactions.value = transactions.value.map(tx => {
        if (tx.category === oldName) {
          affectedTxCount++
          return { ...tx, category: newName, updatedAt: Date.now() }
        }
        return tx
      })
      
      recurringTransactions.value = recurringTransactions.value.map(rec => {
        if (rec.category === oldName) {
          return { ...rec, category: newName }
        }
        return rec
      })
    }
    
    await syncCategories()
    if (oldName !== newName && affectedTxCount > 0) {
      await db.saveTransactions(transactions.value)
      await syncRecurring()
    }
    
    await addSystemLog(
      operatorName,
      operatorAvatar,
      'update_categories',
      `編輯主分類「${oldName}」➜「${newName}」${oldName !== newName ? `（更新 ${affectedTxCount} 筆交易）` : ''}`
    )
  }

  const editSubCategory = async (catId: string, oldSubName: string, newSubName: string) => {
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    
    const cat = categories.value.find(c => c.id === catId)
    if (!cat) return
    
    const trimmedNewSub = newSubName.trim()
    if (!trimmedNewSub || trimmedNewSub === oldSubName) return
    
    const idx = cat.subCategories.indexOf(oldSubName)
    if (idx !== -1) {
      cat.subCategories[idx] = trimmedNewSub
    }
    
    let affectedTxCount = 0
    transactions.value = transactions.value.map(tx => {
      if (tx.category === cat.name && tx.subCategory === oldSubName) {
        affectedTxCount++
        return { ...tx, subCategory: trimmedNewSub, updatedAt: Date.now() }
      }
      return tx
    })
    
    recurringTransactions.value = recurringTransactions.value.map(rec => {
      if (rec.category === cat.name && rec.subCategory === oldSubName) {
        return { ...rec, subCategory: trimmedNewSub }
      }
      return rec
    })
    
    await syncCategories()
    if (affectedTxCount > 0) {
      await db.saveTransactions(transactions.value)
      await syncRecurring()
    }
    
    await addSystemLog(
      operatorName,
      operatorAvatar,
      'update_categories',
      `編輯「${cat.name}」子分類「${oldSubName}」➜「${trimmedNewSub}」${affectedTxCount > 0 ? `（更新 ${affectedTxCount} 筆交易）` : ''}`
    )
  }

  const isTransactionPaid = (tx: Transaction) => {
    if (tx.type !== 'expense') return false
    const fromAcct = accounts.value.find(a => a.id === tx.fromAccountId)
    if (!fromAcct || fromAcct.type !== 'credit_card') return false
    
    const billPeriod = getCreditCardBillPeriod(tx)
    if (!billPeriod) return false
    
    // 檢查是否有對應的信用卡繳款轉帳紀錄
    return transactions.value.some(payTx => 
      payTx.type === 'transfer' &&
      payTx.toAccountId === tx.fromAccountId &&
      payTx.tags?.includes('信用卡繳款') &&
      payTx.note?.includes(billPeriod)
    )
  }

  // 13. 🐱 逗逗貓療癒生活看板趣味互動 (全面轉向陪伴角色，無精力、無等級限制，自由互動)
  const interactWithCat = async (action: string) => {
    if (!catProfile.value) return
    
    // 凌晨點擊彩蛋 (2:00 ~ 5:00) 門檻為 20 次
    const hour = new Date().getHours()
    if (hour >= 2 && hour < 5) {
      disturbedClickCount++
      if (disturbedClickCount >= 20 && !catProfile.value.unlockedAchievementIds.includes('disturbed_sleep')) {
        unlockAchievement('disturbed_sleep', '擾人清夢', '在凌晨 02:00 ~ 05:00 點擊睡覺中的貓咪 20 次。')
      }
    }

    // 連點成就 (10 秒內摸摸 50 次) 檢測
    if (action === 'pet') {
      const nowMs = Date.now()
      petClickTimestamps.push(nowMs)
      // 只保留過去 10 秒內的時間戳記
      petClickTimestamps = petClickTimestamps.filter(t => nowMs - t <= 10000)
      if (petClickTimestamps.length >= 50 && !catProfile.value.unlockedAchievementIds.includes('combo_50')) {
        unlockAchievement('combo_50', '幻影無影手', '在 10 秒內連續摸摸逗逗貓 50 次！⚡')
      }
    }

    const today = new Date().toISOString().split('T')[0]
    
    let speech = ''
    let mood: CatMood = 'happy'

    if (action === 'pet') {
      catProfile.value.stats.totalPets++
      
      // 摸摸互動模式：摸摸頭、捏肉球、揉肚子、搔下巴、順貓毛
      const modes = [
        {
          name: '摸摸頭',
          speeches: [
            '呼嚕呼嚕…主人溫柔地摸了摸我的頭，舒服到眼睛要瞇起來了喵～🐾 這是主人第 ' + catProfile.value.stats.totalPets + ' 次摸摸我喵！',
            '喵嗚～摸頭最舒服了，逗逗貓覺得好有安全感喔！(=^·^=) 主人已經溫柔摸了我 ' + catProfile.value.stats.totalPets + ' 次喵！'
          ],
          mood: 'happy' as CatMood
        },
        {
          name: '捏肉球',
          speeches: [
            '主人輕輕捏了捏我粉嫩嫩的果凍肉球，軟綿綿的超療癒對吧？🐾 這是第 ' + catProfile.value.stats.totalPets + ' 次親密互動喵！',
            '喵哈哈～捏肉球癢癢的啦主人！(〃＞◡＜〃) 主人已經捏了我 ' + catProfile.value.stats.totalPets + ' 次肉球喵！'
          ],
          mood: 'happy' as CatMood
        },
        {
          name: '揉肚子',
          speeches: [
            '哇喵！主人竟然揉了我的毛茸茸小肚子，呼嚕呼嚕……這只代表我很信任您喔！🐾 累計摸摸達 ' + catProfile.value.stats.totalPets + ' 次喵！',
            '揉肚肚超舒服的！逗逗貓想要在主人的懷裡翻滾喵～(ᴗ̤ . ᴗ̤ ) 這是主人第 ' + catProfile.value.stats.totalPets + ' 次揉肚肚！'
          ],
          mood: 'happy' as CatMood
        },
        {
          name: '搔下巴',
          speeches: [
            '喵嗚～主人搔了搔我的下巴，頭不由自主往後仰了，就是這個位置喵！(❀◕ ▾ ◕) 主人摸我 ' + catProfile.value.stats.totalPets + ' 次了喔！',
            '呼嚕呼嚕呼嚕……下巴被搔得好滿足，好想一直黏在主人身邊喵！🐾 第 ' + catProfile.value.stats.totalPets + ' 次摸摸了喵～'
          ],
          mood: 'happy' as CatMood
        },
        {
          name: '順貓毛',
          speeches: [
            '主人溫柔地幫我順了順背上的貓毛，覺得整個人都放鬆下來了喵……( ′•﹃•` ) 主人已經摸了我 ' + catProfile.value.stats.totalPets + ' 次喵！',
            '喵～背後的毛被理得整整齊齊的，我是世界上最幸福的貓咪喵！🐾 累計互動 ' + catProfile.value.stats.totalPets + ' 次！'
          ],
          mood: 'happy' as CatMood
        }
      ]

      const chosenMode = modes[Math.floor(Math.random() * modes.length)]
      mood = chosenMode.mood
      speech = chosenMode.speeches[Math.floor(Math.random() * chosenMode.speeches.length)]

      // 智慧陪伴情境 (30% 機率切換為更貼心的時間與財務陪伴對話)
      if (Math.random() < 0.3) {
        const net = netWorth.value
        
        if (net < 0) {
          // 財務打氣
          speech = '主人最近辛苦了（輕輕把溫暖的肉球貼在主人手上🐾）。不管是雨天還是晴天，逗逗貓都會一直陪著您，我們一起記帳努力，喵嗚～（摸摸次數累計：' + catProfile.value.stats.totalPets + ' 次）'
          mood = 'happy'
        } else {
          // 時間貼心陪伴
          if (hour >= 6 && hour < 12) {
            speech = '喵哈～（伸個懶腰🐾）主人早安！今天也是新的一天，逗逗貓已經在這邊準備好要陪伴主人開始新的一天囉，出發前記得摸摸我喵！'
            mood = 'happy'
          } else if (hour >= 12 && hour < 18) {
            speech = '呼喵～暖洋洋的下午，看著窗外的蝴蝶好想睡午覺喵……主人工作累了嗎？記得起來喝杯水、伸展一下，逗逗貓一直在這喵！(=^·^=)'
            mood = 'happy'
          } else if (hour >= 18 && hour < 24) {
            speech = '呼嚕呼嚕……主人忙了一整天辛苦了喵！晚餐吃飽了嗎？今晚也讓逗逗貓陪著您一邊聽呼嚕聲一邊放鬆理財吧喵🐾'
            mood = 'happy'
          } else {
            speech = '唔喵……（揉了揉睏倦的眼睛💤）主人怎麼還沒睡？熬夜對身體不好喵，快摸摸我的頭然後去睡覺，逗逗貓會在夢裡等主人喔喵……'
            mood = 'sleeping'
          }
        }
      }
    } else if (action === 'feed_fish' || action === 'feed_can') {
      catProfile.value.stats.totalFeeds++
      if (action === 'feed_fish') {
        catProfile.value.stats.totalFish++
        const fishSpeeches = [
          '嗷嗚嗷嗚！🐟 金黃酥脆的小魚乾最讚了喵！謝謝主人！這是我吃的第 ' + catProfile.value.stats.totalFish + ' 隻小魚，幸福滿滿喵！(>◡<)',
          '喵嗚！這隻小魚乾超級香！主人一拿出來我就聞到了，主人餵的最好吃了喵！🐾 累計餵食 ' + catProfile.value.stats.totalFeeds + ' 次喵！',
          '（喀滋喀滋…🐾）小魚乾在嘴裡發出酥脆的聲音，逗逗貓高興得尾巴都要豎直了喵！感謝主人款待！這是我吃的第 ' + catProfile.value.stats.totalFish + ' 隻魚喵！'
        ]
        speech = fishSpeeches[Math.floor(Math.random() * fishSpeeches.length)]
        mood = 'happy'
      } else {
        catProfile.value.stats.totalCans++
        const canSpeeches = [
          '喵吼！🥫 頂級鮮肉罐罐萬歲！主人對我太好了喵！這是我吃的第 ' + catProfile.value.stats.totalCans + ' 個罐罐，愛您喵！🐾',
          '（大口大口舔食😋）滿滿的肉汁簡置是天堂！主人餵的頂級御膳太美味了喵！累計餵食 ' + catProfile.value.stats.totalFeeds + ' 次，最愛主人了喵！',
          '喵嗚～好香的雞肉拌鮭魚罐罐喔！這是我吃過最豪華的美味了，逗逗貓一輩子都要當主人的貼心小貓咪喵！(❀◕ ▾ ◕) 累計吃的第 ' + catProfile.value.stats.totalCans + ' 個罐罐喵！'
        ]
        speech = canSpeeches[Math.floor(Math.random() * canSpeeches.length)]
        mood = 'happy'
      }
    } else if (action === 'play_teaser') {
      catProfile.value.stats.totalPlays = (catProfile.value.stats.totalPlays || 0) + 1
      const teaserSpeeches = [
        '咻咻～🪄 逗貓棒在空中劃出美麗的弧線，逗逗貓高興得左右搖擺，飛撲過來抓羽毛喵！🐾 累計玩耍 ' + catProfile.value.stats.totalPlays + ' 次！',
        '喵哈！看我的無影貓爪！(=^·^=) 逗貓棒上的小鈴鐺叮噹響，逗逗貓玩得好興奮喵！這是我玩第 ' + catProfile.value.stats.totalPlays + ' 次逗貓棒喵！',
        '（左右搖屁股…準備飛撲！💨）抓到了！逗貓棒上的粉嫩羽毛是我的了喵！謝謝主人陪我玩，超開心喵～🐾',
        '鈴鈴鈴～鈴鐺一響，逗逗貓就精神百倍喵！看我輕盈的跳躍，主人揮逗貓棒的技術真好喵！🐾 累計玩耍 ' + catProfile.value.stats.totalPlays + ' 次！'
      ]
      speech = teaserSpeeches[Math.floor(Math.random() * teaserSpeeches.length)]
      mood = 'happy'
    }

    // c. 紀錄連續天數
    if (catProfile.value.stats.lastInteractDate !== today) {
      if (catProfile.value.stats.lastInteractDate === getYesterdayDate()) {
        catProfile.value.stats.streakDays++
      } else {
        catProfile.value.stats.streakDays = 1
      }
      catProfile.value.stats.lastInteractDate = today
    }
    
    temporaryMood.value = mood
    temporarySpeech.value = speech
    resetTemporaryState()
    
    // 使用防抖同步，避免高頻連點造成 Firestore 讀寫暴增
    syncCatProfileDebounced()
    
    // 檢查次數成就
    checkCountAchievements()
  }



  const resetTemporaryState = () => {
    if (interactionTimeoutId) clearTimeout(interactionTimeoutId)
    interactionTimeoutId = setTimeout(() => {
      temporaryMood.value = null
      temporarySpeech.value = null
      interactionTimeoutId = null
    }, 4000)
  }

  const getYesterdayDate = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  return {
    accounts: computed(() => accounts.value),
    transactions: computed(() => transactions.value),
    recurringTransactions: computed(() => recurringTransactions.value),
    categories: computed(() => categories.value),
    triggeredReports: computed(() => triggeredReports.value),
    isDataLoaded: computed(() => isDataLoaded.value),
    addTxPrefilledDate,
    
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyExpense,
    monthlyIncome,
    budgetRatio,
    
    dodoCatMood,
    dodoCatSpeech,
    catProfile: computed(() => catProfile.value),
    temporaryMood: computed(() => temporaryMood.value),
    temporarySpeech: computed(() => temporarySpeech.value),
    
    loadLedgerData,
    clearLedgerData,
    
    addTransaction,
    deleteTransaction,
    editTransaction,
    payCreditCardBill,
    getBillPeriodForCard,
    getCreditCardBillPeriod,
    
    addAccount,
    deleteAccount,
    editAccount,
    reorderAccounts,
    reorderCategories,
    reorderSubCategories,

    addRecurring,
    toggleRecurringActive,
    deleteRecurring,
    checkAndTriggerRecurring,

    addCategory,
    deleteCategory,
    editCategory,
    addSubCategory,
    deleteSubCategory,
    editSubCategory,

    isTransactionPaid,

    interactWithCat
  }
}
