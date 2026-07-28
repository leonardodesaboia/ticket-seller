Módulo: Audit
Responsabilidade

Registrar ações relevantes, alterações administrativas, acessos sensíveis e eventos de segurança.

Não é responsabilidade
armazenar logs técnicos completos;
substituir observabilidade;
armazenar secrets;
decidir autorização;
permitir edição de histórico.
Entidades
AuditEntry

Representa evento de auditoria.

Campos mínimos
identificador;
data;
ator;
organização;
ação;
tipo de recurso;
identificador do recurso;
resultado;
request ID;
trace ID;
metadados mínimos;
origem.
Casos de uso
Comandos
RecordAuditEntry;
RecordSecurityEvent;
RecordAdministrativeAction;
ArchiveAuditEntries.
Consultas
ListAuditEntries;
GetResourceAuditHistory;
GetActorAuditHistory;
ExportAuditEntries.
Invariantes
entrada de auditoria é imutável;
alteração relevante deve gerar registro;
ausência de ator deve indicar origem de sistema;
metadados não podem conter secrets;
exclusão comum não deve apagar auditoria;
exportação deve respeitar autorização e tenant;
relógio deve ser confiável e usar UTC.
Eventos de domínio
audit.entry-recorded.v1;
audit.security-event-recorded.v1;
audit.export-created.v1.
Portas
AuditRepository;
AuditExporter;
ObjectStorage;
Clock;
IdGenerator.
Dependências permitidas

Todos os módulos podem publicar eventos para auditoria.

Dependências proibidas

O domínio de auditoria não deve alterar recursos de outros módulos.

Multi-tenancy

Entradas devem possuir organizationId quando aplicável.

Administrador de uma organização não pode consultar auditoria de outra.

Eventos globais da plataforma têm acesso restrito.

Segurança
não armazenar senha, token, CVV ou cartão completo;
limitar exportações;
registrar quem exportou;
aplicar retenção conforme política;
proteger integridade;
separar auditoria de logs comuns.
Concorrência

Entradas simultâneas devem ser preservadas.

Falha de auditoria crítica deve gerar alerta, mas estratégia de disponibilidade deve ser definida por operação.

Idempotência

Eventos críticos podem possuir chave de origem para evitar duplicação quando necessário.

Duplicatas técnicas devem ser distinguíveis de ações reais repetidas.

Testes obrigatórios
registro de ação;
ação de sistema;
acesso de outra organização;
tentativa de alteração;
conteúdo sensível rejeitado ou mascarado;
exportação autorizada;
exportação não autorizada;
eventos simultâneos.
Métricas
audit_entries_created;
audit_write_failures;
audit_exports_created;
audit_sensitive_data_blocked;
security_events_recorded.