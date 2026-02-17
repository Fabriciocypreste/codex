Set-StrictMode -Off
Set-Location 'C:\Users\Fabricio\Documents\importante\top\projetolimpo\redx---spatial-streaming\redx-clean\android'
$env:_JAVA_OPTIONS = ''
$env:JAVA_TOOL_OPTIONS = ''
Write-Output "Running gradlew in: $(Get-Location)"
& .\gradlew.bat assembleRelease
