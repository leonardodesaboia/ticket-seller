#!/usr/bin/env bash

set -euo pipefail

TASK_FILE="${1:-}"

if [[ -z "$TASK_FILE" ]]; then
echo "Uso: $0 .ai/tasks/TASK-000-name.md"
exit 1
fi

if [[ ! -f "$TASK_FILE" ]]; then
echo "Tarefa não encontrada: $TASK_FILE"
exit 1
fi

echo "Arquivos alterados:"
git diff --name-only
git diff --cached --name-only

echo
echo "Revise se todos os arquivos estão permitidos em:"
echo "$TASK_FILE"

echo
echo "Este script não decide automaticamente o escopo."
echo "Ele apresenta os arquivos para validação humana ou do agente."