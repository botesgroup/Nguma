import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Link as LinkIcon,
    Heading1,
    Heading2,
    Eye,
    Edit3,
    Save
} from 'lucide-react';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    isSaving: boolean;
    hasChanged: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    onSave,
    isSaving,
    hasChanged,
}) => {
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

    const insertMarkdown = (before: string, after: string = '') => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

        onChange(newText);

        // Restore cursor position
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
                start + before.length,
                start + before.length + selectedText.length
            );
        }, 0);
    };

    const toolbarButtons = [
        {
            icon: Heading1,
            label: 'Titre 1',
            action: () => insertMarkdown('# ', ''),
        },
        {
            icon: Heading2,
            label: 'Titre 2',
            action: () => insertMarkdown('## ', ''),
        },
        {
            icon: Bold,
            label: 'Gras',
            action: () => insertMarkdown('**', '**'),
        },
        {
            icon: Italic,
            label: 'Italique',
            action: () => insertMarkdown('*', '*'),
        },
        {
            icon: List,
            label: 'Liste à puces',
            action: () => insertMarkdown('- ', ''),
        },
        {
            icon: ListOrdered,
            label: 'Liste numérotée',
            action: () => insertMarkdown('1. ', ''),
        },
        {
            icon: LinkIcon,
            label: 'Lien',
            action: () => insertMarkdown('[', '](https://)'),
        },
    ];

    const renderMarkdown = (markdown: string) => {
        // Simple markdown renderer (can be enhanced with react-markdown if needed)
        return markdown
            .split('\n')
            .map((line, i) => {
                // Headings
                if (line.startsWith('### ')) {
                    return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>;
                }
                if (line.startsWith('# ')) {
                    return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
                }

                // Lists
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <li key={i} className="ml-6 list-disc">{line.slice(2)}</li>;
                }
                if (/^\d+\.\s/.test(line)) {
                    return <li key={i} className="ml-6 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
                }

                // Paragraphs
                if (line.trim() === '') {
                    return <br key={i} />;
                }

                // Bold and italic
                let processedLine = line;
                processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
                processedLine = processedLine.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 underline">$1</a>');

                return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: processedLine }} />;
            });
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30 flex-wrap">
                {toolbarButtons.map((button, index) => {
                    const Icon = button.icon;
                    return (
                        <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            onClick={button.action}
                            title={button.label}
                            className="h-8 w-8 p-0"
                        >
                            <Icon className="h-4 w-4" />
                        </Button>
                    );
                })}

                <div className="flex-1" />

                <Button
                    onClick={onSave}
                    disabled={!hasChanged || isSaving}
                    size="sm"
                    variant={hasChanged ? 'default' : 'outline'}
                    className="ml-auto"
                >
                    {isSaving ? (
                        <>Enregistrement...</>
                    ) : hasChanged ? (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Sauvegarder
                        </>
                    ) : (
                        <>✓ Sauvegardé</>
                    )}
                </Button>
            </div>

            {/* Editor and Preview */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="edit" className="flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Édition
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Prévisualisation
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="mt-4">
                    <Textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="min-h-[500px] font-mono text-sm"
                        placeholder="Écrivez vos conditions d'utilisation en Markdown..."
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        💡 Astuce : Utilisez Markdown pour formater le texte.
                        <span className="ml-2">**gras** *italique* # Titre</span>
                    </p>
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                    <Card className="p-6 min-h-[500px] prose prose-sm max-w-none">
                        {renderMarkdown(value)}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
