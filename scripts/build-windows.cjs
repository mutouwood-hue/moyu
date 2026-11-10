// Build the ordinary Windows target everywhere; on Apple Silicon, use a
// native NSIS compiler and checksum-verified Electron runtime when needed.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {spawnSync, execFileSync} = require('child_process');
const {getBinFromUrl} = require('app-builder-lib/out/binDownload');
const root = path.resolve(__dirname, '..');
const builder = process.execPath;
const args = [require.resolve('electron-builder/cli.js'), '--win', 'nsis', '--x64', ...process.argv.slice(2)];
const exec = (cmd, argv, options = {}) => execFileSync(cmd, argv, {stdio:'inherit', ...options});
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fetchChecked(url, destination, expected) {
  if (fs.existsSync(destination) && sha(destination) === expected) return;
  const pending = destination + '.partial';
  try {
    exec('curl', ['-fLsS', '--retry', '3', '--connect-timeout', '20', '--max-time', '300', '-o', pending, url]);
    if (sha(pending) !== expected) throw Error('下载文件的 SHA-256 与发布方校验值不符');
    fs.renameSync(pending, destination);
  } finally { fs.rmSync(pending, {force:true}); }
}
async function main() {
  const env = {...process.env};
  if (process.platform === 'darwin' && process.arch === 'arm64' && !env.ELECTRON_BUILDER_NSIS_DIR) {
    const dir = path.join(os.tmpdir(), 'moyu-windows-build-deps');
    fs.mkdirSync(dir, {recursive:true});
    const version = require(path.join(root, 'node_modules/electron/package.json')).version;
    const archiveName = `electron-v${version}-win32-x64.zip`;
    // Pinned from the official 30.5.1 release; other versions must obtain the
    // official checksum rather than trusting the download mirror's metadata.
    let expected = {'30.5.1':'443119bb559fc2ca297a57cf79f2bce532e853ada070c1e71460c9657c13b4b3'}[version];
    if (!expected) {
      const sums = execFileSync('curl', ['-fLsS', '--retry', '3', '--connect-timeout', '20', '--max-time', '120', `https://github.com/electron/electron/releases/download/v${version}/SHASUMS256.txt`], {encoding:'utf8'});
      const line = sums.split(/\r?\n/).find(x => x.endsWith(`*${archiveName}`) || x.endsWith(` ${archiveName}`));
      if (!line) throw Error('Electron 官方校验清单缺少 Windows x64 文件');
      expected = line.split(/\s+/)[0];
    }
    const electronZip = path.join(dir, archiveName), electronDir = path.join(dir, `electron-${version}-win32-x64`);
    console.log('准备 Windows Electron 运行时，并与官方校验清单核对…');
    fetchChecked(`https://npmmirror.com/mirrors/electron/${version}/${archiveName}`, electronZip, expected);
    const marker = electronDir + '.extracted';
    if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== expected || !fs.existsSync(path.join(electronDir, 'electron.exe'))) {
      fs.mkdirSync(electronDir, {recursive:true}); exec('unzip', ['-oq', electronZip, '-d', electronDir]);
      fs.writeFileSync(marker, expected);
    }
    const brew = JSON.parse(execFileSync('brew', ['info', '--json=v2', 'makensis'], {encoding:'utf8', env:{...env,HOMEBREW_NO_AUTO_UPDATE:'1'}}));
    const formula = brew.formulae[0], bottle = Object.entries(formula.bottle.stable.files).find(([name]) => name.startsWith('arm64_'));
    if (!bottle) throw Error('Homebrew 没有本机 macOS 对应的原生 NSIS 编译器');
    const bottleName = path.basename(new URL(bottle[1].url).pathname), bottleFile = path.join(dir, bottleName);
    console.log('准备原生 NSIS，并按 Homebrew 校验值核对…');
    fetchChecked(`https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/${encodeURIComponent(bottleName)}`, bottleFile, bottle[1].sha256);
    const unpack = path.join(dir, 'brew'), nsisDir = path.join(dir, `nsis-${formula.versions.stable}-${bottle[0]}`);
    if (!fs.existsSync(path.join(nsisDir, 'mac/makensis')) || !fs.existsSync(path.join(nsisDir, 'elevate.exe'))) {
      fs.mkdirSync(unpack, {recursive:true}); exec('tar', ['-xzf', bottleFile, '-C', unpack]);
      const cellar = path.join(unpack, formula.name, formula.versions.stable);
      fs.mkdirSync(path.join(nsisDir, 'mac'), {recursive:true});
      fs.cpSync(path.join(cellar, 'share/nsis'), nsisDir, {recursive:true});
      fs.copyFileSync(path.join(cellar, 'bin/makensis'), path.join(nsisDir, 'mac/makensis'));
      const bundled = await getBinFromUrl('nsis', '3.0.4.1', 'VKMiizYdmNdJOWpRGz4trl4lD++BvYP2irAXpMilheUP0pc93iKlWAoP843Vlraj8YG19CVn0j+dCo/hURz9+Q==');
      fs.copyFileSync(path.join(bundled, 'elevate.exe'), path.join(nsisDir, 'elevate.exe'));
    }
    env.ELECTRON_BUILDER_NSIS_DIR = nsisDir;
    // The stock builder translations target an older NSIS. Chinese and English
    // compile with the native version while keeping warnings as errors.
    args.push(`--config.electronDist=${electronDir}`, '--config.nsis.installerLanguages=zh_CN', '--config.nsis.installerLanguages=en_US');
  }
  const result = spawnSync(builder, args, {cwd:root, env, stdio:'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
main().catch(e => {console.error('Windows 打包失败：'+e.message);process.exitCode=1});
