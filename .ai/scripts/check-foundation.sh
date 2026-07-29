#!/usr/bin/env bash

set -euo pipefail

REQUIRED_FILES=(
"AGENTS.md"
"README.md"
".gitignore"
"docs/INDEX.md"
"docs/PROJECT.md"
"docs/DOMAIN.md"
"docs/ARCHITECTURE.md"
"docs/REPOSITORY_MAP.md"
"docs/CURRENT_STATE.md"
"docs/decisions/ADR-001-modular-monolith.md"
"docs/decisions/ADR-002-postgresql.md"
"docs/decisions/ADR-003-payment-gateway-port.md"
".ai/templates/TASK_TEMPLATE.md"
".ai/templates/ADR_TEMPLATE.md"
".ai/templates/REPORT_TEMPLATE.md"
".ai/workflows/PLAN.md"
".ai/workflows/IMPLEMENT.md"
".ai/workflows/REVIEW.md"
".ai/workflows/FIX.md"
".ai/tasks/TASK-001-project-foundation.md"
)

FAILED=0

for file in "${REQUIRED_FILES[@]}"; do
if [[ ! -f "$file" ]]; then
echo "Faltando: $file"
FAILED=1
fi
done

if [[ "$FAILED" -ne 0 ]]; then
echo
echo "Fundação incompleta."
exit 1
fi

echo "Fundação documental completa."