import { HelpCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

export function HelpButton() {
  const [open, setOpen] = useState(false);

  // 打开时禁止页面滚动
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-xl border border-line/60 bg-surface/60 text-muted transition-colors hover:border-primary/50 hover:text-ink"
        title="帮助"
        aria-label="帮助"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
      />

      {/* 抽屉面板 */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-line bg-bg shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-line/50 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">数据说明</h2>
          <button
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5 text-sm leading-relaxed text-ink/85">

            {/* 数据来源 */}
            <div>
              <h3 className="mb-1.5 font-semibold text-ink">📡 数据来源</h3>
              <p>比赛数据来自 <a href="https://www.football-data.org" target="_blank" rel="noopener" className="text-primary underline">football-data.org</a> API，该平台为 FIFA 官方数据合作伙伴。</p>
              <p className="mt-1 text-xs text-muted">数据层级：Live API → Supabase 缓存 → 快照兜底</p>
            </div>

            {/* 刷新机制 */}
            <div>
              <h3 className="mb-1.5 font-semibold text-ink">🔄 刷新机制</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                <li><span className="text-pitch font-medium">15 秒</span> — 有比赛进行中</li>
                <li><span className="text-amber-400 font-medium">30 秒</span> — 近 10 分钟有比赛结束</li>
                <li><span className="text-muted font-medium">60 秒</span> — 无比赛活动</li>
                <li>页面不可见时自动暂停轮询</li>
              </ul>
            </div>

            {/* 数据处理 */}
            <div>
              <h3 className="mb-1.5 font-semibold text-ink">⚙️ 数据处理</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                <li><strong>积分榜</strong> — 官方排名，按积分→净胜球→进球排序</li>
                <li><strong>淘汰赛对阵</strong> — 取自 API 实时数据，TBD 位置显示"待定"</li>
                <li><strong>数据图表</strong> — 全部来自比赛和积分榜真实数据，无编造</li>
                <li><strong>射手榜</strong> — API 覆盖 Top 30 球员，排名准确</li>
              </ul>
            </div>

            {/* 数据限制 */}
            <div>
              <h3 className="mb-1.5 font-semibold text-ink">⚠️ 数据限制</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                <li>不包含红黄牌、控球率、射门数等深度指标</li>
                <li>助攻、位置分布因数据不全未展示</li>
                <li>淘汰赛对阵依赖 API 更新，可能有延迟</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="shrink-0 border-t border-line/50 px-5 py-3 text-center text-[10px] text-muted">
          2026 世界杯战报 · 仅供学习演示
        </div>
      </div>
    </>
  );
}
