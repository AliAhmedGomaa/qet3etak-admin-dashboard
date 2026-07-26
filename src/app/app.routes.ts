import { Routes } from '@angular/router';
import { adminGuard, superAdminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'reports' },
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
        path: 'shops/:id',
        loadComponent: () =>
          import('./features/shops/shop-detail').then((m) => m.ShopDetail),
      },
      {
        path: 'users',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/users/users-admin').then((m) => m.UsersAdmin),
      },
      {
        path: 'roles',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/roles/roles-admin').then((m) => m.RolesAdmin),
      },
      {
        path: 'branches',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/branches/branches-admin').then(
            (m) => m.BranchesAdmin,
          ),
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
        path: 'qualities',
        loadComponent: () =>
          import('./features/qualities/qualities-admin').then(
            (m) => m.QualitiesAdmin,
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
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports').then((m) => m.ReportsPage),
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
        path: 'employees',
        loadComponent: () =>
          import('./features/employees/employees-admin').then(
            (m) => m.EmployeesAdmin,
          ),
      },
      {
        path: 'employees/vacations',
        loadComponent: () =>
          import('./features/employees/vacation-inbox').then(
            (m) => m.VacationInbox,
          ),
      },
      {
        path: 'employees/:id',
        loadComponent: () =>
          import('./features/employees/employee-detail').then(
            (m) => m.EmployeeDetail,
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
      {
        path: 'branding',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/settings/branding-settings').then(
            (m) => m.BrandingSettings,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'approvals' },
];
