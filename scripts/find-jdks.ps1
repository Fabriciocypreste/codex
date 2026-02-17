$paths = @(
  'C:\Program Files\Java',
  'C:\Program Files (x86)\Java',
  'C:\Program Files\Amazon Corretto',
  'C:\Program Files\Zulu',
  'C:\Program Files\AdoptOpenJDK'
)
$found = $false
foreach ($p in $paths) {
  if (Test-Path $p) {
    Get-ChildItem -Directory -Path $p | ForEach-Object { Write-Output "FOUND_JDK:$($_.FullName)"; $found = $true }
  }
}
if (-not $found) { Write-Output 'FOUND_JDK:NONE' }
exit 0
