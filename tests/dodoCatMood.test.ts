import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'

describe.skip('🐱 逗逗貓吉祥物情緒、陪伴對話與互動成就測試 (SPEC 3.4)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. 預算比例推算吉祥物心情 (dodoCatMood)：無預算或超支時情緒切換', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('預算心情測試者', '🐱')
    auth.switchProfile(user.id)
    await auth.updateProfileSettings({ monthlyBudget: 10000 })
    await ledger.loadLedgerData()

    const cashAcc = await ledger.addAccount({
      name: '皮夾現金',
      type: 'cash',
      balance: 50000,
      icon: 'Wallet',
      color: '#fff',
      currency: 'TWD'
    })

    // 支出 0 元：預算比 0% ➔ 快樂 (happy)
    expect(ledger.budgetRatio.value).toBe(0)
    expect(ledger.dodoCatMood.value).toBe('happy')

    // 支出 6,000 元 (60%) ➔ 緊張 (nervous)
    await ledger.addTransaction({
      type: 'expense',
      amount: 6000,
      category: '餐飲',
      fromAccountId: cashAcc.id,
      date: Date.now(),
      note: '聚餐',
      tags: []
    })
    expect(ledger.budgetRatio.value).toBe(0.6)
    expect(ledger.dodoCatMood.value).toBe('nervous')

    // 支出再加 3,000 元 (累計 9,000 元，90%) ➔ 驚恐害怕 (scared)
    await ledger.addTransaction({
      type: 'expense',
      amount: 3000,
      category: '購物',
      fromAccountId: cashAcc.id,
      date: Date.now(),
      note: '買新衣服',
      tags: []
    })
    expect(ledger.budgetRatio.value).toBe(0.9)
    expect(ledger.dodoCatMood.value).toBe('scared')

    // 支出再加 2,000 元 (累計 11,000 元，110% 超支) ➔ 爆哭 (crying)
    await ledger.addTransaction({
      type: 'expense',
      amount: 2000,
      category: '娛樂休閒',
      fromAccountId: cashAcc.id,
      date: Date.now(),
      note: '看演唱會',
      tags: []
    })
    expect(ledger.budgetRatio.value).toBe(1.1)
    expect(ledger.dodoCatMood.value).toBe('crying')
  })

  it('2. 撫摸與玩耍互動 (interactWithCat)：累計統計與連續互動天數追蹤', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('貓咪互動家', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    expect(ledger.catProfile.value).not.toBeNull()
    const initialPets = ledger.catProfile.value?.stats.totalPets || 0

    // 進行撫摸 (pet) 互動
    await ledger.interactWithCat('pet')
    expect(ledger.catProfile.value?.stats.totalPets).toBe(initialPets + 1)
    expect(ledger.temporaryMood.value).toBe('happy')
    expect(ledger.temporarySpeech.value).toBeTruthy()

    // 進行逗貓棒 (play_teaser) 互動
    await ledger.interactWithCat('play_teaser')
    expect(ledger.catProfile.value?.stats.totalPlays).toBeGreaterThanOrEqual(1)

    // 連續互動天數初次記錄應為 1 天
    expect(ledger.catProfile.value?.stats.streakDays).toBe(1)
  })

  it('3. 財務成就解鎖機制：省錢達人與無債一身輕判定', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('成就收藏家', '🐱')
    auth.switchProfile(user.id)
    await auth.updateProfileSettings({ monthlyBudget: 50000 })
    await ledger.loadLedgerData()

    // 建立現金帳戶 (正資產) 與信用卡 (初始 0 負債)
    await ledger.addAccount({
      name: '存款',
      type: 'bank',
      balance: 100000,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    const card = await ledger.addAccount({
      name: '信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#fff',
      currency: 'TWD'
    })

    // 記一筆小額 1,000 元 (預算 50,000 的 2%，< 10%)
    await ledger.addTransaction({
      type: 'expense',
      amount: 1000,
      category: '餐飲',
      fromAccountId: card.id,
      date: Date.now(),
      note: '輕食午餐',
      tags: []
    })

    const unlocked = ledger.catProfile.value?.unlockedAchievementIds || []
    // 預算消耗低於 10% 觸發【省錢達人】(saver_10)
    expect(unlocked).toContain('saver_10')
  })
})
