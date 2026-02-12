#!/usr/bin/env python3
"""
FridgeTracker API Server
Simple JSON storage with CORS support
"""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DATA_FILE = "/root/clawd/apps/fridge-app/data/fridge_data.json"

# Ensure data file exists
if not os.path.exists(DATA_FILE):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump({
            "lastUpdated": None,
            "salvo": {"fridge": [], "pantry": []},
            "elisa": {"fridge": [], "pantry": []}
        }, f)

class FridgeHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/fridge' or self.path == '/fridge/':
            try:
                with open(DATA_FILE, 'r') as f:
                    data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            except Exception as e:
                self.send_response(500)
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()
    
    def do_PUT(self):
        if self.path == '/fridge' or self.path == '/fridge/':
            try:
                content_length = int(self.headers['Content-Length'])
                body = self.rfile.read(content_length)
                data = json.loads(body.decode())
                
                # Save to file
                with open(DATA_FILE, 'w') as f:
                    json.dump(data, f, indent=2)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "saved"}).encode())
            except Exception as e:
                self.send_response(500)
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()
    
    def log_message(self, format, *args):
        pass  # Suppress logging

def run_server(port=8081):
    server = HTTPServer(('0.0.0.0', port), FridgeHandler)
    print(f"FridgeTracker API running on port {port}")
    server.serve_forever()

if __name__ == '__main__':
    run_server()
