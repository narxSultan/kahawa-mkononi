import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
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
            <div class="title">Customer Login</div>
            <div class="sub">Sign in with email and password</div>
          </div>
        </div>

        <div class="field">
          <label>Email</label>
          <input [(ngModel)]="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label>Password</label>
          <input [(ngModel)]="password" type="password" placeholder="••••••••" />
        </div>

        <div class="actions">
          <button class="btn primary" (click)="login()" [disabled]="loading()">
            {{ loading() ? "Signing in..." : "Login" }}
          </button>
        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>

        <div class="hint">
          No account? <a routerLink="/customer/register"><b>Create one</b></a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap{min-height:100vh;display:grid;place-items:center;padding:16px;position:relative}
      .wrap::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:var(--brand-logo, none);background-repeat:no-repeat;background-position:center;background-size:62vmin;opacity:.06;filter:grayscale(1)}
      .box{width:100%;max-width:460px;padding:18px}
      .head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
      .logo{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--coffee),var(--dark));background-image:var(--brand-logo, none);background-size:contain;background-repeat:no-repeat;background-position:center;box-shadow:var(--shadow)}
      .title{font-size:18px;font-weight:900;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .actions{display:flex;justify-content:flex-end;margin-top:10px}
      .error{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(198,40,40,.25);background:rgba(198,40,40,.08);color:var(--danger);font-size:13px;white-space:pre-line}
      .hint{margin-top:12px;font-size:12px;color:var(--muted)}
      a{text-decoration:underline}
    `
  ]
})
export class CustomerLoginPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = "";
  password = "";
  loading = signal(false);
  error = signal<string | null>(null);

  async login() {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email.trim(), this.password);
      if (this.auth.role() !== "CUSTOMER") {
        this.auth.logout();
        throw new Error("Not a customer account.");
      }
      await this.router.navigateByUrl("/customer/order");
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.loading.set(false);
    }
  }
}
