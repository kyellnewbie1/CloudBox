import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ ok: false, error: "Gunakan alur upload bertanda tangan melalui /api/upload/prepare dan /api/upload/finalize." }, { status: 410 });
}