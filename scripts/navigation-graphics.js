/**
 * Draw transient navigation highlights with the Graphics API provided by the
 * active Foundry/Pixi runtime. Foundry v14 worlds may expose the legacy Pixi
 * lineStyle/drawCircle interface rather than stroke/circle/fill.
 */
export function drawNavigationLine(graphics, spans, { color = 0xffa51f, width = 6, alpha = 0.95 } = {}) {
  if (!graphics || !Array.isArray(spans)) return;
  const modern = typeof graphics.stroke === "function";
  if (!modern && typeof graphics.lineStyle !== "function") {
    throw new Error("The Foundry canvas Graphics line API is unavailable.");
  }
  if (!modern) graphics.lineStyle(width, color, alpha);
  let drawn = false;
  for (const span of spans) {
    if (!Array.isArray(span) || span.length < 2) continue;
    graphics.moveTo(span[0].x, span[0].y);
    for (const point of span.slice(1)) graphics.lineTo(point.x, point.y);
    drawn = true;
  }
  if (modern && drawn) graphics.stroke({ color, width, alpha, cap:"round", join:"round" });
}

export function drawNavigationMarker(graphics, point, color) {
  if (!graphics || !point) return;
  const modern = typeof graphics.circle === "function" && typeof graphics.fill === "function";
  if (modern) {
    graphics.circle(point.x, point.y, 10).fill({ color:0x0c101a, alpha:0.95 });
    graphics.circle(point.x, point.y, 7).fill({ color });
  } else if (typeof graphics.beginFill === "function" &&
             typeof graphics.drawCircle === "function" &&
             typeof graphics.endFill === "function") {
    graphics.beginFill(0x0c101a, 0.95);
    graphics.drawCircle(point.x, point.y, 10);
    graphics.endFill();
    graphics.beginFill(color, 1);
    graphics.drawCircle(point.x, point.y, 7);
    graphics.endFill();
  } else {
    throw new Error("The Foundry canvas Graphics marker API is unavailable.");
  }
}
