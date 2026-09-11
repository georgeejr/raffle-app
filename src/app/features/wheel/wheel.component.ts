import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input,
  OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface WheelSegment {
  id: number;
  label: string;
}

@Component({
  selector: 'app-wheel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wheel-wrapper">
      <!-- Pointer -->
      <div class="wheel-pointer"></div>

      <!-- Canvas -->
      <canvas #wheelCanvas
        [width]="size"
        [height]="size"
        class="wheel-canvas"
        [class.spinning]="isSpinning()">
      </canvas>

      <!-- Center hub -->
      <div class="wheel-hub"></div>
    </div>
  `,
  styles: [`
    .wheel-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
    }

    .wheel-canvas {
      border-radius: 50%;
      border: 4px solid #2d8a3a;
      outline: 6px solid #b0d4b5;
      display: block;
    }

    .wheel-pointer {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-top: 22px solid #1a4d22;
      z-index: 10;
    }

    .wheel-hub {
      position: absolute;
      width: 52px;
      height: 52px;
      background: #1a4d22;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      border: 3px solid #b0d4b5;
    }
  `]
})
export class WheelComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('wheelCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private _segments: WheelSegment[] = [];

  @Input()
  set segments(val: WheelSegment[]) {
    this._segments = val || [];
    this.scheduleDraw();
  }
  get segments(): WheelSegment[] {
    return this._segments;
  }

  @Input() size = 580;
  @Output() winnerSelected = new EventEmitter<WheelSegment>();

  readonly isSpinning = signal(false);

  private ctx: CanvasRenderingContext2D | null = null;
  private currentAngle = 0;
  private angularVelocity = 0;
  private animFrame: number | null = null;
  private readonly friction = 0.995; // Ultra-smooth slow deceleration for maximum excitement
  private readonly minVelocity = 0.0001;

  // Rich, vibrant multi-color palette for Wheel of Names
  private readonly COLORS = [
    '#E53935', // Crimson Red
    '#1E88E5', // Royal Blue
    '#43A047', // Emerald Green
    '#FB8C00', // Deep Tangerine
    '#8E24AA', // Amethyst Purple
    '#00ACC1', // Cyan / Teal
    '#D81B60', // Rose Magenta
    '#FDD835', // Golden Yellow
    '#3949AB', // Royal Indigo
    '#00897B', // Persian Teal
    '#F4511E', // Vibrant Coral
    '#7CB342', // Apple Lime
    '#5E35B1', // Deep Violet
    '#039BE5', // Sky Blue
    '#C0CA33', // Chartreuse
    '#FF4081', // Hot Pink
    '#00E676', // Bright Mint
    '#29B6F6', // Cerulean
    '#AB47BC', // Bright Orchid
    '#FF7043', // Warm Coral
    '#26A69A', // Turquoise
    '#FFA726', // Bright Amber
    '#66BB6A', // Spring Green
    '#EC407A', // Raspberry Pink
    '#42A5F5', // Cobalt Blue
    '#26C6DA', // Aqua Blue
    '#9CCC65', // Soft Lime
    '#EF5350', // Light Ruby
    '#7E57C2', // Medium Purple
    '#FFB74D'  // Golden Apricot
  ];

  private audioCtx: AudioContext | null = null;

  ngOnInit(): void {
    this.initCtx();
    this.scheduleDraw();
  }

  ngAfterViewInit(): void {
    this.initCtx();
    this.scheduleDraw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['segments'] || changes['size']) {
      this.scheduleDraw();
    }
  }

  ngOnDestroy(): void {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  private initCtx(): void {
    if (!this.ctx && this.canvasRef?.nativeElement) {
      this.ctx = this.canvasRef.nativeElement.getContext('2d');
    }
  }

  private scheduleDraw(): void {
    requestAnimationFrame(() => {
      this.initCtx();
      if (this.ctx) {
        this.drawWheel();
      }
    });
  }

  /** Public method to trigger a spin */
  spin(): void {
    if (this.isSpinning() || this.segments.length === 0) return;

    this.isSpinning.set(true);
    // Random spin: 14-22 full rotations + random offset for dramatic buildup
    this.angularVelocity = (Math.PI * 2 * (14 + Math.random() * 8)) / 120;
    this.playTickSound();
    this.animate();
  }

  private animate(): void {
    this.angularVelocity *= this.friction;
    this.currentAngle += this.angularVelocity;

    this.drawWheel();

    if (this.angularVelocity > this.minVelocity) {
      this.animFrame = requestAnimationFrame(() => this.animate());
      // Tick sound on each segment crossing down to slow velocity
      if (this.angularVelocity > 0.005) this.playTickSound();
    } else {
      this.isSpinning.set(false);
      this.angularVelocity = 0;
      this.resolveWinner();
    }
  }

  private resolveWinner(): void {
    if (this.segments.length === 0) return;
    const sliceAngle = (Math.PI * 2) / this.segments.length;
    // Pointer is at top (270° = -π/2). Find which segment is under it.
    const normalized = ((- this.currentAngle - Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor(normalized / sliceAngle) % this.segments.length;
    const winner = this.segments[index];
    setTimeout(() => {
      this.winnerSelected.emit(winner);
      this.playWinSound();
    }, 300);
  }

  drawWheel(): void {
    if (!this.canvasRef?.nativeElement) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 4;
    const n = this.segments.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (n === 0) {
      this.drawEmpty(ctx, cx, cy, radius);
      return;
    }

    const sliceAngle = (Math.PI * 2) / n;

    // Draw slices
    for (let i = 0; i < n; i++) {
      const startAngle = this.currentAngle + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const color = this.COLORS[i % this.COLORS.length];
      const midAngle = startAngle + sliceAngle / 2;

      // Slice fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Gradient per slice
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
      grad.addColorStop(0, this.lighten(color, 30));
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fill();

      // Slice border
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      this.drawLabel(ctx, this.segments[i].label, cx, cy, radius, midAngle, sliceAngle);
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a4d22';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    text: string, cx: number, cy: number, radius: number,
    midAngle: number, sliceAngle: number
  ): void {
    const n = this.segments.length;

    // Calculate font size based on slice count so text stays neat and readable
    let fontSize = 14;
    if (n > 40) fontSize = 9;
    else if (n > 25) fontSize = 11;
    else if (n > 15) fontSize = 12;
    else if (n > 8) fontSize = 14;
    else fontSize = 16;

    // Truncate if name is too long for the available slice length
    const maxChars = n > 35 ? 8 : n > 20 ? 12 : 18;
    const label = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;

    ctx.save();
    // 1. Move origin to center of wheel canvas
    ctx.translate(cx, cy);
    // 2. Rotate along the radial center angle of the slice
    ctx.rotate(midAngle);

    // 3. Set text properties
    ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right'; // Anchors the text end near the outer rim
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4;

    // 4. Draw text along the slice radius (from radius * 0.88 down toward hub)
    ctx.fillText(label, radius * 0.88, 0);

    ctx.restore();
  }

  private drawEmpty(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#e8f5e9');
    grad.addColorStop(1, '#c8e6c9');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#2d8a3a';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillStyle = '#6b736b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add participants to begin', cx, cy);
  }

  private lighten(hex: string, amount: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  // ---- Audio ----
  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  private playTickSound(): void {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 600 + Math.random() * 200;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (_) {}
  }

  private playWinSound(): void {
    try {
      const ctx = this.getAudioContext();
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (_) {}
  }
}
