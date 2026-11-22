import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Button,
  ChannelIcon,
  ConfirmDialog,
  EmptyState,
  ErrorNotice,
  FooterNote,
  Icon,
  IconButton,
  Input,
  Loading,
  Notice,
  PageHeader,
  Panel,
  Pill,
  Switch,
  Tabs,
} from "@/components";
import { ingressText, matchesAll } from "@/lib/text";
import { RuleEditor } from "./rule-editor";
import { RuleSimulator } from "./rule-simulator";
import { RulesPageService } from "./rules.service";

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
        <Button
          disabled={!s.loaded || s.loading}
          onClick={() => void s.openSimulator()}
        >
          <Icon name="route" />
          模拟匹配
        </Button>
        <Button
          variant="primary"
          disabled={!s.loaded || s.toggling}
          onClick={() => s.edit()}
        >
          <Icon name="plus" />
          新建规则
        </Button>
      </PageHeader>
      <Notice>
        所有匹配的规则都会转发。命中<strong>独占规则</strong>
        时，只执行命中的独占规则；同一目的地只投递一次。
      </Notice>
      <ErrorNotice message={s.error} retry={() => void s.load()} />
      <Panel>
        <div className="list-head">
          <div className="between">
            <h2>
              我的规则 <span className="count-label">{s.rules.length} 条</span>
            </h2>
            <span className="muted">
              {s.rules.filter((r) => r.enabled !== false).length} 条已启用
            </span>
          </div>
          <Tabs
            label="规则分类"
            value={s.filter}
            onChange={(value) => s.setFilter(value)}
            options={[
              { value: "all", label: "全部规则" },
              { value: "exclusive", label: "独占规则" },
              { value: "disabled", label: "已停用" },
            ]}
          />
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
              <Button variant="primary" onClick={() => s.edit()}>
                新建第一条规则
              </Button>
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
                        <IconButton
                          disabled={s.toggling}
                          label={`编辑${rule.name}`}
                          onClick={() => s.edit(rule)}
                        >
                          <Icon name="edit" />
                        </IconButton>
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
      </Panel>
      <FooterNote>规则属于当前账号；多个上报密钥共用这套规则。</FooterNote>
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
