Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\quemf\.gemini\antigravity\scratch\linx_farma_big\assets"
if (-not (Test-Path $dir)) { 
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$bmp = New-Object System.Drawing.Bitmap(64, 64)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Fundo circular escuro
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
$g.FillEllipse($bgBrush, 2, 2, 60, 60)

# Borda esmeralda
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), 3)
$g.DrawEllipse($borderPen, 3, 3, 58, 58)

# Cruz de Farmácia verde esmeralda
$crossBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
$g.FillRectangle($crossBrush, 26, 14, 12, 36)
$g.FillRectangle($crossBrush, 14, 26, 36, 12)

# Texto BIG central
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font('Arial', 9, [System.Drawing.FontStyle]::Bold)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString('BIG', $font, $whiteBrush, 32, 32, $sf)

$g.Dispose()

# Salvar PNG
$pngPath = Join-Path $dir "icone_big_compras.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Salvar ICO
$icoPath = Join-Path $dir "icone_big_compras.ico"
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$bmp.Dispose()

Write-Output "Icone gerado com sucesso em $icoPath"
