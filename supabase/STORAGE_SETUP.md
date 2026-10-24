# Supabase Storage setup

1. In Supabase Dashboard → Storage, create a bucket named `cloudbox`.
2. Keep the bucket **private**.
3. Do not create public upload/read policies for `anon`.
4. Set the bucket's maximum file size to 50 MB (or the nearest allowed value in your plan).
5. The app server uses `SUPABASE_SERVICE_ROLE_KEY`; browser direct upload uses only `NEXT_PUBLIC_SUPABASE_ANON_KEY` plus short-lived signed upload tokens.
6. Configure CORS for your deployed CloudBox domain if the browser upload requires it.
7. Run the SQL in `schema.sql`.

The service-role key is privileged. Never expose it through a `NEXT_PUBLIC_` variable or commit `.env.local`.
