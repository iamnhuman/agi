# Metal card material experiment

The archive state before this experiment is saved in Git commit `41f152f`.

- Generation method: built-in `imagegen` tool.
- Project asset: `public/textures/worn-steel.png`.
- Material: the final steel grain block in `app/globals.css`, blended with `soft-light` into the original card backgrounds.
- Surfaces: catalogue dossiers and registry rows, name previews, curator cards and rows, and video cards. The canvas deck uses per-record procedural pixel wear.
- The original palette, bevels, borders, shadows and hover effects are restored. Grain adds fine scratches without replacing the dark casing.
- Portraits and name screens are preserved. The lower dock is a 28 px recessed console with a segmented spectrum, a per-record 6 × 3 light matrix, and a calibrated reticle with closing jaws and a red pilot. Decorative RX and hardware-code labels are removed. The seven spectrum lights keep their shuffled activation order and complete with the target lock in 300 ms. Matrix lights join the same one-shot sequence; all illuminated cells remain on until hover or keyboard focus leaves. The reticle still follows the pointer. Narrow docks first omit the waveform icon, then the matrix, keeping the spectrum and reticle visible without overflow. Reduced motion keeps the light sequence while disabling geometric movement.
- Video cases and name previews share the console, with room reserved below their content. Video cards retain the protected image bay, corner marks, glass name screen and one-shot stepped scan. The horizontal overview below 50% hides the console and image marks, preserving the smaller three-line titles.
- `app/card-material.ts` derives texture crops, scales, brushing angles and patina positions from the record ID. Reordering or filtering keeps each card's finish stable; the name plate has its own crop.
- Per-card background offsets apply only to the texture image. All lower gradients use explicit `0 0` positions so their dark base never moves out from beneath the grain.

## Generation prompt

Use case: product-mockup. Asset type: one seamless repeating material texture for the metal casings of compact website UI cards. Generate a square, edge-to-edge, flat close-up swatch of worn brushed steel, inspired by late-1990s industrial game interface frames. ONLY the material surface, no UI, no frame, no objects, no text, no logos, no rivets, no edges, no seams. Neutral desaturated medium grey steel with very fine vertical brushing, dense subtle micro-pitting, a few hairline scratches and gentle uneven rubbed patina. Authentic used steel, not shiny chrome, not plastic, not concrete. The lighting is flat and diffuse, without directional highlights or gradients, since CSS will supply highlights. Uniform overall brightness, no central spot or large stain. Low-to-medium contrast but tactile fine grain visible at small sizes. All four borders tile seamlessly with opposite borders. Tight macro texture, mostly steel grey; no strong blue, red or brown colour. Square image, opaque.
