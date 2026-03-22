import cron from "node-cron";
import { storage } from "./storage";
import { generateCityContent } from "./openai";
import { db } from "./db";
import { cities } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// 100+ popular international tourist destinations to rotate through
const DESTINATION_POOL = [
  // Europe
  { name: "Paris", country: "France", region: "Europe" },
  { name: "Rome", country: "Italy", region: "Europe" },
  { name: "Barcelona", country: "Spain", region: "Europe" },
  { name: "Amsterdam", country: "Netherlands", region: "Europe" },
  { name: "Prague", country: "Czech Republic", region: "Europe" },
  { name: "Vienna", country: "Austria", region: "Europe" },
  { name: "Santorini", country: "Greece", region: "Europe" },
  { name: "Dubrovnik", country: "Croatia", region: "Europe" },
  { name: "Edinburgh", country: "Scotland", region: "Europe" },
  { name: "Lisbon", country: "Portugal", region: "Europe" },
  { name: "Budapest", country: "Hungary", region: "Europe" },
  { name: "Copenhagen", country: "Denmark", region: "Europe" },
  { name: "Stockholm", country: "Sweden", region: "Europe" },
  { name: "Bruges", country: "Belgium", region: "Europe" },
  { name: "Florence", country: "Italy", region: "Europe" },
  { name: "Venice", country: "Italy", region: "Europe" },
  { name: "Athens", country: "Greece", region: "Europe" },
  { name: "Reykjavik", country: "Iceland", region: "Europe" },
  { name: "Porto", country: "Portugal", region: "Europe" },
  { name: "Seville", country: "Spain", region: "Europe" },
  { name: "Zurich", country: "Switzerland", region: "Europe" },
  { name: "Munich", country: "Germany", region: "Europe" },
  { name: "Berlin", country: "Germany", region: "Europe" },
  { name: "Madrid", country: "Spain", region: "Europe" },
  { name: "London", country: "United Kingdom", region: "Europe" },
  { name: "Dublin", country: "Ireland", region: "Europe" },
  { name: "Oslo", country: "Norway", region: "Europe" },
  { name: "Tallinn", country: "Estonia", region: "Europe" },
  { name: "Valletta", country: "Malta", region: "Europe" },
  { name: "Monaco", country: "Monaco", region: "Europe" },

  // Asia
  { name: "Tokyo", country: "Japan", region: "Asia" },
  { name: "Kyoto", country: "Japan", region: "Asia" },
  { name: "Bali", country: "Indonesia", region: "Asia" },
  { name: "Bangkok", country: "Thailand", region: "Asia" },
  { name: "Singapore", country: "Singapore", region: "Asia" },
  { name: "Hong Kong", country: "China", region: "Asia" },
  { name: "Hanoi", country: "Vietnam", region: "Asia" },
  { name: "Ho Chi Minh City", country: "Vietnam", region: "Asia" },
  { name: "Chiang Mai", country: "Thailand", region: "Asia" },
  { name: "Kathmandu", country: "Nepal", region: "Asia" },
  { name: "Colombo", country: "Sri Lanka", region: "Asia" },
  { name: "Luang Prabang", country: "Laos", region: "Asia" },
  { name: "Siem Reap", country: "Cambodia", region: "Asia" },
  { name: "Osaka", country: "Japan", region: "Asia" },
  { name: "Seoul", country: "South Korea", region: "Asia" },
  { name: "Taipei", country: "Taiwan", region: "Asia" },
  { name: "Kuala Lumpur", country: "Malaysia", region: "Asia" },
  { name: "Shanghai", country: "China", region: "Asia" },
  { name: "Beijing", country: "China", region: "Asia" },
  { name: "Mumbai", country: "India", region: "Asia" },
  { name: "Jaipur", country: "India", region: "Asia" },
  { name: "Udaipur", country: "India", region: "Asia" },
  { name: "Istanbul", country: "Turkey", region: "Asia" },
  { name: "Muscat", country: "Oman", region: "Asia" },
  { name: "Dubai", country: "UAE", region: "Asia" },
  { name: "Petra", country: "Jordan", region: "Asia" },
  { name: "Tbilisi", country: "Georgia", region: "Asia" },
  { name: "Yerevan", country: "Armenia", region: "Asia" },

  // Americas
  { name: "New York City", country: "USA", region: "Americas" },
  { name: "San Francisco", country: "USA", region: "Americas" },
  { name: "New Orleans", country: "USA", region: "Americas" },
  { name: "Chicago", country: "USA", region: "Americas" },
  { name: "Miami", country: "USA", region: "Americas" },
  { name: "Havana", country: "Cuba", region: "Americas" },
  { name: "Mexico City", country: "Mexico", region: "Americas" },
  { name: "Oaxaca", country: "Mexico", region: "Americas" },
  { name: "Cartagena", country: "Colombia", region: "Americas" },
  { name: "Buenos Aires", country: "Argentina", region: "Americas" },
  { name: "Rio de Janeiro", country: "Brazil", region: "Americas" },
  { name: "Lima", country: "Peru", region: "Americas" },
  { name: "Cusco", country: "Peru", region: "Americas" },
  { name: "Medellín", country: "Colombia", region: "Americas" },
  { name: "Bogotá", country: "Colombia", region: "Americas" },
  { name: "Santiago", country: "Chile", region: "Americas" },
  { name: "Montevideo", country: "Uruguay", region: "Americas" },
  { name: "Quebec City", country: "Canada", region: "Americas" },
  { name: "Vancouver", country: "Canada", region: "Americas" },
  { name: "Montreal", country: "Canada", region: "Americas" },
  { name: "San José", country: "Costa Rica", region: "Americas" },
  { name: "Panama City", country: "Panama", region: "Americas" },
  { name: "Quito", country: "Ecuador", region: "Americas" },

  // Africa & Middle East
  { name: "Marrakech", country: "Morocco", region: "Africa" },
  { name: "Cape Town", country: "South Africa", region: "Africa" },
  { name: "Cairo", country: "Egypt", region: "Africa" },
  { name: "Nairobi", country: "Kenya", region: "Africa" },
  { name: "Zanzibar", country: "Tanzania", region: "Africa" },
  { name: "Fez", country: "Morocco", region: "Africa" },
  { name: "Casablanca", country: "Morocco", region: "Africa" },
  { name: "Accra", country: "Ghana", region: "Africa" },
  { name: "Addis Ababa", country: "Ethiopia", region: "Africa" },
  { name: "Tel Aviv", country: "Israel", region: "Africa" },
  { name: "Jerusalem", country: "Israel", region: "Africa" },

  // Oceania
  { name: "Sydney", country: "Australia", region: "Oceania" },
  { name: "Melbourne", country: "Australia", region: "Oceania" },
  { name: "Auckland", country: "New Zealand", region: "Oceania" },
  { name: "Queenstown", country: "New Zealand", region: "Oceania" },
  { name: "Fiji", country: "Fiji", region: "Oceania" },
  { name: "Honolulu", country: "USA", region: "Oceania" },
  { name: "Papeete", country: "French Polynesia", region: "Oceania" },
  { name: "Cairns", country: "Australia", region: "Oceania" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Get tomorrow's date at 9am EST (14:00 UTC)
function getTomorrowPublishDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(14, 0, 0, 0); // 9am EST = 14:00 UTC
  return tomorrow;
}

async function getUsedCityNames(): Promise<Set<string>> {
  const allCities = await storage.getAllCities();
  return new Set(allCities.map((c) => c.name.toLowerCase()));
}

function pickNextCity(usedNames: Set<string>): typeof DESTINATION_POOL[0] | null {
  const available = DESTINATION_POOL.filter(
    (d) => !usedNames.has(d.name.toLowerCase())
  );
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

async function hasCityScheduledForTomorrow(): Promise<boolean> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow);
  startOfTomorrow.setUTCHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(tomorrow);
  endOfTomorrow.setUTCHours(23, 59, 59, 999);

  const [existing] = await db
    .select()
    .from(cities)
    .where(
      sql`${cities.publishDate} >= ${startOfTomorrow} AND ${cities.publishDate} <= ${endOfTomorrow} AND ${cities.status} IN ('scheduled', 'published')`
    );

  return !!existing;
}

