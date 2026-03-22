import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateCityContent, generateImageUrl } from "./openai";
import { generateTomorrowsCity, autoPublishScheduledCities } from "./scheduler";
import { insertCitySchema, insertCityContentSchema, insertTravelPlanSchema, pushSubscriptions } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { cities } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { getVapidPublicKey, initVapid } from "./webpush";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Public routes - Today's city
  app.get('/api/cities/today', async (req, res) => {
    try {
      const city = await storage.getTodaysCity();
      if (!city) {
        return res.status(404).json({ message: "No city published for today" });
      }

      const content = await storage.getCityContent(city.id);
      await storage.incrementCityViews(city.id);
      
      res.json({ ...city, content });
    } catch (error) {
      console.error("Error fetching today's city:", error);
      res.status(500).json({ message: "Failed to fetch today's city" });
    }
  });

  // Public archive - all published cities
  app.get('/api/cities/archive', async (req, res) => {
    try {
      const allCities = await storage.getAllCities();
      const published = allCities.filter((c: any) => c.status === 'published');
      res.json(published);
    } catch (error) {
      console.error("Error fetching archive:", error);
      res.status(500).json({ message: "Failed to fetch archive" });
    }
  });

  // Get recent cities (limited for free users) - must be before /:cityId
  app.get('/api/cities/recent', async (req: any, res) => {
    try {
      let limit = 5; // Default for non-authenticated users
      
      if (req.headers.authorization || req.user) {
        // Check if user is authenticated and premium
        try {
          const userId = req.user?.claims?.sub;
          if (userId) {
            const user = await storage.getUser(userId);
            if (user?.isPremium) {
              limit = 50; // Premium users get more cities
            } else {
              limit = 10; // Authenticated free users get a few more
            }
          }
        } catch (authError) {
          // Continue with default limit if auth check fails
        }
      }

      const cities = await storage.getRecentCities(limit);
      const citiesWithContent = await Promise.all(
        cities.map(async (city) => ({
          ...city,
          content: await storage.getCityContent(city.id)
        }))
      );
      
      res.json(citiesWithContent);
    } catch (error) {
      console.error("Error fetching recent cities:", error);
      res.status(500).json({ message: "Failed to fetch recent cities" });
    }
  });

  // Individual city by ID (public) - must come after named routes like /recent, /archive
  app.get('/api/cities/:cityId', async (req, res) => {
    try {
      const { cityId } = req.params;
      const city = await storage.getCityById(cityId);
      if (!city || city.status !== 'published') {
        return res.status(404).json({ message: "City not found" });
      }
      const content = await storage.getCityContent(city.id);
      res.json({ ...city, content });
    } catch (error) {
      console.error("Error fetching city:", error);
      res.status(500).json({ message: "Failed to fetch city" });
    }
  });

  // Protected routes - Admin
  app.post('/api/admin/cities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Simple admin check - in production you'd have proper role-based auth
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cityData = insertCitySchema.parse(req.body);
      const city = await storage.createCity(cityData);
      res.json(city);
    } catch (error) {
      console.error("Error creating city:", error);
      res.status(400).json({ message: error.message || "Failed to create city" });
    }
  });

  app.post('/api/admin/cities/:cityId/generate-content', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { cityId } = req.params;
      const city = await storage.getCityById(cityId);
      
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      // Generate AI content
      const aiContent = await generateCityContent(city.name + ', ' + city.country);
      
      // Create city content records
      const contentTypes = ['morning', 'afternoon', 'evening'] as const;
      const createdContent = [];

      for (const type of contentTypes) {
        const typeData = aiContent[type];
        const content = await storage.createCityContent({
          cityId: city.id,
          type,
          title: typeData.title,
          description: typeData.description,
          imageUrl: '', // Will be generated separately
          affiliateLink: '',
        });
        createdContent.push(content);
      }

      // Update city with flag
      await storage.updateCity(cityId, { flag: aiContent.flag });

      res.json({
        city: { ...city, flag: aiContent.flag },
        content: createdContent,
        funFact: aiContent.funFact,
      });
    } catch (error) {
      console.error("Error generating content:", error);
      res.status(500).json({ message: error.message || "Failed to generate content" });
    }
  });

  app.put('/api/admin/cities/:cityId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { cityId } = req.params;
      const updateData = req.body;
      
      const updatedCity = await storage.updateCity(cityId, updateData);
      res.json(updatedCity);
    } catch (error) {
      console.error("Error updating city:", error);
      res.status(400).json({ message: error.message || "Failed to update city" });
    }
  });

  app.put('/api/admin/content/:contentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { contentId } = req.params;
      const updateData = req.body;
      
      const updatedContent = await storage.updateCityContent(contentId, updateData);
      res.json(updatedContent);
    } catch (error) {
      console.error("Error updating content:", error);
      res.status(400).json({ message: error.message || "Failed to update content" });
    }
  });

  app.get('/api/admin/cities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cities = await storage.getAllCities();
      res.json(cities);
    } catch (error) {
      console.error("Error fetching admin cities:", error);
      res.status(500).json({ message: "Failed to fetch cities" });
    }
  });

  // Fetch a single city with content for admin editing (any status)
  app.get('/api/admin/cities/:cityId/detail', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { cityId } = req.params;
      const city = await storage.getCityById(cityId);
      if (!city) return res.status(404).json({ message: "City not found" });
      const content = await storage.getCityContent(city.id);
      res.json({ ...city, content });
    } catch (error) {
      console.error("Error fetching city detail:", error);
      res.status(500).json({ message: "Failed to fetch city" });
    }
  });

  // Scheduler status — what's scheduled for tomorrow
  app.get('/api/admin/scheduler/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfTomorrow = new Date(tomorrow);
      startOfTomorrow.setUTCHours(0, 0, 0, 0);
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setUTCHours(23, 59, 59, 999);

      const [scheduledCity] = await db
        .select()
        .from(cities)
        .where(
          sql`${cities.publishDate} >= ${startOfTomorrow} AND ${cities.publishDate} <= ${endOfTomorrow} AND ${cities.status} IN ('scheduled', 'published')`
        );

      if (!scheduledCity) {
        return res.json({ scheduled: false, city: null });
      }

      const content = await storage.getCityContent(scheduledCity.id);
      res.json({ scheduled: true, city: { ...scheduledCity, content } });
    } catch (error) {
      console.error("Error fetching scheduler status:", error);
      res.status(500).json({ message: "Failed to fetch scheduler status" });
    }
  });

  // Manually trigger generation for tomorrow
  app.post('/api/admin/scheduler/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const force = req.body?.force === true;
      const result = await generateTomorrowsCity(force);
      res.json(result);
    } catch (error) {
      console.error("Error triggering generation:", error);
      res.status(500).json({ message: error.message || "Failed to generate" });
    }
  });

  // Manually trigger auto-publish
  app.post('/api/admin/scheduler/publish-now', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const result = await autoPublishScheduledCities();
      res.json(result);
    } catch (error) {
      console.error("Error triggering auto-publish:", error);
      res.status(500).json({ message: error.message || "Failed to publish" });
    }
  });

  // Approve a scheduled city immediately
  app.post('/api/admin/cities/:cityId/approve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { cityId } = req.params;
      const updatedCity = await storage.updateCity(cityId, { status: 'published' });
      res.json(updatedCity);
    } catch (error) {
      console.error("Error approving city:", error);
      res.status(500).json({ message: error.message || "Failed to approve city" });
    }
  });

  // User city interactions
  app.post('/api/cities/:cityId/save', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cityId } = req.params;
      
      await storage.saveCity(userId, cityId);
      res.json({ message: "City saved successfully" });
    } catch (error) {
      console.error("Error saving city:", error);
      res.status(500).json({ message: "Failed to save city" });
    }
  });

  app.delete('/api/cities/:cityId/save', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cityId } = req.params;
      
      await storage.unsaveCity(userId, cityId);
      res.json({ message: "City unsaved successfully" });
    } catch (error) {
      console.error("Error unsaving city:", error);
      res.status(500).json({ message: "Failed to unsave city" });
    }
  });

  app.post('/api/cities/:cityId/share', async (req, res) => {
    try {
      const { cityId } = req.params;
      await storage.incrementCityShares(cityId);
      res.json({ message: "Share recorded" });
    } catch (error) {
      console.error("Error recording share:", error);
      res.status(500).json({ message: "Failed to record share" });
    }
  });

  app.get('/api/user/saved-cities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const savedCities = await storage.getUserSavedCities(userId);
      
      // Fetch city details for each saved city
      const savedCitiesWithDetails = await Promise.all(
        savedCities.map(async (saved) => {
          const city = await storage.getCityById(saved.cityId);
          return {
            ...saved,
            city
          };
        })
      );
      
      res.json(savedCitiesWithDetails);
    } catch (error) {
      console.error("Error fetching saved cities:", error);
      res.status(500).json({ message: "Failed to fetch saved cities" });
    }
  });

  // Travel plans
  app.post('/api/travel-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const planData = insertTravelPlanSchema.parse({ ...req.body, userId });
      
      const plan = await storage.createTravelPlan(planData);
      res.json(plan);
    } catch (error) {
      console.error("Error creating travel plan:", error);
      res.status(400).json({ message: error.message || "Failed to create travel plan" });
    }
  });

  app.get('/api/travel-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const plans = await storage.getUserTravelPlans(userId);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching travel plans:", error);
      res.status(500).json({ message: "Failed to fetch travel plans" });
    }
  });

  app.put('/api/travel-plans/:planId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planId } = req.params;
      
      // Verify ownership
      const plans = await storage.getUserTravelPlans(userId);
      if (!plans.find(p => p.id === planId)) {
        return res.status(403).json({ message: "Not authorized to update this plan" });
      }
      
      const updatedPlan = await storage.updateTravelPlan(planId, req.body);
      res.json(updatedPlan);
    } catch (error) {
      console.error("Error updating travel plan:", error);
      res.status(400).json({ message: error.message || "Failed to update travel plan" });
    }
  });

  app.delete('/api/travel-plans/:planId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planId } = req.params;
      
      // Verify ownership
      const plans = await storage.getUserTravelPlans(userId);
      if (!plans.find(p => p.id === planId)) {
        return res.status(403).json({ message: "Not authorized to delete this plan" });
      }
      
      await storage.deleteTravelPlan(planId);
      res.json({ message: "Travel plan deleted successfully" });
    } catch (error) {
      console.error("Error deleting travel plan:", error);
      res.status(500).json({ message: "Failed to delete travel plan" });
    }
  });

  // User stats
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Analytics (admin only)
  app.get('/api/admin/analytics/cities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const analytics = await storage.getCityAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching city analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get('/api/admin/analytics/revenue', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (!user.email?.includes('admin') && user.email !== 'wordofday2025@gmail.com')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const revenue = await storage.getRevenueStats();
      res.json(revenue);
    } catch (error) {
      console.error("Error fetching revenue analytics:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  // ── Push Notification Routes ──────────────────────────────────────────────

  // Get the VAPID public key (needed by browser to subscribe)
  app.get("/api/push/vapid-key", async (_req, res) => {
    try {
      await initVapid();
      const key = await getVapidPublicKey();
      if (!key) return res.status(503).json({ message: "Push not available yet" });
      res.json({ publicKey: key });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get VAPID key" });
    }
  });

  // Save a push subscription (user opts in)
  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }
      const userId = req.user.claims.sub;
      await db
        .insert(pushSubscriptions)
        .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { userId, p256dh: keys.p256dh, auth: keys.auth },
        });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Push subscribe error:", err.message);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  // Remove a push subscription (user opts out)
  app.post("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ message: "Missing endpoint" });
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
