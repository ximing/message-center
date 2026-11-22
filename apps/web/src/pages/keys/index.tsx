import { Input, Textarea } from "@/components/controls";
import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import {
  ChannelIcon,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  Notice,
  PageHeader,
} from "@/components/ui";
import { formatTime } from "@/lib/text";
import { KeysPageService } from "./keys.service";

const KeysContent = observer(function KeysContent() {
  const service = useService(KeysPageService);
  useEffect(() => {
    document.title = "接入密钥 · 消息中心";
    void service.load();
  }, [service]);
  return (
    <>
      <PageHeader
        title="接入密钥"
        description="为微信模块和 Webhook 创建凭证，统一接收你的消息。"
      >
        <button
          className="btn primary"
          onClick={() => service.edit()}
          disabled={!service.loaded || service.items.length >= 20}
        >
          <Icon name="plus" />
          创建密钥
        </button>
      </PageHeader>
      <div className="intro-grid">
        {(["wechat", "webhook"] as const).map((p) => (
          <div className="panel ingress-card" key={p}>
            <ChannelIcon provider={p} />
            <div className="grow">
              <h3>{p === "wechat" ? "微信模块" : "Webhook"}</h3>
              <p>
                {p === "wechat"
                  ? "配置消息中心地址和密钥，上报收到的消息。"
                  : "用同一套账号密钥，接入外部服务与自动化。"}
              </p>
              <div className="endpoint">
                <b>POST</b>
                <span className="mono">/api/v1/ingest/{p}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ErrorNotice message={service.error} retry={() => void service.load()} />
      <section className="panel">
        <div className="section-title between">
          <h2>
            账号密钥{" "}
            <span className="count-label">
              {service.loaded
                ? `${service.items.length} / 20 把有效`
                : "加载中"}
            </span>
          </h2>
          <button className="text-link" onClick={() => service.ui.openGuide()}>
            接入指南 <Icon name="arrow-up" />
          </button>
        </div>
        {!service.loaded ? (
          <Loading />
        ) : service.items.length === 0 ? (
          <EmptyState
            icon="key"
            title="还没有接入密钥"
            description="创建一把密钥，开始接收微信或 Webhook 消息。"
          >
            <button className="btn primary" onClick={() => service.edit()}>
              创建第一把密钥
            </button>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="key-table">
              <thead>
                <tr>
                  <th>密钥名称 / 备注</th>
                  <th>密钥预览</th>
                  <th>最近使用</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {service.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="key-title">{item.name}</strong>
                      <div className="subline">{item.note || "无备注"}</div>
                    </td>
                    <td className="mono">{item.preview}</td>
                    <td className="time">
                      {item.lastUsedAt
                        ? formatTime(item.lastUsedAt)
                        : "尚未使用"}
                    </td>
                    <td className="time">{formatTime(item.createdAt)}</td>
                    <td className="actions">
                      <button
                        className="text-link"
                        onClick={() => void service.reveal(item)}
                      >
                        显示
                      </button>
                      <button
                        className="text-link"
                        onClick={() => service.edit(item)}
                      >
                        编辑
                      </button>
                      <button
                        className="text-link danger"
                        onClick={() => service.confirmRevoke(item)}
                      >
                        吊销
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="help-box">
        <Icon name="shield" />
        <div>
          <strong>一套密钥，两个上报渠道</strong>
          <p>
            每把 mck_ 密钥都可以用于微信和
            Webhook，也可以分别创建以便管理。密钥只能上报消息，不能读取消息或修改规则。
          </p>
        </div>
      </div>
      <Dialog
        open={service.editorOpen}
        title={service.editingId ? "编辑接入密钥" : "创建接入密钥"}
        onClose={() => service.closeEditor()}
        busy={service.saving}
        footer={
          <>
            <button
              className="btn"
              disabled={service.saving}
              onClick={() => service.closeEditor()}
            >
              取消
            </button>
            <button
              className="btn primary"
              type="submit"
              form="key-form"
              disabled={service.saving}
            >
              {service.saving
                ? "正在保存…"
                : service.editingId
                  ? "保存修改"
                  : "创建密钥"}
            </button>
          </>
        }
      >
        <p className="muted form-intro">
          用名称和备注区分设备或调用方。每把密钥均可用于微信与 Webhook。
        </p>
        <form
          id="key-form"
          onSubmit={(e) => {
            e.preventDefault();
            void service.save();
          }}
        >
          <fieldset disabled={service.saving}>
            <label className="field">
              <span>密钥名称</span>
              <Input
                autoFocus
                required
                maxLength={64}
                placeholder="例如：主力手机"
                value={service.form.name}
                onChange={(e) => service.changeForm({ name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>
                备注 <span className="optional">可选</span>
              </span>
              <Textarea
                maxLength={500}
                placeholder="这把密钥用在哪里？"
                value={service.form.note}
                onChange={(e) => service.changeForm({ note: e.target.value })}
              />
            </label>
          </fieldset>
          <ErrorNotice message={service.formError} />
        </form>
        <Notice>
          密钥仅有上报权限。登录后可以再次显示或吊销，不绑定具体微信身份和渠道。
        </Notice>
      </Dialog>
      <Dialog
        open={service.tokenOpen}
        title="完整接入密钥"
        onClose={() => service.closeToken()}
        footer={
          <button className="btn primary" onClick={() => service.closeToken()}>
            完成并隐藏
          </button>
        }
      >
        <h3>{service.tokenName}</h3>
        <p className="muted form-intro">
          复制后填入微信模块或 Webhook 调用方，关闭此窗口会隐藏完整密钥。
        </p>
        {service.revealing && <Loading text="正在读取密钥…" />}
        <ErrorNotice message={service.tokenError} />
        {service.token && (
          <>
            <pre className="token-display mono" tabIndex={0}>
              {service.token}
            </pre>
            <button className="btn" onClick={() => void service.copyToken()}>
              <Icon name="copy" />
              {service.copied ? "已复制" : "复制密钥"}
            </button>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!service.revokeTarget}
        title="吊销这把密钥？"
        onClose={() => service.confirmRevoke(null)}
        onConfirm={() => void service.revoke()}
        busy={service.saving}
        error={service.confirmError}
        action="确认吊销"
      >
        使用「{service.revokeTarget?.name}」的微信模块和 Webhook
        将立即无法上报，其他密钥不受影响。此操作无法撤销；微信模块需更换密钥并重新打包。
      </ConfirmDialog>
    </>
  );
});
export default bindServices(KeysContent, [KeysPageService]);
