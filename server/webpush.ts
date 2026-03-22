import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

let vapidInitialized = false;

export async function initVapid() {
  if (vapidInitialized) return;

  try {
    // Check if VAPID keys already exist in DB
    const pubRow = await db.select().from(appSettings).where(eq(appSettings.key, "vapid_public_key"));
    const privRow = await db.select().from(appSettings).where(eq(appSettings.key, "vapid_private_key"));

    let publicKey: string;
    let privateKey: string;

    if (pubRow.length > 0 && privRow.length > 0) {
      publicKey = pubRow[0].value;
      privateKey = privRow[0].value;
    } else {
      // Generate new VAPID keys and persist them
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;

      await db.insert(appSettings).values({ key: "vapid_public_key", value: publicKey });
      await db.insert(appSettings).values({ key: "vapid_private_key", value: privateKey });
      console.log("[WebPush] Generated and stored new VAPID keys");
    }

    webpush.setVapidDetails(
      "mailto:wordofday2025@gmail.com",
      publicKey,
      privateKey
    );

    vapidInitialized = true;
    console.log("[WebPush] VAPID initialized");
  } catch (err: any) {
    console.error("[WebPush] Failed to init VAPID:", err.message);
  }
}

export async function getVapidPublicKey(): Promise<string | null> {
  const row = await db.select().from(appSettings).where(eq(appSettings.key, "vapid_public_key"));
  return row.length > 0 ? row[0].value : null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!vapidInitialized) await initVapid();

  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      await webpush.sendNotification(subscription, notification);
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  const succeeded = results.filter((r) => r.status === "fulfilled");
  console.log(`[WebPush] Sent to ${succeeded.length}/${subs.length} subscribers (${failed.length} failed)`);

  // Remove expired/invalid subscriptions (410 Gone)
  const expiredEndpoints: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      const err = (r as PromiseRejectedResult).reason;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push(subs[i].endpoint);
      }
    }
  }
  if (expiredEndpoints.length > 0) {
    for (const endpoint of expiredEndpoints) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    }
    console.log(`[WebPush] Cleaned up ${expiredEndpoints.length} expired subscriptions`);
  }
}
