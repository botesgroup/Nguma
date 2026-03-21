import { useState, KeyboardEvent, useRef, ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Lock, Paperclip, X } from "lucide-react";
import { formatFileSize } from "@/services/fileUploadService";

interface ChatMessageInputProps {
    onSend: (message: string, files?: File[]) => void;
    disabled?: boolean;
    aiOnlyMode?: boolean;
}

export function ChatMessageInput({ onSend, disabled, aiOnlyMode = false }: ChatMessageInputProps) {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if ((!message.trim() && selectedFiles.length === 0) || disabled || aiOnlyMode) return;

        onSend(message, selectedFiles);
        setMessage("");
        setSelectedFiles([]);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setSelectedFiles(prev => [...prev, ...files]);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        setSelectedFiles(prev => [...prev, ...files]);
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

            {/* Preview des fichiers sélectionnés */}
            {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm"
                        >
                            <Paperclip className="h-4 w-4" />
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                                ({formatFileSize(file.size)})
                            </span>
                            <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="ml-1 p-1 hover:bg-destructive/10 rounded"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div
                className={`relative flex items-end gap-1.5 p-1.5 bg-muted/40 dark:bg-muted/10 border border-border/50 rounded-[1.75rem] focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all duration-200 ${isDragging ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Bouton d'attach fichier */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isInputDisabled}
                    className="h-10 w-10 flex-shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 mb-0.5 ml-0.5 transition-colors"
                >
                    <Paperclip className="h-[18px] w-[18px]" />
                </Button>

                <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        isDragging
                            ? "📎 Déposez vos fichiers ici..."
                            : aiOnlyMode
                                ? "Zone de texte désactivée (utilisez les suggestions)"
                                : "Votre message..."
                    }
                    className={`min-h-[44px] max-h-[120px] py-3 px-1 bg-transparent border-0 focus-visible:ring-0 resize-none shadow-none text-[15px] leading-relaxed ${aiOnlyMode ? 'cursor-not-allowed opacity-60' : ''}`}
                    disabled={isInputDisabled}
                />

                {/* Bouton d'envoi */}
                <Button
                    onClick={handleSend}
                    disabled={isInputDisabled || (!message.trim() && selectedFiles.length === 0)}
                    size="icon"
                    className={`h-10 w-10 flex-shrink-0 rounded-full transition-all duration-300 mb-0.5 mr-0.5 ${
                        isInputDisabled || (!message.trim() && selectedFiles.length === 0)
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                    }`}
                >
                    <Send className="h-[18px] w-[18px] ml-0.5" />
                </Button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleFileChange}
            />

            {!aiOnlyMode && (
                <p className="text-xs text-muted-foreground mt-2">
                    Appuyez sur <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> pour envoyer
                    • <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd> pour nouvelle ligne
                </p>
            )}
        </div>
    );
}
