# server.py - Application entrypoint
# Adds backend/ to Python's module search path so all internal
# imports (config, routes, services, agents, tools) resolve correctly.
import sys
import os

# Make backend/ importable as if it were the package root
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

from config import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)