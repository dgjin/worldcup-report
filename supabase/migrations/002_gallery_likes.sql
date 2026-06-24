-- 照片点赞表
CREATE TABLE gallery_likes (
  photo_key   text PRIMARY KEY,        -- 图片唯一标识（URL 中提取）
  likes       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);

-- RLS（service_role 直连无需策略，但不启用 RLS 会触发 Supabase 安全警告）
ALTER TABLE gallery_likes ENABLE ROW LEVEL SECURITY;
