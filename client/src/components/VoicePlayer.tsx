import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Square, Radio, Volume2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAIL = "wordofday2025@gmail.com";
const TUNE_IN_URL = "https://citydiscoverer.ai";

function getSecsUntil10amET(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value || "0");
  const nowSecs = get("hour") * 3600 + get("minute") * 60 + get("second");
  const targetSecs = 10 * 3600; // 10:00:00 ET
  return nowSecs <= targetSecs ? targetSecs - nowSecs : -1;
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VoicePlayerProps {
  cityId: string;
}

export function VoicePlayer({ cityId }: VoicePlayerProps) {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [audioState, setAudioState] = useState<
    "idle" | "loading" | "playing" | "paused"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [secsLeft, setSecsLeft] = useState(() => getSecsUntil10amET());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const autoPlayFiredRef = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => setSecsLeft(getSecsUntil10amET()), 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || audioState !== "idle" || autoPlayFiredRef.current) return;
    if (secsLeft === 0) {
      autoPlayFiredRef.current = true;
      handleListen();
    }
  }, [secsLeft, isAdmin, audioState]);

  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    };
  }, []);

  async function handleListen() {
    if (audioState === "playing") {
      audioRef.current?.pause();
      setAudioState("paused");
      return;
    }
    if (audioState === "paused" && audioRef.current) {
      audioRef.current.play();
      setAudioState("playing");
      return;
    }

    setAudioState("loading");
    try {
      const res = await fetch(`/api/tts/${cityId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioBlobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      let lastScrolledAt = -5;
      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const prog = (audio.currentTime / audio.duration) * 100;
        setProgress(prog);
        if (audio.currentTime - lastScrolledAt >= 3) {
          lastScrolledAt = audio.currentTime;
          autoScrollToProgress(prog);
        }
      });

      audio.addEventListener("ended", () => {
        setAudioState("idle");
        setProgress(0);
      });

      await audio.play();
      setAudioState("playing");
    } catch {
      setAudioState("idle");
    }
  }

  function handleStop() {
    audioRef.current?.pause();
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
    audioRef.current = null;
    setAudioState("idle");
    setProgress(0);
  }

  function autoScrollToProgress(prog: number) {
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    const targetY = docHeight * (prog / 100);
    window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
  }

  if (!isAdmin) {
    return (
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Hear This City Read Live
            </p>
            <p className="text-xs text-muted-foreground">
              Tune in every day at <strong>10am EST</strong> on{" "}
              <a
                href={TUNE_IN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                citydiscoverer.ai
              </a>
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Volume2 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">
          Voice Read
        </span>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {audioState === "idle" && secsLeft > 300 && (
            <span className="text-xs text-muted-foreground">
              Auto-plays at 10:00 AM ET
            </span>
          )}
          {audioState === "idle" && secsLeft > 0 && secsLeft <= 300 && (
            <span className="text-xs text-destructive animate-pulse">
              Auto-plays in {formatCountdown(secsLeft)}
            </span>
          )}

          <Button
            size="sm"
            variant={audioState === "playing" ? "outline" : "default"}
            onClick={handleListen}
            disabled={audioState === "loading"}
          >
            {audioState === "loading" ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : audioState === "playing" ? (
              <Pause className="w-3 h-3 mr-1" />
            ) : (
              <Play className="w-3 h-3 mr-1" />
            )}
            {audioState === "loading"
              ? "Generating…"
              : audioState === "playing"
                ? "Pause"
                : audioState === "paused"
                  ? "Resume"
                  : "Play"}
          </Button>

          {audioState !== "idle" && (
            <Button size="icon" variant="ghost" onClick={handleStop}>
              <Square className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {(audioState === "playing" || audioState === "paused") && (
        <div className="mt-3 w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </Card>
  );
}
