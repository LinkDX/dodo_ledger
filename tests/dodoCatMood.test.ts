import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'
import { getDatabaseService } from '../src/services/db'

describe('🐱 逗逗貓吉祥物情緒、陪伴對話與互動成就測試 (SPEC 3.4)', () => {
  beforeEach(async () => {
    const db = getDatabaseService() as any
    if (db.clearAllData) db.clearAllData()
    const auth = useAuth()
    await auth.reloadProfiles()
    const ledger = useLedger()
    ledger.clearLedgerData()
    ledger.clearTemporaryMood()
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
    ledger.clearTemporaryMood()
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
    ledger.clearTemporaryMood()
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
    ledger.clearTemporaryMood()
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
    ledger.clearTemporaryMood()
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

    // 進行撫摸 (pet) 互動 (深夜時段可能揉眼 sleeping，其他時段 happy)
    await ledger.interactWithCat('pet')
    expect(ledger.catProfile.value?.stats.totalPets).toBe(initialPets + 1)
    expect(['happy', 'sleeping']).toContain(ledger.temporaryMood.value)
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
    const bank = await ledger.addAccount({
      name: '存款',
      type: 'bank',
      balance: 100000,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    // 記一筆小額 1,000 元 (預算 50,000 的 2%，< 10%)
    await ledger.addTransaction({
      type: 'expense',
      amount: 1000,
      category: '餐飲',
      fromAccountId: bank.id,
      date: Date.now(),
      note: '輕食午餐',
      tags: []
    })

    const unlocked = ledger.catProfile.value?.unlockedAchievementIds || []
    // 預算消耗低於 10% 觸發【省錢達人】(saver_10)
    expect(unlocked).toContain('saver_10')
    // 且無信用卡負債且淨資產為正 觸發【無債一身輕】(zero_debt)
    expect(unlocked).toContain('zero_debt')
  })
})
