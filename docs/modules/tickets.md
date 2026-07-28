Módulo: Tickets
Responsabilidade

Emitir, armazenar, bloquear, cancelar e disponibilizar ingressos individuais.

Não é responsabilidade
vender estoque;
processar pagamento;
transferir ingresso;
realizar check-in;
calcular repasse.
Entidades
Ticket

Representa o direito individual de entrada.

TicketCode

Representa identificador seguro utilizado no QR Code.

Attendee

Representa a pessoa indicada para utilizar o ingresso.

Casos de uso
Comandos
IssueTickets;
ActivateTicket;
BlockTicket;
UnblockTicket;
CancelTicket;
RefundTicket;
UpdateTicketAttendee;
RegenerateTicketCode.
Consultas
GetTicket;
GetBuyerTicket;
ListOrderTickets;
ListEventTickets;
GetTicketDocumentData.
Estados
PENDING
ACTIVE
TRANSFER_PENDING
TRANSFERRED
CHECKED_IN
BLOCKED
CANCELLED
REFUNDED
Invariantes
ingresso pertence a um pedido pago;
quantidade emitida deve corresponder aos itens válidos;
ingresso não pode ser emitido duas vezes para o mesmo item;
código deve ser imprevisível e único;
ingresso cancelado ou reembolsado não pode ser utilizado;
ingresso utilizado não pode ser alterado livremente;
atualização de participante deve obedecer regras do evento;
regeneração de código invalida o anterior;
emissão deve ser idempotente.
Eventos de domínio
ticket.issued.v1;
ticket.activated.v1;
ticket.blocked.v1;
ticket.unblocked.v1;
ticket.cancelled.v1;
ticket.refunded.v1;
ticket.attendee-updated.v1;
ticket.code-regenerated.v1.
Portas
TicketRepository;
OrderPort;
TicketCodeGenerator;
ObjectStorage;
DocumentGenerator;
IdempotencyRepository;
Clock;
IdGenerator.
Dependências permitidas
orders;
events;
audit;
notifications por evento;
object storage por adapter.
Dependências proibidas
SDK de pagamento;
finance;
acesso direto ao checkin;
acesso direto ao Redis como fonte oficial.
Multi-tenancy

Todo ingresso está associado a uma organização, evento e pedido.

Consultas administrativas utilizam:

organizationId + ticketId

Comprador acessa ingresso apenas por identidade ou token seguro.

Segurança
QR Code não deve conter dados pessoais;
código não deve ser sequencial;
documento deve ser acessado por URL temporária;
respostas não expõem dados de outros compradores;
bloqueios e cancelamentos devem ser auditados;
regeneração de código exige autorização.
Concorrência
emissão simultânea deve criar apenas um ingresso por unidade;
cancelamento e check-in simultâneos exigem transição determinística;
regeneração simultânea deve manter apenas um código ativo.
Idempotência
emissão repetida retorna os mesmos ingressos;
bloqueio repetido é seguro;
cancelamento repetido é seguro;
regeneração exige chave própria para evitar múltiplos códigos.
Testes obrigatórios
emissão após pedido pago;
emissão duplicada;
pedido não pago;
código único;
acesso de outra organização;
acesso de outro comprador;
bloqueio;
cancelamento;
regeneração;
concorrência com check-in.
Métricas
tickets_issued;
ticket_issuance_duration;
tickets_blocked;
tickets_cancelled;
ticket_code_regenerations;
ticket_issuance_failures.