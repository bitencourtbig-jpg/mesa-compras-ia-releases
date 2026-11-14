$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$targetPath = Join-Path $desktop 'BIG Compras AI.lnk'
$s = $ws.CreateShortcut($targetPath)
$s.TargetPath = 'wscript.exe'
$s.Arguments = '"C:\Users\quemf\.gemini\antigravity\scratch\linx_farma_big\iniciar_sistema.vbs"'
$s.WorkingDirectory = 'C:\Users\quemf\.gemini\antigravity\scratch\linx_farma_big'
$s.IconLocation = 'C:\Users\quemf\.gemini\antigravity\scratch\linx_farma_big\assets\icone_big_compras.ico'
$s.Description = 'BIG Compras AI - Motor de Inteligência para Farmácias Linx BIG'
$s.Save()

Write-Output "Atalho criado com sucesso: $(Test-Path $targetPath)"
