import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VoiceAssistantStatus = "idle" | "listening" | "processing" | "error";

interface RecognitionResultAlternative {
  transcript: string;
  confidence: number;
}

interface RecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: RecognitionResultAlternative;
}

interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}

type RecognitionEvent = Event & {
  readonly results: RecognitionResultList;
  readonly resultIndex: number;
};

type RecognitionErrorEvent = Event & {
  readonly error: string;
  readonly message?: string;
};

interface RecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  addEventListener(type: "result", listener: (event: RecognitionEvent) => void): void;
  addEventListener(type: "error", listener: (event: RecognitionErrorEvent) => void): void;
  addEventListener(type: "end", listener: () => void): void;
  removeEventListener(type: "result", listener: (event: RecognitionEvent) => void): void;
  removeEventListener(type: "error", listener: (event: RecognitionErrorEvent) => void): void;
  removeEventListener(type: "end", listener: () => void): void;
}

type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export interface UseVoiceAssistantOptions {
  enabled: boolean;
  language?: string;
  onCommand: (utterance: string) => Promise<string | null> | string | null;
  onError?: (error: string) => void;
}

export interface VoiceAssistantApi {
  supported: boolean;
  status: VoiceAssistantStatus;
  transcript: string;
  response: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  process: (utterance: string) => Promise<string | null>;
}

const getRecognitionConstructor = (): RecognitionConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { SpeechRecognition?: RecognitionConstructor }).SpeechRecognition ?? window.webkitSpeechRecognition;
};

export function useVoiceAssistant({ enabled, language = "fr-FR", onCommand, onError }: UseVoiceAssistantOptions): VoiceAssistantApi {
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const [status, setStatus] = useState<VoiceAssistantStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<string | null>(null);

  const supported = useMemo(() => Boolean(getRecognitionConstructor()), []);

  const reset = useCallback(() => {
    setTranscript("");
    setResponse(null);
    setStatus("idle");
  }, []);

  const process = useCallback(
    async (utterance: string) => {
      const cleaned = utterance.trim();
      if (!cleaned) {
        setTranscript("");
        setResponse("Je n'ai rien entendu.");
        setStatus("error");
        return "Je n'ai rien entendu.";
      }
      setStatus("processing");
      try {
        const reply = await onCommand(cleaned.toLowerCase());
        setTranscript(cleaned);
        setResponse(reply);
        setStatus("idle");
        return reply;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        setStatus("error");
        setTranscript(cleaned);
        setResponse(message);
        return message;
      }
    },
    [onCommand, onError]
  );

  useEffect(() => {
    if (!supported || !enabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (!enabled) {
        reset();
      }
    }
  }, [enabled, reset, supported]);

  useEffect(() => {
    if (!supported || !enabled) return;
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    const handleResult = async (event: RecognitionEvent) => {
      const result = event.results[0][0]?.transcript ?? "";
      await process(result);
    };

    const handleError = (event: RecognitionErrorEvent) => {
      const message = event.error === "not-allowed" ? "Autorise le micro pour utiliser l'assistant." : event.error;
      onError?.(message);
      setStatus("error");
      setResponse(message);
    };

    const handleEnd = () => {
      if (status === "listening") {
        recognition.start();
      }
    };

    recognition.addEventListener("result", handleResult);
    recognition.addEventListener("error", handleError);
    recognition.addEventListener("end", handleEnd);
    recognitionRef.current = recognition;

    return () => {
      recognition.removeEventListener("result", handleResult);
      recognition.removeEventListener("error", handleError);
      recognition.removeEventListener("end", handleEnd);
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled, language, onError, process, status, supported]);

  const start = useCallback(() => {
    if (!supported || !enabled) return;
    if (status === "listening") return;
    try {
      recognitionRef.current?.start();
      setStatus("listening");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
      setStatus("error");
      setResponse(message);
    }
  }, [enabled, onError, status, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    recognitionRef.current?.stop();
    setStatus("idle");
  }, [supported]);

  return {
    supported,
    status,
    transcript,
    response,
    start,
    stop,
    reset,
    process,
  };
}
