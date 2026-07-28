#!/usr/bin/env bash

set -euo pipefail

ROOT="${1:-apps/api/src}"

if [[ ! -d "$ROOT" ]]; then
echo "Diretório ainda não existe: $ROOT"
echo "Validação ignorada durante a fase de fundação."
exit 0
fi

FAILED=0

echo "Verificando imports proibidos no domínio..."

FORBIDDEN_PATTERN='@nestjs|@prisma|ioredis|@aws-sdk|stripe|asaas|pagbank|pagarme|fastify'

while IFS= read -r file; do
if grep -En "$FORBIDDEN_PATTERN" "$file"; then
echo "Import proibido em domínio: $file"
FAILED=1
fi
done < <(find "$ROOT" -type f -path '/domain/' -name '*.ts')

echo "Verificando Prisma em controllers..."

while IFS= read -r file; do
if grep -En 'PrismaService|@prisma' "$file"; then
echo "Prisma encontrado em controller: $file"
FAILED=1
fi
done < <(find "$ROOT" -type f -name '*controller.ts')

if [[ "$FAILED" -ne 0 ]]; then
echo "Validação arquitetural reprovada."
exit 1
fi

echo "Validação arquitetural aprovada."