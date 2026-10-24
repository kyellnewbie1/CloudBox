 "use client";
import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type UploadResult = { ok: boolean; id?: string; url?: string; directUrl?: string; expiresAt?: string | null; error?: string };
const MAX = 50 * 1024 * 1024;
const expiryOptions = [
  { value: "1h", label: "1 jam" }, { value: "3h", label: "3 jam" },
  { value: "24h", label: "24 jam" }, { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" }, { value: "never", label: "No expired" }
];
function formatSize(n: number) { return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`; }
export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [expiry, setExpiry] = useState("never");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [fileName, setFileName] = useState("");
  async function upload(file?: File) {
    setMessage(""); setResult(null); setProgress(0);
    if (!file) return;
    if (file.size > MAX) { setMessage("Ukuran file melebihi batas 50 MB."); return; }
    if (!file.size) { setMessage("File kosong tidak dapat diunggah."); return; }
    setFileName(file.name); setBusy(true);
    try {
      const prepResponse = await fetch("/api/upload/prepare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, type: file.type || "application/octet-stream", expiry })
      });
      const prep = await prepResponse.json();
      if (!prepResponse.ok || !prep.ok) throw new Error(prep.error || "Gagal menyiapkan upload.");
      if (!prep.supabaseUrl || !prep.anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur.");
      const client = createClient(prep.supabaseUrl, prep.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      // Upload bytes directly to private Supabase Storage; the 50 MB body never passes through Vercel.
      const { error: uploadError } = await client.storage.from("cloudbox").uploadToSignedUrl(prep.path, prep.token, file, {
        contentType: file.type || "application/octet-stream", upsert: false
      });
      if (uploadError) throw new Error(uploadError.message || "Upload ke storage gagal.");
      setProgress(95);
      const finalizeResponse = await fetch("/api/upload/finalize", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: prep.id })
      });
      const final = await finalizeResponse.json();
      if (!finalizeResponse.ok || !final.ok) throw new Error(final.error || "Gagal memverifikasi file.");
      setResult(final); setMessage("Upload berhasil."); setProgress(100);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload gagal. Coba lagi.");
    } finally { setBusy(false); }
  }
  return <main className="home-page">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">C</span>CloudBox</a><span className="tiny-tag">V1.0 · PUBLIC</span></header>
    <section className="hero"><p className="eyebrow">SIMPLE FILE HOSTING</p><h1>Drop it.<br/><span>Share it.</span></h1><p className="hero-copy">Upload file, dapatkan link publik, lalu bagikan ke mana saja.</p></section>
    <section className="upload-card">
      <div className={`dropzone ${dragging ? "is-dragging" : ""} ${busy ? "is-busy" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) void upload(e.dataTransfer.files?.[0]); }}
        onClick={() => !busy && input.current?.click()} role="button" tabIndex={0}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) input.current?.click(); }}>
        <input ref={input} type="file" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        <div className="upload-symbol">↑</div><h2>{busy ? "Uploading your file..." : "Drop files here"}</h2>
        <p>atau <span>pilih file dari perangkat</span></p><small>Foto · Video · Musik · GIF · Dokumen · ZIP</small>
        <div className="limit-pill">MAXIMUM 50 MB / FILE</div>
      </div>
      <div className="expiry-row"><label htmlFor="expiry">Masa berlaku link</label><select id="expiry" value={expiry} disabled={busy} onChange={(e) => setExpiry(e.target.value)}>{expiryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      {busy && <div className="progress-wrap"><div className="progress-label"><span>{fileName}</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div></div>}
      {message && <div className={`notice ${result?.ok ? "success" : "error"}`}>{message}</div>}
      {result?.ok && <div className="result-box"><p className="eyebrow">YOUR PUBLIC LINK</p><a className="result-link" href={result.url}>{result.url}</a><div className="result-actions"><button className="button button-dark" onClick={() => void navigator.clipboard.writeText(result.url || "")}>Copy link</button><a className="button button-light" href={result.directUrl} target="_blank" rel="noreferrer">Open direct URL</a></div><p className="muted small-text">{result.expiresAt ? `Expired: ${new Date(result.expiresAt).toLocaleString()}` : "No expired — link tidak kedaluwarsa otomatis."}</p></div>}
    </section>
    <section className="how-grid"><div><span>01</span><h3>Upload</h3><p>Pilih file hingga 50 MB.</p></div><div><span>02</span><h3>Choose expiry</h3><p>Tentukan masa berlaku link.</p></div><div><span>03</span><h3>Share</h3><p>Bagikan link publik ke siapa saja.</p></div></section>
    <footer className="site-footer"><span>© 2026 CloudBox</span><span>creator: <b>KyZX</b></span><a href="/api/health">API status ↗</a></footer>
  </main>;
}