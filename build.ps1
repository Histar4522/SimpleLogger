$TotalStart = Get-Date

function Run-Command {
    param (
        [string]$Name,
        [scriptblock]$Command
    )
    Write-Output "--- $Name ---"
    $Start = Get-Date
    & $Command
    $ExitCode = $LASTEXITCODE
    $End = Get-Date
    $Duration = $End - $Start
    $DurationString = "{0:N2}" -f $Duration.TotalSeconds
    
    if ($ExitCode -ne 0 -and $ExitCode -ne $null) {
        Write-Error "$Name failed with exit code $ExitCode"
        exit $ExitCode
    }
    
    Write-Output "$Name finished in $DurationString seconds."
    Write-Output ""
}

Write-Output "Cleaning workspace...";
Remove-Item -Path dist -Recurse -Confirm:$false -Force
Remove-Item -Path docs -Recurse -Confirm:$false -Force
Write-Output "";

Run-Command "Compiling TypeScript" { tsc }
Run-Command "Generating Typedoc" { typedoc }

$TotalEnd = Get-Date
$TotalDuration = $TotalEnd - $TotalStart
$TotalDurationString = "{0:N2}" -f $TotalDuration.TotalSeconds

Write-Output "Build done in $TotalDurationString seconds."
exit;
