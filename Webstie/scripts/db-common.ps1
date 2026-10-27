Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-DatabaseConfig([string]$EnvPath) {
    $lines = @(Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' })
    if ($lines.Count -ne 1) { throw 'Can dung mot DATABASE_URL trong file env.' }
    $value = ($lines[0] -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
    if ($value.StartsWith('"') -or $value.StartsWith("'")) {
        $quote = $value.Substring(0, 1)
        $end = $value.IndexOf($quote, 1)
        if ($end -lt 0 -or $value.Substring($end + 1) -notmatch '^\s*(#.*)?$') { throw 'DATABASE_URL khong hop le.' }
        $value = $value.Substring(1, $end - 1)
    } else { $value = ($value -replace '\s+#.*$', '').Trim() }
    try {
        $uri = [Uri]$value
        if ($uri.Scheme -ne 'mysql' -or -not $uri.Host -or -not $uri.UserInfo) { throw 'invalid' }
        $credentials = $uri.UserInfo.Split([char[]]':', 2)
        $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
        if ($database -notmatch '^[a-zA-Z0-9_]+$') { throw 'invalid' }
        return @{
            User = [Uri]::UnescapeDataString($credentials[0])
            Password = $(if ($credentials.Count -gt 1) { [Uri]::UnescapeDataString($credentials[1]) } else { '' })
            Host = $uri.DnsSafeHost
            Port = $(if ($uri.Port -gt 0) { $uri.Port } else { 3306 })
            Database = $database
        }
    } catch { throw 'DATABASE_URL MySQL khong hop le (khong hien gia tri de bao ve bi mat).' }
}

function ConvertTo-OptionValue([string]$Value) {
    return '"' + $Value.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n').Replace("`t", '\t') + '"'
}

function New-PrivateDirectory {
    $path = Join-Path ([IO.Path]::GetTempPath()) ('baoq-db-' + [Guid]::NewGuid().ToString('N'))
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    # Create with the private ACL, so credentials never inherit a public temp ACL.
    [void][IO.Directory]::CreateDirectory($path, $acl)
    return $path
}

function Invoke-DbClient([string]$Executable, [hashtable]$Config, [string[]]$ClientArguments, [string]$InputFile) {
    $privateDir = New-PrivateDirectory
    try {
        $defaults = Join-Path $privateDir 'client.cnf'
        $options = @('[client]', ('user=' + (ConvertTo-OptionValue $Config.User)),
            ('password=' + (ConvertTo-OptionValue $Config.Password)),
            ('host=' + (ConvertTo-OptionValue $Config.Host)), ('port=' + $Config.Port), 'protocol=tcp')
        [IO.File]::WriteAllLines($defaults, $options, (New-Object Text.UTF8Encoding($false)))
        $arguments = @('--defaults-extra-file=' + $defaults) + $ClientArguments
        # Windows command-line escaping; the password is only in client.cnf.
        $quoted = @($arguments | ForEach-Object { '"' + (($_ -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"' })
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = $Executable
        $info.Arguments = $quoted -join ' '
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardError = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardInput = $true
        $process = New-Object Diagnostics.Process
        $process.StartInfo = $info
        $started = $false
        try {
            [void]$process.Start()
            $started = $true
            $stderr = $process.StandardError.ReadToEndAsync()
            $stdout = $process.StandardOutput.ReadToEndAsync()
            if ($InputFile) {
                $stream = [IO.File]::OpenRead($InputFile)
                try { $stream.CopyTo($process.StandardInput.BaseStream) } finally { $stream.Dispose() }
            }
            $process.StandardInput.Close()
            $process.WaitForExit()
            [void]$stderr.GetAwaiter().GetResult()
            [void]$stdout.GetAwaiter().GetResult()
            if ($process.ExitCode -ne 0) { throw "MySQL client exit=$($process.ExitCode); kiem tra quyen, ket noi va phien ban client." }
        } finally {
            if ($started -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
            $process.Dispose()
        }
    } finally {
        # Only the generated directory is removed; never a caller-supplied path.
        if (Test-Path -LiteralPath $privateDir) {
            $expectedRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\baoq-db-'
            if (-not ([IO.Path]::GetFullPath($privateDir)).StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Duong dan tam khong an toan.' }
            Remove-Item -LiteralPath $privateDir -Recurse -Force
        }
    }
}
