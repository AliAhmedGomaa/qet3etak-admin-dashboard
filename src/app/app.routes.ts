import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'approvals' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./layout/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: 'approvals',
        loadComponent: () =>
          import('./features/shop-approvals/shop-approvals').then(
            (m) => m.ShopApprovals,
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'credit',
        loadComponent: () =>
          import('./features/credit-ledger/credit-ledger').then(
            (m) => m.CreditLedger,
          ),
      },
      {
        path: 'orders-board',
        loadComponent: () =>
          import('./features/orders-board/orders-board').then(
            (m) => m.OrdersBoard,
          ),
      },
      {
        path: 'special-requests',
        loadComponent: () =>
          import('./features/special-requests/special-requests-center').then(
            (m) => m.SpecialRequestsCenter,
          ),
      },
      {
        path: 'broadcast',
        loadComponent: () =>
          import('./features/broadcast/broadcast').then((m) => m.BroadcastPage),
      },
    ],
  },
  { path: '**', redirectTo: 'approvals' },
];
