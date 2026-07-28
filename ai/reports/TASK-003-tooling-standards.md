Relatório da TASK-003 — Padronização de ferramentas do workspace

Status

COMPLETED

Arquivos alterados

packages/tsconfig/package.json: criado — package interno @ticket-seller/tsconfig
packages/tsconfig/base.json: criado — configuração TypeScript strict base para todos os packages
packages/tsconfig/library.json: criado — configuração para packages compartilhados (composite, outDir, rootDir)
tsconfig.json: criado — orchestrador vazio na raiz (files[], references[])
.prettierrc: criado — configuração Prettier (JSON) compartilhada
.prettierignore: criado — exclui documentação, markdown, diretórios do harness Claude e build artifacts
eslint.config.mjs: criado — ESLint 10 flat config com typescript-eslint e eslint-config-prettier
package.json: modificado — adicionados devDependencies e scripts format:check e format:write
turbo.json: modificado — adicionada task format:check
pnpm-lock.yaml: atualizado por pnpm install

Implementado

TypeScript 5.9.3 configurado com strict mode e todas as opções de rigor habilitadas
Package @ticket-seller/tsconfig reconhecido pelo workspace pnpm
ESLint 10 com flat config e integração typescript-eslint sem type-aware (base)
Prettier configurado e verificado: todos os arquivos de código passam no check
Scripts format:check e format:write funcionando na raiz
Turbo orquestra format:check como task cacheável

Decisões tomadas

TypeScript 5.9.3 escolhido em vez de 7.0.2: typescript-eslint@8.65.0 exige ">=4.8.4 <6.1.0"; TypeScript 7.x (recompilador Go) ainda não é suportado pela cadeia de ferramentas ESLint
eslint.config.mjs usa extensão .mjs para garantir ESM independentemente do campo type do package.json
Type-aware linting (strictTypeChecked + parserOptions.project) não configurado nesta tarefa: requer tsconfig por package com src/; será ativado quando apps existirem
Markdown excluído do Prettier via .prettierignore: documentação é free-form e não deve ser reformatada automaticamente
.ai/ e .claude/ excluídos do Prettier: diretórios gerenciados pelo harness Claude Code, não código do projeto
prettier --write executado nos 3 arquivos que divergiam (eslint.config.mjs, packages/tsconfig/package.json, pnpm-workspace.yaml)

Testes executados

Comando	Resultado
node --version	aprovado (v22.18.0)
pnpm --version	aprovado (11.17.0)
pnpm install	aprovado (sem peer issues após TypeScript 5.9.3)
pnpm peers check	aprovado (No peer dependency issues found)
pnpm format:check	aprovado (All matched files use Prettier code style!)
pnpm lint	aprovado (1 package em scope, 0 tasks executadas — esperado)
pnpm typecheck	aprovado (1 package em scope, 0 tasks executadas — esperado)
git diff --check	aprovado (sem trailing whitespace)

Riscos identificados

Arquivos ai/ aparecem como deletados no git diff: o harness Claude Code moveu o conteúdo de ai/ para .ai/ (oculto) em algum momento da sessão; não está relacionado à TASK-003 e não foi causado por nenhuma ação desta implementação
Type-aware linting desabilitado por ora: regras como no-floating-promises e no-unsafe-* só entrarão em vigor quando apps tiverem tsconfig próprio
exactOptionalPropertyTypes: true é restritiva; libs de terceiros com tipos mal declarados podem causar erros (mitigado por skipLibCheck: true)

Pendências

Type-aware linting: configurar parserOptions.project por app/package quando primeiro app for criado
nestjs.json e nextjs.json em packages/tsconfig/: criar quando as respectivas apps forem inicializadas
Inconsistência ai/ vs .ai/: investigar e consolidar em tarefa futura; o harness usa .ai/ enquanto a documentação e CLAUDE.md do projeto referencia .ai/ (alinhado) mas o repositório original usava ai/ (sem ponto)

Documentação atualizada

docs/CURRENT_STATE.md atualizado

Próxima tarefa recomendada

TASK-004 — Infraestrutura local: Docker Compose com PostgreSQL e Redis para ambiente de desenvolvimento
