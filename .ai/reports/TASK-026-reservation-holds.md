# Relatório da TASK-026

Status

MERGED em develop

Arquivos alterados

- `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/20260811000008_reservations/`: tabelas, relações, constraints e índices de reservas.
- `apps/api/src/modules/reservations/`: módulo público de criação, consulta e cancelamento de holds.
- `apps/api/src/modules/inventory/infrastructure/repositories/prisma-inventory.repository.ts`: disponibilidade desconta holds ativos não expirados.
- `apps/api/test/integration/reservations/` e specs do módulo: cobertura de contrato, token, idempotência, expiração, rollback e concorrência.

Implementado

Reservas públicas com TTL de 15 minutos, token aleatório de 32 bytes persistido apenas como SHA-256, idempotência por hash de payload, snapshots de preço/moeda, outbox e transações serializáveis com retry limitado para conflitos de serialização.

Decisões tomadas

- A migration usa a sequência `20260811000008` porque `00007` já existia e migrations aplicadas não podem ser alteradas.
- A expiração lazy é limitada aos ticket types envolvidos na nova reserva, evitando limpeza global em requisições públicas.
- O módulo não depende de delegates Prisma gerados para as novas tabelas; usa SQL parametrizado para o acesso às reservas.

Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | aprovado |
| `pnpm typecheck` | aprovado |
| `pnpm test` | aprovado (148 testes API; demais workspaces aprovados) |
| `pnpm --filter @ticket-seller/api test:integration` | aprovado com PostgreSQL/Testcontainers |
| `pnpm build` | aprovado |

Riscos identificados

Nenhum bloqueante conhecido. O scheduler periódico de expiração permanece fora do escopo; a expiração lazy mantém a disponibilidade correta até sua implementação.

Pendências

Nenhuma.

Documentação atualizada

`docs/modules/reservations.md`, coordenação e este relatório.

Próxima tarefa recomendada

TASK-028 — Marketplace Reservation Checkout Preparation.
