import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, "health", 30);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  return NextResponse.json({ ok: true, service: "CloudBox API", version: "1.0.0", creator: "KyZX" }, {
    headers: { "Cache-Control": "no-store" }
  });
}