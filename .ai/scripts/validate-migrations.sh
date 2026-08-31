#!/usr/bin/env bash

set -euo pipefail

MIGRATIONS_DIR="${1:-apps/api/prisma/migrations}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
echo "Diretório de migrations ainda não existe."
exit 0
fi

if [[ -n "${GITHUB_EVENT_NAME:-}" ]]; then
  if [[ "$GITHUB_EVENT_NAME" == "pull_request" && -n "${GITHUB_BASE_SHA:-}" ]]; then
    DIFF_RANGE="$GITHUB_BASE_SHA...HEAD"
  elif [[ "$GITHUB_EVENT_NAME" == "push" && -n "${GITHUB_EVENT_BEFORE:-}" && \
        "$GITHUB_EVENT_BEFORE" != "0000000000000000000000000000000000000000" ]]; then
    DIFF_RANGE="$GITHUB_EVENT_BEFORE..HEAD"
  else
    DIFF_RANGE="HEAD"
  fi
else
  DIFF_RANGE="HEAD"
fi

CHANGED_MIGRATIONS=$(git diff --name-status "$DIFF_RANGE" -- "$MIGRATIONS_DIR")
UNTRACKED_MIGRATIONS=$(git ls-files --others --exclude-standard -- "$MIGRATIONS_DIR")

if [[ -n "$UNTRACKED_MIGRATIONS" ]]; then
  UNTRACKED_STATUS=$(printf '%s\n' "$UNTRACKED_MIGRATIONS" | sed 's/^/A\t/')
  CHANGED_MIGRATIONS=$(printf '%s\n%s' "$CHANGED_MIGRATIONS" "$UNTRACKED_STATUS")
fi

echo "Migrations alteradas:"
echo "$CHANGED_MIGRATIONS"

ALTERED_APPLIED=$(
echo "$CHANGED_MIGRATIONS" |
awk '$1 != "A" && $1 != "" { print $NF }'
)

if [[ -n "$ALTERED_APPLIED" ]]; then
echo
echo "Atenção: migrations existentes foram modificadas, removidas ou renomeadas:"
echo "$ALTERED_APPLIED"
echo
echo "Crie uma migration nova em vez de alterar uma existente."
exit 1
fi

echo "Nenhuma migration existente modificada."
