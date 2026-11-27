import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductAdProps } from '../../../../src/modules/video-generation/domain/entities/product-ad';
import { LogoBadge, LogoBug, FONT_FAMILY, SafeArea, benefitGap, fitFontSize, imageAt, mix, optionalColor, readableOn, safeColor, splitWords, useLayout, useSafeArea } from '../shared';
import { AdAudio, AudioCues } from '../audio';

// Revelação pelo texto: abre com a headline gigante em letras vazadas, com a foto aparecendo por dentro delas e
// escurecida pela cor da marca do lado de fora (o "text mask" dos Reels). Em seguida a câmera atravessa o texto e a
// foto toma a tela inteira. Os benefícios entram em tipografia cinética, uma tela por benefício, com marca-texto na cor
// da marca e a foto passeando a cada corte; o fechamento é um painel de vidro desfocado sobre a foto, com brilho no CTA.
// Linha do tempo (30 fps, 450 frames = 15 s): texto vazado 0–48, travessia 48–78 (foto 1), benefícios 78–342 (foto 2),
// fechamento 342–450 (foto 3).
const SCENES = { hook: [0, 78], benefits: [78, 264], close: [342, 108] } as const;
const ZOOM = [48, 78] as const;
const WHIP = 8;
// Enquadramentos da foto a cada benefício: cada tela aproxima e desloca para um ponto diferente.
const PANS = [{ origin: '30% 40%', zoom: 1.22 }, { origin: '70% 55%', zoom: 1.3 }, { origin: '45% 70%', zoom: 1.18 }, { origin: '60% 30%', zoom: 1.26 }];
const slot = (count: number) => benefitGap(count, SCENES.benefits[1], 96);
const audioCues = (bullets: number): AudioCues => ({
  hook: 0, benefits: Array.from({ length: bullets }, (_, index) => SCENES.benefits[0] + index * slot(bullets)), cta: SCENES.close[0] + 8,
});

export const ProductAdReveal: React.FC<ProductAdProps> = ({ copy, product, brand, audio }) => {
  const color = safeColor(brand.primaryColor);
  const accent = optionalColor(brand.secondaryColor) ?? color;
  const bullets = copy.bullets.length ? copy.bullets : [product.name];
  const gap = slot(bullets.length);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: `${FONT_FAMILY}, sans-serif` }}>
      <AdAudio audio={audio} cues={audioCues(bullets.length)} />
      <Sequence from={SCENES.hook[0]} durationInFrames={SCENES.hook[1] + WHIP} name="Texto vazado">
        <MaskedHook imageUrl={imageAt(product, 0)} headline={copy.headline} name={product.name} logoUrl={brand.logoUrl} color={color} accent={accent} />
      </Sequence>
      {bullets.map((bullet, index) => {
        const from = SCENES.benefits[0] + index * gap;
        const frames = index === bullets.length - 1 ? SCENES.benefits[0] + SCENES.benefits[1] - from : gap;
        return (
          <Sequence key={index} from={from} durationInFrames={frames + WHIP} name={`Benefício ${index + 1}`}>
            <KineticBenefit imageUrl={imageAt(product, 1)} text={bullet} pan={PANS[index % PANS.length]} color={index % 2 ? accent : color} frames={frames} />
          </Sequence>
        );
      })}
      <Sequence from={SCENES.close[0]} durationInFrames={SCENES.close[1]} name="Fechamento">
        <GlassClose imageUrl={imageAt(product, 2)} name={product.name} price={product.price} oldPrice={product.oldPrice} cta={copy.cta} logoUrl={brand.logoUrl} color={color} accent={accent} />
      </Sequence>
      <LogoBug logoUrl={brand.logoUrl} />
    </AbsoluteFill>
  );
};

// Maior fonte em que o texto vazado cabe na área: cada palavra numa linha da largura e todas as linhas na altura.
// Quebra as linhas como o navegador (palavra a palavra), com a largura média de uma letra maiúscula em negrito.
function maskFontSize (headline: string, width: number, height: number, unit: number) {
  const words = splitWords(headline.toUpperCase());
  const longest = Math.max(...words.map(word => word.length), 1);
  for (let size = Math.min(250 * unit, width / (longest * 0.66)); size > 40 * unit; size *= 0.94) {
    const lineChars = Math.floor(width / (size * 0.66));
    let lines = 1;
    let used = 0;
    for (const word of words) {
      if (used && used + 1 + word.length > lineChars) { lines++; used = word.length; } else used += (used ? 1 : 0) + word.length;
    }
    if (lines * size * 0.92 <= height) return size;
  }
  return 40 * unit;
}

