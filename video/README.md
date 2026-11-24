# Anúncio de produto (Remotion)

Templates usados pelo provider Remotion do módulo `src/modules/video-generation` (`VIDEO_PROVIDER=remotion`). O backend chama a CLI deste projeto (`node_modules/.bin/remotion render`) com `execFile`. O `nest build` não compila nada daqui, porque o `tsconfig.json` da raiz só inclui `src/`.

- `src/Root.tsx` registra, a partir de `src/modules/video-generation/infra/remotion/product-ad.compositions.ts`, `ProductAd-9x16` (1080x1920), `ProductAd-1x1` (1080x1080) e `ProductAd-16x9` (1920x1080), todos a 30 fps com 12 s. O fluxo de publicação usa `ProductAd-9x16` (Reels).
- `src/templates/ProductAd.tsx` tem 4 cenas: produto com zoom e headline, bullets, preço (com o preço antigo riscado, se houver) e CTA com logo.
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
# repita com ProductAd-1x1 e ProductAd-16x9
```

No macOS 26, o Chrome Headless Shell 158 trava (`icudtl.dat not found` / `Target closed`). Nesse caso, adicione `--chrome-mode=chrome-for-testing` e defina `REMOTION_CHROME_MODE=chrome-for-testing` no backend. Em Linux/Docker, o modo padrão funciona.

Para testar o fluxo completo pela API:

1. Configure `VIDEO_PROVIDER=remotion`, `REMOTION_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` e S3.
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
