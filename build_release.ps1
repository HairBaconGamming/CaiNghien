Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action,
        [Parameter(Mandatory = $true)]
        [string]$StepName
    )

    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$StepName that bai voi exit code $LASTEXITCODE."
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root ".venv\Scripts\python.exe"
$spec = Join-Path $root "CaiNghienFocusGuard.spec"
$iconScript = Join-Path $root "tools\generate_icon.py"
$publishScript = Join-Path $root "tools\publish_release.py"
$issScript = Join-Path $root "installer\CaiNghienFocusGuard.iss"
$releaseWorkRoot = Join-Path $root ".release_work"
$releaseDistRoot = Join-Path $root ".release_dist"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$workPath = Join-Path $releaseWorkRoot $timestamp
$distPath = Join-Path $releaseDistRoot $timestamp
$exePath = Join-Path $distPath "CaiNghienFocusGuard.exe"
$serviceExePath = Join-Path $distPath "CaiNghienFocusGuardService.exe"
$installerName = "CaiNghienFocusGuard-Setup-" + $timestamp
$installerExePath = Join-Path $root "dist\installer\$installerName.exe"

if (-not (Test-Path $python)) {
    throw "Khong tim thay .venv\Scripts\python.exe. Hay tao .venv truoc."
}

$candidateIscc = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $candidateIscc) {
    throw "Khong tim thay ISCC.exe. Hay cai Inno Setup 6 truoc."
}

Push-Location $root
try {
    New-Item -ItemType Directory -Path $workPath -Force | Out-Null
    New-Item -ItemType Directory -Path $distPath -Force | Out-Null
    Invoke-Step -StepName "Tao icon" -Action { & $python $iconScript }
    Invoke-Step -StepName "Build exe" -Action {
        & $python -m PyInstaller --noconfirm --clean --distpath $distPath --workpath $workPath $spec
    }
    Invoke-Step -StepName "Build installer" -Action {
        & $candidateIscc "/DSourceExe=$exePath" "/DSourceServiceExe=$serviceExePath" "/DOutputFileName=$installerName" $issScript
    }
    Invoke-Step -StepName "Publish release metadata" -Action {
        & $python $publishScript --portable $exePath --installer $installerExePath
    }
}
finally {
    Pop-Location
}
