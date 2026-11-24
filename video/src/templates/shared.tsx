import React from 'react';
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/fonts';

export const FONT_FAMILY = 'Inter';

// Fonte local (video/public/fonts): o render não depende de rede para tipografia.
loadFont({ family: FONT_FAMILY, url: staticFile('fonts/Inter.ttf'), weight: '100 900' });

// `unit` escala medidas pensadas para 1080 px no menor lado do vídeo, para o mesmo layout servir aos três formatos.
export function useLayout () {
  const { width, height } = useVideoConfig();
  return { unit: Math.min(width, height) / 1080, landscape: width > height, portrait: height > width };
}

export function useEnter (delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
}

export const ProductImage: React.FC<{ imageUrl: string; zoom: number; dim?: number; blur?: number }> = ({ imageUrl, zoom, dim = 0, blur = 0 }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, filter: blur ? `blur(${blur}px)` : undefined }} />
    {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />}
  </AbsoluteFill>
);

export function isHex (value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function safeColor (value: string) {
  return isHex(value) ? value : '#2563eb';
}

// Cor de apoio opcional, validada.
export function optionalColor (value?: string) {
  return value && isHex(value) ? value : undefined;
}

// Texto escuro ou claro, conforme a luminância do fundo.
export function readableOn (hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}
