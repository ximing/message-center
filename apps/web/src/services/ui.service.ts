import { Service } from "@rabjs/react";

export class UiService extends Service {
  message = "";
  guideOpen = false;

  notify(message: string): void {
    this.message = message;
  }
  dismiss(): void {
    this.message = "";
  }
  openGuide(): void {
    this.guideOpen = true;
  }
  closeGuide(): void {
    this.guideOpen = false;
  }
}
