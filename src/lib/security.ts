import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { randomBytes } from "node:crypto";

const WINDOW_MS = 60_000;
const localBuckets = new Map<string, { count: number; reset: number }>();
let distributedLimiter: Ratelimit | null = null;

function getLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!distributedLimiter) {
    distributedLimiter = new Ratelimit({
      redis: new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }),
      limiter: Ratelimit.slidingWindow(8, "1 m"),
      analytics: false,
      prefix: "cloudbox:rl"
    });
  }
  return distributedLimiter;
}

export async function rateLimit(req: NextRequest, bucket: string, limit = 8) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded || req.headers.get("x-real-ip") || "unknown").slice(0, 80);
  const key = `${bucket}:${ip}`;
  const redisLimiter = getLimiter();
  if (redisLimiter) {
    const result = await redisLimiter.limit(key);
    return { allowed: result.success, remaining: result.remaining, reset: result.reset };
  }
  // Fallback only for local development/single process. Serverless memory is NOT a production-grade limiter.
  const now = Date.now();
  for (const [k, v] of localBuckets) if (v.reset < now) localBuckets.delete(k);
  const item = localBuckets.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (item.reset <= now) { item.count = 0; item.reset = now + WINDOW_MS; }
  item.count++;
  localBuckets.set(key, item);
  return { allowed: item.count <= limit, remaining: Math.max(0, limit - item.count), reset: item.reset };
}

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}
export function randomId() {
  return randomBytes(18).toString("base64url");
}
export function safeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.normalize("NFKC").replace(/[^\p{L}\p{N}._ ()-]/gu, "_").replace(/^\.+/, "").slice(0, 150) || "file";
}
export function expiryFrom(value: unknown): string | null | undefined {
  if (value === "1h") return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  if (value === "3h") return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  if (value === "24h") return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (value === "7d") return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (value === "30d") return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  if (value === "never") return null;
  return undefined;
}
export function allowedMime(mime: string, name: string) {
  const ext = name.toLowerCase().split(".").pop() || "";
  const allowedExtensions = new Set([
    "jpg","jpeg","png","webp","gif","avif","mp4","webm","mov","mp3","wav","ogg","m4a","aac","flac",
    "pdf","txt","csv","zip","7z","rar","doc","docx","xls","xlsx","ppt","pptx"
  ]);
  if (!allowedExtensions.has(ext)) return false;
  const safeMimes = new Set([
    "image/jpeg","image/png","image/webp","image/gif","image/avif",
    "video/mp4","video/webm","video/quicktime",
    "audio/mpeg","audio/wav","audio/x-wav","audio/ogg","audio/mp4","audio/aac","audio/flac",
    "application/pdf","text/plain","text/csv","application/zip","application/x-7z-compressed","application/vnd.rar",
    "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/octet-stream"
  ]);
  return safeMimes.has(mime.toLowerCase());
}
