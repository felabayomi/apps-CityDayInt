import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "df_notif_dismissed_v2";

function isIosSafariNonPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  const isPwa =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as any).standalone === true);
  return isIos && isSafari && !isPwa;
}

export function NotificationBanner() {
  const { permission, isSubscribed, isSupported, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  if (!mounted) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleBellClick = async () => {
    // iOS Safari browser — can't push, guide to install PWA
    if (isIosSafariNonPwa()) {
      toast({
        title: "Enable Notifications on iPhone",
        description: 'In Safari, tap the Share button then "Add to Home Screen". Open the app from your home screen to enable notifications.',
        duration: 8000,
      });
      return;
    }

    if (!isSupported) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support push notifications. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    if (isSubscribed) {
      await unsubscribe();
      toast({ title: "Notifications turned off" });
      return;
    }

    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notifications enabled!", description: "You'll get a daily alert when each city goes live." });
      setDismissed(true);
    } else if (permission === "denied") {
      toast({ title: "Notifications blocked", description: "Enable them in your browser settings.", variant: "destructive" });
    }
  };

  // ── Mobile: always show a bell icon (never hidden) ──────────────────────
  // ── Desktop: show full banner if not dismissed ──────────────────────────

  const bellActive = isSubscribed;
  const bellTitle = isSubscribed
    ? "Notifications on — tap to turn off"
    : isIosSafariNonPwa()
    ? "Tap to learn how to enable notifications on iPhone"
    : "Get notified when each day's city goes live";

  return (
    <>
      {/* Always visible bell icon on mobile */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBellClick}
        disabled={isLoading}
        title={bellTitle}
        className={`md:hidden ${bellActive ? "text-primary" : "text-muted-foreground"}`}
      >
        <Bell className="w-4 h-4" />
      </Button>

      {/* Desktop full banner — hidden if dismissed or already subscribed */}
      {!dismissed && !isSubscribed && (isSupported || isIosSafariNonPwa()) && (
        <div className="hidden md:flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-1.5">
          <Bell className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">
            {isIosSafariNonPwa()
              ? "Add to Home Screen to get daily alerts"
              : "Get notified when each day's city goes live"}
          </span>
          <Button
            size="sm"
            variant="default"
            onClick={handleBellClick}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            {isLoading ? "..." : isIosSafariNonPwa() ? "How?" : "Enable"}
          </Button>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Desktop: subscribed state */}
      {isSubscribed && (
        <button
          onClick={handleBellClick}
          title="Notifications on — click to turn off"
          className="hidden md:flex items-center gap-1.5 text-sm text-primary font-medium"
        >
          <Bell className="w-4 h-4" />
          <span>Alerts On</span>
        </button>
      )}
    </>
  );
}
