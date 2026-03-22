import requests
import time
import concurrent.futures

API_URL = "http://127.0.0.1:8000/api/chat"
NUM_REQUESTS = 10

def send_request(request_id):
    """This function acts as a single user sending a message."""
    payload = {"message": f"I have a headache and need help (User {request_id})"}
    
    # Send the request and wait for the response
    response = requests.post(API_URL, json=payload)
    
    if response.status_code == 200:
        return f"User {request_id} finished!"
    return f"User {request_id} failed!"

if __name__ == "__main__":
    print(f"🚀 Firing {NUM_REQUESTS} concurrent requests to the API...")
    
    # Start the global timer
    start_time = time.time()
    
    # ThreadPoolExecutor runs our function multiple times simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_REQUESTS) as executor:
        # This triggers all 10 requests at the exact same time
        results = list(executor.map(send_request, range(1, NUM_REQUESTS + 1)))
        
    # Stop the global timer when ALL requests are done
    end_time = time.time()
    
    print("\n✅ All requests completed.")
    print(f"⏱️ TOTAL TIME FOR {NUM_REQUESTS} REQUESTS: {end_time - start_time:.5f} seconds")