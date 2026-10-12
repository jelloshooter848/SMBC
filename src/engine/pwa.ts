/*
 * The page's side of offline play (0.4.44): registers the service worker the build writes
 * (tools/pwa/sw.js) and watches for a new release waiting behind the running one, for the
 * title's UPDATE READY notice. main.ts calls it in production builds only: `pnpm dev` and Vitest
 * never register a worker.
 */

export interface UpdateWatch {
  /** A new release is installed and waiting. */
  readonly ready: boolean;
  /** Called when one becomes ready. */
  onReady: (() => void) | null;
  /** Switch to the waiting release: the page reloads once it has taken over. */
  apply(): void;
}

/** If the new worker never takes over (it should within a moment), reload anyway. */
const APPLY_FALLBACK_MS = 4000;

export function watchServiceWorker(
  base: string,
  container: ServiceWorkerContainer | undefined,
  reload: () => void,
): UpdateWatch {
  let waiting: ServiceWorker | null = null;
  let applying = false;
  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };
  const watch: UpdateWatch = {
    get ready() {
      return waiting !== null;
    },
    onReady: null,
    apply() {
      if (!waiting || applying) return;
      applying = true;
      waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(reloadOnce, APPLY_FALLBACK_MS);
    },
  };
  if (!container) return watch;
  // Without a controller this is the first install: the page already runs this release.
  const found = (w: ServiceWorker) => {
    if (!container.controller || waiting === w) return;
    waiting = w;
    watch.onReady?.();
  };
  container.addEventListener('controllerchange', () => {
    if (applying) reloadOnce();
  });
  container
    .register(`${base}sw.js`, { scope: base })
    .then((reg) => {
      const follow = (w: ServiceWorker | null) =>
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed') found(w);
        });
      if (reg.waiting) found(reg.waiting);
      // One may be installing already (its updatefound came before this listener).
      follow(reg.installing);
      reg.addEventListener('updatefound', () => follow(reg.installing));
      // A Home Screen app can stay open for days: look for a new release whenever it comes back.
      if (typeof document !== 'undefined')
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
        });
    })
    .catch((e: unknown) => console.warn(`service worker not registered: ${String(e)}`));
  return watch;
}

/**
 * The last of "feel like an app" that CSS can't do (index.html has the rest): iOS Safari ignores
 * `user-scalable=no`, so pinch (gesturestart) and double-tap zoom (dblclick) are stopped here.
 */
export function stopPageZoom(doc: Document): void {
  const stop = (e: Event) => e.preventDefault();
  doc.addEventListener('gesturestart', stop, { passive: false });
  doc.addEventListener('dblclick', stop, { passive: false });
}
