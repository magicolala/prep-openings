export type VoiceStatus = "idle" | "listening" | "processing" | "error";

interface VoiceInterfaceProps {
  status: VoiceStatus;
  transcript: string;
  assistantMessage: string | null;
  suggestions: string[];
  onSuggestion: (command: string) => void;
  error?: string | null;
}

export function VoiceInterface({ status, transcript, assistantMessage, suggestions, onSuggestion, error }: VoiceInterfaceProps) {
  const isListening = status === "listening";
  const isProcessing = status === "processing";

  return (
    <div className={`voice-interface voice-interface--${status}`} role="log" aria-live="polite">
      <div className="voice-interface__wave" aria-hidden>
        <span className={isListening ? "is-active" : ""} />
        <span className={isListening ? "is-active" : ""} style={{ animationDelay: "0.08s" }} />
        <span className={isListening ? "is-active" : ""} style={{ animationDelay: "0.16s" }} />
      </div>

      <div className="voice-interface__body">
        <p className="voice-interface__status">
          {status === "idle" && "Assistant pret. Lance-toi."}
          {status === "listening" && "Je t'ecoute..."}
          {status === "processing" && "Je reflechis a la meilleure action."}
          {status === "error" && (error ?? "Je n'ai pas compris, retente.")}
        </p>

        {transcript && (
          <div className="voice-interface__transcript" aria-label="Derniere commande vocale">
            <span className="voice-interface__pill">Tu</span>
            <p>{transcript}</p>
          </div>
        )}

        {assistantMessage && (
          <div className="voice-interface__response" aria-label="Reponse de l'assistant">
            <span className="voice-interface__pill voice-interface__pill--ai">IA</span>
            <p>{assistantMessage}</p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="voice-interface__suggestions" aria-label="Commandes possibles">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="voice-interface__suggestion"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {isProcessing && <div className="voice-interface__loader" aria-hidden />}
    </div>
  );
}
