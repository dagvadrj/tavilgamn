async function main() {
  const base = process.argv[2] || "http://localhost:3010";
  for (const route of ["/", "/catalog?room=bedroom", "/rooms/living-room.webp", "/rooms/bedroom.webp", "/rooms/dining.webp", "/rooms/office.webp"]) {
    const response = await fetch(base + route);
    const html = route.endsWith(".webp") ? "" : await response.text();
    console.log(JSON.stringify({ route, status: response.status, shopLook: html.includes("look-title"), hotspots: (html.match(/class="look-hotspot"/g) || []).length }));
    if (!response.ok || html.includes("Application error") || html.includes('id="__next_error__"')) throw new Error(`${route} failed`);
    if (route === "/" && !html.includes("look-title")) throw new Error("Shop the Look missing from homepage");
  }
  const catalog = await (await fetch(base + "/api/products")).json();
  const product = catalog.products?.find(item => item.stockQuantity > 0);
  if (product) {
    for (const query of ["", "?view=3d&color=" + encodeURIComponent(product.colors[0].id)]) {
      const response = await fetch(base + "/product/" + product.id + query);
      const html = await response.text();
      if (!response.ok || html.includes('id="__next_error__"')) throw new Error("Product route failed");
      const marker = query ? "3D загварыг ачаалж байна…" : "Өнгө, хэмжээ, загвараа 3D-ээр хараарай";
      if (!html.includes(marker)) throw new Error("Unexpected viewer mode");
      console.log(JSON.stringify({ route: "/product/[id]" + (query ? "?view=3d" : ""), status: response.status, viewerMode: query ? "3d" : "photo" }));
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
