# V1A 素材与实现说明

## 资源分层

- `assets/v1a/`：默认精致风格。依据最新共享资源说明，使用深海军蓝、薄荷绿与少量珊瑚红，角色统一底部中心锚点，木鱼拆分 idle / pressed / rebound。
- `assets/skins/simple/`：上一套程序化素材，产品名为“质朴”。它不是默认资源，只在用户购买并装备 `theme-simple` 后启用。
- 两套目录不得互相覆盖；新增默认素材只进入 `assets/v1a/`，新增“质朴”素材只进入 `assets/skins/simple/`。

## 已实现闭环

1. 摸鱼模式只记录时长和金额，不自动打开游戏。
2. “摸鱼屋”包含乐园、商店、收藏三个页签；V1A 开放木鱼暴击。
3. 木鱼结算奖励 10–25 摸鱼币，摸鱼币与真实工资字段完全分离。
4. 购买操作在主进程一次性完成扣币、入库和装备，余额不足时不产生半完成状态。
5. 默认精致角色随工作 / 摸鱼 / 下班切换；睡衣商品直接装备独立角色图。
6. “质朴”售价 300 摸鱼币；装备后主界面角色与木鱼游戏同时切换到旧素材体系。
7. 像素悬浮窗和办公室夜班均由 HTML/CSS 实时渲染，不把预览图中的数字写死进运行界面。
8. 原“星轨弹射”不再随摸鱼模式自动出现，仅保留为设置页彩蛋。

## 数据文件

- `app-state.json`：V2 本地状态文件，首次启动由旧 `config.json` 迁移。
- `fishCoins`、`totalFishCoinsEarned`、`totalFishCoinsSpent`：摸鱼币钱包。
- `ownedItems`、`equipped`：库存与当前装备。
- `gameStats`：木鱼局数、最高功德、最高连击。
- 工资仍由原计薪字段和引擎计算，任何商品都不提供工资或计薪加成。

## 素材清单

- 精致角色：master、work、slack、offwork、pajamas，以及 `capybara_anchors.json`。
- 精致木鱼：普通 / 黄金 / 老板各 3 状态，3 个木槌，6 个敲击效果，reduced-motion 和 `muyu_atlas.json`。
- 质朴皮肤：完整保留原四批资源、manifest、预览、主题、悬浮窗和关键 UI 参考。
- 生成源图保留为 `*-sheet-source.png`，拆分脚本为 `scripts/split-assets.swift`，方便以后可重复构建。

## 验证

- `npm run check`：JavaScript 语法检查。
- `npm test`：13 项测试，覆盖计薪、迁移、原子购买、余额不足和木鱼奖励边界。
- 已在 macOS Electron 中检查摸鱼屋、商店、“质朴”商品、木鱼初始窗口与点击计分。
