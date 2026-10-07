import cron from "node-cron";
import { storage } from "./storage";
import { generateCityContent, selectInternationalTravelDestination, type TravelDestination } from "./openai";
import { db } from "./db";
import { cities } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { sendPushToAll, initVapid } from "./webpush";

const INTERNATIONAL_CITY_SQL = sql`
  ${cities.appScope} = 'citydayint'
  AND
  COALESCE(LOWER(${cities.country}), '') NOT IN ('usa', 'united states', 'united states of america', 'u.s.a', 'u.s.')
  AND ${cities.country} NOT ILIKE '%, USA'
  AND ${cities.country} NOT ILIKE '%, U.S.A.'
`;

const isUsCountryName = (country: string) => {
  const normalized = String(country || "").trim().toLowerCase();
  return ["usa", "united states", "united states of america", "u.s.a", "u.s."].includes(normalized);
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EASTERN_TIME_ZONE = "America/New_York";

function getEasternDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getEasternUtcOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );

  return asUtc - date.getTime();
}

function easternDateTimeToUtc(
  dateString: string,
  hour: number,
  minute = 0
): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Probe the target date so DST is handled automatically.
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = getEasternUtcOffsetMs(probe);

  return new Date(wallClockAsUtc - offset);
}

function getTodayEasternDate(): string {
  return getEasternDateString();
}

function getTomorrowEasternDate(): string {
  return addDaysToDateString(getTodayEasternDate(), 1);
}

