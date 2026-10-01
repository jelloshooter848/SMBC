import type { Action } from './actions';
import type { Code } from './bindings';
import type { InputSource } from './input-manager';

/**
 * On-screen controls for phones and tablets: a d-pad on the left, buttons on the right, and
 * small start/select buttons. Multi-touch aware, and the thumb can slide across the d-pad.
 * Emits codes `touch:<action>` that the InputManager maps for player 1.
 */
export class TouchSource implements InputSource {
  private readonly down = new Set<Code>();
  private readonly root: HTMLElement;
  private readonly pointers = new Map<number, { dpad: boolean }>();
  private readonly dpad: HTMLElement;
  private visible = false;

  constructor(container: HTMLElement, scale = 1) {
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <style>
        .touch-controls { position: fixed; inset: 0; pointer-events: none; display: none; --ts: ${scale}; }
        .touch-controls.visible { display: block; }
        .touch-controls .tc { position: absolute; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; }
        .touch-controls .dpad { left: calc(16px * var(--ts)); bottom: calc(24px * var(--ts)); width: calc(150px * var(--ts)); height: calc(150px * var(--ts)); border-radius: 50%; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.35); }
        .touch-controls .dpad::before { content: ''; position: absolute; left: 33%; top: 0; width: 34%; height: 100%; background: rgba(255,255,255,0.15); border-radius: 8px; }
        .touch-controls .dpad::after { content: ''; position: absolute; top: 33%; left: 0; height: 34%; width: 100%; background: rgba(255,255,255,0.15); border-radius: 8px; }
        .touch-controls .btn { width: calc(68px * var(--ts)); height: calc(68px * var(--ts)); border-radius: 50%; background: rgba(255,255,255,0.14); border: 2px solid rgba(255,255,255,0.4); color: #fff; font: bold calc(18px * var(--ts)) system-ui, sans-serif; display: flex; align-items: center; justify-content: center; }
        .touch-controls .btn.active { background: rgba(255,255,255,0.45); }
        .touch-controls .jump { right: calc(24px * var(--ts)); bottom: calc(40px * var(--ts)); }
        .touch-controls .attack { right: calc(104px * var(--ts)); bottom: calc(24px * var(--ts)); }
        .touch-controls .special { right: calc(64px * var(--ts)); bottom: calc(118px * var(--ts)); width: calc(54px * var(--ts)); height: calc(54px * var(--ts)); }
        .touch-controls .start, .touch-controls .select { top: calc(10px * var(--ts)); width: calc(64px * var(--ts)); height: calc(30px * var(--ts)); border-radius: 15px; font-size: calc(12px * var(--ts)); }
        .touch-controls .start { right: calc(16px * var(--ts)); }
        .touch-controls .select { right: calc(90px * var(--ts)); }
      </style>
      <div class="tc dpad" data-dpad></div>
      <div class="tc btn jump" data-action="jump">A</div>
      <div class="tc btn attack" data-action="attack">B</div>
      <div class="tc btn special" data-action="special">C</div>
      <div class="tc btn start" data-action="start">START</div>
      <div class="tc btn select" data-action="select">SELECT</div>`;
    container.appendChild(this.root);
    this.dpad = this.root.querySelector('[data-dpad]') as HTMLElement;
    this.bind();
  }

  static likelyTouchDevice(): boolean {
    return typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
  }

  setScale(scale: number): void {
    this.root.style.setProperty('--ts', String(scale));
  }

  show(on: boolean): void {
    this.visible = on;
    this.root.classList.toggle('visible', on);
    if (!on) this.down.clear();
  }

  get shown(): boolean {
    return this.visible;
  }

  private bind(): void {
    const buttons = this.root.querySelectorAll<HTMLElement>('[data-action]');
    buttons.forEach((el) => {
      const action = el.dataset.action as Action;
      const press = (e: PointerEvent) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.down.add(`touch:${action}`);
        el.classList.add('active');
      };
      const release = (e: PointerEvent) => {
        e.preventDefault();
        this.down.delete(`touch:${action}`);
        el.classList.remove('active');
      };
      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
    });

    const dpadUpdate = (e: PointerEvent) => {
      const r = this.dpad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const dead = 0.22;
      this.setDir('left', dx < -dead);
      this.setDir('right', dx > dead);
      this.setDir('up', dy < -dead);
      this.setDir('down', dy > dead);
    };
    const dpadClear = () => {
      for (const a of ['left', 'right', 'up', 'down']) this.down.delete(`touch:${a}`);
    };
    this.dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dpad.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { dpad: true });
      dpadUpdate(e);
    });
    this.dpad.addEventListener('pointermove', (e) => {
      if (this.pointers.get(e.pointerId)?.dpad) dpadUpdate(e);
    });
    const end = (e: PointerEvent) => {
      if (this.pointers.delete(e.pointerId)) dpadClear();
    };
    this.dpad.addEventListener('pointerup', end);
    this.dpad.addEventListener('pointercancel', end);
  }

  private setDir(action: Action, on: boolean): void {
    if (on) this.down.add(`touch:${action}`);
    else this.down.delete(`touch:${action}`);
  }

  poll(): ReadonlySet<Code> {
    return this.down;
  }
}
