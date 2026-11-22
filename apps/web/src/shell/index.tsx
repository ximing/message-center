import { observer, useService } from "@rabjs/react";
import { NavLink, Outlet, useLocation } from "react-router";
import { AuthService } from "@/services/auth.service";
import { UiService } from "@/services/ui.service";
import {
  ErrorNotice,
  Icon,
  IconButton,
  Notifications,
  type IconName,
} from "@/components";
import { Guide } from "./guide";

const LINKS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/messages", label: "消息记录", icon: "inbox" },
  { to: "/rules", label: "转发规则", icon: "route" },
  { to: "/connections", label: "目的地连接", icon: "layers" },
  { to: "/keys", label: "接入密钥", icon: "key" },
  { to: "/tokens", label: "接口令牌", icon: "lock" },
];

export const Shell = observer(function Shell() {
  const auth = useService(AuthService);
  const ui = useService(UiService);
  const location = useLocation();
  if (!auth.user) return null;
  const name = auth.user.displayName || auth.user.email;
  const initial = Array.from(name)[0]?.toUpperCase() || "我";
  return (
    <>
      <aside className="sidebar">
        <NavLink className="brand" to="/messages" aria-label="消息中心首页">
          <span className="brand-symbol">
            <Icon name="brand" />
          </span>
          <span>
            <strong>消息中心</strong>
            <small>Message Center</small>
          </span>
        </NavLink>
        <div className="workspace">
          <span className="avatar">{initial}</span>
          <div className="grow">
            <strong>个人工作空间</strong>
            <small className="muted" title={name}>
              {name}
            </small>
          </div>
        </div>
        <div className="nav-label">工作空间</div>
        <nav className="nav" aria-label="主导航">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              title={link.label}
              aria-label={link.label}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="flow-note">
            <strong>让消息，各归其处。</strong>微信与 Webhook 上报
            <br />
            按你的规则，送往每个目的地。
          </div>
          <nav className="nav">
            <button
              onClick={() => ui.openGuide()}
              title="接入指南"
              aria-label="接入指南"
            >
              <Icon name="book" />
              <span>接入指南</span>
            </button>
          </nav>
          <div className="profile">
            <span className="avatar">{initial}</span>
            <div className="grow">
              <strong title={name}>{name}</strong>
              <small className="muted">个人账号</small>
            </div>
            <IconButton
              label="退出登录"
              title="退出登录"
              disabled={auth.$model.logout.loading}
              onClick={() => void auth.logout()}
            >
              <Icon name="logout" />
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header className="topbar">
          <div className="breadcrumb">
            工作空间 <Icon name="chevron" />
            <b>
              {LINKS.find((link) => link.to === location.pathname)?.label ||
                "控制台"}
            </b>
          </div>
          <div className="row">
            <span className="preview-label">个人控制台</span>
            <span className="date">
              {new Date().toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <IconButton
              className="mobile-logout"
              label="退出登录"
              disabled={auth.$model.logout.loading}
              onClick={() => void auth.logout()}
            >
              <Icon name="logout" />
            </IconButton>
          </div>
        </header>
        {auth.actionError && (
          <div className="page-error">
            <ErrorNotice message={auth.actionError} />
          </div>
        )}
        <main className="content">
          <Outlet />
        </main>
      </div>
      <Guide />
      <Notifications />
    </>
  );
});
