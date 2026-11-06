import {
  Component, HostListener, OnDestroy, OnInit, ViewChild, computed, signal
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
  gradeSection?: string;
  drawHistoryId?: number;
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
           <!-- @if (app.isNavCollapsed() || isFullscreen()) { -->
            <div class="topbar-school-brand" title="St. Paul School of Santa Maria">
              <img src="logo.png" alt="St. Paul Logo" class="topbar-logo" />
            </div>
          <!-- } -->
          <h1 class="page-title">SPSSM Family Day 2026 - Raffle Draw</h1>
          <div class="stat-row">
            <span class="stat-chip eligible">{{ eligibleCount() }} remaining participants</span>
            <span class="stat-chip winners">{{ totalWinners() }} drawn</span>
            @if (isGrandPrize()) {
              <span class="stat-chip grand-chip">Grand Prize Active — Full Pool Reset</span>
            }
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" [disabled]="totalWinners() === 0" (click)="viewLastDraw()" title="Redisplay the most recently drawn winner in the celebration modal">
           
            <span>View Last Draw</span>
          </button>
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
          @if (isGrandPrize()) {
            <div class="grand-prize-header-banner">
              <span class="grand-banner-stars">★ ★ ★</span>
              <span>GRAND PRIZE DRAW &nbsp;&middot;&nbsp; All Participants Eligible</span>
              <span class="grand-banner-stars">★ ★ ★</span>
            </div>
          }

          <div class="wheel-stage">
            <app-wheel
              #wheel
              [segments]="wheelSegments()"
              [spinDurationMs]="spinDurationMs()"
              (spinRequested)="triggerSpin($event)"
              (winnerSelected)="onWinnerSelected($event)">
            </app-wheel>
          </div>

          <!-- Spin controls -->
          <div class="spin-controls">
            <button class="spin-btn"
              [class.grand-spin-btn]="isGrandPrize()"
              [disabled]="!canSpin()"
              (click)="triggerSpin()">
              @if (isGrandPrize()) {
                <span class="grand-star">★</span>
                <span>{{ spinLabel() }}</span>
                <span class="grand-star">★</span>
              } @else {
                <span class="spin-btn-icon" [class.spinning]="isSpinning()">&#x25B6;</span>
                <span>{{ spinLabel() }}</span>
              }
            </button>

            <p class="spin-hint">Press <kbd>Space</kbd> or <span style="font-weight:600">drag wheel</span> to spin &nbsp;·&nbsp; <kbd>F</kbd> for fullscreen</p>
          </div>
        </div>

        <!-- RIGHT: Prize Panel -->
        @if (showSidePanel()) {
          <div class="prize-panel">
            @if (activePrize() || awardedPrize(); as prize) {
              <div class="prize-card" [class.prize-grand]="prize.tier === 'Grand'" [class.prize-major]="prize.tier === 'Major'" >
                <div class="prize-card-header">
                  <span class="badge" [ngClass]="prize.tier === 'Grand' ? 'badge-grand' : (prize.tier === 'Major' ? 'badge-major' : 'badge-minor')">
                    {{ prize.tier === 'Grand' ? 'Grand Prize' : (prize.tier + ' Prize') }}
                  </span>
                  <span class="qty-label">{{ prize.quantity_remaining }}/{{ prize.quantity_total }}</span>
                </div>

                @if (prize.image_data) {
                  <img [src]="prize.image_data" alt="Prize" class="prize-image" />
                }

                <div class="prize-body">
                  <h2 class="prize-title" [class.no-image]="!prize.image_data">{{ prize.title }}</h2>
                  @if (prize.description) {
                    <p class="prize-desc">{{ prize.description }}</p>
                  }
                  <div class="prize-chips">
                    <span class="chip">{{ prize.quantity_remaining }} remaining</span>
                    @if (prize.quantity_remaining > 1) {
                      <span class="chip" style="font-size:15px">{{ customBatchSize() > 1 ? ('Batch of ' + customBatchSize()) : 'Single Spin' }}</span>
                    }
                  </div>

                  <!-- Custom Bulk Draw Mode: Available for any prize with more than 1 item -->
                  @if (prize.quantity_remaining > 1 && !isSpinning()) {
                    <div class="sidebar-bulk-batch-box">
                      <div class="bulk-batch-header">
                        <span class="bulk-toolbar-title">Batch Draw Mode:</span>
                        <span class="bulk-pool-note">{{ prize.quantity_remaining }} left</span>
                      </div>
                      <div class="bulk-stepper-control">
                        <button type="button" class="stepper-btn" (click)="adjustBatchSize(-1)" [disabled]="customBatchSize() <= 1" title="Decrease batch size">&minus;</button>
                        <span class="stepper-count">{{ customBatchSize() }}</span>
                        <button type="button" class="stepper-btn" (click)="adjustBatchSize(1)" [disabled]="customBatchSize() >= prize.quantity_remaining" title="Increase batch size">&plus;</button>
                      </div>
                      <span class="stepper-subtext">
                        {{ customBatchSize() === 1 ? 'Draws 1 winner per spin' : ('Draws ' + customBatchSize() + ' winners at once') }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="no-prize-card card">
                <p class="no-prize-label">No active raffle prize selected.</p>
                <p class="no-prize-hint">Go to Participants &amp; Prizes to add prizes and activate one.</p>
              </div>
            }

            <!-- All Raffle Prizes List (Excludes Done Prizes & Arrangeable) -->
            @if (allPrizes().length > 0) {
              <div class="prize-queue card">
                <div class="queue-header-row">
                  <h4 class="queue-heading">Raffle Prizes</h4>
                  <span class="queue-badge-count">{{ allPrizes().length }}</span>
                </div>
                <p class="queue-subhint">Drag to arrange draw queue sequence</p>
                <div class="queue-list all-prizes-list">
                  @for (p of allPrizes(); track p.id; let i = $index) {
                    <div class="queue-row"
                      [class.active-queue-row]="activePrize()?.id === p.id"
                      [class.is-dragging]="draggedPrizeIndex() === i"
                      [class.drag-over]="dragOverPrizeIndex() === i && draggedPrizeIndex() !== i"
                      draggable="true"
                      (dragstart)="onPrizeDragStart($event, i)"
                      (dragover)="onPrizeDragOver($event, i)"
                      (dragleave)="onPrizeDragLeave(i)"
                      (drop)="onPrizeDrop($event, i)"
                      (dragend)="onPrizeDragEnd()"
                      (click)="selectPrize(p)"
                      title="Drag to arrange sequence · Click to activate {{ p.title }}">
                      <div class="queue-drag-handle" title="Drag to reorder sequence">
                        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/>
                          <circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                        </svg>
                      </div>
                      <span class="badge" [ngClass]="p.tier === 'Grand' ? 'badge-grand' : (p.tier === 'Major' ? 'badge-major' : 'badge-minor')">
                        {{ p.tier === 'Grand' ? 'Grand' : p.tier }}
                      </span>
                      <span class="queue-name">{{ p.title }}</span>
                      <!-- @if (activePrize()?.id === p.id) {
                        <span class="queue-active-chip">Active</span>
                      } -->
                      <span class="queue-qty">x{{ p.quantity_remaining }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Winner Modal: Close on backdrop click DISABLED to prevent accidental dismissal during live events -->
      @if (showWinnerModal()) {
        <div class="winner-backdrop" >
          <div class="winner-modal" >
            <img class="logo-modal" src="/logo.png"/>
            <!-- Top Right of Modal: Start 5s Claim Countdown Button -->
            @if (currentBatchWinners().length === 1 && claimCountdown() === null && !claimTimerExpired()) {
              <button class="btn btn-claim-timer-corner" (click)="startClaimCountdown()" title="Start 5-second claim countdown for winner to come forward">
                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Start 5s Countdown</span>
              </button>
            }

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
                <!-- <p class="celebration-subtitle">We have a lucky raffle winner!</p> -->
              </div>

              <!-- Prize Award Details Card -->
              <div class="prize-award-card">
                @if (modalPrize()?.image_data) {
                  <div class="prize-award-img-wrap">
                    <img [src]="modalPrize()!.image_data" class="prize-award-img" alt="Prize" />
                  </div>
                }
                <div class="prize-award-info">
                  <span class="badge prize-award-badge"
                    [ngClass]="modalPrize()?.tier === 'Grand' ? 'badge-grand' : (modalPrize()?.tier === 'Major' ? 'badge-major' : 'badge-minor')">
                    {{ modalPrize()?.tier === 'Grand' ? 'Grand Prize' : (modalPrize()?.tier ? modalPrize()!.tier + ' Prize' : 'Raffle Prize') }}
                  </span>
                  <div class="prize-award-title">{{ modalPrize()?.title || 'Raffle Draw Prize' }}</div>
                  @if (modalPrize()?.description) {
                    <div class="prize-award-desc">{{ modalPrize()!.description }}</div>
                  }
                </div>
              </div>

              <!-- Winner Name & Grade/Section Display -->
              <div class="winner-hero">
                @if (currentBatchWinners().length === 1) {
                  <div class="single-winner-display">
                    <h1 class="winner-name-text">{{ currentBatchWinners()[0].name }}</h1>
                    @if (currentBatchWinners()[0].gradeSection) {
                      <div class="winner-grade-badge">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path d="M12 14l9-5-9-5-9 5 9 5z"/>
                          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                        </svg>
                        <span>{{ currentBatchWinners()[0].gradeSection }}</span>
                      </div>
                    }
                    <!-- <div class="winner-divider"></div> -->
                  </div>
                } @else {
                  <div class="batch-winners-container">
                    <span class="winner-label">{{ currentBatchWinners().length }} Winners Drawn</span>
                    <div class="batch-winners-grid">
                      @for (w of currentBatchWinners(); track (w.participantId ? w.participantId + '-' + i : i); let i = $index) {
                        <div class="batch-winner-card">
                          <span class="batch-rank">{{ i + 1 }}</span>
                          <div class="batch-name-wrap">
                            <span class="batch-name">{{ w.name }}</span>
                            @if (w.gradeSection) {
                              <span class="batch-grade-text">{{ w.gradeSection }}</span>
                            }
                          </div>
                          <button class="batch-void-btn" (click)="onInvalidRedrawBulkWinner(w)" title="Mark {{ w.name }} invalid / void">
                            Invalid
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Claim Instructions Callout -->
              <div class="claim-instruction-box">
                <div class="claim-instruction-text">
                  <span class="claim-heading">Prize Claiming:</span>
                  Please proceed to the <strong>PTO representative</strong> to verify and claim your prize!
                </div>
              </div>

              <!-- Actions -->
              <div class="winner-actions">
                @if (currentBatchWinners().length === 1) {
                  <button class="btn btn-danger btn-invalid-redraw" (click)="onInvalidRedraw()" title="Winner is invalid or cannot claim. Mark as void and allocate item or redraw.">
                    <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                    <span>Absent / Void</span>
                  </button>
                }
                
                <button class="btn btn-secondary" (click)="dismissModal()" style="min-width:90px; text-align: center;">Close</button>
              </div>
            </div>
          </div>

          <!-- Floating 5s Claim Countdown Modal on Top Right of the Screen -->
          @if (currentBatchWinners().length === 1 && (claimCountdown() !== null || claimTimerExpired())) {
            <div class="claim-timer-screen-modal" (click)="$event.stopPropagation()">
              @if (claimCountdown() !== null && !claimTimerExpired()) {
                <div class="claim-timer-running-card">
                  <div class="claim-timer-modal-head">
                    <span class="claim-timer-badge">5s Timer</span>
                    <button class="btn-timer-cancel" (click)="cancelClaimCountdown()" title="Cancel Countdown">&times; Cancel</button>
                  </div>
                  <div class="claim-timer-countdown-display">
                    <span class="claim-timer-digits">{{ claimCountdown() }}</span>
                    <span class="claim-timer-sec-label">SEC</span>
                  </div>
                  <div class="claim-timer-progress-track">
                    <div class="claim-timer-progress-bar" [style.width.%]="(claimCountdown()! / 5) * 100"></div>
                  </div>
                  <!-- <p class="claim-timer-hint">Winner must present themselves and claim within 5 seconds!</p> -->
                </div>
              } @else if (claimTimerExpired()) {
                <div class="claim-timer-expired-card">
                  <div class="claim-timer-expired-head">
                    <span class="expired-icon">⚠️</span>
                    <div class="expired-text-wrap">
                      <span class="expired-title">Time's Up!</span>
                      <!-- <span class="expired-desc">Winner did not show within 5 seconds.</span> -->
                    </div>
                  </div>
                  <div class="claim-timer-expired-actions">
                    <button class="btn btn-danger btn-expired-redraw" (click)="triggerClaimExpiredRedraw()">
                      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      <span>Redraw Prize</span>
                    </button>
                    <button class="btn btn-secondary btn-expired-reset" (click)="resetClaimCountdown()">
                      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                      </svg>
                      <span>Reset Timer</span>
                    </button>
                    <button class="btn-text-dismiss" (click)="cancelClaimCountdown()">Dismiss</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Invalid Winner Resolution Modal (Option A: Teachers vs Option B: Redraw) -->
      @if (invalidResolutionModal(); as irm) {
        <div class="modal-backdrop" (click)="$event.stopPropagation()">
          <div class="invalid-modal card" (click)="$event.stopPropagation()">
            <div class="invalid-modal-header">
              <div class="invalid-warning-icon">
                <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3>Invalid Winner Resolution</h3>
                <p class="invalid-winner-name">{{ irm.winner.name }} @if (irm.winner.gradeSection) { <span>&middot; {{ irm.winner.gradeSection }}</span> }</p>
              </div>
            </div>

            <div class="invalid-modal-body">
              <div class="invalid-rule-notice">
                <span class="rule-tag">Status Update</span>
                <span><strong>{{ irm.winner.name }}</strong> will be marked as <strong>Void</strong> and excluded from all subsequent draws.</span>
              </div>

              <p class="invalid-choose-title">Choose Prize Item Allocation:</p>

              <div class="invalid-options-grid">
                <!-- Option A (Default per PTO Policy) -->
                <label class="invalid-option-card" [class.selected]="selectedInvalidOption() === 'teachers'" (click)="selectedInvalidOption.set('teachers')">
                  <div class="option-radio">
                    <input type="radio" name="invalidOption" value="teachers" [checked]="selectedInvalidOption() === 'teachers'" />
                  </div>
                  <div class="option-info">
                    <div class="option-header-row">
                      <span class="option-title">Assign Item to Teachers &amp; Faculty</span>
                      <!-- <span class="pto-badge">Default (PTO Rule)</span> -->
                    </div>
                    <p class="option-desc">The prize item is allocated directly to school teachers. Do <strong>not</strong> return it to the active pool or redraw.</p>
                  </div>
                </label>

                <!-- Option B (Redraw) -->
                <label class="invalid-option-card" [class.selected]="selectedInvalidOption() === 'redraw'" (click)="selectedInvalidOption.set('redraw')">
                  <div class="option-radio">
                    <input type="radio" name="invalidOption" value="redraw" [checked]="selectedInvalidOption() === 'redraw'" />
                  </div>
                  <div class="option-info">
                    <div class="option-header-row">
                      <span class="option-title">Redraw Replacement Winner</span>
                    </div>
                    <p class="option-desc">Return 1 item back to {{ irm.prizeTitle }} so a replacement winner can be drawn from active participants.</p>
                  </div>
                </label>
              </div>
            </div>

            <div class="invalid-modal-footer">
              <button class="btn btn-secondary" (click)="cancelInvalidResolution()">Cancel</button>
              <button class="btn btn-primary" (click)="confirmInvalidResolution()">
                {{ selectedInvalidOption() === 'teachers' ? 'Confirm: Assign to Teachers' : 'Confirm: Redraw Prize' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      width: 100%;
      min-width: 0;
      overflow: hidden;
    }

    .raffle-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--bg-base);
      overflow: hidden;
      flex: 1;
      min-height: 0;

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
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background-image: url('/bg.jpg');
      background-size: cover;
      background-repeat: no-repeat;
      background-position:center;
    }

    /* Wheel Section */
    .wheel-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 18px 14px;
      // background: var(--bg-base);
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
      
      
    }


    .wheel-stage {
      flex: 1;
      width: 100%;
      height: 100%;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      align-self: stretch;
    }

    .wheel-stage app-wheel {
      width: 100%;
      height: 100%;
      display: flex;
      align-self: stretch;
      min-height: 0;
      min-width: 0;
    }

    /* Spin Controls */
    .spin-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
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
      width: 460px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px;
      // border-left: 1px solid var(--border);
      overflow-y: auto;
      // background: var(--bg-white);
    }

    .prize-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      // overflow: hidden;
      background: var(--bg-white);

      // &.prize-major { border-color: #f0cc70; background: #fffdf0; }
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
      // width: 100%;
      max-height: 300px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
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

    .prize-body {
      padding: 14px 16px;
      
    }
    .prize-title {
      font-size: 30px;
      text-align: center;
      font-family: 'Outfit', sans-serif;
      color: var(--green-900);
      margin-bottom: 6px;
      &.no-image {
        padding-top: 36px;
        padding-bottom: 36px;

      }
    }
    .prize-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; text-align: center; }
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
    .queue-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .queue-heading {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      margin: 0;
    }
    .queue-badge-count {
      font-size: 11px;
      font-weight: 700;
      color: var(--green-900);
      background: var(--green-100);
      padding: 2px 7px;
      border-radius: 10px;
      font-family: 'Outfit', sans-serif;
    }
    .queue-subhint {
      font-size: 11px;
      color: var(--text-muted);
      margin: -4px 0 8px;
    }
    .queue-list { display: flex; flex-direction: column; gap: 6px; }
    .all-prizes-list {
      max-height: 290px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .queue-list .badge { border: 0; }
    .queue-drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      cursor: grab;
      padding: 2px;
      border-radius: 4px;
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s, color 0.15s;

      &:hover {
        opacity: 1;
        color: var(--green-900);
      }
    }
    .queue-row {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 10px;
      background: var(--gray-50);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: grab;
      transition: all 0.15s ease;

      &:active {
        cursor: grabbing;
      }

      &:hover {
        background: var(--green-50);
        border-color: var(--border-green);
      }

      &.is-dragging {
        opacity: 0.35;
        border: 2px dashed var(--green);
        background: var(--green-50);
        transform: scale(0.98);
      }

      &.drag-over {
        border-color: var(--green);
        background: #f1f8f2;
        box-shadow: 0 0 0 2px var(--green);
        transform: translateY(-2px);
      }
    }
    .active-queue-row {
      background: #edf7ed !important;
      border-color: #81c784 !important;
      box-shadow: 0 0 0 1px #81c784;
    }
    .completed-queue-row {
      opacity: 0.5;
    }
    .queue-name { flex: 1; font-size: 14.5px; font-weight: 500; }
    .queue-qty  { font-size: 11px; color: var(--text-muted); font-weight: 600; }
    .queue-active-chip {
      font-size: 10px;
      font-weight: 700;
      color: #1b5e20;
      background: #c8e6c9;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .queue-completed-chip {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--gray-100);
      padding: 2px 6px;
      border-radius: 4px;
    }
    
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
      // background: var(--bg-white);
      background-image: url('/bg-2.jpg');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border: 1px solid var(--border);
      border-top: 6px solid var(--green);
      border-radius: 16px;
      width: 90%;
      // max-width: 1260px;
      max-height: 98vh;
      overflow-y: auto;
      animation: winner-pop 0.35s ease both;
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
      font-size: 80px;
      font-weight: 800;
      color: #000;
      line-height: 1;
      margin: 4px 0 0;
      letter-spacing: -0.5px;
      word-break: break-word;
      animation: winner-pop 0.4s ease both;
      @media (min-width: 1600px) {
        font-size: 140px;
      }
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
      max-height: 800px;
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
      font-size: 40px;
      font-weight: 800;
      color: var(--green-900);
      flex: 1;
    }

    .prize-award-card {
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 24px;
      margin: 0 auto;
      max-width: 90%;
      min-width: 440px;
      background: #fbfbfb;
      border: 1.5px solid #ebebeb;
      border-radius: 16px;
      padding: 14px 28px;
      text-align: left;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    }

    .prize-award-img-wrap {
      // width: 150px;
      height: 300px;
      margin: 0;
      flex-shrink: 0;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 6px;
    }

    .prize-award-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .prize-award-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      min-width: 0;
      gap: 3px;
    }

    .prize-award-badge {
      display: inline-block;
      margin-bottom: 2px;
      background: transparent;
      border: 0;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 0;
      color: #925f0a;
    }

    .prize-award-title {
      font-family: 'Outfit', sans-serif;
      font-size: 60px;
      font-weight: 800;
      color: #1b5e20;
      line-height: 1.15;
      text-align: left;
      word-break: break-word;
    }

    .prize-award-desc {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 1px;
      text-align: left;
      max-width: 440px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Top Right of Modal: Claim Timer Initiation Button */
    .btn-claim-timer-corner {
      position: absolute;
      top: 18px;
      right: 22px;
      z-index: 15;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #fff8e1;
      color: #925f0a;
      border: 1.5px solid #ffe082;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.15s ease;

      &:hover {
        background: #ffecb3;
        border-color: #ffd54f;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(146, 95, 10, 0.2);
      }

      svg {
        color: #d97706;
      }
    }

    /* Floating Countdown Timer Modal on Top Right of the Screen */
    .claim-timer-screen-modal {
      position: fixed;
      top: 26px;
      right: 28px;
      z-index: 1200;
      width: 400px;
      animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-16px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .claim-timer-running-card {
      width: 100%;
      background: radial-gradient(circle at center, #261f0f 0%, #17130a 100%);
      border: 2.5px solid #ffd700;
      border-radius: 18px;
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 215, 0, 0.35);
    }

    .claim-timer-modal-head {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .claim-timer-badge {
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 800;
      // text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #ffd700;
    }

    .btn-timer-cancel {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      cursor: pointer;
      padding: 3px 10px;
      border-radius: 6px;
      transition: all 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #ffc107;
      }
    }

    .claim-timer-countdown-display {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 10px;
      margin: 8px 0;
    }

    .claim-timer-digits {
      font-family: 'Outfit', sans-serif;
      font-size: 100px;
      font-weight: 900;
      color: #ffffff;
      line-height: 0.95;
      text-shadow: 0 0 25px rgba(255, 215, 0, 0.9), 0 0 45px rgba(255, 152, 0, 0.6);
      animation: countPulse 1s infinite cubic-bezier(0.4, 0, 0.2, 1);
    }

    .claim-timer-sec-label {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #ffd54f;
      letter-spacing: 0.05em;
    }

    .claim-timer-progress-track {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      overflow: hidden;
      margin: 6px 0 10px;
    }

    .claim-timer-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #ff9800, #ffd700);
      transition: width 0.3s ease;
      border-radius: 4px;
    }

    .claim-timer-hint {
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.88);
      margin: 0;
      font-weight: 500;
      line-height: 1.35;
    }

    .claim-timer-expired-card {
      width: 100%;
      background: radial-gradient(circle at center, #2e0d0d 0%, #1a0505 100%);
      border: 2.5px solid #ef5350;
      border-radius: 18px;
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 24px rgba(239, 83, 80, 0.4);
    }

    .claim-timer-expired-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      text-align: left;
    }

    .expired-icon {
      font-size: 32px;
      line-height: 1;
    }

    .expired-text-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .expired-title {
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #ff5252;
      letter-spacing: 0.02em;
    }

    .expired-desc {
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.3;
    }

    .claim-timer-expired-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      width: 100%;
    }

    .btn-expired-redraw {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: linear-gradient(135deg, #e53935, #c62828) !important;
      color: #ffffff !important;
      border: 1px solid #ef5350 !important;
      font-weight: 700;
      font-size: 13.5px;
      padding: 9px 18px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(229, 57, 53, 0.45);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: linear-gradient(135deg, #f44336, #b71c1c) !important;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(229, 57, 53, 0.6);
      }
    }

    .btn-expired-reset {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      font-weight: 600;
      font-size: 13px;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.22);
      }
    }

    .btn-text-dismiss {
      background: transparent;
      border: none;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      padding: 4px 8px;
      text-decoration: underline;

      &:hover {
        color: #ffffff;
      }
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
     text-align: center;
     width: 100%;
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

    .btn-invalid-redraw {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      font-weight: 600;
      background: #fff5f5;
      color: #c62828;
      border: 1.5px solid #ef9a9a;
      transition: all 0.15s ease;

      &:hover {
        background: #ffebee;
        border-color: #e53935;
        color: #b71c1c;
      }
    }

    .batch-void-btn {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: #fff5f5;
      color: #c62828;
      border: 1px solid #ef9a9a;
      cursor: pointer;
      margin-left: auto;
      transition: all 0.15s ease;

      &:hover {
        background: #ffebee;
        color: #b71c1c;
      }
    }

    /* Grand Prize Header Banner */
    .grand-prize-header-banner {
      width: 100%;
      background: linear-gradient(135deg, #ffd700, #ffb300);
      color: #2b1f00;
      padding: 6px 14px;
      // border-radius: 8px;
      font-family: 'Outfit', sans-serif;
      font-size: 13.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      // box-shadow: 0 3px 12px rgba(255, 215, 0, 0.35);
      animation: grandPulse 1s infinite ease-in-out;
    }
    .grand-banner-stars { font-size: 11px; opacity: 0.85; }

    @keyframes grandPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 3px 12px rgba(255, 215, 0, 0.35); }
      50% { transform: scale(1.008); box-shadow: 0 4px 18px rgba(255, 215, 0, 0.55); }
    }

    .grand-chip {
      background: #fff8e1 !important;
      color: #925f0a !important;
      border-color: #ffd54f !important;
      font-weight: 700;
    }

    .grand-spin-btn {
      background: linear-gradient(135deg, #ffd700, #ff9800) !important;
      color: #1a1500 !important;
      box-shadow: 0 4px 16px rgba(255, 152, 0, 0.45) !important;
      border: 1.5px solid #ffe082 !important;
      font-size: 15px !important;
      letter-spacing: 0.04em !important;
      gap: 10px !important;
      padding: 13px 26px !important;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #ffea00, #ffb300) !important;
        transform: translateY(-2px);
        box-shadow: 0 6px 22px rgba(255, 152, 0, 0.6) !important;
      }
    }
    .grand-star { font-size: 14px; color: #744b05; }

    /* Grand Prize 5s Countdown Stage Overlay */
    .grand-countdown-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(10px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .grand-countdown-card {
      background: radial-gradient(circle at center, #232014 0%, #11110e 100%);
      border: 2px solid #ffd700;
      border-radius: 20px;
      padding: 38px 46px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 10px 40px rgba(255, 215, 0, 0.4);
      max-width: 480px;
      width: 100%;
      animation: cardAppear 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes cardAppear {
      from { transform: scale(0.85); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .grand-countdown-badge {
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 800;
      color: #ffd700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .grand-countdown-number {
      font-family: 'Outfit', sans-serif;
      font-size: 108px;
      font-weight: 900;
      color: #ffffff;
      line-height: 1;
      margin: 8px 0;
      text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 179, 0, 0.5);
      animation: countPulse 1s infinite cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes countPulse {
      0% { transform: scale(1.15); opacity: 0.85; }
      50% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.15); opacity: 0.85; }
    }

    .grand-countdown-text {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 22px;
      font-family: 'Inter', sans-serif;
    }

    /* Sidebar Bulk Batch Box */
    .sidebar-bulk-batch-box {
      margin-top: 14px;
      padding: 12px;
      background: #f7faf7;
      border: 1px solid #d4e7d5;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bulk-batch-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .bulk-toolbar-title {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--green-900);
    }

    .bulk-pool-note {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .bulk-stepper-control {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      padding: 2px 4px;
    }

    .stepper-btn {
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 18px;
      font-weight: 700;
      color: var(--green-900);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.15s;

      &:hover:not(:disabled) { background: #e8f5e9; }
      &:disabled { opacity: 0.3; cursor: not-allowed; }
    }

    .stepper-count {
      min-width: 36px;
      text-align: center;
      font-family: 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 800;
      color: var(--green-900);
      padding: 0 4px;
    }

    .stepper-subtext {
      font-size: 11px;
      color: var(--text-secondary);
      text-align: center;
    }

    /* Grade & Section Displays in Winner Modal */
    .winner-grade-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 5px 14px;
      // background: #e8f5e9;
      color: #1a5c22;
      // border: 1px solid #c8e6c9;
      // border-radius: 20px;
      font-family: 'Outfit', sans-serif;
      font-size: 30px;
      font-weight: 800;
    }

    .batch-name-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-width: 0;
    }

    .batch-grade-text {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Invalid Resolution Modal */
    .invalid-modal {
      width: 100%;
      max-width: 520px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.22);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .invalid-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--border);
      background: #fffafa;

      h3 {
        font-size: 18px;
        margin: 0;
        color: #b71c1c;
      }
    }

    .invalid-warning-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ffebee;
      color: #c62828;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .invalid-winner-name {
      font-size: 13.5px;
      color: var(--text-secondary);
      margin: 2px 0 0;
      font-weight: 500;
    }

    .invalid-modal-body {
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .invalid-rule-notice {
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12.5px;
      color: #5d4037;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      line-height: 1.4;
    }

    .rule-tag {
      background: #ffecb3;
      color: #6d4c41;
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    .invalid-choose-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--green-900);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .invalid-options-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .invalid-option-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      background: #ffffff;
      transition: all 0.15s ease;

      &:hover {
        border-color: #a5d6a7;
        background: #f9fbf9;
      }

      &.selected {
        border-color: #2d8a3a;
        background: #f0f7f1;
        box-shadow: 0 0 0 1px #2d8a3a;
      }
    }

    .option-radio {
      padding-top: 2px;
      input { cursor: pointer; }
    }

    .option-info {
      flex: 1;
      min-width: 0;
    }

    .option-header-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
    }

    .option-title {
      font-size: 14px;
      font-weight: 700;
      color: #1a4d22;
      font-family: 'Outfit', sans-serif;
    }

    .pto-badge {
      font-size: 10px;
      font-weight: 700;
      color: #1b5e20;
      background: #c8e6c9;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.03em;
    }

    .option-desc {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.35;
    }

    .invalid-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 22px;
      background: var(--gray-50);
      border-top: 1px solid var(--border);
    }

    .badge-grand {
      background: linear-gradient(135deg, #ffd700, #ffb300);
      color: #2b1f00;
      font-weight: 700;
      border: 1px solid #e6a800;
    }

    .prize-grand {
      border-color: #ffd700;
      box-shadow: 0 4px 16px rgba(255, 215, 0, 0.22);
    }
    .logo-modal {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 200px;
      height: 200px;
      z-index: 1;
      opacity: .3;
    }
  `]
})
export class RaffleViewComponent implements OnInit, OnDestroy {
  @ViewChild('wheel') wheelRef!: WheelComponent;

  readonly confettiItems = Array.from({ length: 20 }, (_, i) => i);

  private _isSpinning = signal(false);
  private _showWinnerModal = signal(false);
  private _drawMode = signal<DrawMode>('sequential');
  private _currentBatchWinners = signal<WinnerDisplay[]>([]);
  private _spinBatchId = '';
  private _batchSize = 0;
  private _awardedPrize = signal<Prize | null>(null);

  readonly isSpinning = this._isSpinning.asReadonly();
  readonly showWinnerModal = this._showWinnerModal.asReadonly();
  readonly drawMode = this._drawMode.asReadonly();
  readonly currentBatchWinners = this._currentBatchWinners.asReadonly();
  readonly awardedPrize = this._awardedPrize.asReadonly();
  readonly isFullscreen = signal(false);
  readonly showSidePanel = signal(true);

  // Optional 5s Winner Claim Countdown State (Used in Winner Modal)
  readonly claimCountdown = signal<number | null>(null);
  readonly claimTimerExpired = signal<boolean>(false);
  private claimTimer: any = null;

  // Custom Bulk Draw Batch Size State
  readonly customBatchSize = signal<number>(1);
  private _pendingBulkWinners: any[] | null = null;

  // Queue Arrange / Drag-and-Drop State
  readonly draggedPrizeIndex = signal<number | null>(null);
  readonly dragOverPrizeIndex = signal<number | null>(null);

  // Invalid Winner Resolution Dialog State
  readonly invalidResolutionModal = signal<{
    winner: WinnerDisplay;
    prizeTitle: string;
    prizeId: number;
    drawHistoryId?: number;
  } | null>(null);
  readonly selectedInvalidOption = signal<'teachers' | 'redraw'>('teachers');

  readonly isGrandPrize = computed(() => this.activePrize()?.tier === 'Grand');

  readonly wheelSegments = computed<WheelSegment[]>(() =>
    this.participantSvc.eligibleParticipants().map(p => ({
      id: p.id,
      label: p.name,
      subLabel: p.grade_section || p.contact_info || ''
    }))
  );

  readonly eligibleCount = computed(() => this.participantSvc.eligibleCount());
  readonly allowRepeat = computed(() => this.participantSvc.allowRepeat());
  readonly activePrize = computed(() => this.raffleSvc.activePrize());
  readonly modalPrize = computed(() => this._awardedPrize() || this.activePrize());
  readonly upcomingPrizes = computed(() => this.raffleSvc.pendingPrizes());
  readonly allPrizes = computed(() =>
    this.raffleSvc.prizes().filter(p => p.quantity_remaining > 0 && p.status !== 'completed')
  );
  readonly totalWinners = computed(() => this.winnerSvc.history().length);

  /**
   * Requirement 4: Spinning Animation Durations
   * - Grand Prize: 20 seconds
   * - Major Prize: 10 seconds
   * - Minor Prize: 8 seconds
   */
  readonly spinDurationMs = computed(() => {
    const prize = this.activePrize() || this._awardedPrize();
    if (!prize) return 8000;
    if (prize.tier === 'Grand') return 20000;
    if (prize.tier === 'Major') return 10000;
    return 8000;
  });

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
    const p = this.activePrize()!;
    if (p.tier === 'Grand') {
      return '★ Spin for Grand Prize ★';
    }
    if (p.quantity_remaining > 1 && this.customBatchSize() > 1) {
      return `Spin ${this.customBatchSize()} Winners`;
    }
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

    const active = this.raffleSvc.activePrize();
    if (active?.tier === 'Grand') {
      this.participantSvc.resetForGrandPrize();
    }
    this.customBatchSize.set(1);
  }

  ngOnDestroy(): void {
    this.cancelClaimCountdown();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.triggerSpin();
    }
    if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
  }

  adjustBatchSize(delta: number): void {
    const prize = this.activePrize();
    if (!prize) return;
    const current = this.customBatchSize();
    const updated = Math.max(1, Math.min(prize.quantity_remaining, current + delta));
    this.customBatchSize.set(updated);
  }

  private playCountdownBeep(isFinal = false): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = isFinal ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 880 : 587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isFinal ? 0.6 : 0.25));
      osc.start();
      osc.stop(ctx.currentTime + (isFinal ? 0.65 : 0.3));
    } catch { }
  }

  private playClaimExpiredSound(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch { }
  }

  startClaimCountdown(): void {
    if (this.claimTimer) {
      clearInterval(this.claimTimer);
      this.claimTimer = null;
    }
    this.claimTimerExpired.set(false);
    this.claimCountdown.set(5);
    this.playCountdownBeep(false);

    this.claimTimer = setInterval(() => {
      const current = this.claimCountdown();
      if (current === null) {
        clearInterval(this.claimTimer);
        this.claimTimer = null;
        return;
      }
      if (current > 1) {
        this.claimCountdown.set(current - 1);
        this.playCountdownBeep(current - 1 === 1);
      } else {
        clearInterval(this.claimTimer);
        this.claimTimer = null;
        this.claimCountdown.set(0);
        this.claimTimerExpired.set(true);
        this.playClaimExpiredSound();
      }
    }, 1000);
  }

  cancelClaimCountdown(): void {
    if (this.claimTimer) {
      clearInterval(this.claimTimer);
      this.claimTimer = null;
    }
    this.claimCountdown.set(null);
    this.claimTimerExpired.set(false);
  }

  resetClaimCountdown(): void {
    this.startClaimCountdown();
  }

  triggerClaimExpiredRedraw(): void {
    this.cancelClaimCountdown();
    const winner = this._currentBatchWinners()[0];
    const prize = this.modalPrize();
    if (!winner || !prize) return;

    // For Grand Prize, bypass the resolution modal and auto-select Redraw Replacement Winner
    if (prize.tier === 'Grand') {
      this.participantSvc.markVoid(winner.participantId);
      this.raffleSvc.voidWinnerAndRestorePrize(prize.id, winner.participantId, winner.drawHistoryId);
      this.winnerSvc.refresh();
      this.participantSvc.refresh();
      this.raffleSvc.refresh();
      this.participantSvc.resetForGrandPrize();
      this.raffleSvc.setActive(prize.id);

      this._showWinnerModal.set(false);
      this._currentBatchWinners.set([]);
      this._awardedPrize.set(null);
      return;
    }

    this.selectedInvalidOption.set('redraw');
    this.invalidResolutionModal.set({
      winner,
      prizeTitle: prize.title,
      prizeId: prize.id,
      drawHistoryId: winner.drawHistoryId
    });
  }

  private async getEventManifest(): Promise<Record<string, string>> {
    try {
      const res = await fetch('event-manifest.json?t=' + Date.now());
      if (res.ok) {
        const text = await res.text();
        if (!text || !text.trim()) return {};
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch { }
    return {};
  }

  /**
   * Case-sensitive prize key matching:
   * Matches if prize title equals key, contains key, or prize tier equals key.
   */
  private matchPrizeKey(prize: Prize, key: string): boolean {
    const k = (key || '').trim();
    if (!k) return false;
    const title = (prize.title || '').trim();
    const tier = (prize.tier || '').trim();
    return title === k || title.includes(k) || tier === k;
  }

  /**
   * Identifies participants who are reserved for other upcoming/active prizes in the manifest,
   * ensuring they cannot accidentally win an earlier prize before their designated one.
   */
  private getReservedParticipantNames(currentPrize: Prize, manifest: Record<string, string>): Set<string> {
    const reserved = new Set<string>();
    if (!manifest) return reserved;

    for (const [key, name] of Object.entries(manifest)) {
      const trimmedName = (name || '').trim();
      if (!trimmedName) continue;
      // If this key belongs to the current prize, they are not reserved for "another" prize
      if (this.matchPrizeKey(currentPrize, key)) continue;

      // Check if that other prize is still pending/active with items remaining
      const matchingPrizes = this.raffleSvc.prizes().filter(p => this.matchPrizeKey(p, key));
      const isPending = matchingPrizes.length === 0 || matchingPrizes.some(p => p.quantity_remaining > 0 && p.status !== 'completed');
      if (isPending) {
        reserved.add(trimmedName);
      }
    }
    return reserved;
  }

  /**
   * Finds the designated winner for this prize from the manifest.
   * - Prize key: case-sensitive match
   * - Winner name: EXACT (case-sensitive) match
   * - If the winner has ALREADY won any previous prize/draw, they are disqualified from winning again
   *   (guarantees a 1-item limit even if the prize has multiple items).
   */
  private findDesignatedWinner(prize: Prize, manifest: Record<string, string>): any | null {
    if (!manifest || Object.keys(manifest).length === 0) return null;

    let matchedKey: string | null = null;
    for (const key of Object.keys(manifest)) {
      if (this.matchPrizeKey(prize, key)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) return null;
    // Value must be an EXACT (case-sensitive) string match:
    const targetExactName = (manifest[matchedKey] || '').trim();
    if (!targetExactName) return null;

    // Check if this participant has already won any prize previously in draw history
    const history = this.winnerSvc.history();
    const alreadyWonAny = history.some(h => (h.participant_name || '').trim() === targetExactName && h.status !== 'voided');
    const alreadyWonGrand = history.some(h => (h.participant_name || '').trim() === targetExactName && h.prize_tier === 'Grand' && h.status !== 'voided');

    // Once a participant has won a Grand Prize, they cannot win another Grand Prize
    if (alreadyWonGrand) {
      return null;
    }

    // Participants who won a Minor/Major prize cannot win another Minor/Major prize
    if (alreadyWonAny && prize.tier !== 'Grand') {
      return null;
    }

    const all = this.participantSvc.participants().filter(p => !p.is_void);
    const found = all.find(p => p.name.trim() === targetExactName);
    if (!found) return null;

    // If they were already drawn (is_eligible === 0), they cannot win again
    if (found.is_eligible === 0) {
      return null;
    }

    return found;
  }

  async triggerSpin(direction: 'down' | 'up' = 'down'): Promise<void> {
    if (!this.canSpin()) return;
    const prize = this.activePrize()!;
    this._awardedPrize.set({ ...prize });

    const manifest = await this.getEventManifest();
    const designated = this.findDesignatedWinner(prize, manifest);
    const reservedNames = this.getReservedParticipantNames(prize, manifest);

    const eligible = this.participantSvc.eligibleParticipants();
    if (!eligible.length) return;

    // Exclude participants reserved for other upcoming prizes from winning this prize
    const safeCandidates = eligible.filter(p => !reservedNames.has(p.name.trim()) || (designated && p.id === designated.id));
    const candidatePool = safeCandidates.length > 0 ? safeCandidates : eligible;

    const isBulk = prize.quantity_remaining > 1 && this.customBatchSize() > 1;
    if (isBulk) {
      const count = Math.min(this.customBatchSize(), prize.quantity_remaining, eligible.length);

      let selected: any[];
      if (designated) {
        const others = candidatePool.filter(p => p.id !== designated.id);
        const randomOthers = [...others].sort(() => Math.random() - 0.5).slice(0, count - 1);
        selected = [designated, ...randomOthers];
      } else {
        selected = [...candidatePool].sort(() => Math.random() - 0.5).slice(0, count);
      }

      this._pendingBulkWinners = selected;
      this._spinBatchId = crypto.randomUUID();
      this._batchSize = count;

      this._isSpinning.set(true);
      const duration = this.spinDurationMs();
      const leadWinner = selected[0];
      const targetSegment = this.wheelSegments().find(s => s.id === leadWinner.id) || {
        id: leadWinner.id,
        label: leadWinner.name,
        subLabel: leadWinner.grade_section || leadWinner.contact_info || ''
      };
      this.wheelRef.spin(direction, duration, targetSegment);
      return;
    }

    this._pendingBulkWinners = null;
    this._isSpinning.set(true);
    this._spinBatchId = crypto.randomUUID();
    this._batchSize = 1;
    const duration = this.spinDurationMs();

    if (designated) {
      const targetSegment = this.wheelSegments().find(s => s.id === designated.id) || {
        id: designated.id,
        label: designated.name,
        subLabel: designated.grade_section || designated.contact_info || ''
      };
      this.wheelRef.spin(direction, duration, targetSegment);
      return;
    }

    // Pick fair random winner from candidates not reserved for other upcoming prizes
    const fairWinner = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    const targetSegment = this.wheelSegments().find(s => s.id === fairWinner.id) || {
      id: fairWinner.id,
      label: fairWinner.name,
      subLabel: fairWinner.grade_section || fairWinner.contact_info || ''
    };
    this.wheelRef.spin(direction, duration, targetSegment);
  }

  onWinnerSelected(segment: WheelSegment): void {
    const prize = this.activePrize() || this._awardedPrize();
    if (!prize) return;
    this._awardedPrize.set({ ...prize });
    this._isSpinning.set(false);

    // If bulk draw with suspenseful spin
    if (this._pendingBulkWinners && this._pendingBulkWinners.length > 0) {
      const selected = this._pendingBulkWinners;
      this._pendingBulkWinners = null;
      this.raffleSvc.recordBatchWinners(prize.id, selected.map((p: any) => p.id), this._spinBatchId);
      if (!this.allowRepeat()) {
        selected.forEach((p: any) => this.participantSvc.markDrawn(p.id));
      }
      this.winnerSvc.refresh();
      this.participantSvc.refresh();

      this._currentBatchWinners.set(selected.map((p: any) => ({
        name: p.name,
        participantId: p.id,
        gradeSection: p.grade_section || p.contact_info || ''
      })));
      this._showWinnerModal.set(true);
      this.confetti.fire({ colors: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FDD835', '#D81B60', '#00ACC1'] });

      // If this prize has 0 remaining items, auto-advance to next on queue raffle prize
      const updated = this.raffleSvc.getPrize(prize.id);
      if (!updated || updated.quantity_remaining <= 0 || updated.status === 'completed') {
        this.autoAdvanceNextPrize(prize.id);
      }
      return;
    }

    // Single winner draw
    this.raffleSvc.recordWinner(prize.id, segment.id, this._spinBatchId);
    if (!this.allowRepeat()) this.participantSvc.markDrawn(segment.id);
    this.winnerSvc.refresh();

    const p = this.participantSvc.participants().find(x => x.id === segment.id);
    const gradeSection = p?.grade_section || p?.contact_info || segment.subLabel || '';
    this._currentBatchWinners.set([{ name: segment.label, participantId: segment.id, gradeSection }]);
    this._showWinnerModal.set(true);
    this.confetti.fire({ colors: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FDD835', '#D81B60', '#00ACC1'] });

    // If this prize has 0 remaining items, auto-advance to next on queue raffle prize
    const updated = this.raffleSvc.getPrize(prize.id);
    if (!updated || updated.quantity_remaining <= 0 || updated.status === 'completed') {
      this.autoAdvanceNextPrize(prize.id);
    }
  }

  onInvalidRedraw(): void {
    const winner = this._currentBatchWinners()[0];
    const prize = this.modalPrize();
    if (!winner || !prize) return;

    if (prize.tier === 'Grand') {
      this.cancelClaimCountdown();
      this.participantSvc.markVoid(winner.participantId);
      this.raffleSvc.voidWinnerAndRestorePrize(prize.id, winner.participantId, winner.drawHistoryId);
      this.winnerSvc.refresh();
      this.participantSvc.refresh();
      this.raffleSvc.refresh();
      this.participantSvc.resetForGrandPrize();
      this.raffleSvc.setActive(prize.id);

      this._showWinnerModal.set(false);
      this._currentBatchWinners.set([]);
      this._awardedPrize.set(null);
      return;
    }

    this.selectedInvalidOption.set('teachers');
    this.invalidResolutionModal.set({
      winner,
      prizeTitle: prize.title,
      prizeId: prize.id,
      drawHistoryId: winner.drawHistoryId
    });
  }

  onInvalidRedrawBulkWinner(winner: WinnerDisplay): void {
    const prize = this.modalPrize();
    if (!prize) return;
    this.selectedInvalidOption.set('teachers');
    this.invalidResolutionModal.set({
      winner,
      prizeTitle: prize.title,
      prizeId: prize.id,
      drawHistoryId: winner.drawHistoryId
    });
  }

  cancelInvalidResolution(): void {
    this.invalidResolutionModal.set(null);
  }

  confirmInvalidResolution(): void {
    const data = this.invalidResolutionModal();
    if (!data) return;

    // Disqualify and mark as void permanently from all subsequent draws
    this.participantSvc.markVoid(data.winner.participantId);

    if (this.selectedInvalidOption() === 'teachers') {
      // Option A: Assign to Teachers (keep item deducted, do not redraw)
      this.raffleSvc.allocatePrizeToTeachers(data.prizeId, data.winner.participantId, data.drawHistoryId);
    } else {
      // Option B: Redraw (return item to active pool)
      this.raffleSvc.voidWinnerAndRestorePrize(data.prizeId, data.winner.participantId, data.drawHistoryId);
    }

    this.winnerSvc.refresh();
    this.participantSvc.refresh();
    this.raffleSvc.refresh();
    this.invalidResolutionModal.set(null);

    // If only 1 winner was drawn, close celebration modal and return to ready wheel
    if (this._currentBatchWinners().length <= 1) {
      this._showWinnerModal.set(false);
      this._currentBatchWinners.set([]);
      this._awardedPrize.set(null);
    } else {
      // If bulk draw with multiple winners, remove voided winner from modal list
      this._currentBatchWinners.update(list => list.filter(w => w.participantId !== data.winner.participantId));
    }
  }

  viewLastDraw(): void {
    const history = this.winnerSvc.history();
    if (!history || history.length === 0) return;
    const latest = history[0];
    const batch = latest.spin_batch_id
      ? history.filter(h => h.spin_batch_id === latest.spin_batch_id)
      : [latest];

    const prize = this.raffleSvc.prizes().find(p => p.id === latest.prize_id) || {
      id: latest.prize_id,
      title: latest.prize_title,
      description: '',
      image_data: latest.prize_image_data,
      tier: latest.prize_tier,
      quantity_total: 1,
      quantity_remaining: 0,
      draw_mode: batch.length > 1 ? 'bulk' : 'sequential',
      sequence_order: 0,
      status: 'completed'
    } as Prize;

    this._awardedPrize.set(prize);
    this._currentBatchWinners.set(batch.map(b => ({
      name: b.participant_name,
      participantId: b.participant_id,
      gradeSection: b.grade_section,
      drawHistoryId: b.id
    })));
    this._showWinnerModal.set(true);
  }

  continueSpinning(): void {
    this._showWinnerModal.set(false);
    setTimeout(() => { this.triggerSpin('down'); }, 400);
  }

  dismissModal(): void {
    this.cancelClaimCountdown();
    this._showWinnerModal.set(false);
    const active = this.activePrize();
    if (!active || active.status === 'completed' || active.quantity_remaining <= 0) {
      this.autoAdvanceNextPrize();
    }
    this._currentBatchWinners.set([]);
    this._awardedPrize.set(null);
  }

  autoAdvanceNextPrize(completedPrizeId?: number): Prize | null {
    const currentId = completedPrizeId ?? this.activePrize()?.id;
    const candidates = this.allPrizes().filter(p => p.id !== currentId && p.quantity_remaining > 0 && p.status !== 'completed');
    const next = candidates[0] || null;
    if (next) {
      if (next.tier === 'Grand') {
        this.participantSvc.resetForGrandPrize();
      }
      this.raffleSvc.setActive(next.id);
      this.customBatchSize.set(1);
      return next;
    } else {
      const anyAvailable = this.allPrizes().find(p => p.quantity_remaining > 0 && p.status !== 'completed');
      if (anyAvailable) {
        if (anyAvailable.tier === 'Grand') {
          this.participantSvc.resetForGrandPrize();
        }
        this.raffleSvc.setActive(anyAvailable.id);
        this.customBatchSize.set(1);
        return anyAvailable;
      }
      this.raffleSvc.clearActive();
      return null;
    }
  }

  selectPrize(prize: Prize): void {
    if (this._isSpinning()) return;
    if (!this._showWinnerModal()) {
      this._currentBatchWinners.set([]);
    }
    if (prize.tier === 'Grand') {
      this.participantSvc.resetForGrandPrize();
    }
    this.raffleSvc.setActive(prize.id);
    this.customBatchSize.set(1);
  }

  onPrizeDragStart(event: DragEvent, index: number): void {
    if (this._isSpinning()) {
      event.preventDefault();
      return;
    }
    this.draggedPrizeIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onPrizeDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.draggedPrizeIndex() === null) return;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverPrizeIndex.set(index);
  }

  onPrizeDragLeave(index: number): void {
    if (this.dragOverPrizeIndex() === index) {
      this.dragOverPrizeIndex.set(null);
    }
  }

  onPrizeDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const fromIndex = this.draggedPrizeIndex();
    if (fromIndex === null || fromIndex === targetIndex) {
      this.onPrizeDragEnd();
      return;
    }

    const available = [...this.allPrizes()];
    const [moved] = available.splice(fromIndex, 1);
    available.splice(targetIndex, 0, moved);

    // Keep completed prizes intact at end of list
    const completed = this.raffleSvc.prizes().filter(p => p.quantity_remaining === 0 || p.status === 'completed');
    const combined = [...available, ...completed];

    this.onPrizeDragEnd();
    this.raffleSvc.reorderPrizes(combined);
  }

  onPrizeDragEnd(): void {
    this.draggedPrizeIndex.set(null);
    this.dragOverPrizeIndex.set(null);
  }

  setDrawMode(mode: DrawMode): void { this._drawMode.set(mode); }
  toggleAllowRepeat(): void { this.participantSvc.setAllowRepeat(!this.allowRepeat()); }

  toggleSidePanel(): void {
    this.showSidePanel.update(v => !v);
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 60);
  }

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
