#!/usr/bin/env bash
# Tests for validate-architecture.sh
# Isolated and deterministic: creates temp fixtures, runs validator, checks exit code, cleans up.
# Usage: bash .ai/scripts/validate-architecture.spec.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-architecture.sh"

PASS=0
FAIL=0
TMPDIR_ROOT=""

# ── helpers ─────────────────────────────────────────────────────────────────

setup() {
  TMPDIR_ROOT="$(mktemp -d)"
}

teardown() {
  rm -rf "$TMPDIR_ROOT"
}

mkfile() {
  local path="$TMPDIR_ROOT/$1"
  mkdir -p "$(dirname "$path")"
  printf '%s\n' "${2:-}" > "$path"
}

# Returns only the numeric exit code of the validator (suppresses its output).
run_validator() {
  local rc=0
  bash "$VALIDATOR" "$TMPDIR_ROOT" > /dev/null 2>&1 || rc=$?
  echo "$rc"
}

assert_exit() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" -eq "$expected" ]]; then
    printf "  PASS: %s\n" "$test_name"
    PASS=$((PASS + 1))
  else
    printf "  FAIL: %s (expected exit %s, got %s)\n" "$test_name" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

# ── T1: clean fixture passes ──────────────────────────────────────────────

test_clean_passes() {
  setup
  mkfile "modules/orders/domain/order.entity.ts" "export class Order {}"
  mkfile "modules/orders/application/use-cases/create-order.use-case.ts" "export class CreateOrderUseCase {}"
  mkfile "modules/orders/infrastructure/repositories/prisma-order.repository.ts" \
    "import { Injectable } from '@nestjs/common'; @Injectable() export class PrismaOrderRepository {}"
  mkfile "modules/orders/presentation/controllers/orders.controller.ts" \
    "import { Controller, Get } from '@nestjs/common';"
  assert_exit "clean fixture passes (exit 0)" 0 "$(run_validator)"
  teardown
}

# ── T2: domain with @prisma/client fails ──────────────────────────────────

test_domain_prisma_fails() {
  setup
  mkfile "modules/tickets/domain/ports/ticket-transfer-repository.port.ts" \
    "import { Prisma } from '@prisma/client'; export type Tx = Prisma.TransactionClient;"
  assert_exit "domain with @prisma/client import fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T3: domain with @nestjs fails ─────────────────────────────────────────

test_domain_nestjs_fails() {
  setup
  mkfile "modules/identity/domain/use-cases/login.use-case.ts" \
    "import { Injectable } from '@nestjs/common'; @Injectable() export class LoginUseCase {}"
  assert_exit "domain with @nestjs import fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T4: application with @nestjs fails ────────────────────────────────────

test_application_nestjs_fails() {
  setup
  mkfile "modules/orders/application/use-cases/create-order.use-case.ts" \
    "import { Injectable, Inject } from '@nestjs/common'; @Injectable() export class CreateOrderUseCase {}"
  assert_exit "application with @nestjs/common fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T5: application with @prisma fails ────────────────────────────────────

test_application_prisma_fails() {
  setup
  mkfile "modules/payments/application/use-cases/create-payment.use-case.ts" \
    "import { PrismaClient } from '@prisma/client'; export class CreatePaymentUseCase {}"
  assert_exit "application with @prisma/client fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T6: application with fastify fails ────────────────────────────────────

test_application_fastify_fails() {
  setup
  mkfile "modules/orders/application/use-cases/do-something.use-case.ts" \
    "import { FastifyRequest } from 'fastify'; export class DoSomethingUseCase {}"
  assert_exit "application with fastify import fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T6b: application with local platform infrastructure fails ─────────────

test_application_platform_database_fails() {
  setup
  mkfile "modules/payments/application/use-cases/process-payment.use-case.ts" \
    "import { PrismaService } from '../../../../platform/database/prisma.service';"
  assert_exit "application with platform/database import fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T7: cross-module infrastructure import fails ──────────────────────────

test_cross_module_infra_fails() {
  setup
  # venues importing from events/infrastructure — the real-world violation
  mkfile "modules/venues/venues.module.ts" \
    "import { PrismaOrganizationAccessAdapter } from '../events/infrastructure/adapters/prisma-organization-access.adapter';"
  assert_exit "cross-module infrastructure import fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T8: cross-module infrastructure via payments/organizations fails ───────

test_cross_module_infra_payments_fails() {
  setup
  mkfile "modules/payments/payments.module.ts" \
    "import { PrismaOrganizationInvitationRepository } from '../organizations/infrastructure/repositories/prisma-organization-invitation.repository';"
  assert_exit "payments importing organizations/infrastructure fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T8b: cross-module internal layer import fails ─────────────────────────

test_cross_module_internal_layer_fails() {
  setup
  mkfile "modules/inventory/application/use-cases/get-availability.use-case.ts" \
    "import { PUBLIC_EVENT_QUERY_PORT } from '../../../events/application/ports/public-event-query.port';"
  assert_exit "inventory importing events/application fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T9: same-module infrastructure import is allowed ──────────────────────

test_same_module_infra_allowed() {
  setup
  mkfile "modules/orders/orders.module.ts" \
    "import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';"
  assert_exit "same-module infrastructure import passes (exit 0)" 0 "$(run_validator)"
  teardown
}

# ── T10: domain importing from application (upper-layer) fails ────────────

test_domain_imports_application_fails() {
  setup
  mkfile "modules/events/domain/publication/public-cursor.ts" \
    "import { SomeAppError } from '../../application/errors/some.error';"
  assert_exit "domain importing from application (upper-layer) fails (exit 1)" 1 "$(run_validator)"
  teardown
}

# ── T11: infrastructure with @nestjs and @prisma is allowed ───────────────

test_infrastructure_nestjs_prisma_allowed() {
  setup
  mkfile "modules/orders/infrastructure/repositories/prisma-order.repository.ts" \
    "import { Injectable } from '@nestjs/common'; import { PrismaClient } from '@prisma/client';"
  assert_exit "infrastructure with @nestjs and @prisma passes (exit 0)" 0 "$(run_validator)"
  teardown
}

# ── T12: presentation controller with @nestjs is allowed ──────────────────

test_presentation_nestjs_allowed() {
  setup
  mkfile "modules/orders/presentation/controllers/orders.controller.ts" \
    "import { Controller, Get } from '@nestjs/common';"
  assert_exit "presentation controller with @nestjs passes (exit 0)" 0 "$(run_validator)"
  teardown
}

# ── T13: module.ts importing own infrastructure is allowed ────────────────

test_module_file_own_infra_allowed() {
  setup
  mkfile "modules/tickets/tickets.module.ts" \
    "import { PrismaTicketTransferRepository } from './infrastructure/repositories/prisma-ticket-transfer.repository';"
  assert_exit "module.ts importing own infrastructure passes (exit 0)" 0 "$(run_validator)"
  teardown
}

# ── runner ────────────────────────────────────────────────────────────────

echo ""
echo "=== validate-architecture.spec.sh ==="
echo ""

test_clean_passes
test_domain_prisma_fails
test_domain_nestjs_fails
test_application_nestjs_fails
test_application_prisma_fails
test_application_fastify_fails
test_application_platform_database_fails
test_cross_module_infra_fails
test_cross_module_infra_payments_fails
test_cross_module_internal_layer_fails
test_same_module_infra_allowed
test_domain_imports_application_fails
test_infrastructure_nestjs_prisma_allowed
test_presentation_nestjs_allowed
test_module_file_own_infra_allowed

echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
exit 0
