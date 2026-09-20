const PAD_RATIO = 0.2;
/** 由优化路径计算统一的数据范围（两个画面共用同一套范围换算） */
export function computeRanges(path) {
    const xs = path.map(p => p.x), ys = path.map(p => p.y), zs = path.map(p => p.z);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const zMin = Math.min(...zs), zMax = Math.max(...zs);
    const padX = (xMax - xMin) * PAD_RATIO || 1;
    const padY = (yMax - yMin) * PAD_RATIO || 1;
    return {
        xMin, xMax, yMin, yMax, zMin, zMax,
        rx: xMin - padX,
        ry: yMin - padY,
        rw: xMax - xMin + 2 * padX,
        rh: yMax - yMin + 2 * padY,
    };
}
/** 构建与画面无关的视图模型；结果不变时复用，动画步进不触发重算 */
export function createOptimizationView(path) {
    if (!path.length)
        return null;
    const ranges = computeRanges(path);
    const zr = ranges.zMax - ranges.zMin || 1;
    const points = path.map(p => ({
        raw: p,
        nx: (p.x - ranges.rx) / ranges.rw,
        ny: (p.y - ranges.ry) / ranges.rh,
        t: (p.z - ranges.zMin) / zr,
    }));
    return { ranges, points };
}
/** 当前动画步可见的路径点（含当前步） */
export function animatedPoints(view, step) {
    return view.points.slice(0, Math.min(step, view.points.length - 1) + 1);
}
/** 起点 / 当前步 / 终点三个位置标记对应的点，两个画面保持一致 */
export function markerPoints(view, step) {
    const pts = view.points;
    const cur = Math.min(step, pts.length - 1);
    return [
        { role: 'start', point: pts[0] },
        { role: 'current', point: pts[cur] },
        { role: 'end', point: pts[pts.length - 1] },
    ];
}
// ---------- 坐标投影（同一套归一化坐标 → 各自画面） ----------
/** 2D 画布投影：归一化坐标 → 像素（y 轴向上） */
export function project2D(p, width, height) {
    return [p.nx * width, height - p.ny * height];
}
/** 3D 场景尺寸：x/z 方向跨度与曲面高度 */
export const SCENE_SCALE = 3;
export const SCENE_HEIGHT = 2;
/** 3D 场景投影：归一化坐标 → 场景坐标（y 为高度） */
export function project3D(p) {
    return [(p.nx - 0.5) * SCENE_SCALE, p.t * SCENE_HEIGHT, (p.ny - 0.5) * SCENE_SCALE];
}
/** 统一的 z 值颜色映射：低值蓝色 → 高值红色，t ∈ [0, 1] */
export function zColor(t) {
    return {
        r: Math.round(255 * t),
        g: Math.round(128 * (1 - Math.abs(t - 0.5) * 2)),
        b: Math.round(255 * (1 - t)),
    };
}
/** Canvas 用的 rgba() 字符串 */
export function zColorCss(t, alpha = 1) {
    const { r, g, b } = zColor(t);
    return `rgba(${r},${g},${b},${alpha})`;
}
/** three.js 顶点色用的 [r, g, b]（0~1） */
export function zColorRGB01(t) {
    const { r, g, b } = zColor(t);
    return [r / 255, g / 255, b / 255];
}
/** 起点 / 当前步 / 终点标记样式（颜色一致，尺寸按画面介质区分） */
export const MARKER_STYLES = {
    start: { color: '#4fc3f7', radius2D: 6, radius3D: 0.14 },
    current: { color: '#66bb6a', radius2D: 5, radius3D: 0.12 },
    end: { color: '#ef5350', radius2D: 6, radius3D: 0.14 },
};
/** 2D 标记的白色描边 */
export const MARKER_STROKE_2D = '#fff';
/** 路径折线样式（两个画面同一种颜色） */
export const PATH_LINE = {
    color: '#00ffc8',
    /** 2D 画布用的带透明度写法 */
    css2D: 'rgba(0,255,200,0.8)',
    width2D: 2,
};
