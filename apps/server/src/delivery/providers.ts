import type { EgressProvider, IngressChannel } from '@mc/dto';
import type { FetchLike } from '../http/outbound.js';
import { jsonHeaders, requestJson, upstreamErrorCode } from '../http/outbound.js';
import { bylineFor, clipUnits, isLegalHttpUrl, linkParts, siteNameFor, sourceFor, titleFromBody } from './text.js';

const JSON_TIMEOUT_MS = 15_000;
const EXTRACT_TIMEOUT_MS = 20_000;
const CATEGORY_NAME = '微信收集';

export interface ProviderJob {
  provider: EgressProvider;
  apiBase: string;
  token: string;
  ingress: IngressChannel;
  kind: 'text' | 'link';
  sender: string;
  room: string | null;
  body: string;
  dedupKey: string;
}

export interface ProviderResult {
  ok: boolean;
  remoteId: string | null;
  httpStatus: number | null;
  ioError: boolean;
  errorCode: string | null;
  unauthorized: boolean;
}

export interface ProviderOptions {
  sleep?: (ms: number) => Promise<void>;
  maxPolls?: number;
}

function result(partial: Partial<ProviderResult> & Pick<ProviderResult, 'ok'>): ProviderResult {
  return {
    remoteId: null,
    httpStatus: null,
    ioError: false,
    errorCode: null,
    unauthorized: false,
    ...partial,
  };
}

function terminal(status: number, json: unknown): ProviderResult | null {
  if (status === 401) {
    return result({
      ok: false,
      httpStatus: 401,
      errorCode: upstreamErrorCode(json, 'unauthorized'),
      unauthorized: true,
    });
  }
  if (status === 502 || status === 503 || status === 504) {
    return result({
      ok: false,
      httpStatus: status,
      errorCode: upstreamErrorCode(json, `http_${status}`),
    });
  }
  if (status < 200 || status >= 300) {
    return result({
      ok: false,
      httpStatus: status,
      errorCode: upstreamErrorCode(json, `http_${status}`),
    });
  }
  return null;
}

async function postJson(
  fetchImpl: FetchLike,
  url: string,
  token: string,
  body: unknown,
  timeoutMs: number,
  idempotencyKey?: string,
): Promise<ProviderResult | { status: number; json: unknown }> {
  const response = await requestJson(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: jsonHeaders(token, idempotencyKey),
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  if ('io' in response) return result({ ok: false, ioError: true, errorCode: 'io' });
  const failed = terminal(response.status, response.json);
  if (failed) return failed;
  return response;
}

function rootId(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const id = (json as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function putString(target: Record<string, unknown>, key: string, value: string | null | undefined): void {
  if (value && value.length > 0) target[key] = value;
}

async function postInbox(
  fetchImpl: FetchLike,
  job: ProviderJob,
  body: Record<string, unknown>,
  idempotencyKey: string | undefined,
): Promise<ProviderResult> {
  const posted = await postJson(
    fetchImpl,
    `${job.apiBase}/api/v1/inbox`,
    job.token,
    body,
    JSON_TIMEOUT_MS,
    idempotencyKey,
  );
  if ('ok' in posted) return posted;
  const id = rootId(posted.json);
  if (!id) {
    return result({
      ok: false,
      httpStatus: posted.status,
      errorCode: 'missing_remote_id',
    });
  }
  return result({ ok: true, remoteId: id, httpStatus: posted.status });
}

function textPayload(job: ProviderJob): Record<string, unknown> {
  const link = job.kind === 'link' ? linkParts(job.body) : null;
  const plain = link?.text?.trim() ? link.text : job.body;
  const title = clipUnits((link?.title || titleFromBody(plain) || link?.url || '消息').trim(), 500);
  const markdownSource = link
    ? link.text.trim() || `${title}${link.url ? `\n\n${link.url}` : ''}`
    : job.body;
  const payload: Record<string, unknown> = {
    title: title || '消息',
    markdown: clipUnits(markdownSource, 4000),
    source: sourceFor(job.ingress),
    siteName: siteNameFor(job.ingress),
  };
  putString(payload, 'byline', bylineFor(job.sender, job.room));
  return payload;
}

async function deliverVitalText(fetchImpl: FetchLike, job: ProviderJob): Promise<ProviderResult> {
  return postInbox(fetchImpl, job, textPayload(job), job.dedupKey);
}

interface ExtractPreview {
  title: string;
  extractedText: string;
  excerpt: string;
  byline: string;
  siteName: string;
  markdown: string;
  contentJson: unknown;
}

function readPreview(value: unknown): ExtractPreview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    title: stringField(record, 'title'),
    extractedText: stringField(record, 'extractedText'),
    excerpt: stringField(record, 'excerpt'),
    byline: stringField(record, 'byline'),
    siteName: stringField(record, 'siteName'),
    markdown: stringField(record, 'markdown'),
    contentJson: record['contentJson'],
  };
}

function readJob(json: unknown): { id: string; status: string; preview: ExtractPreview | null } | null {
  if (!json || typeof json !== 'object') return null;
  const record = json as Record<string, unknown>;
  const id = stringField(record, 'id');
  const status = stringField(record, 'status');
  if (!id || !status) return null;
  return { id, status, preview: readPreview(record['preview']) };
}

function successInbox(job: ProviderJob, url: string, preview: ExtractPreview | null, fallbackTitle: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: clipUnits((preview?.title || fallbackTitle || url).trim(), 500) || '链接',
    source: sourceFor(job.ingress),
    originalUrl: url,
  };
  putString(payload, 'extractedText', preview?.extractedText);
  putString(payload, 'excerpt', preview?.excerpt);
  putString(payload, 'markdown', preview?.markdown);
  putString(payload, 'byline', preview?.byline || bylineFor(job.sender, job.room));
  putString(payload, 'siteName', preview?.siteName || siteNameFor(job.ingress));
  if (preview?.contentJson && typeof preview.contentJson === 'object') {
    payload['contentJson'] = preview.contentJson;
  }
  return payload;
}

