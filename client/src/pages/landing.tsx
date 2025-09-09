import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { CityCards } from "@/components/city-cards";
import { Globe, Calendar, Smartphone, Heart, DollarSign, Users, CheckCircle } from "lucide-react";

export default function Landing() {
  const { data: todaysCity, isLoading } = useQuery({
    queryKey: ['/api/cities/today'],
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
                <p className="text-xs text-muted-foreground">City of the Day</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => window.location.href = '/api/login'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Explore the World
              <span className="text-accent"> One City at a Time</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-200">
              Discover daily curated travel inspiration, cultural insights, and hidden gems from cities around the globe.
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
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading today's city...</p>
            </div>
          ) : todaysCity ? (
            <CityCards city={todaysCity} />
          ) : (
            <div className="text-center py-12">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No City Today</h3>
              <p className="text-muted-foreground">Check back tomorrow for a new discovery!</p>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Why Choose Daily Felix?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your complete travel companion for discovering the world's most amazing cities
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">AI-Powered Curation</h3>
              <p className="text-muted-foreground">Smart algorithms select the perfect mix of culture, food, and local insights for each destination.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calendar className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">Daily Inspiration</h3>
              <p className="text-muted-foreground">Wake up to a new city every day with bite-sized content that sparks your wanderlust.</p>
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
              <h3 className="text-xl font-bold text-foreground mb-4">Personal Collection</h3>
              <p className="text-muted-foreground">Build your digital travel journal with cities you've explored and places you want to visit.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <DollarSign className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">Budget Smart</h3>
              <p className="text-muted-foreground">Get insider tips, local deals, and money-saving strategies for every destination.</p>
            </Card>

            <Card className="p-8 card-hover text-center">
              <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4">Community Driven</h3>
              <p className="text-muted-foreground">Join thousands of travelers sharing experiences and discovering hidden gems together.</p>
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
