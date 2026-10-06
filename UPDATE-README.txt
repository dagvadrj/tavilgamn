UI / CSS update — 2026-10-06

This archive contains all source CSS and the files changed during this conversation,
including the earlier storefront, catalog, product and cart UI changes.
Paths are relative to the project root. No .env, credentials, node_modules or build files are included.

Apply:
1. Back up your destination project.
2. Copy the files into its root, keeping the folders and replacing matching files.
3. Remove these obsolete files (their rules are consolidated in storefront.css):
   src/app/(shop)/marketplace.css
   src/app/(shop)/homepage-marketplace.css
   src/app/(shop)/studio-commerce.css
4. Run npm ci, npm run styles:check and npm run build.
   The project specifies Node >=22.14 <23.

If your destination has newer changes, merge the files instead of overwriting them.

Files included:
docs/home-marketplace-verification.md
docs/styles.md
package-lock.json
package.json
scripts/styles/check.mjs
src/app/(admin)/admin/admin-dark.css
src/app/(admin)/admin/admin.css
src/app/(admin)/merchant/merchant.css
src/app/(shop)/cart/page.tsx
src/app/(shop)/layout.tsx
src/app/(shop)/page.tsx
src/app/(shop)/shop-tokens.css
src/app/(shop)/storefront.css
src/app/globals.css
src/components/CatalogProducts.tsx
src/components/CatalogView.tsx
src/components/Header.tsx
src/components/ProductCustomizer.tsx
src/components/category-menu.css
src/components/kitchen-component-sheet.css
src/components/kitchen-planner.css
src/components/room-planner.css
src/features/dashboard/dashboard.css
src/features/kitchen-planner/components/kitchen-plan.css
src/features/planner/components/planner-reference.css
src/features/planner/components/planner-studio.css
src/features/planner/components/viewport-controls.css
tests/home-marketplace.test.cjs
tests/marketplace-ui.test.cjs
tests/planner-reference-layout.test.cjs
