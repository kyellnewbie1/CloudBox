import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin, BUCKET } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";

type Row = { id: string; original_name: string; mime_type: string; size_bytes: number; expires_at: string | null; status: string; created_at: string };
async function getFile(id: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(id)) return null;
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("files").select("id,original_name,mime_type,size_bytes,expires_at,status,created_at").eq("id", id).eq("status", "active").maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      await db.from("files").update({ status: "deleted" }).eq("id", id);
      const { data: full } = await db.from("files").select("storage_path").eq("id", id).maybeSingle();
      if (full?.storage_path) await db.storage.from(BUCKET).remove([full.storage_path]);
      return null;
    }
    return data as Row;
  } catch { return null; }
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const f = await getFile(id);
  return { title: f ? `${f.original_name} — CloudBox` : "File tidak ditemukan — CloudBox", robots: { index: false, follow: false } };
}
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}
export default async function FilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const f = await getFile(id);
  if (!f) notFound();
  const url = `/api/file/${f.id}`;
  const mime = f.mime_type;
  const isImage = mime.startsWith("image/") && mime !== "image/svg+xml";
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  return <main className="file-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">C</span>CloudBox</Link><span className="tiny-tag">PUBLIC FILE</span></header>
    <section className="preview-shell">
      <div className="file-meta"><div><p className="eyebrow">CLOUDBOX FILE</p><h1>{f.original_name}</h1><p className="muted">{humanSize(Number(f.size_bytes))} · {mime}</p></div><a className="button button-dark" href={url} download={!isImage && !isVideo && !isAudio}>Download ↗</a></div>
      <div className="media-stage">
        {isImage ? <img className="image-preview" src={url} alt={f.original_name} /> :
         isVideo ? <video className="video-preview" src={url} controls playsInline preload="metadata" /> :
         isAudio ? <div className="audio-box"><div className="audio-icon">♫</div><h2>{f.original_name}</h2><audio src={url} controls preload="metadata" /></div> :
         mime === "application/pdf" ? <iframe className="pdf-preview" src={url} title={f.original_name} /> :
         <div className="download-box"><div className="document-icon">↓</div><h2>File siap diunduh</h2><p className="muted">Tipe file ini tidak ditampilkan langsung di browser.</p><a className="button button-dark" href={url}>Download file</a></div>}
      </div>
      <footer className="file-footer"><span>Uploaded to CloudBox</span><span>creator: <b>KyZX</b></span></footer>
    </section>
    <footer className="site-footer">CloudBox · Simple public file hosting <span>creator: KyZX</span></footer>
  </main>;
}