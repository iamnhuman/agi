# Metal card material experiment

The archive state before this experiment is saved in Git commit `41f152f`.

- Generation method: built-in `imagegen` tool.
- Project asset: `public/textures/worn-steel.png`.
- Material: the final steel grain block in `app/globals.css`, blended with `soft-light` into the original card backgrounds.
- Surfaces: catalogue dossier cards, curator grid cards and video cards.
- The original palette, bevels, borders, shadows and hover effects are restored. Grain adds fine scratches without replacing the dark casing.
- Existing dimensions, portraits, name screens and status lamps are preserved. The hover reflection and VHS overlay have been removed.
- Per-card background offsets apply only to the texture image. All lower gradients use explicit `0 0` positions so their dark base never moves out from beneath the grain.

## Generation prompt

Use case: product-mockup. Asset type: one seamless repeating material texture for the metal casings of compact website UI cards. Generate a square, edge-to-edge, flat close-up swatch of worn brushed steel, inspired by late-1990s industrial game interface frames. ONLY the material surface, no UI, no frame, no objects, no text, no logos, no rivets, no edges, no seams. Neutral desaturated medium grey steel with very fine vertical brushing, dense subtle micro-pitting, a few hairline scratches and gentle uneven rubbed patina. Authentic used steel, not shiny chrome, not plastic, not concrete. The lighting is flat and diffuse, without directional highlights or gradients, since CSS will supply highlights. Uniform overall brightness, no central spot or large stain. Low-to-medium contrast but tactile fine grain visible at small sizes. All four borders tile seamlessly with opposite borders. Tight macro texture, mostly steel grey; no strong blue, red or brown colour. Square image, opaque.
