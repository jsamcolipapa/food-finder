import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Crave — food nearby',
    loadComponent: () => import('./explore/explore-page').then((m) => m.ExplorePage),
  },
  {
    path: 'saved',
    title: 'Saved · Crave',
    loadComponent: () => import('./saved/saved-page').then((m) => m.SavedPage),
  },
  { path: '**', redirectTo: '' },
];
