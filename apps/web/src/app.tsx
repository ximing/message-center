import { observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import LoginPage from "@/pages/login";
import KeysPage from "@/pages/keys";
import TokensPage from "@/pages/tokens";
import ConnectionsPage from "@/pages/connections";
import RulesPage from "@/pages/rules";
import MessagesPage from "@/pages/messages";
import { AuthService } from "@/services/auth.service";
import { Shell } from "@/shell";

const RequireAuth = observer(function RequireAuth() {
  const auth = useService(AuthService);
  const location = useLocation();
  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
});

export const App = observer(function App() {
  const auth = useService(AuthService);

  useEffect(() => {
    void auth.boot();
  }, [auth]);

  if (auth.status === "booting") {
    return <p className="boot">正在确认登录状态。</p>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/messages" replace />} />
          <Route path="keys" element={<KeysPage />} />
          <Route path="tokens" element={<TokensPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/messages" replace />} />
    </Routes>
  );
});
