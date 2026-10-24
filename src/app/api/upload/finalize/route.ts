import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";
import { jsonError, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "upload-finalize", 8);
  if (!rl.allowed) return jsonError("Terlalu banyak permintaan.", 429);
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return jsonError("Origin tidak diizinkan.", 403); }
    catch { return jsonError("Origin tidak valid.", 403); }
  }
  let body: { id?: string };
  try { body = await req.json(); } catch { return jsonError("JSON tidak valid.", 400); }
  const id = String(body.id || "");
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(id)) return jsonError("ID tidak valid.", 400);
  try {
    const db = supabaseAdmin();
    const { data: row, error } = await db.from("files").select("*").eq("id", id).eq("status", "pending").maybeSingle();
    if (error || !row) return jsonError("Upload tidak ditemukan atau sudah diproses.", 404);
    const parts = String(row.storage_path).split("/");
    if (parts.length !== 2 || parts[0] !== id) return jsonError("Path file tidak valid.", 400);
    const { data: listed, error: listError } = await db.storage.from(BUCKET).list(id, { limit: 10, search: parts[1] });
    if (listError) return jsonError("Tidak dapat memverifikasi file yang diunggah.", 502);
    const object = listed?.find((item) => item.name === parts[1]);
    if (!object) return jsonError("Upload belum selesai.", 409);
    const actualSize = Number((object.metadata as Record<string, unknown> | null)?.size ?? 0);
    if (!actualSize || actualSize !== Number(row.size_bytes) || actualSize > 50 * 1024 * 1024) {
      await db.storage.from(BUCKET).remove([row.storage_path]);
      await db.from("files").update({ status: "deleted" }).eq("id", id);
      return jsonError("Ukuran file tidak cocok atau melewati batas.", 413);
    }
    const { error: updateError } = await db.from("files").update({ status: "active" }).eq("id", id).eq("status", "pending");
    if (updateError) return jsonError("Gagal menyelesaikan upload.", 500);
    const base = process.env.SITE_URL || new URL(req.url).origin;
    return NextResponse.json({
      ok: true, id, creator: "KyZX", url: `${base}/f/${id}`, directUrl: `${base}/api/file/${id}`,
      expiresAt: row.expires_at
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Server belum dikonfigurasi.", 500);
  }
}