<template>
  <div class="panel">
    <h3>🏔️ 3D函数曲面 + 优化轨迹</h3>
    <div ref="container" class="viewer3d"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useOptimizationStore } from '../store/optimization'
import {
  createOptimizationView, animatedPoints, markerPoints, project3D,
  zColorRGB01, MARKER_STYLES, PATH_LINE,
  type MarkerRole, type ViewPoint,
} from '../utils/visualization'

const store = useOptimizationStore()
const container = ref<HTMLDivElement>()
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls, animId: number
// 静态组：曲面散点，仅在结果变化时重建
const staticGroup = new THREE.Group()
// 动态组：路径折线 + 位置标记，随动画步更新
const dynamicGroup = new THREE.Group()

// 与 2D 共用同一份视图模型（同一套范围换算与颜色映射）
const view = computed(() => createOptimizationView(store.result?.path ?? []))

function initScene() {
  const c = container.value!; scene = new THREE.Scene(); scene.background = new THREE.Color(0x111827)
  camera = new THREE.PerspectiveCamera(45, c.clientWidth/c.clientHeight, 0.1, 50); camera.position.set(4, 4, 5)
  renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(c.clientWidth, c.clientHeight)
  c.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true
  scene.add(new THREE.AmbientLight(0x404060, 1.5))
  const dl = new THREE.DirectionalLight(0xffffff, 1); dl.position.set(3, 4, 3); scene.add(dl)
  const dl2 = new THREE.DirectionalLight(0x6688cc, 0.4); dl2.position.set(-3, -2, -2); scene.add(dl2)
  scene.add(staticGroup); scene.add(dynamicGroup)
}

function disposeGroup(g: THREE.Group) {
  g.traverse((obj) => {
    if (obj instanceof THREE.Points || obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach(m => m.dispose())
    }
  })
  g.clear()
}

function addMarker(point: ViewPoint, role: MarkerRole) {
  const style = MARKER_STYLES[role]
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(style.radius3D, 16, 16),
    new THREE.MeshPhongMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.5 })
  )
  s.position.set(...project3D(point))
  dynamicGroup.add(s)
}

// 结果变化时重建静态内容（曲面散点）
function buildStatic() {
  disposeGroup(staticGroup)
  const v = view.value; if (!v) return

  // Surface points as scattered dots
  const positions: number[] = [], colors: number[] = []
  for (const pt of v.points) {
    positions.push(...project3D(pt))
    colors.push(...zColorRGB01(pt.t))
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false })
  staticGroup.add(new THREE.Points(geom, mat))
}

// 动画步变化时只更新动态内容（路径折线 + 起点/当前步/终点标记）
function updateDynamic() {
  disposeGroup(dynamicGroup)
  const v = view.value; if (!v) return

  // Path line
  const animPts = animatedPoints(v, store.animationStep)
  if (animPts.length > 1) {
    const lineGeom = new THREE.BufferGeometry()
    const pts: number[] = []
    for (const pt of animPts) pts.push(...project3D(pt))
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    dynamicGroup.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: PATH_LINE.color })))
  }

  // Start/current/end markers
  for (const { role, point } of markerPoints(v, store.animationStep)) addMarker(point, role)
}

function rebuildAll() { buildStatic(); updateDynamic() }

function animate() { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
onMounted(() => { initScene(); rebuildAll(); animate() })
watch(view, rebuildAll)
watch(() => store.animationStep, updateDynamic)
onUnmounted(() => {
  cancelAnimationFrame(animId)
  disposeGroup(staticGroup); disposeGroup(dynamicGroup)
  renderer?.dispose()
})
</script>

<style scoped>
.panel { background:#fff; border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.06) }
.panel h3 { margin-bottom:8px; color:#333; font-size:14px }
.viewer3d { width:100%; height:360px; border-radius:8px; overflow:hidden; border:1px solid #eee }
</style>
