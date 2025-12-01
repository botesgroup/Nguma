import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface SuggestionCategory {
    id: string;
    title: string;
    icon: string;
    suggestions: string[];
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
    {
        id: 'investment',
        title: 'Investissement',
        icon: '💰',
        suggestions: [
            'Comment investir sur Nguma ?',
            'Quel est le montant minimum ?',
            'Quels sont les types de contrats ?',
            'Comment fonctionne le rendement ?'
        ]
    },
    {
        id: 'withdrawals',
        title: 'Retraits & Profits',
        icon: '💸',
        suggestions: [
            'Quand reçois-je mes profits ?',
            'Comment retirer mes gains ?',
            'Quels sont les délais de retrait ?',
            'Y a-t-il des frais de retrait ?'
        ]
    },
    {
        id: 'account',
        title: 'Mon Compte',
        icon: '👤',
        suggestions: [
            'Comment vérifier mon compte ?',
            'La plateforme est-elle sécurisée ?',
            'Comment modifier mes informations ?',
            'Comment réinitialiser mon mot de passe ?'
        ]
    },
    {
        id: 'assistance',
        title: 'Assistance',
        icon: '❓',
        suggestions: [
            'Parler à un conseiller humain',
            'Voir les conditions générales',
            'Contacter le support'
        ]
    }
];

interface SuggestionCategoriesProps {
    onSuggestionClick: (suggestion: string) => void;
}

export function SuggestionCategories({ onSuggestionClick }: SuggestionCategoriesProps) {
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="w-full max-w-3xl mx-auto space-y-4">
                    {/* Header */}
                    <div className="text-center mb-4">
                        <h3 className="text-base md:text-lg font-semibold mb-2">👋 Bienvenue sur le support Nguma !</h3>
                        <p className="text-xs md:text-sm text-muted-foreground">
                            Choisissez une catégorie ci-dessous pour commencer
                        </p>
                    </div>

                    {/* Catégories */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        {SUGGESTION_CATEGORIES.map((category) => (
                            <Card key={category.id} className="hover:shadow-md transition-shadow h-fit">
                                <CardHeader className="pb-2 md:pb-3">
                                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                                        <span className="text-xl md:text-2xl">{category.icon}</span>
                                        {category.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1.5 md:space-y-2">
                                    {category.suggestions.map((suggestion, idx) => (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            className="w-full justify-start text-left h-auto py-2 px-3 text-xs md:text-sm hover:bg-accent whitespace-normal"
                                            onClick={() => onSuggestionClick(suggestion)}
                                        >
                                            {suggestion}
                                        </Button>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Footer hint */}
                    <div className="text-center mt-4 md:mt-6">
                        <p className="text-xs text-muted-foreground">
                            💡 Une fois qu'un conseiller vous répond, vous pourrez écrire librement
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
