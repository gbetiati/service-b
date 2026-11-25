# Músicas de fundo dos anúncios

As faixas `placeholder-*.mp3` foram sintetizadas com o ffmpeg só para testar o fluxo. Antes de publicar anúncios,
troque por faixas com licença de uso comercial em anúncios pagos e atualize `PRODUCT_AD_MUSIC_TRACKS` em
`src/modules/video-generation/infra/remotion/product-ad.compositions.ts` (o nome da faixa é o nome do arquivo sem
`.mp3`, só com letras minúsculas, números e hífen). As faixas tocam em loop, então qualquer duração funciona.
