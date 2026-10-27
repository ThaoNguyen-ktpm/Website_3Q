[CmdletBinding()]
param(
    [string]$BackupDir = 'D:\Backups\baoq_luxury',
    [ValidateRange(1, 10000)][int]$Keep = 14,
    [string]$MysqldumpPath = 'C:\xampp\mysql\bin\mysqldump.exe'
)
. "$PSScriptRoot/db-common.ps1"
$stage = 'khoi tao'
$sql = $null
$zip = $null
$destination = $null
$completed = $false
try {
    $config = Read-DatabaseConfig (Join-Path $PSScriptRoot '../server/.env')
    if (-not (Test-Path -LiteralPath $MysqldumpPath -PathType Leaf)) { throw 'Khong tim thay mysqldump.' }
    $destination = [IO.Path]::GetFullPath($BackupDir)
    [void][IO.Directory]::CreateDirectory($destination)
    $name = 'baoq_luxury_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
    $sql = Join-Path $destination ($name + '.sql')
    $candidateZip = Join-Path $destination ($name + '.zip')
    if ((Test-Path -LiteralPath $sql) -or (Test-Path -LiteralPath $candidateZip)) { throw 'Trung ten backup; thu lai sau.' }
    $zip = $candidateZip
    $stage = 'mysqldump'
    Invoke-DbClient $MysqldumpPath $config @('--single-transaction', '--routines', '--triggers', '--default-character-set=utf8mb4', '--no-tablespaces', "--result-file=$sql", $config.Database)
    if (-not (Test-Path -LiteralPath $sql) -or (Get-Item -LiteralPath $sql).Length -eq 0) { throw 'Dump rong.' }
    $stage = 'nen'
    Compress-Archive -LiteralPath $sql -DestinationPath $zip -ErrorAction Stop
    $completed = $true
    Remove-Item -LiteralPath $sql
    $stage = 'giu ban sao'
    Get-ChildItem -LiteralPath $destination -File | Where-Object { $_.Name -cmatch '^baoq_luxury_\d{8}_\d{6}\.zip$' } |
        Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object { Remove-Item -LiteralPath $_.FullName }
    Add-Content -LiteralPath (Join-Path $destination 'backup.log') -Value ("{0:o} OK {1}.zip {2} bytes" -f (Get-Date), $name, (Get-Item -LiteralPath $zip).Length)
    Write-Output "Backup OK: $name.zip"
} catch {
    # Do not log raw exceptions: native tools or parsing errors can contain secrets.
    $message = "{0:o} ERROR buoc={1}; backup khong hoan tat." -f (Get-Date), $stage
    if ($destination -and (Test-Path -LiteralPath $destination)) {
        try { Add-Content -LiteralPath (Join-Path $destination 'backup.log') -Value $message } catch { }
    }
    [Console]::Error.WriteLine($message)
    exit 1
} finally {
    if (-not $completed) {
        # Preserve a failed SQL dump for diagnosis; no retention runs after failure.
        if ($zip -and (Test-Path -LiteralPath $zip)) { Remove-Item -LiteralPath $zip -Force }
    }
}
