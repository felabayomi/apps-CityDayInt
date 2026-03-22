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
import {
  Globe, Wand2, Eye, Edit, Save, Calendar, Sun, Utensils, Moon,
  CheckCircle, Clock, BookOpen, Send
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

function isAdmin(email?: string | null) {
  return email?.includes('admin') || email === 'wordofday2025@gmail.com';
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
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [cityForm, setCityForm] = useState({
    name: '',
    country: '',
    region: '',
    publishDate: new Date().toISOString().split('T')[0],
    status: 'draft',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [activeContentTab, setActiveContentTab] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [contentTabs, setContentTabs] = useState<ContentTab[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = '/api/login';
      return;
    }
    if (user && !isAdmin(user.email)) {
      toast({ title: "Access Denied", description: "You need admin privileges.", variant: "destructive" });
    }
  }, [user, isLoading, toast]);

  const { data: cities = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/cities'],
    enabled: isAdmin(user?.email),
  });

  const drafts = cities.filter((c: any) => c.status === 'draft' || c.status === 'ready');
  const published = cities.filter((c: any) => c.status === 'published');
  const scheduledCount = cities.filter((c: any) => c.status === 'scheduled').length;

  const createCityMutation = useMutation({
    mutationFn: async (data: typeof cityForm) => {
      const res = await apiRequest('POST', '/api/admin/cities', data);
      return res.json();
    },
    onSuccess: (city) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      setSelectedCityId(city.id);
      toast({ title: "City Created", description: `${city.name} saved as draft.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateContentMutation = useMutation({
    mutationFn: async (cityId: string) => {
      const res = await apiRequest('POST', `/api/admin/cities/${cityId}/generate-content`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data);
      if (data.content) {
        setContentTabs(data.content.map((c: any) => ({
          id: c.id, type: c.type, title: c.title,
          description: c.description, imageUrl: c.imageUrl || '', affiliateLink: c.affiliateLink || '',
        })));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      toast({ title: "Content Generated", description: "Review and publish when ready." });
    },
    onError: (e: Error) => toast({ title: "Generation Failed", description: e.message, variant: "destructive" }),
  });

  const updateCityMutation = useMutation({
    mutationFn: async ({ cityId, data }: { cityId: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/admin/cities/${cityId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/archive'] });
      toast({ title: "Updated", description: "City status updated successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ contentId, data }: { contentId: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/admin/content/${contentId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Content saved successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCreateCity = () => {
    if (!cityForm.name || !cityForm.country) {
      toast({ title: "Required Fields", description: "Enter city name and country.", variant: "destructive" });
      return;
    }
    createCityMutation.mutate(cityForm);
  };

  const handleGenerateContent = async () => {
    if (!selectedCityId) return;
    setIsGenerating(true);
    try {
      await generateContentMutation.mutateAsync(selectedCityId);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = (cityId: string) => {
    updateCityMutation.mutate({ cityId, data: { status: 'published' } });
  };

  const handleUnpublish = (cityId: string) => {
    updateCityMutation.mutate({ cityId, data: { status: 'draft' } });
  };

  const handleSaveContent = (contentId: string, data: any) => {
    updateContentMutation.mutate({ contentId, data });
  };

  const currentTab = contentTabs.find((t) => t.type === activeContentTab);

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'morning': return Sun;
      case 'afternoon': return Utensils;
      default: return Moon;
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin(user?.email)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Card className="p-8">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need administrator privileges to access this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground">Create city content, review drafts, and publish.</p>
      </div>

      {/* Stats — real data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-2xl font-bold text-foreground">{cities.length}</p>
          <p className="text-sm text-muted-foreground">Total Cities</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-amber-500">{drafts.length}</p>
          <p className="text-sm text-muted-foreground">In Draft Queue</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-green-500">{published.length}</p>
          <p className="text-sm text-muted-foreground">Published</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-foreground">{scheduledCount}</p>
          <p className="text-sm text-muted-foreground">Scheduled</p>
        </Card>
      </div>

      {/* Draft Queue — the editorial firewall */}
      {drafts.length > 0 && (
        <Card className="p-6 mb-8 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-foreground">Draft Queue</h2>
            <Badge variant="outline" className="text-amber-600 border-amber-300">{drafts.length} pending review</Badge>
          </div>
          <div className="space-y-3">
            {drafts.map((city: any) => (
              <div key={city.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{city.name}, {city.country}</p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled: {new Date(city.publishDate).toLocaleDateString()} · Status: {city.status}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCityId(city.id);
                    }}
                    data-testid={`button-edit-draft-${city.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handlePublish(city.id)}
                    disabled={updateCityMutation.isPending}
                    data-testid={`button-publish-${city.id}`}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Publish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Create City</TabsTrigger>
          <TabsTrigger value="manage">All Cities</TabsTrigger>
          <TabsTrigger value="content" disabled={contentTabs.length === 0}>Edit Content</TabsTrigger>
        </TabsList>

        {/* Create City Tab */}
        <TabsContent value="create">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-5">New City</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="city-name">City Name</Label>
                  <Input
                    id="city-name"
                    placeholder="e.g., Barcelona"
                    value={cityForm.name}
                    onChange={(e) => setCityForm((p) => ({ ...p, name: e.target.value }))}
                    data-testid="input-city-name"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="e.g., Spain"
                    value={cityForm.country}
                    onChange={(e) => setCityForm((p) => ({ ...p, country: e.target.value }))}
                    data-testid="input-country"
                  />
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={cityForm.region}
                    onValueChange={(v) => setCityForm((p) => ({ ...p, region: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Europe", "Asia", "Africa", "North America", "South America", "Oceania", "Middle East"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="publish-date">Publish Date</Label>
                  <Input
                    id="publish-date"
                    type="date"
                    value={cityForm.publishDate}
                    onChange={(e) => setCityForm((p) => ({ ...p, publishDate: e.target.value }))}
                    data-testid="input-publish-date"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateCity}
                  disabled={createCityMutation.isPending}
                  data-testid="button-create-city"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Save as Draft
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-5">AI Content Generator</h2>
              {!selectedCityId ? (
                <div className="text-center py-10">
                  <Wand2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Create a city draft first to generate AI content.</p>
                </div>
              ) : isGenerating ? (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Generating content with AI...</span>
                    <Wand2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              ) : generatedContent ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Content generated — ready to review</span>
                  </div>
                  {generatedContent.content?.map((c: any) => (
                    <div key={c.id} className="border border-border rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">{c.type}</p>
                      <p className="text-sm text-foreground">{c.title}</p>
                    </div>
                  ))}
                  {generatedContent.funFact && (
                    <div className="bg-accent/10 border border-accent/20 rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Fun Fact</p>
                      <p className="text-sm text-foreground">{generatedContent.funFact}</p>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => handlePublish(selectedCityId)}
                    disabled={updateCityMutation.isPending}
                    data-testid="button-publish-generated"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Publish Now
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <Wand2 className="mx-auto h-12 w-12 text-primary" />
                  <div>
                    <p className="font-medium text-foreground mb-1">City draft created</p>
                    <p className="text-sm text-muted-foreground">AI will generate landmark, food, budget tip, and fun fact content.</p>
                  </div>
                  <Button
                    onClick={handleGenerateContent}
                    disabled={generateContentMutation.isPending}
                    data-testid="button-generate-content"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate AI Content
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* All Cities Tab */}
        <TabsContent value="manage">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-foreground">All Cities</h2>
              <Badge variant="outline">{cities.length} total</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 px-3 font-semibold text-foreground">City</th>
                    <th className="py-3 px-3 font-semibold text-foreground">Status</th>
                    <th className="py-3 px-3 font-semibold text-foreground">Publish Date</th>
                    <th className="py-3 px-3 font-semibold text-foreground">Views</th>
                    <th className="py-3 px-3 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((city: any) => (
                    <tr key={city.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <p className="font-medium text-foreground">{city.name}</p>
                        <p className="text-xs text-muted-foreground">{city.country}</p>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={
                            city.status === 'published' ? 'border-green-300 text-green-600 dark:text-green-400' :
                            city.status === 'draft' ? 'border-amber-300 text-amber-600 dark:text-amber-400' :
                            'border-border text-muted-foreground'
                          }
                        >
                          {city.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {new Date(city.publishDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-foreground">{city.views || 0}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLocation(`/city/${city.id}`)}
                            data-testid={`button-view-${city.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {city.status !== 'published' ? (
                            <Button
                              size="sm"
                              onClick={() => handlePublish(city.id)}
                              disabled={updateCityMutation.isPending}
                              data-testid={`button-publish-${city.id}`}
                            >
                              Publish
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnpublish(city.id)}
                              disabled={updateCityMutation.isPending}
                              data-testid={`button-unpublish-${city.id}`}
                            >
                              Unpublish
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-foreground">Edit Content</h2>
              <Button
                size="sm"
                onClick={() => currentTab && handleSaveContent(currentTab.id, currentTab)}
                disabled={updateContentMutation.isPending}
                data-testid="button-save-content"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>

            {contentTabs.length > 0 ? (
              <>
                <div className="flex gap-1 bg-muted p-1 rounded-lg inline-flex mb-6">
                  {(['morning', 'afternoon', 'evening'] as const).map((type) => {
                    const Icon = getTabIcon(type);
                    return (
                      <button
                        key={type}
                        onClick={() => setActiveContentTab(type)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                          activeContentTab === type
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    );
                  })}
                </div>

                {currentTab && (
                  <div className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={currentTab.title}
                        onChange={(e) => setContentTabs((prev) =>
                          prev.map((t) => t.type === activeContentTab ? { ...t, title: e.target.value } : t)
                        )}
                        data-testid={`input-content-title-${activeContentTab}`}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        rows={5}
                        value={currentTab.description}
                        onChange={(e) => setContentTabs((prev) =>
                          prev.map((t) => t.type === activeContentTab ? { ...t, description: e.target.value } : t)
                        )}
                        data-testid={`input-content-desc-${activeContentTab}`}
                      />
                    </div>
                    <div>
                      <Label>Image URL</Label>
                      <Input
                        placeholder="https://images.unsplash.com/..."
                        value={currentTab.imageUrl}
                        onChange={(e) => setContentTabs((prev) =>
                          prev.map((t) => t.type === activeContentTab ? { ...t, imageUrl: e.target.value } : t)
                        )}
                        data-testid={`input-image-url-${activeContentTab}`}
                      />
                      {currentTab.imageUrl && (
                        <img src={currentTab.imageUrl} alt="Preview" className="mt-2 h-32 w-full object-cover rounded-md" />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="mx-auto h-10 w-10 mb-3" />
                <p>Generate content for a city first to edit it here.</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
