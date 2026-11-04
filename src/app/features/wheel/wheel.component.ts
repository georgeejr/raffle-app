import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input,
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
          [class.spinning]="isSpinning()"
          [class.draggable]="!isSpinning()"
          [class.dragging]="isDragging()"
          (mousedown)="onPointerDown($event)"
          (touchstart)="onTouchStart($event)"
          (touchmove)="onTouchMove($event)"
          (touchend)="onTouchEnd($event)"
          (touchcancel)="onTouchEnd($event)">
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
      max-width: 100%;
    }

    .barrel-casing {
      position: relative;
      background: #0a0d0a;
      // border-radius: 28px;
      padding: 12px;
      // border: 3px solid #2d8a3a;
      // box-shadow: 0 16px 40px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.1);
      max-width: 100%;
      box-sizing: border-box;
    }

    .wheel-canvas {
      display: block;
      border-radius: 20px;
      max-width: 100%;
      height: auto;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;

      &.draggable {
        cursor: grab;
      }
      &.dragging {
        cursor: grabbing;
      }
    }
  `]
})
export class WheelComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('wheelCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // Exactly 14 virtual slots around the 360-degree cylinder drum
  // This guarantees exactly 5 to 7 clearly visible names on the front face regardless of total participant count!
  private readonly DRUM_SLOTS = 14;

  private _segments: WheelSegment[] = [];
  private hasInitializedRandomStart = false;

  @Input()
  set segments(val: WheelSegment[]) {
    this._segments = val || [];

    if (this._segments.length === 0) {
      this.reelSlots.clear();
      this.hasInitializedRandomStart = false;
      this.currentAngle = 0;
      this.scheduleDraw();
      return;
    }

    if (!this.hasInitializedRandomStart) {
      this.initRandomStartPosition();
      this.scheduleDraw();
      return;
    }

    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    const centerSlot = Math.round(-this.currentAngle / sliceAngle);
    const centerParticipant = this.reelSlots.get(centerSlot);

    // Check if the participant in the center slot was marked drawn / removed from eligible list
    const isWinnerRemoved = centerParticipant && !this._segments.some(p => p.id === centerParticipant.id);

    if (isWinnerRemoved) {
      // Automatically remove the won participant from the wheel
      // and smoothly shift the upcoming neighbor slots into place
      // so all neighboring names remain 100% consistent!
      const maxKey = centerSlot + 8;
      for (let s = centerSlot; s <= maxKey; s++) {
        const next = this.reelSlots.get(s + 1) || this.getFallbackParticipant(s + 1, this._segments);
        this.reelSlots.set(s, next);
      }
      this.reelSlots.delete(maxKey + 1);

      // Clean up any other slot in reelSlots containing the removed participant ID
      for (const [k, p] of this.reelSlots.entries()) {
        if (p.id === centerParticipant.id) {
          const replacementIdx = Math.abs(k) % this._segments.length;
          this.reelSlots.set(k, this._segments[replacementIdx]);
        }
      }
    }

    for (const key of Array.from(this.reelSlots.keys())) {
      if (Math.abs(key - centerSlot) > 6) {
        this.reelSlots.delete(key);
      }
    }

    this.scheduleDraw();
  }
  get segments(): WheelSegment[] {
    return this._segments;
  }

  private getFallbackParticipant(slotIndex: number, list: WheelSegment[]): WheelSegment {
    if (list.length === 0) return { id: 0, label: '' };
    const idx = ((slotIndex % list.length) + list.length) % list.length;
    return list[idx];
  }

  @Input() size = 720;
  @Output() spinRequested = new EventEmitter<'down' | 'up'>();
  @Output() winnerSelected = new EventEmitter<WheelSegment>();

  readonly isSpinning = signal(false);
  readonly isDragging = signal(false);

  private dragStartY = 0;
  private dragLastY = 0;
  private dragStartAngle = 0;
  private dragLastTime = 0;
  private dragVelocity = 0;
  private hasMovedWhileDragging = false;

  private ctx: CanvasRenderingContext2D | null = null;
  private currentAngle = 0;
  private animFrame: number | null = null;
  private lastTickIndex = -1;
  private lastTickTime = 0;

  // Virtual reel buffer mapping slot indices to participants for smooth streaming spins
  private reelSlots = new Map<number, WheelSegment>();

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
    if (!this.hasInitializedRandomStart && this._segments.length > 0) {
      this.initRandomStartPosition();
    }
    this.scheduleDraw();
  }

  ngAfterViewInit(): void {
    this.initCtx();
    this.scheduleDraw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['size']) {
      this.scheduleDraw();
    }
  }

  private initRandomStartPosition(): void {
    if (this._segments.length === 0) return;
    const n = this._segments.length;
    const randomIndex = Math.floor(Math.random() * n);
    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    this.currentAngle = -(randomIndex * sliceAngle);
    this.hasInitializedRandomStart = true;

    // Pre-populate initial visible slots in reelSlots
    for (let s = randomIndex - 6; s <= randomIndex + 6; s++) {
      const idx = ((s % n) + n) % n;
      this.reelSlots.set(s, this._segments[idx]);
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

  onPointerDown(event: MouseEvent): void {
    if (this.isSpinning() || event.button !== 0) return;
    this.startDrag(event.clientY);
  }

  onTouchStart(event: TouchEvent): void {
    if (this.isSpinning() || event.touches.length === 0) return;
    this.startDrag(event.touches[0].clientY);
  }

  private startDrag(clientY: number): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.isDragging.set(true);
    this.dragStartY = clientY;
    this.dragLastY = clientY;
    this.dragStartAngle = this.currentAngle;
    this.dragLastTime = performance.now();
    this.dragVelocity = 0;
    this.hasMovedWhileDragging = false;
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.isDragging() || this.isSpinning()) return;
    this.processDragMove(event.clientY);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging() || this.isSpinning() || event.touches.length === 0) return;
    event.preventDefault();
    this.processDragMove(event.touches[0].clientY);
  }

  private processDragMove(clientY: number): void {
    const deltaY = clientY - this.dragStartY;
    if (Math.abs(deltaY) > 4) {
      this.hasMovedWhileDragging = true;
    }
    const now = performance.now();
    const dt = now - this.dragLastTime;
    if (dt > 0) {
      const dy = clientY - this.dragLastY;
      this.dragVelocity = this.dragVelocity * 0.4 + (dy / dt) * 0.6;
    }
    this.dragLastY = clientY;
    this.dragLastTime = now;

    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    // Drag ratio: 110px dragging translates to 1 slot of rotation
    const angleDelta = deltaY * (sliceAngle / 110);
    this.currentAngle = this.dragStartAngle + angleDelta;

    // Play tick sound when crossing slot boundary while dragging
    const currentTickIndex = Math.floor((-this.currentAngle + sliceAngle / 2) / sliceAngle);
    if (currentTickIndex !== this.lastTickIndex) {
      this.lastTickIndex = currentTickIndex;
      if (now - this.lastTickTime > 40) {
        this.lastTickTime = now;
        this.playTickSound();
      }
    }

    this.drawWheel();
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(event: MouseEvent): void {
    if (!this.isDragging()) return;
    this.endDrag();
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.isDragging()) return;
    this.endDrag();
  }

  private endDrag(): void {
    this.isDragging.set(false);
    if (!this.hasMovedWhileDragging) return;

    // Check if the release velocity constitutes a flick/fling to spin
    const speed = Math.abs(this.dragVelocity);
    if (speed > 0.42 && !this.isSpinning()) {
      // If drag velocity is positive, user dragged downwards -> spin 'down'. Otherwise 'up'.
      const direction: 'down' | 'up' = this.dragVelocity > 0 ? 'down' : 'up';
      this.spinRequested.emit(direction);
    } else {
      // Gently snap to the nearest slot
      this.snapToNearestSlot();
    }
  }

  private snapToNearestSlot(): void {
    if (this.isSpinning()) return;
    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    const currentSlotFloat = -this.currentAngle / sliceAngle;
    const nearestSlot = Math.round(currentSlotFloat);
    const targetAngle = -(nearestSlot * sliceAngle);
    const startAngle = this.currentAngle;
    const delta = targetAngle - startAngle;

    if (Math.abs(delta) < 0.001) return;

    const startTime = performance.now();
    const duration = 240;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      this.currentAngle = startAngle + delta * ease;
      this.drawWheel();
      if (p < 1 && !this.isDragging() && !this.isSpinning()) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  private getParticipantForSlot(slotIndex: number): WheelSegment {
    if (this.reelSlots.has(slotIndex)) {
      return this.reelSlots.get(slotIndex)!;
    }
    const n = this.segments.length;
    if (n === 0) return { id: 0, label: '' };
    const segIdx = ((slotIndex % n) + n) % n;
    return this.segments[segIdx];
  }

  private getColorForSlot(slotIndex: number): string {
    const colorIdx = ((slotIndex % this.COLORS.length) + this.COLORS.length) % this.COLORS.length;
    return this.COLORS[colorIdx];
  }

  /** Public method to trigger a spin */
  spin(direction: 'down' | 'up' = 'down'): void {
    if (this.isSpinning() || this.segments.length === 0) return;

    const n = this.segments.length;
    // Fair, uniform random winner selection from the entire participants list
    const winnerIndex = Math.floor(Math.random() * n);
    const winner = this.segments[winnerIndex];

    this.isSpinning.set(true);
    this.lastTickIndex = -1;
    this.lastTickTime = 0;

    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    const currentSlotFloat = -this.currentAngle / sliceAngle;
    const currentSlot = Math.round(currentSlotFloat);

    // Number of slots to advance: between 120 and 150 slots for an extended, suspenseful 8-second spin
    const spinSlots = 120 + Math.floor(Math.random() * 30);
    // Downward spin: targetSlot decreases (angle increases, names roll top -> bottom)
    // Upward spin: targetSlot increases (angle decreases, names roll bottom -> top)
    const targetSlot = direction === 'down' ? currentSlot - spinSlots : currentSlot + spinSlots;

    // Assign the winner to the exact landing slot
    this.reelSlots.set(targetSlot, winner);

    // Populate passing slots with random participants from segments so names fly by during spin
    if (direction === 'down') {
      for (let s = currentSlot - 1; s > targetSlot; s--) {
        if (!this.reelSlots.has(s)) {
          const randIdx = Math.floor(Math.random() * n);
          this.reelSlots.set(s, this.segments[randIdx]);
        }
      }
      for (let s = targetSlot - 1; s >= targetSlot - 10; s--) {
        if (!this.reelSlots.has(s)) {
          const randIdx = Math.floor(Math.random() * n);
          this.reelSlots.set(s, this.segments[randIdx]);
        }
      }
      for (let s = targetSlot + 1; s <= targetSlot + 10; s++) {
        if (!this.reelSlots.has(s)) {
          const randIdx = Math.floor(Math.random() * n);
          this.reelSlots.set(s, this.segments[randIdx]);
        }
      }
    } else {
      for (let s = currentSlot + 1; s < targetSlot; s++) {
        if (!this.reelSlots.has(s)) {
          const randIdx = Math.floor(Math.random() * n);
          this.reelSlots.set(s, this.segments[randIdx]);
        }
      }
      for (let s = targetSlot + 1; s <= targetSlot + 10; s++) {
        if (!this.reelSlots.has(s)) {
          const randIdx = Math.floor(Math.random() * n);
          this.reelSlots.set(s, this.segments[randIdx]);
        }
      }
      for (let s = targetSlot - 1; s >= targetSlot - 10; s--) {
        if (!this.reelSlots.has(s)) {
          const randIdx = Math.floor(Math.random() * n);
          this.reelSlots.set(s, this.segments[randIdx]);
        }
      }
    }

    // Clean up distant slots to conserve memory
    const minKeep = Math.min(currentSlot, targetSlot) - 20;
    const maxKeep = Math.max(currentSlot, targetSlot) + 20;
    for (const key of Array.from(this.reelSlots.keys())) {
      if (key < minKeep || key > maxKeep) {
        this.reelSlots.delete(key);
      }
    }

    const startAngle = this.currentAngle;
    const targetAngle = -(targetSlot * sliceAngle);

    this.startSpinAnimation(startAngle, targetAngle, winner);
  }

  /**
   * Smooth, high-suspense deceleration curve for 8-second spin:
   * - 0.0s - 3.5s: Fast, high-energy spin blur of passing names
   * - 3.5s - 4.5s: Smooth gradual deceleration as names become clearly legible
   * - 4.5s - 8.0s: Extended suspense crawl (~3.5 full seconds!), ticking slot-by-slot right into the winner
   */
  private easeOutSuspense(t: number): number {
    const p1x = 0.10, p1y = 0.78;
    const p2x = 0.22, p2y = 1.0;

    let u = t;
    for (let i = 0; i < 6; i++) {
      const oneMinusU = 1 - u;
      const currentX = 3 * oneMinusU * oneMinusU * u * p1x + 3 * oneMinusU * u * u * p2x + u * u * u;
      const slope = 3 * oneMinusU * oneMinusU * p1x + 6 * oneMinusU * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
      if (Math.abs(slope) < 1e-6) break;
      u -= (currentX - t) / slope;
      u = Math.max(0, Math.min(1, u));
    }
    const oneMinusU = 1 - u;
    return 3 * oneMinusU * oneMinusU * u * p1y + 3 * oneMinusU * u * u * p2y + u * u * u;
  }

  private startSpinAnimation(startAngle: number, targetAngle: number, winner: WheelSegment): void {
    const duration = 8000; // 8 seconds of suspenseful spin with extended slow crawl
    const startTime = performance.now();
    const totalDelta = targetAngle - startAngle;
    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth suspenseful deceleration curve
      const ease = this.easeOutSuspense(progress);

      this.currentAngle = startAngle + totalDelta * ease;

      // Play tick sound as slots cross center
      const currentTickIndex = Math.floor((-this.currentAngle + sliceAngle / 2) / sliceAngle);
      if (currentTickIndex !== this.lastTickIndex) {
        this.lastTickIndex = currentTickIndex;
        const minInterval = progress > 0.45 ? 18 : 35;
        if (now - this.lastTickTime > minInterval) {
          this.lastTickTime = now;
          this.playTickSound();
        }
      }

      this.drawWheel();

      if (progress < 1) {
        this.animFrame = requestAnimationFrame(step);
      } else {
        this.currentAngle = targetAngle;
        this.drawWheel();
        this.isSpinning.set(false);

        setTimeout(() => {
          this.winnerSelected.emit(winner);
          this.playWinSound();
        }, 400);
      }
    };

    this.playTickSound();
    this.animFrame = requestAnimationFrame(step);
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

    const K = this.DRUM_SLOTS;
    const sliceAngle = (Math.PI * 2) / K;
    const radius = cy * 0.88;

    // Center slot in floating units
    const centerSlotFloat = -this.currentAngle / sliceAngle;
    const centerSlotInt = Math.round(centerSlotFloat);

    // Collect visible 3D drum slot panels (only ~7 panels on front face)
    interface DrumPanel {
      slotIndex: number;
      segment: WheelSegment;
      color: string;
      thetaCenter: number;
      yTop: number;
      yBot: number;
      wTop: number;
      wBot: number;
      zScale: number;
    }

    const panels: DrumPanel[] = [];

    // Test slots within 4 slots above and below center
    for (let j = centerSlotInt - 4; j <= centerSlotInt + 4; j++) {
      const thetaCenter = this.currentAngle + j * sliceAngle;

      // Only draw slots on front cylinder face
      if (Math.abs(thetaCenter) <= Math.PI / 2 + sliceAngle * 0.5) {
        const thetaTop = thetaCenter - sliceAngle / 2;
        const thetaBot = thetaCenter + sliceAngle / 2;

        // Clamp to front face horizon to avoid backface artifacts
        const cTop = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, thetaTop));
        const cBot = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, thetaBot));

        const yTop = cy + radius * Math.sin(cTop);
        const yBot = cy + radius * Math.sin(cBot);

        const zTop = Math.max(0.05, Math.cos(cTop));
        const zBot = Math.max(0.05, Math.cos(cBot));
        const zScale = Math.max(0.05, Math.cos(thetaCenter));

        const baseWidth = canvas.width * 0.86;
        const wTop = baseWidth * (0.62 + 0.38 * zTop);
        const wBot = baseWidth * (0.62 + 0.38 * zBot);

        panels.push({
          slotIndex: j,
          segment: this.getParticipantForSlot(j),
          color: this.getColorForSlot(j),
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
      const color = panel.color;
      const name = panel.segment.label;

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

      // Solid Vibrant Color Fill
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

        const fontSize = Math.min(32, Math.max(13, Math.floor((h / textScaleY) * 0.48)));
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
    const vignetteH = canvas.height * 0.18;
    const topVignette = ctx.createLinearGradient(0, 0, 0, vignetteH);
    topVignette.addColorStop(0, 'rgba(4,6,4,0.98)');
    topVignette.addColorStop(0.7, 'rgba(4,6,4,0.6)');
    topVignette.addColorStop(1, 'rgba(4,6,4,0)');
    ctx.fillStyle = topVignette;
    ctx.fillRect(0, 0, canvas.width, vignetteH);

    const botVignette = ctx.createLinearGradient(0, canvas.height - vignetteH, 0, canvas.height);
    botVignette.addColorStop(0, 'rgba(4,6,4,0)');
    botVignette.addColorStop(0.3, 'rgba(4,6,4,0.6)');
    botVignette.addColorStop(1, 'rgba(4,6,4,0.98)');
    ctx.fillStyle = botVignette;
    ctx.fillRect(0, canvas.height - vignetteH, canvas.width, vignetteH);

    // Glass Cabinet Curved Lens Reflection Overlay
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, 40, canvas.width * 0.7, 70, 0, 0, Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.restore();
  }

  private drawArcadeTargetOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number): void {
    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    const radius = cy * 0.88;
    const centerSlotHeight = Math.abs(radius * Math.sin(sliceAngle / 2) * 2);
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
    } catch (_) { }
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
    } catch (_) { }
  }
}
