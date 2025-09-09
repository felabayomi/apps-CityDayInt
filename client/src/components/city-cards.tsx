import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Share2, Eye, MapPin, Calendar } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CityContent {
  id: string;
  type: 'morning' | 'afternoon' | 'evening';
  title: string;
  description: string;
  imageUrl?: string;
  affiliateLink?: string;
}

interface City {
  id: string;
  name: string;
  country: string;
  flag?: string;
  publishDate: string;
  views?: number;
  saves?: number;
  shares?: number;
  content?: CityContent[];
}

interface CityCardsProps {
  city: City;
  onSaveToggle?: (cityId: string, isSaved: boolean) => void;
  isUserSaved?: boolean;
}

const getCardStyles = (type: string) => {
  switch (type) {
    case 'morning':
      return {
        gradient: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50',
        border: 'border-orange-100 dark:border-orange-800',
        iconBg: 'bg-orange-500',
        textColor: 'text-orange-900 dark:text-orange-100',
        subtextColor: 'text-orange-600 dark:text-orange-400',
        descColor: 'text-orange-700 dark:text-orange-300',
        icon: 'fas fa-sun',
        label: 'Morning Discovery',
        subtitle: 'Wake up in'
      };
    case 'afternoon':
      return {
        gradient: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/50 dark:to-pink-950/50',
        border: 'border-rose-100 dark:border-rose-800',
        iconBg: 'bg-rose-500',
        textColor: 'text-rose-900 dark:text-rose-100',
        subtextColor: 'text-rose-600 dark:text-rose-400',
        descColor: 'text-rose-700 dark:text-rose-300',
        icon: 'fas fa-utensils',
        label: 'Afternoon Culture',
        subtitle: 'Food & Tradition'
      };
    case 'evening':
      return {
        gradient: 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50',
        border: 'border-purple-100 dark:border-purple-800',
        iconBg: 'bg-purple-500',
        textColor: 'text-purple-900 dark:text-purple-100',
        subtextColor: 'text-purple-600 dark:text-purple-400',
        descColor: 'text-purple-700 dark:text-purple-300',
        icon: 'fas fa-moon',
        label: 'Evening Wisdom',
        subtitle: 'Smart Travel Tip'
      };
    default:
      return {
        gradient: 'bg-gradient-to-br from-gray-50 to-gray-100',
        border: 'border-gray-100',
        iconBg: 'bg-gray-500',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600',
        descColor: 'text-gray-700',
        icon: 'fas fa-map',
        label: 'Discovery',
        subtitle: 'Explore'
      };
  }
};

function CityContentCard({ content, cityName }: { content: CityContent; cityName: string }) {
  const styles = getCardStyles(content.type);
  
  return (
    <Card className={`p-6 ${styles.gradient} ${styles.border} card-hover`}>
      <div className="flex items-center mb-4">
        <div className={`w-12 h-12 ${styles.iconBg} rounded-xl flex items-center justify-center mr-4`}>
          <i className={`${styles.icon} text-white text-lg`}></i>
        </div>
        <div>
          <h3 className={`text-lg font-bold ${styles.textColor}`}>{styles.label}</h3>
          <p className={`text-sm ${styles.subtextColor}`}>{styles.subtitle} {cityName}</p>
        </div>
      </div>
      
      {content.imageUrl && (
        <img 
          src={content.imageUrl} 
          alt={content.title}
          className="w-full h-32 object-cover rounded-xl mb-4"
          onError={(e) => {
            // Fallback to a default travel image
            e.currentTarget.src = `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`;
          }}
        />
      )}
      
      <p className={`font-medium mb-2 ${styles.textColor}`}>{content.title}</p>
      <p className={`text-sm ${styles.descColor} leading-relaxed`}>{content.description}</p>
      
      {/* Travel CTA Buttons */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Button 
          size="sm" 
          variant="outline"
          className="text-xs"
          onClick={() => window.open(`https://booking.com/searchresults.html?ss=${cityName}`, '_blank')}
          data-testid="button-book-hotel"
        >
          🏨 Hotel
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs"
          onClick={() => window.open(`https://getyourguide.com/s/?q=${cityName}`, '_blank')}
          data-testid="button-explore-tours"
        >
          🎫 Tours
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="text-xs" 
          onClick={() => window.open(`https://skyscanner.com/transport/flights/everywhere/${cityName}`, '_blank')}
          data-testid="button-search-flights"
        >
          ✈️ Flights
        </Button>
      </div>
      
      <div className="flex justify-between items-center mt-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className={`${styles.subtextColor} hover:${styles.textColor} text-xs`}
          data-testid={`button-save-${content.type}`}
        >
          <Heart className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`${styles.subtextColor} hover:${styles.textColor} text-xs`}
          data-testid={`button-share-${content.type}`}
        >
          <Share2 className="w-3 h-3 mr-1" />
          Share
        </Button>
      </div>
    </Card>
  );
}

