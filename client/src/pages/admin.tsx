import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Globe, Users, Crown, DollarSign, Wand2, Eye, Edit, Trash2, Save, Calendar, Sun, Utensils, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface CityFormData {
  name: string;
  country: string;
  publishDate: string;
  status: string;
}

interface ContentTab {
  id: string;
  type: 'morning' | 'afternoon' | 'evening';
  title: string;
  description: string;
  imageUrl: string;
  affiliateLink: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [cityForm, setCityForm] = useState<CityFormData>({
    name: '',
    country: '',
    publishDate: new Date().toISOString().split('T')[0],
    status: 'draft'
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [activeContentTab, setActiveContentTab] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [contentTabs, setContentTabs] = useState<ContentTab[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');

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

  // Stats queries
  const { data: cities = [] } = useQuery({
    queryKey: ['/api/admin/cities'],
    enabled: !!user?.email?.includes('admin'),
  });

  const { data: analytics = [] } = useQuery({
    queryKey: ['/api/admin/analytics/cities'], 
    enabled: !!user?.email?.includes('admin'),
  });

  // Create city mutation
  const createCityMutation = useMutation({
    mutationFn: async (cityData: CityFormData) => {
      const response = await apiRequest('POST', '/api/admin/cities', cityData);
      return response.json();
    },
    onSuccess: (city) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      setSelectedCityId(city.id);
      toast({
        title: "City Created",
        description: `${city.name} has been created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate content mutation
  const generateContentMutation = useMutation({
    mutationFn: async (cityId: string) => {
      const response = await apiRequest('POST', `/api/admin/cities/${cityId}/generate-content`);
      return response.json();
    },
    onSuccess: (result) => {
      setGeneratedContent(result);
      
      // Convert to content tabs format
      const tabs: ContentTab[] = result.content.map((content: any) => ({
        id: content.id,
        type: content.type,
        title: content.title,
        description: content.description,
        imageUrl: content.imageUrl || '',
        affiliateLink: content.affiliateLink || '',
      }));
      setContentTabs(tabs);
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      toast({
        title: "Content Generated",
        description: "AI has generated comprehensive content for this city.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive", 
      });
    },
  });

  // Update content mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ contentId, data }: { contentId: string; data: any }) => {
      const response = await apiRequest('PUT', `/api/admin/content/${contentId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Content Updated",
        description: "Content has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update city mutation  
  const updateCityMutation = useMutation({
    mutationFn: async ({ cityId, data }: { cityId: string; data: any }) => {
      const response = await apiRequest('PUT', `/api/admin/cities/${cityId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      toast({
        title: "City Updated",
        description: "City has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCity = async () => {
    if (!cityForm.name || !cityForm.country) {
      toast({
        title: "Missing Information",
        description: "Please provide both city name and country.",
        variant: "destructive",
      });
      return;
    }
    
    createCityMutation.mutate(cityForm);
  };

  const handleGenerateContent = async () => {
    if (!selectedCityId) {
      toast({
        title: "No City Selected",
        description: "Please create a city first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateContentMutation.mutateAsync(selectedCityId);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveContent = (contentId: string, data: any) => {
    updateContentMutation.mutate({ contentId, data });
  };

  const handlePublishCity = (cityId: string) => {
    updateCityMutation.mutate({
      cityId,
      data: { status: 'published' }
    });
  };

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'morning': return Sun;
      case 'afternoon': return Utensils;
      case 'evening': return Moon;
      default: return Globe;
    }
  };

  const currentTab = contentTabs.find(tab => tab.type === activeContentTab);

  if (!user?.email?.includes('admin')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need administrator privileges to access this page.</p>
        </Card>
      </div>
    );
  }

  const totalUsers = 89200;
  const premiumUsers = 12400;
  const monthlyRevenue = 42700;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Admin Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage your daily city content and publishing schedule</p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mr-4">
              <Globe className="text-secondary" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{cities.length}</p>
              <p className="text-sm text-muted-foreground">Cities Created</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
              <Users className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalUsers.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mr-4">
              <Crown className="text-accent" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{premiumUsers.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Premium Users</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mr-4">
              <DollarSign className="text-green-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${monthlyRevenue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="create" className="space-y-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" data-testid="tab-create">Create City</TabsTrigger>
          <TabsTrigger value="manage" data-testid="tab-manage">Manage Cities</TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">Content Editor</TabsTrigger>
        </TabsList>

        {/* Create City Tab */}
        <TabsContent value="create">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* City Input Form */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">Create New City</h2>
              
              <div className="space-y-6">
                <div>
                  <Label htmlFor="city-name">City Name</Label>
                  <Input
                    id="city-name"
                    placeholder="e.g., Barcelona, Spain"
                    value={cityForm.name}
                    onChange={(e) => setCityForm(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-city-name"
                  />
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="e.g., Spain"
                    value={cityForm.country}
                    onChange={(e) => setCityForm(prev => ({ ...prev, country: e.target.value }))}
                    data-testid="input-country"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="publish-date">Publish Date</Label>
                    <Input
                      id="publish-date"
                      type="date"
                      value={cityForm.publishDate}
                      onChange={(e) => setCityForm(prev => ({ ...prev, publishDate: e.target.value }))}
                      data-testid="input-publish-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={cityForm.status}
                      onValueChange={(value) => setCityForm(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="ready">Ready to Publish</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button 
                    variant="outline"
                    onClick={() => setCityForm({ name: '', country: '', publishDate: new Date().toISOString().split('T')[0], status: 'draft' })}
                    data-testid="button-reset-form"
                  >
                    Reset Form
                  </Button>
                  <Button 
                    onClick={handleCreateCity}
                    disabled={createCityMutation.isPending}
                    data-testid="button-create-city"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Create City
                  </Button>
                </div>
              </div>
            </Card>

            {/* AI Generation Panel */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">AI Content Generator</h2>
              
              {!selectedCityId ? (
                <div className="text-center py-8">
                  <Wand2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Generate</h3>
                  <p className="text-muted-foreground">Create a city first to unlock AI-powered content generation</p>
                </div>
              ) : isGenerating ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Generating content...</span>
                    <Wand2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                  </div>
                  <p className="text-sm text-muted-foreground">Creating personalized travel content with AI...</p>
                </div>
              ) : generatedContent ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Globe className="text-white" size={24} />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Content Generated!</h3>
                    <p className="text-muted-foreground">AI has created comprehensive travel content ready for editing</p>
                  </div>
                  
                  <div className="space-y-3">
                    {generatedContent.content?.map((content: any, index: number) => (
                      <div key={content.id} className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-2 capitalize">
                          {content.type} Content
                        </h4>
                        <p className="text-sm text-muted-foreground">{content.title}</p>
                      </div>
                    ))}
                  </div>
                  
                  {generatedContent.funFact && (
                    <div className="bg-accent/10 p-4 rounded-lg border border-accent/20">
                      <h4 className="font-semibold text-foreground mb-2">Fun Fact</h4>
                      <p className="text-sm text-muted-foreground">{generatedContent.funFact}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button 
                    onClick={handleGenerateContent}
                    disabled={generateContentMutation.isPending}
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-generate-content"
                  >
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate AI Content
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Generate comprehensive travel content with AI in seconds
                  </p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Manage Cities Tab */}
        <TabsContent value="manage">
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">All Cities</h2>
              <Badge variant="outline">{cities.length} total</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">City</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Publish Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Views</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((city: any) => (
                    <tr key={city.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mr-3">
                            <span className="text-xl">{city.flag || '🌍'}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{city.name}</p>
                            <p className="text-sm text-muted-foreground">{city.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge 
                          variant={city.status === 'published' ? 'default' : 'outline'}
                          className={
                            city.status === 'published' ? 'bg-secondary text-white' :
                            city.status === 'ready' ? 'bg-accent text-accent-foreground' :
                            'bg-muted text-muted-foreground'
                          }
                        >
                          {city.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        {new Date(city.publishDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-foreground font-medium">
                        {city.views || 0}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setSelectedCityId(city.id);
                              // Switch to content tab
                            }}
                            data-testid={`button-edit-${city.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            data-testid={`button-view-${city.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {city.status !== 'published' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handlePublishCity(city.id)}
                              className="text-secondary hover:text-secondary"
                              data-testid={`button-publish-${city.id}`}
                            >
                              Publish
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Content Editor Tab */}
        <TabsContent value="content">
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Content Editor</h2>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" data-testid="button-preview-content">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    if (currentTab) {
                      handleSaveContent(currentTab.id, currentTab);
                    }
                  }}
                  disabled={updateContentMutation.isPending}
                  data-testid="button-save-content"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>

            {contentTabs.length > 0 ? (
              <>
                {/* Content Type Tabs */}
                <div className="mb-6">
                  <div className="flex space-x-1 bg-muted p-1 rounded-lg inline-flex">
                    {(['morning', 'afternoon', 'evening'] as const).map((type) => {
                      const Icon = getTabIcon(type);
                      return (
                        <button
                          key={type}
                          onClick={() => setActiveContentTab(type)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                            activeContentTab === type
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          data-testid={`tab-${type}`}
                        >
                          <Icon size={16} />
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content Editor */}
                {currentTab && (
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="content-title">Title</Label>
                        <Input
                          id="content-title"
                          value={currentTab.title}
                          onChange={(e) => {
                            const updatedTabs = contentTabs.map(tab =>
                              tab.id === currentTab.id ? { ...tab, title: e.target.value } : tab
                            );
                            setContentTabs(updatedTabs);
                          }}
                          data-testid="input-content-title"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="content-description">Description</Label>
                        <Textarea
                          id="content-description"
                          rows={4}
                          value={currentTab.description}
                          onChange={(e) => {
                            const updatedTabs = contentTabs.map(tab =>
                              tab.id === currentTab.id ? { ...tab, description: e.target.value } : tab
                            );
                            setContentTabs(updatedTabs);
                          }}
                          data-testid="input-content-description"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="image-url">Image URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="image-url"
                            value={currentTab.imageUrl}
                            onChange={(e) => {
                              const updatedTabs = contentTabs.map(tab =>
                                tab.id === currentTab.id ? { ...tab, imageUrl: e.target.value } : tab
                              );
                              setContentTabs(updatedTabs);
                            }}
                            placeholder="https://images.unsplash.com/..."
                            data-testid="input-image-url"
                          />
                          <Button variant="outline" size="sm" data-testid="button-search-image">
                            <Globe className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="affiliate-link">Affiliate Link (Optional)</Label>
                        <Input
                          id="affiliate-link"
                          value={currentTab.affiliateLink}
                          onChange={(e) => {
                            const updatedTabs = contentTabs.map(tab =>
                              tab.id === currentTab.id ? { ...tab, affiliateLink: e.target.value } : tab
                            );
                            setContentTabs(updatedTabs);
                          }}
                          placeholder="https://partner.com/book"
                          data-testid="input-affiliate-link"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <Label>Image Preview</Label>
                        {currentTab.imageUrl ? (
                          <img 
                            src={currentTab.imageUrl} 
                            alt={currentTab.title}
                            className="w-full h-48 object-cover rounded-lg border border-border"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                        ) : (
                          <div className="w-full h-48 bg-muted rounded-lg border border-border flex items-center justify-center">
                            <Globe className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* Card Preview */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800">
                        <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Card Preview</h4>
                        <div className="space-y-2">
                          <p className="font-semibold text-orange-800 dark:text-orange-200 text-sm">
                            {currentTab.title || 'Content title will appear here'}
                          </p>
                          <p className="text-orange-700 dark:text-orange-300 text-xs">
                            {currentTab.description || 'Content description will appear here...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Edit className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Content to Edit</h3>
                <p className="text-muted-foreground mb-4">
                  Create a city and generate content first to start editing
                </p>
                <Button 
                  onClick={() => {
                    // Switch to create tab
                  }}
                  data-testid="button-create-content"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Create Your First City
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
