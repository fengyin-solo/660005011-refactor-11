<template>
  <div class="panel">
    <h3>🗺️ 2D等高线 + 优化路径</h3>
    <canvas ref="cvs" width="400" height="400" class="contour-canvas"></canvas>
    <div class="info">🔵 起点 🟢 当前步 🔴 终点</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useOptimizationStore } from '../store/optimization'
import {
  computeViewRanges,
  createProjector,
  colorCss,
  drawPath2D,
  drawMarkers2D,
  markerPlacements,
} from '../lib/viewScale'
const store = useOptimizationStore()
const cvs = ref<HTMLCanvasElement>()

function draw() {
  const c = cvs.value!; const ctx = c.getContext('2d')!; const W = c.width, H = c.height
  ctx.clearRect(0, 0, W, H)

  // Fill background
  ctx.fillStyle = '#0a1929'; ctx.fillRect(0, 0, W, H)

  const path = store.result?.path || []
  if (path.length === 0) return

  // 共用范围 + 投影（与 3D 画面同一份换算）
  const ranges = computeViewRanges(path)!
  const proj = createProjector(ranges, W, H)

  // Draw contour-like grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
  for (let i = 0; i <= 10; i++) {
    const x = i / 10 * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    const y = i / 10 * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Draw heatmap-style fill based on z values
  for (const pt of path) {
    const { px, py } = proj.to2D(pt)
    // blend: red (high) → blue (low)
    ctx.fillStyle = colorCss(proj.tz(pt.z), 0.3)
    ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill()
  }

  // Draw path line
  const animPath = store.currentPath()
  drawPath2D(ctx, animPath, proj)

  // Start / current / final markers
  drawMarkers2D(ctx, markerPlacements(path, animPath), proj)

  // Labels
  const cur = animPath[animPath.length - 1]
  ctx.fillStyle = '#aaa'; ctx.font = '11px system-ui'
  ctx.fillText(`x: ${cur.x.toFixed(3)}`, 10, 20)
  ctx.fillText(`y: ${cur.y.toFixed(3)}`, 10, 36)
  ctx.fillText(`f: ${cur.z.toFixed(4)}`, 10, 52)
}

onMounted(draw)
watch(() => [store.result, store.animationStep], draw, { deep: true })
</script>

<style scoped>
.panel { background:#fff; border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.06) }
.panel h3 { margin-bottom:8px; color:#333; font-size:14px }
.contour-canvas { display:block; margin:0 auto; border-radius:8px; border:1px solid #eee }
.info { text-align:center; margin-top:8px; font-size:12px; color:#888 }
</style>
