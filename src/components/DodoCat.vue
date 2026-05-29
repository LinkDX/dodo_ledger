<script setup lang="ts">
import { computed, ref } from 'vue'

// 定義逗逗貓的表情類型
export type CatMood = 'happy' | 'nervous' | 'scared' | 'crying' | 'sleeping'

interface Props {
  mood?: CatMood
  speech?: string
  lookAt?: { x: number; y: number } | null
  isPouncing?: boolean
  isPounceSuccess?: boolean
  isTickled?: boolean
  currentWand?: 'feather' | 'laser' | 'bell'
  isTeasing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mood: 'happy',
  speech: '',
  lookAt: null,
  isPouncing: false,
  isPounceSuccess: false,
  isTickled: false,
  currentWand: 'feather',
  isTeasing: false
})

const emit = defineEmits<{
  (e: 'pet'): void
}>()

const isJellyActive = ref(false)

const handlePetClick = () => {
  emit('pet')
  isJellyActive.value = true
  setTimeout(() => {
    isJellyActive.value = false
  }, 300)
}

// 根據表情與互動狀態產生可愛的提示音或貓咪擬聲詞
const catMiau = computed(() => {
  if (props.isPouncing) {
    return props.isPounceSuccess ? '喵哈！抱抱住～(=👁️ ▾ 👁️=)🐾' : '喵！看我的飛撲！(=👁️ ▾ 👁️=)🐾'
  }
  if (props.isTickled) {
    return '呼嚕嚕～好癢喵～( ᴗ̤ . ᴗ̤ )'
  }
  if (props.lookAt && props.mood !== 'sleeping') {
    if (props.currentWand === 'laser') return '喵！紅點點！(=🐾.🐾=)⚡'
    if (props.currentWand === 'bell') return '鈴鈴～好聽喵！(❀=👁️ ▾ 👁️=)🔔'
    return '喵哈！(=👁️ ▾ 👁️=)🪄'
  }
  switch (props.mood) {
    case 'happy': return '喵～(❀◕ ▾ ◕)'
    case 'nervous': return '喵嗚…(・_・;)'
    case 'scared': return '喵！∑(O_O;)'
    case 'crying': return '嗚喵(ㄒoㄒ)'
    case 'sleeping': return '呼喵～(ᴗ̤ . ᴗ̤ )'
    default: return '喵～'
  }
})

