# FlowRack - Warehouse Management System

A modern, hybrid warehouse management system built with vanilla technologies for simplicity and easy deployment on Hostinger. This system combines a Progressive Web App (PWA) with comprehensive inventory management, real-time tracking, and user request processing.

## Quick Start

### Prerequisites
- Python 3.8 or higher
- PostgreSQL 12 or higher
- Git (optional)

### Installation & Setup

1. **Clone or Download the Project**
   ```bash
   git clone https://github.com/ItzaPelona/FLOWRACK_LUS.git
   cd FLOWRACK
   ```

2. **Run the Startup Script**
   
   **On Windows:**
   ```cmd
   start.bat
   ```
   
   **On Linux/macOS:**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   
   The startup script will:
   - Check Python installation
   - Create virtual environment
   - Install dependencies
   - Set up environment variables
   - Initialize the database (optional)
   - Start the application

3. **Access the Application**
   - Open your browser and go to: `http://localhost:5000`
   - Use default credentials: `ADMIN001` / `admin123`
   - **!!!! Change default passwords immediately after first login**

## Architecture

### Technology Stack
- **Backend**: Flask 2.3.3 with WebSocket support
- **Frontend**: HTML5, CSS3, Bootstrap 5, Vanilla JavaScript
- **Database**: PostgreSQL with normalized schema
- **PWA**: Service Workers, Web App Manifest
- **Real-time**: WebSocket integration for live updates
- **Authentication**: JWT tokens with role-based access

### System Components

```
FLOWRACK/
├── backend/                 # Flask API server
│   ├── models/             # Database models
│   ├── routes/             # API endpoints
│   ├── database/           # Database utilities
│   └── utils/              # Helper functions
├── frontend/               # PWA client application
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   └── assets/            # Images and icons
└── docs/                  # Documentation
```

## Features

### Core Functionality
- **User Management**: Role-based access (Admin, Operator, User)
- **Product Inventory**: Stock tracking with real-time updates
- **Request Processing**: User requests with approval workflow
- **Debt Management**: Customer credit and payment tracking
- **Dashboard**: Real-time analytics and KPIs
- **PWA Support**: Offline functionality and mobile app-like experience

### User Roles
1. **Admin**: Full system access and user management
2. **Operator**: Warehouse operations and request processing
3. **User**: Submit requests and view personal history

### Real-time Features
- Live inventory updates
- Request status notifications
- Dashboard metrics refresh
- Multi-user collaboration

## Configuration

### Environment Variables (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flowrack_db
DB_USER=your_username
DB_PASSWORD=your_password

# Application Settings
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
FLASK_ENV=development

# Optional: External APIs
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Database Setup
The system uses PostgreSQL with a normalized schema including:
- Users with role-based permissions
- Products with inventory tracking
- Requests with workflow states
- Debt management system
- Audit trails and transactions

## Deployment

### Hostinger Deployment
1. Upload files to your hosting directory
2. Create PostgreSQL database in cPanel
3. Update `.env` with production settings
4. Install Python dependencies
5. Configure domain and SSL

See `DEPLOYMENT.md` for detailed deployment instructions.

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
python backend/database/init_db.py

# Start development server
python -m backend.app
```

## Progressive Web App

### PWA Features
- **Offline Support**: Works without internet connection
- **Installable**: Add to home screen on mobile devices
- **Responsive**: Optimized for all screen sizes
- **Fast Loading**: Service worker caching strategies
- **Push Notifications**: Real-time updates (when supported)

### Mobile Experience
The PWA provides a native app-like experience:
- App-like navigation and UI
- Offline data persistence
- Background sync capabilities
- Device integration features

## Security Features

### Authentication & Authorization
- JWT token-based authentication
- Role-based access control
- Password hashing with bcrypt
- Session management
- CSRF protection

### Data Security
- SQL injection prevention
- XSS protection
- Secure headers
- Input validation
- Audit logging

## Testing

### Manual Testing
1. Start the application using the startup script
2. Test different user roles and permissions
3. Verify real-time updates with multiple browser windows
4. Test PWA features (offline mode, installation)
5. Check mobile responsiveness

### API Testing
Use tools like Postman or curl to test API endpoints:
```bash
# Login and get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "ADMIN001", "password": "admin123"}'

# Use token for authenticated requests
curl -X GET http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Default Data

The system includes sample data for testing:
- **Admin User**: ADMIN001 / admin123
- **Operator User**: OP001 / operator123  
- **Regular User**: USER001 / user123
- **Sample Products**: Various warehouse items with stock levels
- **Sample Requests**: Different request states for testing

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify credentials in `.env` file
   - Ensure database exists

2. **Port Already in Use**
   - Change port in `backend/app.py`
   - Kill existing Flask processes

3. **Dependencies Not Found**
   - Ensure virtual environment is activated
   - Run `pip install -r requirements.txt`

