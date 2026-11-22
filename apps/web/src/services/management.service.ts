import { Service } from "@rabjs/react";
import { apiMessage, isUnauthorized } from "@/api/http";
import { UiService } from "./ui.service";

export class ManagementService extends Service {
  loaded = false;
  loading = false;
  saving = false;
  error: string | null = null;
  formError: string | null = null;
  confirmError: string | null = null;

  get ui(): UiService {
    return this.resolve(UiService);
  }
  report(
    error: unknown,
    target: "error" | "formError" | "confirmError" = "error",
  ): void {
    if (!isUnauthorized(error)) this[target] = apiMessage(error);
  }
}
