<#
.SYNOPSIS
    CaiNghien Core 5 Features - Automated E2E Test Suite & Windows Verification Harness
.DESCRIPTION
    Executes the 4-tier E2E test suite (65+ tests), validates Windows AppData config.json,
    tests CLI --penalty execution, and verifies exit code semantics.
.EXAMPLE
    .\tests\e2e\run_tests.ps1
    .\tests\e2e\run_tests.ps1 -Tier 1
    .\tests\e2e\run_tests.ps1 -SkipNode
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [int]$Tier = 0,

    [Parameter(Mandatory=$false)]
    [string]$TestFilter = "",

    [Parameter(Mandatory=$false)]
    [switch]$SkipNode = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path "$ScriptDir\..\.."
$AppDataDir = "$env:APPDATA\com.cainghien.desktop"
$ConfigPath = "$AppDataDir\config.json"
$BackupConfigPath = "$AppDataDir\config.json.bak_test_run"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  CAINGHIEN TAURI CORE 5 FEATURES - POWERSHELL E2E TEST HARNESS" -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Repository Root: $RepoRoot"
Write-Host "Target AppData : $AppDataDir"

$TotalChecks = 0
$PassedChecks = 0
$FailedChecks = 0

function Record-Check {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Details = ""
    )
    $script:TotalChecks++
    if ($Success) {
        $script:PassedChecks++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    } else {
        $script:FailedChecks++
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        if ($Details) {
            Write-Host "         $Details" -ForegroundColor Yellow
        }
    }
}

# -----------------------------------------------------------------------------
# PHASE 1: ENVIRONMENT & PREREQUISITE VALIDATION
# -----------------------------------------------------------------------------
Write-Host "`n--- Phase 1: Environment & System Prerequisites ---" -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = & node -v 2>$null
    Record-Check "Node.js Runtime Available ($nodeVersion)" ($null -ne $nodeVersion -and $nodeVersion.StartsWith("v"))
} catch {
    Record-Check "Node.js Runtime Available" $false "Node.js not found in PATH"
}

# Check Windows Hosts File access
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsExists = Test-Path $hostsPath
Record-Check "Windows System32 Hosts File Path Exists ($hostsPath)" $hostsExists

# Check PowerShell DNS Cmdlet
$dnsCmdlet = Get-Command Set-DnsClientServerAddress -ErrorAction SilentlyContinue
Record-Check "PowerShell Set-DnsClientServerAddress Cmdlet Available" ($null -ne $dnsCmdlet)

# -----------------------------------------------------------------------------
# PHASE 2: EXECUTE 4-TIER NODE.JS AUTOMATED TEST SUITE
# -----------------------------------------------------------------------------
if (-not $SkipNode) {
    Write-Host "`n--- Phase 2: Executing 4-Tier Automated Test Suite (test_suite.mjs) ---" -ForegroundColor Cyan
    
    $nodeArgs = @("$ScriptDir\test_suite.mjs")
    if ($Tier -ge 1 -and $Tier -le 4) {
        $nodeArgs += "--tier=$Tier"
    }
    if ($TestFilter) {
        $nodeArgs += "--test=$TestFilter"
    }

    $process = Start-Process -FilePath "node" -ArgumentList $nodeArgs -NoNewWindow -PassThru -Wait
    $nodeExitCode = $process.ExitCode

    Record-Check "4-Tier Automated Specification Tests (Tiers 1-4, >=65 checks)" ($nodeExitCode -eq 0) "Node process exited with code $nodeExitCode"
}

# -----------------------------------------------------------------------------
# PHASE 3: WINDOWS APPDATA & CONFIG.JSON DEEP INSPECTION
# -----------------------------------------------------------------------------
Write-Host "`n--- Phase 3: Windows AppData & config.json Storage Inspection ---" -ForegroundColor Cyan

$appDataExists = Test-Path $AppDataDir
Record-Check "AppData Directory Exists ($AppDataDir)" $appDataExists

if ($appDataExists) {
    $configFileExists = Test-Path $ConfigPath
    Record-Check "Active config.json Exists" $configFileExists

    if ($configFileExists) {
        try {
            $rawJson = Get-Content $ConfigPath -Raw -Encoding UTF8
            $configObj = ConvertFrom-Json $rawJson
            Record-Check "config.json Parsable Valid JSON" ($null -ne $configObj)

            $hasData = $null -ne $configObj.data
            Record-Check "config.json Schema Wrapper (data payload present)" $hasData

            $data = if ($hasData) { $configObj.data } else { $configObj }

            # Verify core properties exist
            $hasDomains = $null -ne $data.blocked_domains
            Record-Check "config.json blocked_domains array present" $hasDomains

            $hasViolations = $null -ne $data.violations_count
            Record-Check "config.json violations_count property present" $hasViolations
        } catch {
            Record-Check "config.json Read & Parse" $false $_.Exception.Message
        }
    }
}