function getTomorrowPublishDate(): Date {
  return easternDateTimeToUtc(getTomorrowEasternDate(), 9);
}
async function hasCityForToday(): Promise<boolean> {
  const todayEastern = getTodayEasternDate();

  const [existing] = await db
    .select()
    .from(cities)
    .where(
      sql`(${cities.publishDate} AT TIME ZONE 'America/New_York')::date = ${todayEastern}::date
          AND ${cities.status} IN ('scheduled', 'published')
          AND ${INTERNATIONAL_CITY_SQL}`
    )
    .limit(1);

  return !!existing;
}
async function generateAndPublishTodaysCity(): Promise<void> {
  try {
    console.log("[Scheduler] Today has no city — generating and publishing one now...");
    const destination = await pickNextDestination();

    if (!destination) {
      console.log("[Scheduler] No eligible destination is available for today's city.");
      return;
    }

    console.log(`[Scheduler] Generating today's city: ${destination.name}, ${destination.country}...`);
    const aiContent = await generateCityContent(`${destination.name}, ${destination.country}`);

    const now = new Date();
    const slug = slugify(destination.name);

    const city = await storage.createCity({
      name: destination.name,
      country: destination.country,
      region: destination.region,
      slug,
      flag: aiContent.flag,
      publishDate: now,
      status: "published",
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

    console.log(`[Scheduler] Today's city published: ${destination.name}, ${destination.country}`);

    try {
      await sendPushToAll({
        title: "Today's city is live!",
        body: `Explore ${destination.name}, ${destination.country} — your daily travel inspiration is ready.`,
        url: "/",
      });
    } catch (pushErr: any) {
      console.error("[Scheduler] Push notification for today's city failed:", pushErr.message);
    }
  } catch (error: any) {
    console.error("[Scheduler] Failed to generate today's city:", error.message);
  }
}

async function getUsedDestinationNames(): Promise<string[]> {
  const allCities = await storage.getAllCities();

  return Array.from(
    new Set(
      allCities
        .filter(
          (city) =>
            city.appScope === "citydayint" &&
            !isUsCountryName(city.country || "")
        )
        .map((city) => city.name?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );
}

async function pickNextDestination(): Promise<TravelDestination | null> {
  const usedNames = await getUsedDestinationNames();
  const normalizedUsed = new Set(
    usedNames.map((name) => name.toLowerCase())
  );

  // AI proposes a real international travel destination.
  // The server independently verifies that it has never been featured.
  // Retry a few times rather than ever intentionally recycling a destination.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const destination =
        await selectInternationalTravelDestination(usedNames);

      const normalizedName = destination.name.trim().toLowerCase();

      if (normalizedUsed.has(normalizedName)) {
        console.warn(
          `[Scheduler] AI proposed already-featured destination "${destination.name}" on attempt ${attempt}. Retrying...`
        );
        continue;
      }

      if (isUsCountryName(destination.country)) {
        console.warn(
          `[Scheduler] AI proposed U.S. destination "${destination.name}, ${destination.country}" on attempt ${attempt}. Retrying...`
        );
        continue;
      }

      console.log(
        `[Scheduler] Selected new international travel destination: ${destination.name}, ${destination.country}`
      );

      return destination;
    } catch (error: any) {
      console.warn(
        `[Scheduler] Destination selection attempt ${attempt} failed: ${error.message}`
      );
    }
  }

  console.error(
    "[Scheduler] Could not select a new international travel destination after 5 attempts."
  );

  return null;
}
async function hasCityScheduledForTomorrow(): Promise<boolean> {
  const tomorrowEastern = getTomorrowEasternDate();

  const [existing] = await db
    .select()
    .from(cities)
    .where(
      sql`(${cities.publishDate} AT TIME ZONE 'America/New_York')::date = ${tomorrowEastern}::date
          AND ${cities.status} IN ('scheduled', 'published')
          AND ${INTERNATIONAL_CITY_SQL}`
    )
    .limit(1);

  return !!existing;
}
export async function generateTomorrowsCity(force = false): Promise<{ success: boolean; message: string; city?: any }> {
  try {
    console.log("[Scheduler] Checking if tomorrow already has a city...");
    const alreadyScheduled = await hasCityScheduledForTomorrow();

    if (alreadyScheduled) {
      if (!force) {
        console.log("[Scheduler] Tomorrow already has a city scheduled. Skipping.");
        return { success: true, message: "Tomorrow already has a city scheduled." };
      }
      // Force mode: delete the existing scheduled city and regenerate
      console.log("[Scheduler] Force regenerate — deleting existing scheduled city for tomorrow...");
      const tomorrowEastern = getTomorrowEasternDate();

      await db.delete(cities).where(
        sql`(${cities.publishDate} AT TIME ZONE 'America/New_York')::date = ${tomorrowEastern}::date
            AND ${cities.status} IN ('scheduled', 'published')
            AND ${INTERNATIONAL_CITY_SQL}`
      );
      console.log("[Scheduler] Deleted. Proceeding with fresh generation...");
    }

    const destination = await pickNextDestination();

    if (!destination) {
      console.log("[Scheduler] No eligible destination is available.");
      return { success: false, message: "No eligible destination is available." };
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

    const published = await db
      .update(cities)
      .set({ status: "published", updatedAt: now })
      .where(
        sql`${cities.status} = 'scheduled' AND ${cities.publishDate} <= ${now} AND ${INTERNATIONAL_CITY_SQL}`
      )
      .returning({ name: cities.name, country: cities.country });

    const publishedNames = published.map((c) => c.name);
    console.log(`[Scheduler] Auto-published: ${publishedNames.join(", ") || "none"}`);

    // Self-heal after missed runs: ensure there is always a live city for today.
    const todayExists = await hasCityForToday();
    if (!todayExists) {
      console.log("[Scheduler] No city found for today after auto-publish. Generating one now...");
      await generateAndPublishTodaysCity();
    }

    // Send push notification for each newly published city
    for (const city of published) {
      try {
        await sendPushToAll({
          title: "Today's city is live!",
          body: `Explore ${city.name}, ${city.country} — your daily travel inspiration is ready.`,
          url: "/",
        });
        console.log(`[Scheduler] Push sent for ${city.name}`);
      } catch (pushErr: any) {
        console.error("[Scheduler] Push notification failed:", pushErr.message);
      }
    }

    return { published: publishedNames };
  } catch (error: any) {
    console.error("[Scheduler] Auto-publish failed:", error.message);
    return { published: [] };
  }
}

export function startScheduler() {
  // On startup: initialize VAPID keys, ensure today has a live city, then ensure tomorrow is queued
  setTimeout(async () => {
    await initVapid();

    // 1. If today has no city at all, generate and publish one immediately
    const todayExists = await hasCityForToday();
    if (!todayExists) {
      await generateAndPublishTodaysCity();
    } else {
      // 2. Today exists but might still be in "scheduled" state — publish if due
      await autoPublishScheduledCities();
    }

    // 3. Ensure tomorrow is queued
    console.log("[Scheduler] Startup check: ensuring tomorrow has a city...");
    const result = await generateTomorrowsCity();
    console.log(`[Scheduler] Startup check result: ${result.message}`);
  }, 3000); // small delay so DB is ready

  // Generate tomorrow's city at 3 PM America/New_York every day
  cron.schedule("0 15 * * *", async () => {
    console.log("[Scheduler] Daily generation job triggered");
    await generateTomorrowsCity();
  }, { timezone: EASTERN_TIME_ZONE });

  // Auto-publish at 9 AM America/New_York every day
  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Daily auto-publish job triggered");
    await autoPublishScheduledCities();
  }, { timezone: EASTERN_TIME_ZONE });

  // Evening reminder at 7 PM America/New_York — remind users to read today's city
  cron.schedule("0 19 * * *", async () => {
    console.log("[Scheduler] Evening reminder push triggered");
    try {
      const todayCity = await storage.getTodaysCity();
      if (todayCity) {
        await sendPushToAll({
          title: "Don't miss today's city!",
          body: `Have you explored ${todayCity.name}, ${todayCity.country} yet? A new city takes over tomorrow.`,
          url: "/",
        });
      }
    } catch (err: any) {
      console.error("[Scheduler] Evening reminder push failed:", err.message);
    }
  }, { timezone: EASTERN_TIME_ZONE });

  console.log("[Scheduler] Started — generate at 3 PM Eastern, auto-publish at 9 AM Eastern");
}
