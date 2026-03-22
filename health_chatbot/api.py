from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import logging
import time      # <--- ADDED for I/O testing
import asyncio   # <--- ADDED for Concurrency fix

# Import your existing bot class and variables
from med_bot_tree import UniversalBot, DATA_FILE, EXPECTED_CSV_HASH

app = FastAPI()
bot = UniversalBot()
#RATE LIMITING
USER_LAST_REQUEST = {}
RATE_LIMIT_COOLDOWN = 1.0
# Define the expected JSON body format
class ChatRequest(BaseModel):
    message: str

# Run startup tasks (loading the CSV) when the API starts
@app.on_event("startup")
def startup_event():
    print("\n   [⏳ API Server starting up... Loading database]")
    
    start_load = time.time() # START I/O TIMER
    
    # Make sure EXPECTED_CSV_HASH in med_bot_tree.py is actually updated!
    bot.load_data(DATA_FILE)
    
    end_load = time.time()   # STOP I/O TIMER
    print(f"   [⏱️ PERFORMANCE MONITOR] Database load took: {end_load - start_load:.5f} seconds\n")
    
    if not bot.disease_db:
        logging.error("Failed to load disease database on startup.")
        raise RuntimeError("CRITICAL: Database empty or failed to load.")

# Create the POST endpoint
@app.post("/api/chat")
async def chat_endpoint(request: Request, body: ChatRequest): # <-- Add Request and change to 'body'
    client_ip = request.client.host
    current_time = time.time()
    
    # --- MITIGATION #7: Rate Limiting Check ---
    if client_ip in USER_LAST_REQUEST:
        time_since_last = current_time - USER_LAST_REQUEST[client_ip]
        if time_since_last < RATE_LIMIT_COOLDOWN:
            logging.warning(f"Rate limit triggered by IP: {client_ip}")
            raise HTTPException(
                status_code=429, 
                detail="Too many requests. Please wait 1 second between messages."
            )
            
    # Update the user's last request timestamp
    USER_LAST_REQUEST[client_ip] = current_time

    user_input = body.message # <-- Read from 'body' instead of 'request'
    
    # Ported Mitigation #1: Input Length Limit (Increased for Grounding Context)
    if len(user_input) > 5000:
        raise HTTPException(status_code=400, detail="Input too long (max 5000 chars).")
    
    # Run the heavy bot logic in a background thread!
    response_text = await asyncio.to_thread(bot.get_response, user_input)
    
    return {"reply": response_text}