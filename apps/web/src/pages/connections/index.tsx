import { Input, Select } from "@/components/controls";
import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { PROVIDERS } from "@/api/types";
import { providerText } from "@/lib/text";
import {
  ChannelIcon,
  ConfirmDialog,
  Dialog,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Notice,
  Pill,
  Switch,
} from "@/components/ui";
import { ConnectionsPageService } from "./connections.service";

const ConnectionsContent = observer(function ConnectionsContent() {
  const service = useService(ConnectionsPageService);
  const [params, setParams] = useSearchParams();
  const editId = params.get("edit");
  useEffect(() => {
    document.title = "目的地连接 · 消息中心";
    void service.load(editId);
  }, [service, editId]);
  const close = () => {
    service.closeEditor();
    if (editId) setParams({}, { replace: true });
  };
  return (
    <>
      <PageHeader
        title="目的地连接"
        description="连接你的收集箱、知识库与笔记，让消息抵达正确的地方。"
      >
        <button className="btn primary" onClick={() => service.edit()}>
          <Icon name="plus" />
          添加连接
        </button>
      </PageHeader>
      <ErrorNotice message={service.error} retry={() => void service.load()} />
      {service.unavailable.length > 0 && (
        <Notice tone="amber">
          <strong>{service.unavailable.length} 个连接需要更新令牌</strong>
          <p>
            {service.unavailable.map((item) => item.label).join("、")}
            已停止投递，其他连接不受影响。更新令牌后，新消息将恢复投递。
          </p>
        </Notice>
      )}
      {!service.loaded ? (
        <Loading />
      ) : (
        <div className="cards">
          {service.items.map((item) => (
            <article
              className={`panel connection ${item.status === "unauthorized" ? "invalid" : ""}`}
              key={item.id}
            >
              <div className="connection-head">
                <ChannelIcon provider={item.provider} />
                <div className="grow">
                  <h3>{item.label}</h3>
                  <p>
                    {providerText(item.provider)}{" "}
                    {item.provider === "inwit"
                      ? "文档"
                      : item.provider === "aimo"
                        ? "笔记"
                        : "收集箱"}
                  </p>
                </div>
                <button
                  className="icon-btn"
                  aria-label={`编辑${item.label}`}
                  disabled={service.flagsBusy}
                  onClick={() => service.edit(item)}
                >
                  <Icon name="edit" />
                </button>
              </div>
              <Pill
                tone={
                  item.status === "unauthorized"
                    ? "red"
                    : item.status === "active"
                      ? "green"
                      : ""
                }
              >
                {item.status === "unauthorized"
                  ? "令牌失效"
                  : item.status === "active"
                    ? "连接正常"
                    : "状态未知"}
              </Pill>
              <dl className="connection-meta">
                <dt>对方账号</dt>
                <dd>{item.remoteDisplayName || item.remoteUserId || "—"}</dd>
                <dt>服务地址</dt>
                <dd>{item.apiBase?.replace(/^https:\/\//, "") || "—"}</dd>
                <dt>令牌预览</dt>
                <dd className="mono">
                  {item.tokenPreview || item.preview || "—"}
                </dd>
              </dl>
              <div className="connection-options">
                <label>
                  <Switch
                    checked={!!item.allowImage}
                    label={`${item.label}接收图片`}
                    disabled={service.flagsBusy}
                    onChange={(v) =>
                      void service.updateMedia(item.id, "allowImage", v)
                    }
                  />
                  接收图片
                </label>
                <label>
                  <Switch
                    checked={!!item.allowVoice}
                    label={`${item.label}接收语音`}
                    disabled={service.flagsBusy}
                    onChange={(v) =>
                      void service.updateMedia(item.id, "allowVoice", v)
                    }
                  />
                  接收语音
                </label>
              </div>
              <div className="card-bottom">
                <span className="muted">
                  {
                    service.rules.filter((r) => r.connectionId === item.id)
                      .length
                  }{" "}
                  条关联规则
                </span>
                <button
                  className={`text-link ${item.status === "unauthorized" ? "danger" : ""}`}
                  disabled={service.flagsBusy}
                  onClick={() => service.edit(item)}
                >
                  {item.status === "unauthorized" ? "更新令牌" : "管理连接"}{" "}
                  <Icon name="chevron" />
                </button>
              </div>
            </article>
          ))}
          <button className="add-card" onClick={() => service.edit()}>
            <span>
              <Icon name="plus" />
            </span>
            <strong>
              {service.items.length ? "添加目的地连接" : "添加第一个目的地"}
            </strong>
            <small>支持 inwit、Vital 和 aimo</small>
          </button>
        </div>
      )}
      <div className="help-box">
        <Icon name="info" />
        <div>
          <strong>关于图片和语音</strong>
          <p>
            开关默认关闭，关闭时投递记为「已跳过」。开启后记为「等待转存」，本期不会上传文件。
          </p>
        </div>
      </div>
      <Dialog
        open={service.editorOpen}
        title={service.editingId ? "管理目的地连接" : "添加目的地连接"}
        onClose={close}
        busy={service.saving}
        footer={
          <>
            {service.editingId && (
              <button
                className="text-link danger delete-action"
                disabled={service.saving}
                onClick={() =>
                  service.confirmRemove(
                    service.items.find((c) => c.id === service.editingId) ??
                      null,
                  )
                }
              >
                删除连接
              </button>
            )}
            <button className="btn" disabled={service.saving} onClick={close}>
              取消
            </button>
            <button
              className="btn primary"
              type="submit"
              form="connection-form"
              disabled={service.saving}
            >
              {service.saving
                ? "正在保存并校验…"
                : service.editingId
                  ? "保存连接"
                  : "验证并保存"}
            </button>
          </>
        }
      >
        <form
          id="connection-form"
          onSubmit={(e) => {
            e.preventDefault();
            void service.save();
          }}
        >
          <fieldset disabled={service.saving}>
            <label className="field">
              <span>目的地渠道</span>
              <Select
                aria-label="目的地渠道"
                value={service.form.provider}
                disabled={!!service.editingId}
                onValueChange={(value) => service.changeProvider(value)}
                options={PROVIDERS.map((p) => ({
                  value: p,
                  label: providerText(p),
                }))}
              />
            </label>
            <label className="field">
              <span>显示名称</span>
              <Input
                autoFocus
                required
                maxLength={64}
                placeholder="例如：我的知识库"
                value={service.form.label}
                onChange={(e) => service.changeForm({ label: e.target.value })}
              />
            </label>
            <label className="field">
              <span>服务地址</span>
              <Input
                required
                type="url"
                maxLength={512}
                disabled={!!service.editingId}
                value={service.form.apiBase}
                onChange={(e) =>
                  service.changeForm({ apiBase: e.target.value })
                }
              />
              {service.editingId && <small>更换服务地址请新建连接。</small>}
            </label>
            <label className="field">
              <span>{service.editingId ? "更新访问令牌" : "访问令牌"}</span>
              <Input
                required={!service.editingId}
                type="password"
                autoComplete="off"
                maxLength={4096}
                placeholder={
                  service.editingId
                    ? "不修改可留空"
                    : `粘贴 ${service.form.provider === "vital" ? "vt_" : service.form.provider === "inwit" ? "iwt_" : "aimo_tk_"} 令牌`
                }
                value={service.form.token}
                onChange={(e) => service.changeForm({ token: e.target.value })}
              />
              <small>新令牌将在保存前验证，完整令牌不会回显。</small>
            </label>
            <div className="field-group">
              <h3>媒体接收设置</h3>
              <div className="check-setting">
                <span>接收图片</span>
                <Switch
                  label="接收图片"
                  checked={service.form.allowImage}
                  onChange={(v) => service.changeForm({ allowImage: v })}
                />
              </div>
              <div className="check-setting">
                <span>接收语音</span>
                <Switch
                  label="接收语音"
                  checked={service.form.allowVoice}
                  onChange={(v) => service.changeForm({ allowVoice: v })}
                />
              </div>
              <p className="muted form-intro">
                开启后仅记录为「等待转存」，本期不上传文件。
              </p>
            </div>
          </fieldset>
          <ErrorNotice message={service.formError} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!service.removeTarget}
        title="删除这个连接？"
        busy={service.saving}
        error={service.confirmError}
        onClose={() => service.confirmRemove(null)}
        onConfirm={() => void service.remove()}
      >
        将删除「{service.removeTarget?.label}
        」。被规则或历史投递使用的连接无法删除；如需停止转发，请停用相关规则。
      </ConfirmDialog>
    </>
  );
});
export default bindServices(ConnectionsContent, [ConnectionsPageService]);
