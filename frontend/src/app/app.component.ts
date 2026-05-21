import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AuthService } from "./core/auth.service";
import { BrandingService } from "./core/branding.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent {
  private auth = inject(AuthService);
  private branding = inject(BrandingService);
  constructor() {
    void this.auth.init();
    // ensure branding is initialized
    void this.branding.load();
  }
}
