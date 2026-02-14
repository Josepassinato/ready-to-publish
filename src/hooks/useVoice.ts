import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-stt`;
const AUTH_HEADERS = {
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export function useVoice() {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim() || isPlaying) return;

    // Strip markdown for cleaner speech
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

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e: any) {
      toast({
        title: "Microfone",
        description: "Permita o acesso ao microfone para usar a voz.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());

        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const response = await fetch(STT_URL, {
            method: "POST",
            headers: AUTH_HEADERS,
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: "Erro na transcrição" }));
            throw new Error(err.error || `Erro ${response.status}`);
          }

          const data = await response.json();
          setIsTranscribing(false);
          resolve(data.text || null);
        } catch (e: any) {
          setIsTranscribing(false);
          toast({ title: "Erro na transcrição", description: e.message, variant: "destructive" });
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, [toast]);

  return {
    isPlaying,
    isRecording,
    isTranscribing,
    speak,
    stopPlaying,
    startRecording,
    stopRecording,
  };
}
