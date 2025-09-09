import { useQuery } from "@tanstack/react-query";
import { CityCards } from "@/components/city-cards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, MapPin, Calendar, Heart, Trophy, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";

export default function Home() {
  const { user } = useAuth();
  const [savedCityIds, setSavedCityIds] = useState<Set<string>>(new Set());

  const { data: todaysCity, isLoading: todaysLoading } = useQuery({
    queryKey: ['/api/cities/today'],
    retry: false,
  });

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/user/stats'],
    retry: false,
  });

  const { data: savedCities } = useQuery({
    queryKey: ['/api/user/saved-cities'],
    retry: false,
  });

  const { data: travelPlans } = useQuery({
    queryKey: ['/api/travel-plans'],
    retry: false,
  });

  useEffect(() => {
    if (savedCities) {
      const cityIds = new Set(savedCities.map((saved: any) => saved.cityId));
      setSavedCityIds(cityIds);
    }
  }, [savedCities]);

  const handleSaveToggle = (cityId: string, isSaved: boolean) => {
    setSavedCityIds(prev => {
      const newSet = new Set(prev);
      if (isSaved) {
        newSet.add(cityId);
      } else {
        newSet.delete(cityId);
      }
      return newSet;
    });
  };

  if (todaysLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your daily discovery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back, {user?.firstName || 'Explorer'}!
        </h1>
        <p className="text-muted-foreground">Ready for your next adventure?</p>
      </div>

      {/* User Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
              <Calendar className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {statsLoading ? '...' : userStats?.daysExploring || 0}
              </p>
              <p className="text-sm text-muted-foreground">Days Exploring</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mr-4">
              <MapPin className="text-secondary" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {savedCities?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Cities Discovered</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mr-4">
              <Heart className="text-accent" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {savedCities?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Favorite Cities</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4">
              <Trophy className="text-purple-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {travelPlans?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Travel Plans</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Today's City */}
      {todaysCity ? (
        <div className="mb-8">
          <Card className="p-8">
            <CityCards 
              city={todaysCity} 
              onSaveToggle={handleSaveToggle}
              isUserSaved={savedCityIds.has(todaysCity.id)}
            />
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center mb-8">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No City Today</h3>
          <p className="text-muted-foreground">Check back tomorrow for a new discovery!</p>
        </Card>
      )}

      {/* My Collections */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Saves */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Recent Saves</h2>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              {savedCities?.length || 0} cities
            </span>
          </div>

          {savedCities && savedCities.length > 0 ? (
            <div className="space-y-4">
              {savedCities.slice(0, 3).map((saved: any) => (
                <div key={saved.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mr-4">
                      <span className="text-xl">{saved.city?.flag || '🌍'}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{saved.city?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Saved {new Date(saved.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" data-testid={`button-view-${saved.id}`}>
                    <Globe className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {savedCities.length > 3 && (
                <Button variant="ghost" className="w-full mt-4" data-testid="button-view-all-saves">
                  View All Saved Cities
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Saved Cities Yet</h3>
              <p className="text-muted-foreground mb-4">Start saving cities you want to visit!</p>
            </div>
          )}
        </Card>

        {/* Travel Plans */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Travel Plans</h2>
            <Button size="sm" className="bg-primary hover:bg-primary/90" data-testid="button-new-plan">
              <Calendar className="w-4 h-4 mr-2" />
              New Plan
            </Button>
          </div>

          {travelPlans && travelPlans.length > 0 ? (
            <div className="space-y-4">
              {travelPlans.slice(0, 3).map((plan: any) => (
                <div key={plan.id} className="p-4 bg-secondary/10 rounded-xl border border-secondary/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{plan.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      plan.status === 'active' ? 'bg-secondary text-white' :
                      plan.status === 'completed' ? 'bg-green-500 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Duration: {plan.duration || 'TBD'}</span>
                    <span>Budget: ${plan.budget || '0'}</span>
                  </div>
                </div>
              ))}
              
              {travelPlans.length > 3 && (
                <Button variant="ghost" className="w-full mt-4" data-testid="button-view-all-plans">
                  View All Travel Plans
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Travel Plans Yet</h3>
              <p className="text-muted-foreground mb-4">Start planning your next adventure!</p>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-create-first-plan">
                Create Your First Plan
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-4 p-4 bg-muted/30 rounded-xl">
            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
              <Heart className="text-white" size={20} />
            </div>
            <div>
              <p className="font-medium text-foreground">Saved {todaysCity?.name} to favorites</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
          </div>

          {savedCities && savedCities.length > 0 && (
            <div className="flex items-start space-x-4 p-4 bg-muted/30 rounded-xl">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="text-white" size={20} />
              </div>
              <div>
                <p className="font-medium text-foreground">Joined Daily Felix community</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(user?.createdAt || '').toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start space-x-4 p-4 bg-muted/30 rounded-xl">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
              <Globe className="text-white" size={20} />
            </div>
            <div>
              <p className="font-medium text-foreground">Started your journey of daily discovery</p>
              <p className="text-sm text-muted-foreground">Welcome aboard!</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
