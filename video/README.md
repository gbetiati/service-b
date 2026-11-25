# Anúncio de produto (Remotion)

Templates usados pelo provider Remotion do módulo `src/modules/video-generation`. O backend chama a CLI deste projeto (`node_modules/.bin/remotion render`) com `execFile`. O `nest build` não compila nada daqui, porque o `tsconfig.json` da raiz só inclui `src/`.

- `src/Root.tsx` registra, a partir de `src/modules/video-generation/infra/remotion/product-ad.compositions.ts`, oito templates em três formatos cada (`<Template>-9x16`, `-1x1` e `-16x9`), todos a 30 fps com 15 s. O fluxo de publicação usa o formato 9x16 (Reels) e sorteia o template a cada render, com o ID do render como semente.
  - `ProductAd`: foto em tela cheia com headline, benefícios sobre a foto desfocada, preço (com o preço antigo riscado, se houver) e CTA com logo.
  - `ProductAdEditorial`: estilo revista. Fundo na cor principal, foto em cartão, headline palavra por palavra, benefícios numerados, preço em selo e CTA com sublinhado animado.
  - `ProductAdKinetic`: tipografia em movimento. Headline em tela cheia palavra por palavra, foto revelada por um círculo, uma tela por benefício alternando as cores da marca, preço com impacto e CTA sobre faixas diagonais.
  - `ProductAdChecklist`: headline com marca-texto sobre a foto em cartão, cartão branco em que cada benefício é marcado em sequência (com contador) e fechamento de 4 s com preço e um "toque" animado no botão de CTA.
  - `ProductAdCallouts`: a foto em tela cheia encolhe para um círculo iluminado que fica até o fim sem cortes; os benefícios aparecem como etiquetas ligadas ao produto por linhas, o preço entra em selo e o CTA tem brilho em loop.
  - `ProductAdNative`: visual de Reels orgânico. Foto com movimento de câmera na mão, corte de zoom a cada trecho e legendas no estilo automático (até 3 palavras, a palavra atual destacada na cor da marca); preço em adesivo e seta apontando para o botão do anúncio.
  - `ProductAdOffer`: abre com o preço, o preço antigo riscado e o percentual de desconto (calculado dos preços do cadastro, só a partir de 5%), entre fitas com texto correndo. Depois produto, benefícios em faixas e fechamento retomando a oferta com o CTA. Sem preço, abre com a headline.
  - `ProductAdMontage`: um corte por palavra da headline, cada um num recorte de detalhe da foto com flash; benefícios em cartões empilhados; a foto inteira com nome e preço; CTA com uma faixa de recortes correndo.
- Os cinco últimos seguem convenções de anúncios em Reels: algo forte já no primeiro segundo (a foto aparece no frame 0), leitura sem som (todo o argumento está na tela), uma ideia por tela, CTA com pelo menos 2 s no fim e texto, preço e CTA dentro da área segura do 9x16 (`useSafeArea` em `shared.tsx`: 14% em cima, 35% embaixo e 6% nas laterais ficam livres para a interface do app). Os três primeiros ainda põem texto na faixa de baixo, que a legenda e o botão do anúncio cobrem.
- `src/templates/shared.tsx` tem o que os templates compartilham: fonte, escala por formato (`useLayout`), área segura (`useSafeArea`, `SafeArea`), entrada com mola (`useEnter`), foto e cores de texto por contraste (`readableOn`, `inkOnWhite`). Um template novo deve receber `ProductAdProps`, durar `PRODUCT_AD_DURATION_IN_FRAMES` e entrar em `PRODUCT_AD_TEMPLATES` e no mapa de `Root.tsx`.
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
npx remotion render src/index.ts ProductAd-9x16 out/sample-9x16.mp4 --props=./sample-props.json
# repita com os outros formatos (-1x1, -16x9) e templates (ProductAdEditorial, ProductAdKinetic, ProductAdChecklist,
# ProductAdCallouts, ProductAdNative, ProductAdOffer, ProductAdMontage)
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
