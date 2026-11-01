<# :
@echo off
setlocal
title Dossier - Local Career Library
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$RepoDir='%~dp0'; Invoke-Expression ([System.IO.File]::ReadAllText('%~f0'))"
exit /b %errorlevel%
#>

$ErrorActionPreference = "Stop"
$ScriptDir = $RepoDir.TrimEnd('\')
$WebDir = Join-Path $ScriptDir "web"
$Port = 3000
$AppUrl = "http://localhost:$Port"
$LocalCheckUrl = "http://127.0.0.1:$Port"
$IconPath = Join-Path $WebDir "public\dossier.ico"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                 Dossier - Local Career Library                 " -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

# -------------------------------------------------------------------------
# Ensure Desktop Shortcut exists on laptop home screen with Dossier icon
# -------------------------------------------------------------------------
try {
    $ws = New-Object -ComObject WScript.Shell
    $desktops = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:USERPROFILE 'Desktop')) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
    foreach ($d in $desktops) {
        $lnkPath = Join-Path $d "Dossier.lnk"
        if (-not (Test-Path $lnkPath)) {
            $sc = $ws.CreateShortcut($lnkPath)
            $sc.TargetPath = Join-Path $ScriptDir "launch.bat"
            $sc.WorkingDirectory = $ScriptDir
            if (Test-Path $IconPath) { $sc.IconLocation = "$IconPath,0" }
            $sc.Description = "Dossier - Local Career Library"
            $sc.Save()
        }
    }
} catch {
    # Non-critical fallback
}

# -------------------------------------------------------------------------
# 1. Check whether npm install has been run and install dependencies if needed
# -------------------------------------------------------------------------
Write-Host "[1/4] Checking dependencies... " -NoNewline
$nodeModules = Join-Path $WebDir "node_modules"
$pkgJson = Join-Path $WebDir "package.json"

if (-not (Test-Path $pkgJson)) {
    Write-Host "`n[Error] web/package.json was not found at $pkgJson" -ForegroundColor Red
    pause
    exit 1
}

if (-not (Test-Path $nodeModules)) {
    Write-Host "`n      Dependencies not found. Running 'npm install'..." -ForegroundColor Yellow
    Push-Location $WebDir
    try {
        & npm install
    } finally {
        Pop-Location
    }
    Write-Host "      Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "Up to date." -ForegroundColor Green
}

# -------------------------------------------------------------------------
# 2. Check whether the latest build exists and build the app if it doesn't
# -------------------------------------------------------------------------
Write-Host "[2/4] Checking production build... " -NoNewline
$buildIdPath = Join-Path $WebDir ".next\BUILD_ID"
$needsBuild = -not (Test-Path $buildIdPath)

if (-not $needsBuild) {
    $buildTime = (Get-Item $buildIdPath).LastWriteTimeUtc
    # Fast check configuration files
    $configs = @("package.json", "next.config.ts", "tsconfig.json")
    foreach ($cfg in $configs) {
        $p = Join-Path $WebDir $cfg
        if ((Test-Path $p) -and ([System.IO.File]::GetLastWriteTimeUtc($p) -gt $buildTime)) {
            $needsBuild = $true
            break
        }
    }

    # Fast check source files with .NET directory enumeration
    if (-not $needsBuild) {
        $srcDir = Join-Path $WebDir "src"
        if (Test-Path $srcDir) {
            $files = [System.IO.Directory]::EnumerateFiles($srcDir, "*", [System.IO.SearchOption]::AllDirectories)
            foreach ($f in $files) {
                if ([System.IO.File]::GetLastWriteTimeUtc($f) -gt $buildTime) {
                    $needsBuild = $true
                    break
                }
            }
        }
    }
}

if ($needsBuild) {
    Write-Host "`n      Build needed. Running 'npm run build'..." -ForegroundColor Yellow
    Push-Location $WebDir
    try {
        & npm run build
    } finally {
        Pop-Location
    }
    Write-Host "      Build completed." -ForegroundColor Green
} else {
    Write-Host "Up to date." -ForegroundColor Green
}

# -------------------------------------------------------------------------
# Chrome Helper Function
# -------------------------------------------------------------------------
function Open-GoogleChrome([string]$targetUrl) {
    Write-Host "[4/4] Opening Google Chrome... " -NoNewline
    $chromeCandidates = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
    if ($env:LOCALAPPDATA) { $chromeCandidates += (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe") }
    if ($env:ProgramFiles) { $chromeCandidates += (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe") }
    if (${env:ProgramFiles(x86)}) { $chromeCandidates += (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe") }
    
    $chromeExe = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

    try {
        if ($chromeExe) {
            Start-Process -FilePath $chromeExe -ArgumentList $targetUrl
            Write-Host "Opened at $targetUrl" -ForegroundColor Green
        } else {
            Start-Process "cmd.exe" -ArgumentList "/c start chrome $targetUrl"
            Write-Host "Launched at $targetUrl" -ForegroundColor Green
        }
    } catch {
        Write-Host "Please open $targetUrl in Google Chrome manually." -ForegroundColor Yellow
    }
}

# -------------------------------------------------------------------------
# 3. Check whether server is already running
# -------------------------------------------------------------------------
Write-Host "[3/4] Checking server status on $AppUrl... " -NoNewline
$alreadyRunning = $false
try {
    $res = Invoke-WebRequest -Uri $LocalCheckUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.StatusCode -lt 500) { $alreadyRunning = $true }
} catch {}

if ($alreadyRunning) {
    Write-Host "Already running!" -ForegroundColor Green
    Open-GoogleChrome $AppUrl
    Write-Host "`n================================================================" -ForegroundColor Cyan
    Write-Host "  Dossier is already running and has been opened in Chrome." -ForegroundColor Green
    Write-Host "================================================================`n" -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    exit 0
}

# -------------------------------------------------------------------------
# 4. Start Next.js and open Chrome when ready
# -------------------------------------------------------------------------
Write-Host "Starting Next.js server..." -ForegroundColor Cyan

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "cmd.exe"
$pinfo.Arguments = "/c npm --prefix web run start"
$pinfo.WorkingDirectory = $ScriptDir
$pinfo.UseShellExecute = $false
$nextProc = [System.Diagnostics.Process]::Start($pinfo)

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$serverReady = $false
while ($sw.ElapsedMilliseconds -lt 30000) {
    Start-Sleep -Milliseconds 400
    try {
        $res = Invoke-WebRequest -Uri $LocalCheckUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($res.StatusCode -lt 500) {
            $serverReady = $true
            break
        }
    } catch {}
}

if (-not $serverReady) {
    Write-Host "`n[Error] Server did not respond within 30 seconds." -ForegroundColor Red
    if ($nextProc -and -not $nextProc.HasExited) {
        taskkill /pid $nextProc.Id /f /t > $null 2>&1
    }
    pause
    exit 1
}

Open-GoogleChrome $AppUrl

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  Dossier is live at: $AppUrl" -ForegroundColor Green
Write-Host "  Opened in Google Chrome!" -ForegroundColor Green
Write-Host ""
Write-Host "  Keep this window open while using Dossier." -ForegroundColor Gray
Write-Host "  Press Ctrl+C to close Dossier." -ForegroundColor Gray
Write-Host "================================================================`n" -ForegroundColor Cyan

try {
    $nextProc.WaitForExit()
} finally {
    if ($nextProc -and -not $nextProc.HasExited) {
        taskkill /pid $nextProc.Id /f /t > $null 2>&1
    }
}
