#!/usr/bin/env node
/**
 * Dodo Ledger - 圖示批次轉換腳本
 * 將 public/dodo-icon.svg 轉換為 Android 各尺寸 mipmap PNG 圖示
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '../public/dodo-icon.svg');
const svgBuffer = fs.readFileSync(SVG_PATH);

// Android mipmap 各密度尺寸規格
const ANDROID_SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const RES_BASE = path.join(__dirname, '../android/app/src/main/res');

async function main() {
  console.log('🐱 Dodo Ledger 圖示轉換工具啟動...\n');

  // 轉換 Android mipmap 圖示
  for (const { dir, size } of ANDROID_SIZES) {
    const outDir = path.join(RES_BASE, dir);
    const outFile = path.join(outDir, 'ic_launcher.png');
    const outRound = path.join(outDir, 'ic_launcher_round.png');
    const outFg = path.join(outDir, 'ic_launcher_foreground.png');

    // 一般方形圖示
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outFile);

    // 圓形圖示（Android 8.0+ 自適應圖示）
    // 建立圓形遮罩
    const circle = Buffer.from(
      `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}" /></svg>`
    );
    await sharp(svgBuffer)
      .resize(size, size)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toFile(outRound);

    // Foreground 圖示（自適應圖示用，108dp 尺寸，中心繪製）
    const fgSize = Math.round(size * 108 / 48);
    await sharp(svgBuffer)
      .resize(Math.round(size * 0.75), Math.round(size * 0.75))
      .extend({
        top: Math.round(size * 0.125),
        bottom: Math.round(size * 0.125),
        left: Math.round(size * 0.125),
        right: Math.round(size * 0.125),
        background: { r: 255, g: 248, b: 236, alpha: 1 }
      })
      .resize(size, size)
      .png()
      .toFile(outFg);

    console.log(`✅ ${dir} (${size}x${size}px) → ic_launcher.png / ic_launcher_round.png / ic_launcher_foreground.png`);
  }

  console.log('\n🎉 所有 Android 圖示轉換完成！');
  console.log('📁 輸出位置：android/app/src/main/res/mipmap-*/');
}

main().catch(err => {
  console.error('❌ 圖示轉換失敗：', err.message);
  process.exit(1);
});
