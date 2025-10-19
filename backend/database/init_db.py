"""
Database initialization script
Run this script to set up the database schema and insert initial data
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Add the parent directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv()

def create_database():
    """Create the database if it doesn't exist"""
    try:
        # Connect to PostgreSQL server (not the specific database)
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            user=os.getenv('DB_USER', 'flowrack_user'),
            password=os.getenv('DB_PASSWORD', 'your_password'),
            database='postgres'  # Connect to default postgres database
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        cursor = conn.cursor()
        
        # Check if database exists
        db_name = os.getenv('DB_NAME', 'flowrack')
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        
        if not cursor.fetchone():
            print(f"Creating database '{db_name}'...")
            cursor.execute(f'CREATE DATABASE "{db_name}"')
            print(f"Database '{db_name}' created successfully!")
        else:
            print(f"Database '{db_name}' already exists.")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error creating database: {e}")
        return False
    
    return True

def init_schema():
    """Initialize database schema"""
    try:
        from backend.database import init_database
        print("Initializing database schema...")
        init_database()
        print("Database schema initialized successfully!")
        return True
        
    except Exception as e:
        print(f"Error initializing schema: {e}")
        return False

def create_admin_user():
    """Create initial admin user"""
    try:
        from backend.models.user import User
        
        # Check if admin user already exists
        admin_user = User.get_by_registration_number('ADMIN001')
        if admin_user:
            print("Admin user already exists.")
            return True
        
        print("Creating admin user...")
        admin = User.create(
            registration_number='ADMIN001',
            password='admin123',  # Change this in production!
            first_name='System',
            last_name='Administrator',
            email='admin@flowrack.local',
            phone='+1-555-0100',
            role='admin',
            department='Administration'
        )
        
        if admin:
            print("Admin user created successfully!")
            print("Login credentials:")
            print("  Registration Number: ADMIN001")
            print("  Password: admin123")
            print("  ** PLEASE CHANGE THE PASSWORD AFTER FIRST LOGIN **")
            return True
        else:
            print("Failed to create admin user.")
            return False
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        return False

def create_sample_data():
    """Create sample data for testing"""
    try:
        from backend.models.user import User
        from backend.models.product import Product
        
        print("Creating sample data...")
        
        # Create sample users
        sample_users = [
            {
                'registration_number': 'OPR001',
                'password': 'operator123',
                'first_name': 'John',
                'last_name': 'Operator',
                'email': 'operator@flowrack.local',
                'phone': '+1-555-0200',
                'role': 'operator',
                'department': 'Warehouse Operations'
            },
            {
                'registration_number': 'USR001',
                'password': 'user123',
                'first_name': 'Alice',
                'last_name': 'Johnson',
                'email': 'alice.johnson@example.com',
                'phone': '+1-555-0301',
                'role': 'user',
                'department': 'Engineering'
            },
            {
                'registration_number': 'USR002',
                'password': 'user123',
                'first_name': 'Bob',
                'last_name': 'Smith',
                'email': 'bob.smith@example.com',
                'phone': '+1-555-0302',
                'role': 'user',
                'department': 'Research'
            }
        ]
        
        for user_data in sample_users:
            # Check if user already exists
            existing_user = User.get_by_registration_number(user_data['registration_number'])
            if not existing_user:
                user = User.create(**user_data)
                if user:
                    print(f"  Created user: {user_data['registration_number']} ({user_data['first_name']} {user_data['last_name']})")
        
        # Create sample products
        sample_products = [
            {
                'name': 'Safety Helmets',
                'description': 'White safety helmets for construction work',
                'category': 'Safety Equipment',
                'unit_of_measure': 'pcs',
                'stock_quantity': 50,
                'minimum_stock': 10,
                'unit_price': 25.99,
                'location': 'A-01-001'
            },
            {
                'name': 'Steel Pipes (2-inch)',
                'description': '2-inch diameter steel pipes for construction',
                'category': 'Construction Materials',
                'unit_of_measure': 'meters',
                'stock_quantity': 100,
                'minimum_stock': 20,
                'unit_price': 15.50,
                'location': 'B-02-003'
            },
            {
                'name': 'Power Drill',
                'description': 'Cordless power drill with battery pack',
                'category': 'Tools',
                'unit_of_measure': 'pcs',
                'stock_quantity': 15,
                'minimum_stock': 3,
                'unit_price': 89.99,
                'location': 'C-01-005'
            },
            {
                'name': 'Safety Gloves',
                'description': 'Cut-resistant work gloves',
                'category': 'Safety Equipment',
                'unit_of_measure': 'pairs',
                'stock_quantity': 80,
                'minimum_stock': 15,
                'unit_price': 12.99,
                'location': 'A-01-002'
            },
            {
                'name': 'Measuring Tape',
                'description': '25-meter measuring tape',
                'category': 'Tools',
                'unit_of_measure': 'pcs',
                'stock_quantity': 25,
                'minimum_stock': 5,
                'unit_price': 19.99,
                'location': 'C-01-001'
            },
            {
                'name': 'Concrete Mix',
                'description': 'Ready-to-use concrete mix',
                'category': 'Construction Materials',
                'unit_of_measure': 'kg',
                'stock_quantity': 500,
                'minimum_stock': 100,
                'unit_price': 8.50,
                'location': 'B-01-001'
            },
            {
                'name': 'Wire Cables',
                'description': 'Electrical wire cables 12 AWG',
                'category': 'Electrical',
                'unit_of_measure': 'meters',
                'stock_quantity': 200,
                'minimum_stock': 50,
                'unit_price': 2.25,
                'location': 'D-01-001'
            }
        ]
        
        for product_data in sample_products:
            product = Product.create(**product_data)
            if product:
                print(f"  Created product: {product_data['name']}")
        
        print("Sample data created successfully!")
        return True
        
    except Exception as e:
        print(f"Error creating sample data: {e}")
        return False

def main():
    """Main initialization function"""
    print("=" * 50)
    print("FlowRack Warehouse Management System")
    print("Database Initialization")
    print("=" * 50)
    
    # Step 1: Create database
    if not create_database():
        print("Failed to create database. Exiting.")
        return False
    
    # Step 2: Initialize schema
    if not init_schema():
        print("Failed to initialize schema. Exiting.")
        return False
    
    # Step 3: Create admin user
    if not create_admin_user():
        print("Failed to create admin user. Exiting.")
        return False
    
    # Step 4: Create sample data
    create_sample = input("\nDo you want to create sample data for testing? (y/N): ").lower().strip()
    if create_sample == 'y':
        create_sample_data()
    
    print("\n" + "=" * 50)
    print("Database initialization completed successfully!")
    print("=" * 50)
    print("\nYou can now start the FlowRack application:")
    print("  python -m backend.app")
    print("\nDefault login credentials:")
    print("  Admin - Registration: ADMIN001, Password: admin123")
    if create_sample == 'y':
        print("  Operator - Registration: OPR001, Password: operator123")
        print("  User - Registration: USR001, Password: user123")
    print("\n** Please change default passwords after first login **")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if not success:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\nInitialization cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)