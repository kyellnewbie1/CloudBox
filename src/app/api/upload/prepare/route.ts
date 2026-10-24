import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";
import { allowedMime, expiryFrom, jsonError, randomId, rateLimit, safeFilename } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "upload-prepare", 5);
  if (!rl.allowed) return jsonError("Terlalu banyak permintaan. Coba lagi sebentar.", 429, { reset: rl.reset });
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return jsonError("Origin tidak diizinkan.", 403); }
    catch { return jsonError("Origin tidak valid.", 403); }
  }
  let body: { name?: string; size?: number; type?: string; expiry?: string };
  try { body = await req.json(); } catch { return jsonError("JSON tidak valid.", 400); }
  const name = safeFilename(String(body.name || ""));
  const size = Number(body.size);
  const mime = String(body.type || "application/octet-stream").toLowerCase();
  const expiresAt = expiryFrom(body.expiry);
  if (expiresAt === undefined) return jsonError("Pilihan masa berlaku tidak valid.", 400);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) return jsonError("Ukuran file harus antara 1 byte dan 50 MB.", 413);
  if (!allowedMime(mime, name)) return jsonError("Jenis file ini belum diizinkan.", 415);

  try {
    const db = supabaseAdmin();
    const id = randomId();
    const path = `${id}/${name}`;
    const { data: signed, error: signedError } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (signedError || !signed?.token) {
      console.error("CloudBox signed upload preparation failed:", signedError?.message);
      return jsonError("Tidak dapat menyiapkan upload. Periksa bucket Supabase.", 502);
    }
    const { error: insertError } = await db.from("files").insert({
      id, storage_path: path, original_name: name, safe_name: name,
      mime_type: mime, size_bytes: size, expires_at: expiresAt, status: "pending", creator: "KyZX"
    });
    if (insertError) {
      await db.storage.from(BUCKET).remove([path]);
      console.error("CloudBox pending metadata failed:", insertError.message);
      return jsonError("Tidak dapat membuat metadata upload.", 500);
    }
    return NextResponse.json({
      ok: true, id, path, token: signed.token, expiresAt,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expectedSize: size
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Server belum dikonfigurasi.", 500);
  }
}