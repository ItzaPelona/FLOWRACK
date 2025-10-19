"""
FlowRack Warehouse Management System
Main Flask Application Entry Point
"""

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__, 
           static_folder='../frontend',
           static_url_path='')

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 86400))
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))

# Initialize extensions
cors = CORS(app, origins=os.getenv('CORS_ORIGINS', '*').split(','))
socketio = SocketIO(app, cors_allowed_origins=os.getenv('SOCKET_IO_CORS_ALLOWED_ORIGINS', '*'))
jwt = JWTManager(app)

# Import and register blueprints
from backend.routes.auth import auth_bp
from backend.routes.users import users_bp
from backend.routes.products import products_bp
from backend.routes.requests import requests_bp
from backend.routes.debts import debts_bp
from backend.routes.dashboard import dashboard_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(products_bp, url_prefix='/api/products')
app.register_blueprint(requests_bp, url_prefix='/api/requests')
app.register_blueprint(debts_bp, url_prefix='/api/debts')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

# Import WebSocket events
from backend.websocket import events

# Root route - serve the PWA
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Serve PWA files
@app.route('/manifest.json')
def manifest():
    return app.send_static_file('manifest.json')

@app.route('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return {'error': 'Resource not found'}, 404

@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500

if __name__ == '__main__':
    # Development server
    socketio.run(app, 
                host='0.0.0.0', 
                port=int(os.getenv('PORT', 5000)), 
                debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')