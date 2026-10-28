# Hero image assets

Generated with the built-in `image_gen` tool, then resized and encoded as WebP with Sharp. The active room is WebGL geometry; the poster is used while loading or when rendering fails.

## Saved assets and final prompts

- `public/interior/premium/living-poster.webp`
  - Input: the user's living-room reference, `AaFzVA6U9lEiYqubYFdc2g-AaFzVA6UX8lsRdpLpPCFkQ.jpg`.
  - Prompt: Edit this supplied reference into a clean standalone room photograph for a furniture website loading poster. Preserve exactly the composition, dark warm walnut, textured grey concrete, cream boucle sofa on right, brown armchair, shelving with warm LED lighting, window right, floor and rug. Remove ALL website UI: all text, logos, header, icons, buttons, hotspot dots, floating cards and bottom navigation; seamlessly reconstruct room behind them. NO text, NO symbols, NO watermarks. Photorealistic architectural photography, realistic woven fabric and wood pores, existing moody daytime lighting, clean detailed image. Landscape 16:9.
- `public/interior/premium/window-city.webp`
  - Prompt: Create a photorealistic architectural background plate viewed through the high-rise window of a warm contemporary apartment in Ulaanbaatar. Only the exterior view, absolutely no window frames, no interior, no furniture and no UI or text. Dense distant apartment buildings and soft rolling mountains beyond, hazy pale blue-grey afternoon sky, subtle warm sunlight, muted natural grey-beige buildings, gentle atmospheric depth, unobtrusive softly out-of-focus photography for use behind a realistic 3D room window. Landscape 16:9.
- `public/interior/premium/linen-color.webp`
  - Prompt: Square seamless tileable PBR base color texture of natural warm ivory unbleached upholstery linen, macro photograph straight on, fine dense woven threads, extremely subtle neutral beige tonal variation. Entire image is ONLY fabric, no objects, no perspective, no folds, no seams, no colored pattern, no text. Uniform flat diffuse studio lighting, no shadows, no specular highlights. Realistic tactile fine weave suitable for luxury upholstered bed and sheer curtains. Light cream neutral color, not blue or grey.

Other raster material maps and the lounge-chair GLB are recorded in `public/interior/premium/sources.json`. Their source licenses and the generated linen color override are kept separate. No SVG surface textures are used.
