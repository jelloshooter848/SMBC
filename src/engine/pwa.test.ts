import { describe, expect, it, vi } from 'vitest';
import { stopPageZoom, watchServiceWorker } from './pwa';

// The page's side of the service worker (0.4.44): a first install is not an update; a new
// release waiting behind the running one is (UPDATE READY); applying it asks the new worker to
// take over and reloads once it has.

class FakeWorker extends EventTarget {
  state = 'installing';
  posted: unknown[] = [];
  postMessage(m: unknown) {
    this.posted.push(m);
  }
  become(state: string) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  updates = 0;
  async update() {
    this.updates++;
  }
  found(w: FakeWorker) {
    this.installing = w;
    this.dispatchEvent(new Event('updatefound'));
  }
}

class FakeContainer extends EventTarget {
  controller: object | null = null;
  reg = new FakeRegistration();
  registered: { url: string; scope: string }[] = [];
  async register(url: string, opts: { scope: string }) {
    this.registered.push({ url, scope: opts.scope });
    return this.reg;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('watchServiceWorker', () => {
  it('registers sw.js under the base path, with the base path as its scope', async () => {
    const c = new FakeContainer();
    watchServiceWorker('/SMBC/', c as unknown as ServiceWorkerContainer, vi.fn());
    await tick();
    expect(c.registered).toEqual([{ url: '/SMBC/sw.js', scope: '/SMBC/' }]);
  });

  it('the first install (no page controlled yet) is not an update', async () => {
    const c = new FakeContainer();
    const w = watchServiceWorker('/', c as unknown as ServiceWorkerContainer, vi.fn());
    await tick();
    const sw = new FakeWorker();
    c.reg.found(sw);
    sw.become('installed');
    expect(w.ready).toBe(false);
  });

  it('a new release installed behind the running one is ready; apply hands over and reloads', async () => {
    const c = new FakeContainer();
    c.controller = {};
    const reload = vi.fn();
    const w = watchServiceWorker('/', c as unknown as ServiceWorkerContainer, reload);
    const onReady = vi.fn();
    w.onReady = onReady;
    await tick();
    const sw = new FakeWorker();
    c.reg.found(sw);
    expect(w.ready).toBe(false);
    sw.become('installed');
    expect(w.ready).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    // A controller change nobody asked for (another tab updating) does not reload this one.
    c.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    w.apply();
    expect(sw.posted).toEqual([{ type: 'SKIP_WAITING' }]);
    c.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a release already waiting when the page loads is ready at once', async () => {
    const c = new FakeContainer();
    c.controller = {};
    c.reg.waiting = new FakeWorker();
    const w = watchServiceWorker('/', c as unknown as ServiceWorkerContainer, vi.fn());
    await tick();
    expect(w.ready).toBe(true);
  });

  it('a release already installing when registration resolves is still caught', async () => {
    const c = new FakeContainer();
    c.controller = {};
    const sw = new FakeWorker();
    c.reg.installing = sw; // its updatefound fired before the page listened
    const w = watchServiceWorker('/', c as unknown as ServiceWorkerContainer, vi.fn());
    await tick();
    sw.become('installed');
    expect(w.ready).toBe(true);
  });

  it('no service worker support: never ready, apply does nothing', () => {
    const w = watchServiceWorker('/', undefined, vi.fn());
    expect(w.ready).toBe(false);
    w.apply();
  });
});

describe('stopPageZoom', () => {
  /** An event as the browser sends it, from an element matching `selectors` (closest). */
  function from(type: string, matches: (sel: string) => boolean): Event {
    const e = new Event(type, { cancelable: true });
    Object.defineProperty(e, 'target', { value: { closest: (sel: string) => (matches(sel) ? {} : null) } });
    return e;
  }

  it('stops pinch and double-tap zoom on the game, but not in a text box or the paste box', () => {
    const doc = new EventTarget() as unknown as Document;
    stopPageZoom(doc);
    for (const type of ['gesturestart', 'dblclick']) {
      const onGame = from(type, () => false);
      doc.dispatchEvent(onGame);
      expect(onGame.defaultPrevented).toBe(true);
      // the paste box (data-native-touch) and any text field keep the phone's own
      // double-tap to select and pinch
      const inBox = from(type, (sel) => sel.includes('[data-native-touch]') && sel.includes('textarea'));
      doc.dispatchEvent(inBox);
      expect(inBox.defaultPrevented).toBe(false);
    }
  });
});
