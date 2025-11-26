-- Migration script to add QR codes and strikes system
-- Run this after initial schema setup

-- Add QR code and return time fields to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS expected_return_datetime TIMESTAMP,
ADD COLUMN IF NOT EXISTS actual_return_datetime TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_damaged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS damage_description TEXT;

-- Add strikes counter to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_strike_date TIMESTAMP;

-- Create strikes history table for tracking individual strikes
CREATE TABLE IF NOT EXISTS user_strikes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    strike_type VARCHAR(20) CHECK (strike_type IN ('late_return', 'damaged_item', 'no_show', 'other')),
    description TEXT,
    hours_late DECIMAL(10,2), -- for late returns, track how late
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on QR codes for fast lookup
CREATE INDEX IF NOT EXISTS idx_requests_qr_code ON requests(qr_code);
CREATE INDEX IF NOT EXISTS idx_user_strikes_user_id ON user_strikes(user_id);

-- Add comments for documentation
COMMENT ON COLUMN requests.qr_code IS 'Unique QR code for request pickup/return verification';
COMMENT ON COLUMN requests.expected_return_datetime IS 'Expected date and time for material return';
COMMENT ON COLUMN requests.actual_return_datetime IS 'Actual date and time when material was returned';
COMMENT ON COLUMN requests.is_late IS 'Flag indicating if material was returned late';
COMMENT ON COLUMN requests.is_damaged IS 'Flag indicating if material was returned damaged';
COMMENT ON COLUMN users.strikes IS 'Number of strikes user has received for policy violations';
COMMENT ON TABLE user_strikes IS 'Historical record of all strikes issued to users';
