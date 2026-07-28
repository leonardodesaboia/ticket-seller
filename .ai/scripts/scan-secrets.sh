#!/usr/bin/env bash

set -euo pipefail

PATTERN='(api[-]?key|secret|password|private[-]?key|access[-]?token|client[-]?secret)[[:space:]][:=][[:space:]]["'''][^"''']+'

FILES=$(git diff --name-only --cached)

if [[ -z "$FILES" ]]; then
FILES=$(git diff --name-only)
fi

if [[ -z "$FILES" ]]; then
echo "Nenhum arquivo alterado."
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