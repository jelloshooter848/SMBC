/** Pushes text to an aria-live region so screen readers hear menu and game events. */
export class Announcer {
  private el: HTMLElement | null;
  enabled = true;
  private last = '';
  constructor(el: HTMLElement | null) {
    this.el = el;
  }
  say(text: string): void {
    if (!this.enabled || !this.el) return;
    // Re-announce identical text by clearing first.
    if (text === this.last) this.el.textContent = '';
    this.last = text;
    requestAnimationFrame(() => {
      if (this.el) this.el.textContent = text;
    });
  }
}

export const NULL_ANNOUNCER = { say(): void {}, enabled: false } as unknown as Announcer;
