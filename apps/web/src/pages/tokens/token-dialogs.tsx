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
} from "@/components";
import { TokensPageService } from "./tokens.service";

export const TokenDialogs = observer(function TokenDialogs() {
  const service = useService(TokensPageService);
  return (
    <>
      <Dialog
        open={service.editorOpen}
        title={service.editingId ? "重命名接口令牌" : "创建接口令牌"}
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
              form="token-form"
              disabled={service.saving}
            >
              {service.saving
                ? "正在保存…"
                : service.editingId
                  ? "保存名称"
                  : "创建令牌"}
            </Button>
          </>
        }
      >
        <p className="muted form-intro">
          给脚本或 agent 起一个能认出来的名字。令牌可以管理钥匙、连接、规则和消息，不能上报。
        </p>
        <form
          id="token-form"
          onSubmit={(event) => {
            event.preventDefault();
            void service.save();
          }}
        >
          <fieldset disabled={service.saving}>
            <Field label="令牌名称">
              <Input
                autoFocus
                required
                maxLength={64}
                placeholder="例如：本机 agent"
                value={service.form.name}
                onChange={(event) =>
                  service.changeForm({ name: event.target.value })
                }
              />
            </Field>
          </fieldset>
          <ErrorNotice message={service.formError} />
        </form>
        <Notice>
          明文只在这里出现。把它放进环境变量 MC_TOKEN，不要写进仓库或对话。退出登录不会吊销它。
        </Notice>
      </Dialog>
      <Dialog
        open={service.tokenOpen}
        title="完整接口令牌"
        onClose={() => service.closeToken()}
        footer={
          <Button variant="primary" onClick={() => service.closeToken()}>
            完成并隐藏
          </Button>
        }
      >
        <h3>{service.tokenName}</h3>
        <p className="muted form-intro">
          复制后写入 MC_TOKEN。关闭此窗口会隐藏完整令牌，之后仍可再次显示。
        </p>
        {service.revealing && <Loading text="正在读取令牌…" />}
        <ErrorNotice message={service.tokenError} />
        {service.token && (
          <>
            <pre className="token-display mono" tabIndex={0}>
              {service.token}
            </pre>
            <Button onClick={() => void service.copyToken()}>
              <Icon name="copy" />
              {service.copied ? "已复制" : "复制令牌"}
            </Button>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!service.revokeTarget}
        title="吊销这个接口令牌？"
        onClose={() => service.confirmRevoke(null)}
        onConfirm={() => void service.revoke()}
        busy={service.saving}
        error={service.confirmError}
        action="确认吊销"
      >
        使用「{service.revokeTarget?.name}」的脚本会立即无法调用管理接口。其它令牌和网页登录不受影响。
      </ConfirmDialog>
    </>
  );
});
