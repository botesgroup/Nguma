import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Lock } from "lucide-react";

interface ChatMessageInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    aiOnlyMode?: boolean; // Mode IA uniquement (pas de saisie libre)
}

export function ChatMessageInput({ onSend, disabled, aiOnlyMode = false }: ChatMessageInputProps) {
    const [message, setMessage] = useState("");

    const handleSend = () => {
        if (!message.trim() || disabled || aiOnlyMode) return;

        onSend(message);
        setMessage("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Envoyer avec Enter (sans Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isInputDisabled = disabled || aiOnlyMode;

    return (
        <div className="border-t p-4">
            {aiOnlyMode && (
                <div className="mb-3 p-3 bg-muted rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>💡 Choisissez une suggestion ci-dessus ou demandez à parler à un conseiller</span>
                </div>
            )}

            <div className="flex gap-2">
                <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={aiOnlyMode ? "Zone de texte désactivée (utilisez les suggestions)" : "Tapez votre message..."}
                    className={`min-h-[60px] max-h-[120px] resize-none ${aiOnlyMode ? 'cursor-not-allowed opacity-60' : ''}`}
                    disabled={isInputDisabled}
                />
                <Button
                    onClick={handleSend}
                    disabled={isInputDisabled || !message.trim()}
                    size="icon"
                    className="h-[60px] w-[60px] flex-shrink-0"
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>

            {!aiOnlyMode && (
                <p className="text-xs text-muted-foreground mt-2">
                    Appuyez sur <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> pour envoyer
                </p>
            )}
        </div>
    );
}
