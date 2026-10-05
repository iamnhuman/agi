# Toyota digital rain

Visual reference: [Rezmason/matrix](https://github.com/Rezmason/matrix), especially its explanation of fixed glyph cells, descending light waves, independent column timing, and separate symbol cycling. The implementation in `app/signal-rain.tsx` is local Canvas2D code; no upstream shaders or glyph assets are bundled.

- Two stationary pixel grids replace the previous moving 3D projection. A dim, smaller grid adds depth behind the main streams.
- Each column has its own speed, phase, trail length, dark interval, and brightness. Long viewports can show multiple separated streams in one column.
- The leading cell lights up pale red. The tail stays at fixed coordinates and decays through crimson shades. Individual glyphs change on their own clocks.
- Half-width kana are mirrored and widened; digits remain upright. Punctuation that looked like empty holes is excluded.
- The atlas has hard pixel edges and the canvas renders at half resolution with smoothing disabled. The red palette, console, Toyota mark, and speech bubble remain shared across pages.
- Paint is capped near 30 FPS, with slower motion for reduced-motion preferences. Hidden tabs stop their animation frames; leaving Toyota releases the renderer and observer.
