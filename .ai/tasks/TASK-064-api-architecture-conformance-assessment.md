# TASK-064 — Avaliação de conformidade arquitetural da API

## Status

COMPLETED

## Objetivo

Avaliar a aderência estática da API à arquitetura hexagonal e identificar melhorias necessárias para manter integrações externas agnósticas a provedores.

## Resultado observável

Relatório com evidências por arquivo, classificação de risco e uma ordem de remediação sem mudanças de código.

## Contexto obrigatório

- `AGENTS.md`
- `.ai/tasks/TASK-064-api-architecture-conformance-assessment.md`
- `docs/ARCHITECTURE.md`
- `docs/decisions/ADR-004-application-folder-architecture.md`
- `docs/CURRENT_STATE.md`
- módulos `payments`, `finance`, `notifications`, `media`, `identity` e `tickets`

## Arquivos permitidos

- `.ai/tasks/TASK-064-api-architecture-conformance-assessment.md`
- `.ai/reports/TASK-064-api-architecture-conformance-assessment.md`

## Arquivos proibidos

- código de produção e testes;
- migrations;
- contratos públicos;
- arquivos de configuração de provedores.

## Requisitos funcionais

- Avaliar direção de dependências entre `domain`, `application`, `infrastructure` e `presentation`.
- Avaliar isolamento entre módulos e abstrações de integrações externas.
- Registrar riscos e recomendações priorizadas.

## Requisitos técnicos

- Não alterar comportamento da API.
- Basear os achados no ADR-004 e na arquitetura oficial.
- Usar somente evidências verificáveis do repositório.

## Invariantes

- Nenhuma mudança de código, banco, contrato ou configuração será realizada.
- Recomendações não constituem decisão arquitetural aceita.

## Segurança

- Não expor valores de variáveis de ambiente ou segredos.
- Registrar riscos de bootstrap e integração sem alterar credenciais.

## Multi-tenancy

Não aplicável diretamente: a tarefa avalia estrutura arquitetural, sem executar ou alterar acesso a recursos de organizações.

## Concorrência

Avaliar o desenho de workers, outbox e transações; não executar operações concorrentes.

## Idempotência

Avaliar contratos de pagamentos, webhooks e outbox; não alterar chaves ou fluxos de idempotência.

## Fora do escopo

- Implementar as correções encontradas.
- Escolher PSP, fila, broker ou provedor de email.
- Criar ou alterar ADR.
- Alterar deployments ou ambientes.

## Critérios de aceite

- Relatório criado com achados classificados e evidências.
- Nenhum arquivo de código ou configuração alterado.
- Próxima tarefa recomendada identificada.

## Comandos

- buscas estáticas com `rg`;
- inspeção de documentação oficial.

## Conclusão esperada

### Arquivos alterados

- documentos de tarefa e relatório da auditoria.

### Implementado

- avaliação estática de conformidade arquitetural.

### Testes

- não aplicável; nenhuma mudança de código.

### Decisões

- nenhuma decisão arquitetural foi tomada.

### Pendências

- aprovar uma task de remediação arquitetural priorizada.

### Próxima tarefa

- definir e aprovar a remediação de configuração e contrato agnóstico de pagamentos.
