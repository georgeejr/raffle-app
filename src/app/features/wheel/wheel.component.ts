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
      <div #barrelCasing class="barrel-casing">
        <canvas #wheelCanvas
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
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      flex: 1;
      align-self: stretch;
    }

    .wheel-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      flex: 1;
      align-self: stretch;
    }

    .barrel-casing {
      position: relative;
      background: #040604;
      width: 100%;
      max-width: 680px;
      height: 100%;
      border-radius: 20px;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      border: 2px solid #1a4d22;
      align-self: stretch;
    }

    .wheel-canvas {
      display: block;
      width: 100%;
      height: 100%;
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
  @ViewChild('barrelCasing', { static: true }) casingRef!: ElementRef<HTMLDivElement>;

  private resizeObserver: ResizeObserver | null = null;

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
    this.setupResizeObserver();
    this.measureAndResize();
    requestAnimationFrame(() => this.measureAndResize());
    this.scheduleDraw();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.measureAndResize();
  }

  private measureAndResize(): void {
    const casing = this.casingRef?.nativeElement;
    if (!casing) return;
    const rect = casing.getBoundingClientRect();
    if (rect.width > 60 && rect.height > 60) {
      this.updateDimensions(Math.floor(rect.width), Math.floor(rect.height));
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const casing = this.casingRef?.nativeElement;
    if (!casing) return;

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 60 && height > 60) {
          this.updateDimensions(Math.floor(width), Math.floor(height));
        }
      }
    });
    this.resizeObserver.observe(casing);
  }

  private updateDimensions(w: number, h: number): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this.initCtx();
      this.drawWheel();
    }
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
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
    const duration = 16000; // 16 seconds of suspenseful spin with extended slow crawl
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
    bgGrad.addColorStop(0, '#020402');
    bgGrad.addColorStop(0.5, '#070c08');
    bgGrad.addColorStop(1, '#020402');
    ctx.fillStyle = bgGrad;
    this.roundRect(ctx, 0, 0, canvas.width, canvas.height, 20);
    ctx.fill();

    if (n === 0) {
      this.drawEmpty(ctx, cx, cy);
      return;
    }

    const K = this.DRUM_SLOTS;
    const sliceAngle = (Math.PI * 2) / K;
    const radius = cy * 0.88;

    // Cylinder Drum Width: parallel straight sides (authentic 3D horizontal cylinder)
    const drumWidth = Math.min(canvas.width * 0.70, 450);
    const drumX = cx - drumWidth / 2;
    const railWidth = Math.max(12, Math.min(18, canvas.width * 0.032));
    const leftRailX = drumX - railWidth;
    const rightRailX = drumX + drumWidth;

    // Center slot in floating units
    const centerSlotFloat = -this.currentAngle / sliceAngle;
    const centerSlotInt = Math.round(centerSlotFloat);

    // Collect visible 3D drum slot panels (front cylinder face)
    interface DrumPanel {
      slotIndex: number;
      segment: WheelSegment;
      color: string;
      thetaCenter: number;
      yTop: number;
      yBot: number;
      cTop: number;
      cBot: number;
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
        const zScale = Math.max(0.01, Math.cos(thetaCenter));

        panels.push({
          slotIndex: j,
          segment: this.getParticipantForSlot(j),
          color: this.getColorForSlot(j),
          thetaCenter,
          yTop,
          yBot,
          cTop,
          cBot,
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

      if (h <= 0.8) return;

      ctx.save();

      // 1. Solid Vibrant Slat Color Fill (parallel cylinder width)
      ctx.beginPath();
      ctx.rect(drumX, y1, drumWidth, h);
      ctx.fillStyle = color;
      ctx.fill();

      // 2. Continuous 3D Cylindrical Curvature Shading (Lambertian cosine falloff)
      const slatGrad = ctx.createLinearGradient(0, panel.yTop, 0, panel.yBot);
      const shadowTop = (1 - Math.cos(panel.cTop)) * 0.88;
      const shadowBot = (1 - Math.cos(panel.cBot)) * 0.88;
      slatGrad.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.92, shadowTop).toFixed(3)})`);
      slatGrad.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.92, shadowBot).toFixed(3)})`);
      ctx.fillStyle = slatGrad;
      ctx.fill();

      // 3. Diffuse Specular Sheen across forward-facing slats
      if (panel.zScale > 0.55) {
        const glossAlpha = (panel.zScale - 0.55) * 0.20;
        ctx.fillStyle = `rgba(255, 255, 255, ${glossAlpha.toFixed(3)})`;
        ctx.fill();
      }

      // 4. Physical Slat Divider Groove (top shadow recess + bottom highlight line)
      ctx.beginPath();
      ctx.moveTo(drumX, y1);
      ctx.lineTo(drumX + drumWidth, y1);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(drumX, y2);
      ctx.lineTo(drumX + drumWidth, y2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 5. Realistic 3D Cylindrical Text Foreshortening
      if (h > 12 && panel.zScale > 0.12) {
        ctx.save();
        ctx.translate(cx, yMid);
        // Squash text height proportional to 3D cylinder angle foreshortening
        const textScaleY = Math.max(0.35, Math.pow(panel.zScale, 0.88));
        ctx.scale(1, textScaleY);

        const fontSize = Math.min(34, Math.max(14, Math.floor((h / textScaleY) * 0.44)));
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // High contrast arcade drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = '#ffffff';
        const maxW = drumWidth - 32;
        const maxChars = Math.max(3, Math.floor(maxW / (fontSize * 0.55)));
        const label = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
        ctx.fillText(label, 0, 0);

        ctx.restore();
      }

      ctx.restore();
    });

    // Inner Recess Shadows on left & right drum edges (cylinder set into mechanism)
    ctx.save();
    const leftDrumShadow = ctx.createLinearGradient(drumX, 0, drumX + 20, 0);
    leftDrumShadow.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    leftDrumShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftDrumShadow;
    ctx.fillRect(drumX, 0, 20, canvas.height);

    const rightDrumShadow = ctx.createLinearGradient(drumX + drumWidth - 20, 0, drumX + drumWidth, 0);
    rightDrumShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rightDrumShadow.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = rightDrumShadow;
    ctx.fillRect(drumX + drumWidth - 20, 0, 20, canvas.height);
    ctx.restore();

    // 3D Brushed Chrome Vertical Side Rails (Left & Right)
    ctx.save();
    // Left Rail
    const leftRailGrad = ctx.createLinearGradient(leftRailX, 0, leftRailX + railWidth, 0);
    leftRailGrad.addColorStop(0, '#151916');
    leftRailGrad.addColorStop(0.2, '#4a524c');
    leftRailGrad.addColorStop(0.5, '#d0d8d2');
    leftRailGrad.addColorStop(0.7, '#ffffff');
    leftRailGrad.addColorStop(0.85, '#6a736c');
    leftRailGrad.addColorStop(1, '#151916');
    ctx.fillStyle = leftRailGrad;
    ctx.fillRect(leftRailX, 0, railWidth, canvas.height);

    // Right Rail
    const rightRailGrad = ctx.createLinearGradient(rightRailX, 0, rightRailX + railWidth, 0);
    rightRailGrad.addColorStop(0, '#151916');
    rightRailGrad.addColorStop(0.15, '#6a736c');
    rightRailGrad.addColorStop(0.3, '#ffffff');
    rightRailGrad.addColorStop(0.5, '#d0d8d2');
    rightRailGrad.addColorStop(0.8, '#4a524c');
    rightRailGrad.addColorStop(1, '#151916');
    ctx.fillStyle = rightRailGrad;
    ctx.fillRect(rightRailX, 0, railWidth, canvas.height);

    // Rail Outer & Inner Edge Lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftRailX, 0); ctx.lineTo(leftRailX, canvas.height);
    ctx.moveTo(rightRailX + railWidth, 0); ctx.lineTo(rightRailX + railWidth, canvas.height);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(leftRailX + railWidth * 0.7, 0); ctx.lineTo(leftRailX + railWidth * 0.7, canvas.height);
    ctx.moveTo(rightRailX + railWidth * 0.3, 0); ctx.lineTo(rightRailX + railWidth * 0.3, canvas.height);
    ctx.stroke();
    ctx.restore();

    // Top and Bottom Deep Cabinet Interior Horizon Vignette
    const vignetteH = canvas.height * 0.22;
    const topVignette = ctx.createLinearGradient(0, 0, 0, vignetteH);
    topVignette.addColorStop(0, 'rgba(2,4,2,1.0)');
    topVignette.addColorStop(0.45, 'rgba(2,4,2,0.85)');
    topVignette.addColorStop(0.8, 'rgba(2,4,2,0.3)');
    topVignette.addColorStop(1, 'rgba(2,4,2,0)');
    ctx.fillStyle = topVignette;
    ctx.fillRect(0, 0, canvas.width, vignetteH);

    const botVignette = ctx.createLinearGradient(0, canvas.height - vignetteH, 0, canvas.height);
    botVignette.addColorStop(0, 'rgba(2,4,2,0)');
    botVignette.addColorStop(0.2, 'rgba(2,4,2,0.3)');
    botVignette.addColorStop(0.55, 'rgba(2,4,2,0.85)');
    botVignette.addColorStop(1, 'rgba(2,4,2,1.0)');
    ctx.fillStyle = botVignette;
    ctx.fillRect(0, canvas.height - vignetteH, canvas.width, vignetteH);

    // Golden Target Selection Frame with Bevel & Glow + Pointers
    const frameWidth = drumWidth + railWidth * 2 + 16;
    this.drawArcadeTargetOverlay(ctx, cx, cy, frameWidth);

    // Authentic Glass Cabinet Front Reflection Overlays
    ctx.save();
    // 1. Diagonal Specular Light Streak across glass pane
    const glassGrad = ctx.createLinearGradient(cx - canvas.width * 0.45, 0, cx + canvas.width * 0.45, canvas.height);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    glassGrad.addColorStop(0.32, 'rgba(255, 255, 255, 0)');
    glassGrad.addColorStop(0.42, 'rgba(255, 255, 255, 0.05)');
    glassGrad.addColorStop(0.49, 'rgba(255, 255, 255, 0.12)');
    glassGrad.addColorStop(0.54, 'rgba(255, 255, 255, 0.04)');
    glassGrad.addColorStop(0.66, 'rgba(255, 255, 255, 0)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Overhead Ambient Light Glare on upper glass
    const overheadGlare = ctx.createLinearGradient(0, 0, 0, 85);
    overheadGlare.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    overheadGlare.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    overheadGlare.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = overheadGlare;
    ctx.fillRect(0, 0, canvas.width, 85);

    // 3. Subtle Glass Perimeter Bezel Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 20);
    ctx.stroke();
    ctx.restore();
  }

  private drawArcadeTargetOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, frameWidth: number): void {
    const sliceAngle = (Math.PI * 2) / this.DRUM_SLOTS;
    const radius = cy * 0.88;
    const centerSlotHeight = Math.abs(radius * Math.sin(sliceAngle / 2) * 2);
    const x = cx - frameWidth / 2;
    const y = cy - centerSlotHeight / 2;

    ctx.save();

    // 1. Golden Target Selection Frame with Polished Bevel & Warm Glow
    const goldBevelGrad = ctx.createLinearGradient(x, y, x + frameWidth, y + centerSlotHeight);
    goldBevelGrad.addColorStop(0, '#fff9c4');
    goldBevelGrad.addColorStop(0.25, '#ffd54f');
    goldBevelGrad.addColorStop(0.5, '#ffb300');
    goldBevelGrad.addColorStop(0.75, '#ff8f00');
    goldBevelGrad.addColorStop(1, '#ffe082');

    ctx.strokeStyle = goldBevelGrad;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.75)';
    ctx.shadowBlur = 18;
    this.roundRect(ctx, x, y, frameWidth, centerSlotHeight, 8);
    ctx.stroke();

    // 2. Inner White-Gold Accent Line
    ctx.strokeStyle = 'rgba(255, 255, 240, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 0;
    this.roundRect(ctx, x + 2.5, y + 2.5, frameWidth - 5, centerSlotHeight - 5, 6);
    ctx.stroke();

    // 3. Center Slot Glass Tint Highlight
    const glassTint = ctx.createLinearGradient(0, y, 0, y + centerSlotHeight);
    glassTint.addColorStop(0, 'rgba(255, 245, 180, 0.12)');
    glassTint.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    glassTint.addColorStop(1, 'rgba(255, 245, 180, 0.10)');
    ctx.fillStyle = glassTint;
    this.roundRect(ctx, x, y, frameWidth, centerSlotHeight, 8);
    ctx.fill();

    // 4. Large 3D Arcade Golden Triangular Selection Pointers (Left & Right)
    const arrowHeight = 28;
    const arrowWidth = 22;

    // Right Pointer (Golden 3D Metallic Triangle pointing left)
    const rightGrad = ctx.createLinearGradient(x + frameWidth + 4, y, x + frameWidth + 4 + arrowWidth, y + centerSlotHeight);
    rightGrad.addColorStop(0, '#fff9c4');
    rightGrad.addColorStop(0.3, '#ffca28');
    rightGrad.addColorStop(0.7, '#ff8f00');
    rightGrad.addColorStop(1, '#b86000');

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = rightGrad;
    ctx.strokeStyle = '#fffde7';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + frameWidth + arrowWidth + 4, cy - arrowHeight / 2);
    ctx.lineTo(x + frameWidth + 2, cy);
    ctx.lineTo(x + frameWidth + arrowWidth + 4, cy + arrowHeight / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Left Pointer (Golden 3D Metallic Triangle pointing right)
    const leftGrad = ctx.createLinearGradient(x - arrowWidth - 4, y, x - 2, y + centerSlotHeight);
    leftGrad.addColorStop(0, '#fff9c4');
    leftGrad.addColorStop(0.3, '#ffca28');
    leftGrad.addColorStop(0.7, '#ff8f00');
    leftGrad.addColorStop(1, '#b86000');

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = leftGrad;
    ctx.strokeStyle = '#fffde7';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x - arrowWidth - 4, cy - arrowHeight / 2);
    ctx.lineTo(x - 2, cy);
    ctx.lineTo(x - arrowWidth - 4, cy + arrowHeight / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

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
