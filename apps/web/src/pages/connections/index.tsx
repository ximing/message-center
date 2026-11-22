import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Button,
  ErrorNotice,
  HelpBox,
  Icon,
  Loading,
  Notice,
  PageHeader,
} from "@/components";
import { ConnectionEditor } from "./connection-editor";
import { ConnectionList } from "./connection-list";
import { ConnectionsPageService } from "./connections.service";

const ConnectionsContent = observer(function ConnectionsContent() {
  const service = useService(ConnectionsPageService);
  const [params] = useSearchParams();
  const editId = params.get("edit");
  useEffect(() => {
    document.title = "目的地连接 · 消息中心";
    void service.load(editId);
  }, [service, editId]);
  return (
    <>
      <PageHeader
        title="目的地连接"
        description="连接你的收集箱、知识库与笔记，让消息抵达正确的地方。"
      >
        <Button variant="primary" onClick={() => service.edit()}>
          <Icon name="plus" />
          添加连接
        </Button>
      </PageHeader>
      <ErrorNotice message={service.error} retry={() => void service.load()} />
      {service.unavailable.length > 0 && (
        <Notice tone="amber">
          <strong>{service.unavailable.length} 个连接需要更新令牌</strong>
          <p>
            {service.unavailable.map((item) => item.label).join("、")}
            已停止投递，其他连接不受影响。更新令牌后，新消息将恢复投递。
          </p>
        </Notice>
      )}
      {!service.loaded ? <Loading /> : <ConnectionList />}
      <HelpBox icon="info" title="关于图片和语音">
        开关默认关闭，关闭时投递记为「已跳过」。开启后记为「等待转存」，本期不会上传文件。
      </HelpBox>
      <ConnectionEditor />
    </>
  );
});

export default bindServices(ConnectionsContent, [ConnectionsPageService]);
