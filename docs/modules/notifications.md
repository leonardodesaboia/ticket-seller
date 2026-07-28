Módulo: Notifications
Responsabilidade

Orquestrar comunicações transacionais e, futuramente, comunicações de marketing autorizadas.

Não é responsabilidade
decidir regras de negócio que originam notificações;
armazenar credenciais de usuário;
confirmar pagamento;
emitir ingresso;
processar marketing sem consentimento.
Entidades
Notification

Representa uma comunicação.

NotificationTemplate

Representa template versionado.

NotificationDelivery

Representa uma tentativa por canal.

Canais
EMAIL
SMS
WHATSAPP
PUSH
IN_APP
Estados
PENDING
SCHEDULED
SENT
DELIVERED
FAILED
CANCELLED
Casos de uso
Comandos
ScheduleNotification;
SendNotification;
RetryNotification;
CancelNotification;
RegisterDeliveryStatus;
CreateNotificationTemplate;
PublishNotificationTemplate.
Consultas
GetNotification;
ListUserNotifications;
ListOrganizationNotifications;
GetDeliveryStatus.
Invariantes
comunicação transacional deve possuir origem;
template deve possuir versão;
dados sensíveis não devem aparecer em conteúdo sem necessidade;
marketing exige base legal ou consentimento adequado;
falha de notificação não deve reverter compra;
envio repetido deve ser evitado;
canal deve estar permitido para o tipo de mensagem;
preferência de marketing não bloqueia comunicação transacional necessária.
Eventos de domínio
notification.scheduled.v1;
notification.sent.v1;
notification.delivered.v1;
notification.failed.v1;
notification.cancelled.v1.
Portas
NotificationRepository;
EmailSender;
SmsSender;
WhatsAppSender;
PushSender;
TemplateRenderer;
UserPreferencePort;
Clock;
IdGenerator.
Dependências permitidas
users;
organizations;
eventos de todos os módulos;
audit para ações administrativas.
Dependências proibidas
controle de estado de pedido;
SDK de PSP;
inventory;
finance como regra de negócio.
Multi-tenancy

Notificações de eventos e pedidos devem carregar organizationId.

Templates organizacionais não podem ser acessados por outro tenant.

Segurança
não registrar conteúdo sensível completo;
escapar variáveis de template;
proteger contra injeção em HTML;
limitar destinatários por lote;
validar URLs;
não permitir que produtores enviem campanhas sem limites;
armazenar credenciais de provider em secrets.
Concorrência
dois workers não podem enviar a mesma notificação;
callback de entrega duplicado deve ser idempotente;
retry não pode enviar depois de cancelamento.
Idempotência

Cada notificação deve possuir chave baseada no evento de origem e destinatário.

Testes obrigatórios
envio transacional;
template inválido;
provider indisponível;
retry;
callback duplicado;
cancelamento;
preferência de marketing;
isolamento entre organizações;
prevenção de envio duplicado.
Métricas
notifications_scheduled;
notifications_sent;
notifications_delivered;
notifications_failed;
notification_delivery_duration;
notification_retries;
notification_duplicate_prevented.