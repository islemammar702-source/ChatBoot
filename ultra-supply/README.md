# ULTRA SUPPLY — Corporate website

Agricultural & Industrial Solutions. React + TypeScript + Tailwind CSS + Supabase.

## Features

- **Public site** (FR default · EN · AR with full right-to-left layout): Home, Products (search, category filter, sort), product pages, Industries, Import & Distribution, About, Partners, Contact, Request a Quote, 404.
- **Quote requests** with validation and optional image/PDF attachment → `quote_requests` table + private `quote-attachments` bucket.
- **Contact form** → `contact_messages` table. Google Maps embed driven by the address set in the admin.
- **Admin** (`/admin`, protected): dashboard, products CRUD with image upload and multilingual specs, categories, brands & partners, quote requests (status, attachment, CSV export), contact messages, site content & translations, contact details & social links.
- **SEO**: per-page title/description/canonical/Open Graph, JSON-LD, `robots.txt`, `sitemap.xml`, semantic HTML, lazy-loaded images, code-split routes.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Without Supabase credentials the site runs in **demo mode**: data is stored in the browser and the admin uses
`admin@demo.local` / `ultrasupply-demo` (shown on the login page only in demo mode). Never use demo mode in production.

## Supabase setup (production)

1. Create a Supabase project, then copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In the SQL editor run `supabase/migrations/001_init.sql` (tables, Row Level Security, storage buckets), then `supabase/seed.sql` (placeholder catalogue; regenerate with `npm run seed:sql`).
3. Create the admin user in *Authentication → Users*, then grant admin rights:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'admin@your-domain.tn';
   ```
4. Disable public sign-ups in *Authentication → Providers → Email* so only invited users exist.

Security is enforced server-side by RLS: visitors can only **insert** quotes/messages and upload into `quote-attachments/incoming/`; only users listed in `admins` can read requests or modify the catalogue, content and images.

## Deployment

Static SPA: deploy `dist/` to Vercel (`vercel.json` included), Netlify (`public/_redirects` included) or any host with an SPA fallback to `index.html`. Set `VITE_SITE_URL` and update the domain in `public/robots.txt` and `public/sitemap.xml`.

## Content to replace before launch

- **Photos**: `src/data/images.ts` uses Unsplash placeholders; product/category images can be replaced from the admin.
- **Contact details & social links**: *Admin → Contenu & traductions → Coordonnées*. Placeholders (`+216 XX XXX XXX`, …) are shown until real values are entered.
- **Product references** (`REF-…`) and **partner logos** are placeholders — add only real, authorised partners.

## Structure

```
src/
  admin/        admin dashboard (auth guard, CRUD screens)
  components/   layout, cards, forms, home sections
  data/         seed catalogue, image placeholders, sector icons
  i18n/         fr / en / ar dictionaries + provider (DB overrides)
  lib/          types, Supabase client, data API (Supabase or demo), validation
  pages/        public routes
supabase/       SQL migration and seed
```
