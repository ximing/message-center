import { Input } from "@/components/controls";
import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { safeFrom } from "@/lib/text";
import { AuthService } from "@/services/auth.service";
import { ChannelIcon, ErrorNotice, Icon, Notice } from "@/components/ui";
import { LoginPageService } from "./login.service";

const LoginContent = observer(function LoginContent() {
  const auth = useService(AuthService);
  const service = useService(LoginPageService);
  const location = useLocation();
  useEffect(() => {
    document.title = "登录 · 消息中心";
    void service.loadOidc();
  }, [service]);
  if (auth.user)
    return <Navigate to={safeFrom(location.state) ?? "/messages"} replace />;
  const busy = service.$model.submit.loading;
  return (
    <main className="login-page">
      <div className="login-layout">
        <section className="login-art">
          <div className="brand">
            <span className="brand-symbol">
              <Icon name="brand" />
            </span>
            <span>
              <strong>消息中心</strong>
              <small>Message Center</small>
            </span>
          </div>
          <h1>
            接住每条消息，
            <br />
            送往你的世界。
          </h1>
          <p>
            从微信到 Webhook，把零散的信息交给规则，统一收集到你的知识库和笔记。
          </p>
          <div className="login-map" aria-hidden="true">
            <div className="stack">
              <div className="map-box">
                <ChannelIcon provider="wechat" small />
                微信
              </div>
              <div className="map-box">
                <ChannelIcon provider="webhook" small />
                Webhook
              </div>
            </div>
            <Icon name="arrow" />
            <div className="brand-symbol">
              <Icon name="brand" />
            </div>
            <Icon name="arrow" />
            <div className="stack">
              {["vital", "inwit", "aimo"].map((p) => (
                <div className="map-box" key={p}>
                  <ChannelIcon provider={p} small />
                  {p === "vital" ? "Vital" : p}
                </div>
              ))}
            </div>
          </div>
          <p>你的账号 · 你的连接 · 你的规则</p>
        </section>
        <section className="login-form-wrap">
          <div className="login-form">
            <h2>{service.mode === "login" ? "欢迎回来" : "创建你的账号"}</h2>
            <p>
              {service.mode === "login"
                ? "登录消息中心，继续整理你的信息流。"
                : "用一套规则，连接你的消息与知识。"}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void service.submit();
              }}
            >
              <fieldset disabled={busy}>
                <label className="field">
                  <span>邮箱</span>
                  <Input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    maxLength={255}
                    required
                    value={service.email}
                    onChange={(e) => service.setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>密码</span>
                  <Input
                    name="password"
                    type="password"
                    autoComplete={
                      service.mode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                    placeholder="至少 8 位字符"
                    minLength={8}
                    maxLength={128}
                    required
                    value={service.password}
                    onChange={(e) => service.setPassword(e.target.value)}
                  />
                </label>
                <ErrorNotice message={service.error || auth.bootError} />
                <button className="btn primary" type="submit">
                  {busy
                    ? "正在处理…"
                    : service.mode === "login"
                      ? "登录"
                      : "注册并登录"}
                </button>
              </fieldset>
            </form>
            {service.oidcEnabled && (
              <>
                <div className="divider">或</div>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => service.startOidc()}
                >
                  <Icon name="shield" />
                  使用统一账号登录
                </button>
              </>
            )}
            <div className="login-toggle">
              {service.mode === "login" ? "还没有账号？" : "已有账号？"}{" "}
              <button
                className="text-link"
                disabled={busy}
                onClick={() =>
                  service.setMode(
                    service.mode === "login" ? "register" : "login",
                  )
                }
              >
                {service.mode === "login" ? "创建账号" : "前往登录"}
              </button>
            </div>
            {window.location.hostname === "127.0.0.1" && (
              <Notice tone="amber">
                本地开发请使用{" "}
                <a className="text-link" href="http://localhost:5191/login">
                  localhost:5191
                </a>{" "}
                登录，以便保存会话。
              </Notice>
            )}
            <div className="login-footnote">
              <Icon name="shield" />
              消息与凭证在你的账号下独立管理
            </div>
          </div>
        </section>
      </div>
    </main>
  );
});
export default bindServices(LoginContent, [LoginPageService]);
