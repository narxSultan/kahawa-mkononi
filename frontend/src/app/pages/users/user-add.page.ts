import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService, type RoleName } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Add User" | t }}</h2>
          <div class="muted">{{ "Create a new account" | t }}</div>
        </div>
        <div class="right">
          <button class="btn" (click)="back()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20v-2Z" />
            </svg>
            {{ "Back" | t }}
          </button>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px">
        <div class="grid form">
          <div class="field"><label>{{ "Full name" | t }}</label><input [(ngModel)]="form.fullName" /></div>
          <div class="field"><label>{{ "Email" | t }}</label><input [(ngModel)]="form.email" placeholder="name@company.com" /></div>
          <div class="field"><label>{{ "Phone" | t }}</label><input [(ngModel)]="form.phone" placeholder="+255..." /></div>
          <div class="field"><label>{{ "Username" | t }}</label><input [(ngModel)]="form.username" placeholder="{{ 'optional' | t }}" /></div>
          <div class="field"><label>{{ "Password" | t }}</label><input [(ngModel)]="form.password" type="password" placeholder="{{ 'Min 8+ chars' | t }}" /></div>

          <div class="field" *ngIf="isAdmin()">
            <label>{{ "Role" | t }}</label>
            <select [(ngModel)]="form.role">
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="STAFF">STAFF</option>
              <option value="CALL_CENTRE_AGENT">CALL_CENTRE_AGENT</option>
            </select>
          </div>

          <div class="field" *ngIf="isAdmin()">
            <label>{{ "Service centre" | t }}</label>
            <select [(ngModel)]="form.serviceCentreId">
              <option value="">{{ "(none)" | t }}</option>
              <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
            </select>
          </div>

          <div class="field" *ngIf="!isAdmin()">
            <label>{{ "Role" | t }}</label>
            <input value="STAFF" disabled />
          </div>
          <div class="field" *ngIf="!isAdmin()">
            <label>{{ "Service centre" | t }}</label>
            <input [value]="centreName" disabled />
          </div>

          <div class="field" style="grid-column:1/-1">
            <label>{{ "Address" | t }}</label>
            <input [(ngModel)]="form.address" placeholder="{{ 'optional' | t }}" />
          </div>
        </div>

        <div class="actions">
          <button class="btn primary" (click)="save()" [disabled]="saving() || !canSave()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
            </svg>
            {{ "Create user" | t }}
          </button>
        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>
      </div>
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media (max-width:720px){.grid.form{grid-template-columns:1fr}}
      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
      .error{margin-top:10px;color:var(--danger);white-space:pre-line}
    `
  ]
})
export class UserAddPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  centres = signal<any[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  centreName = computed(() => this.auth.user()?.serviceCentre?.centreName ?? "—");

  form: any = {
    fullName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    role: "STAFF" as RoleName,
    serviceCentreId: "",
    address: ""
  };

  canSave = computed(() => {
    return Boolean(this.form.fullName?.trim() && this.form.email?.trim() && this.form.password?.trim());
  });

  ngOnInit() {
    void this.auth.init().then(() => this.loadCentres());
  }

  async loadCentres() {
    if (!this.isAdmin()) return;
    const data = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
      `query Centres { serviceCentres(pagination:{page:1,pageSize:200}){ nodes{ id centreName } } }`
    );
    this.centres.set(data.serviceCentres.nodes);
  }

  back() {
    void this.router.navigateByUrl("/users");
  }

  async save() {
    this.error.set(null);
    this.saving.set(true);
    try {
      const input: any = {
        fullName: this.form.fullName.trim(),
        email: this.form.email.trim(),
        phone: this.form.phone?.trim() || null,
        username: this.form.username?.trim() || null,
        password: this.form.password,
        role: this.isAdmin() ? this.form.role : "STAFF",
        serviceCentreId: this.isAdmin() ? this.form.serviceCentreId || null : null,
        address: this.form.address?.trim() || null
      };
      await this.gql.request(`mutation Create($input: CreateUserInput!){ createUser(input:$input){ id } }`, { input });
      await this.router.navigateByUrl("/users");
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }
}
