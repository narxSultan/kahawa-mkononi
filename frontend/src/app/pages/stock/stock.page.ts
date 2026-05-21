import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Stock Control" | t }}</h2>
          <div class="muted">{{ "Track stock in/out, balance, and low stock alerts per centre" | t }}</div>
        </div>
        <div class="right">
          <select class="sel" *ngIf="isAdmin()" [(ngModel)]="selectedCentreId" (change)="bootstrap()">
            <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
          </select>
          <button class="btn" (click)="bootstrap()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            {{ "Refresh" | t }}
          </button>
        </div>
      </div>

      <div class="grid two" style="margin-top:12px">
        <div class="card pad">
	          <div class="head">
	            <div>
	              <div class="title">{{ "Stock items" | t }}</div>
	              <div class="sub">Balance = IN - OUT (computed)</div>
	            </div>
            <button class="btn primary" *ngIf="canCreateItem()" (click)="showCreateItem.set(!showCreateItem())">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
              </svg>
              {{ "New Item" | t }}
            </button>
          </div>

	          <div class="card pad" *ngIf="showCreateItem() && canCreateItem()" style="margin:10px 0">
	            <div class="grid form">
	              <div class="field"><label>{{ "Name" | t }}</label><input [(ngModel)]="itemForm.name" placeholder="{{ 'Coffee beans' | t }}" /></div>
	              <div class="field"><label>{{ "Unit" | t }}</label><input [(ngModel)]="itemForm.unit" placeholder="{{ 'kg / cups / packs' | t }}" /></div>
	              <div class="field"><label>{{ "Low stock threshold" | t }}</label><input type="number" [(ngModel)]="itemForm.lowStockThreshold" /></div>
	            </div>
            <div class="actions">
              <button class="btn" (click)="showCreateItem.set(false)">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
                </svg>
                {{ "Cancel" | t }}
              </button>
              <button class="btn primary" (click)="createItem()" [disabled]="saving()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
                </svg>
                {{ "Create" | t }}
              </button>
            </div>
          </div>

	          <div class="table-wrap">
	            <table class="table">
	              <thead>
	                <tr>
	                  <th>{{ "Item" | t }}</th>
	                  <th>{{ "Unit" | t }}</th>
	                  <th>{{ "In" | t }}</th>
	                  <th>{{ "Out" | t }}</th>
	                  <th>{{ "Balance" | t }}</th>
	                  <th>{{ "Total" | t }}</th>
	                  <th>{{ "Low" | t }}</th>
	                  <th *ngIf="canCreateItem()" style="text-align:right"></th>
	                </tr>
	              </thead>
	              <tbody>
	                <tr *ngFor="let i of items()">
	                  <td>
	                    <div style="font-weight:900;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
	                      <span>{{ i.name }}</span>
	                      <span class="badge" *ngIf="!i.isActive" [class.warning]="true">{{ "Inactive" | t }}</span>
	                    </div>
	                  </td>
	                  <td>{{ i.unit }}</td>
	                  <td>{{ i.inTotal }}</td>
	                  <td>{{ i.outTotal }}</td>
	                  <td>
	                    <span class="badge" [class.danger]="i.balance <= i.lowStockThreshold">{{ i.balance }}</span>
	                  </td>
	                  <td>{{ i.total }}</td>
	                  <td>{{ i.lowStockThreshold }}</td>
	                  <td *ngIf="canCreateItem()" style="text-align:right;white-space:nowrap">
	                    <button class="btn" (click)="openEdit(i)" [disabled]="saving()">
	                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
	                        <path
	                          d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75 1.82-1.82Z"
	                        />
	                      </svg>
	                      {{ "Edit" | t }}
	                    </button>
	                    <button class="btn danger" *ngIf="i.isActive" (click)="openDeactivate(i)" [disabled]="saving()">
	                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
	                        <path
	                          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
	                        />
	                      </svg>
	                      {{ "Remove" | t }}
	                    </button>
	                    <button class="btn" *ngIf="!i.isActive" (click)="reactivate(i)" [disabled]="saving()">
	                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
	                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.65-4H4.26A8 8 0 0 0 12 20a8 8 0 0 0 0-16Z" />
	                      </svg>
	                      {{ "Activate" | t }}
	                    </button>
	                  </td>
	                </tr>
	                <tr *ngIf="!items().length">
	                  <td [attr.colspan]="canCreateItem() ? 8 : 7" class="muted" style="padding:14px">{{ "No stock items" | t }}</td>
	                </tr>
	              </tbody>
	            </table>
	          </div>
            <div class="pager" *ngIf="itemsPageInfo()">
              <button class="btn" (click)="prevItemsPage()" [disabled]="loading() || itemsPage()<=1">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                Prev
              </button>
              <div class="muted2">Page {{ itemsPage() }} / {{ itemsTotalPages() }}</div>
              <button class="btn" (click)="nextItemsPage()" [disabled]="loading() || !itemsPageInfo()?.hasNextPage">
                Next
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
              </button>
            </div>
	        </div>

        <div class="card pad">
	          <div class="head">
	            <div>
	              <div class="title">{{ "Stock movement" | t }}</div>
	              <div class="sub">IN and OUT auto-apply sign</div>
	            </div>
	          </div>

          <div class="grid form">
	            <div class="field">
	              <label>{{ "Item" | t }}</label>
	              <select [(ngModel)]="moveForm.stockItemId">
	                <option value="">{{ "Select..." | t }}</option>
	                <option *ngFor="let i of itemOptions()" [value]="i.id">{{ i.name }}</option>
	              </select>
	            </div>
	            <div class="field">
	              <label>{{ "Type" | t }}</label>
	              <select [(ngModel)]="moveForm.type">
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
              </select>
            </div>
		            <div class="field">
		              <label>{{ "Quantity" | t }}</label>
		              <input type="number" [(ngModel)]="moveForm.quantity" />
		            </div>
                <div class="field">
                  <label>{{ "At" | t }}</label>
                  <input type="datetime-local" [(ngModel)]="moveForm.happenedAt" />
                </div>
		            <div class="field">
		              <label>{{ "Note" | t }}</label>
		              <input [(ngModel)]="moveForm.note" />
		            </div>
	          </div>
          <div class="actions">
            <button class="btn primary" (click)="createMovement()" [disabled]="saving() || !moveForm.stockItemId">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
              </svg>
              {{ "Save movement" | t }}
            </button>
          </div>

          <div style="margin-top:12px">
	            <div class="title">{{ "Recent movements" | t }}</div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ "Item" | t }}</th>
                    <th>{{ "Type" | t }}</th>
                    <th>{{ "Qty" | t }}</th>
                    <th>{{ "At" | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let m of movements()">
                    <td>{{ m.stockItem?.name }}</td>
                    <td>{{ m.type }}</td>
                    <td>{{ m.quantity }}</td>
                    <td>{{ (m.happenedAt || '').slice(0,16).replace('T',' ') }}</td>
                  </tr>
                  <tr *ngIf="!movements().length">
                    <td colspan="4" class="muted" style="padding:14px">{{ "No movements" | t }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pager" *ngIf="movementsPageInfo()">
              <button class="btn" (click)="prevMovementsPage()" [disabled]="loading() || movementsPage()<=1">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                Prev
              </button>
              <div class="muted2">Page {{ movementsPage() }} / {{ movementsTotalPages() }}</div>
              <button class="btn" (click)="nextMovementsPage()" [disabled]="loading() || !movementsPageInfo()?.hasNextPage">
                Next
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
              </button>
            </div>
          </div>
        </div>
	      </div>

		      <ng-container *ngIf="canCreateItem()">
		        <div class="overlay" *ngIf="editing() as i">
		          <div class="dialog card">
		            <div class="title">{{ "Edit stock item" | t }}</div>
		            <div class="sub">{{ i.name }}</div>
		            <div class="grid form" style="margin-top:12px">
		              <div class="field"><label>{{ "Name" | t }}</label><input [(ngModel)]="editForm.name" /></div>
		              <div class="field"><label>{{ "Unit" | t }}</label><input [(ngModel)]="editForm.unit" /></div>
		              <div class="field"><label>{{ "Low stock threshold" | t }}</label><input type="number" [(ngModel)]="editForm.lowStockThreshold" /></div>
		              <div class="field">
		                <label>{{ "Status" | t }}</label>
		                <select [(ngModel)]="editForm.isActive">
		                  <option [ngValue]="true">{{ "Active" | t }}</option>
		                  <option [ngValue]="false">{{ "Inactive" | t }}</option>
		                </select>
		              </div>
		            </div>
		            <div class="actions">
		              <button class="btn" (click)="closeEdit()" [disabled]="saving()">
		                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
		                  <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
		                </svg>
		                {{ "Cancel" | t }}
		              </button>
		              <button class="btn primary" (click)="saveEdit(i)" [disabled]="saving()">
		                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM6 8V5h9v3H6Z"/></svg>
		                {{ "Save" | t }}
		              </button>
		            </div>
		          </div>
		        </div>
		
		        <div class="overlay" *ngIf="deactivateTarget() as i">
		          <div class="dialog card">
		            <div class="title">{{ "Remove stock item?" | t }}</div>
		            <div class="sub">{{ "This will deactivate the stock item" | t }}</div>
		            <div class="mini">
		              <div><b>{{ i.name }}</b></div>
		              <div>{{ "Balance" | t }}: {{ i.balance }} {{ i.unit }}</div>
		            </div>
		            <div class="actions">
		              <button class="btn" (click)="closeDeactivate()" [disabled]="saving()">
		                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
		                  <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
		                </svg>
		                {{ "Cancel" | t }}
		              </button>
		              <button class="btn danger" (click)="deactivate(i)" [disabled]="saving()">
		                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
		                  <path
		                    d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
		                  />
		                </svg>
		                {{ "Remove" | t }}
		              </button>
		            </div>
		          </div>
		        </div>
		      </ng-container>
		    </div>
		  `,
	  styles: [
	    `
	      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
	      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
	      .muted{color:var(--muted)}
	      .pad{padding:14px}
	      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
	      .grid.two{grid-template-columns:1fr 1fr}
	      @media (max-width: 900px){.grid.two{grid-template-columns:1fr}}
	      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
	      .title{font-weight:800;color:var(--dark)}
	      .sub{font-size:12px;color:var(--muted)}
	      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
	      @media (max-width:720px){.grid.form{grid-template-columns:1fr}}
	      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
	      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:1000}
	      .dialog{width:100%;max-width:560px;padding:18px}
	      .mini{margin-top:10px;text-align:left;font-size:13px;color:var(--dark);background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
	      .table-wrap{overflow:auto}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	    `
	  ]
})
export class StockPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  canCreateItem = computed(() => ["ADMIN", "MANAGER"].includes(this.auth.role() ?? ""));

  centres = signal<any[]>([]);
  selectedCentreId = "";

  items = signal<any[]>([]);
  itemOptions = signal<any[]>([]);
  movements = signal<any[]>([]);
  itemsPage = signal(1);
  readonly itemsPageSize = 10;
  itemsPageInfo = signal<any | null>(null);
  itemsTotalPages = computed(() => Math.max(1, Math.ceil(Number(this.itemsPageInfo()?.total ?? 0) / this.itemsPageSize)));

  movementsPage = signal(1);
  readonly movementsPageSize = 10;
  movementsPageInfo = signal<any | null>(null);
  movementsTotalPages = computed(() => Math.max(1, Math.ceil(Number(this.movementsPageInfo()?.total ?? 0) / this.movementsPageSize)));

  editing = signal<any | null>(null);
  deactivateTarget = signal<any | null>(null);

  loading = signal(false);
  saving = signal(false);
  showCreateItem = signal(false);

  itemForm: any = { name: "", unit: "unit", lowStockThreshold: 0 };
  moveForm: any = { stockItemId: "", type: "IN", quantity: 1, note: "", happenedAt: "" };
  editForm: any = { name: "", unit: "unit", lowStockThreshold: 0, isActive: true };

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  async bootstrap() {
    this.loading.set(true);
    try {
      if (this.isAdmin()) {
        const data = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
          `query Centres { serviceCentres(pagination:{page:1,pageSize:50}){ nodes{ id centreName } } }`
        );
        this.centres.set(data.serviceCentres.nodes);
        if (!this.selectedCentreId) this.selectedCentreId = this.centres()[0]?.id ?? "";
      } else {
        this.selectedCentreId = this.auth.user()?.serviceCentre?.id ?? "";
      }
      if (!this.selectedCentreId) return;
      this.itemsPage.set(1);
      this.movementsPage.set(1);
      await Promise.all([this.loadItemOptions(), this.loadItems(), this.loadMovements()]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadItemOptions() {
    const data = await this.gql.request<{ stockItems: { nodes: any[] } }>(
      `query Options($serviceCentreId: ID!){
        stockItems(pagination:{page:1,pageSize:200}, serviceCentreId:$serviceCentreId){
          nodes{ id name unit isActive lowStockThreshold inTotal outTotal total balance }
        }
      }`,
      { serviceCentreId: this.selectedCentreId }
    );
    const nodes = data.stockItems.nodes ?? [];
    this.itemOptions.set(nodes);
    const current = String(this.moveForm.stockItemId ?? "");
    if (nodes.length) {
      const stillValid = current && nodes.some((n) => n.id === current);
      if (!stillValid) this.moveForm = { ...this.moveForm, stockItemId: nodes[0].id };
    } else if (current) {
      this.moveForm = { ...this.moveForm, stockItemId: "" };
    }
  }

	  async loadItems() {
	    const data = await this.gql.request<{ stockItems: { nodes: any[]; pageInfo: any } }>(
	      `query Items($serviceCentreId: ID!, $page: Int!, $pageSize: Int!){
	        stockItems(pagination:{page:$page,pageSize:$pageSize}, serviceCentreId:$serviceCentreId){
            nodes{ id name unit isActive lowStockThreshold inTotal outTotal total balance }
            pageInfo { page pageSize total hasNextPage }
          }
	      }`,
	      { serviceCentreId: this.selectedCentreId, page: this.itemsPage(), pageSize: this.itemsPageSize }
	    );
    this.items.set(data.stockItems.nodes ?? []);
    this.itemsPageInfo.set(data.stockItems.pageInfo ?? null);
  }

  async loadMovements() {
    const data = await this.gql.request<{ stockMovements: { nodes: any[]; pageInfo: any } }>(
      `query Movements($serviceCentreId: ID!, $page: Int!, $pageSize: Int!){
        stockMovements(pagination:{page:$page,pageSize:$pageSize}, serviceCentreId:$serviceCentreId){
          nodes{ id type quantity happenedAt stockItem{ id name } }
          pageInfo { page pageSize total hasNextPage }
        }
      }`,
      { serviceCentreId: this.selectedCentreId, page: this.movementsPage(), pageSize: this.movementsPageSize }
    );
    this.movements.set(data.stockMovements.nodes ?? []);
    this.movementsPageInfo.set(data.stockMovements.pageInfo ?? null);
  }

  async createItem() {
    if (!this.selectedCentreId) return;
    this.saving.set(true);
    try {
      const input = {
        serviceCentreId: this.selectedCentreId,
        name: this.itemForm.name.trim(),
        unit: this.itemForm.unit.trim() || "unit",
        lowStockThreshold: Number(this.itemForm.lowStockThreshold) || 0
      };
      await this.gql.request(`mutation CreateItem($input: CreateStockItemInput!){ createStockItem(input:$input){ id } }`, { input });
      this.showCreateItem.set(false);
      this.itemForm = { name: "", unit: "unit", lowStockThreshold: 0 };
      this.itemsPage.set(1);
      await Promise.all([this.loadItemOptions(), this.loadItems()]);
    } finally {
      this.saving.set(false);
    }
  }

  async createMovement() {
    if (!this.selectedCentreId) return;
    const stockItemId = String(this.moveForm.stockItemId ?? "").trim();
    if (!stockItemId) return;
    this.saving.set(true);
    try {
      const happenedAtRaw = String(this.moveForm.happenedAt ?? "").trim();
      const happenedAt = happenedAtRaw ? new Date(happenedAtRaw) : null;
      const happenedAtIso = happenedAt && Number.isFinite(happenedAt.valueOf()) ? happenedAt.toISOString() : null;
      const input = {
        serviceCentreId: this.selectedCentreId,
        stockItemId,
        type: this.moveForm.type,
        quantity: Number(this.moveForm.quantity) || 0,
        note: this.moveForm.note?.trim() || null,
        ...(happenedAtIso ? { happenedAt: happenedAtIso } : {})
      };
      await this.gql.request(`mutation Move($input: CreateStockMovementInput!){ createStockMovement(input:$input){ id } }`, { input });
      this.moveForm = { ...this.moveForm, quantity: 1, note: "", happenedAt: "" };
      this.movementsPage.set(1);
      await Promise.all([this.loadItemOptions(), this.loadItems(), this.loadMovements()]);
    } finally {
      this.saving.set(false);
    }
  }

  openEdit(i: any) {
    if (!this.canCreateItem()) return;
    this.editing.set(i);
    this.editForm = {
      name: String(i?.name ?? ""),
      unit: String(i?.unit ?? "unit"),
      lowStockThreshold: Number(i?.lowStockThreshold ?? 0) || 0,
      isActive: Boolean(i?.isActive ?? true)
    };
  }

  closeEdit() {
    this.editing.set(null);
  }

  async saveEdit(i: any) {
    const id = String(i?.id ?? "");
    if (!id) return;
    this.saving.set(true);
    try {
      const input = {
        name: String(this.editForm.name ?? "").trim(),
        unit: String(this.editForm.unit ?? "").trim() || "unit",
        lowStockThreshold: Number(this.editForm.lowStockThreshold) || 0,
        isActive: Boolean(this.editForm.isActive)
      };
      await this.gql.request(`mutation Upd($id: ID!, $input: UpdateStockItemInput!){ updateStockItem(id:$id, input:$input){ id } }`, { id, input });
      this.closeEdit();
      await Promise.all([this.loadItemOptions(), this.loadItems()]);
    } finally {
      this.saving.set(false);
    }
  }

  openDeactivate(i: any) {
    if (!this.canCreateItem()) return;
    this.deactivateTarget.set(i);
  }

  closeDeactivate() {
    this.deactivateTarget.set(null);
  }

  async deactivate(i: any) {
    if (!this.canCreateItem()) return;
    const id = String(i?.id ?? "");
    if (!id) return;
    this.saving.set(true);
    try {
      await this.gql.request(`mutation Del($id: ID!){ deleteStockItem(id:$id){ id } }`, { id });
      this.closeDeactivate();
      await Promise.all([this.loadItemOptions(), this.loadItems()]);
    } finally {
      this.saving.set(false);
    }
  }

  async reactivate(i: any) {
    if (!this.canCreateItem()) return;
    const id = String(i?.id ?? "");
    if (!id) return;
    this.saving.set(true);
    try {
      const input = { isActive: true };
      await this.gql.request(`mutation Act($id: ID!, $input: UpdateStockItemInput!){ updateStockItem(id:$id, input:$input){ id } }`, { id, input });
      await Promise.all([this.loadItemOptions(), this.loadItems()]);
    } finally {
      this.saving.set(false);
    }
  }

  prevItemsPage() {
    if (this.itemsPage() <= 1) return;
    this.itemsPage.set(this.itemsPage() - 1);
    void this.loadItems();
  }

  nextItemsPage() {
    if (!this.itemsPageInfo()?.hasNextPage) return;
    this.itemsPage.set(this.itemsPage() + 1);
    void this.loadItems();
  }

  prevMovementsPage() {
    if (this.movementsPage() <= 1) return;
    this.movementsPage.set(this.movementsPage() - 1);
    void this.loadMovements();
  }

  nextMovementsPage() {
    if (!this.movementsPageInfo()?.hasNextPage) return;
    this.movementsPage.set(this.movementsPage() + 1);
    void this.loadMovements();
  }
}
