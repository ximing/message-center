import { Service } from "@rabjs/react";
import { oidcStatus } from "@/api/auth";
import { apiMessage } from "@/api/http";
import { AuthService } from "@/services/auth.service";

export class LoginPageService extends Service {
  mode: "login" | "register" = "login";
  email = "";
  password = "";
  error: string | null = null;
  oidcEnabled = false;

  get auth(): AuthService {
    return this.resolve(AuthService);
  }

  setMode(mode: "login" | "register"): void {
    this.mode = mode;
    this.error = null;
  }

  setEmail(value: string): void {
    this.email = value;
  }

  setPassword(value: string): void {
    this.password = value;
  }

  async loadOidc(): Promise<void> {
    try {
      const status = await oidcStatus();
      this.oidcEnabled = status.enabled === true;
    } catch {
      this.oidcEnabled = false;
    }
  }

  startOidc(): void {
    window.location.assign("/api/auth/oidc/start");
  }

  async submit(): Promise<void> {
    this.error = null;
    const email = this.email.trim();
    if (!email) {
      this.error = "请填写邮箱";
      return;
    }
    if (!email.includes("@")) {
      this.error = "邮箱格式不对";
      return;
    }
    if (this.password.length < 8) {
      this.error = "密码至少 8 位";
      return;
    }
    try {
      const input = { email, password: this.password };
      if (this.mode === "register") await this.auth.register(input);
      else await this.auth.login(input);
    } catch (err) {
      this.error = apiMessage(err);
    }
  }
}