// 貓頭部隨滑鼠偏轉的動態 transform 樣式
const headTransformStyle = computed(() => {
  if (!props.lookAt || props.mood === 'sleeping') return {}
  const tx = props.lookAt.x * 6.5
  const ty = props.lookAt.y * 4.5
  const rotate = props.lookAt.x * 2.8
  return {
    transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg)`,
    transformOrigin: '100px 110px'
  }
})
</script>

<template>
  <div class="dodo-cat-container cat-wiggle" :class="{ 'teasing-layout-active': isTeasing }">
    <!-- 1. 逗逗貓核心 SVG 圖示 (在左邊) -->
    <div 
      class="cat-svg-wrapper" 
      :class="{ 
        'cat-jelly-active': isJellyActive, 
        'cat-pounce-active': isPouncing 
      }" 
      @click="handlePetClick"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        class="cat-svg"
      >
        <!-- 核心陰影 -->
        <ellipse cx="100" cy="180" rx="60" ry="10" fill="#3D2B1F" opacity="0.1" />

        <!-- 貓身體 (品牌乳白，深灰褐粗邊) -->
        <path
          d="M 60 180 C 60 110, 140 110, 140 180 Z"
          fill="#FDF6EE"
          stroke="#3D2B1F"
          stroke-width="6"
          stroke-linejoin="round"
        />

        <!-- 經典手繪薄荷綠口金包錢包 (抱在身前) -->
        <g>
          <!-- 口金包主體 -->
          <rect x="72" y="148" width="56" height="34" rx="7" fill="#A8E6CF" stroke="#3D2B1F" stroke-width="3" />
          <!-- 頂部雙金扣 -->
          <circle cx="100" cy="143" r="3.2" fill="#F4C842" stroke="#3D2B1F" stroke-width="1.5" />
          <!-- 口金包中央皇家飾品 -->
          <circle cx="100" cy="165" r="5" fill="#FFF8EC" stroke="#3D2B1F" stroke-width="1.5" />
          <circle cx="100" cy="165" r="2.2" fill="#F4C842" />
        </g>

        <!-- 貓左右手 (在非 crying 且非 pouncing 狀態下搭抓在錢包兩側) -->
        <g v-if="mood !== 'crying' && !isPouncing">
          <circle cx="68" cy="165" r="9.5" fill="#FDF6EE" stroke="#3D2B1F" stroke-width="3" />
          <circle cx="132" cy="165" r="9.5" fill="#FDF6EE" stroke="#3D2B1F" stroke-width="3" />
        </g>

        <!-- 飛撲時的貓爪 (大抱抱或飛天小爪，生動療癒) -->
        <g v-if="isPouncing">
          <!-- 飛撲成功：大抱抱姿勢（手抓在胸前合攏抱住道具） -->
          <template v-if="isPounceSuccess">
            <!-- 左手抱在胸前 -->
            <path d="M 60 160 C 70 140, 95 140, 95 155" fill="none" stroke="#3D2B1F" stroke-width="21" stroke-linecap="round" />
            <path d="M 60 160 C 70 140, 95 140, 95 155" fill="none" stroke="#FDF6EE" stroke-width="15" stroke-linecap="round" />
            <!-- 右手抱在胸前 -->
            <path d="M 140 160 C 130 140, 105 140, 105 155" fill="none" stroke="#3D2B1F" stroke-width="21" stroke-linecap="round" />
            <path d="M 140 160 C 130 140, 105 140, 105 155" fill="none" stroke="#FDF6EE" stroke-width="15" stroke-linecap="round" />
            <!-- 合攏的小爪爪裝飾 -->
            <circle cx="92" cy="155" r="3" fill="#F9C4C4" />
            <circle cx="108" cy="155" r="3" fill="#F9C4C4" />
          </template>
          <!-- 飛撲中 / 撲空：雙手張開往上撲 -->
          <template v-else>
            <!-- 左手往上伸並張開爪子 -->
            <g class="pouncing-hand-left">
              <circle cx="75" cy="126" r="9.5" fill="#FDF6EE" stroke="#3D2B1F" stroke-width="3" />
              <circle cx="71" cy="120" r="2" fill="#F9C4C4" />
              <circle cx="75" cy="118" r="2.2" fill="#F9C4C4" />
              <circle cx="79" cy="120" r="2" fill="#F9C4C4" />
              <circle cx="75" cy="126" r="4" fill="#F9C4C4" />
            </g>
            <!-- 右手往上伸並張開爪子 -->
            <g class="pouncing-hand-right">
              <circle cx="125" cy="126" r="9.5" fill="#FDF6EE" stroke="#3D2B1F" stroke-width="3" />
              <circle cx="121" cy="120" r="2" fill="#F9C4C4" />
              <circle cx="125" cy="118" r="2.2" fill="#F9C4C4" />
              <circle cx="129" cy="120" r="2" fill="#F9C4C4" />
              <circle cx="125" cy="126" r="4" fill="#F9C4C4" />
            </g>
          </template>
        </g>

        <!-- 貓頭部 Group：在 lookAt 存在時，產生朝向逗貓棒的偏移與歪頭 transformation -->
        <!-- 將薰衣草領圈與鈴鐺移入此 Group 中，使其在歪頭時與大頭一同完美自然偏轉，杜絕穿幫移位 -->
        <g :style="headTransformStyle" style="transition: transform 0.16s cubic-bezier(0.25, 0.8, 0.25, 1); transform-origin: 100px 110px;">
          <!-- 薰衣草領圈 (戴在大頭下巴邊緣下方，呈現完美的項圈空間環繞層次) -->
          <path
            d="M 66 126 Q 100 170 134 126"
            fill="none"
            stroke="#3D2B1F"
            stroke-width="12"
            stroke-linecap="round"
          />
          <path
            d="M 66 126 Q 100 170 134 126"
            fill="none"
            stroke="#C3B1E1"
            stroke-width="6"
            stroke-linecap="round"
          />
          <!-- 領圈黃金鈴鐺 (完美垂掛在下巴最下緣胸前) -->
          <circle cx="100" cy="162" r="6.5" fill="#F4C842" stroke="#3D2B1F" stroke-width="2.5" />
          <line x1="93.5" y1="159.5" x2="106.5" y2="159.5" stroke="#3D2B1F" stroke-width="1.8" />
          <circle cx="100" cy="165.5" r="1.8" fill="#3D2B1F" />

          <!-- 貓耳朵 -->
          <!-- 左耳 -->
          <path
            d="M 60 90 L 40 45 L 85 70 Z"
            fill="#FDF6EE"
            stroke="#3D2B1F"
            stroke-width="6"
            stroke-linejoin="round"
          />
          <path
            d="M 60 85 L 48 53 L 78 72 Z"
            fill="#F9C4C4"
          />

          <!-- 右耳：nervous 立體折耳，其餘正常豎耳 -->
          <!-- 1. nervous 狀態下：渲染超立體雙 Path 折耳 -->
          <template v-if="mood === 'nervous'">
            <!-- 右耳底座 (四邊形) -->
            <path
              d="M 140 90 L 150 71 L 125 62 L 115 70 Z"
              fill="#FDF6EE"
              stroke="#3D2B1F"
              stroke-width="6"
              stroke-linejoin="round"
            />
            <!-- 右耳內粉紅色腮紅 -->
            <path
              d="M 140 85 L 147 73 L 127 65 Z"
              fill="#F9C4C4"
            />
            <!-- 右耳翻折蓋 (覆蓋於底座之上，打造完美摺半層次) -->
            <path
              d="M 150 71 L 156 80 L 125 62 Z"
              fill="#FDF6EE"
              stroke="#3D2B1F"
              stroke-width="6"
              stroke-linejoin="round"
            />
          </template>

          <!-- 2. 非 nervous 狀態下：渲染正常直立三角耳 -->
          <template v-else>
            <path
              d="M 140 90 L 160 45 L 115 70 Z"
              fill="#FDF6EE"
              stroke="#3D2B1F"
              stroke-width="6"
              stroke-linejoin="round"
            />
            <path
              d="M 140 85 L 152 53 L 122 72 Z"
              fill="#F9C4C4"
            />
          </template>

          <!-- 貓頭部 -->
          <ellipse
            cx="100"
            cy="110"
            rx="52"
            ry="44"
            fill="#FDF6EE"
            stroke="#3D2B1F"
            stroke-width="6"
          />

          <!-- 貓腮紅 (軟萌粉紅) -->
          <ellipse cx="65" cy="122" rx="8" ry="5" fill="#F9C4C4" opacity="0.6" />
          <ellipse cx="135" cy="122" rx="8" ry="5" fill="#F9C4C4" opacity="0.6" />

          <!-- ─── 表情包切換 ─── -->

          <!-- 1. 飛撲中表情 (優先度極高) -->
          <g v-if="isPouncing">
            <!-- 飛撲：超興奮專注圓大眼，水汪汪雙重高光！ -->
            <circle cx="75" cy="106" r="11" fill="#FFFFFF" stroke="#3D2B1F" stroke-width="4.5" />
            <circle cx="75" cy="106" r="7.5" fill="#3D2B1F" />
            <circle cx="72.5" cy="103.5" r="2.2" fill="#FFFFFF" />
            <circle cx="77.2" cy="108.2" r="1.1" fill="#FFFFFF" />
            
            <circle cx="125" cy="106" r="11" fill="#FFFFFF" stroke="#3D2B1F" stroke-width="4.5" />
            <circle cx="125" cy="106" r="7.5" fill="#3D2B1F" />
            <circle cx="122.5" cy="103.5" r="2.2" fill="#FFFFFF" />
            <circle cx="127.2" cy="108.2" r="1.1" fill="#FFFFFF" />
            
            <!-- 大開口貓咪開心嘴巴，露出粉紅小舌頭，極度興奮！ -->
            <path 
              d="M 92 118 Q 100 124 108 118 Q 100 132 92 118" 
              fill="#F9C4C4" 
              stroke="#3D2B1F" 
              stroke-width="3" 
              stroke-linejoin="round" 
            />
          </g>

          <!-- 2. 搔癢表情 (瞇眼撒嬌) -->
          <g v-else-if="isTickled">
            <path d="M 68 108 Q 76 114 84 108" fill="none" stroke="#3D2B1F" stroke-width="5" stroke-linecap="round" />
            <path d="M 116 108 Q 124 114 132 108" fill="none" stroke="#3D2B1F" stroke-width="5" stroke-linecap="round" />
            <path d="M 94 118 Q 100 123 100 118 Q 100 123 106 118" fill="none" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
          </g>

          <!-- 3. 逗貓棒互動：專注好奇大眼睛 (當 lookAt 存在且非 sleeping 時，完美覆蓋一般表情) -->
          <g v-else-if="lookAt && mood !== 'sleeping'">
            <!-- 超大圓滾滾的大眼眶 (水汪汪好奇無辜大眼) -->
            <circle cx="75" cy="106" r="11" fill="#FFFFFF" stroke="#3D2B1F" stroke-width="4.5" />
            <circle cx="125" cy="106" r="11" fill="#FFFFFF" stroke="#3D2B1F" stroke-width="4.5" />
            
            <!-- 眼神偏轉計算與動漫雙高光渲染 (左眼) -->
            <circle :cx="75 + lookAt.x * 5.0" :cy="106 + lookAt.y * 4.0" r="7" fill="#3D2B1F" />
            <!-- 雷射筆時，眼珠內透出超夢幻的亮粉紅色發光圈 -->
            <circle v-if="currentWand === 'laser'" :cx="75 + lookAt.x * 5.0" :cy="106 + lookAt.y * 4.0" r="7.8" fill="none" stroke="#FF5D5D" stroke-width="1.8" opacity="0.8" />
            <circle :cx="75 + lookAt.x * 5.0 - 2.5" :cy="106 + lookAt.y * 4.0 - 2.5" r="2.2" fill="#FFFFFF" />
            <circle :cx="75 + lookAt.x * 5.0 + 2.2" :cy="106 + lookAt.y * 4.0 + 2.2" r="1.1" fill="#FFFFFF" />

            <!-- 眼神偏轉計算與動漫雙高光渲染 (右眼) -->
            <circle :cx="125 + lookAt.x * 5.0" :cy="106 + lookAt.y * 4.0" r="7" fill="#3D2B1F" />
            <circle v-if="currentWand === 'laser'" :cx="125 + lookAt.x * 5.0" :cy="106 + lookAt.y * 4.0" r="7.8" fill="none" stroke="#FF5D5D" stroke-width="1.8" opacity="0.8" />
            <circle :cx="125 + lookAt.x * 5.0 - 2.5" :cy="106 + lookAt.y * 4.0 - 2.5" r="2.2" fill="#FFFFFF" />
            <circle :cx="125 + lookAt.x * 5.0 + 2.2" :cy="106 + lookAt.y * 4.0 + 2.2" r="1.1" fill="#FFFFFF" />

            <!-- 手繪微張倒三角小粉舌 W 微笑嘴 -->
            <path 
              d="M 94 120 C 97 122, 100 121, 100 120 C 100 121, 103 122, 106 120 C 104 126, 96 126, 94 120 Z" 
              fill="#F9C4C4" 
              stroke="#3D2B1F" 
              stroke-width="3" 
              stroke-linejoin="round" 
            />
          </g>

          <!-- 4. 開心表情 (happy) - 無 lookAt -->
          <g v-else-if="mood === 'happy'">
            <!-- 瞇瞇眼 -->
            <path d="M 70 105 Q 78 98 85 105" fill="none" stroke="#3D2B1F" stroke-width="5" stroke-linecap="round" />
            <path d="M 115 105 Q 122 98 130 105" fill="none" stroke="#3D2B1F" stroke-width="5" stroke-linecap="round" />
            <!-- 貓咪小嘴巴 (W 形) -->
            <path d="M 94 118 Q 100 124 100 118 Q 100 124 106 118" fill="none" stroke="#3D2B1F" stroke-width="5" stroke-linecap="round" />
          </g>

          <!-- 5. 小緊張表情 (nervous) - 無 lookAt -->
          <g v-else-if="mood === 'nervous'">
            <!-- 尷尬小眼神 -->
            <ellipse cx="78" cy="106" rx="4" ry="6" fill="#3D2B1F" />
            <ellipse cx="122" cy="106" rx="4" ry="6" fill="#3D2B1F" />
            <path d="M 72 96 Q 78 93 84 96" fill="none" stroke="#3D2B1F" stroke-width="3" stroke-linecap="round" />
            <!-- 平平的嘴巴 -->
            <line x1="94" y1="120" x2="106" y2="120" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
          </g>

          <!-- 6. 驚嚇流汗表情 (scared) - 無 lookAt -->
          <g v-else-if="mood === 'scared'">
            <!-- 圓滾滾的大眼 -->
            <circle cx="76" cy="106" r="9" fill="#FFFFFF" stroke="#3D2B1F" stroke-width="4.5" />
            <circle cx="76" cy="106" r="4" fill="#3D2B1F" />
            <circle cx="124" cy="106" r="9" fill="#FFFFFF" stroke="#3D2B1F" stroke-width="4.5" />
            <circle cx="124" cy="106" r="4" fill="#3D2B1F" />
            <!-- 八字眉 -->
            <path d="M 68 93 Q 76 97 82 92" fill="none" stroke="#3D2B1F" stroke-width="3.5" stroke-linecap="round" />
            <path d="M 132 93 Q 124 97 118 92" fill="none" stroke="#3D2B1F" stroke-width="3.5" stroke-linecap="round" />
            <!-- 圓嘴巴 -->
            <circle cx="100" cy="122" r="6" fill="#F9C4C4" stroke="#3D2B1F" stroke-width="4.5" />
            <!-- 藍色流汗滴 (動態) -->
            <path
              d="M 148 95 C 148 90, 154 90, 154 95 C 154 100, 148 100, 148 95"
              fill="#A9C9FF"
              stroke="#3D2B1F"
              stroke-width="2.5"
              class="sweat-drop"
            />
          </g>

          <!-- 7. 遮眼大哭表情 (crying) -->
          <g v-else-if="mood === 'crying'">
            <!-- 貓爪子擋住眼睛 (品牌乳白，深灰褐粗邊) -->
            <path d="M 60 115 Q 75 92 82 115" fill="#FDF6EE" stroke="#3D2B1F" stroke-width="5" stroke-linejoin="round" />
            <path d="M 140 115 Q 125 92 118 115" fill="#FDF6EE" stroke="#3D2B1F" stroke-width="5" stroke-linejoin="round" />
            <!-- 下垂的哭嘴巴 -->
            <path d="M 94 125 Q 100 118 106 125" fill="none" stroke="#3D2B1F" stroke-width="5" stroke-linecap="round" />
            <!-- 流淚線 -->
            <path d="M 72 116 L 72 135" stroke="#A9C9FF" stroke-width="4" stroke-linecap="round" />
            <path d="M 128 116 L 128 135" stroke="#A9C9FF" stroke-width="4" stroke-linecap="round" />
          </g>

          <!-- 8. 睡邊/伸懶腰 (sleeping) - 即使有 lookAt 依舊睡覺（傲嬌） -->
          <g v-else-if="mood === 'sleeping'">
            <!-- 安詳閉眼 -->
            <path d="M 70 107 Q 78 112 85 107" fill="none" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
            <path d="M 115 107 Q 122 112 130 107" fill="none" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
            <!-- W 嘴巴 -->
            <path d="M 95 118 Q 100 122 100 118 Q 100 122 105 118" fill="none" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
          </g>

          <!-- 貓鼻子 (粉桃色帶深灰褐細邊) - 哭臉除外 -->
          <polygon v-if="mood !== 'crying'" points="96,112 104,112 100,116" fill="#F9C4C4" stroke="#3D2B1F" stroke-width="2" stroke-linejoin="round" />

          <!-- 貓鬍鬚 -->
          <line x1="38" y1="112" x2="22" y2="108" stroke="#3D2B1F" stroke-width="4" stroke-linecap="round" />
          <line x1="38" y1="122" x2="24" y2="124" stroke="#3D2B1F" stroke-width="4" stroke-linecap="round" />
          <line x1="162" y1="112" x2="178" y2="108" stroke="#3D2B1F" stroke-width="4" stroke-linecap="round" />
          <line x1="162" y1="122" x2="176" y2="124" stroke="#3D2B1F" stroke-width="4" stroke-linecap="round" />

          <!-- 額頭虎斑紋 -->
          <path d="M 94 67 L 94 77" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
          <path d="M 100 67 L 100 80" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
          <path d="M 106 67 L 106 77" stroke="#3D2B1F" stroke-width="4.5" stroke-linecap="round" />
        </g>
      </svg>

      <!-- 逗逗貓的小道具：玩毛線球 (僅在 happy 且無 lookAt 時顯示，固定在貓咪左下角) -->
      <Transition name="bubble-fade">
        <div v-if="mood === 'happy' && !lookAt" class="yarn-ball-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" class="yarn-svg">
            <circle cx="20" cy="20" r="14" fill="#FFB4B4" stroke="#2C1E1B" stroke-width="3" />
            <path d="M 12 12 Q 20 22 28 28" fill="none" stroke="#2C1E1B" stroke-width="2.5" />
            <path d="M 10 24 Q 22 18 30 10" fill="none" stroke="#2C1E1B" stroke-width="2.5" />
            <path d="M 20 6 Q 14 20 22 34" fill="none" stroke="#2C1E1B" stroke-width="2.5" />
            <!-- 散落的毛線頭 -->
            <path d="M 30 30 C 35 32, 28 38, 36 38" fill="none" stroke="#2C1E1B" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
      </Transition>
    </div>

    <!-- 2. 可愛手繪風對話泡泡 (Speech Bubble) (在右邊) -->
    <div 
      class="speech-bubble pop-jelly" 
      :class="{ 'bubble-hidden': !speech }"
    >
      <p class="speech-text">{{ speech }}</p>
      <p class="cat-signature">{{ catMiau }}</p>
    </div>
  </div>
</template>

<style scoped>
.dodo-cat-container {
  display: flex;
  flex-direction: row; /* 水平排列：貓在左，氣泡在右 */
  align-items: flex-end; /* 底部對齊 */
  justify-content: center; /* 在大卡片內整體居中 */
  gap: 20px; /* 貓咪與氣泡的水平安全間距，絕不重疊 */
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: 24px; /* 留出底部給貓咪陰影與毛線球 */
  box-sizing: border-box;
}

.cat-svg-wrapper {
  width: 140px;
  height: 140px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
  z-index: 10;
  cursor: pointer;
  flex-shrink: 0; /* 防止貓咪被擠壓變形 */
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.cat-svg-wrapper:hover {
  transform: scale(1.05);
}

.cat-jelly-active {
  animation: catJellyPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes catJellyPop {
  0% { transform: scale(1); }
  35% { transform: scale(0.82, 1.25); }
  65% { transform: scale(1.18, 0.82); }
  100% { transform: scale(1); }
}

.cat-pounce-active {
  animation: catPounceJump 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
}

@keyframes catPounceJump {
  0% { transform: scale(1) translateY(0); }
  15% { transform: scale(0.86, 0.76) translateY(5px); } /* 蓄力 */
  35% { transform: scale(1.2, 1.25) translateY(-24px); } /* 飛撲撲出 */
  55% { transform: scale(1.05, 0.95) translateY(0); } /* 落地 */
  100% { transform: scale(1) translateY(0); }
}

.cat-svg {
  width: 100%;
  height: 100%;
}

/* 療癒毛線球擺放 (完美靠在貓咪左下角) */
.yarn-ball-container {
  position: absolute;
  bottom: -4px;
  left: -12px;
  width: 36px;
  height: 36px;
  z-index: 15;
  animation: ballRotate 4s ease-in-out infinite;
}

@keyframes ballRotate {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  50% { transform: rotate(15deg) translateY(-2px); }
}

/* 藍色流汗滴動畫 */
@keyframes sweatAnim {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(2px) scale(0.9); }
}
.sweat-drop {
  animation: sweatAnim 1.5s ease-in-out infinite;
  transform-origin: center;
}

.speech-bubble {
  position: relative;
  margin-bottom: 48px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: 18px;
  padding: 10px 14px;
  flex: 1;
  max-width: 240px;
  min-width: 120px;
  max-height: 140px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-jelly-sm);
  z-index: 35;
  word-wrap: break-word;
}

.speech-bubble.bubble-hidden {
  display: none !important;
}

.speech-text {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text-dark);
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

/* Chrome / Safari 捲軸美化 */
.speech-text::-webkit-scrollbar {
  width: 4px;
}

.speech-text::-webkit-scrollbar-track {
  background: transparent;
}

.speech-text::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 4px;
}

.cat-signature {
  font-size: 11px;
  font-weight: 800;
  text-align: right;
  margin-top: 4px;
  color: var(--color-text-muted);
}

/* 漫畫旁白氣泡的指向箭頭 */
.speech-bubble::before,
.speech-bubble::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border-style: solid;
}

.speech-bubble::before {
  border-width: 8px 10px 8px 0;
  border-color: transparent var(--color-border) transparent transparent;
  left: -10px;
  z-index: 1;
}

.speech-bubble::after {
  border-width: 8px 10px 8px 0;
  border-color: transparent #FFFFFF transparent transparent;
  left: -7px;
  z-index: 2;
}

/* 當處於玩逗貓棒互動時，啟用專屬的浮動排版，貓咪自動 100% 絕對居中 */
.dodo-cat-container.teasing-layout-active {
  gap: 0;
}

/* 玩耍模式下的氣泡：變為精緻的絕對定位，精確飄浮在居中大頭右側偏上方，絕不擠壓居中的貓咪 */
.dodo-cat-container.teasing-layout-active .speech-bubble {
  position: absolute;
  left: 50%; /* 相對於容器正中心（貓咪中心） */
  bottom: 85px; /* 剛好在大頭右上方的高度 */
  margin-left: 58px; /* 向右偏移 58px，確保完全不擋到貓臉 */
  max-width: 120px; /* 縮小寬度，精美小巧 */
  min-width: 100px;
  margin-bottom: 0;
  padding: 6px 8px;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  box-shadow: var(--shadow-jelly-sm);
  z-index: 35;
  transform-origin: left bottom; /* 從靠近貓咪的左下角展開收合 */
}

/* 縮小 teasing 氣泡中的文字 */
.dodo-cat-container.teasing-layout-active .speech-text {
  font-size: 11px;
  line-height: 1.35;
  padding-right: 2px;
}

.dodo-cat-container.teasing-layout-active .cat-signature {
  font-size: 9.5px;
  margin-top: 2px;
}

/* 微調 teasing 氣泡指向貓咪的箭頭位置 */
.dodo-cat-container.teasing-layout-active .speech-bubble::before,
.dodo-cat-container.teasing-layout-active .speech-bubble::after {
  top: 75%; /* 指向偏下方的貓咪頭部 */
}

</style>
