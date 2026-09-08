# Casa Nova — Modern Furniture & 3D Room Planner

A furniture e-commerce experience built around an immersive 3D room planner. Browse, customize materials and colors live in 3D, then drag and drop pieces into a virtual room of your size.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and configure Supabase before starting.
For orders and payments, apply both SQL migrations in `supabase/migrations/`
and follow [checkout and payment setup](docs/checkout-setup.md).

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Three.js + React Three Fiber + drei** for 3D
- **Zustand** for state (cart, wishlist, auth, saved designs)
- **Framer Motion** for motion

## Routes

- `/` Home with hero, collections, banners, reviews, inspiration gallery
- `/catalog` All furniture with filters / sort / search
- `/catalog/[category]` Per-category listings (sofa, bed, wardrobe…)
- `/product/[id]` Detail with **3D customizer** (color / material / rotate / zoom / live price)
- `/planner` **Virtual Room Planner** — drag & drop, snap to wall, save & compare layouts
- `/cart`, `/wishlist`, `/login`, `/register`
- `/checkout` Server-priced order confirmation and delivery details
- `/orders/[id]` Order detail, QPay / SocialPay / bank transfer instructions
- `/account` Saved designs, order history, wishlist
- `/about` Company, mission, store locations, contact
- `/admin` Furniture, 3D models, orders, users, analytics

## Architecture notes

- All product metadata and integer inventory (`in_stock`) live in Supabase `furniture_models`. `src/lib/products.ts` contains category labels and price helpers only. Apply [the catalog/inventory migration](docs/inventory-setup.md) before running this version. GLB files use the configured R2/Supabase storage.
- Supabase authenticates users; `profiles.role` controls admin access. Cart, wishlist and room designs use per-user browser storage.
- Orders, delivery details and item price snapshots are stored in Supabase through Next.js API routes. Prices and availability are checked on the server.
- Payment credentials remain server-side. QPay and SocialPay require merchant configuration and sandbox verification. Bank transfers require configured account details and admin reconciliation.
- Admin views use live orders, products, users and analytics. Contact requests are stored privately and appear in the admin inbox.
- Set `CONTACT_EMAIL` and optionally `CONTACT_PHONE` in `.env.local` and the deployment environment for the public contact links. The placeholder email is hidden until a real address is configured. Rebuild after changing these values because `/about` is generated at build time.

## Backend

The active backend is `src/app/api` with Supabase. The `backend/` folder contains
an earlier NestJS plan only; it is not an executable backend workspace.

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` to validate changes.
