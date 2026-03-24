import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { CityCards } from "@/components/city-cards";
import { VoicePlayer } from "@/components/VoicePlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowLeft, MapPin, Lightbulb } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function CityPage() {
  const [match, params] = useRoute("/city/:id");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const cityId = params?.id;

  const { data: city, isLoading } = useQuery<any>({
    queryKey: ['/api/cities', cityId],
    enabled: !!cityId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!city) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">City Not Found</h2>
        <p className="text-muted-foreground mb-6">This city doesn't exist or hasn't been published yet.</p>
        <Button onClick={() => setLocation('/archive')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Archive
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation('/archive')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Archive
      </Button>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-foreground">{city.name}</h1>
          {city.flag && <span className="text-3xl">{city.flag}</span>}
          {city.region && <Badge variant="secondary">{city.region}</Badge>}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{city.country}</span>
          <span>·</span>
          <span>{new Date(city.publishDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {city.funFact && (
        <Card className="p-4 mb-6 bg-accent/5 border-accent/20">
          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Fun Fact</p>
              <p className="text-sm text-muted-foreground">{city.funFact}</p>
            </div>
          </div>
        </Card>
      )}

      <VoicePlayer cityId={city.id} />

      <CityCards city={city} isUserSaved={false} onSaveToggle={() => {}} />
      <div data-tts-end />

      {!isAuthenticated && (
        <Card className="mt-8 p-6 text-center bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <h3 className="text-lg font-bold text-foreground mb-2">Want daily travel inspiration?</h3>
          <p className="text-muted-foreground mb-4">Sign up to save cities, access the full archive, and get a new city every day.</p>
          <Button onClick={() => window.location.href = 'https://schedez.io/'}>
            Get Started Free
          </Button>
        </Card>
      )}
    </div>
  );
}
