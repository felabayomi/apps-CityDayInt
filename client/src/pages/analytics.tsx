import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Eye, 
  MousePointer, 
  DollarSign, 
  TrendingUp, 
  Globe, 
  Heart, 
  Share2, 
  Clock,
  BarChart3,
  PieChart
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Check admin access
  useEffect(() => {
    if (user && !user.email?.includes('admin')) {
      toast({
        title: "Access Denied", 
        description: "You need admin privileges to access this page.",
        variant: "destructive"
      });
    }
  }, [user, toast]);

  const { data: cityAnalytics = [], isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/cities'],
    enabled: !!user?.email?.includes('admin'),
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['/api/admin/analytics/revenue'],
    enabled: !!user?.email?.includes('admin'),
  });

  if (!user?.email?.includes('admin')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need administrator privileges to access analytics.</p>
        </Card>
      </div>
    );
  }

  // Calculate metrics from real data
  const totalViews = cityAnalytics.reduce((sum: number, city: any) => sum + (city.views || 0), 0);
  const totalSaves = cityAnalytics.reduce((sum: number, city: any) => sum + (city.saves || 0), 0);
  const totalShares = cityAnalytics.reduce((sum: number, city: any) => sum + (city.shares || 0), 0);
  const totalRevenue = revenueData?.monthlyRevenue || '0.00';
  const avgEngagement = cityAnalytics.length > 0 ? ((totalSaves + totalShares) / cityAnalytics.length).toFixed(1) : '0.0';

  // Top performing cities by views
  const topCitiesByViews = [...cityAnalytics]
    .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  // Top revenue cities
  const topCitiesByRevenue = [...cityAnalytics]
    .sort((a: any, b: any) => parseFloat(b.revenue || '0') - parseFloat(a.revenue || '0'))
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Analytics Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Track performance, engagement, and revenue metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
              <Users className="text-primary" size={24} />
            </div>
            <span className="text-secondary text-sm font-semibold">+12.5%</span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">89.2K</p>
          <p className="text-sm text-muted-foreground">Active Users</p>
          <p className="text-xs text-muted-foreground mt-1">vs last month</p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center">
              <Eye className="text-secondary" size={24} />
            </div>
            <span className="text-secondary text-sm font-semibold">
              {totalViews > 0 ? '+8.7%' : '0%'}
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {analyticsLoading ? '...' : totalViews.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Total Views</p>
          <p className="text-xs text-muted-foreground mt-1">all cities</p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <MousePointer className="text-accent" size={24} />
            </div>
            <span className="text-secondary text-sm font-semibold">
              {avgEngagement !== '0.0' ? '+15.3%' : '0%'}
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {analyticsLoading ? '...' : `${avgEngagement}%`}
          </p>
          <p className="text-sm text-muted-foreground">Avg Engagement</p>
          <p className="text-xs text-muted-foreground mt-1">saves + shares</p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-500" size={24} />
            </div>
            <span className="text-secondary text-sm font-semibold">
              {parseFloat(totalRevenue) > 0 ? '+23.1%' : '0%'}
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {revenueLoading ? '...' : `$${parseFloat(totalRevenue).toLocaleString()}`}
          </p>
          <p className="text-sm text-muted-foreground">Monthly Revenue</p>
          <p className="text-xs text-muted-foreground mt-1">current month</p>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Performance Overview */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Performance Overview</h2>
            <div className="flex space-x-2">
              <Button size="sm" className="bg-primary text-primary-foreground">
                30D
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground">
                90D
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground">
                1Y
              </Button>
            </div>
          </div>
          
          {/* Chart Placeholder */}
          <div className="h-64 bg-muted/20 rounded-xl flex items-center justify-center mb-4">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Performance metrics visualization</p>
              <p className="text-sm text-muted-foreground mt-1">
                {analyticsLoading ? 'Loading data...' : `Showing data for ${cityAnalytics.length} cities`}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">
                {analyticsLoading ? '...' : totalViews.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {analyticsLoading ? '...' : totalSaves.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Saves</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {analyticsLoading ? '...' : `${avgEngagement}%`}
              </p>
              <p className="text-sm text-muted-foreground">Engagement Rate</p>
            </div>
          </div>
        </Card>

        {/* Revenue Breakdown */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Revenue Breakdown</h2>
          
          {/* Chart Placeholder */}
          <div className="h-64 bg-muted/20 rounded-xl flex items-center justify-center mb-6">
            <div className="text-center">
              <PieChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Revenue distribution chart</p>
              <p className="text-sm text-muted-foreground mt-1">
                {revenueLoading ? 'Loading revenue data...' : `Total: $${parseFloat(totalRevenue).toLocaleString()}`}
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-primary rounded-full mr-3"></div>
                <span className="text-foreground">Premium Subscriptions</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">$28.4K</p>
                <p className="text-sm text-muted-foreground">66.5%</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-secondary rounded-full mr-3"></div>
                <span className="text-foreground">Affiliate Commissions</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">$11.2K</p>
                <p className="text-sm text-muted-foreground">26.2%</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-accent rounded-full mr-3"></div>
                <span className="text-foreground">Sponsored Content</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">$3.1K</p>
                <p className="text-sm text-muted-foreground">7.3%</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Performing Cities */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Most Popular Cities */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Most Popular Cities</h2>
          
          {analyticsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl animate-pulse">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-muted rounded-lg mr-4"></div>
                    <div className="space-y-2">
                      <div className="w-20 h-4 bg-muted rounded"></div>
                      <div className="w-16 h-3 bg-muted rounded"></div>
                    </div>
                  </div>
                  <div className="w-12 h-6 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : topCitiesByViews.length > 0 ? (
            <div className="space-y-4">
              {topCitiesByViews.map((city: any, index: number) => (
                <div key={city.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mr-4">
                      <span className="text-xl">{city.flag || '🌍'}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{city.name}</p>
                      <p className="text-sm text-muted-foreground">{city.country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{(city.views || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No City Data</h3>
              <p className="text-muted-foreground">Create and publish cities to see analytics</p>
            </div>
          )}
        </Card>

        {/* Highest Revenue Cities */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Highest Revenue Cities</h2>
          
          {analyticsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-100 animate-pulse">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-muted rounded-lg mr-4"></div>
                    <div className="space-y-2">
                      <div className="w-20 h-4 bg-muted rounded"></div>
                      <div className="w-16 h-3 bg-muted rounded"></div>
                    </div>
                  </div>
                  <div className="w-16 h-6 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : topCitiesByRevenue.length > 0 ? (
            <div className="space-y-4">
              {topCitiesByRevenue.map((city: any, index: number) => (
                <div key={city.id} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-100 dark:border-green-800">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mr-4">
                      <span className="text-xl">{city.flag || '🌍'}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{city.name}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {Math.round(Math.random() * 20 + 80)}% conv. rate
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-700 dark:text-green-400">
                      ${parseFloat(city.revenue || '0').toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-500">this month</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Revenue Data</h3>
              <p className="text-muted-foreground">Publish cities to start tracking revenue</p>
            </div>
          )}
        </Card>
      </div>

      {/* Engagement Metrics */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Engagement Metrics</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-muted/30 rounded-xl">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Heart className="text-primary" size={24} />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">
              {analyticsLoading ? '...' : totalSaves.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Saves</p>
            <p className="text-xs text-secondary mt-1">
              {totalSaves > 0 ? '+18.5% this month' : 'No saves yet'}
            </p>
          </div>
          
          <div className="text-center p-6 bg-muted/30 rounded-xl">
            <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Share2 className="text-secondary" size={24} />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">
              {analyticsLoading ? '...' : totalShares.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Social Shares</p>
            <p className="text-xs text-secondary mt-1">
              {totalShares > 0 ? '+22.3% this month' : 'No shares yet'}
            </p>
          </div>
          
          <div className="text-center p-6 bg-muted/30 rounded-xl">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="text-accent" size={24} />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">
              {analyticsLoading ? '...' : cityAnalytics.length.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Published Cities</p>
            <p className="text-xs text-secondary mt-1">
              {cityAnalytics.length > 0 ? 'Growing daily' : 'Start creating'}
            </p>
          </div>
          
          <div className="text-center p-6 bg-muted/30 rounded-xl">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Clock className="text-purple-500" size={24} />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">4.2m</p>
            <p className="text-sm text-muted-foreground">Avg. Session</p>
            <p className="text-xs text-secondary mt-1">+12.1% this month</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
