import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth.service";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="wrap">
      <div class="card login">
        <div class="head">
          <div class="logo"></div>
          <div>
            <div class="title">KAHAWA MKONONI</div>
            <div class="sub">{{ "Sign in to your dashboard" | t }}</div>
          </div>
        </div>

        <div class="field">
          <label>{{ "Email" | t }}</label>
          <input [(ngModel)]="email" placeholder="admin@kahawa.local" />
        </div>
        <div class="field">
          <label>{{ "Password" | t }}</label>
          <input [(ngModel)]="password" type="password" placeholder="••••••••" />
        </div>

        <div class="actions">
          <button class="btn primary" [disabled]="loading()" (click)="onLogin()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 0 1 6 0v3H9Z"
              />
            </svg>
            {{ loading() ? ("Signing in..." | t) : ("Login" | t) }}
          </button>
        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>

        <div class="hint">
          Seed users: <code>admin@kahawa.local</code>, <code>staff@kahawa.local</code>, <code>manager@kahawa.local</code>
        </div>
        <div class="hint" style="margin-top:10px">
          Customer portal: <a routerLink="/customer/login"><b>Customer Login</b></a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 16px;
        background: radial-gradient(circle at top, rgba(111, 78, 55, 0.12), transparent 55%);
        position: relative;
      }
      .wrap::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:var(--brand-logo, none);background-repeat:no-repeat;background-position:center;background-size:62vmin;opacity:.06;filter:grayscale(1)}
      .login {
        width: 100%;
        max-width: 460px;
        padding: 18px;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }
      .logo {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--coffee), var(--dark));
        background-image: var(--brand-logo, none);
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        box-shadow: var(--shadow);
      }
      .title {
        font-size: 18px;
        font-weight: 900;
        color: var(--dark);
        letter-spacing: 0.3px;
      }
      .sub {
        font-size: 12px;
        color: var(--muted);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
      }
      .error {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(198, 40, 40, 0.25);
        background: rgba(198, 40, 40, 0.08);
        color: var(--danger);
        font-size: 13px;
        white-space: pre-line;
      }
      .hint {
        margin-top: 12px;
        font-size: 12px;
        color: var(--muted);
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }
    `
  ]
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = "admin@kahawa.local";
  password = "Admin@12345";
  loading = signal(false);
  error = signal<string | null>(null);

  async onLogin() {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email.trim(), this.password);
      await this.router.navigateByUrl("/dashboard");
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.loading.set(false);
    }
  }
}
