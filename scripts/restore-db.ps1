[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BackupFile,
    [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9_]+$')][string]$TargetDatabase,
    [switch]$Force,
    [string]$MysqlPath = 'C:\xampp\mysql\bin\mysql.exe'
)
. "$PSScriptRoot/db-common.ps1"
$privateDir = $null
$stage = 'kiem tra'
try {
    $config = Read-DatabaseConfig (Join-Path $PSScriptRoot '../server/.env')
    if ($TargetDatabase -ieq $config.Database -and -not $Force) { throw 'DB dang dung; can Force.' }
    if (-not (Test-Path -LiteralPath $MysqlPath -PathType Leaf)) { throw 'Khong tim thay mysql.' }
    if ([IO.Path]::GetExtension($BackupFile) -ine '.zip') { throw 'Can file zip.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($BackupFile))
    try {
        if ($archive.Entries.Count -ne 1 -or $archive.Entries[0].FullName -notmatch '^baoq_luxury_\d{8}_\d{6}\.sql$' -or $archive.Entries[0].Length -eq 0) { throw 'Zip khong dung dinh dang backup.' }
        $privateDir = New-PrivateDirectory
        $sql = Join-Path $privateDir 'restore.sql'
        [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.Entries[0], $sql)
    } finally { $archive.Dispose() }
    $stage = 'tao DB'
    # TargetDatabase da qua ValidatePattern ^[a-zA-Z0-9_]+$ nen ghep vao SQL an toan.
    Invoke-DbClient $MysqlPath $config @("--execute=CREATE DATABASE IF NOT EXISTS ``$TargetDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci") $null
    $stage = 'nhap SQL'
    Invoke-DbClient $MysqlPath $config @('--default-character-set=utf8mb4', "--database=$TargetDatabase", '--binary-mode') $sql
    Write-Output 'Restore OK.'
} catch {
    [Console]::Error.WriteLine("Restore that bai o buoc $stage. Kiem tra zip, DB dich va quyen MySQL; DB dang dung can -Force.")
    exit 1
} finally {
    if ($privateDir -and (Test-Path -LiteralPath $privateDir)) {
        $expectedRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\baoq-db-'
        if (-not ([IO.Path]::GetFullPath($privateDir)).StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Duong dan tam khong an toan.' }
        Remove-Item -LiteralPath $privateDir -Recurse -Force
    }
}
