import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, Search, MapPin, Calendar, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Archive() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");

  const { data: cities = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/cities/archive'],
  });

  const regions = ["All", ...Array.from(new Set(cities.map((c: any) => c.region).filter(Boolean)))];

  const filtered = cities.filter((city: any) => {
    const matchesSearch = !search || 
      city.name.toLowerCase().includes(search.toLowerCase()) ||
      city.country.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = selectedRegion === "All" || city.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  const byYear: Record<string, any[]> = {};
  filtered.forEach((city: any) => {
    const year = new Date(city.publishDate).getUTCFullYear().toString();
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(city);
  });

  const sortedYears = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">City Archive</h1>
        <p className="text-muted-foreground">Every city we've featured — browse, discover, get inspired.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search cities or countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {regions.map((region) => (
            <Button
              key={region}
              size="sm"
              variant={selectedRegion === region ? "default" : "outline"}
              onClick={() => setSelectedRegion(region)}
            >
              {region}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No cities found matching your search.</p>
        </Card>
      ) : (
        <div className="space-y-10">
          {sortedYears.map((year) => (
            <div key={year}>
              <h2 className="text-lg font-semibold text-muted-foreground mb-4 border-b border-border pb-2">{year}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {byYear[year]
                  .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
                  .map((city: any) => (
                  <Card
                    key={city.id}
                    className="p-5 hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/city/${city.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{city.name}</h3>
                        <p className="text-sm text-muted-foreground">{city.country}</p>
                      </div>
                      {city.region && (
                        <Badge variant="secondary" className="text-xs shrink-0">{city.region}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(city.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {city.funFact && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{city.funFact}"</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
