# CloudBox V1 — creator: KyZX

CloudBox is a minimal black-and-white public file uploader built with Next.js + TypeScript, Supabase Storage/Postgres, and Vercel.

## Features
- Public upload UI with drag-and-drop and progress indicator
- Expiration choices: 1 hour, 3 hours, 24 hours, 7 days, 30 days, no expiration
- Public preview page for supported images, video, GIF, audio, and PDF
- Non-previewable file types use attachment download
- 50 MB per-file validation in app logic
- Custom 404 page, API health endpoint, security headers, rate-limit helper
- Creator label: `KyZX`

## IMPORTANT Vercel upload limitation
Vercel Functions have a request body limit (commonly 4.5 MB). Uploads use a signed direct-to-Supabase Storage flow so file bytes do not pass through Vercel Functions (which have request-body limits):
1. `POST /api/upload/prepare` validates metadata and expiry, rate-limits, creates a random path, and issues a signed upload token.
2. Browser uploads directly with Supabase `uploadToSignedUrl`.
3. `POST /api/upload/finalize` verifies the uploaded object and its size before activating the public metadata row.
Test this with files of different sizes before launch. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as well as server-only credentials.

## Setup
1. Create a Supabase project.
2. Create a **private** Storage bucket named `cloudbox`.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Copy `.env.example` to `.env.local` and fill server-side Supabase URL and service-role key.
5. Keep the service-role key server-only. Never prefix it with `NEXT_PUBLIC_`.
6. Install and run:
   ```bash
   npm install
   npm run dev
   ```
7. Deploy the repository to Vercel and add the same environment variables in Vercel project settings.

## Rate limiting
For production, configure Upstash Redis environment variables. Without them, the in-memory fallback is for local development only and does not reliably rate-limit across serverless instances. Also enable Cloudflare WAF/rate limiting in front of the domain, and consider Cloudflare Turnstile or another challenge for anonymous upload.

## Expiry cleanup
The file route checks expiry when a link is opened and deletes the expired object then. For dependable cleanup, create a scheduled Vercel Cron job (or Supabase scheduled function) that deletes expired `active` rows and their objects regularly. `no expired` files remain until manually removed. Add an admin-only deletion workflow before production.

## File safety
- The bucket is private; users access files through the API.
- Only an allowlist of extensions/MIME types is accepted. This is not malware scanning.
- SVG, HTML, executable files, and scripts are deliberately not allowed by the initial allowlist.
- Never set a bucket-wide public write policy.
- A public service needs abuse reporting, quotas, retention rules, and a privacy/acceptable-use page.

## Advertising / AdSense
An AdSense client/slot placeholder is included in `.env.example`, but ad rendering is **not enabled** in this starter. Apply to AdSense, own the domain, publish useful original content, and add privacy/cookie disclosures before inserting the approved publisher ID and ad slot. Do not click your own ads or incentivize clicks. A file-upload-only site may not be approved; approval is controlled by Google, not code. Keep ads away from the upload button and file action buttons to avoid accidental clicks.

## Security notes
Security headers are configured in `next.config.ts`; API routes use rate-limit helpers. For production:
- Configure Upstash Redis and a WAF/rate limit at the edge.
- Add bot challenge (Turnstile) and storage quotas.
- Add malware scanning or quarantine if the service will be broadly public.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS domain.
- Add a privacy policy, acceptable-use policy, and abuse contact.
- Add a periodic cleanup job for expired files.
- Run `npm audit` and test with realistic files before launch.
