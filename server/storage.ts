import {
  users,
  cities,
  cityContent,
  userSavedCities,
  travelPlans,
  travelPlanCities,
  type User,
  type UpsertUser,
  type City,
  type InsertCity,
  type CityContent,
  type InsertCityContent,
  type TravelPlan,
  type InsertTravelPlan,
  type UserSavedCity,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

const internationalCityWhereSql = sql`
  COALESCE(LOWER(${cities.country}), '') NOT IN ('usa', 'united states', 'united states of america', 'u.s.a', 'u.s.')
  AND ${cities.country} NOT ILIKE '%, USA'
  AND ${cities.country} NOT ILIKE '%, U.S.A.'
`;

// Interface for storage operations
export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // City operations
  createCity(city: InsertCity): Promise<City>;
  updateCity(id: string, city: Partial<InsertCity>): Promise<City>;
  getCityById(id: string): Promise<City | undefined>;
  getCityByDate(date: Date): Promise<City | undefined>;
  getTodaysCity(): Promise<City | undefined>;
  getRecentCities(limit?: number): Promise<City[]>;
  getAllCities(): Promise<City[]>;
  incrementCityViews(cityId: string): Promise<void>;
  incrementCitySaves(cityId: string): Promise<void>;
  incrementCityShares(cityId: string): Promise<void>;

  // City content operations
  createCityContent(content: InsertCityContent): Promise<CityContent>;
  updateCityContent(id: string, content: Partial<InsertCityContent>): Promise<CityContent>;
  getCityContent(cityId: string): Promise<CityContent[]>;
  deleteCityContent(id: string): Promise<void>;

  // User saved cities
  saveCity(userId: string, cityId: string): Promise<void>;
  unsaveCity(userId: string, cityId: string): Promise<void>;
  getUserSavedCities(userId: string): Promise<UserSavedCity[]>;
  isCitySavedByUser(userId: string, cityId: string): Promise<boolean>;

  // Travel plans
  createTravelPlan(plan: InsertTravelPlan): Promise<TravelPlan>;
  updateTravelPlan(id: string, plan: Partial<InsertTravelPlan>): Promise<TravelPlan>;
  getUserTravelPlans(userId: string): Promise<TravelPlan[]>;
  deleteTravelPlan(id: string): Promise<void>;
  addCityToTravelPlan(travelPlanId: string, cityId: string, orderIndex: number): Promise<void>;
  removeCityFromTravelPlan(travelPlanId: string, cityId: string): Promise<void>;

  // Analytics
  getCityAnalytics(): Promise<any[]>;
  getUserStats(userId: string): Promise<any>;
  getRevenueStats(): Promise<any>;

  // Admin user management
  getAllUsers(): Promise<User[]>;
  setUserPremium(userId: string, isPremium: boolean): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async setUserPremium(userId: string, isPremium: boolean): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ isPremium, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // City operations
  async createCity(city: InsertCity): Promise<City> {
    const [newCity] = await db.insert(cities).values(city).returning();
    return newCity;
  }

  async updateCity(id: string, city: Partial<InsertCity>): Promise<City> {
    const [updatedCity] = await db
      .update(cities)
      .set({ ...city, updatedAt: new Date() })
      .where(and(eq(cities.id, id), internationalCityWhereSql))
      .returning();
    return updatedCity;
  }

  async getCityById(id: string): Promise<City | undefined> {
    const [city] = await db
      .select()
      .from(cities)
      .where(and(eq(cities.id, id), internationalCityWhereSql));
    return city;
  }

  async getCityByDate(date: Date): Promise<City | undefined> {
    // Use UTC date boundaries to avoid timezone issues on Vercel (always UTC)
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const startOfDay = new Date(Date.UTC(utcYear, utcMonth, utcDay, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(utcYear, utcMonth, utcDay, 23, 59, 59, 999));

    const [city] = await db
      .select()
      .from(cities)
      .where(
        and(
          eq(cities.status, 'published'),
          sql`${cities.publishDate} >= ${startOfDay} AND ${cities.publishDate} <= ${endOfDay}`,
          internationalCityWhereSql
        )
      );

    // Fallback: return the most recently published city if none matches today exactly
    if (!city) {
      const [latest] = await db
        .select()
        .from(cities)
        .where(and(eq(cities.status, 'published'), internationalCityWhereSql))
        .orderBy(desc(cities.publishDate))
        .limit(1);
      return latest;
    }

    return city;
  }

  async getTodaysCity(): Promise<City | undefined> {
    return this.getCityByDate(new Date());
  }

  async getRecentCities(limit = 10): Promise<City[]> {
    return db
      .select()
      .from(cities)
      .where(and(eq(cities.status, 'published'), internationalCityWhereSql))
      .orderBy(desc(cities.publishDate))
      .limit(limit);
  }

  async getAllCities(): Promise<City[]> {
    return db
      .select()
      .from(cities)
      .where(internationalCityWhereSql)
      .orderBy(desc(cities.createdAt));
  }

  async incrementCityViews(cityId: string): Promise<void> {
    await db
      .update(cities)
      .set({ views: sql`${cities.views} + 1` })
      .where(eq(cities.id, cityId));
  }

  async incrementCitySaves(cityId: string): Promise<void> {
    await db
      .update(cities)
      .set({ saves: sql`${cities.saves} + 1` })
      .where(eq(cities.id, cityId));
  }

  async incrementCityShares(cityId: string): Promise<void> {
    await db
      .update(cities)
      .set({ shares: sql`${cities.shares} + 1` })
      .where(eq(cities.id, cityId));
  }

  // City content operations
  async createCityContent(content: InsertCityContent): Promise<CityContent> {
    const [newContent] = await db.insert(cityContent).values(content).returning();
    return newContent;
  }

  async updateCityContent(id: string, content: Partial<InsertCityContent>): Promise<CityContent> {
    const [updatedContent] = await db
      .update(cityContent)
      .set({ ...content, updatedAt: new Date() })
      .where(eq(cityContent.id, id))
      .returning();
    return updatedContent;
  }

  async getCityContent(cityId: string): Promise<CityContent[]> {
    return db
      .select()
      .from(cityContent)
      .where(eq(cityContent.cityId, cityId))
      .orderBy(sql`
        CASE 
          WHEN type = 'morning' THEN 1
          WHEN type = 'afternoon' THEN 2
          WHEN type = 'evening' THEN 3
          ELSE 4
        END
      `);
  }

  async deleteCityContent(id: string): Promise<void> {
    await db.delete(cityContent).where(eq(cityContent.id, id));
  }

  // User saved cities
  async saveCity(userId: string, cityId: string): Promise<void> {
    await db.insert(userSavedCities).values({ userId, cityId }).onConflictDoNothing();
    await this.incrementCitySaves(cityId);
  }

  async unsaveCity(userId: string, cityId: string): Promise<void> {
    await db
      .delete(userSavedCities)
      .where(and(eq(userSavedCities.userId, userId), eq(userSavedCities.cityId, cityId)));
    await db
      .update(cities)
      .set({ saves: sql`GREATEST(${cities.saves} - 1, 0)` })
      .where(eq(cities.id, cityId));
  }

  async getUserSavedCities(userId: string): Promise<UserSavedCity[]> {
    return db
      .select()
      .from(userSavedCities)
      .where(eq(userSavedCities.userId, userId))
      .orderBy(desc(userSavedCities.savedAt));
  }

  async isCitySavedByUser(userId: string, cityId: string): Promise<boolean> {
    const [saved] = await db
      .select()
      .from(userSavedCities)
      .where(and(eq(userSavedCities.userId, userId), eq(userSavedCities.cityId, cityId)));
    return !!saved;
  }

  // Travel plans
  async createTravelPlan(plan: InsertTravelPlan): Promise<TravelPlan> {
    const [newPlan] = await db.insert(travelPlans).values(plan).returning();
    return newPlan;
  }

  async updateTravelPlan(id: string, plan: Partial<InsertTravelPlan>): Promise<TravelPlan> {
    const [updatedPlan] = await db
      .update(travelPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(eq(travelPlans.id, id))
      .returning();
    return updatedPlan;
  }

  async getUserTravelPlans(userId: string): Promise<TravelPlan[]> {
    return db
      .select()
      .from(travelPlans)
      .where(eq(travelPlans.userId, userId))
      .orderBy(desc(travelPlans.createdAt));
  }

  async deleteTravelPlan(id: string): Promise<void> {
    await db.delete(travelPlans).where(eq(travelPlans.id, id));
  }

  async addCityToTravelPlan(travelPlanId: string, cityId: string, orderIndex: number): Promise<void> {
    await db.insert(travelPlanCities).values({ travelPlanId, cityId, orderIndex });
  }

  async removeCityFromTravelPlan(travelPlanId: string, cityId: string): Promise<void> {
    await db
      .delete(travelPlanCities)
      .where(
        and(
          eq(travelPlanCities.travelPlanId, travelPlanId),
          eq(travelPlanCities.cityId, cityId)
        )
      );
  }

  // Analytics
  async getCityAnalytics(): Promise<any[]> {
    return db
      .select({
        id: cities.id,
        name: cities.name,
        country: cities.country,
        flag: cities.flag,
        views: cities.views,
        saves: cities.saves,
        shares: cities.shares,
        revenue: cities.revenue,
        publishDate: cities.publishDate,
      })
      .from(cities)
      .where(and(eq(cities.status, 'published'), internationalCityWhereSql))
      .orderBy(desc(cities.views));
  }

  async getUserStats(userId: string): Promise<any> {
    const savedCitiesCount = await db
      .select({ count: sql`count(*)` })
      .from(userSavedCities)
      .where(eq(userSavedCities.userId, userId));

    const travelPlansCount = await db
      .select({ count: sql`count(*)` })
      .from(travelPlans)
      .where(eq(travelPlans.userId, userId));

    const user = await this.getUser(userId);
    const daysExploring = user?.createdAt
      ? Math.floor((new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      daysExploring,
      savedCitiesCount: savedCitiesCount[0]?.count || 0,
      travelPlansCount: travelPlansCount[0]?.count || 0,
    };
  }

  async getRevenueStats(): Promise<any> {
    const totalRevenue = await db
      .select({ total: sql`sum(${cities.revenue})` })
      .from(cities)
      .where(and(eq(cities.status, 'published'), internationalCityWhereSql));

    const monthlyRevenue = await db
      .select({ total: sql`sum(${cities.revenue})` })
      .from(cities)
      .where(
        and(
          eq(cities.status, 'published'),
          sql`${cities.publishDate} >= date_trunc('month', current_date)`,
          internationalCityWhereSql
        )
      );

    return {
      totalRevenue: totalRevenue[0]?.total || '0.00',
      monthlyRevenue: monthlyRevenue[0]?.total || '0.00',
    };
  }
}

export const storage = new DatabaseStorage();
