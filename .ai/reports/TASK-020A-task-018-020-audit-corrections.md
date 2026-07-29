# Relatório da TASK-020A

## Status

COMPLETED

## Auditoria

| Ponto | Estado encontrado | Correção necessária | Arquivos afetados |
| --- | --- | --- | --- |
| `IVenueAccessPort` | Estava no domínio, embora fosse consumido apenas pela aplicação e implementado pela infraestrutura de venues. | Movido para `application/ports`, com imports e composição atualizados. | Events application/module, venues adapter/module e validação arquitetural. |
| `onlineInfo` | Representa configuração administrativa privada. A API não retornava o valor, mas também não informava sua existência e o PATCH não possuía remoção explícita. | Resposta administrativa expõe apenas `onlineConfigured`; omissão preserva, `clearOnlineInfo: true` limpa e comandos nulos, vazios ou ambíguos são rejeitados. | DTO, response, caso de uso, formulário e testes de events. |
| `Idempotency-Key` | O backoffice criava uma chave por submissão e o backend persistia idempotência fora da transação principal. | Chave estável por operação no frontend; backend normaliza e limita a chave, inclui todo payload material no hash e grava record, ticket type e outbox atomicamente. | Formulário/helper do backoffice, use case/port/adapter/controller e testes de ticket types. |

## Implementado

- currency lock serializado pelo mesmo `Event FOR UPDATE` usado pela criação e
  atualização de ticket types;
- replay concluído autorizado antes do cache e independente do estado mutável
  posterior do evento;
- payload diferente com a mesma chave retorna conflito;
- `onlineInfo` não aparece em responses, outbox ou logs;
- validador arquitetural passa a inspecionar de fato caminhos `domain`;
- scripts oficiais receberam modo executável.

## Decisões tomadas

- `onlineInfo` permanece um segredo administrativo único nesta fase; distribuição
  para participantes continua fora do escopo;
- mudança de formato não apaga configuração privada;
- a linha do evento é o lock comum para mutações de configuração, ticket types e
  futura publicação.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ticket-seller/api test` | aprovado, 80 testes |
| `pnpm --filter @ticket-seller/api test:integration` | aprovado, 89 testes dos módulos afetados |
| `pnpm --filter @ticket-seller/api lint` | aprovado |
| `pnpm --filter @ticket-seller/api typecheck` | aprovado |
| `pnpm --filter @ticket-seller/backoffice-web test` | aprovado, 23 testes |
| `pnpm --filter @ticket-seller/backoffice-web lint` | aprovado |
| `pnpm --filter @ticket-seller/backoffice-web typecheck` | aprovado |
| `.ai/scripts/validate-architecture.sh` | aprovado |
| `git diff --check` | aprovado |

## Revisões

- revisão técnica independente: APPROVED, sem achados;
- revisão de segurança: ausência de vazamento de `onlineInfo`, autorização antes
  do replay e isolamento tenant verificados; achados altos iniciais corrigidos.

## Riscos identificados

A publicação deve adquirir o mesmo lock tenant-scoped da linha do evento para
não correr com criação, atualização ou desativação de ticket types.

## Pendências

Nenhuma dentro da TASK-020A.

## Documentação atualizada

- tarefa e relatório da TASK-020A;
- arquivos de coordenação.

## Próxima tarefa recomendada

TASK-021 — Publication Readiness.
