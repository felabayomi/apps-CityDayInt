import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isPremium: boolean("is_premium").default(false),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cities table
export const cities = pgTable("cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appScope: varchar("app_scope"),
  slug: varchar("slug").unique(),
  name: varchar("name").notNull(),
  country: varchar("country").notNull(),
  region: varchar("region"), // Europe, Asia, Americas, etc.
  flag: varchar("flag"),
  publishDate: timestamp("publish_date").notNull(),
  status: varchar("status").notNull().default('draft'), // draft, published, scheduled
  views: integer("views").default(0),
  saves: integer("saves").default(0),
  shares: integer("shares").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default('0.00'),
  funFact: text("fun_fact"),
  tags: text("tags").array(),
  deepDiveMarkdown: text("deep_dive_markdown"), // Premium content
  miniItineraryMd: text("mini_itinerary_md"), // Premium content
  audioUrl: text("audio_url"), // Cached TTS audio as base64 data URL
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// City content for the three-card system
export const cityContent = pgTable("city_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").references(() => cities.id, { onDelete: 'cascade' }).notNull(),
  type: varchar("type").notNull(), // 'morning', 'afternoon', 'evening'
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  imageUrl: varchar("image_url"),
  affiliateLink: varchar("affiliate_link"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User saved cities
export const userSavedCities = pgTable("user_saved_cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  cityId: varchar("city_id").references(() => cities.id, { onDelete: 'cascade' }).notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
});

// User travel plans
export const travelPlans = pgTable("travel_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name").notNull(),
  status: varchar("status").notNull().default('draft'), // draft, active, completed
  duration: varchar("duration"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Travel plan cities
export const travelPlanCities = pgTable("travel_plan_cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  travelPlanId: varchar("travel_plan_id").references(() => travelPlans.id, { onDelete: 'cascade' }).notNull(),
  cityId: varchar("city_id").references(() => cities.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// App-wide settings (for storing VAPID keys, etc.)
export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  savedCities: many(userSavedCities),
  travelPlans: many(travelPlans),
}));

export const citiesRelations = relations(cities, ({ many, one }) => ({
  content: many(cityContent),
  userSaves: many(userSavedCities),
  planCities: many(travelPlanCities),
}));

export const cityContentRelations = relations(cityContent, ({ one }) => ({
  city: one(cities, {
    fields: [cityContent.cityId],
    references: [cities.id],
  }),
}));

export const userSavedCitiesRelations = relations(userSavedCities, ({ one }) => ({
  user: one(users, {
    fields: [userSavedCities.userId],
    references: [users.id],
  }),
  city: one(cities, {
    fields: [userSavedCities.cityId],
    references: [cities.id],
  }),
}));

export const travelPlansRelations = relations(travelPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [travelPlans.userId],
    references: [users.id],
  }),
  cities: many(travelPlanCities),
}));

export const travelPlanCitiesRelations = relations(travelPlanCities, ({ one }) => ({
  travelPlan: one(travelPlans, {
    fields: [travelPlanCities.travelPlanId],
    references: [travelPlans.id],
  }),
  city: one(cities, {
    fields: [travelPlanCities.cityId],
    references: [cities.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCitySchema = createInsertSchema(cities).omit({
  id: true,
  views: true,
  saves: true,
  shares: true,
  revenue: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCityContentSchema = createInsertSchema(cityContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTravelPlanSchema = createInsertSchema(travelPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type City = typeof cities.$inferSelect;
export type InsertCity = z.infer<typeof insertCitySchema>;
export type CityContent = typeof cityContent.$inferSelect;
export type InsertCityContent = z.infer<typeof insertCityContentSchema>;
export type TravelPlan = typeof travelPlans.$inferSelect;
export type InsertTravelPlan = z.infer<typeof insertTravelPlanSchema>;
export type UserSavedCity = typeof userSavedCities.$inferSelect;
