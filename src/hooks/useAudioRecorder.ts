import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioRecorder {
  isRecording: boolean;
  level: number;       // 0..1 for visualizer
  speechLevel: number; // 0..1 relative to noise floor, for UI feedback
  hasSpeech: boolean;  // true once real voice is detected in current recording
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  error: string | null;
}

// --- VAD tunables -----------------------------------------------------------
const CALIBRATION_MS = 600;    // how long to sample ambient noise on start
const NOISE_HEADROOM  = 3.2;   // signal must be this many times the noise RMS to count as speech
const SPEECH_HOLD_MS  = 350;   // keep "hasSpeech" true for this long after signal drops below threshold
const RMS_SMOOTH      = 0.82;  // IIR coefficient for RMS envelope (higher = smoother)
const FFT_SIZE        = 1024;  // larger FFT = better frequency resolution for noise model
// ---------------------------------------------------------------------------

function calcRms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

export function useAudioRecorder(): AudioRecorder {
  const [isRecording, setIsRecording]   = useState(false);
  const [level, setLevel]               = useState(0);
  const [speechLevel, setSpeechLevel]   = useState(0);
  const [hasSpeech, setHasSpeech]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const rafRef           = useRef<number | null>(null);
  const mimeTypeRef      = useRef<string>('audio/webm');

  // VAD state (mutable refs so RAF closure always sees current values)
  const noiseFloorRef      = useRef<number>(0.004);  // RMS of ambient noise
  const smoothedRmsRef     = useRef<number>(0);
  const calibratingRef     = useRef<boolean>(false);
  const calibSamplesRef    = useRef<number[]>([]);
  const calibStartRef      = useRef<number>(0);
  const speechActiveRef    = useRef<boolean>(false);
  const speechHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpeechRef       = useRef<boolean>(false);

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const clearHoldTimer = () => {
    if (speechHoldTimerRef.current !== null) {
      clearTimeout(speechHoldTimerRef.current);
      speechHoldTimerRef.current = null;
    }
  };

  const start = useCallback(async () => {
    setError(null);
    chunksRef.current       = [];
    hasSpeechRef.current    = false;
    speechActiveRef.current = false;
    setHasSpeech(false);
    setSpeechLevel(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:  true,
          noiseSuppression:  true,
          autoGainControl:   true,
          channelCount:      1,
          sampleRate:        16000,  // Whisper works best at 16 kHz
        },
      });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      // --- Web Audio pipeline ---
      // mic -> DynamicsCompressor (tames loud peaks) -> Analyser
      //     -> MediaStreamDestination (for MediaRecorder)
      const source     = ctx.createMediaStreamSource(stream);
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;  // dB
      compressor.knee.value      = 10;
      compressor.ratio.value     = 6;
      compressor.attack.value    = 0.003;
      compressor.release.value   = 0.18;

      const analyser = ctx.createAnalyser();
      analyser.fftSize              = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;  // we do our own smoothing

      source.connect(compressor);
      compressor.connect(analyser);
      analyserRef.current = analyser;

      // Tap the post-compressor stream for MediaRecorder so the recorded
      // audio has the same dynamics as what we're measuring.
      const dest = ctx.createMediaStreamDestination();
      compressor.connect(dest);

      // Pick a supported mimeType
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/wav'];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = mimeType
        ? new MediaRecorder(dest.stream, { mimeType })
        : new MediaRecorder(dest.stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(100);

      // --- noise calibration ---
      smoothedRmsRef.current  = 0;
      noiseFloorRef.current   = 0.004;
      calibratingRef.current  = true;
      calibSamplesRef.current = [];
      calibStartRef.current   = performance.now();

      // --- RAF loop ---
      const floatBuf = new Float32Array(analyser.frequencyBinCount);
      const byteBuf  = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(byteBuf);
        analyser.getFloatTimeDomainData(floatBuf);

        const rms = calcRms(floatBuf);
        smoothedRmsRef.current = smoothedRmsRef.current * RMS_SMOOTH + rms * (1 - RMS_SMOOTH);
        const sRms = smoothedRmsRef.current;

        // --- calibration phase: collect ambient samples ---
        const now = performance.now();
        if (calibratingRef.current) {
          calibSamplesRef.current.push(rms);
          if (now - calibStartRef.current >= CALIBRATION_MS) {
            // derive noise floor from the 85th-percentile of calibration samples
            // (accounts for occasional clicks during setup)
            const sorted = [...calibSamplesRef.current].sort((a, b) => a - b);
            const p85    = sorted[Math.floor(sorted.length * 0.85)] ?? 0.004;
            noiseFloorRef.current  = Math.max(p85, 0.003);  // never below 0.003
            calibratingRef.current = false;
          }
        }

        // --- VAD ---
        const threshold  = noiseFloorRef.current * NOISE_HEADROOM;
        const isSpeaking = sRms > threshold;
        const relLevel   = Math.min(sRms / (noiseFloorRef.current * 8), 1);  // 0..1

        if (isSpeaking) {
          clearHoldTimer();
          if (!speechActiveRef.current) {
            speechActiveRef.current = true;
          }
          if (!hasSpeechRef.current) {
            hasSpeechRef.current = true;
            setHasSpeech(true);
          }
        } else if (speechActiveRef.current) {
          // hold for SPEECH_HOLD_MS before marking as inactive
          if (speechHoldTimerRef.current === null) {
            speechHoldTimerRef.current = setTimeout(() => {
              speechActiveRef.current    = false;
              speechHoldTimerRef.current = null;
            }, SPEECH_HOLD_MS);
          }
        }

        // --- visualizer levels ---
        // Raw peak from byte domain (0..1) for the waveform ring
        let peak = 0;
        for (let i = 0; i < byteBuf.length; i++) {
          const v = Math.abs(byteBuf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setLevel((prev) => prev * 0.6 + peak * 0.4);
        setSpeechLevel(speechActiveRef.current ? relLevel : relLevel * 0.3);

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      setIsRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied');
      setIsRecording(false);
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        // Only resolve a blob if real speech was detected during this recording.
        // This prevents noisy-silence recordings from hitting Whisper.
        const blob = hasSpeechRef.current
          ? new Blob(chunksRef.current, { type: mimeTypeRef.current })
          : null;
        cleanup();
        resolve(blob);
      };
      recorder.stop();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    stopRaf();
    clearHoldTimer();
    setLevel(0);
    setSpeechLevel(0);
    setHasSpeech(false);
    setIsRecording(false);
    speechActiveRef.current    = false;
    hasSpeechRef.current       = false;
    calibratingRef.current     = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current          = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current        = null;
    analyserRef.current        = null;
    mediaRecorderRef.current   = null;
  };

  useEffect(() => () => cleanup(), []);

  return { isRecording, level, speechLevel, hasSpeech, start, stop, error };
}
