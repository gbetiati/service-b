import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import type { VideoAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { AdAudio } from '../audio';
import { FONT_FAMILY, SafeArea, benefitGap, optionalColor, readableOn, safeColor, splitWords, useEnter, useLayout } from '../shared';
import { BrandChip, ClipVideo, CtaBlock, Scrim, clipAt, outlinedText, resultClip, usePunchZoom } from './video-shared';

// Resultado primeiro: o vídeo abre no trabalho pronto (o fim do último clipe), com a headline em impacto já no frame 0
// e o selo da marca. Depois "volta" para o processo, um benefício por corte, e fecha no resultado de novo com o CTA.
// Abrir no resultado e depois mostrar como se chegou nele é o gancho mais citado para anúncios de serviço.
// Linha do tempo (30 fps, 450 frames = 15 s): gancho 0–84, virada 84–102, processo 102–354, fechamento 354–450.
const SCENES = { hook: [0, 84], turn: [84, 18], process: [102, 252], close: [354, 96] } as const;
// Os trechos do processo andam 1,3x mais rápido: serviço real costuma ser lento demais para um anúncio de 15 s.
const PROCESS_RATE = 1.3;

export const VideoAdResultFirst: React.FC<VideoAdProps> = ({ copy, product, brand, clips, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? color;
  const bullets = copy.bullets.length ? copy.bullets : [copy.headline];
  const gap = Math.floor(benefitGap(bullets.length, SCENES.process[1], 90));
  const result = resultClip(clips);
  // O processo usa os clipes em ordem, sem o último quando há outros (ele é o resultado, que abre e fecha o vídeo).
  const processClips = clips.length > 1 ? clips.slice(0, -1) : clips;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={{ hook: 0, benefits: bullets.map((_, index) => SCENES.process[0] + index * gap), cta: SCENES.close[0] }} />

      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1]} name="Gancho: resultado">
        <HookScene clip={result} headline={copy.headline} color={color} />
      </Sequence>

      <Sequence from={SCENES.turn[0]} durationInFrames={SCENES.turn[1]} name="Virada">
        <TurnScene clip={processClips[0]} color={accent} />
      </Sequence>

      {bullets.map((bullet, index) => {
        const from = SCENES.process[0] + index * gap;
        const frames = index === bullets.length - 1 ? SCENES.process[0] + SCENES.process[1] - from : gap;
        return (
          <Sequence key={index} from={from} durationInFrames={frames} name={`Processo ${index + 1}`}>
            <ProcessScene clip={clipAt(processClips, index)} position={processClips.length >= bullets.length ? 0.3 : (index + 1) / (bullets.length + 1)}
              frames={frames} text={bullet} step={index + 1} total={bullets.length} color={index % 2 ? accent : color} />
          </Sequence>
        );
      })}

      <Sequence from={SCENES.close[0]} durationInFrames={SCENES.close[1]} name="Fechamento">
        <AbsoluteFill>
          <ClipVideo clip={result} frames={SCENES.close[1]} position={1} zoom={1.06} dim={0.35} />
          <SafeArea style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            <CtaBlock cta={copy.cta} name={product.name} price={product.price} oldPrice={product.oldPrice} color={color} accent={accent} />
          </SafeArea>
        </AbsoluteFill>
      </Sequence>

      <BrandChip name={brand.name} logoUrl={brand.logoUrl} color={color} />
    </AbsoluteFill>
  );
};

// Trabalho pronto em tela cheia com zoom de impacto e a headline grande, já legível no frame 0 (sem fade).
// Cada palavra ganha um pequeno salto em sequência, para a frase ter movimento sem deixar de estar inteira na tela.
const HookScene: React.FC<{ clip: VideoAdProps['clips'][number]; headline: string; color: string }> = ({ clip, headline, color }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const zoom = usePunchZoom(1.22, 1.04, 12);
  const words = splitWords(headline);
  const fontSize = Math.max(76, Math.min(landscape ? 110 : 128, 1500 / Math.max(headline.length, 1))) * unit;

  return (
    <AbsoluteFill>
      <ClipVideo clip={clip} frames={SCENES.hook[1]} position={1} zoom={zoom} />
      <Scrim />
      <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22 * unit, rowGap: 6 * unit, maxWidth: landscape ? '75%' : '100%' }}>
          {words.map((word, index) => {
            const bounce = interpolate(frame - index * 3, [0, 5, 10], [0, -18 * unit, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const highlight = index === words.length - 1;
            return (
              <span key={index} style={{
                fontSize, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase', transform: `translateY(${bounce}px)`,
                ...(highlight
                  ? { backgroundColor: color, color: readableOn(color), padding: `0 ${16 * unit}px`, borderRadius: 14 * unit, transform: `translateY(${bounce}px) rotate(-2deg)` }
                  : outlinedText(unit)),
              }}>{word}</span>
            );
          })}
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Virada curta para o processo: zoom rápido no primeiro clipe com uma faixa "Veja como é feito" cruzando a tela.
const TurnScene: React.FC<{ clip: VideoAdProps['clips'][number]; color: string }> = ({ clip, color }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const sweep = interpolate(frame, [0, SCENES.turn[1]], [-110, 110]);
  const zoom = interpolate(frame, [0, SCENES.turn[1]], [1.5, 1.1]);

  return (
    <AbsoluteFill>
      <ClipVideo clip={clip} frames={SCENES.turn[1]} position={0} zoom={zoom} blur={interpolate(frame, [0, 8], [8, 0], { extrapolateRight: 'clamp' })} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          transform: `translateX(${sweep}%) rotate(-6deg)`, backgroundColor: color, color: readableOn(color), padding: `${18 * unit}px ${60 * unit}px`,
          fontSize: 64 * unit, fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: 2 * unit,
        }}>Veja como é feito</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Um benefício por corte: o trecho do processo acelerado, com o benefício num cartão e o passo atual ("2/3").
const ProcessScene: React.FC<{ clip: VideoAdProps['clips'][number]; position: number; frames: number; text: string; step: number; total: number; color: string }> = ({ clip, position, frames, text, step, total, color }) => {
  const { unit, landscape } = useLayout();
  const zoom = usePunchZoom(1.14, 1.03, 9);
  const enter = useEnter(2, 13);

  return (
    <AbsoluteFill>
      <ClipVideo clip={clip} frames={frames} position={position} rate={PROCESS_RATE} zoom={zoom} />
      <Scrim strength={0.8} />
      <SafeArea style={{ justifyContent: 'flex-end', alignItems: landscape ? 'flex-start' : 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 26 * unit, maxWidth: landscape ? '60%' : '100%', backgroundColor: '#ffffff', color: '#111111',
          borderRadius: 30 * unit, padding: `${26 * unit}px ${34 * unit}px`, boxShadow: `0 ${16 * unit}px ${44 * unit}px rgba(0,0,0,0.4)`,
          borderLeft: `${14 * unit}px solid ${color}`, transform: `translateY(${(1 - enter) * 80 * unit}px)`, opacity: enter,
        }}>
          <div style={{ flex: 'none', fontSize: 34 * unit, fontWeight: 900, color: '#6b7280' }}>{step}/{total}</div>
          <div style={{ fontSize: 54 * unit, fontWeight: 800, lineHeight: 1.12 }}>{text}</div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};
