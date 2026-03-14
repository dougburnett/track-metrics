"use client";

import { useState, useEffect, useRef } from "react";
import { Share, X, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Don't show if already installed or dismissed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as Record<string, unknown>).standalone === true;
    if (isStandalone) return;

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

    if (isiOS && isSafari) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Chrome/Android: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
      deferredPrompt.current = null;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center shrink-0">
            <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline text-sm font-semibold text-[var(--foreground)]">
              Add to Home Screen
            </h3>
            {isIOS ? (
              <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-1">
                Tap <Share size={12} className="inline -mt-0.5" /> then{" "}
                <span className="font-semibold">&quot;Add to Home Screen&quot;</span>{" "}
                <Plus size={12} className="inline -mt-0.5" /> for the best experience.
              </p>
            ) : (
              <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-1">
                Install this app for quick access and a fullscreen experience.
              </p>
            )}
          </div>
          <button onClick={handleDismiss} className="shrink-0 cursor-pointer p-1">
            <X size={16} className="text-[var(--muted-foreground)]" />
          </button>
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] font-secondary text-sm font-semibold rounded-lg cursor-pointer"
          >
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
