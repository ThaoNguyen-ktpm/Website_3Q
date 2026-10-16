# Self-check with a synthetic env and a fake MySQL executable; never reads server/.env.
param([switch]$SandboxFixtureAcl)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$root = Join-Path $PSScriptRoot ('.task020-test-' + [Guid]::NewGuid().ToString('N'))
$shell = "$env:SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe"
$count = 0
$previousTemp = $env:TEMP
$previousTmp = $env:TMP
try {
    [void][IO.Directory]::CreateDirectory((Join-Path $root 'scripts'))
    [void][IO.Directory]::CreateDirectory((Join-Path $root 'server'))
    [void][IO.Directory]::CreateDirectory((Join-Path $root 'temp'))
    $env:TEMP = Join-Path $root 'temp'
    $env:TMP = $env:TEMP
    Copy-Item -Path "$PSScriptRoot/*-db.ps1", "$PSScriptRoot/db-common.ps1" -Destination "$root/scripts"
    if ($SandboxFixtureAcl) {
        # The restricted sandbox token cannot write in a user-only directory.
        # Override ONLY the copied fixture helper; production ACL code stays intact.
        Add-Content -LiteralPath "$root/scripts/db-common.ps1" -Value @'
function New-PrivateDirectory {
    $path = Join-Path ([IO.Path]::GetTempPath()) ('baoq-db-' + [Guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($path)
    return $path
}
'@
        [IO.File]::WriteAllText("$root/sandbox-acl", 'fixture-only')
    }
    [IO.File]::WriteAllText("$root/server/.env", "# DATABASE_URL=ignored`nDATABASE_URL='mysql://fixture:p%40ss%22%5Cword@127.0.0.1:3307/fixture_db?charset=utf8mb4' # test")
    $fake = Join-Path $root 'fake mysql.exe'
    Add-Type -OutputAssembly $fake -OutputType ConsoleApplication -TypeDefinition @'
using System;
using System.IO;
using System.Security.AccessControl;
public class FakeMysql {
    public static int Main(string[] args) {
        string root = Path.GetDirectoryName(typeof(FakeMysql).Assembly.Location);
        string config = args[0].Substring("--defaults-extra-file=".Length);
        File.WriteAllText(Path.Combine(root, "config-path.txt"), config);
        string text = File.ReadAllText(config);
        if (!text.Contains("password=\"p@ss\\\"\\\\word\"") || !text.Contains("port=3307")) return 31;
        var acl = File.GetAccessControl(config);
        var rules = acl.GetAccessRules(true, true, typeof(System.Security.Principal.SecurityIdentifier));
        if (!File.Exists(Path.Combine(root, "sandbox-acl")) && (rules.Count != 1 || rules[0].IdentityReference.Value != System.Security.Principal.WindowsIdentity.GetCurrent().User.Value)) return 32;
        foreach (string arg in args) if (arg.Contains("p@ss")) return 33;
        if (File.Exists(Path.Combine(root, "fail"))) { Console.Error.Write("fixture secret should not be logged"); return 7; }
        foreach (string arg in args) if (arg.StartsWith("--result-file=")) {
            foreach (string expected in new[]{"--single-transaction", "--routines", "--triggers", "--default-character-set=utf8mb4", "--no-tablespaces"})
                if (Array.IndexOf(args, expected) < 0) return 34;
            File.WriteAllText(arg.Substring(14), "-- fixture SQL\nSELECT 1;\n"); return 0;
        }
        File.WriteAllText(Path.Combine(root, "restored.sql"), Console.In.ReadToEnd());
        return 0;
    }
}
'@
    . "$root/scripts/db-common.ps1"
    $config = Read-DatabaseConfig "$root/server/.env"
    Assert ($config.Database -eq 'fixture_db' -and $config.Password -eq 'p@ss"\word' -and $config.Port -eq 3307) 'URL decode failed'
    $count++
    Invoke-DbClient $fake $config @("--result-file=$root/direct.sql", '--single-transaction', '--routines', '--triggers', '--default-character-set=utf8mb4', '--no-tablespaces', $config.Database)
    $dest = Join-Path $root 'backups with spaces'
    [void][IO.Directory]::CreateDirectory($dest)
    foreach ($name in @('baoq_luxury_20000101_000000.zip', 'baoq_luxury_20000102_000000.zip', 'unrelated.zip', 'baoq_luxury_invalid.zip')) { [IO.File]::WriteAllText((Join-Path $dest $name), 'fixture') }
    $output = & $shell -NoProfile -File "$root/scripts/backup-db.ps1" -BackupDir $dest -Keep 2 -MysqldumpPath $fake 2>&1
    Assert ($LASTEXITCODE -eq 0) "Fake backup failed: $output"
    Assert (-not (Test-Path "$dest/baoq_luxury_20000101_000000.zip")) 'Retention failed'
    Assert ((Test-Path "$dest/unrelated.zip") -and (Test-Path "$dest/baoq_luxury_invalid.zip")) 'Unrelated file deleted'
    Assert (@(Get-ChildItem $dest -Filter '*.sql').Count -eq 0) 'SQL not removed after compression'
    $configPath = [IO.File]::ReadAllText("$root/config-path.txt")
    Assert (-not (Test-Path -LiteralPath (Split-Path $configPath))) 'Temporary credentials leaked'
    $count++
    $zip = Get-ChildItem $dest -Filter 'baoq_luxury_*.zip' | Where-Object Name -Match '^baoq_luxury_20[2-9]\d{5}_\d{6}\.zip$' | Select-Object -First 1
    Assert ($null -ne $zip) 'No fixture archive'
    $output = & $shell -NoProfile -File "$root/scripts/restore-db.ps1" -BackupFile $zip.FullName -TargetDatabase fixture_restore -MysqlPath $fake 2>&1
    Assert ($LASTEXITCODE -eq 0 -and [IO.File]::ReadAllText("$root/restored.sql").Contains('SELECT 1;')) "Fake restore failed: $output"
    Assert (-not (Test-Path -LiteralPath (Split-Path ([IO.File]::ReadAllText("$root/config-path.txt"))))) 'Restore credentials leaked'
    Remove-Item -LiteralPath "$root/restored.sql"
    $count++
    $ErrorActionPreference = 'Continue'
    $output = & $shell -NoProfile -File "$root/scripts/restore-db.ps1" -BackupFile $zip.FullName -TargetDatabase FIXTURE_DB -MysqlPath $fake 2>&1
    $ErrorActionPreference = 'Stop'
    Assert ($LASTEXITCODE -ne 0 -and -not (Test-Path "$root/restored.sql")) 'Current DB was not blocked'
    $count++
    $output = & $shell -NoProfile -File "$root/scripts/restore-db.ps1" -BackupFile $zip.FullName -TargetDatabase fixture_db -Force -MysqlPath $fake 2>&1
    Assert ($LASTEXITCODE -eq 0) 'Explicit Force failed'
    $count++
    Remove-Item -LiteralPath "$root/restored.sql"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.File]::WriteAllText("$root/foreign.sql", 'SELECT 2;')
    Compress-Archive -LiteralPath "$root/foreign.sql" -DestinationPath "$root/foreign.zip"
    $ErrorActionPreference = 'Continue'
    $output = & $shell -NoProfile -File "$root/scripts/restore-db.ps1" -BackupFile "$root/foreign.zip" -TargetDatabase fixture_restore -MysqlPath $fake 2>&1
    $ErrorActionPreference = 'Stop'
    Assert ($LASTEXITCODE -ne 0 -and -not (Test-Path "$root/restored.sql")) 'Foreign ZIP was accepted'
    $count++
    # A later timestamp avoids collision with the successful fixture backup.
    Start-Sleep -Seconds 1
    [IO.File]::WriteAllText("$root/fail", 'fixture')
    $ErrorActionPreference = 'Continue'
    $output = & $shell -NoProfile -File "$root/scripts/backup-db.ps1" -BackupDir $dest -Keep 1 -MysqldumpPath $fake 2>&1
    $ErrorActionPreference = 'Stop'
    Assert ($LASTEXITCODE -ne 0) 'Native failure not propagated'
    Assert ((Test-Path "$dest/baoq_luxury_20000102_000000.zip")) 'Retention ran after failure'
    Assert (-not (Test-Path -LiteralPath (Split-Path ([IO.File]::ReadAllText("$root/config-path.txt"))))) 'Failure left credentials'
    Assert (-not (($output | Out-String) + [IO.File]::ReadAllText("$dest/backup.log")).Contains('fixture secret')) 'Raw stderr leaked'
    $count++
    Write-Output "PASS: $count fixture scenarios (parser, backup/retention, restore, DB guard, Force, foreign ZIP, native failure/cleanup). SandboxFixtureAcl=$SandboxFixtureAcl. No real DB accessed."
} finally {
    $env:TEMP = $previousTemp
    $env:TMP = $previousTmp
    $allowed = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\.task020-test-'
    if (-not ([IO.Path]::GetFullPath($root)).StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe fixture cleanup path' }
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
