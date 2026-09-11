import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'raffle',
    pathMatch: 'full'
  },
  {
    path: 'raffle',
    loadComponent: () =>
      import('./features/wheel/raffle-view.component').then(m => m.RaffleViewComponent),
    title: 'St. Paul Raffle — Spin!'
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(m => m.AdminComponent),
    title: 'St. Paul Raffle — Admin'
  },
  {
    path: 'winners',
    loadComponent: () =>
      import('./features/winners/winners-board.component').then(m => m.WinnersBoardComponent),
    title: 'St. Paul Raffle — Winners Board'
  },
  {
    path: '**',
    redirectTo: 'raffle'
  }
];