export async function generateTomorrowsCity(): Promise<{ success: boolean; message: string; city?: any }> {
  try {
    console.log("[Scheduler] Checking if tomorrow already has a city...");
    const alreadyScheduled = await hasCityScheduledForTomorrow();

    if (alreadyScheduled) {
      console.log("[Scheduler] Tomorrow already has a city scheduled. Skipping.");
      return { success: true, message: "Tomorrow already has a city scheduled." };
    }

    const usedNames = await getUsedCityNames();
    const destination = pickNextCity(usedNames);

    if (!destination) {
      console.log("[Scheduler] All destinations have been used. Resetting pool is needed.");
      return { success: false, message: "All destinations exhausted. Please reset or expand the pool." };
    }

    console.log(`[Scheduler] Generating content for ${destination.name}, ${destination.country}...`);

    const aiContent = await generateCityContent(`${destination.name}, ${destination.country}`);

    const publishDate = getTomorrowPublishDate();
    const slug = slugify(destination.name);

    const city = await storage.createCity({
      name: destination.name,
      country: destination.country,
      region: destination.region,
      slug,
      flag: aiContent.flag,
      publishDate,
      status: "scheduled",
      funFact: aiContent.funFact,
    });

    for (const type of ["morning", "afternoon", "evening"] as const) {
      await storage.createCityContent({
        cityId: city.id,
        type,
        title: aiContent[type].title,
        description: aiContent[type].description,
        imageUrl: "",
        affiliateLink: "",
      });
    }

    console.log(`[Scheduler] Successfully scheduled ${destination.name} for tomorrow.`);
    return { success: true, message: `${destination.name} scheduled for tomorrow.`, city };
  } catch (error: any) {
    console.error("[Scheduler] Generation failed:", error.message);
    return { success: false, message: error.message };
  }
}

