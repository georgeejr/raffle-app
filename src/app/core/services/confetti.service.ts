import { Injectable } from '@angular/core';

declare const confetti: any;

@Injectable({ providedIn: 'root' })
export class ConfettiService {
  private loaded = false;

  async fire(options: {
    colors?: string[];
    particleCount?: number;
    duration?: number;
  } = {}): Promise<void> {
    try {
      await this.ensureLoaded();
    } catch {
      return; // Graceful fallback if offline script load is blocked
    }

    if (typeof confetti === 'undefined') return;

    const {
      colors = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FDD835', '#D81B60', '#00ACC1'],
      particleCount = 140,
      duration = 3500
    } = options;

    const end = Date.now() + duration;

    const frame = () => {
      try {
        confetti({
          particleCount: 8,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
          zIndex: 9999
        });
        confetti({
          particleCount: 8,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
          zIndex: 9999
        });
      } catch (_) {}
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    // Initial burst on top of modal
    try {
      confetti({ particleCount, spread: 100, origin: { y: 0.5 }, colors, zIndex: 9999 });
      setTimeout(frame, 250);
    } catch (_) {}
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded || typeof confetti !== 'undefined') {
      this.loaded = true;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
      script.onload = () => { this.loaded = true; resolve(); };
      script.onerror = () => { resolve(); }; // Resolve gracefully even if offline
      document.head.appendChild(script);
    });
  }
}