4. **PWA Not Installing**
   - Check HTTPS (required for PWA)
   - Verify manifest.json is accessible
   - Check service worker registration

### Logs and Debugging
- Check Flask console output for errors
- Enable debug mode in development
- Check browser console for frontend issues
- Monitor network tab for API calls

## Roadmap

### Future Enhancements
- [ ] Barcode scanning integration
- [ ] Advanced reporting and analytics
- [ ] Email notifications
- [ ] Multi-warehouse support
- [ ] API integrations (ERP systems)
- [ ] Mobile app (React Native/Flutter)
- [ ] Advanced inventory forecasting
- [ ] Supplier management module

## Support

### Documentation
- `DEPLOYMENT.md`: Detailed deployment guide
- `database/schema.sql`: Database structure
- `docs/`: Additional documentation

### Getting Help
- Check the troubleshooting section
- Review Flask and PostgreSQL documentation
- Test with sample data first
- Verify environment configuration

---

**FlowRack** - Simplifying warehouse management with modern web technologies.

*Built with ❤️ :3 using vanilla technologies for maximum compatibility and ease of deployment.*

## Table of Contents
- [Overview](#overview)
- [Technologies](#technologies)
- [Architecture](#architecture)
- [Features](#features)
- [Setup](#setup)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)

## Overview

FlowRack is a comprehensive warehouse management system that combines a Progressive Web App (PWA) frontend with a Flask backend and PostgreSQL database. The system is designed to streamline material requests, inventory tracking, and debt management for both users and warehouse operators.

## Technologies

- **Backend**: Flask (Python) with Flask-SocketIO for real-time updates
- **Frontend**: HTML5, CSS3/Bootstrap 5, Vanilla JavaScript
- **Database**: PostgreSQL
- **PWA Features**: Service Workers, Web App Manifest
- **Real-time**: WebSocket integration
- **Authentication**: JWT tokens with bcrypt password hashing

## Architecture

The system follows a three-tier architecture:

1. **Presentation Layer**: PWA Frontend (HTML/CSS/JS)
2. **Business Logic Layer**: Flask REST API
3. **Data Access Layer**: PostgreSQL Database

## Features

### User Module
- Secure authentication with registration number and password
- Cart-like request system for materials
- Request tracking and history
- Debt management and viewing
- Real-time notifications

### Warehouse Operator Module
- Delivery management sorted by date/time
- Real-time material tracking with weight recording
- Debt creation and management
- Admin controls for products and users
- Dashboard with analytics

### System Features
- Progressive Web App capabilities
- Offline functionality
- Real-time updates via WebSocket
- Responsive design for all devices
- Material weighing integration

## Setup

### Prerequisites
- Python 3.8+
- PostgreSQL 12+
- Node.js (optional, for additional tooling)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/flowrack.git
cd flowrack
```

2. Set up Python virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Set up PostgreSQL database:
```bash
psql -U postgres
CREATE DATABASE flowrack;
CREATE USER flowrack_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE flowrack TO flowrack_user;
```

5. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

6. Initialize database:
```bash
python -m backend.database.init_db
```

7. Run the application:
```bash
python -m backend.app
```

## Deployment on Hostinger

### Prerequisites
- Hostinger hosting plan with Python support
- PostgreSQL database access

### Deployment Steps

1. **Upload Files**:
   - Upload all project files via File Manager or FTP
   - Ensure proper file permissions (755 for directories, 644 for files)

2. **Database Setup**:
   - Create PostgreSQL database in Hostinger control panel
   - Import database schema from `database/schema.sql`

3. **Environment Configuration**:
   - Update `.env` file with production database credentials
   - Set `FLASK_ENV=production`

4. **Python Environment**:
   ```bash
   # Install dependencies on server
   pip install -r requirements.txt
   ```

5. **Configure Web Server**:
   - Create `.htaccess` file for URL routing
   - Set up WSGI application entry point

6. **SSL Certificate**:
   - Enable SSL through Hostinger control panel
   - Update all HTTP references to HTTPS

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### User Endpoints
- `GET /api/user/profile` - Get user profile
- `GET /api/user/requests` - Get user request history
- `GET /api/user/debts` - Get user debts

### Request Endpoints
- `POST /api/requests` - Create new request
- `GET /api/requests` - Get all requests
- `PUT /api/requests/:id` - Update request status

### Inventory Endpoints
- `GET /api/inventory` - Get all products
- `POST /api/inventory` - Add new product (admin)
- `PUT /api/inventory/:id` - Update product (admin)

### WebSocket Events
- `request_created` - New request notification
- `delivery_updated` - Delivery status update
- `debt_created` - New debt notification

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- SQL injection prevention with parameterized queries
- XSS protection with input sanitization
- CSRF protection
- Rate limiting on API endpoints

## Testing

Run tests with:
```bash
python -m pytest tests/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support


For support and questions, please open an issue on GitHub or contact the development team.

