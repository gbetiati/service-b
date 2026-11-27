import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AdVideoClip, VideoAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { AdAudio } from '../audio';
import { FONT_FAMILY, SafeArea, benefitGap, optionalColor, readableOn, safeColor, useLayout } from '../shared';
import { BrandChip, ClipVideo, CtaBlock } from './video-shared';

// Tomada contínua: o serviço numa filmagem só, em velocidade real e sem cortes, como os vídeos "satisfatórios" de
// limpeza que viralizam no Reels e no TikTok (a graça é ver o vidro ficando limpo de ponta a ponta). O texto vem em
// caixas no estilo nativo do app (fundo por linha, cantos arredondados), que parece post orgânico e não anúncio.
// A câmera se aproxima devagar o vídeo inteiro, para ter movimento sem cortar. O vídeo termina no fim do clipe, onde
// costuma estar o trabalho pronto, e o fechamento escurece a mesma tomada para o CTA, sem trocar de cena.
// Linha do tempo (30 fps, 450 frames = 15 s): gancho 0–96, benefícios 96–354, fechamento 354–450.
const SCENES = { hook: [0, 96], benefits: [96, 258], close: [354, 96] } as const;
const TOTAL = SCENES.close[0] + SCENES.close[1];

export const VideoAdOneTake: React.FC<VideoAdProps> = ({ copy, product, brand, clips, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? color;
  const bullets = copy.bullets.length ? copy.bullets : [product.name];
  const gap = Math.floor(benefitGap(bullets.length, SCENES.benefits[1], 90));
  const cues = bullets.map((_, index) => SCENES.benefits[0] + index * gap);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={{ hook: 0, benefits: cues, cta: SCENES.close[0] }} />

      <Footage clips={clips} />

      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1]} name="Gancho">
        <NativeCaption text={copy.headline} background="#ffffff" size={86} />
      </Sequence>

      {bullets.map((bullet, index) => {
        const from = cues[index];
        const frames = index === bullets.length - 1 ? SCENES.benefits[0] + SCENES.benefits[1] - from : gap;
        const background = index % 2 ? accent : color;
        return (
          <Sequence key={index} from={from} durationInFrames={frames} name={`Benefício ${index + 1}`}>
            <NativeCaption text={bullet} background={background} size={66} />
          </Sequence>
        );
      })}

      <Sequence from={SCENES.close[0]} durationInFrames={SCENES.close[1]} name="Fechamento">
        <SafeArea style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
          <CtaBlock cta={copy.cta} name={product.name} price={product.price} oldPrice={product.oldPrice} color={color} accent={accent} />
        </SafeArea>
      </Sequence>

      <BrandChip name={brand.name} logoUrl={brand.logoUrl} color={color} />
    </AbsoluteFill>
  );
};

// Trechos da filmagem, sem cortes sempre que possível: o clipe mais longo cobre os 15 s sozinho quando dá. Senão, os
// clipes entram na ordem escolhida, cada um num trecho contínuo e proporcional à duração, e o último fecha o vídeo.
export function footagePlan (clips: AdVideoClip[], fps: number, total: number) {
  const longest = clips.reduce((best, clip) => (clip.durationInSeconds > best.durationInSeconds ? clip : best), clips[0]);

  if (longest.durationInSeconds * fps >= total) return [{ clip: longest, from: 0, frames: total }];

  const seconds = clips.reduce((sum, clip) => sum + clip.durationInSeconds, 0);
  let from = 0;
  return clips.map((clip, index) => {
    const frames = index === clips.length - 1 ? total - from : Math.round((clip.durationInSeconds / seconds) * total);
    const segment = { clip, from, frames };
    from += frames;
    return segment;
  });
}

// A filmagem com aproximação lenta e contínua e o escurecimento suave do fechamento, aplicados por cima de tudo para
// não reiniciar a cada trecho.
const Footage: React.FC<{ clips: AdVideoClip[] }> = ({ clips }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, TOTAL], [1.04, 1.16]);
  const dim = interpolate(frame, [SCENES.close[0] - 6, SCENES.close[0] + 12], [0, 0.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      {footagePlan(clips, fps, TOTAL).map(({ clip, from, frames }, index) => (
        <Sequence key={index} from={from} durationInFrames={frames} name={`Tomada ${index + 1}`}>
          <ClipVideo clip={clip} frames={frames} position={1} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%)' }} />
    </AbsoluteFill>
  );
};

// Texto no estilo nativo do Reels/TikTok: cada linha com o próprio fundo, cantos arredondados, letra pesada. Já está
// na tela no frame 0 da cena (entra com um pequeno salto de escala, sem fade), logo abaixo do selo da marca.
const NativeCaption: React.FC<{ text: string; background: string; size: number }> = ({ text, background, size }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const pop = interpolate(frame, [0, 4, 8], [0.86, 1.05, 1], { extrapolateRight: 'clamp' });
  const fontSize = Math.min(size, (size * 26) / Math.max(text.length, 1) + size * 0.55) * unit;

  return (
    <SafeArea style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      <div style={{ marginTop: 200 * unit, maxWidth: landscape ? '70%' : '92%', textAlign: 'center', transform: `scale(${pop})`, transformOrigin: '50% 50%' }}>
        <span style={{
          backgroundColor: background, color: readableOn(background), fontSize, fontWeight: 800, lineHeight: 1.42,
          padding: `${6 * unit}px ${22 * unit}px`, borderRadius: 16 * unit, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone',
        }}>{text}</span>
      </div>
    </SafeArea>
  );
};
