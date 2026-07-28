Módulo: Ticket Transfers
Responsabilidade

Controlar transferência de titularidade ou posse operacional de ingressos entre usuários.

Não é responsabilidade
emitir ingresso original;
processar pagamento;
realizar revenda;
executar check-in;
alterar estoque.
Entidades
TicketTransfer

Representa uma transferência.

Casos de uso
Comandos
RequestTicketTransfer;
AcceptTicketTransfer;
RejectTicketTransfer;
CancelTicketTransfer;
ExpireTicketTransfers.
Consultas
GetTicketTransfer;
ListSentTransfers;
ListReceivedTransfers.
Estados
PENDING
ACCEPTED
REJECTED
CANCELLED
EXPIRED
Invariantes
ingresso deve permitir transferência;
ingresso deve estar ativo;
ingresso utilizado não pode ser transferido;
ingresso cancelado ou reembolsado não pode ser transferido;
apenas uma transferência pendente pode existir por ingresso;
transferência aceita deve invalidar o acesso anterior quando aplicável;
destinatário deve ser validado;
transferência expirada não pode ser aceita.
Eventos de domínio
ticket-transfer.requested.v1;
ticket-transfer.accepted.v1;
ticket-transfer.rejected.v1;
ticket-transfer.cancelled.v1;
ticket-transfer.expired.v1.
Portas
TicketTransferRepository;
TicketPort;
UserPort;
NotificationPort;
Clock;
IdGenerator;
IdempotencyRepository.
Dependências permitidas
tickets;
users;
notifications;
audit.
Dependências proibidas
payments;
inventory;
finance;
checkin diretamente.
Multi-tenancy

A transferência permanece vinculada à organização e ao evento do ingresso.

Organização não pode acessar transferências de outro tenant.

Segurança
token de aceite deve ser aleatório e expirável;
não expor e-mail completo sem necessidade;
aceite exige autenticação ou verificação adequada;
alteração deve ser auditada;
impedir transferência para o próprio usuário quando não fizer sentido.
Concorrência
aceite e cancelamento simultâneos devem produzir apenas um resultado;
check-in e aceite simultâneos devem respeitar estado do ingresso;
duas solicitações simultâneas devem criar apenas uma transferência pendente.
Idempotência
solicitação exige chave;
aceite repetido retorna resultado equivalente;
cancelamento repetido é seguro;
expiração repetida é segura.
Testes obrigatórios
transferência válida;
ingresso utilizado;
ingresso bloqueado;
transferência expirada;
aceite concorrente com cancelamento;
duas solicitações simultâneas;
acesso de outro usuário;
acesso de outra organização.
Métricas
ticket_transfers_requested;
ticket_transfers_accepted;
ticket_transfers_rejected;
ticket_transfers_expired;
ticket_transfer_conflicts.