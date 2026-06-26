import { useCallback, useState } from "react";
import { Send } from "lucide-react";
import { useMessages, type FanMessage } from "../api/messages";
import { cn, Card, SectionHeading } from "../components/ui";

const MAX_LEN = 140;
const MAX_NICK = 24;
const POST_COOLDOWN_MS = 10_000;
const LAST_POST_KEY = "fanTalkLastPost";
/** 留言达到这个数量才启用自动滚动（不足一屏时静态展示） */
const SCROLL_THRESHOLD = 6;

function timeAgo(ts: string): string {
  if (!ts) return "";
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function MessageItem({ msg }: { msg: FanMessage }) {
  const isAnon = !msg.nickname;
  const name = msg.nickname || "匿名球迷";
  return (
    <div className="rounded-xl border border-line/40 bg-surface/60 px-3.5 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn("text-xs font-medium", isAnon ? "text-muted" : "text-primary-bright")}>
          {isAnon ? "🕶️ " : "⚽ "}{name}
        </span>
        <span className="shrink-0 text-[10px] text-muted/60">{timeAgo(msg.ts)}</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-ink/90">{msg.content}</p>
    </div>
  );
}

export default function FanTalk() {
  const { messages, loading, error, posting, post } = useMessages();
  const [content, setContent] = useState("");
  const [nickname, setNickname] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const text = content.trim();
    if (!text || posting) return;

    // 前端频率限制：10 秒一条
    const last = Number(localStorage.getItem(LAST_POST_KEY) || 0);
    const elapsed = Date.now() - last;
    if (elapsed < POST_COOLDOWN_MS) {
      setPostError(`发言太快啦，请 ${Math.ceil((POST_COOLDOWN_MS - elapsed) / 1000)} 秒后再试`);
      return;
    }

    setPostError(null);
    try {
      await post({ content: text, nickname, anonymous });
      localStorage.setItem(LAST_POST_KEY, String(Date.now()));
      setContent("");
    } catch (e) {
      setPostError((e as Error).message);
    }
  }, [content, nickname, anonymous, posting, post]);

  const scroll = messages.length >= SCROLL_THRESHOLD;
  // 复制两份 + translateY(-50%) 实现无缝循环；滚动时长随条数增长，保持匀速
  const track = scroll ? [...messages, ...messages] : messages;

  return (
    <section className="mb-6">
      <SectionHeading
        kicker="FAN ZONE"
        title="球迷交流区"
        right={<span className="text-[10px] text-muted/60">{messages.length} 条留言</span>}
      />

      {/* 发表区 */}
      <Card className="mb-3 p-3.5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
          placeholder="说说你对本届世界杯的看法或吐槽…"
          rows={2}
          className="w-full resize-none rounded-xl border border-line/50 bg-surface/60 px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-primary/50 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, MAX_NICK))}
            disabled={anonymous}
            placeholder="昵称（可选）"
            className="min-w-0 flex-1 rounded-lg border border-line/50 bg-surface/60 px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-primary/50 focus:outline-none disabled:opacity-40"
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="accent-primary" />
            匿名
          </label>
          <span className="shrink-0 text-[10px] tabular-nums text-muted/50">{content.length}/{MAX_LEN}</span>
          <button
            onClick={handleSubmit}
            disabled={posting || !content.trim()}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              posting || !content.trim()
                ? "cursor-not-allowed bg-surface text-muted/50"
                : "bg-primary text-white hover:bg-primary-bright",
            )}
          >
            <Send className="h-3 w-3" />
            {posting ? "发表中…" : "发表"}
          </button>
        </div>
        {postError && <p className="mt-1.5 text-[11px] text-primary-bright">{postError}</p>}
      </Card>

      {/* 留言竖向跑马灯 */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="py-14 text-center text-sm text-muted">加载留言…</div>
        ) : messages.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted">还没有人发言，来抢沙发 🛋️</div>
        ) : (
          <div className="fan-marquee relative h-[320px] overflow-hidden">
            <div
              className={cn("flex flex-col gap-2 p-3", scroll && "fan-track")}
              style={scroll ? { animationDuration: `${messages.length * 3}s` } : undefined}
            >
              {track.map((m, i) => (
                <MessageItem key={`${m.id}-${i}`} msg={m} />
              ))}
            </div>
            {/* 上下渐隐遮罩 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-surface to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          </div>
        )}
      </Card>
      {error && <p className="mt-1.5 text-center text-[11px] text-muted">留言加载失败，请稍后刷新</p>}
    </section>
  );
}
