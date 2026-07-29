#!/usr/bin/env bash

set -euo pipefail

MIGRATIONS_DIR="${1:-apps/api/prisma/migrations}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
echo "Diretório de migrations ainda não existe."
exit 0
fi

echo "Migrations alteradas:"
git diff --name-status -- "$MIGRATIONS_DIR"

MODIFIED_APPLIED=$(
git diff --name-status -- "$MIGRATIONS_DIR" |
awk '$1 == "M" { print $2 }'
)

if [[ -n "$MODIFIED_APPLIED" ]]; then
echo
echo "Atenção: migrations existentes foram modificadas:"
echo "$MODIFIED_APPLIED"
echo
echo "Crie uma migration nova em vez de alterar uma existente."
exit 1
fi

echo "Nenhuma migration existente modificada."