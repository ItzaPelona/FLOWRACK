-- FlowRack Warehouse Management System Database Schema
-- PostgreSQL Database Schema

-- Drop existing tables if they exist (for clean setup)
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
INSERT INTO users (registration_number, password_hash, first_name, last_name, email, role, department) VALUES
('ADM001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfOCzM5JBqQ5SZu', 'Admin', 'User', 'admin@flowrack.com', 'admin', 'Administration'),
('OPR001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfOCzM5JBqQ5SZu', 'Warehouse', 'Operator', 'operator@flowrack.com', 'operator', 'Warehouse'),
('USR001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfOCzM5JBqQ5SZu', 'John', 'Doe', 'john.doe@example.com', 'user', 'Engineering');

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