# Service B

Backend NestJS multi-tenant para criação, revisão e publicação de vídeos. Cada módulo em `src/modules` separa entidades e contratos de domínio, DTOs e use cases da aplicação, e adaptadores de infraestrutura. O JWT autentica o usuário. O `RequestContext` disponibiliza `userId` e `companyId` durante a requisição, e as chaves estrangeiras compostas do PostgreSQL impedem vínculos entre empresas.

## Executar localmente

Requer Node.js 20.19+, npm e Docker Compose. Para revisar vídeos, instale também `ffmpeg`, `ffprobe` e `tesseract`.

1. Copie `.env.example` para `.env` e gere um `JWT_SECRET` com `openssl rand -hex 32`.
2. Execute `docker compose up -d --wait`, `npm ci` e `npm run db:migrate`.
3. Inicie com `npm run start:dev`. O padrão é a porta 3003.

Para Cloudflare R2, use `S3_REGION=auto`, configure `S3_ENDPOINT` com o endpoint S3 da conta e informe as credenciais AWS correspondentes. Creatomate, Meta e a IA precisam alcançar pela internet as URLs temporárias do bucket. O bucket pode permanecer privado.

## API

As rotas abaixo usam `Authorization: Bearer <accessToken>`. As rotas de cadastro, login e callback do Instagram são públicas. Os webhooks da OpenAI e do Creatomate usam a autenticação de cada provedor.

| Método e rota | Uso |
| --- | --- |
| `POST /auth/signup` | Cria empresa e usuário com `companyName`, `email` e `password` |
| `POST /auth/login` | Autentica com `email` e `password` |
| `GET /companies/me` | Consulta a empresa da sessão |
| `POST` e `GET /brands` | Cadastra e lista marcas |
| `POST` e `GET /campaigns` | Cadastra e lista campanhas ligadas a uma marca |
| `POST` e `GET /campaign-rules` | Cadastra e lista regras de campanhas |
| `POST` e `GET /product-categories` | Cadastra e lista categorias |
| `POST` e `GET /products` | Cadastra e lista produtos da empresa |
| `POST /products/:id/media` | Associa uma imagem JPEG, PNG ou WebP de até 10 MB ao produto. Use multipart com o campo `file` |
| `GET /products/:id/media` e `GET /media-assets/:id/url` | Lista as imagens de um produto e emite uma URL temporária |
| `POST /contents` | Cria conteúdo com `campaingId`, `campaingRulesId` e `productId`. Aceita `productIds` adicionais, `aiScript`, `mediaAssetIds` e `editorial` |
| `GET /contents`, `GET /contents/:id` e `GET /contents/:id/history` | Lista conteúdos, detalhes e histórico. As listas aceitam `offset` e `limit` |
| `PATCH /contents/:id` | Atualiza campos editoriais com a `revision` atual |
| `POST /contents/:id/video-generations` | Inicia o render assíncrono da revisão atual |
| `GET /video-generations/:id` | Consulta o render e, quando disponível, a revisão e a URL do vídeo |
| `POST /social-accounts/instagram/connect` | Gera a URL de autorização do Instagram |
| `GET /social-accounts/instagram/callback` | Processa o retorno da Meta |
| `GET /social-accounts` | Lista as contas conectadas |
| `POST /social-accounts/:id/instagram/refresh` | Renova a credencial do Instagram antes do vencimento |
| `POST /publications` | Agenda um Reel com `contentId`, `socialAccountId`, `date` ISO 8601 com fuso e `caption` opcional. Aceita `videoId` para usar um vídeo já aprovado da revisão atual |
| `POST /webhooks/openai` | Recebe o evento assinado de conclusão ou falha do roteiro |
| `POST /webhooks/creatomate` | Recebe a conclusão do render usando o segredo do webhook |
| `GET /publications/:id` | Consulta o status do agendamento e da publicação |

Cadastros de marca, campanha, regra, categoria e produto também têm consulta por ID em suas respectivas rotas.

## Integrações

- **OpenAI.** Configure em `OPENAI_MODEL` um modelo que aceite Responses API em background, imagens e respostas JSON. No projeto da chave `OPENAI_API_KEY`, cadastre a URL HTTPS `/webhooks/openai` e assine os eventos `response.completed`, `response.failed`, `response.incomplete` e `response.cancelled`. Copie o segredo gerado pelo painel para `OPENAI_WEBHOOK_SECRET`. Se `aiScript` for omitido no cadastro manual de conteúdo, o backend ainda gera o roteiro na própria chamada. [Webhooks da OpenAI](https://developers.openai.com/api/docs/guides/webhooks)
- **Creatomate.** Configure o template e os nomes dos campos dinâmicos. A API passa o roteiro e as fotos na ordem informada. Configure `CREATOMATE_WEBHOOK_URL` com a URL HTTPS do endpoint e gere `CREATOMATE_WEBHOOK_SECRET` com `openssl rand -hex 32`. O webhook informa a conclusão do render e o MP4 é transferido por streaming para o bucket. Um adaptador independente usa FFmpeg, OCR e IA visual para comparar três quadros com as imagens de referência e as regras da campanha. A revisão é amostral.
- **Instagram.** Use uma conta profissional e configure Instagram Login no painel da Meta. Registre exatamente a URL HTTPS de `INSTAGRAM_REDIRECT_URI`. Inicie a conexão a partir do navegador e abra o `authorizationUrl` no mesmo navegador. Em um frontend de outra origem do mesmo site, configure `CORS_ORIGIN` e faça a requisição com `credentials: "include"` para receber o cookie. O callback valida um estado de uso único vinculado a esse cookie e salva o token de longa duração criptografado. O orquestrador prepara o contêiner do Reel e publica quando o Instagram o liberar a partir do horário programado. [Login e permissões da Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login) · [Publicação de conteúdo](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- **Embeddings.** A migração instala pgvector e prepara uma coluna `vector(1536)`. Gerar embeddings e oferecer busca semântica são etapas posteriores.

## Publicação agendada

O cron consulta o PostgreSQL a cada cinco segundos e chama o orquestrador para os agendamentos com `nextAttemptAt` vencido. A reserva no banco coordena o processamento entre instâncias. Ao agendar sem `videoId`, a primeira tentativa de preparação fica marcada para cinco minutos antes, ou assim que possível para agendamentos mais próximos.

O orquestrador valida a conta, resolve o contexto editorial e solicita o roteiro em background. O webhook da OpenAI confirma o resultado, salva o roteiro e libera a próxima tentativa para enviar ao Creatomate. O webhook do Creatomate baixa o MP4, roda a revisão e, se aprovado, marca o conteúdo como `READY` e libera a etapa de publicação. A geração existente da revisão atual é reaproveitada, e callbacks duplicados são tratados pelo estado persistido.

O Instagram pode preparar o container antes da data agendada. A publicação ocorre a partir do horário escolhido, com até 30 minutos para concluir em caso de atraso.

## Testes

A suíte usa um PostgreSQL com pgvector dedicado e simula storage, OpenAI, Creatomate e Instagram. Aponte `TEST_DATABASE_URL` para essa instância, aplique as migrações com `DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate` e execute `npm test`.
