#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 <docker-username>"
  echo "Example: $0 mydockerhubuser"
  exit 1
fi

USERNAME="$1"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
services=(message-service user-service group-service frontend)

for svc in "${services[@]}"; do
  svc_dir="$repo_root/$svc"
  if [[ ! -d "$svc_dir" ]]; then
    echo "Skipping $svc: directory not found at $svc_dir"
    continue
  fi

  echo
  echo "=== Processing $svc ==="
  echo "Building $svc..."
  
  docker build \
  --pull=false \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from "${USERNAME}/${svc}:latest" \
  -t "${USERNAME}/${svc}:latest" \
  "$svc_dir"

  echo "Pushing image for $svc..."
  docker push "${USERNAME}/${svc}:latest"

  echo "✅ Pushed ${USERNAME}/${svc}:latest"
done

echo
echo "🎉 All images built and pushed successfully"