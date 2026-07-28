# Fluxo padrão para criação de features com IA

## Objetivo

Garantir que cada feature seja implementada com:

* contexto limitado;
* escopo claro;
* arquitetura preservada;
* testes adequados;
* revisão independente;
* documentação atualizada.

---

## Fluxo geral

```text
IDEIA
→ ESPECIFICAÇÃO
→ TAREFA
→ PLAN
→ APROVAÇÃO
→ IMPLEMENT
→ TESTES
→ REVIEW
→ FIX
→ VALIDAÇÃO FINAL
→ DOCUMENTAÇÃO
→ COMMIT / PR
```

---

## 1. Definir a feature

Antes de escrever código, registrar:

* problema que será resolvido;
* usuário da funcionalidade;
* comportamento esperado;
* regras de negócio;
* invariantes;
* permissões;
* o que está fora do escopo;
* critérios de conclusão.

Exemplo:

```text
Feature: criação de evento

Usuário:
Membro da organização com permissão EVENT_MANAGER.

Resultado:
Criar evento em estado DRAFT.

Regras:
- evento pertence a uma organização;
- usuário deve pertencer à organização;
- data final não pode ser anterior à inicial;
- evento não é publicado automaticamente.

Fora do escopo:
- lotes;
- ingressos;
- imagens;
- pagamentos.
```

---

## 2. Verificar se precisa de ADR

Criar ADR quando a feature exigir:

* nova biblioteca estrutural;
* mudança de arquitetura;
* novo banco;
* novo provedor;
* nova estratégia multi-tenant;
* nova forma de comunicação entre módulos;
* alteração relevante em autenticação, filas ou pagamentos.

Features comuns devem seguir a arquitetura existente.

---

## 3. Atualizar a documentação do módulo

Antes da implementação, registrar no documento do módulo:

* responsabilidade;
* entidades;
* casos de uso;
* invariantes;
* estados;
* permissões;
* eventos;
* dependências;
* testes obrigatórios.

A IA deve ler o documento do módulo, não descobrir as regras explorando todo o projeto.

---

## 4. Dividir a feature em tarefas pequenas

Cada tarefa deve possuir:

* um comportamento principal;
* poucos arquivos envolvidos;
* critérios de aceite claros;
* contexto limitado.

Evitar:

```text
Implementar todo o módulo de eventos.
```

Preferir:

```text
TASK-012 — Criar entidade Event
TASK-013 — Criar CreateEventUseCase
TASK-014 — Criar repository
TASK-015 — Criar endpoint POST /events
TASK-016 — Criar formulário no frontend
TASK-017 — Criar teste E2E
```

---

## 5. Criar o arquivo da tarefa

Usar:

```text
.ai/tasks/TASK-000-description.md
```

A tarefa deve informar:

* objetivo;
* resultado observável;
* contexto obrigatório;
* arquivos permitidos;
* arquivos proibidos;
* requisitos;
* invariantes;
* segurança;
* multi-tenancy;
* concorrência;
* idempotência;
* fora do escopo;
* critérios de aceite;
* comandos de validação.

---

## 6. Limitar o contexto

Enviar para a IA somente:

```text
1 AGENTS.md
1 arquivo de tarefa
1 documento do módulo
2 a 6 arquivos de código
1 a 3 arquivos de teste
```

Não pedir para a IA ler o repositório inteiro.

Caso uma tarefa exija muitos arquivos, dividi-la.

---

## 7. Executar PLAN

No modo PLAN, a IA não pode alterar arquivos.

Ela deve apresentar:

1. entendimento da tarefa;
2. solução proposta;
3. arquivos que pretende alterar;
4. fluxo da operação;
5. invariantes;
6. riscos;
7. impacto em segurança;
8. impacto multi-tenant;
9. concorrência e idempotência;
10. testes necessários.

### Prompt padrão

```text
Trabalhe em modo PLAN.

Leia:
- AGENTS.md
- arquivo da tarefa
- contexto obrigatório da tarefa

Não altere arquivos.

Apresente:
1. entendimento;
2. solução;
3. arquivos envolvidos;
4. fluxo;
5. invariantes;
6. riscos;
7. testes.

Não aumente o escopo.
```

---

## 8. Revisar o plano

Antes de aprovar, verificar:

* o objetivo foi entendido?
* os arquivos fazem parte do escopo?
* há refatorações desnecessárias?
* existe nova dependência sem necessidade?
* multi-tenancy foi considerado?
* segurança foi considerada?
* os testes são suficientes?
* o fora do escopo foi respeitado?

Reduzir o plano quando ele estiver grande demais.

---

## 9. Executar IMPLEMENT

Depois da aprovação:

```text
Trabalhe em modo IMPLEMENT.

Implemente somente o plano aprovado.

Regras:
- altere apenas arquivos permitidos;
- não aumente o escopo;
- não faça refatorações oportunistas;
- não instale dependências sem autorização;
- escreva os testes previstos;
- execute as validações da tarefa;
- pare caso precise alterar arquivo fora do escopo.
```

---

## 10. Executar testes

Aplicar os testes adequados à feature.

### Testes unitários

Para:

* regras puras;
* estados;
* cálculos;
* validações;
* invariantes.

### Testes de integração

Para:

* PostgreSQL;
* repositories;
* migrations;
* Redis;
* filas;
* transações.

### Testes de contrato

Para:

* PaymentGateway;
* MessageBus;
* ObjectStorage;
* IdentityProvider.

### Testes E2E

Para:

```text
HTTP → caso de uso → banco → resposta
```

### Testes de concorrência

Obrigatórios para:

* estoque;
* reserva;
* pagamento;
* reembolso;
* emissão;
* check-in.

### Testes multi-tenant

Obrigatórios para recursos pertencentes a organizações.

Exemplo:

```text
Organização A tenta acessar recurso da B
→ acesso recusado
```

---

## 11. Executar REVIEW independente

Preferencialmente usar outra sessão ou agente.

O revisor recebe apenas:

* AGENTS.md;
* tarefa;
* documento do módulo;
* diff;
* testes alterados.

O revisor deve verificar:

* aderência ao escopo;
* regras de negócio;
* arquitetura;
* segurança;
* multi-tenancy;
* autorização;
* concorrência;
* idempotência;
* transações;
* exposição de dados;
* qualidade dos testes.

Classificação:

```text
BLOQUEANTE
ALTO
MÉDIO
BAIXO
```

Problemas bloqueantes e altos devem ser corrigidos antes do merge.

---

## 12. Executar FIX

Corrigir somente os problemas aprovados.

```text
Trabalhe em modo FIX.

Corrija apenas:
- problema 1;
- problema 2.

Não aplique outras sugestões.
Não aumente o escopo.
Atualize testes quando necessário.
Execute novamente as validações afetadas.
```

---

## 13. Fazer validação final

Executar, quando disponíveis:

```bash
git diff --check

.ai/scripts/validate-architecture.sh
.ai/scripts/validate-migrations.sh
.ai/scripts/scan-secrets.sh
.ai/scripts/test-affected.sh

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Quando aplicável:

```bash
pnpm test:integration
pnpm test:e2e
pnpm test:concurrency
```

Não aceitar:

* testes ignorados;
* `@ts-ignore`;
* `any` sem justificativa;
* validação removida;
* `catch {}` vazio;
* teste crítico reprovado;
* migration aplicada modificada;
* secret no código;
* SDK externo fora do adapter.

---

## 14. Revisar o diff manualmente

Verificar:

### Escopo

Apenas arquivos necessários foram alterados?

### Segurança

Autorização, tenant e validação estão corretos?

### Dados

Transações, constraints e idempotência estão presentes?

### Arquitetura

Os limites dos módulos foram respeitados?

### Manutenção

O próximo agente entenderá a feature sem reler todo o projeto?

Comandos:

```bash
git diff --stat
git diff --name-status
git diff
```

---

## 15. Atualizar a memória do projeto

Ao concluir:

### Relatório da tarefa

Criar:

```text
.ai/reports/TASK-000-description.md
```

### Documentação do módulo

Atualizar quando houver:

* nova regra;
* novo estado;
* nova invariante;
* nova porta;
* novo evento.

### Estado atual

Atualizar `docs/CURRENT_STATE.md` apenas quando houver avanço relevante.

### ADR

Criar somente quando houver decisão arquitetural.

---

## 16. Fazer commit pequeno

Usar commits focados:

```text
feat(events): add create event use case [TASK-013]
fix(payments): prevent duplicate webhook processing [BUG-014]
test(checkin): add concurrent validation scenario
```

Evitar:

```text
updates
final
fix stuff
implement many things
```

---

## 17. Fluxo resumido

```text
1. Definir a feature
2. Atualizar o módulo
3. Dividir em tarefas
4. Criar a TASK
5. Limitar o contexto
6. Executar PLAN
7. Aprovar o plano
8. Executar IMPLEMENT
9. Rodar testes
10. Executar REVIEW independente
11. Aprovar correções
12. Executar FIX
13. Rodar validação final
14. Conferir o diff
15. Criar relatório
16. Atualizar documentação
17. Fazer commit
18. Abrir pull request
```

---

## Regra de ouro

> Uma sessão de IA deve receber somente o contexto necessário para concluir uma tarefa e nunca autoridade para expandir o próprio escopo.

A IA não deve decidir, implementar e aprovar sozinha uma feature completa.

Planejamento, implementação e revisão devem ser etapas separadas.
