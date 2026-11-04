import {
  Component, HostListener, OnInit, ViewChild, computed, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WheelComponent, WheelSegment } from './wheel.component';
import { ParticipantService } from '../../core/services/participant.service';
import { RaffleService } from '../../core/services/raffle.service';
import { WinnerService } from '../../core/services/winner.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { AppComponent } from '../../app';
import { Prize } from '../../core/models/models';

type DrawMode = 'sequential' | 'bulk';

interface WinnerDisplay {
  name: string;
  participantId: number;
}

@Component({
  selector: 'app-raffle-view',
  standalone: true,
  imports: [CommonModule, WheelComponent],
  template: `
    <div class="raffle-view" [class.fullscreen]="isFullscreen()">

      <!-- Top Bar -->
      <div class="raffle-topbar">
        <div class="topbar-left">
         
          @if (app.isNavCollapsed()) {
            <button class="btn btn-secondary btn-sm" (click)="app.toggleNav()" style="display:inline-flex;align-items:center;gap:6px">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <!-- <span>Nav</span> -->
            </button>
          }
           @if (app.isNavCollapsed() || isFullscreen()) {
            <div class="topbar-school-brand" (click)="app.toggleNav()" title="St. Paul School of Santa Maria">
              <img src="logo.png" alt="St. Paul Logo" class="topbar-logo" />
            </div>
          }
          <h1 class="page-title">SPSSM Family Day 2026 - Raffle Draw</h1>
          <div class="stat-row">
            <span class="stat-chip eligible">{{ eligibleCount() }} remaining participants</span>
            <span class="stat-chip winners">{{ totalWinners() }} drawn</span>
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" (click)="toggleSidePanel()">
            {{ showSidePanel() ? 'Hide Panel' : 'Show Panel' }}
          </button>
          <button class="btn btn-secondary btn-sm" (click)="toggleFullscreen()">
            {{ isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen' }}
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="raffle-main">

        <!-- LEFT: Wheel -->
        <div class="wheel-section">
          <app-wheel
            #wheel
            [segments]="wheelSegments()"
            [size]="720"
            (spinRequested)="triggerSpin($event)"
            (winnerSelected)="onWinnerSelected($event)">
          </app-wheel>

          <!-- Spin controls -->
          <div class="spin-controls">
            <!-- <div class="draw-mode-bar">
              <button class="mode-btn" [class.active]="drawMode() === 'sequential'"
                (click)="setDrawMode('sequential')" [disabled]="isSpinning()">
                Sequential
              </button>
              <button class="mode-btn" [class.active]="drawMode() === 'bulk'"
                (click)="setDrawMode('bulk')" [disabled]="isSpinning()">
                Bulk Draw
              </button>
            </div> -->

            <button class="spin-btn" [disabled]="!canSpin()" (click)="triggerSpin()">
              <span class="spin-btn-icon" [class.spinning]="isSpinning()">&#x25B6;</span>
              {{ spinLabel() }}
            </button>

            <!-- @if (activePrize() && activePrize()!.quantity_remaining > 1) {
              <div class="batch-progress">
                <span class="batch-label">{{ activePrize()!.quantity_remaining }} remaining</span>
                <div class="progress-bar" style="width:200px">
                  <div class="progress-fill" [style.width.%]="winProgress()"></div>
                </div>
              </div>
            } -->

            <p class="spin-hint">Press <kbd>Space</kbd> or <span style="font-weight:600">drag wheel</span> to spin &nbsp;·&nbsp; <kbd>F</kbd> for fullscreen</p>
          </div>
        </div>

        <!-- RIGHT: Prize Panel -->
        @if (showSidePanel()) {
          <div class="prize-panel">
            @if (activePrize(); as prize) {
              <div class="prize-card" [class.prize-major]="prize.tier === 'Major'">
                <div class="prize-card-header">
                  <span class="badge" [ngClass]="prize.tier === 'Major' ? 'badge-major' : 'badge-minor'">
                    {{ prize.tier }} Prize
                  </span>
                  <span class="qty-label">{{ prize.quantity_remaining }}/{{ prize.quantity_total }}</span>
                </div>

                @if (prize.image_data) {
                  <img [src]="prize.image_data" alt="Prize" class="prize-image" />
                } @else {
                  <div class="prize-no-image">
                    <span>No Image</span>
                  </div>
                }

                <div class="prize-body">
                  <h2 class="prize-title">{{ prize.title }}</h2>
                  @if (prize.description) {
                    <p class="prize-desc">{{ prize.description }}</p>
                  }
                  <div class="prize-chips">
                    <span class="chip">{{ prize.quantity_remaining }} remaining</span>
                    <span class="chip">{{ prize.draw_mode === 'bulk' ? 'Bulk' : 'Sequential' }}</span>
                  </div>
                </div>
              </div>
            } @else {
              <div class="no-prize-card card">
                <p class="no-prize-label">No active raffle prize selected.</p>
                <p class="no-prize-hint">Go to Participants &amp; Prizes to add prizes and activate one.</p>
              </div>
            }

            <!-- Prize Queue -->
            @if (upcomingPrizes().length > 0) {
              <div class="prize-queue card">
                <h4 class="queue-heading">Up Next</h4>
                <div class="queue-list">
                  @for (p of upcomingPrizes().slice(0, 4); track p.id) {
                    <div class="queue-row" (click)="selectPrize(p)">
                      <span class="badge" [ngClass]="p.tier === 'Major' ? 'badge-major' : 'badge-minor'">
                        {{ p.tier }}
                      </span>
                      <span class="queue-name">{{ p.title }}</span>
                      <span class="queue-qty">x{{ p.quantity_remaining }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Winner Modal -->
      @if (showWinnerModal()) {
        <div class="winner-backdrop" (click)="dismissModal()">
          <div class="winner-modal" (click)="$event.stopPropagation()">

            <div class="winner-confetti-bg">
              @for (i of confettiItems; track i) {
                <div class="confetti-dot" [style]="getConfettiStyle(i)"></div>
              }
            </div>

            <div class="winner-inner">
              <!-- Celebration Header -->
              <div class="winner-celebration-head">
                <div class="congrats-tag">
                  <span>CONGRATULATIONS!</span>
                </div>
                <p class="celebration-subtitle">We have a lucky raffle winner!</p>
              </div>

              <!-- Winner Name Display (Clean typography, no chunky green box) -->
              <div class="winner-hero">
                @if (currentBatchWinners().length === 1) {
                  <div class="single-winner-display">
                    <!-- <span class="winner-label">Raffle Winner</span> -->
                    <h1 class="winner-name-text">{{ currentBatchWinners()[0].name }}</h1>
                    <div class="winner-divider"></div>
                  </div>
                } @else {
                  <div class="batch-winners-container">
                    <span class="winner-label">{{ currentBatchWinners().length }} Winners Drawn</span>
                    <div class="batch-winners-grid">
                      @for (w of currentBatchWinners(); track (w.participantId ? w.participantId + '-' + i : i); let i = $index) {
                        <div class="batch-winner-card">
                          <span class="batch-rank">{{ i + 1 }}</span>
                          <span class="batch-name">{{ w.name }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Prize Award Details Card -->
              <div class="prize-award-card">
                @if (activePrize()?.image_data) {
                  <div class="prize-award-img-wrap">
                    <img [src]="activePrize()!.image_data" class="prize-award-img" alt="Prize" />
                  </div>
                }
                <div class="prize-award-info">
                  <span class="badge prize-award-badge" [ngClass]="activePrize()?.tier === 'Major' ? 'badge-major' : 'badge-minor'">
                    {{ activePrize()?.tier ? activePrize()!.tier + ' Prize' : 'Raffle Prize' }}
                  </span>
                  <div class="prize-award-title">{{ activePrize()?.title || 'Raffle Draw Prize' }}</div>
                  @if (activePrize()?.description) {
                    <div class="prize-award-desc">{{ activePrize()!.description }}</div>
                  }
                </div>
              </div>

              <!-- Claim Instructions Callout -->
              <div class="claim-instruction-box">
                <div class="claim-instruction-icon">
                  <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                </div>
                <div class="claim-instruction-text">
                  <span class="claim-heading">Prize Claiming:</span>
                  Please proceed to the <strong>PTO representative</strong> to verify and claim your prize!
                </div>
              </div>

              <!-- Actions -->
              <div class="winner-actions">
                @if (needsMoreSpins()) {
                  <button class="btn btn-primary btn-next-spin" (click)="continueSpinning()">
                    <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span>Spin Again ({{ remainingSpins() }} left)</span>
                  </button>
                } @else {
                  <button class="btn btn-primary" (click)="dismissModal()" style="min-width:110px">
                    Done
                  </button>
                }
                <button class="btn btn-secondary" (click)="dismissModal()" style="min-width:90px">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .raffle-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-base);
      overflow: hidden;

      &.fullscreen {
        position: fixed;
        inset: 0;
        z-index: 500;
        background: #f1f8f2;
      }
    }

    /* Top Bar */
    .raffle-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      background: var(--bg-white);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .topbar-left, .topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .topbar-school-brand {
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      transition: transform 0.15s ease;

      &:hover {
        transform: scale(1.05);
      }
    }

    .topbar-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      border-radius: 50%;
      background: #ffffff;
      padding: 2px;
      // border: 1.5px solid var(--border-green, #b0d4b5);
      // box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      flex-shrink: 0;
      display: block;
    }

    .page-title {
      font-size: 20px;
      color: var(--green-900);
      font-family: 'Outfit', sans-serif;
    }

    .stat-row { display: flex; gap: 8px; }
    .stat-chip {
      font-size: 15px;
      font-weight: 600;
      font-family: 'Outfit', sans-serif;
      padding: 3px 10px;
      border-radius: 4px;
      // border: 1px solid var(--border);
      background: var(--gray-50);
      color: var(--text-secondary);

      &.eligible { background: #e8f5e9; color: #1a5c22; border-color: #a5d6a7; }
      &.winners  { background: #fff8e1; color: #7a5c00; border-color: #f0cc70; }
    }

    /* Main */
    .raffle-main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Wheel Section */
    .wheel-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 16px 20px;
      background: var(--bg-base);
      min-width: 0;
      overflow-y: auto;
    }

    /* Spin Controls */
    .spin-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .draw-mode-bar {
      display: flex;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .mode-btn {
      padding: 7px 18px;
      border: none;
      background: var(--bg-white);
      color: var(--text-muted);
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
      border-right: 1px solid var(--border);
      &:last-child { border-right: none; }
      &.active { background: var(--green); color: white; }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .spin-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 28px;
      background: var(--green);
      color: white;
      border: 1px solid var(--green-800);
      border-radius: var(--radius);
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 18px;
      cursor: pointer;
      transition: background 0.15s;
      letter-spacing: 0.03em;

      &:hover:not(:disabled) { background: var(--green-800); }
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }

    .spin-btn-icon {
      font-size: 16px;
      display: inline-block;
      &.spinning { animation: spin-icon 0.4s linear infinite; }
    }

    .batch-progress {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .batch-label { font-size: 12px; color: var(--text-muted); font-weight: 600; font-family: 'Outfit', sans-serif; }

    .spin-hint {
      font-size: 12px;
      color: var(--text-muted);
      kbd {
        background: var(--gray-100);
        border: 1px solid var(--border);
        border-radius: 3px;
        padding: 1px 6px;
        font-family: monospace;
        font-size: 11px;
      }
    }

    /* Prize Panel */
    .prize-panel {
      width: 500px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px;
      border-left: 1px solid var(--border);
      overflow-y: auto;
      background: var(--bg-white);
    }

    .prize-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--bg-white);

      &.prize-major { border-color: #f0cc70; background: #fffdf0; }
    }

    .prize-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--gray-50);
    }
    .prize-card-header {
      .badge {
        font-size: 16px;
        border: 0;
        background-color: transparent;
      }
    }
    .qty-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      font-family: 'Outfit', sans-serif;
    }

    .prize-image {
      width: 100%;
      // height: 180px;
      object-fit: cover;
      display: block;
    }

    .prize-no-image {
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-50);
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      color: var(--text-muted);
    }

    .prize-body { padding: 14px 16px; }
    .prize-title {
      font-size: 18px;
      text-align: center;
      font-family: 'Outfit', sans-serif;
      color: var(--green-900);
      margin-bottom: 6px;
    }
    .prize-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
    .prize-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
    .chip {
      background: var(--green-100);
      color: var(--green-900);
      // border: 1px solid var(--border-green);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 18px;
      font-weight: 600;
      font-family: 'Outfit', sans-serif;
    }

    .no-prize-card {
      text-align: center;
      padding: 32px 20px;
    }
    .no-prize-label { font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
    .no-prize-hint  { font-size: 13px; color: var(--text-muted); }

    /* Queue */
    .prize-queue { }
    .queue-heading {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      margin-bottom: 10px;
    }
    .queue-list { display: flex; flex-direction: column; gap: 6px; }
    .queue-list .badge {border: 0;}
    .queue-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--gray-50);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: var(--green-50); border-color: var(--border-green); }
    }
    .queue-name { flex: 1; font-size: 15px; font-weight: 500; }
    .queue-qty  { font-size: 11px; color: var(--text-muted); font-weight: 600; }
    
    /* Winner Modal */
    .winner-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(26,29,26,0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 900;
      animation: fadeIn 0.2s ease;
      backdrop-filter: blur(2px);
    }

    .winner-modal {
      position: relative;
      background: var(--bg-white);
      border: 1px solid var(--border);
      border-top: 6px solid var(--green);
      border-radius: 16px;
      width: 82%;
      max-width: 1240px;
      max-height: 90vh;
      overflow-y: auto;
      animation: winner-pop 0.35s ease both;
      overflow: hidden;
      box-shadow: 0 20px 48px rgba(0,0,0,0.22);
    }

    .winner-confetti-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .confetti-dot {
      position: absolute;
      width: 8px; height: 8px;
      border-radius: 2px;
      animation: confetti-fall linear infinite;
    }

    .winner-inner {
      position: relative;
      z-index: 1;
      padding: 30px 28px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }

    .winner-celebration-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .congrats-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #925f0a;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 1.5px;
      font-family: 'Outfit', sans-serif;
    }

    .celebration-subtitle {
      font-size: 24px;
      color: var(--text-secondary);
      margin: 2px 0 0;
      font-weight: 500;
    }

    .winner-hero {
      width: 100%;
      text-align: center;
      padding: 4px 0;
    }

    .single-winner-display {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .winner-label {
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
      color: var(--text-muted);
      display: block;
      margin-bottom: 4px;
    }

    .winner-name-text {
      font-family: 'Outfit', sans-serif;
      font-size: 95px;
      font-weight: 800;
      color: var(--green-900);
      line-height: 1.15;
      margin: 0;
      letter-spacing: -0.5px;
      word-break: break-word;
      animation: winner-pop 0.4s ease both;
    }

    .winner-divider {
      width: 50px;
      height: 3px;
      background: linear-gradient(90deg, #c9952a, #2d8a3a);
      margin: 10px auto 0;
      border-radius: 2px;
    }

    .batch-winners-container {
      width: 100%;
    }

    .batch-winners-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 8px;
      padding: 2px;
    }

    .batch-winner-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--gray-50);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 14px;
      text-align: left;
    }

    .batch-rank {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--green);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .batch-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--green-900);
      flex: 1;
    }

    .prize-award-card {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--gray-50);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 16px;
      text-align: left;
    }

    .prize-award-img-wrap {
      width: 200px;
      // height: 168px;
      flex-shrink: 0;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 4px;
    }

    .prize-award-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .prize-award-info {
      flex: 1;
      min-width: 0;
    }

    .prize-award-badge {
      display: inline-block;
      margin-bottom: 4px;
     background: transparent;
     border: 0;
     font-size: 16px;
    }

    .prize-award-title {
      font-family: 'Outfit', sans-serif;
      font-size: 46px;
      font-weight: 700;
      color: var(--green-900);
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prize-award-desc {
      font-size: 16px;
      color: var(--text-secondary);
      margin-top: 2px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .claim-instruction-box {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      // background: #fbfbf4;
      // border: 1px dashed #d6cca4;
      border-radius: 8px;
      padding: 10px 14px;
      text-align: left;
    }

    .claim-instruction-icon {
      color: #925f0a;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .claim-instruction-text {
      font-size: 18px;
      color: #4f4732;
      line-height: 1.4;
    }

    .claim-heading {
      font-weight: 700;
      color: #744b05;
      margin-right: 4px;
    }

    .winner-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin-top: 2px;
    }

    .btn-next-spin {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 20px;
      font-weight: 600;
    }
  `]
})
export class RaffleViewComponent implements OnInit {
  @ViewChild('wheel') wheelRef!: WheelComponent;

