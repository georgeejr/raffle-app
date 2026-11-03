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
      <div class="barrel-casing">
        <canvas #wheelCanvas
          [width]="size"
          [height]="size"
          class="wheel-canvas"
          [class.spinning]="isSpinning()">
        </canvas>
      </div>
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

    .barrel-casing {
      position: relative;
      background: #0a0d0a;
      border-radius: 28px;
      padding: 12px;
      border: 3px solid #2d8a3a;
      box-shadow: 0 16px 40px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.1);
    }

    .wheel-canvas {
      display: block;
      border-radius: 20px;
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
  private readonly friction = 0.995; // Smooth slow deceleration for suspense
  private readonly minVelocity = 0.0001;
  private lastTickIndex = -1;

  // Rich, vibrant multi-color palette for slot cards
  private readonly COLORS = [
    '#43A047', // Emerald Green
    '#1E88E5', // Royal Blue
    '#FB8C00', // Deep Tangerine
    '#8E24AA', // Amethyst Purple
    '#00ACC1', // Cyan / Teal
    '#E53935', // Crimson Red
    '#FDD835', // Golden Yellow
    '#D81B60', // Rose Magenta
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
    this.lastTickIndex = -1;
    // Initial velocity for 14-22 full vertical revolutions
    this.angularVelocity = (Math.PI * 2 * (14 + Math.random() * 8)) / 120;
    this.playTickSound();
    this.animate();
  }

  private getNumTotalSlots(): number {
    const n = this.segments.length;
    if (n === 0) return 0;
    const targetSlots = 24;
    const multiplier = Math.max(1, Math.ceil(targetSlots / n));
    return n * multiplier;
  }

  private animate(): void {
    this.angularVelocity *= this.friction;
    this.currentAngle += this.angularVelocity;

    this.drawWheel();

    const totalSlots = this.getNumTotalSlots();
    if (totalSlots > 0) {
      const sliceAngle = (Math.PI * 2) / totalSlots;
      const currentTickIndex = Math.floor(((-this.currentAngle) % (Math.PI * 2) + Math.PI * 2) / sliceAngle);

      if (currentTickIndex !== this.lastTickIndex) {
        this.lastTickIndex = currentTickIndex;
        if (this.angularVelocity > 0.003) this.playTickSound();
      }
    }

    if (this.angularVelocity > this.minVelocity) {
      this.animFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.isSpinning.set(false);
      this.angularVelocity = 0;
      this.resolveWinner();
    }
  }

  private resolveWinner(): void {
    const n = this.segments.length;
    if (n === 0) return;
    const totalSlots = this.getNumTotalSlots();
    const sliceAngle = (Math.PI * 2) / totalSlots;

    const normalized = ((-this.currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const slotIndex = Math.floor((normalized + sliceAngle / 2) / sliceAngle) % totalSlots;
    const winner = this.segments[slotIndex % n];

    // Smoothly snap angle to center slot
    this.currentAngle = -(slotIndex * sliceAngle);
    this.drawWheel();

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
    const n = this.segments.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3D Arcade Casing Deep Metallic Background Fill
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#040604');
    bgGrad.addColorStop(0.5, '#0d130d');
    bgGrad.addColorStop(1, '#040604');
    ctx.fillStyle = bgGrad;
    this.roundRect(ctx, 0, 0, canvas.width, canvas.height, 24);
    ctx.fill();

    if (n === 0) {
      this.drawEmpty(ctx, cx, cy);
      return;
    }

    const totalSlots = this.getNumTotalSlots();
    const sliceAngle = (Math.PI * 2) / totalSlots;
    const radius = cy * 0.88;

    // Collect visible 3D drum slot panels
    interface DrumPanel {
      slotIndex: number;
      segmentIndex: number;
      thetaCenter: number;
      yTop: number;
      yBot: number;
      wTop: number;
      wBot: number;
      zScale: number;
    }

    const panels: DrumPanel[] = [];

    for (let i = 0; i < totalSlots; i++) {
      let thetaCenter = (this.currentAngle + i * sliceAngle) % (Math.PI * 2);
      if (thetaCenter > Math.PI) thetaCenter -= Math.PI * 2;
      if (thetaCenter < -Math.PI) thetaCenter += Math.PI * 2;

      // Only draw slots on front cylinder face
      if (Math.abs(thetaCenter) <= Math.PI / 2 + sliceAngle) {
        const thetaTop = thetaCenter - sliceAngle / 2;
        const thetaBot = thetaCenter + sliceAngle / 2;

        const yTop = cy + radius * Math.sin(thetaTop);
        const yBot = cy + radius * Math.sin(thetaBot);

        const zTop = Math.max(0.05, Math.cos(thetaTop));
        const zBot = Math.max(0.05, Math.cos(thetaBot));
        const zScale = Math.max(0.05, Math.cos(thetaCenter));

        const baseWidth = canvas.width * 0.86;
        const wTop = baseWidth * (0.62 + 0.38 * zTop);
        const wBot = baseWidth * (0.62 + 0.38 * zBot);

        panels.push({
          slotIndex: i,
          segmentIndex: i % n,
          thetaCenter,
          yTop,
          yBot,
          wTop,
          wBot,
          zScale
        });
      }
    }

    // Sort by depth (furthest back rendered first)
    panels.sort((a, b) => a.zScale - b.zScale);

    // Render continuous 0-gap drum panels
    panels.forEach(panel => {
      const color = this.COLORS[panel.segmentIndex % this.COLORS.length];
      const name = this.segments[panel.segmentIndex].label;

      const y1 = Math.min(panel.yTop, panel.yBot);
      const y2 = Math.max(panel.yTop, panel.yBot);
      const h = y2 - y1;
      const yMid = (y1 + y2) / 2;

      if (h <= 1) return;

      const w1 = panel.yTop <= panel.yBot ? panel.wTop : panel.wBot;
      const w2 = panel.yTop <= panel.yBot ? panel.wBot : panel.wTop;

      ctx.save();

      // 3D Perspective Quadrilateral (Trapezoid Panel) - ZERO GAP
      ctx.beginPath();
      ctx.moveTo(cx - w1 / 2, y1);
      ctx.lineTo(cx + w1 / 2, y1);
      ctx.lineTo(cx + w2 / 2, y2);
      ctx.lineTo(cx - w2 / 2, y2);
      ctx.closePath();

      // Solid Vibrant Color Fill (No Gradient)
      ctx.fillStyle = color;
      ctx.fill();

      // Seamless Drum Slat Divider Line (Shadow + Highlight)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Realistic 3D Cylindrical Text Foreshortening
      if (h > 12 && panel.zScale > 0.12) {
        ctx.save();
        ctx.translate(cx, yMid);
        // Squash text height proportional to 3D cylinder angle foreshortening
        const textScaleY = Math.max(0.35, Math.pow(panel.zScale, 0.85));
        ctx.scale(1, textScaleY);

        const fontSize = Math.min(28, Math.max(13, Math.floor((h / textScaleY) * 0.48)));
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxW = (w1 + w2) / 2 - 24;
        const maxChars = Math.max(3, Math.floor(maxW / (fontSize * 0.55)));
        const label = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
        ctx.fillText(label, 0, 0);

        ctx.restore();
      }

      ctx.restore();
    });

    // 3D Chrome Side Bezel Rails (Left & Right Drum Edges)
    if (panels.length > 0) {
      ctx.save();
      // Sort visible drum edge points by Y
      const leftPts: { x: number; y: number }[] = [];
      const rightPts: { x: number; y: number }[] = [];

      panels.forEach(p => {
        leftPts.push({ x: cx - p.wTop / 2, y: p.yTop });
        leftPts.push({ x: cx - p.wBot / 2, y: p.yBot });
        rightPts.push({ x: cx + p.wTop / 2, y: p.yTop });
        rightPts.push({ x: cx + p.wBot / 2, y: p.yBot });
      });

      leftPts.sort((a, b) => a.y - b.y);
      rightPts.sort((a, b) => a.y - b.y);

      // Render Left 3D Metallic Rail
      ctx.beginPath();
      if (leftPts.length > 0) {
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
          ctx.lineTo(leftPts[i].x, leftPts[i].y);
        }
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Render Right 3D Metallic Rail
      ctx.beginPath();
      if (rightPts.length > 0) {
        ctx.moveTo(rightPts[0].x, rightPts[0].y);
        for (let i = 1; i < rightPts.length; i++) {
          ctx.lineTo(rightPts[i].x, rightPts[i].y);
        }
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    // Draw Timezone Arcade Golden Pointer & Center Target Frame
    this.drawArcadeTargetOverlay(ctx, cx, cy, canvas.width);

    // Top and Bottom 3D Cylinder Depth Vignette Fades
    const topVignette = ctx.createLinearGradient(0, 0, 0, 95);
    topVignette.addColorStop(0, 'rgba(4,6,4,0.98)');
    topVignette.addColorStop(0.7, 'rgba(4,6,4,0.6)');
    topVignette.addColorStop(1, 'rgba(4,6,4,0)');
    ctx.fillStyle = topVignette;
    ctx.fillRect(0, 0, canvas.width, 95);

    const botVignette = ctx.createLinearGradient(0, canvas.height - 95, 0, canvas.height);
    botVignette.addColorStop(0, 'rgba(4,6,4,0)');
    botVignette.addColorStop(0.3, 'rgba(4,6,4,0.6)');
    botVignette.addColorStop(1, 'rgba(4,6,4,0.98)');
    ctx.fillStyle = botVignette;
    ctx.fillRect(0, canvas.height - 95, canvas.width, 95);

    // Glass Cabinet Curved Curved Lens Reflection Overlay
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, 40, canvas.width * 0.7, 70, 0, 0, Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.restore();
  }

  private drawArcadeTargetOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number): void {
    const totalSlots = this.getNumTotalSlots();
    const sliceAngle = totalSlots > 0 ? (Math.PI * 2) / totalSlots : 0.2;
    const radius = cy * 0.88;
    const centerSlotHeight = Math.max(50, Math.abs(radius * Math.sin(sliceAngle / 2) * 2));
    const frameWidth = width * 0.88;
    const x = cx - frameWidth / 2;
    const y = cy - centerSlotHeight / 2;

    ctx.save();

    // Golden Target Selection Frame with Bevel & Glow
    ctx.strokeStyle = '#ffe033';
    ctx.lineWidth = 4.5;
    ctx.shadowColor = 'rgba(255, 224, 51, 0.75)';
    ctx.shadowBlur = 16;
    this.roundRect(ctx, x, y, frameWidth, centerSlotHeight, 8);
    ctx.stroke();

    // Inner White Accent Line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    this.roundRect(ctx, x + 2, y + 2, frameWidth - 4, centerSlotHeight - 4, 6);
    ctx.stroke();

    // Center Slot Glass Tint Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.roundRect(ctx, x, y, frameWidth, centerSlotHeight, 8);
    ctx.fill();

    // Large 3D Arcade Golden Triangular Selection Pointers (Left & Right)
    const arrowSize = 24;

    // Right Pointer (Golden 3D Metallic Triangle pointing left)
    const rightGrad = ctx.createLinearGradient(x + frameWidth + 2, cy - arrowSize, x + frameWidth + arrowSize + 6, cy + arrowSize);
    rightGrad.addColorStop(0, '#fff5a3');
    rightGrad.addColorStop(0.5, '#ffcc00');
    rightGrad.addColorStop(1, '#b88600');

    ctx.fillStyle = rightGrad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(x + frameWidth + arrowSize + 6, cy - arrowSize);
    ctx.lineTo(x + frameWidth + 2, cy);
    ctx.lineTo(x + frameWidth + arrowSize + 6, cy + arrowSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Left Pointer (Golden 3D Metallic Triangle pointing right)
    const leftGrad = ctx.createLinearGradient(x - arrowSize - 6, cy - arrowSize, x - 2, cy + arrowSize);
    leftGrad.addColorStop(0, '#fff5a3');
    leftGrad.addColorStop(0.5, '#ffcc00');
    leftGrad.addColorStop(1, '#b88600');

    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(x - arrowSize - 6, cy - arrowSize);
    ctx.lineTo(x - 2, cy);
    ctx.lineTo(x - arrowSize - 6, cy + arrowSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawEmpty(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#6b736b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add participants to begin', cx, cy);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private lighten(hex: string, amount: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  private darken(hex: string, amount: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
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
