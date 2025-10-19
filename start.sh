#!/bin/bash
# FlowRack Startup Script for Unix/Linux systems

echo "================================================"
echo "FlowRack Warehouse Management System"
echo "Startup Script"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.8"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    print_error "Python version $PYTHON_VERSION is too old. Required: $REQUIRED_VERSION or higher."
    exit 1
fi

print_status "Python version: $PYTHON_VERSION ✓"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating..."
    python3 -m venv venv
    if [ $? -eq 0 ]; then
        print_status "Virtual environment created successfully"
    else
        print_error "Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Check if requirements are installed
if [ ! -f "venv/lib/python*/site-packages/flask/__init__.py" ]; then
    print_status "Installing Python dependencies..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    print_status "Dependencies installed successfully"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.example .env
    print_warning "Please edit .env file with your database credentials before running the application"
    print_status "Opening .env file for editing..."
    ${EDITOR:-nano} .env
fi

# Check if PostgreSQL is accessible
print_status "Checking database connection..."
if command -v psql &> /dev/null; then
    # Load environment variables
    source .env 2>/dev/null || true
    
    if [ ! -z "$DB_HOST" ] && [ ! -z "$DB_NAME" ] && [ ! -z "$DB_USER" ]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null
        if [ $? -eq 0 ]; then
            print_status "Database connection successful ✓"
        else
            print_warning "Could not connect to database. Please check your .env configuration."
        fi
    fi
else
    print_warning "PostgreSQL client not found. Cannot verify database connection."
fi

# Ask if user wants to initialize database
echo
read -p "Do you want to initialize the database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Initializing database..."
    python backend/database/init_db.py
    if [ $? -eq 0 ]; then
        print_status "Database initialized successfully"
    else
        print_error "Database initialization failed"
        exit 1
    fi
fi

# Start the application
echo
print_status "Starting FlowRack application..."
echo
print_status "The application will be available at: http://localhost:5000"
print_status "Press Ctrl+C to stop the application"
echo
print_status "Default login credentials:"
print_status "  Admin: ADMIN001 / admin123"
print_status "  ** Please change default passwords after first login **"
echo

# Start the Flask application
python -m backend.app

print_status "Application stopped."