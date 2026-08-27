#!/usr/bin/env bash
# validate-architecture.sh — Hexagonal architecture guardrails
#
# Checks enforced (all cause exit 1):
#   1. domain/  must not import NestJS, Prisma, Fastify, Redis, cloud/payment SDKs
#   2. domain/  must not import from application/ (upper-layer violation)
#   3. application/ must not import NestJS, Prisma, Fastify, Redis, cloud/payment SDKs
#   4. Any file must not cross into another module's infrastructure via relative path
#      Pattern: from '([../]+)[ModuleName]/infrastructure/' — must have a real dir name
#      followed by /infrastructure/, which indicates crossing a module boundary.
#   5. Modules may only consume another module through its public contracts/
#   6. presentation/controllers must not import PrismaService or @prisma directly
#
# Infrastructure (infrastructure/) and presentation (presentation/) may import NestJS/Prisma.
# Platform files are excluded from module-boundary checks.
#
# Usage: bash .ai/scripts/validate-architecture.sh [root-dir]
#   root-dir defaults to apps/api/src

set -euo pipefail

ROOT="${1:-apps/api/src}"

if [[ ! -d "$ROOT" ]]; then
  echo "Diretório ainda não existe: $ROOT"
  echo "Validação ignorada durante a fase de fundação."
  exit 0
fi

FAILED=0

# ── 1. domain: forbidden external deps ───────────────────────────────────────

echo "Verificando imports proibidos no domínio (domain/)..."

FORBIDDEN_IN_DOMAIN='@nestjs|@prisma|ioredis|@aws-sdk|stripe|asaas|pagbank|pagarme|fastify'

while IFS= read -r file; do
  if grep -En "$FORBIDDEN_IN_DOMAIN" "$file" > /dev/null 2>&1; then
    echo "  VIOLAÇÃO [domain-infra] $file"
    grep -En "$FORBIDDEN_IN_DOMAIN" "$file" | sed 's/^/    /'
    FAILED=1
  fi
done < <(find "$ROOT" -type f -path '*/domain/*' -name '*.ts' ! -path '*/node_modules/*')

# ── 2. domain: must not import from application (upper-layer) ────────────────

echo "Verificando violações upper-layer em domain/ (domain não pode importar de application)..."

while IFS= read -r file; do
  if grep -En "from ['\"].*\/application\/" "$file" > /dev/null 2>&1; then
    echo "  VIOLAÇÃO [domain-upper-layer] $file"
    grep -En "from ['\"].*\/application\/" "$file" | sed 's/^/    /'
    FAILED=1
  fi
done < <(find "$ROOT" -type f -path '*/domain/*' -name '*.ts' ! -path '*/node_modules/*')

# ── 3. application: forbidden external deps ───────────────────────────────────

echo "Verificando imports proibidos na camada de application (application/)..."

FORBIDDEN_IN_APPLICATION='@nestjs|@prisma|ioredis|@aws-sdk|stripe|asaas|pagbank|pagarme|fastify|platform/(database|config|messaging|observability|security)'

while IFS= read -r file; do
  if grep -En "$FORBIDDEN_IN_APPLICATION" "$file" > /dev/null 2>&1; then
    echo "  VIOLAÇÃO [application-infra] $file"
    grep -En "$FORBIDDEN_IN_APPLICATION" "$file" | sed 's/^/    /'
    FAILED=1
  fi
done < <(find "$ROOT" -type f -path '*/application/*' -name '*.ts' ! -path '*/node_modules/*')

# ── 4. cross-module infrastructure imports ────────────────────────────────────
#
# Detects: from '([../]+)[ModuleName]/infrastructure/'
# Logic: any relative import that navigates up (../+) and then enters a directory
# whose name starts with a letter (a real module name, not '..') followed by
# '/infrastructure/' is crossing into another module's infrastructure.
#
# Allowed:  from './infrastructure/...'   (same-module, no ../ prefix)
#           from '../../domain/...'       (same-module domain)
# Forbidden: from '../events/infrastructure/...'
#            from '../../organizations/infrastructure/...'

echo "Verificando imports de infraestrutura de outro módulo (cross-module infra)..."

# Regex: from quote + (../)+ + [letter-starting dir name] + /infrastructure/
CROSS_MODULE_INFRA_PATTERN="from ['\"](\\.\\./)+[a-zA-Z][^/'\"]*\/infrastructure\/"

while IFS= read -r file; do
  if grep -En "$CROSS_MODULE_INFRA_PATTERN" "$file" > /dev/null 2>&1; then
    echo "  VIOLAÇÃO [cross-module-infra] $file"
    grep -En "$CROSS_MODULE_INFRA_PATTERN" "$file" | sed 's/^/    /'
    FAILED=1
  fi
done < <(find "$ROOT" -type f -name '*.ts' ! -path '*/node_modules/*')

# ── 5. cross-module internal layer imports ────────────────────────────────────

echo "Verificando imports de camadas internas de outro módulo..."

CROSS_MODULE_INTERNAL_LAYER_PATTERN="from ['\"](\.\./)+[a-zA-Z][^/'\"]*/(domain|application|infrastructure)/"

while IFS= read -r file; do
  if grep -En "$CROSS_MODULE_INTERNAL_LAYER_PATTERN" "$file" > /dev/null 2>&1; then
    echo "  VIOLAÇÃO [cross-module-internal-layer] $file"
    grep -En "$CROSS_MODULE_INTERNAL_LAYER_PATTERN" "$file" | sed 's/^/    /'
    FAILED=1
  fi
done < <(find "$ROOT/modules" -type f -name '*.ts' ! -path '*/node_modules/*')

# ── 6. controllers: no direct Prisma usage ────────────────────────────────────

echo "Verificando Prisma em controllers de módulos de negócio..."

while IFS= read -r file; do
  if grep -En 'PrismaService|@prisma' "$file" > /dev/null 2>&1; then
    echo "  VIOLAÇÃO [controller-prisma] $file"
    grep -En 'PrismaService|@prisma' "$file" | sed 's/^/    /'
    FAILED=1
  fi
done < <(find "$ROOT/modules" -type f -name '*controller.ts' ! -path '*/node_modules/*' 2>/dev/null)

# ── result ────────────────────────────────────────────────────────────────────

echo ""
if [[ "$FAILED" -ne 0 ]]; then
  echo "Validação arquitetural REPROVADA — corrija as violações antes de fazer merge."
  exit 1
fi

echo "Validação arquitetural APROVADA."
exit 0