// A camada do texto multiplica a foto: branco nas letras (a foto aparece inteira) e um tom escuro da cor da marca no
// resto. Na travessia, a camada cresce e clareia até branco, e a foto fica inteira na tela.
const MaskedHook: React.FC<{ imageUrl: string; headline: string; name: string; logoUrl?: string; color: string; accent: string }> = ({ imageUrl, headline, name, logoUrl, color, accent }) => {
  const frame = useCurrentFrame();
  const { unit, landscape } = useLayout();
  const safe = useSafeArea();
  const through = interpolate(frame, ZOOM, [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const settle = interpolate(frame, [0, 14], [1.12, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const photoZoom = interpolate(frame, [0, ZOOM[1], ZOOM[1] + WHIP + 20], [1.18, 1.08, 1.04]);
  const exit = interpolate(frame, [SCENES.hook[1], SCENES.hook[1] + WHIP], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // O selo com o nome fica no topo da área segura; o texto ocupa o resto, sem encostar nele.
  const chipSpace = 110 * unit;
  const fontSize = maskFontSize(headline, landscape ? safe.width * 0.7 : safe.width, safe.height - chipSpace, unit);
  const chip = interpolate(frame, [0, 10, ZOOM[0], ZOOM[0] + 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ filter: exit ? `blur(${exit * 18}px)` : undefined, transform: `translateX(${-exit * 30}%)` }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${photoZoom})` }} />
      </AbsoluteFill>
      {through < 1 && (
        <AbsoluteFill style={{ mixBlendMode: 'multiply', backgroundColor: mix(mix(color, '#000000', 0.78), '#ffffff', through), transform: `scale(${settle * (1 + through * through * 7)})` }}>
          <SafeArea style={{ justifyContent: 'center', alignItems: 'center', paddingTop: safe.top + chipSpace }}>
            <div style={{
              color: '#ffffff', fontSize, fontWeight: 900, lineHeight: 0.9, letterSpacing: -0.04 * fontSize, textTransform: 'uppercase', textAlign: 'center',
              maxWidth: landscape ? '70%' : '100%', overflowWrap: 'anywhere',
            }}>{headline}</div>
          </SafeArea>
        </AbsoluteFill>
      )}
      <div style={{ position: 'absolute', top: safe.top, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: chip }}>
        <div style={{ maxWidth: logoUrl ? safe.width - 2 * 230 * unit : safe.width, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: `${10 * unit}px ${26 * unit}px`, borderRadius: 999, backgroundColor: accent, color: readableOn(accent), fontSize: 32 * unit, fontWeight: 800, letterSpacing: 1 * unit, textTransform: 'uppercase' }}>{name}</div>
      </div>
    </AbsoluteFill>
  );
};

// Uma tela por benefício: as palavras sobem uma a uma e um marca-texto na cor da marca varre a frase. A foto se
// aproxima de um ponto diferente a cada tela, e a troca entre telas é um corte com desfoque de movimento.
const KineticBenefit: React.FC<{ imageUrl: string; text: string; pan: { origin: string; zoom: number }; color: string; frames: number }> = ({ imageUrl, text, pan, color, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const enter = interpolate(frame, [0, WHIP], [1, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [frames, frames + WHIP], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoom = interpolate(frame, [0, frames + WHIP], [pan.zoom, pan.zoom + 0.08]);
  const sweep = interpolate(frame, [10, 26], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const words = splitWords(text);
  const fontSize = Math.max(86, Math.min(landscape ? 112 : 136, 2800 / Math.max(text.length, 1))) * unit;
  const marker = readableOn(color);

  return (
    <AbsoluteFill style={{ filter: enter + exit > 0.01 ? `blur(${(enter + exit) * 16}px)` : undefined, transform: `translateX(${(enter - exit) * 18}%)` }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transformOrigin: pan.origin, transform: `scale(${zoom})` }} />
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.5) 100%)' }} />
      </AbsoluteFill>
      <SafeArea style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ maxWidth: landscape ? '70%' : '100%', textAlign: 'center', fontSize, fontWeight: 900, lineHeight: 1.18, letterSpacing: -0.03 * fontSize }}>
          <span style={{
            backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: 'no-repeat', backgroundSize: `${sweep}% 100%`, backgroundPosition: '0 0',
            padding: `0 ${0.18 * fontSize}px`, borderRadius: 0.16 * fontSize, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone',
          }}>
            {words.map((word, index) => {
              const rise = spring({ frame: frame - 2 - index * 3, fps, config: { damping: 14, mass: 0.5 } });
              return (
                <span key={index} style={{
                  display: 'inline-block', marginRight: index < words.length - 1 ? '0.26em' : 0, color: sweep > 60 ? marker : '#ffffff',
                  transform: `translateY(${(1 - rise) * 0.6}em)`, opacity: Math.min(1, rise * 2), textShadow: sweep > 60 ? 'none' : `0 ${4 * unit}px ${18 * unit}px rgba(0,0,0,0.5)`,
                }}>{word}</span>
              );
            })}
          </span>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Painel de vidro desfocado sobre a foto, com nome, preço (quando há) e um CTA com brilho correndo em loop.
const GlassClose: React.FC<{ imageUrl: string; name: string; price?: string; oldPrice?: string; cta: string; logoUrl?: string; color: string; accent: string }> = ({ imageUrl, name, price, oldPrice, cta, logoUrl, color, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, landscape } = useLayout();
  const enter = interpolate(frame, [0, WHIP], [1, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const panel = spring({ frame: frame - 6, fps, config: { damping: 15, mass: 0.7 } });
  const button = spring({ frame: frame - 16, fps, config: { damping: 11 } });
  const shine = ((frame - 24) % 45) / 45;

  return (
    <AbsoluteFill style={{ filter: enter > 0.01 ? `blur(${enter * 16}px)` : undefined }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${interpolate(frame, [0, SCENES.close[1]], [1.12, 1.02])})` }} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, ${mix(color, '#000000', 0.55)}88 100%)` }} />
      </AbsoluteFill>
      <SafeArea style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
        <div style={{
          width: landscape ? '60%' : '100%', padding: `${44 * unit}px ${44 * unit}px ${48 * unit}px`, borderRadius: 48 * unit, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 * unit,
          backgroundColor: 'rgba(255,255,255,0.16)', border: `${2 * unit}px solid rgba(255,255,255,0.35)`, backdropFilter: `blur(${28 * unit}px) saturate(1.4)`,
          WebkitBackdropFilter: `blur(${28 * unit}px) saturate(1.4)`, boxShadow: `0 ${24 * unit}px ${60 * unit}px rgba(0,0,0,0.3)`,
          transform: `translateY(${(1 - panel) * 120 * unit}px)`, opacity: Math.min(1, panel * 2), color: '#ffffff',
        }}>
          {logoUrl && <LogoBadge logoUrl={logoUrl} height={130} />}
          <div style={{ fontSize: fitFontSize(name, 64, 22) * unit, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, letterSpacing: -1 * unit }}>{name}</div>
          {price && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 * unit }}>
              {oldPrice && <span style={{ fontSize: 40 * unit, fontWeight: 600, opacity: 0.7, textDecoration: 'line-through' }}>{oldPrice}</span>}
              <span style={{ fontSize: fitFontSize(price, 96, 9) * unit, fontWeight: 900, letterSpacing: -2 * unit }}>{price}</span>
            </div>
          )}
          <div style={{
            position: 'relative', overflow: 'hidden', width: '100%', textAlign: 'center', padding: `${28 * unit}px ${36 * unit}px`, borderRadius: 999,
            backgroundColor: accent, color: readableOn(accent), fontSize: 54 * unit, lineHeight: 1.1, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 * unit,
            transform: `scale(${button})`, boxShadow: `0 ${14 * unit}px ${36 * unit}px ${mix(accent, '#000000', 0.4)}88`,
          }}>
            {cta}
            {frame >= 24 && <div style={{
              position: 'absolute', top: 0, bottom: 0, width: '30%', left: `${-40 + shine * 180}%`, transform: 'skewX(-20deg)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
            }} />}
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};
