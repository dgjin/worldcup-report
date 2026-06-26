import { useCallback, useEffect, useRef, useState } from "react";

export interface FanMessage {
  id: string;
  nickname: string;
  content: string;
  ts: string;
}

export interface PostInput {
  content: string;
  nickname?: string;
  anonymous?: boolean;
}

export interface MessagesState {
  messages: FanMessage[];
  loading: boolean;
  error: string | null;
  posting: boolean;
  /** 发表留言；成功后把新留言插到列表最前，失败抛出异常 */
  post: (input: PostInput) => Promise<void>;
  reload: () => void;
}

async function fetchMessages(limit = 60): Promise<FanMessage[]> {
  const res = await fetch(`/api/app/messages?limit=${limit}&_t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`留言加载失败: HTTP ${res.status}`);
  const data = (await res.json()) as { messages?: FanMessage[] };
  return data.messages ?? [];
}

async function postMessage(input: PostInput): Promise<FanMessage> {
  const res = await fetch("/api/app/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: boolean; message?: FanMessage; error?: string };
  if (!res.ok || !data.ok || !data.message) throw new Error(data.error || "发表失败");
  return data.message;
}

/** 球迷交流区留言：加载列表 + 发表 */
export function useMessages(): MessagesState {
  const [messages, setMessages] = useState<FanMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchMessages();
      setMessages(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loaded.current) return; // 防 StrictMode 双调用重复加载
    loaded.current = true;
    load();
  }, [load]);

  const post = useCallback(async (input: PostInput): Promise<void> => {
    if (posting) return;
    setPosting(true);
    try {
      const msg = await postMessage(input);
      setMessages((prev) => [msg, ...prev]); // 新留言置顶
    } finally {
      // 失败不写 setError（避免污染加载态），异常交由调用方用 inline 提示
      setPosting(false);
    }
  }, [posting]);

  return { messages, loading, error, posting, post, reload: load };
}
