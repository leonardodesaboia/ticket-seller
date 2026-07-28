Módulo: Antifraud
Responsabilidade

Avaliar risco de operações, organizações, compradores, pagamentos e repasses.

Não é responsabilidade
aprovar pagamento no PSP;
calcular saldo;
autenticar usuário;
substituir revisão humana;
bloquear recursos sem política definida.
Entidades
RiskAssessment

Representa avaliação de risco.

RiskSignal

Representa sinal individual.

RiskDecision

Representa decisão resultante.

ReviewCase

Representa revisão manual.

Decisões
APPROVE
REVIEW
REJECT
HOLD
LIMIT
Casos de uso
Comandos
AssessOrderRisk;
AssessOrganizationRisk;
AssessPayoutRisk;
RegisterRiskSignal;
OpenManualReview;
ApproveManualReview;
RejectManualReview;
UpdateRiskRule.
Consultas
GetRiskAssessment;
ListManualReviews;
GetOrganizationRiskProfile;
ListRiskSignals.
Invariantes
decisão automática deve possuir sinais explicáveis;
revisão manual deve registrar responsável;
regra aplicada deve possuir versão;
risco não deve alterar histórico financeiro;
retenção deve ocorrer por comando explícito;
falso positivo deve poder ser revisado;
dados utilizados devem respeitar finalidade e minimização.
Eventos de domínio
antifraud.assessment-created.v1;
antifraud.operation-approved.v1;
antifraud.operation-held.v1;
antifraud.operation-rejected.v1;
antifraud.review-opened.v1;
antifraud.review-resolved.v1.
Portas
RiskAssessmentRepository;
RiskRuleRepository;
DeviceRiskProvider;
PaymentRiskProvider;
OrganizationDataPort;
ManualReviewRepository;
Clock;
IdGenerator.
Dependências permitidas
payments;
orders;
payouts;
organizations;
audit;
providers antifraude por adapter.
Dependências proibidas
alteração direta de ledger;
alteração direta de estoque;
emissão direta de ingresso.
Multi-tenancy

Avaliações devem carregar organizationId quando relacionadas a produtor.

Acesso a sinais de risco deve ser altamente restrito.

Segurança
sinais não devem revelar mecanismos antifraude ao usuário;
dados de dispositivo devem ser minimizados;
regras administrativas exigem autorização;
avaliações e decisões devem ser auditáveis;
limitar acesso a casos de revisão.
Concorrência
avaliações duplicadas da mesma operação devem ser consolidadas;
revisão manual e decisão automática simultâneas devem respeitar estado;
retenção de repasse deve ser idempotente.
Idempotência

Toda avaliação deve possuir identificador de operação e versão da regra.

Testes obrigatórios
aprovação;
revisão;
rejeição;
sinais duplicados;
decisão automática concorrente com revisão;
acesso não autorizado;
isolamento de organização;
provider antifraude indisponível;
retenção idempotente.
Métricas
risk_assessments_total;
risk_approved;
risk_review;
risk_rejected;
manual_reviews_open;
manual_review_duration;
fraud_signals_total;
antifraud_provider_failures.