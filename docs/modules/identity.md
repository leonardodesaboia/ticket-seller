Módulo: Identity
Responsabilidade

Controlar autenticação, credenciais, sessões e vínculo entre uma identidade externa ou interna e um usuário da plataforma.

Não é responsabilidade
definir permissões dentro de organizações;
administrar eventos;
processar pagamentos;
armazenar dados completos de perfil;
decidir acesso a recursos de negócio.
Entidades
Identity

Representa a credencial utilizada para autenticação.

Campos conceituais:

identificador;
usuário vinculado;
provedor;
identificador externo;
e-mail verificado;
status;
data da última autenticação.
Session

Representa uma sessão autenticada.

AuthenticationAttempt

Registra tentativas relevantes de autenticação.

Casos de uso
Comandos
RegisterIdentity;
AuthenticateWithPassword;
AuthenticateWithProvider;
RefreshSession;
RevokeSession;
RevokeAllUserSessions;
VerifyEmail;
RequestPasswordReset;
ResetPassword;
EnableMultiFactorAuthentication;
DisableMultiFactorAuthentication.
Consultas
GetCurrentIdentity;
ListActiveSessions;
GetAuthenticationHistory.
Invariantes
uma identidade deve estar vinculada a apenas um usuário;
e-mail normalizado deve ser único quando utilizado como credencial;
sessão revogada não pode ser reutilizada;
token expirado não pode autenticar;
alteração sensível deve invalidar sessões quando necessário;
senha nunca pode ser armazenada em texto puro;
um provedor externo não pode vincular a mesma identidade a usuários diferentes.
Estados
PENDING_VERIFICATION
ACTIVE
LOCKED
DISABLED
DELETED
Eventos de domínio
identity.registered.v1;
identity.email-verified.v1;
identity.session-revoked.v1;
identity.locked.v1;
identity.password-changed.v1;
identity.mfa-enabled.v1.
Portas
IdentityRepository;
SessionRepository;
PasswordHasher;
TokenIssuer;
IdentityProvider;
EmailVerificationSender;
Clock;
IdGenerator.
Dependências permitidas
users;
audit;
notifications por evento;
infraestrutura de autenticação por adapter.
Dependências proibidas
inventory;
payments;
tickets;
finance;
SDK externo diretamente no domínio.
Multi-tenancy

Identidades e usuários são globais.

A autorização dentro de organizações pertence ao módulo organizations.

Uma identidade não recebe automaticamente acesso a organizações.

Segurança
utilizar algoritmo de hash de senha aprovado;
aplicar rate limiting em login, recuperação e verificação;
proteger contra enumeração de usuários;
não registrar senhas, tokens ou códigos;
utilizar tokens de uso único;
expirar tokens de recuperação;
exigir reautenticação em ações sensíveis;
MFA obrigatório ou recomendado para administradores e produtores;
registrar alteração de credencial em auditoria.
Concorrência
duas tentativas simultâneas de vincular a mesma identidade devem resultar em apenas um vínculo;
refresh simultâneo não pode gerar sessões inconsistentes;
utilização repetida de token de uso único deve ser recusada.
Idempotência
confirmação repetida de e-mail deve retornar sucesso equivalente;
revogação repetida de sessão deve ser segura;
vínculo externo repetido não pode duplicar identidade.
Testes obrigatórios
cadastro com e-mail normalizado duplicado;
senha inválida;
usuário bloqueado;
sessão expirada;
sessão revogada;
token de recuperação reutilizado;
duas vinculações simultâneas;
login com provedor externo;
nenhuma credencial sensível em logs.
Métricas
authentication_attempts_total;
authentication_failures_total;
active_sessions;
password_reset_requests;
mfa_enabled_users;
locked_identities.