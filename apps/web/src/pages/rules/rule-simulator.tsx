import { observer, useService } from "@rabjs/react";
import {
  Button,
  ChannelIcon,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  FieldGroup,
  Input,
  Pill,
  Select,
} from "@/components";
import { formatTime, kindText } from "@/lib/text";
import { RulesPageService } from "./rules.service";

export const RuleSimulator = observer(function RuleSimulator() {
  const s = useService(RulesPageService);
  const preview = s.preview;
  return (
    <Dialog
      open={s.simulatorOpen}
      title="模拟规则匹配"
      onClose={() => s.closeSimulator()}
      footer={
        <Button variant="primary" onClick={() => s.closeSimulator()}>
          完成
        </Button>
      }
    >
      <p className="muted form-intro">
        选择最近消息或填写匹配条件，检查当前规则的转发结果。模拟不会发送消息。
      </p>
      <ErrorNotice message={s.samplesError} />
      <Field label="最近消息">
        <Select
          aria-label="最近消息"
          value={s.sampleId}
          onValueChange={(value) => s.chooseSample(value)}
          disabled={s.samplesLoading}
          options={[
            {
              value: "",
              label: s.samplesLoading ? "正在读取…" : "手动填写条件",
            },
            ...s.samples.map((m) => ({
              value: m.id,
              label: `${formatTime(m.createdAt)} · ${m.sender || "未提供发送者"} · ${kindText(m.kind)}`,
            })),
          ]}
        />
      </Field>
      <FieldGroup>
        <Field label="来源">
          <Select
            aria-label="来源"
            value={s.match.ingress}
            onValueChange={(value) => s.changeMatch({ ingress: value })}
            options={[
              { value: "wechat", label: "微信" },
              { value: "webhook", label: "Webhook" },
            ]}
          />
        </Field>
        <Field label="房间">
          <Input
            maxLength={256}
            value={s.match.room}
            onChange={(e) => s.changeMatch({ room: e.target.value })}
            placeholder="无房间可留空"
          />
        </Field>
        <Field label="发送者">
          <Input
            maxLength={256}
            value={s.match.sender}
            onChange={(e) => s.changeMatch({ sender: e.target.value })}
          />
        </Field>
        <Field label="消息类型">
          <Select
            aria-label="消息类型"
            value={s.match.kind}
            onValueChange={(value) => s.changeMatch({ kind: value })}
            options={["text", "link", "image", "voice"].map((k) => ({
              value: k,
              label: kindText(k),
            }))}
          />
        </Field>
      </FieldGroup>
      <div className="scope-preview" role="status">
        匹配 {preview.hits.length} 条规则，产生 {preview.connectionIds.length}{" "}
        个目的地的投递。{preview.exclusive && "已命中独占规则，忽略普通规则。"}
      </div>
      <div className="stack simulation-result">
        {preview.hits.map((rule) => {
          const c = s.connections.find((c) => c.id === rule.connectionId);
          const excluded = preview.exclusive && !rule.exclusive;
          const media = s.match.kind === "image" || s.match.kind === "voice";
          const allowed =
            s.match.kind === "image" ? c?.allowImage : c?.allowVoice;
          return (
            <div
              className={`simulation-card ${excluded ? "excluded" : ""}`}
              key={rule.id}
            >
              <div className="between">
                <h3>{rule.name}</h3>
                <Pill tone={excluded ? "" : "blue"}>
                  {excluded
                    ? "被独占规则排除"
                    : rule.exclusive
                      ? "独占命中"
                      : "已命中"}
                </Pill>
              </div>
              <div className="row form-intro">
                <ChannelIcon provider={c?.provider || ""} small />
                {c?.label || "连接不可用"}
              </div>
              {!excluded && (
                <p>
                  {media
                    ? allowed
                      ? "等待转存：本期不上传文件。"
                      : "已跳过：连接未开启该媒体类型。"
                    : c?.status === "unauthorized"
                      ? "连接令牌已失效，无法完成投递。"
                      : "进入转发队列。"}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {preview.hits.length === 0 && (
        <EmptyState
          title="没有匹配规则"
          description="消息将保留为未匹配。"
          icon="route"
        />
      )}
      <p className="muted form-intro">
        多条规则命中同一连接时，只生成一条投递。
      </p>
    </Dialog>
  );
});
