# Relatório da TASK-021

## Status

COMPLETED

## Arquivos alterados

- policy e testes em `events/domain/publication`;
- port e caso de uso de consulta em `events/application`;
- adapter Prisma tenant-scoped;
- controller e DTO administrativos;
- composição do `EventsModule`;
- integração do endpoint de readiness.

## Implementado

- avaliação pura, determinística e reutilizável;
- 20 códigos estáveis de pendência;
- ordem fixa por regra e por ID para pendências repetidas;
- regras de organização, estado, título, formato, agenda, timezone, venue,
  configuração online, moeda e ticket types ativos;
- endpoint
  `GET /api/v1/organizations/:organizationId/events/:eventId/publication-readiness`;
- autorização para OWNER, ADMIN e EVENT_MANAGER;
- isolamento por `organizationId + eventId`;
- snapshot e response contêm apenas `onlineConfigured`, nunca `onlineInfo`.

## Decisões tomadas

- descrição permanece opcional;
- ausência de período de vendas é válida porque o modelo atual não possui esses
  campos;
- apenas BRL é suportado nesta fase;
- a futura publicação deve montar o snapshot dentro da própria transação e
  chamar esta mesma policy sob o lock do evento.

## Testes executados

| Comando | Resultado |
| --- | --- |
| testes unitários específicos | aprovado, 32 testes |
| integração PostgreSQL de readiness | aprovado, 9 testes |
| lint da API | aprovado |
| typecheck da API | aprovado |
| `.ai/scripts/validate-architecture.sh` | aprovado |
| `git diff --check` | aprovado |

## Revisões

- técnica independente: APPROVED, sem achados;
- segurança independente: APPROVED, sem achados críticos ou altos.

## Riscos identificados

A montagem do snapshot dentro da TASK-022 deve usar o transaction client; chamar
o adapter global de consulta durante a publicação quebraria a atomicidade.

## Pendências

Nenhuma dentro da TASK-021.

## Documentação atualizada

- tarefa, relatório e arquivos de coordenação.

## Próxima tarefa recomendada

TASK-022 — Event Publication.
