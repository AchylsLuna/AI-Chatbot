import pandas as pd
import re
from nltk.stem import WordNetLemmatizer
from nltk.corpus import stopwords
import nltk
from fuzzywuzzy import fuzz
from functools import lru_cache
import logging
import hashlib
import time
import os
import json
# --- CONFIGURATION ---
DATA_FILE = "data/symptoms_cleaned.csv"

# [MITIGATION #5] Data Integrity: The expected SHA-256 hash of your valid CSV file.
# Run the 'calculate_hash' function below once to get this value for your specific file.
EXPECTED_CSV_HASH = "c8bd2286637fb9373a5d63452515a8040dce1733d83e7a836ffd8d99a8d261b5" 
EXPECTED_JSON_HASH = "b5b54bd024f2c09f6445fd97f2fd96e265be714920ab09a5cae9b8bf7e07c39e"

# [MITIGATION #3] Liability Disclaimer
DISCLAIMER = "DISCLAIMER: This is NOT medical advice. In emergencies, call 911.\n"

# [MITIGATION #2] Secure Logging: Errors go to file, not console.
logging.basicConfig(
    filename='bot_errors.log', 
    level=logging.ERROR, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# --- NLP SETUP ---
nltk.download('wordnet', quiet=True)
nltk.download('stopwords', quiet=True)
lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))

DEPARTMENT_MAP = {
    "Hypertension": "Cardiology", "Heart attack": "Cardiology (EMERGENCY)",
    "Paralysis (brain hemorrhage)": "Neurology (EMERGENCY)", "AIDS": "Infectious Disease",
    "Diabetes": "Endocrinology", "Migraine": "Neurology", "Hypoglycemia": "Endocrinology",
    "Jaundice": "Gastroenterology", "Malaria": "Infectious Disease", "Chicken pox": "Infectious Disease",
    "Dengue": "Infectious Disease", "Typhoid": "Infectious Disease", "Fungal infection": "Dermatology",
    "Acne": "Dermatology", "Psoriasis": "Dermatology", "Drug Reaction": "Dermatology",
    "Common Cold": "General Medicine", "Pneumonia": "Pulmonology", "Arthritis": "Orthopedics",
    "Gastroenteritis": "Gastroenterology", "Bronchial Asthma": "Pulmonology", "Tuberculosis": "Pulmonology"
}