export function CityCards({ city, onSaveToggle, isUserSaved = false }: CityCardsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [saved, setSaved] = useState(isUserSaved);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (saved) {
        await apiRequest('DELETE', `/api/cities/${city.id}/save`);
      } else {
        await apiRequest('POST', `/api/cities/${city.id}/save`);
      }
    },
    onSuccess: () => {
      setSaved(!saved);
      onSaveToggle?.(city.id, !saved);
      queryClient.invalidateQueries({ queryKey: ['/api/user/saved-cities'] });
      toast({
        title: saved ? "City Removed" : "City Saved",
        description: saved ? `${city.name} removed from your collection` : `${city.name} added to your collection`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save city",
        variant: "destructive",
      });
    }
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/cities/${city.id}/share`);
    },
    onSuccess: () => {
      toast({
        title: "Shared!",
        description: `${city.name} has been shared`,
      });
    }
  });

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Daily Felix - Discover ${city.name}`,
        text: `Check out today's city discovery: ${city.name}, ${city.country}`,
        url: window.location.href,
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "City link copied to clipboard",
      });
    }
    shareMutation.mutate();
  };

  const morningContent = city.content?.find(c => c.type === 'morning');
  const afternoonContent = city.content?.find(c => c.type === 'afternoon');
  const eveningContent = city.content?.find(c => c.type === 'evening');

  return (
    <div className="space-y-8">
      {/* City Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 bg-accent/10 px-4 py-2 rounded-full mb-4">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
          <span className="text-accent-foreground font-semibold">Today's Discovery</span>
        </div>
        <h2 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
          Welcome to {city.name} {city.flag}
        </h2>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {city.views || 0} views
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            {city.saves || 0} saves
          </div>
          <div className="flex items-center gap-1">
            <Share2 className="w-4 h-4" />
            {city.shares || 0} shares
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(city.publishDate).toLocaleDateString()}
          </div>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Discover the beauty and culture of {city.country}
        </p>
      </div>

      {/* Three-Card System */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {morningContent && <CityContentCard content={morningContent} cityName={city.name} />}
        {afternoonContent && <CityContentCard content={afternoonContent} cityName={city.name} />}
        {eveningContent && <CityContentCard content={eveningContent} cityName={city.name} />}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {isAuthenticated && (
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-semibold"
            data-testid="button-save-city"
          >
            {saved ? (
              <>
                <Heart className="w-4 h-4 mr-2 fill-current" />
                Saved to My Cities
              </>
            ) : (
              <>
                <Heart className="w-4 h-4 mr-2" />
                Add to My Cities
              </>
            )}
          </Button>
        )}
        <Button 
          onClick={handleShare}
          disabled={shareMutation.isPending}
          className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 rounded-xl font-semibold"
          data-testid="button-share-city"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Discovery
        </Button>
      </div>
    </div>
  );
}
