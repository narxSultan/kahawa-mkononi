import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService, type RoleName } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Edit User" | t }}</h2>
          <div class="muted">{{ "Update account information" | t }}</div>
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

      <div class="card pad" style="margin-top:12px" *ngIf="user() as u">
        <div class="grid form">
          <div class="field"><label>{{ "Full name" | t }}</label><input [(ngModel)]="form.fullName" /></div>
          <div class="field"><label>{{ "Email" | t }}</label><input [(ngModel)]="form.email" [disabled]="!isAdmin()" /></div>
          <div class="field"><label>{{ "Phone" | t }}</label><input [(ngModel)]="form.phone" /></div>
          <div class="field"><label>{{ "Username" | t }}</label><input [(ngModel)]="form.username" [disabled]="!isAdmin()" /></div>

          <div class="field" *ngIf="isAdmin()">
            <label>{{ "Status" | t }}</label>
            <select [(ngModel)]="form.status">
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DELETED">DELETED</option>
            </select>
          </div>

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

          <div class="field" style="grid-column:1/-1">
            <label>{{ "Address" | t }}</label>
            <input [(ngModel)]="form.address" />
          </div>

          <div class="field" style="grid-column:1/-1">
            <label>{{ "Reset password (optional)" | t }}</label>
            <input [(ngModel)]="form.password" type="password" placeholder="{{ 'Leave blank to keep current password' | t }}" />
          </div>
        </div>

	        <div class="actions">
	          <button class="btn primary" (click)="save()" [disabled]="saving() || !canSave()">
	            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
	              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
	            </svg>
	            {{ "Save changes" | t }}
	          </button>
	        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>
      </div>

      <div class="muted" *ngIf="loading()">Loading...</div>
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
export class UserEditPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  user = signal<any | null>(null);
  centres = signal<any[]>([]);

  isAdmin = computed(() => this.auth.role() === "ADMIN");

  form: any = {
    fullName: "",
    email: "",
    phone: "",
    username: "",
    role: "STAFF" as RoleName,
    status: "ACTIVE" as UserStatus,
    serviceCentreId: "",
    address: "",
    password: ""
  };

  canSave = computed(() => Boolean(this.form.fullName?.trim()));

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  private get userId() {
    return String(this.route.snapshot.paramMap.get("id") || "");
  }

  async bootstrap() {
    if (!this.userId) return;
    this.loading.set(true);
    try {
      if (this.isAdmin()) {
        const centres = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
          `query Centres { serviceCentres(pagination:{page:1,pageSize:200}){ nodes{ id centreName } } }`
        );
        this.centres.set(centres.serviceCentres.nodes);
      }

      const data = await this.gql.request<{ user: any }>(
        `query User($id: ID!) {
          user(id:$id) { id fullName email phone username status address role{ name } serviceCentre{ id centreName } }
        }`,
        { id: this.userId }
      );
      this.user.set(data.user);
      const u = data.user;
      this.form.fullName = u.fullName ?? "";
      this.form.email = u.email ?? "";
      this.form.phone = u.phone ?? "";
      this.form.username = u.username ?? "";
      this.form.role = u.role?.name ?? "STAFF";
      this.form.status = u.status ?? "ACTIVE";
      this.form.serviceCentreId = u.serviceCentre?.id ?? "";
      this.form.address = u.address ?? "";
    } finally {
      this.loading.set(false);
    }
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
        phone: this.form.phone?.trim() || null,
        address: this.form.address?.trim() || null
      };
      if (this.isAdmin()) {
        input.email = this.form.email.trim();
        input.username = this.form.username?.trim() || null;
        input.role = this.form.role;
        input.status = this.form.status;
        input.serviceCentreId = this.form.serviceCentreId || null;
      }
      if (this.form.password?.trim()) input.password = this.form.password;

      await this.gql.request(`mutation Update($id: ID!, $input: UpdateUserInput!){ updateUser(id:$id,input:$input){ id } }`, {
        id: this.userId,
        input
      });
      await this.router.navigateByUrl(`/users/${this.userId}`);
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }
}
