import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";
import { jsonError, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const INLINE_MIMES = new Set([
  "image/jpeg","image/png","image/webp","image/gif","image/avif",
  "video/mp4","video/webm","video/quicktime",
  "audio/mpeg","audio/wav","audio/x-wav","audio/ogg","audio/mp4","audio/aac","audio/flac",
  "application/pdf"
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, "file-read", 120);
  if (!rl.allowed) return jsonError("Terlalu banyak permintaan.", 429);
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(id)) return jsonError("File tidak ditemukan.", 404);
  try {
    const supabase = supabaseAdmin();
    const { data: row, error } = await supabase.from("files").select("*").eq("id", id).eq("status", "active").maybeSingle();
    if (error || !row) return jsonError("File tidak ditemukan.", 404);
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      await supabase.from("files").update({ status: "deleted" }).eq("id", id);
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
      return jsonError("File ini sudah kedaluwarsa.", 410);
    }
    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(row.storage_path);
    if (downloadError || !blob) return jsonError("File tidak tersedia.", 404);
    const inline = INLINE_MIMES.has(row.mime_type);
    const disposition = inline ? "inline" : "attachment";
    const safeName = String(row.safe_name || "file").replace(/["\\\r\n]/g, "_");
    const headers = new Headers({
      "Content-Type": row.mime_type,
      "Content-Length": String(row.size_bytes),
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": row.expires_at ? "public, max-age=60, s-maxage=60" : "public, max-age=300, s-maxage=300",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    // Next.js buffers this Blob. For very large-scale use, consider a signed redirect/CDN delivery path.
    return new NextResponse(blob, { status: 200, headers });
  } catch {
    return jsonError("Server belum dikonfigurasi.", 500);
  }
}