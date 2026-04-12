import json
import urllib.request

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE2MDgyLCJpYXQiOjE3NzU5ODcyODIsImp0aSI6IjZkZTMwZDY0OGYwNTQ4NTk4OTAxZTY1MWVmODI0MGY0IiwidXNlcl9pZCI6IjEifQ.4lVZaAnxV13qxjlNbVtOerhdLduUcooX5PRoiQWpU1Q"

def test_endpoint(path):
    url = f"http://127.0.0.1:8000{path}"
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req) as response:
            print(f"{path} Status: {response.getcode()}")
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"{path} Error: {e}")
        return None

print("Testing /deliveries")
test_endpoint("/deliveries")
print("Testing /drivers")
test_endpoint("/drivers")
print("Testing /settings/warehouse")
test_endpoint("/settings/warehouse")
