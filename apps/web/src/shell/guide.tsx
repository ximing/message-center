import { observer, useService } from "@rabjs/react";
import { Button } from "@/components/button";
import { Dialog } from "@/components/dialog";
import { UiService } from "@/services/ui.service";

export const Guide = observer(function Guide() {
  const ui = useService(UiService);
  return (
    <Dialog
      open={ui.guideOpen}
      title="接入指南"
      onClose={() => ui.closeGuide()}
      footer={
        <Button variant="primary" onClick={() => ui.closeGuide()}>
          知道了
        </Button>
      }
    >
      <div className="stack guide-content">
        <section>
          <h3>1. 创建账号密钥</h3>
          <p>在接入密钥页面生成 mck_ 密钥。同一把密钥可用于微信与 Webhook。</p>
        </section>
        <section>
          <h3>2. 配置消息上报</h3>
          <p>微信模块的打包配置：</p>
          <pre className="body-preview mono">{`MESSAGE_CENTER_URL=https://你的消息中心域名\nMESSAGE_CENTER_APP_KEY=mck_...`}</pre>
          <p>Webhook 请求示例：</p>
          <pre className="body-preview mono">{`POST /api/v1/ingest/webhook\nAuthorization: Bearer mck_...\nContent-Type: application/json\n\n{\n  "eventId": "unique-event-001",\n  "kind": "text",\n  "sender": "browser-clipper",\n  "text": "一条值得保存的消息"\n}`}</pre>
          <p>eventId 在当前账号下必须唯一，重复上报不会新增投递。</p>
        </section>
        <section>
          <h3>3. 添加目的地与规则</h3>
          <p>
            先验证目的地连接，再配置匹配条件。没有命中规则的消息会保留为「未匹配」，新规则仅作用于后续消息。
          </p>
        </section>
      </div>
    </Dialog>
  );
});
