import { Routes } from '@angular/router';
import { adminGuard, permissionGuard } from './core/auth/admin.guard';

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
        canActivate: [permissionGuard('shops.approve')],
        loadComponent: () =>
          import('./features/shop-approvals/shop-approvals').then(
            (m) => m.ShopApprovals,
          ),
      },
      {
        path: 'shops',
        canActivate: [permissionGuard('shops.read')],
        loadComponent: () =>
          import('./features/shops/shops-admin').then((m) => m.ShopsAdmin),
      },
      {
        path: 'shops/:id',
        canActivate: [permissionGuard('shops.read')],
        loadComponent: () =>
          import('./features/shops/shop-detail').then((m) => m.ShopDetail),
      },
      {
        path: 'users',
        canActivate: [permissionGuard('users.read')],
        loadComponent: () =>
          import('./features/users/users-admin').then((m) => m.UsersAdmin),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard('roles.read', 'roles.manage')],
        loadComponent: () =>
          import('./features/roles/roles-admin').then((m) => m.RolesAdmin),
      },
      {
        path: 'branches',
        canActivate: [permissionGuard('branches.read', 'branches.manage')],
        loadComponent: () =>
          import('./features/branches/branches-admin').then(
            (m) => m.BranchesAdmin,
          ),
      },
      {
        path: 'inventory',
        canActivate: [permissionGuard('products.read', 'products.manage', 'inventory.manage')],
        loadComponent: () =>
          import('./features/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'brands',
        canActivate: [permissionGuard('brands.manage')],
        loadComponent: () =>
          import('./features/brands/brands-admin').then((m) => m.BrandsAdmin),
      },
      {
        path: 'categories',
        canActivate: [permissionGuard('categories.manage')],
        loadComponent: () =>
          import('./features/categories/categories-admin').then(
            (m) => m.CategoriesAdmin,
          ),
      },
      {
        path: 'qualities',
        canActivate: [permissionGuard('qualities.manage')],
        loadComponent: () =>
          import('./features/qualities/qualities-admin').then(
            (m) => m.QualitiesAdmin,
          ),
      },
      {
        path: 'credit',
        canActivate: [permissionGuard('credit.read')],
        loadComponent: () =>
          import('./features/credit-ledger/credit-ledger').then(
            (m) => m.CreditLedger,
          ),
      },
      {
        path: 'financials',
        canActivate: [permissionGuard('financials.read')],
        loadComponent: () =>
          import('./features/financials/financials').then((m) => m.Financials),
      },
      {
        path: 'reports',
        canActivate: [permissionGuard('reports.read')],
        loadComponent: () =>
          import('./features/reports/reports').then((m) => m.ReportsPage),
      },
      {
        path: 'orders-board',
        canActivate: [permissionGuard('orders.read')],
        loadComponent: () =>
          import('./features/orders-board/orders-board').then(
            (m) => m.OrdersBoard,
          ),
      },
      {
        path: 'invoices',
        canActivate: [permissionGuard('invoices.read')],
        loadComponent: () =>
          import('./features/invoices/invoices').then((m) => m.InvoicesAdminPage),
      },
      {
        path: 'invoices/:id',
        canActivate: [permissionGuard('invoices.read')],
        loadComponent: () =>
          import('./features/invoices/invoice-detail').then(
            (m) => m.InvoiceDetailAdmin,
          ),
      },
      {
        path: 'delivery-guys',
        canActivate: [permissionGuard('delivery.read', 'delivery.manage')],
        loadComponent: () =>
          import('./features/delivery-guys/delivery-guys').then(
            (m) => m.DeliveryGuysPage,
          ),
      },
      {
        path: 'employees',
        canActivate: [permissionGuard('hr.read', 'hr.manage')],
        loadComponent: () =>
          import('./features/employees/employees-admin').then(
            (m) => m.EmployeesAdmin,
          ),
      },
      {
        path: 'employees/vacations',
        canActivate: [permissionGuard('hr.vacations', 'hr.manage')],
        loadComponent: () =>
          import('./features/employees/vacation-inbox').then(
            (m) => m.VacationInbox,
          ),
      },
      {
        path: 'employees/:id',
        canActivate: [permissionGuard('hr.read', 'hr.manage')],
        loadComponent: () =>
          import('./features/employees/employee-detail').then(
            (m) => m.EmployeeDetail,
          ),
      },
      {
        path: 'special-requests',
        canActivate: [permissionGuard('special_requests.read', 'special_requests.manage')],
        loadComponent: () =>
          import('./features/special-requests/special-requests-center').then(
            (m) => m.SpecialRequestsCenter,
          ),
      },
      {
        path: 'returns',
        canActivate: [permissionGuard('returns.read')],
        loadComponent: () =>
          import('./features/returns/returns-admin').then((m) => m.ReturnsAdmin),
      },
      {
        path: 'broadcast',
        canActivate: [permissionGuard('broadcast.manage')],
        loadComponent: () =>
          import('./features/broadcast/broadcast').then((m) => m.BroadcastPage),
      },
      {
        path: 'chat',
        canActivate: [permissionGuard('chat.manage')],
        loadComponent: () =>
          import('./features/chat/chat-center').then((m) => m.ChatCenter),
      },
      {
        path: 'branding',
        canActivate: [permissionGuard('branding.manage')],
        loadComponent: () =>
          import('./features/settings/branding-settings').then(
            (m) => m.BrandingSettings,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'reports' },
];
