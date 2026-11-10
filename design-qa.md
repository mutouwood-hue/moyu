# 《挣点窝囊费》v1.1.0 设计 QA

- reference source: `/Users/zoumutou/Downloads/挣点窝囊费_视觉与动效规范_v1.0.docx`（21 页，已完整渲染检查）
- reference screenshots: `qa/source-main-92.png`, `qa/source-floating-92.png`
- implementation screenshots: `qa/main-dashboard-with-lemon-final.jpg`, `qa/floating-372x299-final.png`
- full-page comparison: `qa/compare-main-final.png`
- focused comparison: `qa/compare-hero.png`, `qa/compare-floating-final.png`
- tested viewport: 主窗口 642×1161；悬浮窗 372×299
- tested density: 1× CSS 像素；生成资源均为高分辨率 RGBA PNG
- interactions verified: 工资罐/进度条切换、工作/摸鱼模式、金额隐藏、主/悬浮窗切换、记录页、日历页、设置保存、里程碑 Toast、结算弹窗、Esc 与焦点语义
- console result: 主窗口与悬浮窗均无 error/warn
- accessibility: 键盘焦点可见、按钮和区域具备可读名称、减少动态效果支持系统偏好与手动覆盖、金额隐藏仍保留进度信息

## Iteration history

1. P2：生成罐图残留底色、100% 刻度重复。改为透明同画布资源，并隐藏端点处重复进度标签。
2. P2：工资罐比例偏小、品牌头部偏移。重新裁切 UI 资源并校准 642px 桌面构图。
3. P2：金额换算缺少真实物品感。补充透明奶茶和人民币金币图形。
4. P2：中低进度出现“罐中小罐”。把填充层改为同画布裁切并使用独立金币堆图层，主窗与悬浮窗同步修复。

## Final assessment

- P0: 0
- P1: 0
- P2: 0
- P3: 仅保留浏览器预览无法表现的原生标题栏差异；已通过 Electron macOS/Windows 打包验证。
- final result: passed
