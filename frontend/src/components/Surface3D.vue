<template>
  <div class="panel">
    <h3>🏔️ 3D函数曲面 + 优化轨迹</h3>
    <div ref="container" class="viewer3d"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useOptimizationStore } from '../store/optimization'
import {
  computeViewRanges,
  createProjector,
  colorThree,
  markerPlacements,
  PATH_COLOR,
} from '../lib/viewScale'

const store = useOptimizationStore()
const container = ref<HTMLDivElement>()
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls, animId: number
let surfaceGroup = new THREE.Group(), pathGroup = new THREE.Group()

function initScene() {
  const c = container.value!; scene = new THREE.Scene(); scene.background = new THREE.Color(0x111827)
  camera = new THREE.PerspectiveCamera(45, c.clientWidth/c.clientHeight, 0.1, 50); camera.position.set(4, 4, 5)
  renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(c.clientWidth, c.clientHeight)
  c.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true
  scene.add(new THREE.AmbientLight(0x404060, 1.5))
  const dl = new THREE.DirectionalLight(0xffffff, 1); dl.position.set(3, 4, 3); scene.add(dl)
  const dl2 = new THREE.DirectionalLight(0x6688cc, 0.4); dl2.position.set(-3, -2, -2); scene.add(dl2)
  scene.add(surfaceGroup); scene.add(pathGroup)
}
function buildSurface() {
  surfaceGroup.clear(); pathGroup.clear()
  const path = store.result?.path || []; if (!path.length) return

  // 共用范围 + 投影（与 2D 画面同一份换算）
  const ranges = computeViewRanges(path)!
  const proj = createProjector(ranges)

  // Surface points as scattered dots
  const geom = new THREE.BufferGeometry()
  const positions: number[] = [], colors: number[] = []
  for (const pt of path) {
    positions.push(...proj.to3D(pt))
    colors.push(...colorThree(proj.tz(pt.z)))
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false })
  surfaceGroup.add(new THREE.Points(geom, mat))

  // Path line
  const animPath = store.currentPath()
  if (animPath.length > 1) {
    const lineGeom = new THREE.BufferGeometry()
    const pts: number[] = []
    for (const pt of animPath) pts.push(...proj.to3D(pt))
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    pathGroup.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: PATH_COLOR.hex, linewidth: 1 })))
  }

  // Start/current/end markers（统一样式，半径随可视范围比例缩放）
  for (const { point, style } of markerPlacements(path, animPath)) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(proj.markerRadius3d(style), 16, 16),
      new THREE.MeshPhongMaterial({ color: style.colorHex, emissive: style.colorHex, emissiveIntensity: 0.5 })
    )
    s.position.set(...proj.to3D(point))
    pathGroup.add(s)
  }
}
function animate() { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
onMounted(() => { initScene(); buildSurface(); animate() })
watch(() => [store.result, store.animationStep], buildSurface, { deep: true })
onUnmounted(() => { cancelAnimationFrame(animId); renderer?.dispose() })
</script>

<style scoped>
.panel { background:#fff; border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.06) }
.panel h3 { margin-bottom:8px; color:#333; font-size:14px }
.viewer3d { width:100%; height:360px; border-radius:8px; overflow:hidden; border:1px solid #eee }
</style>
