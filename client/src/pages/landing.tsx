import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { CityCards } from "@/components/city-cards";
import { Globe, Calendar, Smartphone, Heart, DollarSign, Users, CheckCircle, Archive, Clock } from "lucide-react";
import { useLocation } from "wouter";

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
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
                <Globe className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Daily Felix</h1>
                <p className="text-xs text-muted-foreground">City of the Day · International</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setLocation('/archive')}
                data-testid="button-nav-archive"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  document.getElementById('recent-cities')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-nav-recent"
              >
                <Clock className="w-4 h-4 mr-2" />
                Recent
              </Button>
              <Button
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div 
        className="relative h-96 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=800')"
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <p className="text-sm font-semibold tracking-widest uppercase text-accent mb-4">City of the Day · International</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              One Iconic City.
              <span className="text-accent"> Every Single Day.</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-200">
              AI-curated guides to the world's most popular tourist destinations — landmarks, food, culture, and insider tips, delivered daily.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg"
                onClick={() => window.location.href = '/api/login'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
                data-testid="button-start-exploring"
              >
                <Globe className="mr-2" size={20} />
                Start Exploring Today
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30 px-8 py-4 text-lg"
                data-testid="button-try-premium"
              >
                <CheckCircle className="mr-2" size={20} />
                Try Premium Free
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
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-1">Recent Cities</h2>
                <p className="text-muted-foreground">Past destinations from the Daily Felix collection</p>
              </div>
              <Button variant="outline" onClick={() => setLocation('/archive')} data-testid="button-view-archive">
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
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Why Daily Felix International?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              One world-famous city, every day — curated by AI, focused on the destinations that matter most to international travelers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">AI-Powered International Curation</h3>
              <p className="text-muted-foreground">Our AI selects the world's most iconic tourist destinations daily — from Paris to Tokyo, Rome to Rio.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calendar className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">A New City Every Day</h3>
              <p className="text-muted-foreground">Wake up to a new international destination every morning — landmarks, local food, culture, and smart budget tips.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Smartphone className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">PWA Ready</h3>
              <p className="text-muted-foreground">Install on your phone or desktop. Works offline and syncs across all your devices.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Heart className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">Your World Travel Journal</h3>
              <p className="text-muted-foreground">Save your favourite international cities, revisit past destinations, and build a digital travel wishlist.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <DollarSign className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">International Budget Tips</h3>
              <p className="text-muted-foreground">Every city comes with insider tips on how to travel smarter — best time to visit, local hacks, and money-saving strategies.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">Global Traveler Community</h3>
              <p className="text-muted-foreground">Join thousands of international travel enthusiasts discovering and saving their favourite cities every day.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Choose Your Journey</h2>
            <p className="text-xl text-muted-foreground">Start free, upgrade when you're ready to explore more</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="p-8 border border-border">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">Explorer</h3>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-4xl font-bold text-foreground">$0</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>
                <p className="text-muted-foreground">Perfect for casual travelers</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Daily city discovery</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Basic travel tips</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Cultural insights</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Mobile app access</span>
                </li>
              </ul>
              
              <Button 
                className="w-full bg-muted hover:bg-muted/80 text-foreground"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-free-plan"
              >
                Start Free
              </Button>
            </Card>

            {/* Premium Plan */}
            <Card className="p-8 border-2 border-primary/20 relative bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-semibold">Most Popular</span>
              </div>
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">Wanderer</h3>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-4xl font-bold text-foreground">$7</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>
                <p className="text-muted-foreground">For serious travel enthusiasts</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Everything in Explorer</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Access to past cities</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Detailed itineraries</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Exclusive deals & discounts</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Offline city guides</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="text-secondary mr-3" size={20} />
                  <span>Priority customer support</span>
                </li>
              </ul>
              
              <Button 
                className="w-full gradient-bg text-white hover:opacity-90"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-premium-plan"
              >
                Start 7-Day Free Trial
              </Button>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
