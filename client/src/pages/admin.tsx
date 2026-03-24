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
  CheckCircle, Clock, BookOpen, Send, Zap, RefreshCw, CalendarCheck
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

  const { data: allUsers = [], refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin(user?.email),
  });

  const togglePremiumMutation = useMutation({
    mutationFn: async ({ userId, isPremium }: { userId: string; isPremium: boolean }) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/premium`, { isPremium });
      return res.json();
    },
    onSuccess: () => {
      refetchUsers();
      toast({ title: "Premium status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: schedulerStatus, isLoading: schedulerLoading, refetch: refetchScheduler } = useQuery<any>({
    queryKey: ['/api/admin/scheduler/status'],
    enabled: isAdmin(user?.email),
    refetchInterval: 30000,
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
      await apiRequest('PUT', `/api/admin/cities/${cityId}`, data);
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
      await apiRequest('PUT', `/api/admin/content/${contentId}`, data);
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

  const generateTomorrowMutation = useMutation({
    mutationFn: async (force = false) => {
      const res = await apiRequest('POST', '/api/admin/scheduler/generate', { force });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/scheduler/status'] });
      toast({ title: data.success ? "Generated" : "Skipped", description: data.message });
    },
    onError: (e: Error) => toast({ title: "Generation Failed", description: e.message, variant: "destructive" }),
  });

  const approveScheduledMutation = useMutation({
    mutationFn: async (cityId: string) => {
      const res = await apiRequest('POST', `/api/admin/cities/${cityId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/scheduler/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/today'] });
      toast({ title: "Published", description: "City is now live on the site." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [editingScheduled, setEditingScheduled] = useState<{ contentId: string; type: string; title: string; description: string } | null>(null);
  const [editingCityMeta, setEditingCityMeta] = useState<{ name: string; country: string; region: string; funFact: string; publishDate: string } | null>(null);
  const [activeTab, setActiveTab] = useState("scheduler");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const goToManageWithFilter = (filter: string) => {
    setStatusFilter(filter);
    setActiveTab("manage");
  };

  const loadCityForEdit = async (city: any) => {
    try {
      const res = await fetch(`/api/admin/cities/${city.id}/detail`, { credentials: 'include' });
      const detail = await res.json();
      setSelectedCityId(city.id);
      setEditingCityMeta({
        name: detail.name || '',
        country: detail.country || '',
        region: detail.region || '',
        funFact: detail.funFact || '',
        publishDate: detail.publishDate ? new Date(detail.publishDate).toISOString().split('T')[0] : '',
      });
      if (detail.content?.length > 0) {
        setContentTabs(detail.content.map((c: any) => ({
          id: c.id, type: c.type, title: c.title,
          description: c.description, imageUrl: c.imageUrl || '', affiliateLink: c.affiliateLink || '',
        })));
      }
      setActiveTab("content");
    } catch {
      toast({ title: "Error", description: "Could not load city content.", variant: "destructive" });
    }
  };

  const saveCityMetaMutation = useMutation({
    mutationFn: async ({ cityId, data }: { cityId: string; data: any }) => {
      await apiRequest('PUT', `/api/admin/cities/${cityId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/archive'] });
      toast({ title: "Saved", description: "City details updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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

      {/* Stats — real data, clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 cursor-pointer hover-elevate" onClick={() => goToManageWithFilter("all")} data-testid="stat-total-cities">
          <p className="text-2xl font-bold text-foreground">{cities.length}</p>
          <p className="text-sm text-muted-foreground">Total Cities</p>
        </Card>
        <Card className="p-5 cursor-pointer hover-elevate" onClick={() => goToManageWithFilter("draft")} data-testid="stat-draft-queue">
          <p className="text-2xl font-bold text-amber-500">{drafts.length}</p>
          <p className="text-sm text-muted-foreground">In Draft Queue</p>
        </Card>
        <Card className="p-5 cursor-pointer hover-elevate" onClick={() => goToManageWithFilter("published")} data-testid="stat-published">
          <p className="text-2xl font-bold text-green-500">{published.length}</p>
          <p className="text-sm text-muted-foreground">Published</p>
        </Card>
        <Card className="p-5 cursor-pointer hover-elevate" onClick={() => goToManageWithFilter("scheduled")} data-testid="stat-scheduled">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scheduler">
            <CalendarCheck className="w-3 h-3 mr-1" />
            Scheduler
          </TabsTrigger>
          <TabsTrigger value="create">Create City</TabsTrigger>
          <TabsTrigger value="manage">All Cities</TabsTrigger>
          <TabsTrigger value="content" disabled={contentTabs.length === 0}>Edit Content</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Scheduler Tab */}
        <TabsContent value="scheduler">
          <div className="space-y-6">
            {/* Status banner */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Auto-Scheduler</h2>
                    <Badge variant="outline" className="text-green-600 border-green-300">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generates tomorrow's city today at <strong>3pm EST</strong> · Auto-publishes tomorrow at <strong>9am EST</strong> if not manually approved
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchScheduler()}
                  data-testid="button-refresh-scheduler"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>

              {/* Tomorrow's city */}
              {schedulerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : schedulerStatus?.scheduled ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{schedulerStatus.city.flag || "🌍"}</div>
                      <div>
                        <p className="font-semibold text-foreground text-lg">
                          {schedulerStatus.city.name}, {schedulerStatus.city.country}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {schedulerStatus.city.region} · Publish: {new Date(schedulerStatus.city.publishDate).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })} EST
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateTomorrowMutation.mutate(true)}
                        disabled={generateTomorrowMutation.isPending}
                        data-testid="button-regenerate-tomorrow"
                      >
                        {generateTomorrowMutation.isPending
                          ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating...</>
                          : <><RefreshCw className="w-3 h-3 mr-1" />Force Regenerate</>
                        }
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveScheduledMutation.mutate(schedulerStatus.city.id)}
                        disabled={approveScheduledMutation.isPending || schedulerStatus.city.status === 'published'}
                        data-testid="button-approve-scheduled"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {schedulerStatus.city.status === 'published' ? 'Already Published' : 'Approve Now'}
                      </Button>
                    </div>
                  </div>

                  {/* Content preview + inline edit */}
                  {schedulerStatus.city.content?.length > 0 && (
                    <div className="grid md:grid-cols-3 gap-4">
                      {schedulerStatus.city.content.map((card: any) => (
                        <Card key={card.id} className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {card.type === 'morning' && <Sun className="w-4 h-4 text-amber-500" />}
                            {card.type === 'afternoon' && <Utensils className="w-4 h-4 text-orange-500" />}
                            {card.type === 'evening' && <Moon className="w-4 h-4 text-indigo-500" />}
                            <span className="text-xs font-semibold uppercase text-muted-foreground">{card.type}</span>
                          </div>
                          {editingScheduled?.contentId === card.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editingScheduled.title}
                                onChange={(e) => setEditingScheduled((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                              />
                              <Textarea
                                rows={4}
                                value={editingScheduled.description}
                                onChange={(e) => setEditingScheduled((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => {
                                  if (editingScheduled) {
                                    handleSaveContent(editingScheduled.contentId, {
                                      title: editingScheduled.title,
                                      description: editingScheduled.description,
                                    });
                                    setEditingScheduled(null);
                                    setTimeout(() => refetchScheduler(), 500);
                                  }
                                }}>
                                  <Save className="w-3 h-3 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingScheduled(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="font-semibold text-foreground text-sm mb-1">{card.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-3">{card.description}</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mt-2 w-full"
                                onClick={() => setEditingScheduled({ contentId: card.id, type: card.type, title: card.title, description: card.description })}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  {schedulerStatus.city.funFact && (
                    <div className="p-3 bg-muted/30 rounded-md">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Fun Fact</p>
                      <p className="text-sm text-foreground">{schedulerStatus.city.funFact}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">No city scheduled for tomorrow yet.</p>
                  <Button
                    onClick={() => generateTomorrowMutation.mutate()}
                    disabled={generateTomorrowMutation.isPending}
                    data-testid="button-generate-tomorrow"
                  >
                    {generateTomorrowMutation.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-2" />Generate Tomorrow's City Now</>
                    )}
                  </Button>
                </div>
              )}
            </Card>

            {/* How it works */}
            <Card className="p-5">
              <h3 className="font-semibold text-foreground mb-3">How the Auto-Scheduler Works</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wand2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">3pm EST — Generate</p>
                    <p className="text-xs text-muted-foreground">AI picks an unvisited city and writes all three content cards for tomorrow</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Edit className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">Review Window</p>
                    <p className="text-xs text-muted-foreground">Edit content or approve early. If no action, the city auto-publishes tomorrow at 9am EST</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Send className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">9am EST Next Day — Publish</p>
                    <p className="text-xs text-muted-foreground">Tomorrow's city goes live automatically — no action required on your end</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

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
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">All Cities</h2>
                {statusFilter !== "all" && (
                  <Badge
                    variant="outline"
                    className={
                      statusFilter === "published" ? "border-green-300 text-green-600 dark:text-green-400 cursor-pointer" :
                      statusFilter === "draft" ? "border-amber-300 text-amber-600 dark:text-amber-400 cursor-pointer" :
                      "cursor-pointer"
                    }
                    onClick={() => setStatusFilter("all")}
                  >
                    {statusFilter} &times; clear
                  </Badge>
                )}
              </div>
              <Badge variant="outline">
                {statusFilter === "all" ? cities.length : cities.filter((c: any) => c.status === statusFilter).length} {statusFilter === "all" ? "total" : `${statusFilter}`}
              </Badge>
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
                  {cities.filter((city: any) => statusFilter === "all" || city.status === statusFilter).map((city: any) => (
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
                          {city.status === 'published' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setLocation(`/city/${city.id}`)}
                              data-testid={`button-view-${city.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadCityForEdit(city)}
                            data-testid={`button-edit-${city.id}`}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
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
                              variant="ghost"
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
          {/* City metadata editing */}
          {editingCityMeta && selectedCityId && (
            <Card className="p-6 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-foreground">City Details</h2>
                <Button
                  size="sm"
                  onClick={() => saveCityMetaMutation.mutate({
                    cityId: selectedCityId,
                    data: {
                      name: editingCityMeta.name,
                      country: editingCityMeta.country,
                      region: editingCityMeta.region,
                      funFact: editingCityMeta.funFact,
                      publishDate: editingCityMeta.publishDate ? new Date(editingCityMeta.publishDate) : undefined,
                    }
                  })}
                  disabled={saveCityMetaMutation.isPending}
                  data-testid="button-save-city-meta"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save Details
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>City Name</Label>
                  <Input
                    value={editingCityMeta.name}
                    onChange={(e) => setEditingCityMeta((p) => p ? { ...p, name: e.target.value } : p)}
                    data-testid="input-edit-city-name"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    value={editingCityMeta.country}
                    onChange={(e) => setEditingCityMeta((p) => p ? { ...p, country: e.target.value } : p)}
                    data-testid="input-edit-country"
                  />
                </div>
                <div>
                  <Label>Region</Label>
                  <Select value={editingCityMeta.region} onValueChange={(v) => setEditingCityMeta((p) => p ? { ...p, region: v } : p)}>
                    <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                    <SelectContent>
                      {["Europe", "Asia", "Africa", "Americas", "Oceania", "Middle East"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Publish Date</Label>
                  <Input
                    type="date"
                    value={editingCityMeta.publishDate}
                    onChange={(e) => setEditingCityMeta((p) => p ? { ...p, publishDate: e.target.value } : p)}
                    data-testid="input-edit-publish-date"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Fun Fact</Label>
                  <Textarea
                    rows={2}
                    value={editingCityMeta.funFact}
                    onChange={(e) => setEditingCityMeta((p) => p ? { ...p, funFact: e.target.value } : p)}
                    data-testid="input-edit-fun-fact"
                  />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h2 className="text-xl font-bold text-foreground">Edit Content Cards</h2>
              <Button
                size="sm"
                onClick={() => currentTab && handleSaveContent(currentTab.id, currentTab)}
                disabled={updateContentMutation.isPending}
                data-testid="button-save-content"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Card
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

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">User Management</h2>
              <span className="text-sm text-muted-foreground">{allUsers.length} registered users</span>
            </div>
            {allUsers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No users yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Joined</th>
                      <th className="pb-2 text-center">Premium</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allUsers.map((u: any) => (
                      <tr key={u.id} className="py-2">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {u.profileImageUrl && (
                              <img src={u.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                            )}
                            <span className="font-medium text-foreground">
                              {u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'User'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{u.email || '—'}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 text-center">
                          <Button
                            size="sm"
                            variant={u.isPremium ? "default" : "outline"}
                            onClick={() => togglePremiumMutation.mutate({ userId: u.id, isPremium: !u.isPremium })}
                            disabled={togglePremiumMutation.isPending}
                            className="text-xs"
                          >
                            {u.isPremium ? "Premium ✓" : "Set Premium"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
