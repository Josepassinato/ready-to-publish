import { useState, useRef, useCallback } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const AUTH_HEADERS = {
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export function useVoice() {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setLiveTranscript(data.text);
    },
    onCommittedTranscript: (data) => {
      setFinalTranscript((prev) => (prev ? prev + " " + data.text : data.text));
      setLiveTranscript("");
    },
  });

  const speak = useCallback(async (text: string) => {
    if (!text.trim() || isPlaying) return;

    const cleanText = text
      .replace(/#{1,6}\s?/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[|─┌┐└┘├┤┬┴┼]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    if (!cleanText) return;

    setIsPlaying(true);
    try {
      const response = await fetch(TTS_URL, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText.slice(0, 5000) }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro ao gerar áudio" }));
        throw new Error(err.error || `Erro ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e: any) {
      setIsPlaying(false);
      toast({ title: "Erro de áudio", description: e.message, variant: "destructive" });
    }
  }, [isPlaying, toast]);

  const stopPlaying = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startRealtimeRecording = useCallback(async () => {
    try {
      setFinalTranscript("");
      setLiveTranscript("");

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        throw new Error("Não foi possível obter token de transcrição");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (e: any) {
      toast({
        title: "Microfone",
        description: e.message || "Permita o acesso ao microfone para usar a voz.",
        variant: "destructive",
      });
    }
  }, [scribe, toast]);

  const stopRealtimeRecording = useCallback((): string => {
    scribe.disconnect();
    const result = (finalTranscript + (liveTranscript ? " " + liveTranscript : "")).trim();
    setFinalTranscript("");
    setLiveTranscript("");
    return result;
  }, [scribe, finalTranscript, liveTranscript]);

  return {
    isPlaying,
    isRecording: scribe.isConnected,
    liveTranscript,
    finalTranscript,
    currentTranscript: (finalTranscript + (liveTranscript ? " " + liveTranscript : "")).trim(),
    speak,
    stopPlaying,
    startRecording: startRealtimeRecording,
    stopRecording: stopRealtimeRecording,
  };
}
