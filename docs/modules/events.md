Módulo: Events
Responsabilidade

Controlar criação, edição, publicação, pausa, cancelamento e conclusão de eventos e sessões.

Não é responsabilidade
controlar estoque;
processar pedidos;
receber pagamentos;
emitir ingressos;
realizar check-in.
Entidades
Event

Representa o evento público.

EventSession

Representa uma ocorrência do evento em determinada data e horário.

EventPolicy

Representa regras públicas do evento.

Casos de uso
Comandos
CreateEvent;
UpdateEvent;
PublishEvent;
PauseEvent;
ResumeEvent;
CancelEvent;
CompleteEvent;
CreateEventSession;
UpdateEventSession;
CancelEventSession.
Consultas
GetEvent;
GetPublicEvent;
ListOrganizationEvents;
ListPublishedEvents;
ListEventSessions.
Estados do evento
DRAFT
PUBLISHED
PAUSED
CANCELLED
COMPLETED
Estados da sessão
SCHEDULED
CANCELLED
COMPLETED
Invariantes
evento deve pertencer a uma organização;
evento nasce como DRAFT;
evento sem dados mínimos não pode ser publicado;
evento cancelado não pode ser republicado;
evento concluído não pode voltar para publicado;
sessão deve possuir início anterior ao término;
evento publicado deve possuir ao menos uma sessão válida;
slug público deve ser único;
alteração relevante após vendas pode exigir comunicação e política específica;
organização suspensa não pode publicar eventos.
Eventos de domínio
event.created.v1;
event.updated.v1;
event.published.v1;
event.paused.v1;
event.cancelled.v1;
event.completed.v1;
event.session-created.v1;
event.session-cancelled.v1.
Portas
EventRepository;
EventSessionRepository;
EventSlugRepository;
OrganizationAccessPort;
Clock;
IdGenerator.
Dependências permitidas
organizations;
venues;
audit;
notifications por eventos;
administration para moderação.
Dependências proibidas
payments;
finance;
tickets;
acesso direto ao inventory.
Multi-tenancy

Toda operação administrativa utiliza:

organizationId + eventId

Consultas públicas podem utilizar slug ou identificador público, sem expor dados administrativos.

Segurança
somente membros autorizados podem alterar evento;
publicação exige papel adequado;
dados internos e financeiros não aparecem na resposta pública;
HTML e conteúdo livre devem ser sanitizados;
alterações relevantes devem ser auditadas.
Concorrência
publicação e cancelamento simultâneos devem ter resultado determinístico;
atualização concorrente deve utilizar versão ou condição;
slug deve ser protegido por constraint única.
Idempotência
publicação repetida de evento já publicado é segura;
cancelamento repetido não duplica notificações;
criação de sessão com mesma chave idempotente não duplica ocorrência.
Testes obrigatórios
criação em DRAFT;
publicação válida;
publicação sem dados mínimos;
acesso de outra organização;
organização suspensa;
slug duplicado;
data inválida;
cancelamento concorrente;
resposta pública sem dados internos.
Métricas
events_created;
events_published;
events_cancelled;
event_publication_failures;
event_updates_total;
published_events_active.

Publicação (TASK-022)

Endpoint: POST /api/v1/organizations/:organizationId/events/:eventId/publish, header Idempotency-Key, body { version }.

Transição atômica e idempotente DRAFT → PUBLISHED em uma única transação:
autorização antes do replay; SELECT ... FOR UPDATE tenant-scoped; readiness
recalculada sob lock pela PublicationReadinessPolicy; optimistic concurrency por
versão; slug global imutável (título normalizado + UUID) e publishedAt gerado no
servidor; outbox event.published.v1 (eventId, organizationId, version, slug,
publishedAt, startsAt); auditoria event.published; nunca expõe onlineInfo.

Chave de idempotência escopada ao ator; catch de P2002 restrito à constraint da
chave de idempotência. Erros: 409 EVENT_VERSION_CONFLICT, 409 EVENT_NOT_DRAFT,
409 IDEMPOTENCY_KEY_REUSED, 422 EVENT_PUBLICATION_NOT_READY (com version e
issues). Constraint de banco events_published_fields_check garante slug +
published_at em PUBLISHED; índice parcial (starts_at, id) WHERE status =
'PUBLISHED'. Evento publicado fica congelado para edição nesta fase.