import { observer, useService } from "@rabjs/react";
import { useSearchParams } from "react-router";
import { PROVIDERS } from "@/api/types";
import {
  Button,
  CheckSetting,
  ConfirmDialog,
  Dialog,
  ErrorNotice,
  Field,
  FieldGroup,
  Input,
  Select,
  Switch,
  TextLink,
} from "@/components";
import { providerText } from "@/lib/text";
import { ConnectionsPageService } from "./connections.service";

export const ConnectionEditor = observer(function ConnectionEditor() {
  const service = useService(ConnectionsPageService);
  const [params, setParams] = useSearchParams();
  const editId = params.get("edit");
  const close = () => {
    service.closeEditor();
    if (editId) setParams({}, { replace: true });
  };
  return (
    <>
      <Dialog
        open={service.editorOpen}
        title={service.editingId ? "管理目的地连接" : "添加目的地连接"}
        onClose={close}
        busy={service.saving}
        footer={
          <>
            {service.editingId && (
              <TextLink
                className="danger delete-action"
                disabled={service.saving}
                onClick={() =>
                  service.confirmRemove(
                    service.items.find((c) => c.id === service.editingId) ??
                      null,
                  )
                }
              >
                删除连接
              </TextLink>
            )}
            <Button disabled={service.saving} onClick={close}>
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="connection-form"
              disabled={service.saving}
            >
              {service.saving
                ? "正在保存并校验…"
                : service.editingId
                  ? "保存连接"
                  : "验证并保存"}
            </Button>
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
            <Field label="目的地渠道">
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
            </Field>
            <Field label="显示名称">
              <Input
                autoFocus
                required
                maxLength={64}
                placeholder="例如：我的知识库"
                value={service.form.label}
                onChange={(e) => service.changeForm({ label: e.target.value })}
              />
            </Field>
            <Field label="服务地址">
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
            </Field>
            <Field label={service.editingId ? "更新访问令牌" : "访问令牌"}>
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
            </Field>
            <FieldGroup title="媒体接收设置">
              <CheckSetting label={<span>接收图片</span>}>
                <Switch
                  label="接收图片"
                  checked={service.form.allowImage}
                  onChange={(v) => service.changeForm({ allowImage: v })}
                />
              </CheckSetting>
              <CheckSetting label={<span>接收语音</span>}>
                <Switch
                  label="接收语音"
                  checked={service.form.allowVoice}
                  onChange={(v) => service.changeForm({ allowVoice: v })}
                />
              </CheckSetting>
              <p className="muted form-intro">
                开启后仅记录为「等待转存」，本期不上传文件。
              </p>
            </FieldGroup>
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
