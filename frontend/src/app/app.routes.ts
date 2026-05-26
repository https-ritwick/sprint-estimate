import { Routes } from '@angular/router';

// Lazy-loaded standalone page components keep the initial bundle small.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent) },
  { path: 'about', loadComponent: () => import('./pages/about/about.component').then((m) => m.AboutComponent) },
  { path: 'guide', loadComponent: () => import('./pages/guide/guide.component').then((m) => m.GuideComponent) },
  { path: 'examples', loadComponent: () => import('./pages/examples/examples.component').then((m) => m.ExamplesComponent) },
  { path: 'create', loadComponent: () => import('./pages/create-session/create-session.component').then((m) => m.CreateSessionComponent) },
  { path: 'join/:roomId', loadComponent: () => import('./pages/join-session/join-session.component').then((m) => m.JoinSessionComponent) },
  { path: 'join', loadComponent: () => import('./pages/join-session/join-session.component').then((m) => m.JoinSessionComponent) },
  { path: 'room/:roomId', loadComponent: () => import('./pages/room/room.component').then((m) => m.RoomComponent) },
  { path: 'summary/:roomId', loadComponent: () => import('./pages/summary/summary.component').then((m) => m.SummaryComponent) },
  { path: '**', redirectTo: '' },
];
