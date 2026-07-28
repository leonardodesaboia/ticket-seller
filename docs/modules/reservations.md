Módulo: Reservations
Responsabilidade

Orquestrar o ciclo de vida de reservas temporárias criadas sobre o inventário.

Não é responsabilidade
manter o contador oficial do estoque;
criar pagamento;
emitir ingresso;
calcular saldo;
realizar check-in.
Entidades
Reservation

Representa uma reserva temporária associada a um pedido ou sessão de checkout.

Casos de uso
Comandos
CreateReservation;
ExtendReservation;
ConfirmReservation;
ReleaseReservation;
ExpireReservations;
CancelReservation.
Consultas
GetReservation;
GetReservationStatus;
ListOrderReservations.
Estados
ACTIVE
CONFIRMED
EXPIRED
RELEASED
CANCELLED
Invariantes
reserva deve estar associada a inventário existente;
quantidade deve ser maior que zero;
reserva ativa possui data de expiração;
reserva expirada não pode ser confirmada;
reserva confirmada não pode ser liberada;
extensão só pode ocorrer dentro das regras definidas;
confirmação deve ser coordenada com o inventário;
liberação repetida não devolve estoque mais de uma vez.
Eventos de domínio
reservation.created.v1;
reservation.extended.v1;
reservation.confirmed.v1;
reservation.released.v1;
reservation.expired.v1;
reservation.cancelled.v1.
Portas
ReservationRepository;
InventoryPort;
Clock;
IdGenerator;
IdempotencyRepository.
Dependências permitidas
inventory;
orders;
audit;
scheduler.
Dependências proibidas
payments diretamente;
tickets;
finance;
provider externo.
Multi-tenancy

Toda reserva pertence a uma organização e a um evento.

Consultas devem utilizar:

organizationId + reservationId
Segurança
comprador só pode consultar reserva vinculada à sua sessão ou pedido;
membros da organização precisam de permissão;
identificador público deve ser imprevisível;
duração de reserva deve possuir limite.
Concorrência
criação simultânea é resolvida pelo inventário;
confirmação e expiração simultâneas devem ter resultado determinístico;
liberação concorrente deve afetar o inventário uma única vez.
Idempotência
CreateReservation exige chave quando iniciado pelo checkout;
confirmação repetida retorna resultado equivalente;
liberação repetida é segura;
expiração repetida é segura.
Testes obrigatórios
reserva válida;
estoque insuficiente;
confirmação depois da expiração;
confirmação concorrente com expiração;
liberação duplicada;
acesso de outra organização;
chave idempotente repetida;
tentativa de extensão inválida.
Métricas
reservations_created;
reservations_active;
reservations_confirmed;
reservations_expired;
reservation_duration_seconds;
reservation_conflicts;