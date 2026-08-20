#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "用法: $0 <ghcr.io/所有者/镜像名> [标签]" >&2
  exit 2
fi

image=$1
tag=${2:-latest}
builder=jialiyou-linux-builder

case "$image" in
  ghcr.io/*) ;;
  *)
    echo "镜像名必须以 ghcr.io/ 开头" >&2
    exit 2
    ;;
esac

if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
  docker buildx create --name "$builder" --driver docker-container >/dev/null
fi

docker buildx inspect "$builder" --bootstrap >/dev/null
docker buildx build \
  --builder "$builder" \
  --platform linux/amd64 \
  --provenance=true \
  --sbom=true \
  --tag "$image:$tag" \
  --push \
  .
