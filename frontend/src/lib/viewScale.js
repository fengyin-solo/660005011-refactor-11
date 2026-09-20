// ---------------- 样式常量（所有画面共用） ----------------
/** 优化路径折线颜色 */
export const PATH_COLOR = {
    /** 2D Canvas 使用 */
    css: 'rgba(0, 255, 200, 0.8)',
    /** three.js 使用 */
    hex: 0x00ffcc,
    lineWidth: 2,
};
/** 起点 / 当前步 / 终点的统一样式定义，顺序即绘制顺序 */
export const MARKER_STYLES = {
    start: { key: 'start', colorCss: '#4fc3f7', colorHex: 0x4fc3f7, radius2d: 6, radius3d: 0.14 },
    current: { key: 'current', colorCss: '#66bb6a', colorHex: 0x66bb6a, radius2d: 5, radius3d: 0.12 },
    end: { key: 'end', colorCss: '#ef5350', colorHex: 0xef5350, radius2d: 6, radius3d: 0.14 },
};
/** 2D 标记描边 */
export const MARKER_STROKE = { css: '#fff', lineWidth: 2 };
// ---------------- 范围与投影 ----------------
/** 各轴在数据包围盒外扩 20%，2D / 3D 必须一致 */
const PAD_RATIO = 0.2;
/** 3D 场景中 x / y 轴的可视跨度（对应旧 map 的 scale = 3） */
const XY_WORLD_SPAN = 3;
/** 3D 场景中 z 轴的可视跨度（0..2） */
const Z_WORLD_SPAN = 2;
function paddedRange(values, padRatio) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const dataSpan = max - min;
    const pad = dataSpan * padRatio || (padRatio > 0 ? 1 : 0);
    return {
        min: min - pad,
        span: dataSpan + 2 * pad,
        fillRatio: dataSpan > 0 ? dataSpan / (dataSpan + 2 * pad) : 1,
    };
}
/** 由优化路径计算三个画面共用的数据范围（x/y 含统一 20% padding，z 不含） */
export function computeViewRanges(path) {
    if (path.length === 0)
        return null;
    const x = paddedRange(path.map(p => p.x), PAD_RATIO);
    const y = paddedRange(path.map(p => p.y), PAD_RATIO);
    const z = paddedRange(path.map(p => p.z), 0);
    return {
        x: { min: x.min, span: x.span },
        y: { min: y.min, span: y.span },
        z: { min: z.min, span: z.span },
        // x、y 使用同一包围盒与同一 padding，fillRatio 恒相等
        fillRatio: x.fillRatio,
    };
}
/**
 * 基于共用范围构造投影。width / height 仅 2D 使用；
 * 3D 画面不需要传（to3D 与画布尺寸无关）。
 */
export function createProjector(ranges, width = 1, height = 1) {
    const nx = (v) => (v - ranges.x.min) / (ranges.x.span || 1);
    const ny = (v) => (v - ranges.y.min) / (ranges.y.span || 1);
    const nz = (v) => (v - ranges.z.min) / (ranges.z.span || 1);
    return {
        to2D(p) {
            return { px: nx(p.x) * width, py: height - ny(p.y) * height };
        },
        to3D(p) {
            return [
                (nx(p.x) - 0.5) * XY_WORLD_SPAN,
                nz(p.z) * Z_WORLD_SPAN,
                (ny(p.y) - 0.5) * XY_WORLD_SPAN,
            ];
        },
        tz: nz,
        markerRadius3d: style => style.radius3d * ranges.fillRatio,
    };
}
// ---------------- 颜色映射（高 z 红，低 z 蓝） ----------------
/**
 * 统一的 z 颜色映射，量化到 8-bit，
 * 保证同一份结果在 2D 与 3D 中取到完全相同的颜色。
 */
export function colorRgb(t) {
    return [
        Math.round(255 * t),
        Math.round(128 * (1 - Math.abs(t - 0.5) * 2)),
        Math.round(255 * (1 - t)),
    ];
}
/** CSS rgba 字符串（2D Canvas） */
export function colorCss(t, alpha = 1) {
    const [r, g, b] = colorRgb(t);
    return `rgba(${r},${g},${b},${alpha})`;
}
/** three.js 顶点色 0..1（3D Points） */
export function colorThree(t) {
    const [r, g, b] = colorRgb(t);
    return [r / 255, g / 255, b / 255];
}
/**
 * 起点（完整路径第 0 步）、当前步（动画路径末尾）、终点（完整路径末步）
 * 的统一摆放规则，所有画面共用。
 */
export function markerPlacements(path, animPath) {
    if (path.length === 0 || animPath.length === 0)
        return [];
    return [
        { key: 'start', point: path[0], style: MARKER_STYLES.start },
        { key: 'current', point: animPath[animPath.length - 1], style: MARKER_STYLES.current },
        { key: 'end', point: path[path.length - 1], style: MARKER_STYLES.end },
    ];
}
/** 按统一样式绘制 2D 起点 / 当前步 / 终点标记 */
export function drawMarkers2D(ctx, placements, proj) {
    ctx.strokeStyle = MARKER_STROKE.css;
    ctx.lineWidth = MARKER_STROKE.lineWidth;
    for (const { point, style } of placements) {
        const { px, py } = proj.to2D(point);
        ctx.fillStyle = style.colorCss;
        ctx.beginPath();
        ctx.arc(px, py, style.radius2d, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}
/** 按统一样式绘制 2D 优化路径折线（含当前动画进度） */
export function drawPath2D(ctx, animPath, proj) {
    if (animPath.length < 2)
        return;
    ctx.strokeStyle = PATH_COLOR.css;
    ctx.lineWidth = PATH_COLOR.lineWidth;
    ctx.beginPath();
    const first = proj.to2D(animPath[0]);
    ctx.moveTo(first.px, first.py);
    for (let i = 1; i < animPath.length; i++) {
        const { px, py } = proj.to2D(animPath[i]);
        ctx.lineTo(px, py);
    }
    ctx.stroke();
}
