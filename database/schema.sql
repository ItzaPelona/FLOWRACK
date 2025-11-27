-- FlowRack Warehouse Management System Database Schema
-- PostgreSQL Database Schema

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS request_items CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'operator', 'admin')),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    avatar_url TEXT,
    strikes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit_of_measure VARCHAR(20) NOT NULL,
    stock_quantity DECIMAL(10,2) DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    unit_price DECIMAL(10,2),
    location VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requests table
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'collecting', 'delivered', 'returned', 'cancelled')),
    requested_date DATE NOT NULL,
    requested_time TIME NOT NULL,
    estimated_usage_period INTEGER, -- in days
    supervising_instructor VARCHAR(255),
    purpose TEXT,
    collection_date TIMESTAMP,
    delivery_date TIMESTAMP,
    return_date TIMESTAMP,
    expected_return_datetime TIMESTAMP,
    qr_code TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request items table (many-to-many relationship between requests and products)
CREATE TABLE request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    requested_quantity DECIMAL(10,2) NOT NULL,
    approved_quantity DECIMAL(10,2),
    delivered_quantity DECIMAL(10,2),
    returned_quantity DECIMAL(10,2),
    delivered_weight DECIMAL(10,3), -- for weighing system integration
    returned_weight DECIMAL(10,3),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Debts table
CREATE TABLE debts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    debt_type VARCHAR(20) DEFAULT 'missing' CHECK (debt_type IN ('missing', 'damaged', 'overdue')),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived', 'disputed')),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    resolved_by INTEGER REFERENCES users(id),
    resolved_date TIMESTAMP,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transactions table (for tracking all inventory movements)
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment', 'return')),
    quantity DECIMAL(10,2) NOT NULL,
    reference_type VARCHAR(20), -- 'request', 'purchase', 'adjustment', etc.
    reference_id INTEGER, -- ID of the related record
    performed_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_users_registration_number ON users(registration_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_requests_user_id ON requests(user_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_request_number ON requests(request_number);
CREATE INDEX idx_request_items_request_id ON request_items(request_id);
CREATE INDEX idx_request_items_product_id ON request_items(product_id);
CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions(product_id);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
-- Note: All sample users use password: 'password123'
INSERT INTO users (registration_number, password_hash, first_name, last_name, email, role, department, status, avatar_url) VALUES
('ADM001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfOCzM5JBqQ5SZu', 'Admin', 'User', 'admin@flowrack.com', 'admin', 'Administration', 'approved', NULL),
('OPR001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfOCzM5JBqQ5SZu', 'Warehouse', 'Operator', 'operator@flowrack.com', 'operator', 'Warehouse', 'approved', NULL),
('USR001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfOCzM5JBqQ5SZu', 'John', 'Doe', 'john.doe@example.com', 'user', 'Engineering', 'approved', NULL);

INSERT INTO products (name, description, category, unit_of_measure, stock_quantity, minimum_stock, unit_price, location) VALUES
('Safety Helmets', 'White safety helmets for construction work', 'Safety Equipment', 'pcs', 50, 10, 25.99, 'A-01-001'),
('Steel Pipes', '2-inch diameter steel pipes', 'Construction Materials', 'meters', 100, 20, 15.50, 'B-02-003'),
('Power Drill', 'Cordless power drill with battery pack', 'Tools', 'pcs', 15, 3, 89.99, 'C-01-005'),
('Safety Gloves', 'Cut-resistant work gloves', 'Safety Equipment', 'pairs', 80, 15, 12.99, 'A-01-002'),
('Measuring Tape', '25-meter measuring tape', 'Tools', 'pcs', 25, 5, 19.99, 'C-01-001');

-- Create views for common queries
CREATE VIEW user_request_summary AS
SELECT 
    u.id AS user_id,
    u.first_name || ' ' || u.last_name AS user_name,
    u.registration_number,
    COUNT(r.id) AS total_requests,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending_requests,
    COUNT(CASE WHEN r.status = 'delivered' THEN 1 END) AS active_requests,
    COALESCE(SUM(d.total_amount), 0) AS total_debt
FROM users u
LEFT JOIN requests r ON u.id = r.user_id
LEFT JOIN debts d ON u.id = d.user_id AND d.status = 'pending'
WHERE u.role = 'user'
GROUP BY u.id, u.first_name, u.last_name, u.registration_number;

CREATE VIEW product_inventory_summary AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.stock_quantity,
    p.minimum_stock,
    CASE 
        WHEN p.stock_quantity <= p.minimum_stock THEN 'Low Stock'
        WHEN p.stock_quantity = 0 THEN 'Out of Stock'
        ELSE 'In Stock'
    END AS stock_status,
    COUNT(ri.id) AS pending_requests
FROM products p
LEFT JOIN request_items ri ON p.id = ri.product_id
LEFT JOIN requests r ON ri.request_id = r.id AND r.status IN ('pending', 'approved')
WHERE p.is_active = TRUE
GROUP BY p.id, p.name, p.category, p.stock_quantity, p.minimum_stock;

-- ============================================================================
-- INVENTORY MANAGEMENT EXTENSIONS
-- ============================================================================

-- Add barcode and image fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER DEFAULT 0;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    contact_person VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    website VARCHAR(300),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create product_suppliers junction table (many-to-many)
CREATE TABLE IF NOT EXISTS product_suppliers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_product_code VARCHAR(100),
    cost_price DECIMAL(10, 2),
    lead_time_days INTEGER DEFAULT 7,
    minimum_order_quantity INTEGER DEFAULT 1,
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, supplier_id)
);

