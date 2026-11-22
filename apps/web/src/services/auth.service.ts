import { Service } from "@rabjs/react";
import { login, logout, me, register } from "@/api/auth";
import { apiMessage, isUnauthorized } from "@/api/http";
import type { User } from "@/api/types";

export class AuthService extends Service {
  status: "booting" | "ready" = "booting";
  user: User | null = null;
  bootError: string | null = null;
  actionError: string | null = null;
  bootSeq = 0;

  async boot(): Promise<void> {
    const seq = ++this.bootSeq;
    try {
      const user = await me();
      if (seq !== this.bootSeq) return;
      this.user = user;
      this.bootError = null;
    } catch (err) {
      if (seq !== this.bootSeq) return;
      this.user = null;
      this.bootError = isUnauthorized(err) ? null : apiMessage(err);
    } finally {
      if (seq === this.bootSeq) this.status = "ready";
    }
  }

  async login(input: { email: string; password: string }): Promise<void> {
    await login(input);
    this.user = await me();
    this.bootError = null;
    this.actionError = null;
    this.status = "ready";
  }

  async register(input: { email: string; password: string }): Promise<void> {
    await register(input);
    this.user = await me();
    this.bootError = null;
    this.actionError = null;
    this.status = "ready";
  }

  async logout(): Promise<void> {
    this.actionError = null;
    try {
      await logout();
      this.user = null;
    } catch (err) {
      if (isUnauthorized(err)) {
        this.user = null;
        return;
      }
      this.actionError = apiMessage(err);
    }
  }
}
