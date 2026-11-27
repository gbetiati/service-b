import React from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AdVideoClip, VideoAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { AdAudio } from '../audio';
import { FONT_FAMILY, SafeArea, inkOnWhite, optionalColor, readableOn, safeColor, splitWords, useEnter, useLayout } from '../shared';
import { BrandChip, ClipVideo, clipAt, outlinedText, resultClip } from './video-shared';

// Visual nativo de Reels, que se parece com conteúdo orgânico e não com anúncio: a headline entra como adesivo de
// texto do app no frame 0, sobre o trabalho pronto com câmera na mão. Depois, cortes secos a cada 1,5 s passando por
// todos os clipes, com legendas palavra a palavra no estilo automático (lê sem som) e, no fim, o
// CTA com uma seta para o botão do anúncio.
// Linha do tempo (30 fps, 450 frames = 15 s): adesivo 0–60, legendas 60–354, CTA 354–450.
const SCENES = { sticker: [0, 60], captions: [60, 294], cta: [354, 96] } as const;
const CUT = 45;
const SHOTS = [
  { zoom: 1.06, origin: '50% 50%' }, { zoom: 1.22, origin: '40% 40%' }, { zoom: 1.12, origin: '60% 60%' }, { zoom: 1.3, origin: '50% 35%' },
];

type Word = { text: string; segment: number; start: number };
type Chunk = { words: Word[]; start: number; end: number };

