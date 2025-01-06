#!/bin/bash

# 确保目录存在
mkdir -p assets/icon.iconset

# 生成不同尺寸的图标
convert assets/icon.svg -resize 16x16 assets/icon.iconset/icon_16x16.png
convert assets/icon.svg -resize 32x32 assets/icon.iconset/icon_16x16@2x.png
convert assets/icon.svg -resize 32x32 assets/icon.iconset/icon_32x32.png
convert assets/icon.svg -resize 64x64 assets/icon.iconset/icon_32x32@2x.png
convert assets/icon.svg -resize 128x128 assets/icon.iconset/icon_128x128.png
convert assets/icon.svg -resize 256x256 assets/icon.iconset/icon_128x128@2x.png
convert assets/icon.svg -resize 256x256 assets/icon.iconset/icon_256x256.png
convert assets/icon.svg -resize 512x512 assets/icon.iconset/icon_256x256@2x.png
convert assets/icon.svg -resize 512x512 assets/icon.iconset/icon_512x512.png
convert assets/icon.svg -resize 1024x1024 assets/icon.iconset/icon_512x512@2x.png

# 生成 icns 文件
iconutil -c icns assets/icon.iconset -o assets/icon.icns
