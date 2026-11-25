# Service B

Backend NestJS multi-tenant para criação, revisão e publicação de vídeos. Cada módulo em `src/modules` separa entidades e contratos de domínio, DTOs e use cases da aplicação, e adaptadores de infraestrutura. O JWT autentica o usuário. O `RequestContext` disponibiliza `userId` e `companyId` durante a requisição, e as chaves estrangeiras compostas do PostgreSQL impedem vínculos entre empresas.

## Executar localmente

Requer Node.js 20.19+, npm e Docker Compose. Para validar vídeos enviados como mídia de produto, instale também `ffprobe`. Para renderizar os anúncios, instale o projeto `video/` (veja `video/README.md`).

1. Copie `.env.example` para `.env` e gere um `JWT_SECRET` com `openssl rand -hex 32`.
2. Execute `docker compose up -d --wait`, `npm ci` e `npm run db:migrate`.
3. Inicie com `npm run start:dev`. O padrão é a porta 3003.

Para Cloudflare R2, use `S3_REGION=auto`, configure `S3_ENDPOINT` com o endpoint S3 da conta e informe as credenciais AWS correspondentes. A Meta precisa alcançar pela internet as URLs temporárias do bucket. O bucket pode permanecer privado.

## API

As rotas abaixo usam `Authorization: Bearer <accessToken>`. As rotas de cadastro, login e callback do Instagram são públicas. Os webhooks internos do Claude e do Remotion são assinados.

| Método e rota | Uso |
| --- | --- |
| `POST /auth/signup` | Cria empresa e usuário com `companyName`, `email` e `password` |
| `POST /auth/login` | Autentica com `email` e `password` |
| `GET /companies/me` | Consulta a empresa da sessão |
| `POST` e `GET /brands` | Cadastra e lista marcas |
| `POST` e `GET /campaigns` | Cadastra e lista campanhas ligadas a uma marca |
| `POST` e `GET /campaign-rules` | Cadastra e lista regras de campanhas |
| `POST` e `GET /products` | Cadastra e lista produtos da empresa |
| `POST /products/:id/media` | Associa uma foto JPEG, PNG ou WebP ou um vídeo MP4 de até 10 MB ao produto. Use multipart com o campo `file`. A validação de MP4 usa o FFprobe |
| `GET /products/:id/media` e `GET /media-assets/:id/url` | Lista as fotos e os vídeos de um produto e emite uma URL temporária |
| `POST /contents` | Cria conteúdo com `campaingId`, `campaingRulesId` e `productId`. Aceita `productIds` adicionais, `aiScript`, `mediaAssetIds`, `editorial` e `audio` (`backgroundMusic` e `voiceover`) |
| `GET /contents`, `GET /contents/:id` e `GET /contents/:id/history` | Lista conteúdos, detalhes e histórico. As listas aceitam `offset` e `limit` |
| `PATCH /contents/:id` | Atualiza campos editoriais com a `revision` atual |
| `POST /contents/:id/video-generations` | Inicia o render assíncrono da revisão atual |
| `GET /contents/:id/video-generations` | Consulta o render da revisão atual do conteúdo e as URLs do vídeo |
| `GET /video-generations/:id` | Consulta o render e, quando disponível, a revisão e a URL do vídeo |
| `POST /social-accounts/instagram/connect` | Gera a URL de autorização do Instagram |
| `GET /social-accounts/instagram/callback` | Processa o retorno da Meta |
| `GET /social-accounts` | Lista as contas conectadas |
| `POST /social-accounts/:id/instagram/refresh` | Renova a credencial do Instagram antes do vencimento |
| `POST /publications` | Cria um agendamento com `contentId`, `socialAccountId`, `date` ISO 8601 com fuso e `caption` opcional. Aceita `videoId` para usar um vídeo já aprovado da revisão atual |
| `POST /publications/schedule` | Cria e retorna a publicação agendada. Envie `contentId` ou `contentDraft` com `campaingId`, `campaingRulesId` e `productId`, além de `socialAccountId`, `date` e `caption` opcional. `videoId` é opcional com `contentId` |
| `POST /publications/contents/:contentId/prepare` | Inicia a preparação pelo conteúdo. Retorna HTTP 202 com `contentId`, `revision` e `status`. Envie `{"regenerateFromRevision":7}` para criar uma revisão a partir da revisão atual 7 e renderizar um novo vídeo com o roteiro existente |
| `GET /publications/schedules/:id` | Consulta o agendamento, a falha de preparação, quando houver, e o ID da publicação depois que for criada |
| `POST /webhooks/claude-script` | Recebe o aviso interno assinado com o roteiro gerado pelo Claude |
| `POST /webhooks/remotion` | Recebe o aviso interno assinado de conclusão ou falha do render do Remotion |
| `GET /publications/:id` | Consulta o status do agendamento e da publicação |

