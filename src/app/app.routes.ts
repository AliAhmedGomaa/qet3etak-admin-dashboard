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
        path: 'shops',
        loadComponent: () =>
          import('./features/shops/shops-admin').then((m) => m.ShopsAdmin),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./features/brands/brands-admin').then((m) => m.BrandsAdmin),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories-admin').then(
            (m) => m.CategoriesAdmin,
          ),
      },
      {
        path: 'data-import',
        loadComponent: () =>
          import('./features/data-import/data-import').then(
            (m) => m.DataImportPage,
          ),
      },
      {
        path: 'credit',
        loadComponent: () =>
          import('./features/credit-ledger/credit-ledger').then(
            (m) => m.CreditLedger,
          ),
      },
      {
        path: 'financials',
        loadComponent: () =>
          import('./features/financials/financials').then((m) => m.Financials),
      },
      {
        path: 'orders-board',
        loadComponent: () =>
          import('./features/orders-board/orders-board').then(
            (m) => m.OrdersBoard,
          ),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/invoices/invoices').then((m) => m.InvoicesAdminPage),
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./features/invoices/invoice-detail').then(
            (m) => m.InvoiceDetailAdmin,
          ),
      },
      {
        path: 'delivery-guys',
        loadComponent: () =>
          import('./features/delivery-guys/delivery-guys').then(
            (m) => m.DeliveryGuysPage,
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
        path: 'returns',
        loadComponent: () =>
          import('./features/returns/returns-admin').then((m) => m.ReturnsAdmin),
      },
      {
        path: 'broadcast',
        loadComponent: () =>
          import('./features/broadcast/broadcast').then((m) => m.BroadcastPage),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat-center').then((m) => m.ChatCenter),
      },
    ],
  },
  { path: '**', redirectTo: 'approvals' },
];
