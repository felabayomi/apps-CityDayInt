import { useState, useEffect } from "react";
import { Bell, BellOff, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "df_notif_dismissed";

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  return isIos && isSafari;
}

function isInstalledPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as any).standalone === true)
  );
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

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleSubscribe = async () => {
    // iOS Safari browser (not PWA) — can't use push, guide them to install
    if (isIosSafari() && !isInstalledPwa()) {
      toast({
        title: "Add to Home Screen",
        description: 'Tap the Share button in Safari, then "Add to Home Screen" to enable daily city notifications.',
        duration: 6000,
      });
      return;
    }

    if (!isSupported) {
      toast({
        title: "Notifications not supported",
        description: "Your browser doesn't support push notifications. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notifications enabled", description: "You'll be notified when a new city goes live each day." });
      handleDismiss();
    } else if (permission === "denied") {
      toast({ title: "Notifications blocked", description: "Enable them in your browser settings.", variant: "destructive" });
    }
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
    toast({ title: "Notifications turned off", description: "You won't receive daily city alerts anymore." });
  };

  // Already subscribed — show active bell
  if (isSubscribed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUnsubscribe}
        disabled={isLoading}
        title="Turn off notifications"
        className="text-primary"
      >
        <Bell className="w-4 h-4" />
      </Button>
    );
  }

  // iOS Safari non-PWA — show install prompt icon
  if (isIosSafari() && !isInstalledPwa() && !dismissed) {
    return (
      <>
        {/* Mobile: icon only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSubscribe}
          title="Get notified — add to Home Screen"
          className="sm:hidden text-muted-foreground"
        >
          <Download className="w-4 h-4" />
        </Button>

        {/* Desktop/tablet: full prompt */}
        <div className="hidden sm:flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-1.5">
          <Download className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Add to Home Screen for daily alerts</span>
          <Button size="sm" variant="default" onClick={handleSubscribe} className="h-7 text-xs">
            How?
          </Button>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        </div>
      </>
    );
  }

  // Dismissed or denied — show muted bell icon only
  if (dismissed || permission === "denied") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSubscribe}
        disabled={isLoading}
        title="Enable daily city notifications"
        className="text-muted-foreground"
      >
        <BellOff className="w-4 h-4" />
      </Button>
    );
  }

  // Supported browser, not yet subscribed — bell icon on mobile, full prompt on desktop
  if (!isSupported) return null;

  return (
    <>
      {/* Mobile: just a bell icon */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSubscribe}
        disabled={isLoading}
        title="Get notified when today's city goes live"
        className="sm:hidden text-muted-foreground"
      >
        <Bell className="w-4 h-4" />
      </Button>

      {/* Desktop: full prompt banner */}
      <div className="hidden sm:flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-1.5">
        <Bell className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-xs text-foreground">Get notified when each day's city goes live</span>
        <Button
          size="sm"
          variant="default"
          onClick={handleSubscribe}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          {isLoading ? "..." : "Enable"}
        </Button>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}
