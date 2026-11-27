import React from 'react';
import { AbsoluteFill, Img, Loop, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AdVideoClip } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { LogoBadge, readableOn, useEnter, useLayout, useSafeArea } from '../shared';

// O que os três templates de vídeo compartilham. As mídias são vídeos reais do serviço (ou do produto em uso), com a
// duração medida pelo backend. O áudio original fica sempre mudo: a locução e a música entram por cima, e o som de
// obra ou de conversa atrapalharia a fala.

// Posição do trecho dentro do clipe: 0 é o começo, 1 é o fim (onde costuma estar o trabalho pronto) e 0,5 o meio.
export type ClipPosition = number;

export function clipAt (clips: AdVideoClip[], index: number) {
  return clips[((index % clips.length) + clips.length) % clips.length];
}

// O clipe que mais provavelmente mostra o resultado: o último escolhido (quem grava costuma filmar o serviço e fechar
// no trabalho pronto). O "antes" vem do primeiro.
export function resultClip (clips: AdVideoClip[]) {
  return clips[clips.length - 1];
}

// Toca `frames` frames do clipe a partir da posição pedida, no tempo da Sequence em que está. Um clipe mais curto que a
// cena repete em loop em vez de congelar no último quadro. `rate` acelera o trecho (serviço real costuma ser lento).
export const ClipVideo: React.FC<{
  clip: AdVideoClip; frames: number; position?: ClipPosition; rate?: number; zoom?: number; origin?: string; dim?: number; blur?: number; style?: React.CSSProperties;
}> = ({ clip, frames, position = 0, rate = 1, zoom = 1, origin = '50% 50%', dim = 0, blur = 0, style }) => {
  const { fps } = useVideoConfig();
  const clipFrames = Math.max(1, Math.floor(clip.durationInSeconds * fps));
  const needed = Math.ceil(frames * rate);
  const videoStyle: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: 'cover', transformOrigin: origin, transform: `scale(${zoom})`, filter: blur ? `blur(${blur}px)` : undefined, ...style,
  };
  // Margem de 2 frames no fim: pedir o último quadro exato de um MP4 às vezes falha na extração.
  const usable = Math.max(1, clipFrames - 2);
  const video = needed <= usable
    ? <OffthreadVideo src={clip.src} muted playbackRate={rate} trimBefore={Math.round((usable - needed) * Math.min(1, Math.max(0, position)))} style={videoStyle} />
    : <Loop durationInFrames={Math.max(1, Math.floor(usable / rate))}><OffthreadVideo src={clip.src} muted playbackRate={rate} style={videoStyle} /></Loop>;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000000' }}>
      {video}
      {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />}
    </AbsoluteFill>
  );
};

// Zoom de impacto num corte: entra mais perto e assenta em poucos frames. Dá movimento já no primeiro frame da cena,
// sem fade a partir do preto (o primeiro frame também é a miniatura do vídeo no feed).
export function usePunchZoom (from = 1.18, to = 1.04, frames = 10) {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, frames], [from, to], { extrapolateRight: 'clamp' });
}

// Degradê escuro em cima e embaixo, para o texto branco ler bem sobre qualquer vídeo.
export const Scrim: React.FC<{ strength?: number }> = ({ strength = 1 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${0.55 * strength}) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0) 58%, rgba(0,0,0,${0.7 * strength}) 100%)` }} />
);

// Texto branco com contorno escuro: lê sobre vídeo claro ou escuro, como as legendas automáticas dos apps.
export function outlinedText (unit: number): React.CSSProperties {
  return { color: '#ffffff', WebkitTextStroke: `${9 * unit}px #000000`, paintOrder: 'stroke fill', textShadow: `0 ${6 * unit}px ${20 * unit}px rgba(0,0,0,0.5)` };
}

// Selo da marca no topo da área segura, do começo ao fim (com logo, desde o frame 0): a Meta associa marca e mensagem principal nos
// primeiros 5 s a mais intenção de compra. Com logo, mostra o logo; sem ele, o nome da marca.
export const BrandChip: React.FC<{ name?: string; logoUrl?: string; color: string; delay?: number }> = ({ name, logoUrl, color, delay = 0 }) => {
  const safe = useSafeArea();
  const { unit } = useLayout();
  const enter = useEnter(delay, 14);

  if (!name && !logoUrl) return null;

  // Com logo: a placa fica parada no topo da área segura do primeiro ao último frame, sem animação.
  if (logoUrl) {
    return (
      <div style={{ position: 'absolute', top: safe.top, left: safe.left, right: safe.right, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <LogoBadge logoUrl={logoUrl} height={110} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: safe.top, left: safe.left, right: safe.right, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14 * unit, padding: `${12 * unit}px ${28 * unit}px`, borderRadius: 999, backgroundColor: color, color: readableOn(color),
        fontSize: 34 * unit, fontWeight: 800, letterSpacing: 0.5 * unit, boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(0,0,0,0.35)`,
        transform: `translateY(${(1 - enter) * -30 * unit}px)`, opacity: enter,
      }}>
        {name}
      </div>
    </div>
  );
};

// Botão de CTA com pulso em loop, dentro da área segura, e o nome do serviço acima. Sem preço, só o nome.
export const CtaBlock: React.FC<{ cta: string; name: string; price?: string; oldPrice?: string; color: string; accent: string }> = ({ cta, name, price, oldPrice, color, accent }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const enter = useEnter(0, 12);
  const button = useEnter(8, 10);
  const pulse = 1 + Math.max(0, Math.sin((frame - 20) / 7)) * 0.05;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 * unit, textAlign: 'center', width: '100%' }}>
      <div style={{ fontSize: (landscape ? 52 : 60) * unit, fontWeight: 800, lineHeight: 1.1, transform: `translateY(${(1 - enter) * 40 * unit}px)`, opacity: enter, ...outlinedText(unit) }}>{name}</div>
      {price && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 * unit, opacity: enter }}>
          {oldPrice && <span style={{ fontSize: 40 * unit, fontWeight: 700, textDecoration: 'line-through', ...outlinedText(unit), color: '#d1d5db' }}>{oldPrice}</span>}
          <span style={{ fontSize: 88 * unit, fontWeight: 900, ...outlinedText(unit) }}>{price}</span>
        </div>
      )}
      <div style={{
        backgroundColor: accent, color: readableOn(accent), borderRadius: 999, padding: `${26 * unit}px ${56 * unit}px`, fontSize: (landscape ? 52 : 58) * unit, fontWeight: 900,
        textTransform: 'uppercase', letterSpacing: 1 * unit, boxShadow: `0 ${14 * unit}px ${40 * unit}px rgba(0,0,0,0.45), 0 0 0 ${8 * unit}px ${color}`,
        transform: `scale(${button * pulse})`, maxWidth: '100%',
      }}>{cta}</div>
    </div>
  );
};
