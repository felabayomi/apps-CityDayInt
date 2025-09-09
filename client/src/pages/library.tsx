import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, MapPin, Calendar, Search, Filter, Trophy, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CityCards } from "@/components/city-cards";

interface SavedCity {
  id: string;
  name: string;
  country: string;
  region?: string;
  flag?: string;
  publishDate: string;
  savedAt: string;
  tags?: string[];
  content?: any[];
}

export default function Library() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [savedCityIds, setSavedCityIds] = useState<Set<string>>(new Set());

  // Fetch user's saved cities
  const { data: savedCities = [], isLoading } = useQuery<SavedCity[]>({
    queryKey: ['/api/library'],
    enabled: !!user,
  });

  // Calculate user stats and badges
  const totalCities = savedCities.length;
  const countries = new Set(savedCities.map(city => city.country)).size;
  const regions = new Set(savedCities.map(city => city.region).filter(Boolean)).size;
  
  // Filter cities based on search and filters
  const filteredCities = savedCities.filter(city => {
    const matchesSearch = city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         city.country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === "all" || city.region === regionFilter;
    const matchesTag = tagFilter === "all" || city.tags?.includes(tagFilter);
    
    return matchesSearch && matchesRegion && matchesTag;
  });

  // Get unique regions and tags for filters
  const availableRegions = Array.from(new Set(savedCities.map(city => city.region).filter(Boolean)));
  const availableTags = Array.from(new Set(savedCities.flatMap(city => city.tags || [])));

  const handleSaveToggle = (cityId: string, isSaved: boolean) => {
    if (isSaved) {
      setSavedCityIds(prev => new Set(Array.from(prev).concat(cityId)));
    } else {
      setSavedCityIds(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(cityId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Your Travel Library</h1>
        <p className="text-muted-foreground">
          Your collection of discovered cities and travel inspiration
        </p>
      </div>

      {/* Stats and Badges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCities}</div>
          <div className="text-sm text-muted-foreground">Cities Explored</div>
        </Card>
        
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-6 h-6 text-secondary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{countries}</div>
          <div className="text-sm text-muted-foreground">Countries</div>
        </Card>
        
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bookmark className="w-6 h-6 text-accent" />
          </div>
          <div className="text-2xl font-bold text-foreground">{regions}</div>
          <div className="text-sm text-muted-foreground">Continents</div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-3">Achievement Badges</h3>
          <div className="space-y-2">
            {totalCities >= 10 && (
              <Badge className="w-full justify-start">
                <Trophy className="w-3 h-3 mr-1" />
                Explorer
              </Badge>
            )}
            {regions >= 3 && (
              <Badge variant="secondary" className="w-full justify-start">
                <MapPin className="w-3 h-3 mr-1" />
                Globe Trotter
              </Badge>
            )}
            {countries >= 5 && (
              <Badge variant="outline" className="w-full justify-start">
                <Heart className="w-3 h-3 mr-1" />
                World Wanderer
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="w-4 h-4" />
            Filters:
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cities or countries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-cities"
              />
            </div>
            
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {availableRegions.map(region => (
                  <SelectItem key={region} value={region || ""}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Cities Grid */}
      {filteredCities.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {savedCities.length === 0 ? "Your passport is blank" : "No cities match your filters"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {savedCities.length === 0 
              ? "Save today's city to start your collection." 
              : "Try adjusting your search or filter criteria."
            }
          </p>
          {savedCities.length === 0 && (
            <Button onClick={() => window.location.href = "/"}>
              Discover Today's City
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredCities.map((city) => (
            <div key={city.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Saved {new Date(city.savedAt).toLocaleDateString()}
                  </span>
                  {city.tags && city.tags.length > 0 && (
                    <div className="flex gap-1">
                      {city.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <CityCards 
                city={city} 
                onSaveToggle={handleSaveToggle}
                isUserSaved={true}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}