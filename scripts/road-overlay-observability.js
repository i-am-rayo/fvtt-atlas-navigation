/**
 * Bounded, in-memory overlay diagnostics. Timings describe actual render work,
 * not Foundry canvas rebuild causation or native movement performance.
 * No Scene flags, telemetry, network requests or log spam.
 */
export class RoadOverlayObservability {
  constructor({ now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
    this.now = now;
    this.refreshes = 0;
    this.panRequests = 0;
    this.fogRequests = 0;
    this.teardowns = 0;
    this.graphicsCreated = 0;
    this.graphicsDestroyed = 0;
    this.totalMs = 0;
    this.maxMs = 0;
    this.last = null;
  }

  beginRefresh() {
    this.refreshes++;
    return this.now();
  }

  finishRefresh(start, { sceneId = null, active = false, roadPaths = 0,
    checkpointHits = 0, labels = 0 } = {}) {
    const elapsed = Math.max(0, this.now() - start);
    if (Number.isFinite(elapsed)) {
      this.totalMs += elapsed;
      this.maxMs = Math.max(this.maxMs, elapsed);
    }
    this.last = { sceneId, active, roadPaths, checkpointHits, labels,
      durationMs: Number.isFinite(elapsed) ? elapsed : null };
  }

  notePan() { this.panRequests++; }
  noteFog() { this.fogRequests++; }
  noteTeardown() { this.teardowns++; }
  noteGraphicsCreated() { this.graphicsCreated++; }
  noteGraphicsDestroyed() { this.graphicsDestroyed++; }

  snapshot() {
    return {
      refreshes: this.refreshes, panRequests: this.panRequests,
      fogRequests: this.fogRequests, teardowns: this.teardowns,
      graphicsCreated: this.graphicsCreated,
      graphicsDestroyed: this.graphicsDestroyed,
      averageMs: this.refreshes ? this.totalMs / this.refreshes : 0,
      maxMs: this.maxMs, last: this.last ? {...this.last} : null
    };
  }
}
