# St Paul App 2026

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## Database Management & Test Data Cleanup

The app stores data in `stpaul_raffle.db` (served locally via `server.js` on port `3001`). You can execute SQL commands in your terminal to manage or reset the database during testing or live event prep.

> **Important:** After running any of the commands below, **refresh your browser tab (`Cmd + R` or `F5`)** so the app reloads the updated SQLite database from disk.

### Option A: Completely Empty Everything (Prizes + Participants + History)
Use this to start with a blank database before configuring real event data:
```bash
sqlite3 stpaul_raffle.db "DELETE FROM draw_history; DELETE FROM prizes; DELETE FROM participants; VACUUM;"
```

### Option B: Empty Only Prizes & History (Keep Participants List)
Use this if you already imported students/participants and only want to clear prize test data:
```bash
sqlite3 stpaul_raffle.db "DELETE FROM draw_history; DELETE FROM prizes; VACUUM;"
```

### Option C: Empty Only Participants
Use this if you want to wipe participant data and re-import from CSV:
```bash
sqlite3 stpaul_raffle.db "DELETE FROM participants; VACUUM;"
```

### Option D: Full Test Reset (Keep Setup, Restore All Stock, Clear Winners)
Use this to reset test spins back to original state without losing configured prizes or participant lists:
```bash
sqlite3 stpaul_raffle.db "DELETE FROM draw_history; UPDATE prizes SET quantity_remaining = quantity_total, status = 'pending'; UPDATE participants SET is_eligible = 1, is_void = 0; VACUUM;"
```

