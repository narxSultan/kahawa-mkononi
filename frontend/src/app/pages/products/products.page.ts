import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import { GraphqlClient } from "../../core/graphql.client";
import { AuthService } from "../../core/auth.service";
import { APP_CONFIG } from "../../core/config";
import { TranslatePipe } from "../../shared/translate.pipe";
import { tokenStorage } from "../../core/token.storage";

function apiBase() {
  return String(APP_CONFIG.apiUrl || "").replace(/\/graphql\/?$/, "");
}

function absUrl(url: string | null | undefined) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${apiBase()}${u}`;
  return `${apiBase()}/${u}`;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Products" | t }}</h2>
          <div class="muted">{{ "Manage products and prices" | t }}</div>
	        </div>
	        <div class="right">
	          <input class="inp" [(ngModel)]="search" placeholder="{{ 'Search...' | t }}" (input)="onSearchInput()" />
	          <button class="btn" (click)="openCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6v-2Z"/></svg>
            {{ "Add product" | t }}
          </button>
          <button class="btn" (click)="load()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            {{ "Refresh" | t }}
          </button>
        </div>
      </div>

	      <div class="card pad" style="margin-top:12px">
	        <div class="table-wrap">
	          <table class="table">
            <thead>
              <tr>
                <th>{{ "Image" | t }}</th>
                <th>{{ "Name" | t }}</th>
                <th>{{ "Price" | t }}</th>
                <th>{{ "Status" | t }}</th>
                <th style="text-align:right"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of products()">
                <td style="width:72px">
                  <div class="img" *ngIf="p.imageUrl; else noImg">
                    <img [src]="abs(p.imageUrl)" alt="" />
                  </div>
                  <ng-template #noImg>
                    <div class="img placeholder"></div>
                  </ng-template>
                </td>
                <td>
                  <div style="font-weight:900">{{ p.name }}</div>
                  <div class="muted2">{{ p.description || "—" }}</div>
                </td>
                <td>{{ p.price }} {{ p.currency }}</td>
                <td>
                  <span class="badge" [class.success]="p.isActive" [class.warning]="!p.isActive">{{ (p.isActive ? "Active" : "Inactive") | t }}</span>
                </td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn" (click)="openEdit(p)" [disabled]="saving()">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75 1.82-1.82Z"/></svg>
                    {{ "Edit" | t }}
                  </button>
                  <button class="btn danger" *ngIf="p.isActive" (click)="openDeactivate(p)" [disabled]="saving()">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
                    {{ "Delete" | t }}
                  </button>
                  <button class="btn" *ngIf="!p.isActive" (click)="reactivate(p)" [disabled]="saving()">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.65-4H4.26A8 8 0 0 0 12 20a8 8 0 0 0 0-16Z"/></svg>
                    {{ "Activate" | t }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="!products().length">
                <td colspan="5" class="muted" style="padding:14px">{{ "No products" | t }}</td>
              </tr>
	            </tbody>
	          </table>
	        </div>
	        <div class="pager">
	          <button class="btn" (click)="prevPage()" [disabled]="loading() || page()<=1">
	            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
	            Prev
	          </button>
	          <div class="muted2">Page {{ page() }} / {{ totalPages() }}</div>
	          <button class="btn" (click)="nextPage()" [disabled]="loading() || !pageInfo()?.hasNextPage">
	            Next
	            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
	          </button>
	        </div>
	      </div>

      <div class="overlay" *ngIf="editing() as p">
        <div class="dialog card">
          <div class="title">{{ (p.id ? "Edit product" : "Create product") | t }}</div>
          <div class="sub">{{ "Image upload is optional" | t }}</div>

          <div class="grid">
            <label class="lbl">{{ "Name" | t }}</label>
            <input class="inp2" [(ngModel)]="form.name" />

            <label class="lbl">{{ "Description" | t }}</label>
            <input class="inp2" [(ngModel)]="form.description" />

            <label class="lbl">{{ "Price" | t }}</label>
            <input class="inp2" type="number" min="0" step="0.01" [(ngModel)]="form.price" />

            <label class="lbl">{{ "Currency" | t }}</label>
            <input class="inp2" [(ngModel)]="form.currency" />

            <label class="lbl">{{ "Image (optional)" | t }}</label>
            <input class="inp2" type="file" accept="image/*" (change)="onFile($event)" />
            <div class="muted2" *ngIf="form.imageUrl">{{ "Current" | t }}: {{ form.imageUrl }}</div>
            <div class="actions" style="justify-content:flex-start" *ngIf="form.imageUrl">
              <button class="btn danger" (click)="removeImage()" [disabled]="saving()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
                {{ "Remove image" | t }}
              </button>
              <button class="btn" (click)="previewImage()" [disabled]="!form.imageUrl">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-7.633 0-10 7-10 7s2.367 7 10 7 10-7 10-7-2.367-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z"/></svg>
                {{ "Preview" | t }}
              </button>
            </div>
          </div>

          <div class="err" *ngIf="error()">{{ error() }}</div>

          <div class="actions">
            <button class="btn" (click)="closeEdit()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              {{ "Cancel" | t }}
            </button>
            <button class="btn primary" (click)="save()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM6 8V5h9v3H6Z"/></svg>
              {{ "Save" | t }}
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="deactivateTarget() as p">
        <div class="dialog card">
          <div class="title">{{ "Delete product?" | t }}</div>
          <div class="sub">{{ "This will hide the product from customers" | t }}</div>
          <div class="mini">
            <div><b>{{ p.name }}</b></div>
            <div>{{ p.price }} {{ p.currency }}</div>
          </div>
          <div class="actions">
            <button class="btn" (click)="closeDeactivate()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              {{ "Cancel" | t }}
            </button>
            <button class="btn danger" (click)="deactivate(p)" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
              {{ "Delete" | t }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted);margin-top:-6px}
      .muted2{color:var(--muted);font-size:12px;margin-top:4px}
      .pad{padding:14px}
      .inp{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .img{width:54px;height:54px;border-radius:14px;overflow:hidden;border:1px solid var(--border);background:rgba(245,239,230,.55)}
      .img img{width:100%;height:100%;object-fit:cover;display:block}
      .img.placeholder{background:linear-gradient(135deg,rgba(111,78,55,.12),rgba(62,39,35,.10))}
      .badge{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:rgba(0,0,0,.04)}
      .badge.success{background:rgba(46,125,50,.12);border-color:rgba(46,125,50,.25);color:var(--success)}
      .badge.warning{background:rgba(255,179,0,.18);border-color:rgba(255,179,0,.35);color:#7a4b00}
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:1000}
      .dialog{width:100%;max-width:520px;padding:18px}
      .title{font-weight:900;color:var(--dark);letter-spacing:.2px}
      .sub{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.4}
      .grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}
      .lbl{font-size:12px;color:var(--muted);text-align:left}
      .inp2{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
      .err{margin-top:10px;color:var(--danger);font-size:12px}
	      .mini{margin-top:10px;text-align:left;font-size:13px;color:var(--dark);background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
	      .table-wrap{overflow:auto}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	    `
	  ]
})
export class ProductsPageComponent {
  private gql = inject(GraphqlClient);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

