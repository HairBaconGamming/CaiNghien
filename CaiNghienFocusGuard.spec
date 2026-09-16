# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


project_root = Path(SPECPATH).resolve()
icon_file = project_root / "assets" / "CaiNghienFocusGuard.ico"
version_file = project_root / "packaging" / "version_info.txt"


app_analysis = Analysis(
    ["app.py"],
    pathex=[str(project_root)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "pywintypes",
        "win32service",
        "win32serviceutil",
        "win32timezone",
        "servicemanager",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

service_analysis = Analysis(
    ["service.py"],
    pathex=[str(project_root)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "pywintypes",
        "win32service",
        "win32serviceutil",
        "win32timezone",
        "servicemanager",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

app_pyz = PYZ(app_analysis.pure)
service_pyz = PYZ(service_analysis.pure)

portable_exe = EXE(
    app_pyz,
    app_analysis.scripts,
    app_analysis.binaries,
    app_analysis.datas,
    [],
    name="CaiNghienFocusGuardPortable",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_file),
    version=str(version_file),
)

app_exe = EXE(
    app_pyz,
    app_analysis.scripts,
    [],
    exclude_binaries=True,
    name="CaiNghienFocusGuard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_file),
    version=str(version_file),
)

service_exe = EXE(
    service_pyz,
    service_analysis.scripts,
    [],
    exclude_binaries=True,
    name="CaiNghienFocusGuardService",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_file),
    version=str(version_file),
)

app_bundle = COLLECT(
    app_exe,
    service_exe,
    app_analysis.binaries,
    app_analysis.datas,
    service_analysis.binaries,
    service_analysis.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="CaiNghienFocusGuardBundle",
)