-- Create stock_adjustments table for inventory corrections
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_number VARCHAR(100),
    adjusted_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    adjustment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_adjustment_type CHECK (
        adjustment_type IN ('correction', 'damage', 'loss', 'found', 'transfer', 'return', 'initial')
    )
);

-- Create product_images table (support multiple images per product)
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    image_filename VARCHAR(300) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_reorder ON products(stock_quantity, minimum_stock) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_type ON stock_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary ON product_images(product_id) WHERE is_primary = TRUE;

-- Create view for low stock products with supplier information
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.stock_quantity,
    p.minimum_stock,
    p.reorder_point,
    p.reorder_quantity,
    p.location,
    p.barcode,
    s.id as supplier_id,
    s.name as supplier_name,
    s.email as supplier_email,
    s.phone as supplier_phone,
    ps.cost_price,
    ps.lead_time_days,
    ps.minimum_order_quantity,
    ps.supplier_product_code
FROM products p
LEFT JOIN product_suppliers ps ON p.id = ps.product_id AND ps.is_preferred = TRUE
LEFT JOIN suppliers s ON ps.supplier_id = s.id
WHERE p.is_active = TRUE 
    AND (
        p.stock_quantity <= COALESCE(p.reorder_point, p.minimum_stock)
        OR p.stock_quantity <= p.minimum_stock
    )
ORDER BY 
    CASE 
        WHEN p.stock_quantity <= 0 THEN 1
        WHEN p.stock_quantity <= p.minimum_stock THEN 2
        WHEN p.stock_quantity <= p.reorder_point THEN 3
        ELSE 4
    END,
    p.stock_quantity ASC;

-- Create view for stock adjustment history with user details
CREATE OR REPLACE VIEW stock_adjustment_history AS
SELECT 
    sa.id,
    sa.product_id,
    p.name as product_name,
    p.category as product_category,
    sa.adjustment_type,
    sa.quantity_change,
    sa.quantity_before,
    sa.quantity_after,
    sa.reason,
    sa.reference_number,
    sa.adjustment_date,
    u.registration_number as adjusted_by_reg,
    u.first_name || ' ' || u.last_name as adjusted_by_name,
    approver.first_name || ' ' || approver.last_name as approved_by_name,
    sa.created_at
FROM stock_adjustments sa
JOIN products p ON sa.product_id = p.id
JOIN users u ON sa.adjusted_by = u.id
LEFT JOIN users approver ON sa.approved_by = approver.id
ORDER BY sa.adjustment_date DESC;

-- Insert sample suppliers
INSERT INTO suppliers (name, contact_person, email, phone, address, is_active) VALUES
    ('Office Supplies Co.', 'John Smith', 'john@officesupplies.com', '555-0101', '123 Supply St, Business City', TRUE),
    ('Tech Equipment Ltd.', 'Sarah Johnson', 'sarah@techequip.com', '555-0102', '456 Tech Ave, Innovation Park', TRUE),
    ('Industrial Parts Inc.', 'Mike Wilson', 'mike@industrialparts.com', '555-0103', '789 Industry Blvd, Factory Town', TRUE)
ON CONFLICT DO NOTHING;

