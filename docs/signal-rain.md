# Toyota digital rain

Visual reference: [Rezmason/matrix](https://github.com/Rezmason/matrix), especially its explanation of fixed glyph cells, descending light waves, independent column timing, and separate symbol cycling. The implementation in `app/signal-rain.tsx` is local Canvas2D code; no upstream shaders or glyph assets are bundled.

- Two stationary pixel grids replace the previous moving 3D projection. A dim, smaller grid adds depth behind the main streams.
- Each column has its own speed, phase, trail length, dark interval, and brightness. Long viewports can show multiple separated streams in one column.
- The leading cell lights up pale red. The tail stays at fixed coordinates and decays through crimson shades. Individual glyphs change on their own clocks.
- Half-width kana are mirrored and widened; digits remain upright. Punctuation that looked like empty holes is excluded.
- The atlas has hard pixel edges and the canvas renders at half resolution with smoothing disabled. The red palette, console, Toyota mark, and speech bubble remain shared across pages.
- Paint is capped near 30 FPS, with slower motion for reduced-motion preferences. Hidden tabs stop their animation frames; leaving Toyota releases the renderer and observer.
- The 2.4-second speech bubble uses a double chamfered casing, separate status plates, a recessed Japanese message screen, a pixel radar and three diagnostic cartridges for channel packets, data activity and CRC. There are no underlines or long progress traces. The receiver boots, acquires a packet, loses the carrier and latches an error. All instrument clocks remain active through the error latch: status lamps chase, the radar sweeps, channel packets travel across the matrix, DATA bars change height, CRC cells cycle, and subtle highlights visit the message glyphs, glass corners, case screws and connector vents. Moving details stay on the integer raster; the message and casing remain stable.
- Reduced motion keeps the instrument activity at a slower cadence (8 FPS painting, 180 ms receiver steps), while removing the scanning gate, flashing alarm and displaced text slices. The glyph and bezel highlights also slow down; no text or casing shifts.
