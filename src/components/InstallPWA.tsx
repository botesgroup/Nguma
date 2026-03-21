import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show the install button
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);

    if (outcome === 'accepted') {
      toast({
        title: "Installation en cours",
        description: "L'application Nguma est en train d'être installée sur votre appareil.",
      });
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    // Persist closure for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isVisible || sessionStorage.getItem('pwa-prompt-dismissed') === 'true') {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-8 md:bottom-8 md:w-96 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-card border-2 border-primary/20 p-4 rounded-2xl shadow-2xl backdrop-blur-xl bg-opacity-95 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex gap-3 items-center">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Installer Nguma</h3>
              <p className="text-sm text-muted-foreground">Accédez plus rapidement à vos investissements.</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleInstallClick} className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            Installer maintenant
          </Button>
          <Button variant="outline" onClick={handleClose} className="rounded-xl border-primary/20 hover:bg-primary/5">
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;