  readonly confettiItems = Array.from({ length: 20 }, (_, i) => i);

  private _isSpinning = signal(false);
  private _showWinnerModal = signal(false);
  private _drawMode = signal<DrawMode>('sequential');
  private _currentBatchWinners = signal<WinnerDisplay[]>([]);
  private _spinBatchId = '';
  private _batchSize = 0;

  readonly isSpinning = this._isSpinning.asReadonly();
  readonly showWinnerModal = this._showWinnerModal.asReadonly();
  readonly drawMode = this._drawMode.asReadonly();
  readonly currentBatchWinners = this._currentBatchWinners.asReadonly();
  readonly isFullscreen = signal(false);
  readonly showSidePanel = signal(true);

  readonly wheelSegments = computed(() =>
    this.participantSvc.eligibleParticipants().map(p => ({ id: p.id, label: p.name }))
  );

  readonly eligibleCount = computed(() => this.participantSvc.eligibleCount());
  readonly allowRepeat = computed(() => this.participantSvc.allowRepeat());
  readonly activePrize = computed(() => this.raffleSvc.activePrize());
  readonly upcomingPrizes = computed(() => this.raffleSvc.pendingPrizes());
  readonly totalWinners = computed(() => this.winnerSvc.history().length);

  readonly winProgress = computed(() => {
    const p = this.activePrize();
    if (!p) return 0;
    const drawn = p.quantity_total - p.quantity_remaining;
    return (drawn / p.quantity_total) * 100;
  });

