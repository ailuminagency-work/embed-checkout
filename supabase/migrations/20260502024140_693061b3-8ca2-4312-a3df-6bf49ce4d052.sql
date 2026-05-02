ALTER TABLE public.app_images
ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"fit":"cover","positionX":50,"positionY":50,"zoom":100}'::jsonb;