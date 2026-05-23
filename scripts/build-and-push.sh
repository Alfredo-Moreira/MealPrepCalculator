#!/usr/bin/env bash
set -euo pipefail

REGISTRY="192.168.4.99:5000"
IMAGE_NAME="meal-prep-calculator"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(cat "${SCRIPT_DIR}/../VERSION" | tr -d '[:space:]')"
TAG="${1:-${VERSION}}"
FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${TAG}"
LATEST_TAG="${REGISTRY}/${IMAGE_NAME}:latest"

echo "==> Setting up multi-platform builder"
docker buildx inspect multiplatform-builder &>/dev/null \
  && docker buildx rm multiplatform-builder
docker buildx create \
  --name multiplatform-builder \
  --config "${SCRIPT_DIR}/buildkitd.toml" \
  --use

echo "==> Building image: ${FULL_TAG}"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --push \
  -t "${FULL_TAG}" \
  -t "${LATEST_TAG}" \
  "$(dirname "$0")/.."

echo "==> Done. Image available at ${FULL_TAG}"
echo ""
echo "Run with:"
echo "  docker run -d -p 3001:3001 \\"
echo "    -e MONGODB_URI=mongodb://<host>:<port>/meal-prep \\"
echo "    ${FULL_TAG}"