  readonly canSpin = computed(() =>
    !this._isSpinning() &&
    this.activePrize() !== null &&
    this.activePrize()!.status !== 'completed' &&
    this.wheelSegments().length > 0
  );

  readonly spinLabel = computed(() => {
    if (this._isSpinning()) return 'Spinning...';
    if (!this.activePrize()) return 'No Prize Selected';
    if (this.wheelSegments().length === 0) return 'No Participants';
    return 'Spin the Wheel';
  });

  readonly needsMoreSpins = computed(() => {
    const p = this.activePrize();
    return p && p.quantity_remaining > 0 && p.status !== 'completed' &&
      this._drawMode() === 'sequential' && this._currentBatchWinners().length < this._batchSize;
  });

  readonly remainingSpins = computed(() => this.activePrize()?.quantity_remaining ?? 0);

  constructor(
    public app: AppComponent,
    private participantSvc: ParticipantService,
    private raffleSvc: RaffleService,
    private winnerSvc: WinnerService,
    private confetti: ConfettiService
  ) { }

  ngOnInit(): void {
    this.participantSvc.refresh();
    this.raffleSvc.refresh();
    this.winnerSvc.refresh();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Space') { e.preventDefault(); this.triggerSpin(); }
    if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
    if (e.key === 'Escape') this.dismissModal();
  }

