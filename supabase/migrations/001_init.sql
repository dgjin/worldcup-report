-- 世界杯战报 Supabase Schema
-- 混合策略：matches 关系化（支持 goals 独立查询），其他数据存 JSON blob

-- 比赛表（关系化，支持 goals 独立查询和增量更新）
CREATE TABLE wc_matches (
  id          integer PRIMARY KEY,     -- football-data.org match id
  data        jsonb NOT NULL,          -- 完整 MatchRaw 对象（含 goals）
  home_team   text NOT NULL,           -- 冗余字段，加速查询
  away_team   text NOT NULL,
  status      text NOT NULL,           -- FINISHED / TIMED / IN_PLAY ...
  utc_date    timestamptz NOT NULL,
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_wc_matches_status ON wc_matches(status);

-- 其他数据：JSON blob 存储（standings / scorers / teams）
CREATE TABLE wc_data (
  type        text PRIMARY KEY,        -- 'standings' | 'scorers' | 'teams'
  data        jsonb NOT NULL,
  source      text NOT NULL DEFAULT 'snapshot',
  updated_at  timestamptz DEFAULT now()
);

-- 同步元信息
CREATE TABLE wc_sync_meta (
  type          text PRIMARY KEY,
  last_sync_at  timestamptz NOT NULL,
  source        text NOT NULL           -- 'live' | 'snapshot'
);

-- 禁用 RLS（所有访问走 service_role key，前端不直连 Supabase）
ALTER TABLE wc_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE wc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE wc_sync_meta ENABLE ROW LEVEL SECURITY;
