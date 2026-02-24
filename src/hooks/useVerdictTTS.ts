import { useState, useRef, useCallback, useEffect } from "react";

const MAX_CHARS = 5000;

export type TTSStatus = "idle" | "loading" | "playing" | "paused" | "error";

function getPtBrVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "pt-BR" && v.name.toLowerCase().includes("google")) ||
    voices.find((v) => v.lang === "pt-BR") ||
    voices.find((v) => v.lang.startsWith("pt")) ||
    null
  );
}

export function useVerdictTTS() {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startTimeRef = useRef(0);
  const estimatedDurationRef = useRef(0);
  const rafRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    window.speechSynthesis.cancel();
    utterRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const trackProgress = useCallback(() => {
    if (estimatedDurationRef.current <= 0) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const pct = Math.min((elapsed / estimatedDurationRef.current) * 100, 99);
    setProgress(pct);
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      rafRef.current = requestAnimationFrame(trackProgress);
    }
  }, []);

  const generate = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      setStatus("error");
      setErrorMsg("Seu navegador nao suporta sintese de voz.");
      return;
    }

    const trimmed = text.slice(0, MAX_CHARS).trim();
    if (!trimmed) return;

    cleanup();
    setStatus("loading");
    setErrorMsg("");
    setProgress(0);

    const utter = new SpeechSynthesisUtterance(trimmed);
    utterRef.current = utter;

    const voice = getPtBrVoice();
    if (voice) utter.voice = voice;
    utter.lang = "pt-BR";
    utter.rate = 1.0;
    utter.pitch = 1.0;

    // Estimate duration: ~140 words/min for pt-BR speech
    const wordCount = trimmed.split(/\s+/).length;
    const estSeconds = (wordCount / 140) * 60;
    estimatedDurationRef.current = estSeconds;
    setDuration(estSeconds);

    utter.onstart = () => {
      startTimeRef.current = Date.now();
      setStatus("playing");
      rafRef.current = requestAnimationFrame(trackProgress);
    };

    utter.onend = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStatus("idle");
      setProgress(100);
      // Update duration with actual elapsed time
      const actual = (Date.now() - startTimeRef.current) / 1000;
      setDuration(actual);
    };

    utter.onerror = (e) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (e.error === "canceled") return;
      setStatus("error");
      setErrorMsg("Erro na sintese de voz. Tente novamente.");
    };

    utter.onpause = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStatus("paused");
    };

    utter.onresume = () => {
      setStatus("playing");
      rafRef.current = requestAnimationFrame(trackProgress);
    };

    // Some browsers need a small delay for voices to load
    const trySpeak = () => {
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const v = getPtBrVoice();
        if (v) utter.voice = v;
        trySpeak();
      };
    } else {
      trySpeak();
    }
  }, [cleanup, trackProgress]);

  const togglePlayPause = useCallback(() => {
    if (!window.speechSynthesis) return;

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }, []);

  const seek = useCallback((_pct: number) => {
    // Web Speech API does not support seeking
  }, []);

  return {
    status,
    progress,
    duration,
    errorMsg,
    blobUrl: null as string | null,
    generate,
    togglePlayPause,
    seek,
    cleanup,
  };
}
