$candidates = @(
    'C:\Users\Fabricio\AppData\Local\Android\Sdk',
    'C:\Android\Sdk',
    'C:\Program Files (x86)\Android\android-sdk',
    'C:\Program Files\Android\Android Studio\sdk'
)
foreach ($p in $candidates) {
    if (Test-Path $p) {
        Write-Output "FOUND:$p"
        exit 0
    }
}
Write-Output 'NONE'
exit 0
