# -*- coding: utf-8 -*-
"""把安装包与免安装版压缩成 zip，便于分享给其他人。"""
import os
import zipfile

BASE = r'C:\Users\v_qiuri\WorkBuddy\2026-08-07-12-22-06\wanongfei-pc'
REL = os.path.join(BASE, 'rel_21')

# 1) 安装包 zip
setup_exe = os.path.join(REL, '挣点窝囊费-1.0.0-setup.exe')
z_setup = os.path.join(BASE, '挣点窝囊费-1.0.0-安装包.zip')
with zipfile.ZipFile(z_setup, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write(setup_exe, arcname='挣点窝囊费-1.0.0-setup.exe')
print('setup zip done:', z_setup, os.path.getsize(z_setup))

# 2) 免安装绿色版 zip（解压后双击 挣点窝囊费.exe 即用）
unpacked = os.path.join(REL, 'win-unpacked')
z_port = os.path.join(BASE, '挣点窝囊费-1.0.0-免安装绿色版.zip')
with zipfile.ZipFile(z_port, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, _dirs, files in os.walk(unpacked):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, unpacked)
            z.write(full, arcname=os.path.join('挣点窝囊费', rel))
print('portable zip done:', z_port, os.path.getsize(z_port))