-- Activity Logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject', 'login', 'logout', etc.
    entity_type VARCHAR(50), -- 'user', 'product', 'request', 'adjustment', 'supplier', etc.
    entity_id INTEGER, -- ID of the affected entity
    description TEXT NOT NULL, -- Human-readable description of the action
    details JSONB, -- Additional structured data about the action
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT, -- Browser/client information
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- View for recent activity with user details
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    al.id,
    al.user_id,
    u.first_name || ' ' || u.last_name as user_name,
    u.registration_number,
    u.role as user_role,
    al.action_type,
    al.entity_type,
    al.entity_id,
    al.description,
    al.details,
    al.created_at
FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

-- ============================================================================
-- COLLABORATION FEATURES
-- Request comments, internal notes, request sharing, and team requests
-- ============================================================================

-- Request Comments Table (visible to users and staff)
CREATE TABLE IF NOT EXISTS request_comments (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal notes only visible to operators/admins
    parent_comment_id INTEGER REFERENCES request_comments(id) ON DELETE CASCADE, -- For threaded comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited BOOLEAN DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id)
);

-- Request Shares Table (share requests between users)
CREATE TABLE IF NOT EXISTS request_shares (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    shared_by INTEGER NOT NULL REFERENCES users(id),
    shared_with INTEGER NOT NULL REFERENCES users(id),
    permission_level VARCHAR(20) DEFAULT 'view', -- 'view', 'edit', 'admin'
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(request_id, shared_by, shared_with)
);

-- Team Requests Table (multiple users on one request)
CREATE TABLE IF NOT EXISTS team_requests (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'member', 'viewer'
    added_by INTEGER NOT NULL REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(request_id, user_id)
);

-- Comment Reactions Table (optional - for likes/reactions)
CREATE TABLE IF NOT EXISTS comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES request_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    reaction_type VARCHAR(20) DEFAULT 'like', -- 'like', 'helpful', 'resolved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id, reaction_type)
);

-- Indexes for collaboration features
CREATE INDEX IF NOT EXISTS idx_comments_request_id ON request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON request_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_internal ON request_comments(is_internal);
CREATE INDEX IF NOT EXISTS idx_comments_deleted ON request_comments(deleted);
CREATE INDEX IF NOT EXISTS idx_comments_created ON request_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shares_request_id ON request_shares(request_id);
CREATE INDEX IF NOT EXISTS idx_shares_shared_by ON request_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_shares_shared_with ON request_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_shares_active ON request_shares(is_active);

CREATE INDEX IF NOT EXISTS idx_team_requests_request_id ON team_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_team_requests_user_id ON team_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_team_requests_active ON team_requests(is_active);

CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON comment_reactions(user_id);

-- View for request comments with user info
CREATE OR REPLACE VIEW request_comments_view AS
SELECT 
    rc.*,
    u.first_name || ' ' || u.last_name as username,
    u.email,
    u.role,
    (SELECT COUNT(*) FROM comment_reactions WHERE comment_id = rc.id) as reaction_count,
    (SELECT COUNT(*) FROM request_comments WHERE parent_comment_id = rc.id AND deleted = FALSE) as reply_count
FROM request_comments rc
JOIN users u ON rc.user_id = u.id
WHERE rc.deleted = FALSE
ORDER BY rc.created_at ASC;

-- View for internal notes (operator/admin only)
CREATE OR REPLACE VIEW internal_notes_view AS
SELECT 
    rc.*,
    u.first_name || ' ' || u.last_name as username,
    u.email,
    u.role
FROM request_comments rc
JOIN users u ON rc.user_id = u.id
WHERE rc.is_internal = TRUE AND rc.deleted = FALSE
ORDER BY rc.created_at DESC;

-- View for shared requests
CREATE OR REPLACE VIEW shared_requests_view AS
SELECT 
    rs.*,
    r.request_number,
    r.status as request_status,
    r.requested_date,
    r.delivery_date,
    r.purpose,
    shared_by_user.first_name || ' ' || shared_by_user.last_name as shared_by_username,
    shared_with_user.first_name || ' ' || shared_with_user.last_name as shared_with_username,
    shared_with_user.email as shared_with_email
FROM request_shares rs
JOIN requests r ON rs.request_id = r.id
JOIN users shared_by_user ON rs.shared_by = shared_by_user.id
JOIN users shared_with_user ON rs.shared_with = shared_with_user.id
WHERE rs.is_active = TRUE
ORDER BY rs.created_at DESC;

-- View for team requests
CREATE OR REPLACE VIEW team_requests_view AS
SELECT 
    tr.*,
    r.request_number,
    r.status as request_status,
    r.requested_date,
    r.delivery_date,
    r.purpose,
    u.first_name || ' ' || u.last_name as username,
    u.email,
    u.role as user_role,
    added_by_user.first_name || ' ' || added_by_user.last_name as added_by_username
FROM team_requests tr
JOIN requests r ON tr.request_id = r.id
JOIN users u ON tr.user_id = u.id
JOIN users added_by_user ON tr.added_by = added_by_user.id
WHERE tr.is_active = TRUE
ORDER BY tr.added_at ASC;

-- Function to update comment timestamp
CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.edited = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for comment updates
DROP TRIGGER IF EXISTS trg_update_comment_timestamp ON request_comments;
CREATE TRIGGER trg_update_comment_timestamp
    BEFORE UPDATE ON request_comments
    FOR EACH ROW
    WHEN (OLD.comment IS DISTINCT FROM NEW.comment)
    EXECUTE FUNCTION update_comment_timestamp();

-- Function to notify on new comment (placeholder for future notification system)
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
BEGIN
    -- Future: Send notification to request owner and team members
    -- For now, just log it
    RAISE NOTICE 'New comment on request % by user %', NEW.request_id, NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new comments
DROP TRIGGER IF EXISTS trg_notify_new_comment ON request_comments;
CREATE TRIGGER trg_notify_new_comment
    AFTER INSERT ON request_comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_comment();