  triggerSpin(direction: 'down' | 'up' = 'down'): void {
    if (!this.canSpin()) return;
    const prize = this.activePrize()!;
    if (prize.draw_mode === 'bulk' || this._drawMode() === 'bulk') {
      this.doBulkDraw(prize); return;
    }
    this._isSpinning.set(true);
    this._spinBatchId = crypto.randomUUID();
    this._batchSize = prize.quantity_total;
    this.wheelRef.spin(direction);
  }

  onWinnerSelected(segment: WheelSegment): void {
    const prize = this.activePrize();
    if (!prize) return;
    this._isSpinning.set(false);
    this.raffleSvc.recordWinner(prize.id, segment.id, this._spinBatchId);
    if (!this.allowRepeat()) this.participantSvc.markDrawn(segment.id);
    this.winnerSvc.refresh();
    this._currentBatchWinners.set([{ name: segment.label, participantId: segment.id }]);
    this._showWinnerModal.set(true);
    this.confetti.fire({ colors: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FDD835', '#D81B60', '#00ACC1'] });
  }

  private doBulkDraw(prize: Prize): void {
    const eligible = this.participantSvc.eligibleParticipants();
    if (!eligible.length) return;
    const count = Math.min(prize.quantity_remaining, eligible.length);
    const selected = [...eligible].sort(() => Math.random() - 0.5).slice(0, count);
    this._spinBatchId = crypto.randomUUID();
    this._currentBatchWinners.set([]);
    selected.forEach(p => {
      this.raffleSvc.recordWinner(prize.id, p.id, this._spinBatchId);
      if (!this.allowRepeat()) this.participantSvc.markDrawn(p.id);
    });
    this.winnerSvc.refresh();
    this._currentBatchWinners.set(selected.map(p => ({ name: p.name, participantId: p.id })));
    this._showWinnerModal.set(true);
    this.confetti.fire({ colors: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FDD835', '#D81B60', '#00ACC1'] });
  }

  continueSpinning(): void {
    this._showWinnerModal.set(false);
    setTimeout(() => { this._isSpinning.set(true); this.wheelRef.spin('down'); }, 400);
  }

  dismissModal(): void {
    this._showWinnerModal.set(false);
    const prize = this.activePrize();
    if (!prize || prize.status === 'completed') this._currentBatchWinners.set([]);
  }

  selectPrize(prize: Prize): void {
    this._currentBatchWinners.set([]);
    this.raffleSvc.setActive(prize.id);
  }

  setDrawMode(mode: DrawMode): void { this._drawMode.set(mode); }
  toggleAllowRepeat(): void { this.participantSvc.setAllowRepeat(!this.allowRepeat()); }

  toggleSidePanel(): void { this.showSidePanel.update(v => !v); }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      this.isFullscreen.set(true);
    } else {
      document.exitFullscreen().catch(() => { });
      this.isFullscreen.set(false);
    }
  }

  getConfettiStyle(i: number): string {
    const colors = ['#2d8a3a', '#4caf5a', '#c9952a', '#f0c040', '#ffffff', '#1a4d22'];
    const color = colors[i % colors.length];
    const left = (i * 5.3) % 100;
    const delay = (i * 0.25) % 4;
    const dur = 2 + (i % 3);
    return `left:${left}%;top:-10px;background:${color};animation-delay:${delay}s;animation-duration:${dur}s`;
  }
}