export async function autoPublishScheduledCities(): Promise<{ published: string[] }> {
  try {
    const now = new Date();
    console.log(`[Scheduler] Running auto-publish check at ${now.toISOString()}`);

    const [updated] = await db
      .update(cities)
      .set({ status: "published", updatedAt: now })
      .where(
        sql`${cities.status} = 'scheduled' AND ${cities.publishDate} <= ${now}`
      )
      .returning({ name: cities.name });

    const publishedNames = updated ? [updated.name] : [];
    console.log(`[Scheduler] Auto-published: ${publishedNames.join(", ") || "none"}`);
    return { published: publishedNames };
  } catch (error: any) {
    console.error("[Scheduler] Auto-publish failed:", error.message);
    return { published: [] };
  }
}

export function startScheduler() {
  // On startup: always check if tomorrow needs a city and if any cities need publishing
  setTimeout(async () => {
    console.log("[Scheduler] Startup check: ensuring tomorrow has a city...");
    const result = await generateTomorrowsCity();
    console.log(`[Scheduler] Startup check result: ${result.message}`);
    // Also auto-publish any scheduled cities that are now due
    await autoPublishScheduledCities();
  }, 3000); // small delay so DB is ready

  // Generate tomorrow's city at 2pm EST (19:00 UTC) every day
  cron.schedule("0 19 * * *", async () => {
    console.log("[Scheduler] Daily generation job triggered");
    await generateTomorrowsCity();
  }, { timezone: "UTC" });

  // Auto-publish at 9am EST (14:00 UTC) every day
  cron.schedule("0 14 * * *", async () => {
    console.log("[Scheduler] Daily auto-publish job triggered");
    await autoPublishScheduledCities();
  }, { timezone: "UTC" });

  console.log("[Scheduler] Started — generate at 2pm EST, auto-publish at 9am EST next day");
}
