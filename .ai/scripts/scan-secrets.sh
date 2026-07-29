#!/usr/bin/env bash

set -euo pipefail

# Single-quoted strings cannot contain literal single quotes in bash.
# Use ANSI $'...' quoting so \' works correctly inside the pattern.
PATTERN=$'(api[-]?key|secret|password|private[-]?key|access[-]?token|client[-]?secret)[[:space:]][:=][[:space:]]["\'][^"\']+'

# Resolve which files to scan based on execution context.
#
# In CI (GITHUB_EVENT_NAME is set automatically by GitHub Actions):
#   pull_request — diff against the PR base commit
#   push         — diff against the commit before this push
#   other        — scan all tracked files (safe fallback)
#
# Locally (no GITHUB_EVENT_NAME):
#   try staged files, then unstaged, then all tracked files.
if [[ -n "${GITHUB_EVENT_NAME:-}" ]]; then
  if [[ "$GITHUB_EVENT_NAME" == "pull_request" && -n "${GITHUB_BASE_SHA:-}" ]]; then
    FILES=$(git diff --name-only "$GITHUB_BASE_SHA"...HEAD 2>/dev/null || git ls-files)
  elif [[ "$GITHUB_EVENT_NAME" == "push" && -n "${GITHUB_EVENT_BEFORE:-}" && \
          "$GITHUB_EVENT_BEFORE" != "0000000000000000000000000000000000000000" ]]; then
    FILES=$(git diff --name-only "$GITHUB_EVENT_BEFORE" HEAD 2>/dev/null || git ls-files)
  else
    FILES=$(git ls-files)
  fi
else
  FILES=$(git diff --name-only --cached)
  if [[ -z "$FILES" ]]; then
    FILES=$(git diff --name-only)
  fi
  if [[ -z "$FILES" ]]; then
    FILES=$(git ls-files)
  fi
fi

# Strip generated/build directories that should never contain secrets
# but would produce excessive false-positive noise.
FILES=$(echo "$FILES" | grep -v -E '^(node_modules|\.next|dist|\.turbo|build)/' || true)

if [[ -z "$FILES" ]]; then
  echo "Nenhum arquivo para escanear."
  exit 0
fi

FAILED=0

while IFS= read -r file; do
  [[ -f "$file" ]] || continue

  if grep -Ein "$PATTERN" "$file"; then
    echo "Possível secret em: $file"
    FAILED=1
  fi
done <<< "$FILES"

if [[ "$FAILED" -ne 0 ]]; then
  echo "Possíveis secrets encontrados."
  echo "Revise antes de continuar."
  exit 1
fi

echo "Nenhum padrão óbvio de secret encontrado."
