import { Routes } from "@angular/router";
import { LoginPageComponent } from "./pages/login/login.page";
import { ShellComponent } from "./layout/shell.component";
import { authGuard } from "./core/auth.guard";
import { roleGuard } from "./core/role.guard";
import { accessGuard } from "./core/access.guard";

import { DashboardPageComponent } from "./pages/dashboard/dashboard.page";

import { CustomersPageComponent } from "./pages/customers/customers.page";
import { ServiceCentresPageComponent } from "./pages/service-centres/service-centres.page";
import { SalesPageComponent } from "./pages/sales/sales.page";
import { StockPageComponent } from "./pages/stock/stock.page";
import { UsersPageComponent } from "./pages/users/users.page";
import { UserAddPageComponent } from "./pages/users/user-add.page";
import { UserEditPageComponent } from "./pages/users/user-edit.page";
import { UserProfilePageComponent } from "./pages/users/user-profile.page";
import { SendMessagePageComponent } from "./pages/messages/send-message.page";
import { ReportsPageComponent } from "./pages/reports/reports.page";
import { DutiesPageComponent } from "./pages/duties/duties.page";
import { MyDutiesPageComponent } from "./pages/duties/my-duties.page";
import { HandoverPageComponent } from "./pages/handover/handover.page";
import { ActivityLogsPageComponent } from "./pages/activity-logs/activity-logs.page";
import { ProfilePageComponent } from "./pages/profile/profile.page";
import { OrdersPageComponent } from "./pages/orders/orders.page";
import { ProductsPageComponent } from "./pages/products/products.page";
import { BrandingPageComponent } from "./pages/branding/branding.page";
import { CustomerLoginPageComponent } from "./customer/pages/customer-login.page";
import { CustomerRegisterPageComponent } from "./customer/pages/customer-register.page";
import { CustomerShellComponent } from "./customer/customer-shell.component";
import { customerAuthGuard } from "./customer/customer-auth.guard";
import { CustomerProductsPageComponent } from "./customer/pages/customer-products.page";
import { CustomerOrdersPageComponent } from "./customer/pages/customer-orders.page";
import { CustomerProfilePageComponent } from "./customer/pages/customer-profile.page";
import { CustomerInboxPageComponent } from "./customer/pages/customer-inbox.page";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "login" },
  { path: "login", component: LoginPageComponent },
  { path: "customer/login", component: CustomerLoginPageComponent },
  { path: "customer/register", component: CustomerRegisterPageComponent },
  {
    path: "customer",
    component: CustomerShellComponent,
    canActivate: [customerAuthGuard],
    children: [
      { path: "order", component: CustomerProductsPageComponent },
      { path: "orders", component: CustomerOrdersPageComponent },
      { path: "inbox", component: CustomerInboxPageComponent },
      { path: "profile", component: CustomerProfilePageComponent },
      { path: "", pathMatch: "full", redirectTo: "order" }
    ]
  },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "dashboard", component: DashboardPageComponent },

      { path: "customers", component: CustomersPageComponent },
      { path: "service-centres", component: ServiceCentresPageComponent, canActivate: [roleGuard(["ADMIN", "MANAGER"])] },
      { path: "sales", component: SalesPageComponent },
      { path: "stock", component: StockPageComponent },
      { path: "orders", component: OrdersPageComponent, canActivate: [roleGuard(["ADMIN", "MANAGER", "STAFF"])] },
      { path: "products", component: ProductsPageComponent, canActivate: [roleGuard(["ADMIN", "MANAGER", "STAFF"])] },
      { path: "branding", component: BrandingPageComponent, canActivate: [roleGuard(["ADMIN"])] },

      { path: "users", component: UsersPageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "MANAGE_USERS" })] },
      { path: "users/new", component: UserAddPageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "MANAGE_USERS" })] },
      { path: "users/:id/edit", component: UserEditPageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "MANAGE_USERS" })] },
      { path: "users/:id", component: UserProfilePageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "MANAGE_USERS" })] },

      { path: "messages/send", component: SendMessagePageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "SEND_NOTIFICATIONS" })] },
      { path: "reports", component: ReportsPageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "VIEW_REPORTS" })] },
      { path: "duties", component: DutiesPageComponent, canActivate: [accessGuard({ roles: ["ADMIN", "MANAGER"], delegatedCode: "ASSIGN_DUTIES" })] },
      { path: "my-duties", component: MyDutiesPageComponent, canActivate: [roleGuard(["STAFF"])] },
      { path: "handover", component: HandoverPageComponent, canActivate: [roleGuard(["MANAGER"])] },
      { path: "activity-logs", component: ActivityLogsPageComponent, canActivate: [roleGuard(["ADMIN", "MANAGER"])] },
      { path: "profile", component: ProfilePageComponent },

      { path: "", pathMatch: "full", redirectTo: "dashboard" }
    ]
  },
  { path: "**", redirectTo: "login" }
];
