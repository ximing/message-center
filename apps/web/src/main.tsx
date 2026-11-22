import "@/styles/index.css";
import { register, resolve, RSRoot } from "@rabjs/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { setUnauthorizedHandler } from "@/api/http";
import { App } from "@/app";
import { UiService } from "@/services/ui.service";
import { AuthService } from "@/services/auth.service";

register(AuthService);
register(UiService);

const auth = resolve(AuthService);
setUnauthorizedHandler(() => {
  auth.user = null;
});

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <RSRoot>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RSRoot>
    </StrictMode>,
  );
}