export const VideoAdCaptions: React.FC<VideoAdProps> = ({ copy, product, brand, clips, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? color;
  const bullets = copy.bullets.length ? copy.bullets : [product.name];
  const { words, chunks, segmentStarts } = buildCaptions(bullets, SCENES.captions[0], SCENES.captions[1]);
  const cuts = Array.from({ length: Math.ceil(SCENES.captions[1] / CUT) }, (_, index) => ({
    from: SCENES.captions[0] + index * CUT,
    frames: Math.min(CUT, SCENES.captions[1] - index * CUT),
    clip: clipAt(clips, index),
    // Cada volta pelos clipes usa um trecho diferente deles.
    position: ((Math.floor(index / clips.length) * 0.37) + 0.15) % 1,
    shot: SHOTS[index % SHOTS.length],
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={{ hook: 0, benefits: segmentStarts, cta: SCENES.cta[0] }} />

      <Sequence from={SCENES.sticker[0]} durationInFrames={SCENES.sticker[1]} name="Gancho: adesivo">
        <Handheld clip={resultClip(clips)} frames={SCENES.sticker[1]} position={1} shot={SHOTS[0]} />
        <Sticker text={copy.headline} color={color} />
      </Sequence>

      {cuts.map((cut, index) => (
        <Sequence key={index} from={cut.from} durationInFrames={cut.frames} name={`Corte ${index + 1}`}>
          <Handheld clip={cut.clip} frames={cut.frames} position={cut.position} shot={cut.shot} rate={1.25} />
        </Sequence>
      ))}
      <Sequence from={SCENES.captions[0]} durationInFrames={SCENES.captions[1]} name="Legendas">
        <Captions words={words} chunks={chunks} offset={SCENES.captions[0]} colors={[color, accent]} />
      </Sequence>

      <Sequence from={SCENES.cta[0]} durationInFrames={SCENES.cta[1]} name="CTA">
        <Handheld clip={resultClip(clips)} frames={SCENES.cta[1]} position={1} shot={SHOTS[0]} dim={0.35} />
        <CtaScene cta={copy.cta} name={product.name} price={product.price} color={accent} />
      </Sequence>

      <BrandChip name={brand.name} logoUrl={brand.logoUrl} color={color} delay={SCENES.sticker[1] - 10} />
    </AbsoluteFill>
  );
};

// Distribui as palavras dos benefícios pela janela das legendas e agrupa em blocos de até 3 palavras e 16 letras,
// quebrando na pontuação e na troca de benefício. Os frames são absolutos (desde o início do vídeo).
function buildCaptions (segments: string[], start: number, window: number) {
  const all = segments.flatMap((text, segment) => splitWords(text).map(word => ({ text: word, segment })));
  const duration = all.length ? window / all.length : window;
  const words: Word[] = all.map((word, index) => ({ ...word, start: start + index * duration }));
  const chunks: Chunk[] = [];
  for (const word of words) {
    const current = chunks[chunks.length - 1];
    const previous = current?.words[current.words.length - 1];
    const length = current ? current.words.reduce((sum, item) => sum + item.text.length + 1, word.text.length) : 0;
    if (!current || current.words.length >= 3 || length > 16 || previous!.segment !== word.segment || /[.,!?;:]$/.test(previous!.text)) {
      chunks.push({ words: [word], start: word.start, end: word.start + duration });
    } else {
      current.words.push(word);
      current.end = word.start + duration;
    }
  }
  const segmentStarts = segments.map((_, segment) => words.find(word => word.segment === segment)?.start).filter((value): value is number => value !== undefined).map(Math.round);
  return { words, chunks, segmentStarts };
}

// Câmera na mão: tremor leve somado a uma aproximação lenta, sobre o enquadramento do corte.
const Handheld: React.FC<{ clip: AdVideoClip; frames: number; position: number; shot: { zoom: number; origin: string }; rate?: number; dim?: number }> = ({ clip, frames, position, shot, rate, dim }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const push = 1 + Math.min(1, frame / 60) * 0.04;
  const x = Math.sin(frame / 15) * 7 * unit + Math.sin(frame / 5.7) * 2 * unit;
  const y = Math.cos(frame / 12) * 5 * unit;
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${Math.sin(frame / 21) * 0.4}deg)` }}>
      <ClipVideo clip={clip} frames={frames} position={position} rate={rate} zoom={shot.zoom * push * 1.04} origin={shot.origin} dim={dim} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.35) 100%)' }} />
    </AbsoluteFill>
  );
};

// Adesivo de texto branco inclinado, como os do próprio app. Já está inteiro no frame 0 e balança de leve; a última
// palavra ganha a cor da marca.
const Sticker: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const pop = spring({ frame, fps, from: 1.12, to: 1, config: { damping: 9, mass: 0.5 } });
  const wobble = Math.sin(frame / 7) * 1.4;
  const words = splitWords(text);
  const fontSize = Math.max(64, Math.min(landscape ? 92 : 104, 1300 / Math.max(text.length, 1))) * unit;

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        backgroundColor: '#ffffff', color: '#111111', borderRadius: 28 * unit, padding: `${26 * unit}px ${40 * unit}px`, maxWidth: landscape ? '70%' : '100%',
        fontSize, fontWeight: 900, lineHeight: 1.08, textAlign: 'center', boxShadow: `0 ${20 * unit}px ${50 * unit}px rgba(0,0,0,0.45)`,
        transform: `scale(${pop}) rotate(${-3 + wobble}deg)`,
      }}>
        {words.map((word, index) => (
          <span key={index} style={index === words.length - 1 ? { color: inkOnWhite(color) } : undefined}>{word}{index < words.length - 1 ? ' ' : ''}</span>
        ))}
      </div>
    </SafeArea>
  );
};

// Legenda automática: até 3 palavras por vez, a palavra atual numa caixa na cor da marca (alternando a cada benefício).
const Captions: React.FC<{ words: Word[]; chunks: Chunk[]; offset: number; colors: [string, string] }> = ({ words, chunks, offset, colors }) => {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const frame = local + offset;
  const chunk = chunks.find(item => frame >= item.start && frame < item.end);
  if (!chunk) return null;
  const active = words.filter(word => word.start <= frame).length - 1;
  const pop = spring({ frame: frame - chunk.start, fps, config: { damping: 12, mass: 0.4 } });
  const letters = chunk.words.reduce((sum, word) => sum + word.text.length + 1, -1);
  const fontSize = Math.max(64, Math.min(landscape ? 96 : 108, 1250 / Math.max(letters, 1))) * unit;

  return (
    <SafeArea style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 20 * unit, rowGap: 10 * unit, maxWidth: landscape ? '70%' : '100%',
        fontSize, fontWeight: 900, lineHeight: 1.1, textTransform: 'uppercase', textAlign: 'center', transform: `scale(${0.82 + 0.18 * pop})`, opacity: Math.min(1, pop * 2),
      }}>
        {chunk.words.map(word => {
          const current = words.indexOf(word) === active;
          const color = colors[word.segment % 2];
          return current
            ? <span key={word.start} style={{ backgroundColor: color, color: readableOn(color), padding: `${2 * unit}px ${18 * unit}px`, borderRadius: 16 * unit, transform: 'rotate(-2deg) scale(1.06)' }}>{word.text}</span>
            : <span key={word.start} style={outlinedText(unit)}>{word.text}</span>;
        })}
      </div>
    </SafeArea>
  );
};

// CTA grande em legenda, o nome do serviço (e o preço, se houver) e uma seta quicando para o botão do anúncio.
const CtaScene: React.FC<{ cta: string; name: string; price?: string; color: string }> = ({ cta, name, price, color }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const pop = useEnter(0, 10);
  const arrow = useEnter(10);
  const bounce = Math.abs(Math.sin(frame / 6)) * 24 * unit;

  return (
    <SafeArea style={{ justifyContent: 'center', alignItems: 'center', gap: 34 * unit }}>
      <div style={{ fontSize: 48 * unit, fontWeight: 800, textAlign: 'center', opacity: pop, ...outlinedText(unit) }}>{price ? `${name} · ${price}` : name}</div>
      <div style={{ fontSize: (landscape ? 96 : 108) * unit, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase', textAlign: 'center', transform: `scale(${pop})`, ...outlinedText(unit) }}>{cta}</div>
      <div style={{
        width: 124 * unit, height: 124 * unit, borderRadius: '50%', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: arrow, transform: `translateY(${bounce}px) scale(${arrow})`, boxShadow: `0 ${12 * unit}px ${30 * unit}px rgba(0,0,0,0.4)`,
      }}>
        <svg width={66 * unit} height={66 * unit} viewBox="0 0 24 24"><path d="M12 4v15M5 12l7 7 7-7" fill="none" stroke={readableOn(color)} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </SafeArea>
  );
};
