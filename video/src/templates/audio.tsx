import React from 'react';
import { Html5Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import type { ProductAdAudio, ProductAdVoiceClip } from '../../../src/modules/video-generation/domain/entities/product-ad';

// Frame em que cada trecho do roteiro aparece na tela, informado por cada template.
export type AudioCues = { hook: number; benefits: number[]; cta: number };

type ScheduledClip = { src: string; from: number; frames: number };

const GAP = 4;
const END_MARGIN = 4;
const MUSIC_VOLUME = 0.32;
const DUCKED_VOLUME = 0.1;
const DUCK_RAMP = 6;

// Cada fala começa quando o texto dela aparece; se a anterior ainda estiver tocando, espera ela terminar. Quando a
// chamada não cabe antes do fim, os últimos benefícios deixam de ser falados (o texto continua na tela): a chamada
// é a fala que não pode faltar.
export function scheduleVoice (voiceover: NonNullable<ProductAdAudio['voiceover']>, cues: AudioCues, fps: number, total: number): ScheduledClip[] {
  const frames = (clip: ProductAdVoiceClip) => Math.ceil(clip.durationInSeconds * fps);
  const lastBenefitCue = cues.benefits[cues.benefits.length - 1] ?? cues.hook;

  for (let kept = voiceover.benefits.length; kept >= 0; kept--) {
    const queue = [
      { clip: voiceover.hook, cue: cues.hook },
      ...voiceover.benefits.slice(0, kept).map((clip, index) => ({ clip, cue: cues.benefits[index] ?? lastBenefitCue })),
      { clip: voiceover.cta, cue: cues.cta },
    ];
    let end = -GAP;
    const scheduled = queue.map(({ clip, cue }) => {
      const from = Math.max(cue, end + GAP);
      end = from + frames(clip);
      return { src: clip.src, from, frames: frames(clip) };
    });

    if (end <= total - END_MARGIN || kept === 0) return scheduled;
  }

  return [];
}

// Volume da música: entra e sai em fade e abaixa enquanto a locução fala.
function musicVolume (frame: number, total: number, voice: ScheduledClip[]) {
  const fade = interpolate(frame, [0, 12, total - 24, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const duck = Math.max(0, ...voice.map(({ from, frames }) => interpolate(frame, [from - DUCK_RAMP, from, from + frames, from + frames + DUCK_RAMP], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  return fade * (MUSIC_VOLUME - (MUSIC_VOLUME - DUCKED_VOLUME) * duck);
}

export const AdAudio: React.FC<{ audio?: ProductAdAudio; cues: AudioCues }> = ({ audio, cues }) => {
  const { fps, durationInFrames } = useVideoConfig();

  if (!audio) return null;

  const voice = audio.voiceover ? scheduleVoice(audio.voiceover, cues, fps, durationInFrames) : [];
  const track = audio.musicTrack && /^[a-z0-9-]+$/.test(audio.musicTrack) ? audio.musicTrack : undefined;

  return (
    <>
      {track && <Html5Audio src={staticFile(`music/${track}.mp3`)} loop volume={frame => musicVolume(frame, durationInFrames, voice)} />}
      {voice.map(clip => (
        <Sequence key={clip.from} from={clip.from} durationInFrames={Math.min(clip.frames, durationInFrames - clip.from)} name="Locução">
          <Html5Audio src={clip.src} />
        </Sequence>
      ))}
    </>
  );
};
