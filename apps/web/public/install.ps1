# Spica CLI zero-runtime Windows installer
# Usage: irm https://spica.simway.io/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = "sim-way/spica"
$Version = if ($env:SPICA_VERSION) { $env:SPICA_VERSION } else { "latest" }
$InstallDir = if ($env:SPICA_INSTALL_DIR) { $env:SPICA_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Spica\bin" }

$ArchiveName = "spica-windows-x64.zip"
if ($Version -eq "latest") {
  $BaseUrl = "https://github.com/$Repo/releases/latest/download"
} else {
  $Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
  $BaseUrl = "https://github.com/$Repo/releases/download/$Tag"
}

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("spica-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

try {
  $ArchivePath = Join-Path $TmpDir $ArchiveName
  $ChecksumsPath = Join-Path $TmpDir "checksums.txt"

  Write-Host "Downloading Spica (windows-x64)..."
  Invoke-WebRequest -Uri "$BaseUrl/$ArchiveName" -OutFile $ArchivePath

  try {
    Invoke-WebRequest -Uri "$BaseUrl/checksums.txt" -OutFile $ChecksumsPath
    $ExpectedLine = Get-Content $ChecksumsPath | Where-Object { $_ -match "\s+$ArchiveName$" } | Select-Object -First 1
    if ($ExpectedLine) {
      $Expected = ($ExpectedLine -split "\s+")[0].ToLowerInvariant()
      $Actual = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($Actual -ne $Expected) {
        throw "Checksum mismatch for $ArchiveName (expected $Expected, got $Actual)"
      }
    }
  } catch {
    if ($_.Exception.Message -like "Checksum mismatch*") { throw }
  }

  Expand-Archive -Path $ArchivePath -DestinationPath $TmpDir -Force
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $DestPath = Join-Path $InstallDir "spica.exe"
  Move-Item -Path (Join-Path $TmpDir "spica.exe") -Destination $DestPath -Force

  Write-Host "Installed Spica to $DestPath"
  & $DestPath --version

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($UserPath -notlike "*$InstallDir*") {
    Write-Host ""
    Write-Host "Add $InstallDir to your User PATH to run 'spica' from anywhere:"
    Write-Host "  [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$InstallDir', 'User')"
  }
} finally {
  Remove-Item -Recurse -Force -Path $TmpDir -ErrorAction SilentlyContinue
}