	  products = signal<any[]>([]);
	  search = "";
	  page = signal(1);
	  readonly pageSize = 10;
	  pageInfo = signal<any | null>(null);
	  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));
	  private searchTimer: any = null;

  editing = signal<any | null>(null);
  deactivateTarget = signal<any | null>(null);
  selectedFile: File | null = null;

  form: { name: string; description: string; price: any; currency: string; imageUrl: string | null } = {
    name: "",
    description: "",
    price: "",
    currency: "TZS",
    imageUrl: null
  };

  abs = absUrl;

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

	  async load() {
	    this.loading.set(true);
	    try {
	      const data = await this.gql.request<{ products: { nodes: any[]; pageInfo: any } }>(
	        `query Products($search: String, $page: Int!, $pageSize: Int!){
	          products(pagination:{page:$page,pageSize:$pageSize}, search:$search, onlyActive:false){
	            nodes{ id name description price currency isActive imageUrl }
	            pageInfo { page pageSize total hasNextPage }
	          }
	        }`,
	        { search: this.search.trim() || null, page: this.page(), pageSize: this.pageSize }
	      );
	      this.products.set(data.products.nodes ?? []);
	      this.pageInfo.set(data.products.pageInfo);
	    } finally {
	      this.loading.set(false);
	    }
	  }

	  onSearchInput() {
	    try {
	      if (this.searchTimer) clearTimeout(this.searchTimer);
	    } catch {
	      // ignore
	    }
	    this.searchTimer = setTimeout(() => {
	      this.page.set(1);
	      void this.load();
	    }, 250);
	  }

	  prevPage() {
	    if (this.page() <= 1) return;
	    this.page.set(this.page() - 1);
	    void this.load();
	  }

	  nextPage() {
	    if (!this.pageInfo()?.hasNextPage) return;
	    this.page.set(this.page() + 1);
	    void this.load();
	  }

  openCreate() {
    this.error.set(null);
    this.selectedFile = null;
    this.form = { name: "", description: "", price: "", currency: "TZS", imageUrl: null };
    this.editing.set({ id: null });
  }

  openEdit(p: any) {
    this.error.set(null);
    this.selectedFile = null;
    this.form = {
      name: String(p.name ?? ""),
      description: String(p.description ?? ""),
      price: p.price,
      currency: String(p.currency ?? "TZS"),
      imageUrl: p.imageUrl ?? null
    };
    this.editing.set(p);
  }

  closeEdit() {
    this.editing.set(null);
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.selectedFile = f;
  }

  async uploadSelectedFile(): Promise<string | null> {
    if (!this.selectedFile) return null;
    const fd = new FormData();
    fd.append("file", this.selectedFile);
    const token = tokenStorage.getAccessToken();
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`${apiBase()}/upload`, fd, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
    );
    return res?.url ?? null;
  }

  removeImage() {
    this.form.imageUrl = null;
    this.selectedFile = null;
  }

  previewImage() {
    const u = this.form.imageUrl;
    if (!u) return;
    window.open(absUrl(u), "_blank", "noopener,noreferrer");
  }

  async save() {
    const current = this.editing();
    if (!current) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const imageUrl = (await this.uploadSelectedFile()) ?? this.form.imageUrl;
      if (!current.id) {
        await this.gql.request(
          `mutation C($input: CreateProductInput!){
            createProduct(input:$input){ id }
          }`,
          { input: { name: this.form.name, description: this.form.description || null, price: Number(this.form.price), currency: this.form.currency || "TZS", imageUrl } }
        );
      } else {
        await this.gql.request(
          `mutation U($id: ID!, $input: UpdateProductInput!){
            updateProduct(id:$id, input:$input){ id }
          }`,
          { id: current.id, input: { name: this.form.name, description: this.form.description || null, price: Number(this.form.price), currency: this.form.currency || "TZS", imageUrl } }
        );
      }
      this.closeEdit();
      await this.load();
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  openDeactivate(p: any) {
    this.deactivateTarget.set(p);
  }

  closeDeactivate() {
    this.deactivateTarget.set(null);
  }

  async deactivate(p: any) {
    this.saving.set(true);
    try {
      await this.gql.request(`mutation D($id: ID!){ deleteProduct(id:$id){ id isActive } }`, { id: p.id });
      this.closeDeactivate();
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async reactivate(p: any) {
    this.saving.set(true);
    try {
      await this.gql.request(`mutation A($id: ID!){ updateProduct(id:$id, input:{ isActive:true }){ id isActive } }`, { id: p.id });
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
}
