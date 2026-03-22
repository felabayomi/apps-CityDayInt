import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "df_notif_dismissed";

export function NotificationBanner() {
  const { permission, isSubscribed, isSupported, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleSubscribe = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notifications enabled", description: "You'll be notified when a new city is live each day." });
      handleDismiss();
    } else if (permission === "denied") {
      toast({ title: "Notifications blocked", description: "Enable them in your browser settings.", variant: "destructive" });
    }
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
    toast({ title: "Notifications turned off", description: "You won't receive daily city alerts anymore." });
  };

  if (!mounted || !isSupported) return null;

  // Already subscribed — show active bell icon
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

  // Denied or dismissed — show muted bell icon only (no banner)
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

  // Default — show compact bell icon on mobile, full prompt on desktop
  return (
    <>
      {/* Mobile: just a bell icon button */}
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
        <span className="text-xs text-foreground">
          Get notified when each day's city goes live
        </span>
        <Button
          size="sm"
          variant="default"
          onClick={handleSubscribe}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          {isLoading ? "..." : "Enable"}
        </Button>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}
