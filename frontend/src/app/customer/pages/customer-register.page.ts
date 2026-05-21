import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { GraphqlClient } from "../../core/graphql.client";
import { tokenStorage } from "../../core/token.storage";
import { AuthService } from "../../core/auth.service";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card box">
        <div class="head">
          <div class="logo"></div>
          <div>
            <div class="title">Customer Registration</div>
            <div class="sub">Create an account to place orders</div>
          </div>
        </div>

        <div class="grid form">
          <div class="field"><label>Email</label><input [(ngModel)]="email" placeholder="you@example.com" /></div>
          <div class="field"><label>Username</label><input [(ngModel)]="username" placeholder="username" /></div>
          <div class="field"><label>Phone</label><input [(ngModel)]="phone" placeholder="+255..." /></div>
          <div class="field"><label>Password</label><input [(ngModel)]="password" type="password" placeholder="Min 6 chars" /></div>
        </div>

        <div class="actions">
          <button class="btn primary" (click)="register()" [disabled]="loading()">
            {{ loading() ? "Creating..." : "Create account" }}
          </button>
        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>

        <div class="hint">
          Already registered? <a routerLink="/customer/login"><b>Login</b></a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap{min-height:100vh;display:grid;place-items:center;padding:16px;position:relative}
      .wrap::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:var(--brand-logo, none);background-repeat:no-repeat;background-position:center;background-size:62vmin;opacity:.06;filter:grayscale(1)}
      .box{width:100%;max-width:560px;padding:18px}
      .head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
      .logo{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--coffee),var(--dark));background-image:var(--brand-logo, none);background-size:contain;background-repeat:no-repeat;background-position:center;box-shadow:var(--shadow)}
      .title{font-size:18px;font-weight:900;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      @media (max-width:640px){.grid.form{grid-template-columns:1fr}}
      .actions{display:flex;justify-content:flex-end;margin-top:10px}
      .error{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(198,40,40,.25);background:rgba(198,40,40,.08);color:var(--danger);font-size:13px;white-space:pre-line}
      .hint{margin-top:12px;font-size:12px;color:var(--muted)}
      a{text-decoration:underline}
    `
  ]
})
export class CustomerRegisterPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  email = "";
  username = "";
  phone = "";
  password = "";
  loading = signal(false);
  error = signal<string | null>(null);

  async register() {
    this.error.set(null);
    this.loading.set(true);
    try {
      const data = await this.gql.request<{
        registerCustomer: { tokens: { accessToken: string; refreshToken: string } };
      }>(
        `mutation Register($input: RegisterCustomerInput!) {
          registerCustomer(input:$input) { tokens { accessToken refreshToken } user { id } }
        }`,
        { input: { email: this.email.trim(), username: this.username.trim(), phone: this.phone.trim(), password: this.password } }
      );
      tokenStorage.setAccessToken(data.registerCustomer.tokens.accessToken);
      tokenStorage.setRefreshToken(data.registerCustomer.tokens.refreshToken);
      await this.auth.init();
      await this.router.navigateByUrl("/customer/order");
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.loading.set(false);
    }
  }
}
