-- Add status field for user registration workflow
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Update existing users to active status
UPDATE users SET status = 'active' WHERE status IS NULL OR status = '';

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
