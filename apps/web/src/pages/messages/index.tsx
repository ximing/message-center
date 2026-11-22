import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { Button, ErrorNotice, FooterNote, Icon, PageHeader } from "@/components";
import { MessageDetail } from "./message-detail";
import { MessageFlow } from "./message-flow";
import { MessageList } from "./message-list";
import { LiveService } from "@/services/live.service";
import { MessagesPageService } from "./messages.service";

const MessagesContent = observer(function MessagesContent() {
  const s = useService(MessagesPageService);
  const live = useService(LiveService);
  useEffect(() => {
    document.title = "消息记录 · 消息中心";
    void s.load();
  }, [s]);
  useEffect(() => {
    return live.subscribe(() => s.refreshQuiet());
  }, [live, s]);
  return (
    <>
      <PageHeader
        title="消息记录"
        description="查看每一次上报，追踪消息的每一个去向。"
      >
        <Button disabled={s.loading} onClick={() => void s.load()}>
          <Icon name="refresh" className={s.loading ? "loading-refresh" : ""} />
          {s.loading ? "正在刷新…" : "刷新记录"}
        </Button>
      </PageHeader>
      <ErrorNotice message={s.error} retry={() => void s.load()} />
      <ErrorNotice message={s.contextError} retry={() => void s.load()} />
      <MessageFlow />
      <div className="message-workbench">
        <MessageList />
        <MessageDetail />
      </div>
      <FooterNote>
        消息按账号隔离保存。投递结果按目的地独立记录，正文仅在打开详情时读取。
      </FooterNote>
    </>
  );
});

export default bindServices(MessagesContent, [MessagesPageService]);
