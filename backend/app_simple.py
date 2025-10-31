"""
FlowRack Warehouse Management System
Main Flask Application Entry Point (without WebSocket)
"""

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app():
    """Application factory pattern"""
    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-this')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-change-this')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Tokens don't expire for demo
    
    # Initialize extensions
    CORS(app, origins=["http://localhost:5000", "http://127.0.0.1:5000"])
    jwt = JWTManager(app)
    
    # Register blueprints
    from backend.routes import auth, users, products, requests, debts, dashboard
    
    app.register_blueprint(auth.bp)
    app.register_blueprint(users.bp)
    app.register_blueprint(products.bp)
    app.register_blueprint(requests.bp)
    app.register_blueprint(debts.bp)
    app.register_blueprint(dashboard.bp)
    
    # Serve frontend
    @app.route('/')
    def index():
        return app.send_static_file('index.html')
    
    @app.route('/manifest.json')
    def manifest():
        return app.send_static_file('manifest.json')
    
    @app.route('/sw.js')
    def service_worker():
        return app.send_static_file('sw.js')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    print("=" * 50)
    print("FlowRack Warehouse Management System")
    print("=" * 50)
    print("Starting application...")
    print(f"Access the application at: http://localhost:5000")
    print("=" * 50)
    
    # Run the application
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )