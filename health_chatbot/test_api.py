import requests
import time

# The URL of your local FastAPI server
API_URL = "http://127.0.0.1:8000/api/chat"

def test_api_performance(message):
    payload = {"message": message}
    
    print(f"Sending API request for: '{message}'...")
    
    # 1. Start the timer before the network request
    start_time = time.time()
    
    # 2. Make the API Call
    response = requests.post(API_URL, json=payload)
    
    # 3. Stop the timer when the response arrives
    end_time = time.time()
    
    execution_time = end_time - start_time
    
    if response.status_code == 200:
        print(f"✅ Success! API Response: {response.json()['reply'].strip()}")
        print(f"⏱️ API Call Total Time: {execution_time:.5f} seconds\n")
    else:
        print(f"❌ Failed with status code: {response.status_code}")

# Run the tests
if __name__ == "__main__":
    # Test 1: Standard match
    test_api_performance("I have a headache")
    
    # Test 2: Long complex match
    test_api_performance("I am having a really bad stomach ache and feel very dizzy today")