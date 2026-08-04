#!/bin/bash
# Macht aus den Originalfotos in img-src/ die Avatare in public/img/.
#
# Der Avatar wird mit 90 px angezeigt und rund beschnitten, 256 px reichen
# also auch auf einem 3x-Display. Erst quadratisch zuschneiden (genau das,
# was object-fit: cover im Browser tut), dann als WebP verkleinern.
#
# Braucht cwebp:  brew install webp
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p public/img
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for f in img-src/*.jpg; do
  n=$(basename "$f" .jpg)
  w=$(sips -g pixelWidth "$f" | tail -1 | awk '{print $2}')
  h=$(sips -g pixelHeight "$f" | tail -1 | awk '{print $2}')
  m=$(( w < h ? w : h ))
  sips -c "$m" "$m" "$f" --out "$tmp/$n.jpg" >/dev/null
  cwebp -quiet -q 80 -resize 256 256 "$tmp/$n.jpg" -o "public/img/$n.webp"
  echo "$n.webp  $(du -h "public/img/$n.webp" | cut -f1)"
done
