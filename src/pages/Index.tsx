import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, Zap, BarChart3 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqData = [
  {
    question: "Comment la plateforme Nguma sécurise-t-elle mon investissement ?",
            answer: "Votre investissement est protégé par des protocoles de sécurité de pointe et des systèmes d'authentification robustes. De plus, toutes les transactions financières importantes, telles que les dépôts et les retraits, sont soumises à une vérification rigoureuse par nos équipes dédiées, assurant une protection maximale contre la fraude.",  },
  {
    question: "Comment sont calculés et distribués les profits ?",
    answer: "Les profits sont calculés chaque mois en fonction du taux de rendement global fixé par l'administrateur. Notre système automatisé distribue vos gains sur votre solde de profits à la date anniversaire de votre contrat, garantissant un paiement juste et ponctuel.",
  },
  {
    question: "Puis-je retirer mon argent à tout moment ?",
    answer: "Vous pouvez demander un retrait de votre solde de profits à tout moment. Les demandes sont traitées par nos administrateurs. Un remboursement anticipé de votre capital investi est également possible sous certaines conditions définies dans votre contrat.",
  },
  {
    question: "Y a-t-il des frais cachés ?",
    answer: "La transparence est au cœur de nos valeurs. Il n'y a aucun frais caché. Tous les frais ou commissions éventuels sont clairement indiqués avant que vous ne preniez une décision d'investissement.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <img src="/logo.png" alt="Nguma Logo" className="mx-auto h-32 w-32 mb-8" />
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Nguma
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Plateforme d'investissement automatisé avec profits mensuels garantis
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="text-lg px-8"
              >
                Commencer maintenant
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/how-it-works")}
                className="text-lg px-8"
              >
                En savoir plus
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Sécurisé</h3>
            <p className="text-muted-foreground">
              Vos fonds sont protégés avec les dernières technologies de sécurité
            </p>
          </div>

          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Automatisé</h3>
            <p className="text-muted-foreground">
              Calcul et distribution automatique des profits mensuels
            </p>
          </div>

          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Transparent</h3>
            <p className="text-muted-foreground">
              Suivez vos investissements et profits en temps réel
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Questions Fréquemment Posées</h2>
          <p className="text-lg text-muted-foreground mt-2">Trouvez les réponses à vos questions les plus courantes.</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqData.map((faq, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-card py-24">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Créez votre compte et commencez à investir dès aujourd'hui
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="text-lg px-8"
          >
            Créer mon compte
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
