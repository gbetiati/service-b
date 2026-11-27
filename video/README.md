# Anúncio de produto (Remotion)

Templates usados pelo provider Remotion do módulo `src/modules/video-generation`. O backend chama a CLI deste projeto (`node_modules/.bin/remotion render`) com `execFile`. O `nest build` não compila nada daqui, porque o `tsconfig.json` da raiz só inclui `src/`.

- `src/Root.tsx` registra, a partir de `src/modules/video-generation/infra/remotion/product-ad.compositions.ts`, sete templates em três formatos cada (`<Template>-9x16`, `-1x1` e `-16x9`), todos a 30 fps com 15 s. O fluxo de publicação usa o formato 9x16 (Reels) e sorteia o template a cada render, com o ID do render como semente, entre os templates do tipo do conteúdo (`contentMediaType`):
  - conteúdo `IMAGE`: os quatro templates de foto em `src/templates/image-templates/` (props `ProductAdProps`, com até três fotos, `PRODUCT_AD_MAX_IMAGES`, distribuídas pelas cenas: em geral a 1ª na abertura, a 2ª nos benefícios e a 3ª no fechamento; com menos fotos, as cenas repetem as que existem; `imageAt` em `shared.tsx`);
  - conteúdo `VIDEO`: os três templates de vídeo em `src/templates/video-templates/` (props `VideoAdProps`, com todos os vídeos escolhidos e a duração de cada um medida pelo backend com FFprobe).
- Templates de foto (`image-templates/`). Todos mostram foto e texto já no primeiro frame, leem sem som e mantêm texto, preço e CTA na área segura do 9x16 (`useSafeArea` em `shared.tsx`: 14% em cima, 35% embaixo e 6% nas laterais ficam livres para a interface do app):
  - `ProductAdStory`: Story de criador. Foto sempre em tela cheia com aproximação lenta, headline no texto com fundo arredondado por linha da ferramenta do Instagram, seta e nome do produto escritos à mão (fonte Caveat), benefícios como stickers que pulam no terço central e CTA no formato do sticker de link com um toque animado. A troca de foto entre as cenas é um deslize lateral curto.
  - `ProductAdReveal`: headline gigante em letras vazadas com a foto por dentro e escurecida pela cor da marca do lado de fora (text mask, feito com `mix-blend-mode: multiply` sobre o `<Img>` para o Remotion esperar a foto carregar), travessia para a foto inteira, uma tela por benefício em tipografia cinética com marca-texto, cortes com desfoque de movimento e fechamento com painel de vidro (`backdrop-filter`) e brilho correndo no CTA.
  - `ProductAdNative`: visual de Reels orgânico. Foto com movimento de câmera na mão, troca de foto e corte de zoom a cada trecho e legendas no estilo automático (até 3 palavras, a palavra atual destacada na cor da marca); preço em adesivo e seta apontando para o botão do anúncio.
  - `ProductAdMontage`: um corte por palavra da headline, cada um num recorte de detalhe das fotos com flash; benefícios em cartões empilhados; a foto principal inteira com nome e preço; CTA com uma faixa de recortes correndo.
  - Os templates de foto antigos (ProductAd, Editorial, Kinetic, Checklist, Callouts e Offer) foram removidos; uma cópia está em `video/removed-templates-backup/`, fora do `src` (não entra no bundle).
- Templates de vídeo (`video-templates/`), pensados para mostrar um serviço sendo feito. O último vídeo escolhido é tratado como o resultado (quem grava costuma fechar no trabalho pronto) e o primeiro como o "antes". O áudio original fica mudo: a locução e a música entram por cima.
  - `VideoAdResultFirst`: abre no resultado, com zoom de impacto e a headline em tela cheia já no frame 0; uma faixa "Veja como é feito" vira para o processo (um benefício por corte, acelerado 1,3x, com contador "1/3") e o fechamento volta ao resultado com o CTA.
  - `VideoAdBeforeAfter`: antes e depois com cortina, com a linha varrendo a tela nos 2,5 primeiros segundos e etiquetas "Antes"/"Depois"; depois o processo com os benefícios e o depois em tela cheia com o CTA. Com um vídeo só, o antes e o depois saem do começo e do fim dele.
  - `VideoAdCaptions`: visual de Reels orgânico. A headline entra como adesivo de texto do app sobre o resultado com câmera na mão, depois cortes a cada 1,5 s por todos os vídeos com legendas palavra a palavra, e o CTA com seta para o botão do anúncio.
  - Os três seguem o que as referências de anúncios de serviço em Reels mais repetem: gancho no primeiro segundo (movimento e texto já no frame 0, sem fade do preto, porque o primeiro frame também é a miniatura), resultado ou transformação logo no começo, marca nos primeiros segundos (selo no topo da área segura), leitura sem som e CTA com pelo menos 3 s no fim. `video-templates/video-shared.tsx` tem o player de trechos (`ClipVideo`: corta pelo começo, meio ou fim do vídeo, acelera e repete em loop um vídeo mais curto que a cena), o selo da marca e o bloco de CTA.
