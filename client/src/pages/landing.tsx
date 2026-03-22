import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { CityCards } from "@/components/city-cards";
import { Globe, Calendar, Smartphone, Heart, DollarSign, Users, Archive, Clock, CheckCircle, MapPin } from "lucide-react";
import { useLocation } from "wouter";

// Curated travel/cityscape Unsplash photos — rotate daily as a fallback
const TRAVEL_PHOTOS = [
  'photo-1499856374271-af18a2592df4', // city night lights
  'photo-1520250497591-112f2f40a3f4', // aerial city
  'photo-1476514525535-07fb3b4ae5f1', // mountain lake
  'photo-1506905925346-21bda4d32df4', // alpine landscape
  'photo-1530789253388-582c481c54b0', // tropical coast
  'photo-1467269204594-9661b134dd2b', // european city
  'photo-1533929736458-ca588d08c8be', // rome colosseum
  'photo-1547981609-4b6bfe67ca0b', // asian city
  'photo-1538970272646-f61fabb3bfba', // modern skyline
  'photo-1502602898657-3e91760cbb34', // paris eiffel
  'photo-1513635269975-59663e0ac1ad', // london eye
  'photo-1560347876-aeef00ee58a1', // tokyo streets
  'photo-1534430480872-3498386e7856', // mountain city
  'photo-1552832230-c0197dd311b5', // rome
  'photo-1523906834658-6e24ef2386f9', // venice
];

function getHeroImage(city: any): string {
  // Try morning content image first (AI-generated cities)
  const morningImage = city?.content?.find((c: any) => c.type === 'morning')?.imageUrl;
  if (morningImage && morningImage.startsWith('http')) {
    return morningImage;
  }
  // Fallback: use city name as a Picsum seed — deterministic, beautiful, changes per city
  if (city?.name) {
    const seed = encodeURIComponent(city.name.toLowerCase());
    return `https://picsum.photos/seed/${seed}/1920/800`;
  }
  // Ultimate fallback: rotate through curated travel photos by day of year
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  const photo = TRAVEL_PHOTOS[dayOfYear % TRAVEL_PHOTOS.length];
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1920&h=800&q=80`;
}

export default function Landing() {
  const [, setLocation] = useLocation();

  const { data: todaysCity, isLoading } = useQuery({
    queryKey: ['/api/cities/today'],
    retry: false,
  });

  const { data: recentCities = [] } = useQuery<any[]>({
    queryKey: ['/api/cities/recent'],
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Daily Felix" className="h-10 w-auto object-contain flex-shrink-0" />
              <div>
                <h1 className="text-base sm:text-xl font-bold text-foreground leading-tight">Daily Felix</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">City of the Day · International</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/archive')}
                data-testid="button-nav-archive"
                className="hidden sm:flex"
              >
                <Archive className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Archive</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.getElementById('recent-cities')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-nav-recent"
                className="hidden sm:flex"
              >
                <Clock className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Recent</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://cityoftheday.citydiscoverer.guide/', '_blank')}
                data-testid="button-usa-cities"
                className="hidden sm:flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                USA Cities
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://schedez.io/', '_blank')}
                data-testid="button-travel-expert"
                className="hidden sm:flex items-center gap-1.5"
              >
                Travel Expert Consultation
              </Button>
              <Button
                size="sm"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                Sign In / Register
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section — background changes daily with the featured city */}
      <div
        className="relative bg-cover bg-center transition-all duration-1000"
        style={{
          backgroundImage: `url('${getHeroImage(todaysCity)}')`,
          minHeight: "420px",
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-28 flex items-center min-h-[420px] md:min-h-[480px]">
          <div className="max-w-2xl text-white">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              One Iconic City.
              <span className="text-accent"> Every Single Day.</span>
            </h1>
            <p className="text-sm sm:text-xl md:text-2xl mb-6 sm:mb-8 text-gray-200 leading-relaxed">
              AI-curated guides to the world's most popular tourist destinations — landmarks, food, culture, and insider tips, delivered daily.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button 
                size="lg"
                onClick={() => window.location.href = '/api/login'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-base"
                data-testid="button-start-exploring"
              >
                <Globe className="mr-2" size={18} />
                Sign In / Get Started
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="bg-white/20 backdrop-blur-sm text-white border-white/40 text-base"
                onClick={() => window.location.href = 'https://citydiscoverer.ai/subscribe'}
                data-testid="button-try-premium"
              >
                <CheckCircle className="mr-2" size={18} />
                Try Premium
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Featured City */}
      <section className="py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-2">Today's Destination</p>
            <h2 className="text-3xl font-bold text-foreground">City of the Day</h2>
            <p className="text-muted-foreground mt-2">Explore today's featured international destination — free for everyone</p>
          </div>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading today's city...</p>
            </div>
          ) : todaysCity ? (
            <CityCards city={todaysCity} isUserSaved={false} onSaveToggle={() => {}} />
          ) : (
            <div className="text-center py-12">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No City Today</h3>
              <p className="text-muted-foreground">Check back tomorrow for a new discovery!</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Cities Section */}
      {recentCities.length > 1 && (
        <section id="recent-cities" className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-8 sm:mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Recent Cities</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Past destinations from the Daily Felix collection</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation('/archive')} data-testid="button-view-archive">
                <Archive className="w-4 h-4 mr-2" />
                Full Archive
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentCities.slice(0, 6).map((city: any) => (
                <Card
                  key={city.id}
                  className="p-5 hover-elevate cursor-pointer"
                  onClick={() => setLocation(`/city/${city.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-foreground">{city.name}</h3>
                      <p className="text-sm text-muted-foreground">{city.country}</p>
                    </div>
                    {city.flag && <span className="text-2xl">{city.flag}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(city.publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  {city.funFact && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{city.funFact}"</p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">Why Daily Felix International?</h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              One world-famous city, every day — curated by AI, focused on the destinations that matter most to international travelers
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            <Card className="p-5 sm:p-8 card-hover text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Globe className="text-white" size={28} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-4">AI-Powered International Curation</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Our AI selects the world's most iconic tourist destinations daily — from Paris to Tokyo, Rome to Rio.</p>
            </Card>

            <Card className="p-5 sm:p-8 card-hover text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Calendar className="text-white" size={28} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-4">A New City Every Day</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Wake up to a new international destination every morning — landmarks, local food, culture, and smart budget tips.</p>
            </Card>

            <Card className="p-5 sm:p-8 card-hover text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Smartphone className="text-white" size={28} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-4">PWA Ready</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Install on your phone or desktop. Works offline and syncs across all your devices.</p>
            </Card>

            <Card className="p-5 sm:p-8 card-hover text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Heart className="text-white" size={28} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-4">Your World Travel Journal</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Save your favourite international cities, revisit past destinations, and build a digital travel wishlist.</p>
            </Card>

            <Card className="p-5 sm:p-8 card-hover text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <DollarSign className="text-white" size={28} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-4">International Budget Tips</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Every city comes with insider tips on how to travel smarter — best time to visit, local hacks, and money-saving strategies.</p>
            </Card>

            <Card className="p-5 sm:p-8 card-hover text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Users className="text-white" size={28} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-4">Global Traveler Community</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Join thousands of international travel enthusiasts discovering and saving their favourite cities every day.</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
