# Image Transformation Service — Backend

Express/TypeScript backend that removes image backgrounds (Clipdrop API), flips them horizontally (sharp), and stores the results in Supabase Storage + database.

## Prerequisites

- Node.js 18+
- A Supabase project with:
  - A **public** storage bucket named `images`
  - A `public.images` table (see schema below)
  - RLS policies for both table and storage
- A [Clipdrop](https://clipdrop.co/) API key

### Supabase Table Schema

```sql
create table public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  processed_path text not null,
  processed_url text not null,
  created_at timestamptz default now()
);

-- RLS: users can only access their own rows
alter table public.images enable row level security;

create policy "Users can select own images"
  on public.images for select
  using (auth.uid() = user_id);

create policy "Users can insert own images"
  on public.images for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own images"
  on public.images for delete
  using (auth.uid() = user_id);
```

### Supabase Storage Policies

On the `images` bucket (public), create policies so authenticated users can only operate within their own `<uid>/` folder:

- **SELECT**: `(bucket_id = 'images') AND ((storage.foldername(name))[1] = auth.uid()::text)`
- **INSERT**: `(bucket_id = 'images') AND ((storage.foldername(name))[1] = auth.uid()::text)`
- **DELETE**: `(bucket_id = 'images') AND ((storage.foldername(name))[1] = auth.uid()::text)`

> The backend uses `service_role` and bypasses RLS, but enforces user ownership at the API layer.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service role key (server-only) |
| `CLIPDROP_API_KEY` | Yes | — | Clipdrop API key |
| `PORT` | No | `3000` | Server port |
| `MAX_UPLOAD_MB` | No | `10` | Max upload file size in MB |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
```

## Run

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### `GET /health`
Health check. Returns `{ "ok": true }`.

### `POST /api/images`
Upload an image, remove its background, flip horizontally, and store.

- **Auth**: `Authorization: Bearer <supabase_access_token>`
- **Body**: `multipart/form-data` with a single `file` field
- **Accepted types**: JPEG, PNG, WebP
- **Response** `200`: `{ id, processedUrl, createdAt }`

### `GET /api/images`
List the authenticated user's images (newest first).

- **Auth**: `Authorization: Bearer <supabase_access_token>`
- **Response** `200`: `[{ id, userId, processedUrl, createdAt }]`

### `DELETE /api/images/:id`
Delete an image (storage object + DB row).

- **Auth**: `Authorization: Bearer <supabase_access_token>`
- **Response** `200`: `{ ok: true }`
- `404` if not found, `403` if not the owner.

### Error Shape
All errors: `{ "error": { "code": "...", "message": "..." } }`

## Manual Test Plan

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Upload an image (replace <TOKEN> with a valid Supabase access token)
curl -X POST http://localhost:3000/api/images \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@path/to/test.jpg"

# 3. List images
curl http://localhost:3000/api/images \
  -H "Authorization: Bearer <TOKEN>"

# 4. Delete an image (replace <IMAGE_ID> with an id from step 3)
curl -X DELETE http://localhost:3000/api/images/<IMAGE_ID> \
  -H "Authorization: Bearer <TOKEN>"

# 5. Verify deletion — should return empty array or without the deleted item
curl http://localhost:3000/api/images \
  -H "Authorization: Bearer <TOKEN>"

# 6. Error cases
# No auth header -> 401
curl http://localhost:3000/api/images

# Invalid token -> 401
curl http://localhost:3000/api/images \
  -H "Authorization: Bearer invalid-token"

# No file -> 400
curl -X POST http://localhost:3000/api/images \
  -H "Authorization: Bearer <TOKEN>"

# Wrong file type -> 400
curl -X POST http://localhost:3000/api/images \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@path/to/file.txt;type=text/plain"

# Delete non-existent image -> 404
curl -X DELETE http://localhost:3000/api/images/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer <TOKEN>"
```
