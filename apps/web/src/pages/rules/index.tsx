import { Input, Select, Checkbox } from "@/components/controls";
import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ingressText,
  providerText,
  kindText,
  formatTime,
  matchesAll,
} from "@/lib/text";
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
  Pill,
  Switch,
} from "@/components/ui";
import { RulesPageService } from "./rules.service";

const RuleEditor = observer(function RuleEditor() {
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
            <button
              className="text-link danger delete-action"
              disabled={s.saving}
              onClick={() =>
                s.confirmRemove(
                  s.rules.find((r) => r.id === s.editingId) ?? null,
                )
              }
            >
              删除规则
            </button>
          )}
          <button
            className="btn"
            disabled={s.saving}
            onClick={() => s.closeEditor()}
          >
            取消
          </button>
          <button
            className="btn primary"
            form="rule-form"
            type="submit"
            disabled={s.saving || !s.connections.length}
          >
            {s.saving ? "正在保存…" : "保存规则"}
          </button>
        </>
      }
    >
      {!s.connections.length && (
        <Notice tone="amber">
          先添加目的地连接，再创建转发规则。
          <br />
          <Link className="text-link" to="/connections">
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
          <label className="field">
            <span>规则名称</span>
            <Input
              autoFocus
              required
              maxLength={64}
              placeholder="例如：个人消息收集"
              value={s.form.name}
              onChange={(e) => s.changeForm({ name: e.target.value })}
            />
          </label>
          <div className="field-group">
            <h3>当消息同时满足以下条件</h3>
            <label className="field">
              <span>上报渠道</span>
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
            </label>
            <label className="field">
              <span>
                房间 <span className="optional">可选</span>
              </span>
              <Input
                maxLength={256}
                placeholder="输入完整房间 ID"
                value={s.form.matchRoom || ""}
                onChange={(e) => s.changeForm({ matchRoom: e.target.value })}
              />
            </label>
            <label className="field">
              <span>
                发送者 <span className="optional">可选</span>
              </span>
              <Input
                maxLength={256}
                placeholder="输入完整发送者 ID"
                value={s.form.matchSender || ""}
                onChange={(e) => s.changeForm({ matchSender: e.target.value })}
              />
            </label>
            <small>留空表示不限；房间和发送者都填写时，必须同时匹配。</small>
          </div>
          <label className="field">
            <span>转发到</span>
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
          </label>
          {s.connections.find((c) => c.id === s.form.connectionId)?.status ===
            "unauthorized" && (
            <Notice tone="amber">
              该连接令牌已失效，请更新令牌后再接收消息。
            </Notice>
          )}
          <div className="check-setting">
            <div>
              <h3>独占规则</h3>
              <p>命中后仅执行独占规则，忽略普通规则。</p>
            </div>
            <Checkbox
              label="独占规则"
              checked={s.form.exclusive}
              onChange={(v) => s.changeForm({ exclusive: v })}
            />
          </div>
          <div className="check-setting">
            <div>
              <h3>启用规则</h3>
              <p>保存后对新上报的消息生效。</p>
            </div>
            <Switch
              label="启用规则"
              checked={s.form.enabled}
              onChange={(v) => s.changeForm({ enabled: v })}
            />
          </div>
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

const RuleSimulator = observer(function RuleSimulator() {
  const s = useService(RulesPageService);
  const preview = s.preview;
  return (
    <Dialog
      open={s.simulatorOpen}
      title="模拟规则匹配"
      onClose={() => s.closeSimulator()}
      footer={
        <button className="btn primary" onClick={() => s.closeSimulator()}>
          完成
        </button>
      }
    >
      <p className="muted form-intro">
        选择最近消息或填写匹配条件，检查当前规则的转发结果。模拟不会发送消息。
      </p>
      <ErrorNotice message={s.samplesError} />
      <label className="field">
        <span>最近消息</span>
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
      </label>
      <div className="field-group">
        <label className="field">
          <span>来源</span>
          <Select
            aria-label="来源"
            value={s.match.ingress}
            onValueChange={(value) => s.changeMatch({ ingress: value })}
            options={[
              { value: "wechat", label: "微信" },
              { value: "webhook", label: "Webhook" },
            ]}
          />
        </label>
        <label className="field">
          <span>房间</span>
          <Input
            maxLength={256}
            value={s.match.room}
            onChange={(e) => s.changeMatch({ room: e.target.value })}
            placeholder="无房间可留空"
          />
        </label>
        <label className="field">
          <span>发送者</span>
          <Input
            maxLength={256}
            value={s.match.sender}
            onChange={(e) => s.changeMatch({ sender: e.target.value })}
          />
        </label>
        <label className="field">
          <span>消息类型</span>
          <Select
            aria-label="消息类型"
            value={s.match.kind}
            onValueChange={(value) => s.changeMatch({ kind: value })}
            options={["text", "link", "image", "voice"].map((k) => ({
              value: k,
              label: kindText(k),
            }))}
          />
        </label>
      </div>
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

const RulesContent = observer(function RulesContent() {
  const s = useService(RulesPageService);
  const [params] = useSearchParams();
  const messageId = params.get("message");
  useEffect(() => {
    document.title = "转发规则 · 消息中心";
    void s.load(messageId);
  }, [s, messageId]);
  return (
    <>
      <PageHeader
        title="转发规则"
        description="用来源、房间和发送者，决定消息的去向。"
      >
        <button
          className="btn"
          disabled={!s.loaded || s.loading}
          onClick={() => void s.openSimulator()}
        >
          <Icon name="route" />
          模拟匹配
        </button>
        <button
          className="btn primary"
          disabled={!s.loaded || s.toggling}
          onClick={() => s.edit()}
        >
          <Icon name="plus" />
          新建规则
        </button>
      </PageHeader>
      <Notice>
        所有匹配的规则都会转发。命中<strong>独占规则</strong>
        时，只执行命中的独占规则；同一目的地只投递一次。
      </Notice>
      <ErrorNotice message={s.error} retry={() => void s.load()} />
      <section className="panel">
        <div className="list-head">
          <div className="between">
            <h2>
              我的规则 <span className="count-label">{s.rules.length} 条</span>
            </h2>
            <span className="muted">
              {s.rules.filter((r) => r.enabled !== false).length} 条已启用
            </span>
          </div>
          <div className="tabs" aria-label="规则分类">
            {(
              [
                ["all", "全部规则"],
                ["exclusive", "独占规则"],
                ["disabled", "已停用"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`tab ${s.filter === key ? "active" : ""}`}
                aria-pressed={s.filter === key}
                onClick={() => s.setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="filterbar">
          <label className="search rule-search">
            <Input
              leadingIcon="search"
              aria-label="搜索规则"
              placeholder="搜索规则名称、发送者或房间…"
              value={s.search}
              onChange={(e) => s.setSearch(e.target.value)}
            />
          </label>
        </div>
        {!s.loaded ? (
          <Loading />
        ) : !s.visibleRules.length ? (
          <EmptyState
            icon="route"
            title={s.rules.length ? "没有符合条件的规则" : "还没有转发规则"}
            description={
              s.rules.length
                ? "试试其他关键词或规则分类。"
                : "为消息指定目的地，所有命中的规则都会执行。"
            }
          >
            {!s.rules.length && (
              <button className="btn primary" onClick={() => s.edit()}>
                新建第一条规则
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="rule-table">
              <thead>
                <tr>
                  <th>规则名称</th>
                  <th>匹配条件 · 同时满足</th>
                  <th>转发至</th>
                  <th>启用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {s.visibleRules.map((rule) => {
                  const c = s.connections.find(
                    (c) => c.id === rule.connectionId,
                  );
                  return (
                    <tr
                      className={rule.enabled === false ? "disabled" : ""}
                      key={rule.id}
                    >
                      <td>
                        <div className="rule-name">{rule.name}</div>
                        <div className="rule-info">
                          {rule.exclusive ? (
                            <Pill tone="blue" dot={false}>
                              独占
                            </Pill>
                          ) : (
                            "普通转发"
                          )}
                          {c?.status === "unauthorized" && (
                            <Pill tone="red">连接失效</Pill>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="route">
                          <span className="condition">
                            {ingressText(rule.matchIngress, "所有来源")}
                          </span>
                          {!matchesAll(rule.matchRoom, rule.matchSender) && (
                            <span className="muted">且</span>
                          )}
                        </div>
                        {rule.matchRoom && (
                          <div className="subline">
                            房间 <span className="mono">{rule.matchRoom}</span>
                          </div>
                        )}
                        {rule.matchSender && (
                          <div className="subline">
                            发送者{" "}
                            <span className="mono">{rule.matchSender}</span>
                          </div>
                        )}
                        {matchesAll(rule.matchRoom, rule.matchSender) && (
                          <div className="subline scope-warning">
                            该来源的全部上报
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="row">
                          <ChannelIcon small provider={c?.provider || ""} />
                          {c?.label || "连接不可用"}
                        </div>
                      </td>
                      <td>
                        <Switch
                          checked={rule.enabled !== false}
                          label={`启用${rule.name}`}
                          disabled={s.toggling}
                          onChange={(v) => void s.toggle(rule, v)}
                        />
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          disabled={s.toggling}
                          aria-label={`编辑${rule.name}`}
                          onClick={() => s.edit(rule)}
                        >
                          <Icon name="edit" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>共 {s.visibleRules.length} 条规则</span>
          <span>修改规则仅影响后续新消息</span>
        </div>
      </section>
      <div className="footer-note">
        <Icon name="shield" />
        规则属于当前账号；多个上报密钥共用这套规则。
      </div>
      <RuleEditor />
      <RuleSimulator />
      <ConfirmDialog
        open={!!s.removeTarget}
        title="删除这条规则？"
        busy={s.saving}
        error={s.confirmError}
        onClose={() => s.confirmRemove(null)}
        onConfirm={() => void s.remove()}
      >
        删除「{s.removeTarget?.name}
        」后，新消息将不再通过这条规则转发。已有历史投递的规则需要停用，不能删除。
      </ConfirmDialog>
    </>
  );
});
export default bindServices(RulesContent, [RulesPageService]);
