# Service B

Backend NestJS multi-tenant para criação, revisão e publicação de vídeos. Cada módulo em `src/modules` separa entidades e contratos de domínio, DTOs e use cases da aplicação, e adaptadores de infraestrutura. O JWT autentica o usuário. O `RequestContext` disponibiliza `userId` e `companyId` durante a requisição, e as chaves estrangeiras compostas do PostgreSQL impedem vínculos entre empresas.

## Executar localmente

Requer Node.js 20.19+, npm e Docker Compose. Para revisar vídeos, instale também `ffmpeg`, `ffprobe` e `tesseract`.

1. Copie `.env.example` para `.env` e gere um `JWT_SECRET` com `openssl rand -hex 32`.
2. Execute `docker compose up -d --wait`, `npm ci` e `npm run db:migrate`.
3. Inicie com `npm run start:dev`. O padrão é a porta 3003.

Para Cloudflare R2, use `S3_REGION=auto`, configure `S3_ENDPOINT` com o endpoint S3 da conta e informe as credenciais AWS correspondentes. Creatomate, Meta e a IA precisam alcançar pela internet as URLs temporárias do bucket. O bucket pode permanecer privado.

## API

As rotas abaixo usam `Authorization: Bearer <accessToken>`. As rotas de cadastro, login e callback do Instagram são públicas.

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
| `POST /publications` | Agenda um Reel com `contentId`, `videoId`, `socialAccountId`, `date` ISO 8601 com fuso e `caption` opcional |
| `GET /publications/:id` | Consulta o status do agendamento e da publicação |

Cadastros de marca, campanha, regra, categoria e produto também têm consulta por ID em suas respectivas rotas.

## Integrações

- **OpenAI.** Configure um modelo que aceite imagens e respostas JSON. Se `aiScript` for omitido no cadastro, o backend gera o roteiro com os dados da marca, campanha e produtos.
- **Creatomate.** Configure o template e os nomes dos campos dinâmicos. A API passa o roteiro e as fotos na ordem informada. O render é acompanhado no PostgreSQL e o MP4 é transferido por streaming para o bucket. Um adaptador independente usa FFmpeg, OCR e IA visual para comparar três quadros com as imagens de referência e as regras da campanha. A revisão é amostral.
- **Instagram.** Use uma conta profissional e configure Instagram Login no painel da Meta. Registre exatamente a URL HTTPS de `INSTAGRAM_REDIRECT_URI`. Inicie a conexão a partir do navegador e abra o `authorizationUrl` no mesmo navegador. Em um frontend de outra origem do mesmo site, configure `CORS_ORIGIN` e faça a requisição com `credentials: "include"` para receber o cookie. O callback valida um estado de uso único vinculado a esse cookie e salva o token de longa duração criptografado. O worker usa a única fila BullMQ, `publication-schedule`, para criar o contêiner do Reel e publicar quando o Instagram o liberar. [Login e permissões da Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login) · [Publicação de conteúdo](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- **Embeddings.** A migração instala pgvector e prepara uma coluna `vector(1536)`. Gerar embeddings e oferecer busca semântica são etapas posteriores.

## Testes

A suíte usa PostgreSQL com pgvector e Redis dedicados, com adaptadores de teste para storage, IA, render e Instagram. Aponte `TEST_DATABASE_URL` e `TEST_REDIS_URL` para essas instâncias, aplique a migração com `DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate` e execute `npm test`.
