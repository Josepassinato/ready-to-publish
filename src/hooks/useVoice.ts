import { useState, useCallback } from "react";
import { getToken } from "@/hooks/useAuth";

const TTS_URL = "/api/tts";

export function useVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    const token = getToken();
    if (!token || !text) return;

    try {
      setIsSpeaking(true);
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ text, voice_id: "sal" }),
      });

      if (!resp.ok) {
        setIsSpeaking(false);
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setAudioElement(audio);

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    setIsSpeaking(false);
  }, [audioElement]);

  return { speak, stop, isSpeaking };
}

export default useVoice;