class UniversalBot:
    def __init__(self):
        self.disease_db = {} 
        self.clean_regex = re.compile(r'[^a-z\s]')

    def verify_integrity(self, file_path, expected_hash):
        """[MITIGATION #5] Calculates file hash to ensure no tampering."""
        try:
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            
            calculated = sha256_hash.hexdigest()
            
            # Helper for first-time setup
            if expected_hash == "REPLACE_WITH_ACTUAL_HASH_AFTER_FIRST_RUN":
                print(f"ℹ️ SETUP INFO: Your file hash is: {calculated}")
                print("   -> Copy this into EXPECTED_CSV_HASH in the code configuration.")
                return True # Allow pass for setup

            return calculated == expected_hash
        except Exception as e:
            logging.error(f"Integrity Check Error: {e}")
            return False

    def load_data(self, csv_path):
            cache_file = "data/db_cache.json"
            
            # 1. Attempt to load securely from cache
            if os.path.exists(cache_file):
                # Check the hash of the JSON file before trusting it!
                if self.verify_integrity(cache_file, EXPECTED_JSON_HASH):
                    try:
                        with open(cache_file, "r") as f:
                            loaded_db = json.load(f)
                            self.disease_db = {k: set(v) for k, v in loaded_db.items()}
                        return # DONE in milliseconds!
                    except json.JSONDecodeError:
                        print("⚠️ Cache file corrupted. Rebuilding from CSV...")
                else:
                    print("❌ Security Alert: JSON Cache tampered or hash mismatch!")
                    print("   -> Deleting poisoned cache and rebuilding from secure CSV...")
                    os.remove(cache_file) # Destroy the tampered file

            # 2. Integrity Check for CSV
            if not self.verify_integrity(csv_path, EXPECTED_CSV_HASH):
                logging.critical("Security Alert: CSV hash mismatch. File may be tampered.")
                print("❌ Security Error: Data integrity check failed.")
                return
                cache_file = "data/db_cache.json"
                
                # 1. Attempt to load from cache
                if os.path.exists(cache_file):
                    try:
                        with open(cache_file, "r") as f:
                            loaded_db = json.load(f)
                            # Convert the JSON lists back into Python sets
                            self.disease_db = {k: set(v) for k, v in loaded_db.items()}
                        return # DONE in milliseconds!
                    except json.JSONDecodeError:
                        print("⚠️ Cache file corrupted. Rebuilding from CSV...")
                        # If the file is broken, the script will naturally fall through and rebuild it

                # 2. Integrity Check
                if not self.verify_integrity(csv_path, EXPECTED_CSV_HASH):
                    logging.critical("Security Alert: CSV hash mismatch. File may be tampered.")
                    print("❌ Security Error: Data integrity check failed.")
                    return

                # 3. Secure Loading from CSV
                try:
                    df = pd.read_csv(csv_path)
                    for _, row in df.iterrows():
                        disease = str(row.iloc[0]).strip()
                        symptoms = set()
                        for val in row.iloc[1:]:
                            if pd.notna(val) and val != "0" and val != 0:
                                clean_sym = str(val).strip().replace("_", " ").lower()
                                symptoms.add(clean_sym)
                        
                        if disease in self.disease_db:
                            self.disease_db[disease].update(symptoms)
                        else:
                            self.disease_db[disease] = symptoms
                except Exception as e:
                    # [MITIGATION #2] Log full error, show generic message
                    logging.error(f"DB Load Failed: {e}")
                    print("❌ System Error: Unable to load database.")
                    return # Stop execution if the CSV failed to load
            
                # 4. Save the fast-cache for next time (FIXED: Converting sets to lists)
                try:
                    db_to_save = {k: list(v) for k, v in self.disease_db.items()}
                    with open(cache_file, "w") as f:
                        json.dump(db_to_save, f)
                except Exception as e:
                    logging.error(f"Failed to create cache file: {e}")
            
    @lru_cache(maxsize=1000)
    
    def score_diseases(self, user_input):
        # [MITIGATION #6] Input Sanitization (Whitelist only a-z)
        clean_text = self.clean_regex.sub('', user_input.lower())
        
        # Basic Synonym Mapping
        synonyms = {
                    # Breathing & Chest
                    "difficulty breathing": "breathlessness",
                    "shortness of breath": "breathlessness",
                    "cant breathe": "breathlessness",
                    "trouble breathing": "breathlessness",
                    "chest hurts": "chest pain",
                    "tight chest": "chest pain",
                    
                    # Fever & Temperature
                    "feverish": "high fever",
                    "burning up": "high fever",
                    "high temp": "high fever",
                    "feeling cold": "chills",
                    "freezing": "chills",

                    # Stomach & Digestion
                    "stomach ache": "abdominal pain",
                    "tummy ache": "abdominal pain",
                    "stomach cramps": "abdominal pain",
                    "gut pain": "abdominal pain",
                    "belly ache": "belly pain",
                    "throwing up": "vomiting",
                    "puking": "vomiting",
                    "barfing": "vomiting",
                    "queasy": "nausea",
                    "feel sick to my stomach": "nausea",
                    "loose stool": "diarrhoea",
                    "loose motions": "diarrhoea",
                    "the runs": "diarrhoea",
                    "cant poop": "constipation",
                    "not hungry": "loss of appetite",
                    "dont want to eat": "loss of appetite",
                    "heartburn": "acidity",
                    "acid reflux": "acidity",
                    "passing gas": "farting",

                    # Energy & Sleep
                    "tired": "fatigue",
                    "exhausted": "fatigue",
                    "drained": "fatigue",
                    "no energy": "fatigue",
                    "worn out": "fatigue",
                    "sluggish": "lethargy",
                    "sleepy": "lethargy",

                    # Pain (General)
                    "head hurts": "headache",
                    "pounding head": "headache",
                    "body ache": "muscle pain",
                    "muscles hurt": "muscle pain",
                    "joints hurt": "joint pain",
                    "aching joints": "joint pain",
                    "back hurts": "back pain",
                    "neck hurts": "neck pain",

                    # Skin & Appearance
                    "itchy": "itching",
                    "scratching": "itching",
                    "hives": "skin rash",
                    "red patches": "skin rash",
                    "breakout": "skin rash",
                    "pimples": "pus filled pimples",
                    "yellow skin": "yellowish skin",
                    "yellow eyes": "yellowing of eyes",

                    # Urination
                    "hurts to pee": "burning pee",
                    "pain when peeing": "burning pee",
                    "frequent urination": "peeing a lot",
                    "always peeing": "peeing a lot",
                    "dark pee": "dark urine",

                    # Neuro & Motor
                    "dizzy": "dizziness",
                    "lightheaded": "dizziness",
                    "room spinning": "spinning movements",
                    "cant balance": "loss of balance",
                    "faint": "dizziness",

                    # Cold/Flu/Allergy
                    "stuffy nose": "congestion",
                    "blocked nose": "congestion",
                    "snotty": "runny nose",
                    "sneezing a lot": "continuous sneezing",
                    "sore throat": "throat irritation"
                }
        for k, v in synonyms.items():
            clean_text = clean_text.replace(k, v)
            
        scores = {}
        for disease, disease_symptoms in self.disease_db.items():
            match_count = 0
            matched_symptoms = []
            for symptom in disease_symptoms:
                if symptom in clean_text:
                    match_count += 1
                    matched_symptoms.append(symptom)
                    continue # SKIP the expensive fuzzy matching if we already found it!
                else:
                    # Expensive Fuzzy Logic
                    if fuzz.token_set_ratio(symptom, clean_text) > 80 or fuzz.partial_ratio(symptom, clean_text) > 80:
                        match_count += 1
                        matched_symptoms.append(symptom)

            if match_count > 0:
                scores[disease] = {"score": match_count, "matches": list(set(matched_symptoms))}
        
        if not scores: return None
        return sorted(scores.items(), key=lambda x: x[1]['score'], reverse=True)[0]

    def get_response(self, user_input):
        # [MITIGATION #4] Inefficient Logic Flow - Check cheap filters FIRST
        
        # 1. Empty Check
        if not user_input or len(user_input.strip()) < 3:
            return "Please type your symptoms."

        user_words = set(user_input.lower().split())

        # 2. Greeting Check
        if any(w in user_words for w in ["hi", "hello", "help"]):
            return "Hello! I am Dr. Bot. Describe your symptoms."

        # 3. Gibberish Check (Stopwords) - bypassed to allow direct symptom lists
        # if not any(w in stop_words for w in user_words):
        #      return "I'm having trouble understanding. Please use standard English sentences."

        # 4. Expensive Scoring (Only runs if checks 1-3 pass)
        print("   [⏳ Running diagnostic algorithm...]")
        
        start = time.time()  # Start the stopwatch
        result = self.score_diseases(user_input)
        end = time.time()    # Stop the stopwatch
        
        execution_time = end - start
        print(f"\n   [⏱️ PERFORMANCE MONITOR] score_diseases() took: {execution_time:.5f} seconds\n")
        
        if not result:
            return "I cannot answer general questions. Please list physical symptoms."

        disease_name, details = result
        dept = DEPARTMENT_MAP.get(disease_name, "General Medicine")
        
        # [MITIGATION #3] Disclaimer is mandatory
        return f"""{DISCLAIMER}
Possible Condition: {disease_name}
Matched Symptoms: {", ".join(details['matches'])}
Recommended Department: {dept}
"""

if __name__ == "__main__":
    bot = UniversalBot()
    bot.load_data(DATA_FILE)
    
    if not bot.disease_db:
        print("⚠️ CRITICAL: Database empty or failed to load. Exiting.")
        exit()

    print("\n💬 Describe your symptoms: ")
    while True:
        try:
            u = input("\nYou: ")
            
            # [MITIGATION #1] Input Length Limit
            if len(u) > 250:
                print("Error: Input too long (max 250 chars).")
                continue

            if u.lower() in ["quit", "exit"]: break
            
            print(bot.get_response(u))
            
            # [MITIGATION #7] Rate Limiting
            time.sleep(1.0) 

        except KeyboardInterrupt:
            break