-- Function to check if user has access to request (via ownership, team, or share)
CREATE OR REPLACE FUNCTION user_has_request_access(p_user_id INTEGER, p_request_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN;
BEGIN
    -- Check if user is request owner
    SELECT EXISTS (
        SELECT 1 FROM requests WHERE id = p_request_id AND user_id = p_user_id
    ) INTO has_access;
    
    IF has_access THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is team member
    SELECT EXISTS (
        SELECT 1 FROM team_requests 
        WHERE request_id = p_request_id AND user_id = p_user_id AND is_active = TRUE
    ) INTO has_access;
    
    IF has_access THEN
        RETURN TRUE;
    END IF;
    
    -- Check if request is shared with user
    SELECT EXISTS (
        SELECT 1 FROM request_shares 
        WHERE request_id = p_request_id AND shared_with = p_user_id AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ) INTO has_access;
    
    RETURN has_access;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's permission level for a request
CREATE OR REPLACE FUNCTION get_user_request_permission(p_user_id INTEGER, p_request_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    permission VARCHAR(20);
BEGIN
    -- Check if user is owner
    IF EXISTS (SELECT 1 FROM requests WHERE id = p_request_id AND user_id = p_user_id) THEN
        RETURN 'owner';
    END IF;
    
    -- Check team role
    SELECT role INTO permission
    FROM team_requests
    WHERE request_id = p_request_id AND user_id = p_user_id AND is_active = TRUE;
    
    IF permission IS NOT NULL THEN
        RETURN permission;
    END IF;
    
    -- Check share permission
    SELECT permission_level INTO permission
    FROM request_shares
    WHERE request_id = p_request_id AND shared_with = p_user_id AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
    
    IF permission IS NOT NULL THEN
        RETURN permission;
    END IF;
    
    RETURN NULL; -- No access
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ADVANCED SEARCH & FILTERS
-- Saved searches, filter configurations, and search history
-- ============================================================================

-- Saved Searches Table
CREATE TABLE IF NOT EXISTS saved_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    search_type VARCHAR(50) NOT NULL, -- 'requests', 'products', 'debts', 'users', 'payments'
    filters JSONB NOT NULL, -- Store filter configuration as JSON
    sorting JSONB, -- Store sort configuration
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE, -- Share with other users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    use_count INTEGER DEFAULT 0
);

-- Search History Table (optional - track what users search for)
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_type VARCHAR(50) NOT NULL,
    search_query TEXT,
    filters JSONB,
    result_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Export History Table (track CSV exports)
CREATE TABLE IF NOT EXISTS export_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    export_type VARCHAR(50) NOT NULL, -- 'requests', 'products', 'debts', etc
    filters JSONB,
    record_count INTEGER,
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for advanced search
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_type ON saved_searches(search_type);
CREATE INDEX IF NOT EXISTS idx_saved_searches_public ON saved_searches(is_public);
CREATE INDEX IF NOT EXISTS idx_saved_searches_default ON saved_searches(is_default);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_type ON search_history(search_type);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_type ON export_history(export_type);
CREATE INDEX IF NOT EXISTS idx_export_history_created ON export_history(created_at DESC);

-- View for popular searches
CREATE OR REPLACE VIEW popular_searches AS
SELECT 
    search_type,
    search_query,
    COUNT(*) as search_count,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as last_searched
FROM search_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY search_type, search_query
HAVING COUNT(*) > 1
ORDER BY search_count DESC
LIMIT 20;

-- View for user's saved searches with usage stats
CREATE OR REPLACE VIEW user_saved_searches AS
SELECT 
    ss.*,
    u.first_name || ' ' || u.last_name as username,
    u.email
FROM saved_searches ss
JOIN users u ON ss.user_id = u.id
ORDER BY ss.last_used_at DESC NULLS LAST, ss.use_count DESC;

-- Function to update saved search usage
CREATE OR REPLACE FUNCTION update_search_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used_at = CURRENT_TIMESTAMP;
    NEW.use_count = COALESCE(OLD.use_count, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old search history (keep last 90 days)
CREATE OR REPLACE FUNCTION clean_old_search_history()
RETURNS void AS $$
BEGIN
    DELETE FROM search_history 
    WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
    
    RAISE NOTICE 'Cleaned search history older than 90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get filter suggestions based on search history
CREATE OR REPLACE FUNCTION get_filter_suggestions(p_user_id INTEGER, p_search_type VARCHAR)
RETURNS TABLE (
    filter_key VARCHAR,
    filter_value TEXT,
    usage_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.key::VARCHAR as filter_key,
        f.value::TEXT as filter_value,
        COUNT(*) as usage_count
    FROM search_history sh,
         jsonb_each(sh.filters) f
    WHERE sh.user_id = p_user_id
      AND sh.search_type = p_search_type
      AND sh.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY f.key, f.value
    ORDER BY usage_count DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to create default search filters for common use cases
CREATE OR REPLACE FUNCTION create_default_searches(p_user_id INTEGER)
RETURNS void AS $$
BEGIN
    -- Pending requests
    INSERT INTO saved_searches (user_id, name, description, search_type, filters, is_default)
    VALUES (
        p_user_id,
        'My Pending Requests',
        'All my pending requests',
        'requests',
        '{"status": ["pending"], "user_id": [' || p_user_id || ']}',
        TRUE
    ) ON CONFLICT DO NOTHING;
    
    -- Overdue requests
    INSERT INTO saved_searches (user_id, name, description, search_type, filters, is_default)
    VALUES (
        p_user_id,
        'Overdue Requests',
        'Requests past delivery date',
        'requests',
        '{"overdue": true}',
        FALSE
    ) ON CONFLICT DO NOTHING;
    
    -- Recent requests (last 7 days)
    INSERT INTO saved_searches (user_id, name, description, search_type, filters, is_default)
    VALUES (
        p_user_id,
        'Recent Requests',
        'Requests from last 7 days',
        'requests',
        '{"date_range": "last_7_days"}',
        FALSE
    ) ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created default searches for user %', p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Comments on tables
COMMENT ON TABLE request_comments IS 'User and internal comments on requests';
COMMENT ON TABLE request_shares IS 'Request sharing between users';
COMMENT ON TABLE team_requests IS 'Team collaboration on requests';
COMMENT ON TABLE comment_reactions IS 'Reactions to comments (likes, helpful, etc)';
COMMENT ON TABLE saved_searches IS 'User-defined saved search filters';
COMMENT ON TABLE search_history IS 'Track user search patterns for analytics and suggestions';
COMMENT ON TABLE export_history IS 'Audit trail of data exports';

-- Comments on functions
COMMENT ON FUNCTION user_has_request_access IS 'Check if user has access to request via ownership, team, or share';
COMMENT ON FUNCTION get_user_request_permission IS 'Get user permission level for request (owner, admin, edit, view)';
COMMENT ON FUNCTION get_filter_suggestions IS 'Get commonly used filter combinations for a user';
COMMENT ON FUNCTION create_default_searches IS 'Create helpful default saved searches for new users';
COMMENT ON FUNCTION clean_old_search_history IS 'Scheduled job to remove old search history';
