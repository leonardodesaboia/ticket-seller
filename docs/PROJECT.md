Produto
Visão

Criar um marketplace multi-tenant em que produtores possam cadastrar eventos, vender ingressos, acompanhar resultados e realizar check-in, enquanto compradores podem descobrir eventos, comprar, receber, transferir e utilizar ingressos.

Problema

Produtores de eventos precisam administrar:

divulgação;
lotes;
estoque;
pagamentos;
participantes;
check-in;
cancelamentos;
reembolsos;
repasses;
relatórios.

A solução deve reduzir planilhas, processos manuais e falhas de comunicação.

Proposta inicial

Oferecer uma plataforma simples para pequenos e médios produtores, com:

criação de eventos;
lotes;
estoque seguro;
checkout;
pagamento;
emissão de ingresso;
QR Code;
check-in;
painel de vendas;
administração multi-tenant.
Capacidade inicial

O MVP será planejado para:

até 100 usuários ativos simultaneamente;
até 50 checkouts simultâneos;
até 10 reservas por segundo em teste;
até 20 check-ins por segundo em teste.

Esses números são metas de teste, não garantias comerciais.

Perfis
Comprador
consulta eventos;
compra ingressos;
acessa pedidos;
acessa ingressos;
transfere ingresso quando permitido;
solicita suporte.
Participante
pessoa vinculada ao ingresso;
pode ser diferente do comprador;
apresenta o ingresso no evento.
Produtor
administra organização;
cria eventos;
configura lotes;
acompanha vendas;
administra equipe;
consulta informações financeiras.
Membro da organização

Possíveis funções:

proprietário;
administrador;
gestor de evento;
financeiro;
marketing;
supervisor de check-in;
operador de check-in;
somente leitura.
Administrador da plataforma
verifica produtores;
modera eventos;
consulta operações;
processa bloqueios;
acompanha riscos;
administra suporte.
Fluxo principal do MVP
Produtor cria uma organização.
Produtor cria um evento.
Produtor cria um lote.
Comprador acessa a página pública.
Comprador seleciona um ingresso.
Sistema cria uma reserva temporária.
Sistema cria o pedido.
Pagamento simulado é aprovado.
Sistema emite um ingresso.
Comprador acessa o QR Code.
Operador realiza o check-in.
Segunda leitura do mesmo ingresso é recusada.
Funcionalidades do MVP
autenticação;
organizações;
membros e permissões básicas;
criação e publicação de evento;
tipos de ingresso;
lotes;
reserva temporária;
pedidos;
pagamento simulado;
emissão de ingresso;
QR Code;
check-in online;
dashboard simples;
auditoria mínima.
Fora do primeiro MVP
mapa de assentos;
aplicativo nativo;
check-in offline;
vários provedores de pagamento;
recomendação por IA;
revenda oficial;
programa de fidelidade;
antecipação própria;
múltiplas moedas;
white-label completo;
marketplace nacional com busca avançada;
Kubernetes;
microserviços.
Indicadores iniciais
eventos publicados;
ingressos vendidos;
receita bruta;
conversão do checkout;
pagamentos aprovados;
reservas expiradas;
reembolsos;
check-ins;
produtores que criam novo evento;
tempo médio de resposta da API.