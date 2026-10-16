[CmdletBinding(SupportsShouldProcess)]
param([switch]$Unregister)
$ErrorActionPreference = 'Stop'
$name = 'BaoQ Luxury DB Backup'
if ($Unregister) {
    if ($PSCmdlet.ShouldProcess($name, 'Unregister scheduled task')) { Unregister-ScheduledTask -TaskName $name -Confirm:$false }
} elseif ($PSCmdlet.ShouldProcess($name, 'Register daily backup at 23:00')) {
    $script = Join-Path $PSScriptRoot 'backup-db.ps1'
    $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory (Split-Path $PSScriptRoot)
    $trigger = New-ScheduledTaskTrigger -Daily -At '23:00'
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
}
