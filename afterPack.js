/* afterPack 钩子：用 resedit 给主 exe 注入自定义图标（无需 rcedit/winCodeSign）。
 * 在 electron-builder 打完 win-unpacked、生成 NSIS 安装包之前执行。
 * 读取 exe 时若遇文件锁（构建刚写完，句柄未释放），等待后重试最多 5 次。 */
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readFileWithRetry(file, tries) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      return fs.readFileSync(file);
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, 'assets', 'wnf-icon.ico');
  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) {
    console.error('[afterPack] 跳过（缺文件）：', exePath, fs.existsSync(exePath), iconPath, fs.existsSync(iconPath));
    return;
  }
  try {
    const ResEdit = require('resedit');
    const exeBuf = await readFileWithRetry(exePath, 10);
    const exe = ResEdit.NtExecutable.from(exeBuf);
    const res = ResEdit.NtExecutableResource.from(exe);
    // 取现有 icon 组 ID（保留 exe 原始 ID；无则默认 101）
    const groupIds = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries).map(e => e.id);
    const groupId = groupIds.length > 0 ? groupIds[0] : 101;
    const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      groupId,
      1033,
      iconFile.icons.map(item => item.data)
    );
    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
    console.error('[afterPack] 已为', exeName, '注入自定义图标（iconGroupID=' + groupId + '）');
  } catch (e) {
    console.error('[afterPack] 图标注入失败:', e.message);
  }
};
