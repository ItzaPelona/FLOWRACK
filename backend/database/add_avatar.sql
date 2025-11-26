-- Add avatar_url field for user avatars
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
