import { observer, useService } from "@rabjs/react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  ErrorNotice,
  Field,
  Icon,
  Input,
  Loading,
  Notice,
  Textarea,
} from "@/components";
import { KeysPageService } from "./keys.service";

export const KeyDialogs = observer(function KeyDialogs() {
  const service = useService(KeysPageService);
  return (
    <>
      <Dialog
        open={service.editorOpen}
        title={service.editingId ? "编辑接入密钥" : "创建接入密钥"}
        onClose={() => service.closeEditor()}
        busy={service.saving}
        footer={
          <>
            <Button
              disabled={service.saving}
              onClick={() => service.closeEditor()}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="key-form"
              disabled={service.saving}
            >
              {service.saving
                ? "正在保存…"
                : service.editingId
                  ? "保存修改"
                  : "创建密钥"}
            </Button>
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
            <Field label="密钥名称">
              <Input
                autoFocus
                required
                maxLength={64}
                placeholder="例如：主力手机"
                value={service.form.name}
                onChange={(e) => service.changeForm({ name: e.target.value })}
              />
            </Field>
            <Field label="备注" optional>
              <Textarea
                maxLength={500}
                placeholder="这把密钥用在哪里？"
                value={service.form.note}
                onChange={(e) => service.changeForm({ note: e.target.value })}
              />
            </Field>
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
          <Button variant="primary" onClick={() => service.closeToken()}>
            完成并隐藏
          </Button>
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
            <Button onClick={() => void service.copyToken()}>
              <Icon name="copy" />
              {service.copied ? "已复制" : "复制密钥"}
            </Button>
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
