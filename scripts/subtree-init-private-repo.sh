#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

PUBLIC_REMOTE_URL="https://github.com/img-man/img-man.git"
PRIVATE_REMOTE_URL=""
PUBLIC_BRANCH="main"
SUBTREE_PREFIX="upstream/img-man"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --private-remote) PRIVATE_REMOTE_URL="$2"; shift 2 ;;
    --public-remote)  PUBLIC_REMOTE_URL="$2"; shift 2 ;;
    --branch)         PUBLIC_BRANCH="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$PRIVATE_REMOTE_URL" ]] || { echo "ERROR: --private-remote is required" >&2; exit 1; }

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

log() { echo "[subtree-init] $*"; }

log "Cloning private repo into $WORKDIR ..."
git clone "$PRIVATE_REMOTE_URL" "$WORKDIR/private-repo"
cd "$WORKDIR/private-repo"

git remote add public "$PUBLIC_REMOTE_URL"
git fetch public "$PUBLIC_BRANCH"

git subtree add \
  --prefix="$SUBTREE_PREFIX" \
  public "$PUBLIC_BRANCH" \
  --squash \
  -m "chore: seed public img-man core at $SUBTREE_PREFIX ($(date -u +%Y-%m-%dT%H:%M:%SZ))"

mkdir -p \
  apps/landing \
  apps/cloud-console \
  apps/white-label-demo \
  packages/imageman-whitelabel \
  packages/imageman-cloud-support \
  packages/premium-templates \
  overlays/imageman-service \
  scripts

cat > overlays/imageman-service/README.md <<'EOF'
# Private overlay

- Do not edit upstream/img-man directly.
- Shared fixes go upstream first.
- Put private overrides in overlays/imageman-service/.
EOF

cat > scripts/sync-public.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
git fetch public main
git subtree pull --prefix=upstream/img-man public main --squash -m "chore: sync public core $(date -u +%Y-%m-%dT%H:%M:%SZ)"
EOF

chmod +x scripts/sync-public.sh
git add apps packages overlays scripts
git commit -m "chore: scaffold private wrapper around public img-man"
git push origin HEAD

log "Private repo initialized. Next step: clone it locally and add your overlays."