# -----------------------------------------------------------------------------
# PHASE 4: CLI --penalty EXECUTION & PERSISTENCE VALIDATION
# -----------------------------------------------------------------------------
Write-Host "`n--- Phase 4: CLI --penalty Execution & State Persistence Validation ---" -ForegroundColor Cyan

if (Test-Path $ConfigPath) {
    try {
        # Backup active config
        Copy-Item -Path $ConfigPath -Destination $BackupConfigPath -Force
        Record-Check "Backup Original config.json Created" (Test-Path $BackupConfigPath)

        # Inject known non-zero test state into config.json
        $testState = @{
            schema = 2
            saved_at = (Get-Date).ToString("o")
            data = @{
                protection_enabled = $true
                blocked_domains = @("facebook.com", "instagram.com")
                level = 5
                xp = 2500
                streak = 14
                daily_stats = @{ "2026-09-16" = 120 }
                daily_history = @{
                    "2026-09-15" = @{ focus_minutes = 300; violations = 0; is_clean = $true }
                }
                total_focus_hours = 50
                violations_count = 2
                block_nsfw = $true
            }
        }
        $testStateJson = ConvertTo-Json $testState -Depth 10
        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($ConfigPath, $testStateJson, $utf8NoBom)
        Record-Check "Injected High Gamification Test State (Level 5, 2500 XP, 14 Streak, 2 Violations)" $true

        # Test CLI --penalty execution via cli_penalty_runner.mjs
        $penaltyProc = Start-Process -FilePath "node" -ArgumentList @("$ScriptDir\cli_penalty_runner.mjs", "--penalty") -NoNewWindow -PassThru -Wait
        Record-Check "CLI --penalty Execution Process Exit Code 0" ($penaltyProc.ExitCode -eq 0)

        # Inspect resulting config.json
        $postRaw = Get-Content $ConfigPath -Raw -Encoding UTF8
        $postConfig = ConvertFrom-Json $postRaw
        $postData = if ($null -ne $postConfig.data) { $postConfig.data } else { $postConfig }

        Record-Check "Penalty Reset: Level reset to 1" ($postData.level -eq 1) "Expected 1, got $($postData.level)"
        Record-Check "Penalty Reset: XP reset to 0" ($postData.xp -eq 0) "Expected 0, got $($postData.xp)"
        Record-Check "Penalty Reset: Streak reset to 0" ($postData.streak -eq 0) "Expected 0, got $($postData.streak)"
        Record-Check "Penalty Reset: Violations incremented from 2 to 3" ($postData.violations_count -eq 3) "Expected 3, got $($postData.violations_count)"

        $dailyStatsCount = @($postData.daily_stats.psobject.properties).Count
        $dailyStatsEmpty = ($dailyStatsCount -eq 0)
        Record-Check "Penalty Reset: daily_stats emptied" $dailyStatsEmpty "daily_stats property count: $dailyStatsCount"

        # Restore original config
        Copy-Item -Path $BackupConfigPath -Destination $ConfigPath -Force
        Remove-Item -Path $BackupConfigPath -Force
        Record-Check "Restored Original config.json" (Test-Path $ConfigPath)
    } catch {
        Record-Check "CLI --penalty Workflow Execution" $false $_.Exception.Message
        if (Test-Path $BackupConfigPath) {
            Copy-Item -Path $BackupConfigPath -Destination $ConfigPath -Force
            Remove-Item -Path $BackupConfigPath -Force
        }
    }
}

# -----------------------------------------------------------------------------
# PHASE 5: SUMMARY & EXIT CODE SEMANTICS
# -----------------------------------------------------------------------------
Write-Host "`n============================================================================" -ForegroundColor Cyan
Write-Host "  POWERSHELL E2E TEST HARNESS EXECUTION SUMMARY" -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  Total Checks Executed : $TotalChecks"
Write-Host "  Passed Checks         : $PassedChecks" -ForegroundColor Green
Write-Host "  Failed Checks         : $FailedChecks" -ForegroundColor $(if ($FailedChecks -eq 0) { "Green" } else { "Red" })
Write-Host "============================================================================" -ForegroundColor Cyan

if ($FailedChecks -eq 0) {
    Write-Host "`n>>> ALL POWERSHELL & NODE.JS E2E SUITE CHECKS PASSED (100%) <<<`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n>>> E2E TEST RUN COMPLETED WITH $FailedChecks FAILURES <<<`n" -ForegroundColor Red
    exit 1
}
