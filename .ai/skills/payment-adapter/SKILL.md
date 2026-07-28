Skill: Payment Adapter
Quando utilizar

Use ao integrar um novo PSP.

Pré-requisitos
PaymentGateway definido;
estados internos definidos;
capabilities definidas;
testes de contrato disponíveis;
sandbox do provider disponível.
Procedimento
Ler documentação oficial do PSP.
Mapear capacidades.
Mapear estados externos.
Isolar SDK no adapter.
Implementar autenticação.
Implementar criação de cobrança.
Implementar consulta.
Implementar cancelamento.
Implementar reembolso.
Implementar validação de webhook.
Implementar deduplicação.
Implementar idempotência.
Criar testes de contrato.
Documentar limitações.
Regras
nunca retornar payload externo ao domínio;
nunca registrar token;
nunca processar CVV no backend;
nunca confiar apenas no redirect do frontend;
confirmar pagamento por evento confiável ou consulta;
armazenar identificadores externos;
tratar timeout como resultado desconhecido;
não repetir cobrança sem idempotência;
webhook deve responder rapidamente.
Testes
pagamento aprovado;
pendente;
recusado;
cancelado;
reembolsado;
webhook duplicado;
evento fora de ordem;
timeout;
assinatura inválida;
identificador inexistente;
capability não suportada.