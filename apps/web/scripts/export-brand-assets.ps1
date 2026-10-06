param([Parameter(Mandatory=$true)][string]$IconSource)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public'))
function Export-Png($source, $target, $width, $height, $sourceRect) {
  $bitmap = New-Object Drawing.Bitmap($width, $height)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($source, (New-Object Drawing.Rectangle(0,0,$width,$height)), $sourceRect, [Drawing.GraphicsUnit]::Pixel)
    $bitmap.Save((Join-Path $assetDir $target), [Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
$logo = [Drawing.Bitmap]::FromFile((Join-Path $assetDir 'hacklike43-logo-v1.png'))
try {
  $left=$logo.Width; $top=$logo.Height; $right=0; $bottom=0
  for($y=0;$y -lt $logo.Height;$y++){for($x=0;$x -lt $logo.Width;$x++){if($logo.GetPixel($x,$y).A -gt 32){$left=[Math]::Min($left,$x);$right=[Math]::Max($right,$x);$top=[Math]::Min($top,$y);$bottom=[Math]::Max($bottom,$y)}}}
  $rect=New-Object Drawing.Rectangle($left,$top,($right-$left+1),($bottom-$top+1))
  Export-Png $logo 'hacklike43-logo.png' 1200 ([int][Math]::Round(1200*$rect.Height/$rect.Width)) $rect
} finally { $logo.Dispose() }
$icon=[Drawing.Bitmap]::FromFile($IconSource)
try {
  $rect=New-Object Drawing.Rectangle(0,0,$icon.Width,$icon.Height)
  foreach($size in @(16,32,48,192,512)){Export-Png $icon "hacklike43-icon-$size.png" $size $size $rect}
  Export-Png $icon 'apple-touch-icon.png' 180 180 $rect
} finally { $icon.Dispose() }
# PNG-backed ICO entries preserve alpha and support modern browsers.
$stream=[IO.File]::Create((Join-Path $assetDir 'favicon.ico'))
$writer=New-Object IO.BinaryWriter($stream)
try {
  $sizes=@(16,32,48); $blobs=@($sizes | ForEach-Object {,[IO.File]::ReadAllBytes((Join-Path $assetDir "hacklike43-icon-$_.png"))})
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]3);$offset=6+16*3
  for($i=0;$i -lt 3;$i++){$writer.Write([byte]$sizes[$i]);$writer.Write([byte]$sizes[$i]);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$blobs[$i].Length);$writer.Write([uint32]$offset);$offset+=$blobs[$i].Length}
  foreach($blob in $blobs){$writer.Write([byte[]]$blob)}
} finally {$writer.Dispose();$stream.Dispose()}
