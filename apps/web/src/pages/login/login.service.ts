import { Service } from "@rabjs/react";
import { oidcStatus } from "@/api/auth";
import { apiMessage } from "@/api/http";
import { AuthService } from "@/services/auth.service";

const OIDC_ERRORS: Record<string, string> = {
  OIDC_STATE: "登录已过期，请重新使用统一账号登录",
  OIDC_DENIED: "已取消统一账号登录",
  OIDC_UNAVAILABLE: "统一账号暂时不可用",
  OIDC_EMAIL_CONFLICT: "这个邮箱已经注册过，请改用邮箱密码登录",
  OIDC_EMAIL_INVALID: "统一账号没有提供可用邮箱",
  OIDC_AUDIENCE: "统一账号令牌不被接受",
  OIDC_SUBJECT: "统一账号没有返回用户标识",
};

function oidcErrorMessage(code: string): string {
  return OIDC_ERRORS[code] ?? "统一账号登录失败";
}

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
    const code = new URLSearchParams(window.location.search).get("oidc_error");
    if (code && !this.error) this.error = oidcErrorMessage(code);
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
