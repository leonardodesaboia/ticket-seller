# TASK-065 — Configuração explícita e segura do provider de pagamentos

## Status

COMPLETED

## Objetivo

Tornar a seleção do provider de pagamentos explícita e validar toda configuração obrigatória no bootstrap, eliminando a falha de inicialização da API de produção quando o gateway fake estiver selecionado.

## Resultado observável

- A API conhece o provider configurado por `PAYMENT_PROVIDER`.
- Com `NODE_ENV=production` e `PAYMENT_PROVIDER=fake`, a inicialização falha cedo e claramente se `FAKE_GATEWAY_SECRET` estiver ausente.
- O compose de produção entrega a configuração do provider fake à API.
- Desenvolvimento mantém o FakePaymentGateway como provider padrão, sem expor ou registrar secrets.

## Contexto obrigatório

- `AGENTS.md`
- `.ai/coordination/SIMPLE_USAGE.md`
- `.ai/tasks/TASK-065-payment-provider-configuration-hardening.md`
- `docs/ARCHITECTURE.md`
- `docs/modules/payments.md`
- `docs/decisions/ADR-003-payment-gateway-port.md`
- `apps/api/src/platform/config/env.ts`
- `apps/api/src/modules/payments/infrastructure/payments.infrastructure.module.ts`
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.ts`
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.spec.ts`
- `docker-compose.prod.yml`

## Arquivos permitidos

- `apps/api/src/platform/config/env.ts`
- `apps/api/src/platform/config/env.spec.ts` (novo, se necessário)
- `apps/api/src/modules/payments/infrastructure/payments.infrastructure.module.ts`
- `apps/api/src/modules/payments/payments.module.ts`
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.spec.ts`
- `apps/api/.env.example`
- `docker-compose.prod.yml`
- `.ai/reports/TASK-065-payment-provider-configuration-hardening.md`
- `docs/modules/payments.md`
- `docs/CURRENT_STATE.md`

## Arquivos proibidos

- `apps/api/prisma/schema.prisma` e migrations;
- DTOs, controllers e rotas públicas de pagamento;
- contrato `PaymentGatewayPort` e entidade `PaymentAttempt`;
- integrações com Stripe, Asaas, PagBank, Pagar.me ou outro PSP;
- `package.json` e `pnpm-lock.yaml` sem aprovação específica.

## Requisitos funcionais

- Introduzir `PAYMENT_PROVIDER` com o único valor atualmente suportado: `fake`.
- Fazer o wiring de `PAYMENT_GATEWAY_PORT` depender da configuração explícita, apenas na composição de infraestrutura.
- Validar condicionalmente `FAKE_GATEWAY_SECRET` em produção quando `PAYMENT_PROVIDER=fake`.
- Incluir `PAYMENT_PROVIDER` e `FAKE_GATEWAY_SECRET` na configuração de produção e documentá-los no exemplo local.
- Remover bindings duplicados de `PAYMENT_GATEWAY_PORT`, se confirmados durante a implementação, sem mudar o comportamento.

## Requisitos técnicos

- A validação deve acontecer antes de a API aceitar tráfego.
- Nenhum secret pode ser logado, retornado em erro HTTP ou versionado.
- O provider continua sendo resolvido por adapter Nest na infraestrutura; domínio e API pública não devem conhecer variáveis de ambiente.
- Não adicionar dependências.

## Invariantes

- O único gateway efetivamente instanciado no MVP continua sendo `FakePaymentGateway`.
- Idempotência, HMAC com `timingSafeEqual`, status internos e persistência de tentativas não podem mudar.
- Nenhum dado de cartão completo ou secret pode atravessar a API.
- A seleção atual não autoriza a integração de um PSP real.

## Segurança

- `FAKE_GATEWAY_SECRET` obrigatório em produção quando o provider fake estiver ativo.
- Erros de bootstrap devem nomear a variável ausente sem revelar seu valor.
- Testes devem restaurar `process.env` após cada cenário.

## Multi-tenancy

Não aplicável diretamente: a configuração é global por processo e não altera consultas, autorização ou escopo de organizações.

## Concorrência

Não aplicável diretamente: a task não altera criação de tentativas, webhooks, transações ou estoque.

## Idempotência

Não aplicável diretamente: a task não altera as chaves nem os efeitos de idempotência existentes; os testes devem confirmar que o gateway fake preserva o comportamento atual.

## Fora do escopo

- Seleção simultânea de múltiplos PSPs.
- Contrato agnóstico de métodos/payloads de pagamento.
- Nova rota de webhook ou alteração de endpoint existente.
- Worker, fila, retry ou DLQ.
- Mudança de autenticação, ledger, reembolso ou schema.

## Plano esperado

Antes de implementar, apresentar:

1. solução e ponto exato de composição;
2. arquivos a alterar;
3. fluxo de bootstrap em desenvolvimento e produção;
4. riscos de compatibilidade;
5. testes de configuração e regressão do gateway.

## Critérios de aceite

- `PAYMENT_PROVIDER` é validado e usado apenas na composição.
- Produção com provider fake sem secret falha cedo.
- Produção com provider fake e secret válido constrói o provider.
- `docker-compose.prod.yml` fornece as variáveis necessárias ao container API.
- Gateway fake mantém seus testes de assinatura e idempotência aprovados.
- Nenhum endpoint ou DTO público é alterado.
- Nenhuma migration ou dependência é adicionada.
- Documentação e relatório da task são atualizados.

## Comandos

```bash
pnpm --filter @ticket-seller/api test -- --runInBand
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api build
docker compose -f docker-compose.prod.yml config
.ai/scripts/validate-architecture.sh
.ai/scripts/scan-secrets.sh
```

## Conclusão esperada

### Arquivos alterados

- arquivo: mudança.

### Implementado

- comportamento de configuração e bootstrap.

### Testes

- comando: aprovado/reprovado.

### Decisões

- decisão tomada ou nenhuma.

### Pendências

- pendência ou nenhuma.

### Próxima tarefa

- neutralizar o contrato de pagamentos sem provider real.
