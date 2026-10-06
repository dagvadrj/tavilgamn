# Shop the Look

The homepage now leads with four room filter pills, an interactive room photograph and up to eight real catalog products per room. Hover with a mouse or tap/click a hotspot to open product photography, the selected color, the actual variant price and the quick-cart action. Escape and the close button dismiss the card and restore focus. Mobile cards sit beneath the photograph so they remain readable without covering the room.

The room photographs are generated interior inspiration, not photographs of the listed merchant products. The interface labels this distinction. Each hotspot selects an available photographed product category; unavailable, uncounted and placeholder-image products are excluded. A working 3D link is shown only when a product has a model. Color choice is passed to its detail page and its price includes both color and default material surcharges. Cart additions retain the existing shared inventory limits.

Navigation improvements:

- Search and homepage load-more use Next Form for client navigation.
- Catalog remounts and focus events reuse successful data for 30 seconds. Older data remains visible during refresh, and failed refreshes preserve the last successful catalog. Explicit refresh and checkout revalidation remain available.
- The product page deduplicates its metadata/product read per request and streams related products separately.
- Product photography appears first; the 3D engine and model prefetch start when requested. A hotspot's `view=3d` link starts the viewer directly.
- Shop routes have an immediate loading boundary. The first room photograph is prioritized; lower carousel photographs are lazy loaded.

## Generated assets and prompts

Mode: built-in image_gen, applied through the imagegen skill. The outputs were inspected and converted to WebP with Sharp at quality 85; dimensions remain 1536 × 1024. Runtime assets are saved in the project:

- `public/rooms/living-room.webp` — 304,206 bytes.
- `public/rooms/bedroom.webp` — 208,414 bytes.
- `public/rooms/dining.webp` — 239,182 bytes.
- `public/rooms/office.webp` — 267,680 bytes.

Living room prompt:

> Use case: photorealistic-natural. Asset type: furniture shop interactive room inspiration photograph. Generate one high-end professional wide 3:2 interior photograph of a complete warm contemporary living room in soft daylight. Composition: front view, cream fabric sofa at left (center x30% y65%), a tall natural oak bookshelf behind the sofa at left (center x16% y30%), a low walnut TV console and wall-mounted TV at right (center x78% y56%), oval coffee table foreground, textured cream rug, subtle ceramics and plant. Entire room visible, clear furniture silhouettes, carefully styled, architectural magazine photography, tactile wood and fabric, warm neutral colors, realistic perspective. No text, no logos, no UI, no hotspot markers, no watermark.

The remaining three prompts each use this exact prefix, the corresponding scene sentence below, and the exact suffix:

Prefix:

> Use case: photorealistic-natural. Asset type: furniture shop interactive room inspiration photograph. Generate one high-end professional wide 3:2 interior photograph.

Bedroom scene:

> Complete contemporary bedroom, front facing wide view, upholstered cream double bed center-left at x42% y65%, tall natural oak wardrobe at right x85% y40%, soft linen bed clothes, neutral rug, lamps, large daylight window left.

Kitchen/dining scene:

> Complete modern kitchen and dining room, wide front view. Pale oak kitchen cabinet units and white stone counter running across back wall center x48% y40%; built-in dark oven in lower cabinetry at right x78% y50%; round dining table with chairs in foreground left x35% y75%. Soft daylight, clean warm style.

Office scene:

> Complete modern home office, wide front view. Natural oak work desk and chair at center-right x60% y65%; tall oak bookshelf at left x18% y40%. Linen curtains, plant, thoughtful study accessories. Soft daylight, warm neutral cream palette.

Suffix:

> Entire room visible, clear furniture silhouettes, carefully styled architectural magazine photography, tactile wood and fabric, realistic perspective. Match a warm contemporary cream and oak living room aesthetic. No text, no logos, no UI, no hotspot markers, no watermark.

## Verification

The complete repository test suite passes all 374 tests.

The six targeted test files pass 26 tests, including room replacement, mouse/touch hotspot opening, Escape focus restoration, variant pricing, 3D links, cart success/failure, catalog reuse and failed background refresh. TypeScript, ESLint and the production build pass. The production build reports 124 kB first-load JavaScript for the homepage and 127 kB for the product route. Local HTTP checks verify the homepage with three live catalog hotspots, the room catalog route, all four assets, and both photo-first and direct-3D product routes.

Interactive browser verification was unavailable because this session exposed no browser. CSS syntax, selector and formatting checks pass for the new stylesheet; the repository-wide formatting check reports existing formatting issues in `homepage-marketplace.css` and `marketplace.css`.
