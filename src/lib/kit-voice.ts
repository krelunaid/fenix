import { useEffect, useRef, useState } from "react";

type KitHandle = {
  ctx: AudioContext;
  analyser: AnalyserNode;
};

function makeNoise(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

export function useTalkingKit(active: boolean) {
  const handle = useRef<KitHandle | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 14 }, () => 0.12));

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.055;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.55;
    master.connect(analyser);
    analyser.connect(ctx.destination);

    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 92;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.22;
    hum.connect(humGain).connect(master);
    hum.start();

    const noise = makeNoise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 820;
    bp.Q.value = 5;
    const talkGain = ctx.createGain();
    talkGain.gain.value = 0.08;
    noise.connect(bp).connect(talkGain).connect(master);
    noise.start();

    const beep = ctx.createOscillator();
    beep.type = "triangle";
    beep.frequency.value = 640;
    const beepGain = ctx.createGain();
    beepGain.gain.value = 0;
    beep.connect(beepGain).connect(master);
    beep.start();

    const talk = () => {
      const now = ctx.currentTime;
      const freq = 420 + Math.random() * 1600;
      bp.frequency.setValueAtTime(freq, now);
      talkGain.gain.cancelScheduledValues(now);
      talkGain.gain.setValueAtTime(0.04, now);
      talkGain.gain.linearRampToValueAtTime(0.55, now + 0.03);
      talkGain.gain.exponentialRampToValueAtTime(0.06, now + 0.11 + Math.random() * 0.16);
      if (Math.random() > 0.7) {
        beep.frequency.setValueAtTime(480 + Math.random() * 520, now);
        beepGain.gain.setValueAtTime(0.0001, now);
        beepGain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        beepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }
    };
    const interval = window.setInterval(talk, 130);
    talk();

    handle.current = { ctx, analyser };
    const bins = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(bins);
      const next = Array.from({ length: 14 }, (_, i) => {
        const v = bins[2 + i] ?? 0;
        return Math.max(0.08, Math.min(1, v / 180 + Math.random() * 0.08));
      });
      setLevels(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      try {
        noise.stop();
        hum.stop();
        beep.stop();
        void ctx.close();
      } catch {
        /* already closed */
      }
      handle.current = null;
    };
  }, [active]);

  return levels;
}