function fallbackInbox(job: ProviderJob, url: string, title: string): Record<string, unknown> {
  const clippedTitle = clipUnits(title.trim() || url, 500);
  const payload: Record<string, unknown> = {
    title: clippedTitle || '链接',
    markdown: clipUnits(`${clippedTitle}\n\n${url}`, 4000),
    source: sourceFor(job.ingress),
    originalUrl: url,
    siteName: siteNameFor(job.ingress),
  };
  putString(payload, 'byline', bylineFor(job.sender, job.room));
  return payload;
}

async function deliverVitalLink(
  fetchImpl: FetchLike,
  job: ProviderJob,
  url: string,
  title: string,
  opts: ProviderOptions,
): Promise<ProviderResult> {
  const started = await postJson(
    fetchImpl,
    `${job.apiBase}/api/v1/inbox/extract-jobs`,
    job.token,
    { url },
    JSON_TIMEOUT_MS,
  );
  if ('ok' in started) {
    if (started.unauthorized || started.ioError || started.httpStatus === 502 || started.httpStatus === 503 || started.httpStatus === 504) {
      return started;
    }
    return postInbox(fetchImpl, job, fallbackInbox(job, url, title), undefined);
  }

  let jobView = readJob(started.json);
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxPolls = opts.maxPolls ?? 45;
  let polls = 0;
  while (jobView && (jobView.status === 'queued' || jobView.status === 'running') && polls < maxPolls) {
    await sleep(2_000);
    polls += 1;
    const polled = await requestJson(
      fetchImpl,
      `${job.apiBase}/api/v1/inbox/extract-jobs/${jobView.id}`,
      { method: 'GET', headers: { Authorization: `Bearer ${job.token}`, Accept: 'application/json' } },
      EXTRACT_TIMEOUT_MS,
    );
    if ('io' in polled) return result({ ok: false, ioError: true, errorCode: 'io' });
    const failed = terminal(polled.status, polled.json);
    if (failed) {
      if (failed.unauthorized || failed.ioError || failed.httpStatus === 502 || failed.httpStatus === 503 || failed.httpStatus === 504) {
        return failed;
      }
      return postInbox(fetchImpl, job, fallbackInbox(job, url, title), undefined);
    }
    jobView = readJob(polled.json);
  }

  if (!jobView) return postInbox(fetchImpl, job, fallbackInbox(job, url, title), undefined);
  if (jobView.status === 'succeeded') {
    return postInbox(fetchImpl, job, successInbox(job, url, jobView.preview, title), undefined);
  }
  if (jobView.status === 'failed') {
    return postInbox(fetchImpl, job, fallbackInbox(job, url, title), undefined);
  }
  return result({ ok: false, ioError: true, errorCode: 'extract_pending' });
}

async function deliverVital(fetchImpl: FetchLike, job: ProviderJob, opts: ProviderOptions): Promise<ProviderResult> {
  if (job.kind === 'link') {
    const link = linkParts(job.body);
    if (isLegalHttpUrl(link.url)) {
      const title = link.title || titleFromBody(link.text) || link.url;
      return deliverVitalLink(fetchImpl, job, link.url, title, opts);
    }
  }
  return deliverVitalText(fetchImpl, job);
}

