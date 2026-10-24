import Link from "next/link";
export default function NotFound() {
  return <main className="error-page"><div className="error-code">404</div><p className="eyebrow">FILE NOT FOUND</p><h1>Halaman ini tidak tersedia.</h1><p className="muted">Link mungkin salah, file telah dihapus, atau masa berlakunya sudah habis.</p><Link className="button button-dark" href="/">Kembali ke CloudBox</Link><small>creator: KyZX</small></main>;
}