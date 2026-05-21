import { Pipe, PipeTransform, inject } from "@angular/core";
import { I18nService } from "../core/i18n.service";

@Pipe({ name: "t", standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: string | null | undefined): string {
    return this.i18n.t(String(key ?? ""));
  }
}

