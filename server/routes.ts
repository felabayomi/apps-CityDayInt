import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateCityContent, generateImageUrl, textToSpeech } from "./openai";
import { generateTomorrowsCity, autoPublishScheduledCities } from "./scheduler";
import { insertCitySchema, insertCityContentSchema, insertTravelPlanSchema, pushSubscriptions } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { cities } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { getVapidPublicKey, initVapid } from "./webpush";
import { ensureCityDayIntCompatibility } from "./dbCompat";

const INTERNATIONAL_CITY_SQL = sql`
  ${cities.appScope} = 'citydayint'
  AND
  COALESCE(LOWER(${cities.country}), '') NOT IN ('usa', 'united states', 'united states of america', 'u.s.a', 'u.s.')
  AND ${cities.country} NOT ILIKE '%, USA'
  AND ${cities.country} NOT ILIKE '%, U.S.A.'
`;

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    await ensureCityDayIntCompatibility();
  } catch (error) {
    console.error("[Startup] CityDayInt compatibility migration skipped:", error);
  }

  // Auth middleware
  await setupAuth(app);

  const isCronAuthorized = (req: any) => {
    // Vercel cron requests include x-vercel-cron-schedule and vercel-cron/1.0 user-agent.
    // Keep compatibility with older x-vercel-cron behavior.
    const hasVercelCronHeader = Boolean(
      req.headers["x-vercel-cron"] || req.headers["x-vercel-cron-schedule"]
    );
    const userAgent = String(req.headers["user-agent"] || "").toLowerCase();
    const isVercelCronUserAgent = userAgent.includes("vercel-cron/");
    if (hasVercelCronHeader || isVercelCronUserAgent) {
      return true;
    }

    const configuredSecret = String(process.env.CRON_SECRET || "").trim();
    if (!configuredSecret) {
      return false;
    }

    const authHeader = String(req.headers["authorization"] || "").trim();
    if (authHeader === `Bearer ${configuredSecret}`) {
      return true;
    }

    const providedSecret =
      String(req.headers["x-cron-secret"] || req.query?.secret || "").trim();
    return providedSecret === configuredSecret;
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      res.json({
        id: req.user?.claims?.sub,
        email: req.user?.email,
        isAdmin: Boolean(req.user?.isAdmin),
        isPremium: false,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Cron routes (serverless-safe replacement for in-process node-cron in production)
  app.get('/api/cron/generate-tomorrow', async (req: any, res) => {
    try {
      if (!isCronAuthorized(req)) {
        return res.status(401).json({ message: 'Unauthorized cron invocation' });
      }

      const result = await generateTomorrowsCity();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      console.error('[Cron] generate-tomorrow failed:', error);
      res.status(500).json({ message: error?.message || 'Cron generation failed' });
    }
  });

  app.get('/api/cron/auto-publish', async (req: any, res) => {
    try {
      if (!isCronAuthorized(req)) {
        return res.status(401).json({ message: 'Unauthorized cron invocation' });
      }

      const result = await autoPublishScheduledCities();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      console.error('[Cron] auto-publish failed:', error);
      res.status(500).json({ message: error?.message || 'Cron publish failed' });
    }
  });

  // ── TTS: Admin-only voice generation ──────────────────────────────────────
  app.post('/api/tts/:cityId', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { cityId } = req.params;
      const city = await storage.getCityById(cityId);
      if (!city) return res.status(404).json({ message: "City not found" });

      // Return cached audio instantly
      if ((city as any).audioUrl) {
        const base64Data = ((city as any).audioUrl as string).replace('data:audio/mpeg;base64,', '');
        const buffer = Buffer.from(base64Data, 'base64');
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', buffer.length.toString());
        return res.send(buffer);
      }

      // Build narration text from city + content
      const content = await storage.getCityContent(cityId);
      const contentParts = content.map((c: any) => {
        const label = c.type === 'morning' ? 'Morning Discovery'
          : c.type === 'afternoon' ? 'Afternoon Experience'
            : 'Evening Insight';
        return `${label}: ${c.title}. ${c.description}`;
      });

      const fullText = [
        `Welcome to Daily Felix — City of the Day!`,
        `Today we explore ${city.name}, ${city.country}.`,
        city.funFact ? `Fun fact: ${city.funFact}` : null,
        ...contentParts,
      ].filter(Boolean).join('\n\n');

      // Generate TTS audio
      console.log(`[TTS] Generating audio for ${city.name} (${cityId})`);
      const audioBuffer = await textToSpeech(fullText);

      // Cache as base64
      const base64 = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
      await storage.updateCity(cityId, { audioUrl: base64 } as any);

      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error: any) {
      console.error('[TTS] Error:', error.message);
      res.status(500).json({ message: error.message || 'TTS generation failed' });
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

  // Get recent cities - all published cities are visible to everyone - must be before /:cityId
  app.get('/api/cities/recent', async (req: any, res) => {
    try {
      const cities = await storage.getRecentCities(50);
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
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { cityId } = req.params;
      const rawData = req.body;

      // Sanitize update payload — convert publishDate string → Date, strip undefined
      const updateData: Record<string, any> = {};
      if (rawData.name !== undefined) updateData.name = rawData.name;
      if (rawData.country !== undefined) updateData.country = rawData.country;
      if (rawData.region !== undefined) updateData.region = rawData.region;
      if (rawData.flag !== undefined) updateData.flag = rawData.flag;
      if (rawData.funFact !== undefined) updateData.funFact = rawData.funFact;
      if (rawData.status !== undefined) updateData.status = rawData.status;
      if (rawData.slug !== undefined) updateData.slug = rawData.slug;
      if (rawData.publishDate !== undefined && rawData.publishDate !== null && rawData.publishDate !== '') {
        const d = new Date(rawData.publishDate);
        if (!isNaN(d.getTime())) updateData.publishDate = d;
      }

      const updatedCity = await storage.updateCity(cityId, updateData);
      if (!updatedCity) {
        return res.status(404).json({ message: "City not found" });
      }
      res.json(updatedCity);
    } catch (error: any) {
      console.error("Error updating city:", error);
      res.status(400).json({ message: error.message || "Failed to update city" });
    }
  });

  app.put('/api/admin/content/:contentId', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
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
          sql`${cities.publishDate} >= ${startOfTomorrow} AND ${cities.publishDate} <= ${endOfTomorrow} AND ${cities.status} IN ('scheduled', 'published') AND ${INTERNATIONAL_CITY_SQL}`
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
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const result = await autoPublishScheduledCities();
      res.json(result);
    } catch (error) {
      console.error("Error triggering auto-publish:", error);
      res.status(500).json({ message: error.message || "Failed to publish" });
    }
  });

  // Admin: list all users
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: toggle premium for a user
  app.post('/api/admin/users/:targetUserId/premium', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { isPremium } = req.body;
      const updated = await storage.setUserPremium(req.params.targetUserId, !!isPremium);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Approve a scheduled city immediately
  app.post('/api/admin/cities/:cityId/approve', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) {
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

  // ─── Server-to-Server Integration (plan.citydiscoverer.ai) ────────────────
  // Auth: Authorization: Bearer <INTEGRATION_API_KEY>
  // All routes accept a `userId` (Replit user ID) in the request body/params.

  const verifyIntegrationKey = (req: any, res: any, next: any) => {
    const auth = req.headers.authorization || '';
    const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!process.env.INTEGRATION_API_KEY || key !== process.env.INTEGRATION_API_KEY) {
      return res.status(401).json({ message: "Invalid or missing integration API key" });
    }
    next();
  };

  // GET /api/integration/plans?userId=xxx  — fetch all plans for a user
  app.get('/api/integration/plans', verifyIntegrationKey, async (req: any, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const plans = await storage.getUserTravelPlans(userId as string);
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch plans" });
    }
  });

  // POST /api/integration/plans  — create a plan for a user
  app.post('/api/integration/plans', verifyIntegrationKey, async (req: any, res) => {
    try {
      const { userId, name, status, duration, budget } = req.body;
      if (!userId || !name) return res.status(400).json({ message: "userId and name are required" });
      const plan = await storage.createTravelPlan({ userId, name, status: status || 'draft', duration, budget });
      res.status(201).json(plan);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create plan" });
    }
  });

  // PUT /api/integration/plans/:planId  — update a plan
  app.put('/api/integration/plans/:planId', verifyIntegrationKey, async (req: any, res) => {
    try {
      const { planId } = req.params;
      const { name, status, duration, budget } = req.body;
      const updated = await storage.updateTravelPlan(planId, { name, status, duration, budget });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update plan" });
    }
  });

  // DELETE /api/integration/plans/:planId  — delete a plan
  app.delete('/api/integration/plans/:planId', verifyIntegrationKey, async (req: any, res) => {
    try {
      const { planId } = req.params;
      await storage.deleteTravelPlan(planId);
      res.json({ message: "Plan deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete plan" });
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

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
      if (!req.user?.isAdmin) {
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
      if (!req.user?.isAdmin) {
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


