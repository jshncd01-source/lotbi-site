[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $DoctorArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$python = $env:LOTBI_PYTHON
if (-not $python) {
    $venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $venvPython) {
        $python = $venvPython
    } else {
        $python = (Get-Command python -ErrorAction Stop).Source
    }
}

if (-not $env:LOTBI_NODE) {
    $env:LOTBI_NODE = (Get-Command node -ErrorAction Stop).Source
}

& $python (Join-Path $PSScriptRoot 'lotbi_env_doctor.py') @DoctorArgs
exit $LASTEXITCODE
