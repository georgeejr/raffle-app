Act as a Senior Full-Stack Architect. Help me scaffold and implement a standalone, portable Raffle & Wheel of Names application using Angular (latest standalone components, signals-based architecture).

---

### 1. High-Level Concept & Technical Stack
- **Frontend:** Angular (Standalone Components, Signals for state management, SCSS/Tailwind CSS, Canvas/SVG for wheel rendering with realistic physics and deceleration).
- **Local Database:** Portable, standalone database using SQLite (via `@sqlite.org/sqlite-wasm` or `sql.js` persisted in OPFS/IndexedDB) so the app can run entirely offline or be packaged locally.
- **Modularity:** Design services with clean abstractions (e.g., `ParticipantService`, `RaffleService`, `WinnerService`) to easily swap local SQLite with a REST/GraphQL API when pulling from an external registration app later.

---

### 2. Core Functional Requirements

#### A. Participant Management
- Manual bulk paste (newline/comma separated) and individual name addition.
- Flag participants (e.g., `id`, `name`, `email_or_ref`, `is_drawn`, `drawn_raffle_id`).
- Prepare an import interface (CSV/JSON upload) and an API contract placeholder for the future registration app integration.

#### B. Prize & Raffle Configuration (Admin Dashboard)
- CRUD operations for Raffle Items:
  - `Title` / Name of Raffle
  - `Description`
  - `Prize Image` (base64 or local blob storage)
  - `Tier`: Major vs. Minor
  - `Quantity` (number of winners, e.g., 10 gift certificates)
  - `Draw Order` / Sequence
- Dashboard to preview upcoming raffles, active draw, and completed draws.

#### C. Wheel & Draw Mechanics
- Dynamic interactive wheel rendered via HTML5 Canvas or SVG that calculates slice angles dynamically based on remaining eligible names.
- Sound effects and confetti trigger on win.
- Multi-winner handling for a single prize (e.g., 10 winners):
  - **Mode 1 (Single Spin / Bulk Draw):** Spin once and reveal all N winners simultaneously or in rapid succession with a celebratory screen.
  - **Mode 2 (Sequential Spin):** Spin N times, automatically excluding previous winners from subsequent spins of that batch.
- Automatic removal/flagging of winners to avoid duplicate wins across raffles (with an optional toggle to "Allow repeat winners").

#### D. Winner Presentation & History
- Real-time celebration modal showing the prize image, prize title, and winning name(s).
- Dedicated "Winners Board" / History view listing:
  - Tier (Major/Minor)
  - Prize details and image
  - Winner name(s) and timestamp
- Export winners list to CSV/JSON.

---

### 3. Database Schema (SQLite)

Provide the schema definition and initialization script:
1. `participants` (id, name, contact_info, is_eligible, created_at)
2. `prizes` (id, title, description, image_url, tier, quantity_total, quantity_remaining, draw_mode, sequence_order, status)
3. `draw_history` (id, prize_id, participant_id, drawn_at, spin_batch_id)

---

### 4. Implementation Steps Needed
1. Architecture setup: Project folder structure, standalone components, and routing.
2. SQLite WASM service setup with OPFS persistence.
3. Canvas-based Wheel component with configurable spin dynamics.
4. Admin Dashboard for Prize & Participant management.
5. Raffle Presentation View (Projector/Audience friendly UI).