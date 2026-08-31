#!/usr/bin/env bash

set -euo pipefail

FILES=$(
  {
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  } | sort -u
)

if [[ -z "$FILES" ]]; then
echo "Nenhum arquivo alterado."
exit 0
fi

echo "Arquivos alterados:"
echo "$FILES"
echo

if echo "$FILES" | grep -q '^apps/api/'; then
echo "Alteração no backend detectada."
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
fi

if echo "$FILES" | grep -q '^apps/marketplace-web/'; then
echo "Alteração no marketplace detectada."
pnpm --filter marketplace-web lint
pnpm --filter marketplace-web typecheck
pnpm --filter marketplace-web test
fi

if echo "$FILES" | grep -q '^apps/backoffice-web/'; then
echo "Alteração no backoffice detectada."
pnpm --filter backoffice-web lint
pnpm --filter backoffice-web typecheck
pnpm --filter backoffice-web test
fi

echo "Validações afetadas concluídas."
