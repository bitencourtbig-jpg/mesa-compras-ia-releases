$conn = Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}
Set-Location 'C:\Users\quemf\.gemini\antigravity\scratch\linx_farma_big'
node src/server.mjs
