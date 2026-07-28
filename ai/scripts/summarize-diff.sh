#!/usr/bin/env bash

set -euo pipefail

echo "# Resumo do diff"
echo
echo "## Estatísticas"
echo
git diff --stat

echo
echo "## Arquivos alterados"
echo
git diff --name-status

echo
echo "## Diff"
echo
git diff --unified=3