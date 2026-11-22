import { observer, useService } from "@rabjs/react";
import { Link } from "react-router";
import {
  Button,
  Checkbox,
  CheckSetting,
  Dialog,
  ErrorNotice,
  Field,
  FieldGroup,
  Input,
  Notice,
  Select,
  Switch,
  TextLink,
  textLinkClass,
} from "@/components";
import { ingressText, providerText } from "@/lib/text";
import { RulesPageService } from "./rules.service";

export const RuleEditor = observer(function RuleEditor() {
  const s = useService(RulesPageService);
  return (
    <Dialog
      open={s.editorOpen}
      title={s.editingId ? "编辑转发规则" : "新建转发规则"}
      busy={s.saving}
      onClose={() => s.closeEditor()}
      footer={
        <>
          {s.editingId && (
            <TextLink
              className="danger delete-action"
              disabled={s.saving}
              onClick={() =>
                s.confirmRemove(
                  s.rules.find((r) => r.id === s.editingId) ?? null,
                )
              }
            >
              删除规则
            </TextLink>
          )}
          <Button disabled={s.saving} onClick={() => s.closeEditor()}>
            取消
          </Button>
          <Button
            variant="primary"
            form="rule-form"
            type="submit"
            disabled={s.saving || !s.connections.length}
          >
            {s.saving ? "正在保存…" : "保存规则"}
          </Button>
        </>
      }
    >
      {!s.connections.length && (
        <Notice tone="amber">
          先添加目的地连接，再创建转发规则。
          <br />
          <Link className={textLinkClass()} to="/connections">
            前往添加连接
          </Link>
        </Notice>
      )}
      <form
        id="rule-form"
        onSubmit={(e) => {
          e.preventDefault();
          void s.save();
        }}
      >
        <fieldset disabled={s.saving}>
          <Field label="规则名称">
            <Input
              autoFocus
              required
              maxLength={64}
              placeholder="例如：个人消息收集"
              value={s.form.name}
              onChange={(e) => s.changeForm({ name: e.target.value })}
            />
          </Field>
          <FieldGroup title="当消息同时满足以下条件">
            <Field label="上报渠道">
              <Select
                aria-label="上报渠道"
                value={s.form.matchIngress || ""}
                onValueChange={(value) =>
                  s.changeForm({
                    matchIngress:
                      value === "wechat" || value === "webhook" ? value : null,
                  })
                }
                options={[
                  { value: "", label: "不限渠道" },
                  { value: "wechat", label: "微信" },
                  { value: "webhook", label: "Webhook" },
                ]}
              />
            </Field>
            <Field label="房间" optional>
              <Input
                maxLength={256}
                placeholder="输入完整房间 ID"
                value={s.form.matchRoom || ""}
                onChange={(e) => s.changeForm({ matchRoom: e.target.value })}
              />
            </Field>
            <Field label="发送者" optional>
              <Input
                maxLength={256}
                placeholder="输入完整发送者 ID"
                value={s.form.matchSender || ""}
                onChange={(e) => s.changeForm({ matchSender: e.target.value })}
              />
            </Field>
            <small>留空表示不限；房间和发送者都填写时，必须同时匹配。</small>
          </FieldGroup>
          <Field label="转发到">
            <Select
              aria-label="转发到"
              required
              value={s.form.connectionId}
              onValueChange={(value) => s.changeForm({ connectionId: value })}
              options={[
                { value: "", label: "请选择连接", disabled: true },
                ...s.connections.map((c) => ({
                  value: c.id,
                  label: `${c.label} / ${providerText(c.provider)}${c.status === "unauthorized" ? "（令牌失效）" : ""}`,
                })),
              ]}
            />
          </Field>
          {s.connections.find((c) => c.id === s.form.connectionId)?.status ===
            "unauthorized" && (
            <Notice tone="amber">
              该连接令牌已失效，请更新令牌后再接收消息。
            </Notice>
          )}
          <CheckSetting
            label={
              <div>
                <h3>独占规则</h3>
                <p>命中后仅执行独占规则，忽略普通规则。</p>
              </div>
            }
          >
            <Checkbox
              label="独占规则"
              checked={s.form.exclusive}
              onChange={(v) => s.changeForm({ exclusive: v })}
            />
          </CheckSetting>
          <CheckSetting
            label={
              <div>
                <h3>启用规则</h3>
                <p>保存后对新上报的消息生效。</p>
              </div>
            }
          >
            <Switch
              label="启用规则"
              checked={s.form.enabled}
              onChange={(v) => s.changeForm({ enabled: v })}
            />
          </CheckSetting>
          <div
            className={`scope-preview ${s.broadScope ? "warn" : ""}`}
            role="status"
          >
            {s.broadScope
              ? `匹配范围较广：将匹配${ingressText(s.form.matchIngress, "微信和 Webhook")}的全部上报。`
              : "仅转发同时满足上述条件的新消息。"}
            {s.form.exclusive && " 命中后，普通规则不再执行。"}
          </div>
        </fieldset>
        <ErrorNotice message={s.formError} />
      </form>
    </Dialog>
  );
});
