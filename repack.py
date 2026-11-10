# -*- coding: utf-8 -*-
"""重做分享包：保留 zh-CN/en-US 语言包（Chromium 启动必需），剔除其余 locales 与许可证页。
产出：1) 过滤后的暂存目录 _pack/（供 7za 压 7z） 2) 绿色版精简 zip 3) 安装包 zip。"""
import os
import shutil
import zipfile

BASE = r'C:\Users\v_qiuri\WorkBuddy\2026-08-07-12-22-06\wanongfei-pc'
REL = os.path.join(BASE, 'rel_24')
unpacked = os.path.join(REL, 'win-unpacked')
V = 'v1.1.0'

KEEP_LOCALES = {'zh-CN.pak', 'zh-TW.pak', 'en-US.pak'}
SKIP_FILES = {'LICENSES.chromium.html'}

# 1) 过滤复制到暂存目录（保留 zh-CN/en-US locale，跳过其余 locales 与 LICENSES）
# 注意：沙箱禁止删除，不用 rmtree；直接覆盖写（文件集合每次一致，无残留问题）
dst_root = os.path.join(BASE, '_pack2', '挣点窝囊费')
os.makedirs(dst_root, exist_ok=True)

copied = 0
for root, dirs, files in os.walk(unpacked):
    rel_dir = os.path.relpath(root, unpacked)
    dst_dir = os.path.join(dst_root, rel_dir) if rel_dir != '.' else dst_root
    os.makedirs(dst_dir, exist_ok=True)
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), unpacked)
        parts = rel.split(os.sep)
        if parts[0] == 'locales' and f not in KEEP_LOCALES:
            continue
        if f in SKIP_FILES:
            continue
        shutil.copy2(os.path.join(root, f), os.path.join(dst_dir, f))
        copied += 1
print('过滤复制完成, 文件数:', copied)

# 2) 绿色版精简 zip（保留 zh-CN/en-US）
z_green = os.path.join(BASE, f'挣点窝囊费-{V}-绿色版-精简.zip')
with zipfile.ZipFile(z_green, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _dirs, files in os.walk(dst_root):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, dst_root)
            z.write(full, arcname=os.path.join('挣点窝囊费', rel))
print('绿色版 zip:', round(os.path.getsize(z_green) / 1048576, 1), 'MB')

# 3) 安装包 zip
setup_exe = os.path.join(REL, f'挣点窝囊费-{V}-setup.exe')
z_setup = os.path.join(BASE, f'挣点窝囊费-{V}-安装包.zip')
with zipfile.ZipFile(z_setup, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write(setup_exe, arcname='挣点窝囊费-1.0.0-setup.exe')
print('安装包 zip:', round(os.path.getsize(z_setup) / 1048576, 1), 'MB')

# 4) 校验绿色版 zip 内含 zh-CN.pak
with zipfile.ZipFile(z_green) as z:
    names = z.namelist()
    has_zh = any(n.endswith('locales/zh-CN.pak') for n in names)
    has_ja = any(n.endswith('locales/ja.pak') for n in names)
print('绿色版 zip 含 zh-CN.pak:', 'YES ✓' if has_zh else 'NO(危险!)')
print('绿色版 zip 含 ja.pak(应无):', 'YES' if has_ja else 'NO ✓')