- `src/preview/index.ts` exporta o `Player` do Remotion (`@remotion/player`) e os templates de foto para a página `/templates` do ag-frontend, que mostra cada template com fotos de exemplo e salva o tipo de foto (produto ou pessoa) de cada cena (`ImageTemplateSetting`, rotas `/image-templates`). O Player sai deste projeto junto com os templates para os dois usarem a mesma cópia do Remotion; com duas, os templates não enxergam o contexto do player. O Studio e o render não usam esse arquivo.
- Fotos com tipo: cada foto do produto é `PRODUCT` ou `PERSON` (`MediaAsset.kind`). Quando o template sorteado tem configuração salva, `ProductAdPolicy.arrangeImages` dá a cada cena a primeira foto ainda não usada do tipo preferido nela (sem nenhuma desse tipo, a próxima disponível); sem configuração, as fotos entram na ordem do conteúdo.
- `src/templates/shared.tsx` e `src/templates/audio.tsx` ficam na raiz de `templates/` porque servem aos dois tipos. `shared.tsx` tem o que os templates compartilham: fonte, escala por formato (`useLayout`), área segura (`useSafeArea`, `SafeArea`), entrada com mola (`useEnter`), foto e cores de texto por contraste (`readableOn`, `inkOnWhite`). Um template de foto novo deve receber `ProductAdProps`, durar `PRODUCT_AD_DURATION_IN_FRAMES` e entrar em `PRODUCT_AD_TEMPLATES` e no mapa de `Root.tsx`; um de vídeo recebe `VideoAdProps` e entra em `VIDEO_AD_TEMPLATES` e no mapa `videoComponents`.
- As props usam o tipo `ProductAdProps` de `src/modules/video-generation/domain/entities/product-ad.ts`, compartilhado com o backend. Esse arquivo e o de composições não podem ter imports.
- A fonte Inter (licença OFL, em `public/fonts`) é local, então o render não depende de rede para a tipografia.

## Instalação

```bash
cd video
npm ci
npx remotion browser ensure   # baixa o Chrome Headless Shell antes do primeiro render
```

## Smoke test manual

```bash
cd video
npx remotion render src/index.ts ProductAdStory-9x16 out/sample-9x16.mp4 --props=./sample-props.json
# repita com os outros formatos (-1x1, -16x9) e templates (ProductAdReveal, ProductAdNative, ProductAdMontage)
```

No macOS 26, o Chrome Headless Shell 158 trava (`icudtl.dat not found` / `Target closed`). Nesse caso, adicione `--chrome-mode=chrome-for-testing` e defina `REMOTION_CHROME_MODE=chrome-for-testing` no backend. Em Linux/Docker, o modo padrão funciona.

Para testar o fluxo completo pela API:

1. Configure `REMOTION_WEBHOOK_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` e S3.
2. Crie um produto com `price` (e, opcionalmente, `oldPrice`) e associe uma foto em `POST /products/:id/media`.
3. Crie o conteúdo com `POST /contents` e inicie a preparação com `POST /publications/contents/:id/prepare`.
4. Consulte `GET /contents/:id/video-generations` até `status: READY` e abra a `video.url`.

## Docker (quando houver Dockerfile)

O render precisa de uma imagem glibc (Debian/Ubuntu), não Alpine, por compatibilidade com `sharp` e Chromium. Base sugerida pela doc do Remotion:

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 \
    libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*
# ... npm ci do backend ...
COPY video/package.json video/package-lock.json video/
RUN cd video && npm ci && npx remotion browser ensure   # evita baixar o browser no primeiro render
```

Cada instância que renderiza precisa de pelo menos 2 vCPU e 4 GB de RAM. Mantenha `REMOTION_MAX_CONCURRENT_RENDERS=1` até medir o consumo.

## Otimização opcional

`npm run bundle` gera `build/`. Para evitar re-bundle a cada render, aponte `REMOTION_ENTRY` para esse diretório (a CLI aceita uma serve URL ou um bundle no primeiro argumento). Antes de usar em produção, valide que essa forma funciona com a versão instalada.

## Operação

- **S3:** configure lifecycle no bucket para expirar `remotion-renders/` em 1 dia. O webhook já remove o MP4 intermediário depois de copiá-lo para o local definitivo; a regra cobre falhas.
- **Licença:** empresas com 4 ou mais pessoas podem precisar de licença comercial do Remotion para renderização automatizada. Confira em <https://www.remotion.dev/docs/license>.
- **Custos:** API da Anthropic (por token; a copy usa `effort: low` e uma chamada por render), CPU de render e armazenamento e tráfego no S3. Cada revisão de conteúdo gera no máximo um render.
