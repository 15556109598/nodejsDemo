# 从源图生成 PWA 多尺寸图标
# 用法: powershell -File scripts/make-icons.ps1 [源图路径]
# 默认源图: image/app-icon.png
param(
    [string]$Source = "image/app-icon.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) {
    Write-Error "源图不存在: $Source"
    exit 1
}

$outDir = "web/public/icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
Write-Host "源图尺寸: $($src.Width)x$($src.Height)"

# 中心裁剪成正方形
$side = [Math]::Min($src.Width, $src.Height)
$cropX = [int](($src.Width - $side) / 2)
$cropY = [int](($src.Height - $side) / 2)

function New-SquareIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $path), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "生成 $path"
}

function New-MaskableIcon([int]$size, [string]$path) {
    # Android maskable: 橙色背景 + 图片缩到 76% 居中，保证圆形裁剪不切到主体
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#FF6B35"))
    $inner = [int]($size * 0.76)
    $offset = [int](($size - $inner) / 2)
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $inner, $inner)
    $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $path), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "生成 $path"
}

New-SquareIcon 512 "icon-512.png"
New-SquareIcon 192 "icon-192.png"
New-SquareIcon 180 "apple-touch-icon.png"
New-SquareIcon 32 "favicon-32.png"
New-MaskableIcon 512 "icon-512-maskable.png"

$src.Dispose()
Write-Host "完成，输出目录: $outDir"
