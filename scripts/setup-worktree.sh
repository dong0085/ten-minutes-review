#!/bin/sh
# Prepares a git worktree for `pnpm dev`: links the main checkout's .env,
# adds the apps/web/.env link sign-in needs, and installs dependencies.
# Run it from anywhere inside the worktree. Safe to run again.
set -e

worktree=$(git rev-parse --show-toplevel)
main=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)

if [ "$worktree" = "$main" ]; then
  echo "This is the main checkout; nothing to link."
else
  if [ ! -f "$main/.env" ]; then
    echo "No .env in $main. Create it there first." >&2
    exit 1
  fi
  ln -sf "$main/.env" "$worktree/.env"
  echo "Linked .env -> $main/.env"
fi

ln -sf ../../.env "$worktree/apps/web/.env"
echo "Linked apps/web/.env -> ../../.env"

cd "$worktree" && pnpm install
