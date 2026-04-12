import json
import urllib.request

url = "http://127.0.0.1:8000/auth/login"
data = json.dumps({
    "email": "admin@flower-distribution.local",
    "password": "admin@123"
}).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print(f"Status: {response.getcode()}")
        print(f"Data: {response.read().decode()}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