function findCategoryId(json: unknown): string | null {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record['name'] === CATEGORY_NAME) {
      const id = typeof record['categoryId'] === 'string' ? record['categoryId'] : '';
      if (id) found.push(id);
    }
    for (const child of Object.values(record)) walk(child);
  };
  walk(json);
  return found[0] ?? null;
}

function apiCode(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null;
  const code = (json as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

function memoIdOf(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const data = (json as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const memo = (data as { memo?: unknown }).memo;
  if (!memo || typeof memo !== 'object') return null;
  const id = (memo as { memoId?: unknown }).memoId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

async function deliverAimo(fetchImpl: FetchLike, job: ProviderJob): Promise<ProviderResult> {
  const listed = await requestJson(
    fetchImpl,
    `${job.apiBase}/api/v1/categories`,
    { method: 'GET', headers: { Authorization: `Bearer ${job.token}`, Accept: 'application/json' } },
    JSON_TIMEOUT_MS,
  );
  if ('io' in listed) return result({ ok: false, ioError: true, errorCode: 'io' });
  const listFailed = terminal(listed.status, listed.json);
  if (listFailed) return listFailed;
  if (apiCode(listed.json) !== 0) {
    return result({
      ok: false,
      httpStatus: listed.status,
      errorCode: `aimo_${String(apiCode(listed.json) ?? 'bad')}`,
    });
  }

  let categoryId = findCategoryId(listed.json);
  if (!categoryId) {
    const created = await postJson(
      fetchImpl,
      `${job.apiBase}/api/v1/categories`,
      job.token,
      { name: CATEGORY_NAME },
      JSON_TIMEOUT_MS,
    );
    if ('ok' in created) return created;
    if (apiCode(created.json) !== 0) {
      return result({
        ok: false,
        httpStatus: created.status,
        errorCode: `aimo_${String(apiCode(created.json) ?? 'bad')}`,
      });
    }
    categoryId = findCategoryId(created.json);
  }
  if (!categoryId) return result({ ok: false, httpStatus: listed.status, errorCode: 'missing_category' });

  const link = job.kind === 'link' ? linkParts(job.body) : null;
  const content = clipUnits(
    link ? link.title.trim() || titleFromBody(link.text) || link.url : job.body,
    4000,
  );
  const memoBody: Record<string, unknown> = {
    type: 'text',
    content: content || '消息',
    categoryId,
  };
  if (link && link.url) memoBody['source'] = link.url;
  const created = await postJson(fetchImpl, `${job.apiBase}/api/v1/memos`, job.token, memoBody, JSON_TIMEOUT_MS);
  if ('ok' in created) return created;
  if (apiCode(created.json) !== 0) {
    return result({
      ok: false,
      httpStatus: created.status,
      errorCode: `aimo_${String(apiCode(created.json) ?? 'bad')}`,
    });
  }
  const memoId = memoIdOf(created.json);
  if (!memoId) return result({ ok: false, httpStatus: created.status, errorCode: 'missing_remote_id' });
  return result({ ok: true, remoteId: memoId, httpStatus: created.status });
}

async function deliverInwit(fetchImpl: FetchLike, job: ProviderJob): Promise<ProviderResult> {
  const link = job.kind === 'link' ? linkParts(job.body) : null;
  const plain = link?.text?.trim() ? link.text : job.body;
  const title = clipUnits((link?.title || titleFromBody(plain) || link?.url || '消息').trim(), 500) || '消息';
  const markdown = link
    ? clipUnits(link.text.trim() || `${title}${link.url ? `\n\n${link.url}` : ''}`, 64 * 1024)
    : job.body;
  const payload: Record<string, unknown> = { title, markdown };
  if (link?.url) payload['sourceUrl'] = link.url;
  const posted = await postJson(
    fetchImpl,
    `${job.apiBase}/api/open/documents`,
    job.token,
    payload,
    JSON_TIMEOUT_MS,
  );
  if ('ok' in posted) return posted;
  const id = rootId(posted.json);
  if (!id) return result({ ok: false, httpStatus: posted.status, errorCode: 'missing_remote_id' });
  return result({ ok: true, remoteId: id, httpStatus: posted.status });
}

export async function deliverToProvider(
  job: ProviderJob,
  fetchImpl: FetchLike,
  opts: ProviderOptions = {},
): Promise<ProviderResult> {
  if (job.provider === 'vital') return deliverVital(fetchImpl, job, opts);
  if (job.provider === 'aimo') return deliverAimo(fetchImpl, job);
  return deliverInwit(fetchImpl, job);
}