Cadastros de marca, campanha, regra e produto também têm consulta por ID em suas respectivas rotas.

## Integrações

Use `SERVICE_BASE_URL` para a URL pública apontada para a API em desenvolvimento. Com `NODE_ENV=production`, o app exige `PROD_SERVICE_BASE_URL`. As duas variáveis recebem somente a origem, como `https://seu-tunel.devtunnels.ms`, e o app monta os caminhos dos callbacks.

- **Roteiro (Claude).** O roteiro é gerado pelo Claude (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) já dividido nas cenas do anúncio, num formato legível salvo em `aiScript` (`Gancho:`, `Benefícios:` e `Chamada:`). No preparo, o roteiro é gerado em background e avisado por um webhook interno assinado, `POST /webhooks/claude-script`, com `INTERNAL_WEBHOOK_SECRET`. Se `aiScript` for omitido no cadastro manual de conteúdo, o roteiro é gerado na própria chamada. O contexto enviado à IA (`ScriptContext`) reúne marca, objetivo da campanha, diretrizes das regras, produtos e o briefing do conteúdo (`editorial.brief`), além do tom de voz, público-alvo e orientações da marca quando cadastrados. O briefing só influencia o roteiro quando ele é gerado pela IA: com `aiScript` informado, o briefing não é usado. A aplicação não sobe sem `ANTHROPIC_API_KEY` e `INTERNAL_WEBHOOK_SECRET`.
- **Remotion (anúncio de produto).** Defina `REMOTION_WEBHOOK_SECRET` (gere com `echo "whsec_$(openssl rand -base64 32)"`) e `ANTHROPIC_API_KEY`, e instale o projeto `video/` (veja `video/README.md`). Quando o roteiro está no formato de cenas, o Remotion usa gancho, benefícios e chamada direto como texto do vídeo. Roteiros editados fora desse formato são condensados pelo copy writer (Claude), com o tom de voz da marca. Cada vídeo sorteia um par de cores da marca: uma cor base (principal ou secundária cadastrada), que domina o vídeo, e uma cor de apoio (terciária ou quaternária), usada em destaques, selos e CTA. Só entram pares com contraste mínimo entre si; sem cores de apoio cadastradas, as duas bases formam o par. Sem cor cadastrada, vale `REMOTION_PRIMARY_COLOR`. Nome, preço, preço antigo e a primeira foto vêm do cadastro. O Remotion renderiza o template `ProductAd-9x16` pela CLI local, em background, e salva o MP4 no bucket. Ao terminar, o provider avisa um webhook interno assinado, `POST /webhooks/remotion`, que copia o MP4 para o local definitivo e registra o vídeo. Não há revisão automática: todo vídeo concluído é aprovado. Por padrão, o aviso vai para a própria instância (`http://127.0.0.1:$PORT`). Use `REMOTION_WEBHOOK_URL` para mudar o destino. Transcrição e legendas são dispensadas, porque o texto já aparece na tela, e o vídeo original é publicado. **Áudio:** o conteúdo aceita `audio: { backgroundMusic, voiceover }` (ambos `false` por padrão, também em `contentDraft`). Com `backgroundMusic`, o render sorteia uma faixa de `video/public/music` (as atuais são placeholders; troque por faixas licenciadas). Com `voiceover`, o roteiro inteiro (gancho, benefícios e chamada) é narrado pela OpenAI TTS numa tomada só (`OPENAI_API_KEY`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`), no tom de voz da marca, para a voz manter a entonação de uma frase para outra. O Whisper (`OPENAI_TRANSCRIBE_MODEL`) transcreve a tomada com o tempo de cada palavra: cada trecho precisa ter sido falado, e o áudio é cortado na pausa entre um trecho e o próximo. Se faltar um trecho (o TTS às vezes corta a última frase), houver fala fora do roteiro ou não houver pausa, a tomada é gravada de novo uma vez; se ainda não conferir, ou se o TTS ou a transcrição falharem, cada trecho é narrado numa chamada própria. Cada fala começa quando o texto dela aparece na tela; a música abaixa durante a fala. O texto narrado vira a transcrição do conteúdo, sem transcrever o áudio. Se o processo reiniciar durante um render, a geração fica pendente e precisa ser solicitada de novo.
- **Instagram.** Use uma conta profissional. O backend aceita os dois tipos de login da Meta; o tipo aparece na "URL de login" do caso de uso do Instagram no painel. Se ela começa com `facebook.com/dialog/oauth` e tem `config_id` (login unificado), defina `INSTAGRAM_CONFIG_ID` com esse valor e use o ID e a chave do app da Meta (*Configurações do app → Básico*); o token emitido não vence e a renovação automática só confere com a Meta que ele continua válido. Se ela começa com `instagram.com/oauth/authorize` (Login do Instagram), deixe `INSTAGRAM_CONFIG_ID` vazio e use o ID e a chave do app do Instagram. Registre a URL pública HTTPS com o caminho `/social-accounts/instagram/callback`. A conexão começa no frontend: `POST /social-accounts/instagram/connect` devolve o `authorizationUrl` e um `nonce`, que o frontend guarda na aba. O Instagram volta para o callback registrado, que só redireciona o navegador para a página `/social-accounts/instagram/callback` do frontend (`FRONTEND_URL`). Essa página envia `state`, `nonce` e `code` para `POST /social-accounts/instagram/callback` com o token do usuário. O backend confere que o estado de uso único foi criado por esse mesmo usuário com esse nonce e salva o token de longa duração criptografado. Um cron de hora em hora renova os tokens que vencem nos próximos 10 dias (o token do Instagram vale 60 dias e só pode ser renovado depois de 24 horas) e marca como `DISCONNECTED` as contas cujo token já venceu; essas precisam ser conectadas de novo. A renovação manual continua em `POST /social-accounts/:id/instagram/refresh`. `POST /social-accounts/:id/disconnect` desconecta a conta: apaga o token guardado e marca a conta como `DISCONNECTED`, e as publicações dela deixam de ser enviadas. Conectar o mesmo perfil de novo reativa a conta. Erros da Meta são traduzidos em mensagens claras (token vencido, limite de requisições, permissão negada, URL de retorno ou app inválidos), e o log registra código, subcódigo e `fbtrace_id`, sem tokens. O orquestrador prepara o contêiner do Reel e publica quando o Instagram o liberar a partir do horário programado. [Login e permissões da Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login) · [Publicação de conteúdo](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- **Embeddings.** A migração instala pgvector e prepara uma coluna `vector(1536)`. Gerar embeddings e oferecer busca semântica são etapas posteriores.

## Publicação agendada

O endpoint de preparação inicia o fluxo pelo conteúdo, inclusive sem agendamento. O cron continua a execução a cada cinco segundos, conforme os webhooks atualizam as etapas. Um agendamento também ativa automaticamente a preparação cinco minutos antes do horário. O fluxo solicita roteiro e render. Como o anúncio não tem fala, transcrição e legendas ficam prontas na conclusão do render. Consulte os status das etapas em `GET /contents/:id`.

Quando `POST /publications/schedule` recebe `contentDraft`, o agendamento começa com `contentId: null`. Na janela de preparação, o cron `Content-process` usa até cinco fotos do produto para criar o conteúdo com roteiro. O cron associa o conteúdo ao agendamento e chama o orquestrador após salvar o conteúdo.

`POST /publications` retorna o agendamento com `publication: null` enquanto a preparação estiver em andamento. O orquestrador prepara o conteúdo e informa o resultado. Quando todas as etapas estiverem prontas e o vídeo da revisão atual estiver aprovado, o cron cria a publicação dos agendamentos válidos. Se a preparação falhar ou expirar, consulte `preparationError` no agendamento.

O cron de publicação busca conteúdo com `scriptStatus` e `videoStatus` em `READY`, a partir do horário agendado, e verifica se o vídeo da revisão atual foi aprovado. Ele cria o container do Instagram e volta a consultar nos próximos ciclos enquanto o processamento estiver pendente. A reserva atômica no banco evita que duas instâncias executem a mesma publicação. Erros definitivos ou a expiração da janela de 30 minutos encerram a publicação como `FAILED`.

## Testes

A suíte usa um PostgreSQL com pgvector dedicado e simula storage, Claude, o render do Remotion e Instagram. Aponte `TEST_DATABASE_URL` para essa instância, aplique as migrações com `DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate` e execute `npm test`.
