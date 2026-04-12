import requests

url = "http://127.0.0.1:8000/auth/login"
data = {
    "email": "admin@flower-distribution.local",
    "password": "admin@123"
}
try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    print(f"Data: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
