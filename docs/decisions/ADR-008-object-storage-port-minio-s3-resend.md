ADR-008 — Object storage port-based com MinIO em development, S3 em production, e Resend para email transacional

Status

ACCEPTED

Data

2026-08-18

Contexto

O produto precisa armazenar arquivos de mídia (imagens de capa de evento, logo de organização) e enviar emails transacionais em produção. O sistema atualmente usa:

- **Emails**: `IEmailProvider` port já existente, com `SmtpEmailAdapter` para development (MailHog/Mailpit na porta 1025). Não existe adapter de produção.
- **Arquivos**: nenhuma infraestrutura de storage existe. Eventos não têm imagem de capa implementada.

Três decisões foram necessárias:

1. **Object storage**: MinIO (self-hosted S3-compatible) vs S3 nativo vs outro provider.
2. **Estratégia de upload**: proxy pelo servidor vs presigned URLs direto do browser.
3. **Email em production**: SendGrid vs Resend vs AWS SES vs SMTP próprio.

Decisão

**1. Object storage**: `IObjectStoragePort` com dois adapters — `MinioObjectStorageAdapter` (development) e `S3ObjectStorageAdapter` (production). Provider selecionado por `OBJECT_STORAGE_PROVIDER` env var.

**2. Upload via presigned URL**: o servidor gera uma URL assinada de PUT (válida por 5min). O browser faz PUT direto para o storage. O servidor não faz proxy de bytes. Após o PUT, o cliente chama `POST /confirm` para validar e persistir.

**3. Email em production**: `ResendEmailAdapter` implementando `IEmailProvider`. Resend é selecionado quando `RESEND_API_KEY` está presente; caso contrário, `SmtpEmailAdapter` é mantido (development com MailHog). A factory no `NotificationsModule` decide qual adapter usar com base na presença da env var.

Detalhes técnicos

**IObjectStoragePort**:
```typescript
interface IObjectStoragePort {
  generateUploadUrl(params: { key: string; contentType: string; maxBytes: number; expiresInSeconds?: number }): Promise<string>;
  generateDownloadUrl(params: { key: string; expiresInSeconds?: number }): Promise<string>;
  headObject(key: string): Promise<ObjectMetadata | null>;
  deleteObject(key: string): Promise<void>;
}
```

**Key naming**: `uploads/{organizationId}/{purpose}/{entityId}/{uuid}.{ext}` — gerada pelo backend, nunca pelo cliente. Evita path traversal e expõe apenas IDs que o cliente já conhece.

**Content-type restriction**: a presigned URL é gerada com content-type específico (restrito a image/jpeg, image/png, image/webp). O S3/MinIO rejeita PUTs com content-type diferente.

**Confirm step**: após o PUT do cliente, o servidor chama `headObject` para verificar que o arquivo existe e que o content-type é de imagem. Atualiza `media_uploads.status = CONFIRMED` e persiste a key no evento.

**MinIO em development**: serviço `minio` no `docker-compose.yaml`. Bucket criado automaticamente. Console na porta 9001 para inspeção. Compatível com SDK S3 — o `MinioObjectStorageAdapter` usa o mesmo cliente que o S3Adapter.

**Resend**: API REST simples. Suporte a emails reativos em texto plano e HTML. Plano gratuito: 100 emails/dia (suficiente para MVP). A `ResendEmailAdapter` implementa `IEmailProvider` existente — nenhuma alteração nos use cases de notificação.

Razões

**Object storage port-based**: desacopla o domínio do provider de storage; troca de MinIO para S3 (ou outro provider S3-compatible como Cloudflare R2, Backblaze B2) sem alterar código de negócio.

**Presigned URL**: o servidor não faz proxy de bytes — sem carga de upload no processo da API; não há limite de tamanho de request no servidor para uploads; latência de upload não bloqueia o event loop do Node.js.

**MinIO para development**: S3-compatible local sem billing, sem dependência de AWS em CI. MinIO suporta presigned URLs com a mesma API do S3.

**Resend para production**: API simples, SDK TypeScript nativo, plano gratuito generoso para MVP (100/dia), sem configuração de DNS complexa (DKIM/SPF gerenciados pelo Resend), documentação clara.

**SMTP como fallback**: SmtpEmailAdapter mantido para development — MailHog e Mailpit capturam emails sem enviá-los. Nenhum developer precisa configurar credenciais reais para trabalhar localmente.

Consequências positivas

uploads não consomem CPU/memória da API;
troca de provider de storage sem alteração de use cases;
development sem billing de storage ou email;
RESEND_API_KEY ausente → log-only em development (sem falha de startup);
content-type e tamanho validados pelo próprio storage provider (sem parsing no servidor).

Consequências negativas

dois adapters de storage para manter (MinIO e S3);
fluxo de upload tem dois passos (upload-url + confirm) — mais complexo que um endpoint único;
cleanup de MediaUpload PENDING (uploads iniciados mas não confirmados) é out-of-scope para MVP — risk de objeto órfão no storage.

Alternativas rejeitadas

**Proxy de upload pelo servidor**: rejeitado — processaria binários no event loop do Node.js, bloquearia CPU para uploads grandes, não escalaria para concorrência alta.

**Supabase Storage**: rejeitado — acopla ao ecossistema Supabase; sem necessidade de banco Supabase para este projeto.

**SendGrid**: rejeitado — mais caro que Resend no mesmo tier, API mais complexa, sem vantagem real para o MVP.

**AWS SES**: rejeitado para MVP — requer aprovação de produção (processo de sandbox), configuração DNS manual, billing por email (Resend tem free tier suficiente).

**S3 direto em development**: rejeitado — requer AWS account e billing mesmo para desenvolvimento; SlowCI sem mocking.

Impactos

Código:
- Novo módulo `apps/api/src/modules/media/`.
- `apps/api/src/shared/ports/object-storage.port.ts`.
- `ResendEmailAdapter` em `apps/api/src/modules/notifications/infrastructure/adapters/`.
- Factory no `NotificationsModule` seleciona adapter por env.

Infraestrutura:
- MinIO adicionado ao `docker-compose.yaml`.
- Variáveis de ambiente: `OBJECT_STORAGE_PROVIDER`, `MINIO_*`, `AWS_S3_*`, `RESEND_API_KEY`.

Schema:
- Tabela `media_uploads` (TASK-056).
- Coluna `events.cover_image_key`.

Migração ou reversão

Para trocar de S3 para Cloudflare R2: implementar `R2ObjectStorageAdapter` (S3-compatible, mesmo SDK com endpoint customizado). `OBJECT_STORAGE_PROVIDER=r2`.
Para trocar de Resend para SES: implementar `SesEmailAdapter implements IEmailProvider`. Factory selecionada por `EMAIL_PROVIDER=ses`.
Para remover MinIO: `OBJECT_STORAGE_PROVIDER=s3` em todos os ambientes.

Referências

TASK-056 — Media & Uploads Foundation
ADR-007 — Autenticação própria
Resend SDK: https://resend.com/docs/send-with-nodejs
AWS S3 Presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
