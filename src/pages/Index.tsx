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
    question: "Nguma est-il un site d’investissement ou un système de type Ponzi ?",
    answer: "Non. Nguma n’est ni un site d’investissement, ni un système Ponzi. Nguma est une plateforme qui gère vos contrats, lesquels sont ensuite exécutés par un robot de trading opérant sur MetaTrader 5. De plus, Nguma ne propose aucune option de parrainage et n’autorise aucun recrutement, car ce sont précisément les mécanismes typiques des systèmes de type Ponzi.",
  },
  {
    question: "Qu’est-ce qui garantit mon capital ?",
    answer: "Seuls les clients ayant souscrit à l’option Assurance Capital bénéficient d’une garantie : l’entreprise assure jusqu’à 5 mois de retraits, peu importe les circonstances. En revanche, ceux qui n’ont pas pris d’assurance ne disposent d’aucune garantie. Il est important de comprendre que l’investissement dans la spéculation boursière reste un investissement à haut risque, et vous pouvez perdre une partie ou la totalité de votre capital.",
  },
  {
    question: "Comment sont calculés et distribués les profits ?",
    answer: "Les profits sont calculés en fonction du montant de votre contrat. Vous recevez 20 % de votre capital comme profit chaque mois, pendant 10 mois.Veuillez noter que le capital investi n’est pas remboursable.",
  },
  {
    question: "Puis-je retirer mon argent à tout moment ?",
    answer: "Oui. Dès que vous recevez vos profits, vous pouvez les retirer à tout moment et par le moyen de votre choix. Cependant, le capital investi dans le contrat n’est ni retirable ni remboursable, même après l’expiration du contrat.",
  },
  {
    question: "Est-il possible d’avoir plusieurs contrats sur mon compte ?",
    answer: "Oui. Vous avez la possibilité de détenir plusieurs contrats sur votre compte, et chacun d’eux sera traité séparément et de manière individuelle.",
  },
  {
    question: "Y a-t-il des frais cachés ?",
    answer: "La transparence est au cœur de nos valeurs. Il n'y a aucun frais caché. Tous les frais ou commissions éventuels sont clairement indiqués avant que vous ne preniez une décision d'investissement.",
  },
  {
    question: "Qui contacter si le site devient indisponible ou subit une tentative de piratage ?",
    answer: "Nguma est une propriété de Botes Group S.A.R.L. Toutes les coordonnées officielles de l’entreprise sont disponibles dans les Conditions Générales. De plus, Nguma fonctionne de manière décentralisée : la plateforme sert uniquement à visualiser vos contrats et à faciliter vos demandes de dépôts et de retraits. L’exécution, la gestion et la sécurisation des opérations sont traitées en dehors de la plateforme, à travers différentes bases de données et systèmes de sauvegarde, garantissant ainsi une sécurité renforcée même en cas d’indisponibilité du site.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Don't redirect to dashboard if we are in a password recovery flow
      const hash = window.location.hash;
      const isRecoveryFlow = hash.includes('type=recovery') || hash.includes('access_token=');
      
      if (session && !isRecoveryFlow) {
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
              Profite de l’opportunité qu’offre le robot de trading Nguma.
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