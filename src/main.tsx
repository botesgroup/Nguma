import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA functionality
const updateSW = registerSW({
    onNeedRefresh() {
        // Automatic update if possible, or show a prompt
        console.log('PWA: Nouvelle version détectée');
        if (confirm('Une nouvelle version de Nguma est disponible. Voulez-vous mettre à jour ?')) {
            updateSW(true);
        }
    },
    onOfflineReady() {
        console.log('✅ Nguma est prêt pour le mode hors-ligne');
    },
    onRegisterError(error) {
        console.error('PWA: Erreur lors de l\'enregistrement du Service Worker', error);
    }
});

createRoot(document.getElementById("root")!).render(<App />);
