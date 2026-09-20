<template>
  <div class="panel">
    <h3>🗺️ 2D等高线 + 优化路径</h3>
    <canvas ref="cvs" width="400" height="400" class="contour-canvas"></canvas>
    <div class="info">🔵 起点 🟢 当前步 🔴 终点</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useOptimizationStore } from '../store/optimization'
import {
  createOptimizationView, animatedPoints, markerPoints, project2D,
  zColorCss, MARKER_STYLES, MARKER_STROKE_2D, PATH_LINE,
  type MarkerRole,
} from '../utils/visualization'

const store = useOptimizationStore()
const cvs = ref<HTMLCanvasElement>()

// 视图模型只在结果变化时重算，动画/拖动进度时复用归一化坐标
const view = computed(() => createOptimizationView(store.result?.path ?? []))

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, role: MarkerRole) {
  const style = MARKER_STYLES[role]
  ctx.fillStyle = style.color
  ctx.beginPath(); ctx.arc(x, y, style.radius2D, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
}

function draw() {
  const c = cvs.value!; const ctx = c.getContext('2d')!; const W = c.width, H = c.height
  ctx.clearRect(0, 0, W, H)

  // Fill background
  ctx.fillStyle = '#0a1929'; ctx.fillRect(0, 0, W, H)

  const v = view.value
  if (!v) return

  // Draw contour-like grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
  for (let i = 0; i <= 10; i++) {
    const x = i / 10 * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    const y = i / 10 * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Draw heatmap-style fill based on z values（与 3D 同一套颜色映射）
  for (const pt of v.points) {
    const [px, py] = project2D(pt, W, H)
    ctx.fillStyle = zColorCss(pt.t, 0.3)
    ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill()
  }

  // Draw path line
  const animPts = animatedPoints(v, store.animationStep)
  if (animPts.length > 1) {
    ctx.strokeStyle = PATH_LINE.css2D; ctx.lineWidth = PATH_LINE.width2D
    ctx.beginPath()
    ctx.moveTo(...project2D(animPts[0], W, H))
    for (let i = 1; i < animPts.length; i++) ctx.lineTo(...project2D(animPts[i], W, H))
    ctx.stroke()
  }

  // Start / current / end markers（与 3D 同一套取点与样式）
  ctx.strokeStyle = MARKER_STROKE_2D; ctx.lineWidth = 2
  for (const { role, point } of markerPoints(v, store.animationStep)) {
    drawMarker(ctx, ...project2D(point, W, H), role)
  }

  // Labels
  const cur = animPts[animPts.length - 1].raw
  ctx.fillStyle = '#aaa'; ctx.font = '11px system-ui'
  ctx.fillText(`x: ${cur.x.toFixed(3)}`, 10, 20)
  ctx.fillText(`y: ${cur.y.toFixed(3)}`, 10, 36)
  ctx.fillText(`f: ${cur.z.toFixed(4)}`, 10, 52)
}

onMounted(draw)
watch([view, () => store.animationStep], draw)
</script>

<style scoped>
.panel { background:#fff; border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.06) }
.panel h3 { margin-bottom:8px; color:#333; font-size:14px }
.contour-canvas { display:block; margin:0 auto; border-radius:8px; border:1px solid #eee }
.info { text-align:center; margin-top:8px; font-size:12px; color:#888 }
</style>
