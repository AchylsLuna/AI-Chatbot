import pandas as pd
import re
from nltk.stem import WordNetLemmatizer
from nltk.corpus import stopwords
import nltk
from fuzzywuzzy import fuzz
import logging  # <--- NEW IMPORT

# --- CONFIGURATION ---
DATA_FILE = "data/symptoms_cleaned.csv"

# --- SECURITY LOGGING CONFIGURATION (MITIGATION) ---
# This ensures errors are saved to a file instead of shown to the user.
logging.basicConfig(
    filename='bot_errors.log', 
    level=logging.ERROR, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# --- DEPARTMENT MAPPING ---
DEPARTMENT_MAP = {
    "Hypertension": "Cardiology",
    "Heart attack": "Cardiology (EMERGENCY)",
    "Paralysis (brain hemorrhage)": "Neurology (EMERGENCY)",
    "AIDS": "Infectious Disease",
    "Diabetes": "Endocrinology",
    "Migraine": "Neurology",
    "Hypoglycemia": "Endocrinology",
    "Jaundice": "Gastroenterology",
    "Malaria": "Infectious Disease",
    "Chicken pox": "Infectious Disease",
    "Dengue": "Infectious Disease",
    "Typhoid": "Infectious Disease",
    "Fungal infection": "Dermatology",
    "Acne": "Dermatology",
    "Psoriasis": "Dermatology",
    "Drug Reaction": "Dermatology",
    "Common Cold": "General Medicine",
    "Pneumonia": "Pulmonology",
    "Arthritis": "Orthopedics",
    "Gastroenteritis": "Gastroenterology"
}

# --- NLP SETUP ---
nltk.download('wordnet', quiet=True)
nltk.download('stopwords', quiet=True)
lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))

class UniversalBot:
    def __init__(self):
        self.disease_db = {} 
        self.all_symptoms = set()

    def load_data(self, csv_path):
        try:
            df = pd.read_csv(csv_path)
            for index, row in df.iterrows():
                disease = str(row.iloc[0]).strip()
                symptoms = set()
                for val in row.iloc[1:]:
                    if pd.notna(val) and val != "0" and val != 0:
                        clean_sym = str(val).strip().replace("_", " ").lower()
                        symptoms.add(clean_sym)
                        self.all_symptoms.add(clean_sym)
                
                if disease in self.disease_db:
                    self.disease_db[disease].update(symptoms)
                else:
                    self.disease_db[disease] = symptoms
            
        except Exception as e:
            # --- MITIGATION: SECURE ERROR HANDLING ---
            # 1. Log the specific error internally (User cannot see this)
            logging.error(f"Failed to load CSV from path '{csv_path}'. Raw Error: {e}")
            
            # 2. Show a generic, safe message to the user
            print("❌ System Error: Unable to load medical database. Please contact the administrator.")

    def score_diseases(self, user_input):
        user_text = user_input.lower()
        user_text = re.sub(r'[^\w\s]', '', user_text)
        
        scores = {}
        
        for disease, disease_symptoms in self.disease_db.items():
            match_count = 0
            matched_symptoms = []
            
            for symptom in disease_symptoms:
                if symptom in user_text:
                    match_count += 1
                    matched_symptoms.append(symptom)
                else:
                    ratio = fuzz.token_set_ratio(symptom, user_text)
                    if ratio > 80:
                        match_count += 1
                        matched_symptoms.append(symptom)

            if match_count > 0:
                scores[disease] = {
                    "score": match_count, 
                    "matches": list(set(matched_symptoms))
                }
        
        if not scores:
            return None
        
        sorted_diseases = sorted(scores.items(), key=lambda x: x[1]['score'], reverse=True)
        return sorted_diseases[0]

    def get_response(self, user_input):
        # --- ERROR HANDLING LAYER ---
        
        # 1. Check for Empty Input
        if not user_input or len(user_input.strip()) < 3:
            return "I didn't catch that. Please type your symptoms."

        # 2. Check for Greetings (Small Talk)
        greetings = ["hi", "hello", "hey", "start", "help", "morning", "evening"]
        if any(word in user_input.lower() for word in greetings):
            return "Hello! I am Dr. Bot. Please describe your symptoms (e.g., 'headache', 'fever')."

        # 3. Check for Gibberish (The Stopword Trick)
        user_words = set(user_input.lower().split())
        has_common_word = any(w in stop_words for w in user_words)
        
        # Only check match if we are unsure
        result = self.score_diseases(user_input)
        
        if not result:
            # CASE A: Gibberish (No common words, no symptoms)
            if not has_common_word:
                return "I'm having trouble understanding. Please use standard English words for your symptoms."
            
            # CASE B: Irrelevant Topic
            return """
I understand your question, but I am a **Medical Chat Bot**. 
I cannot answer general questions like that.

Please ask me about:
- Physical symptoms (e.g., "headache", "rash")
- Conditions (e.g., "flu", "diabetes")
"""

        # --- SUCCESS LAYER ---
        disease_name = result[0]
        details = result[1]
        
        dept = DEPARTMENT_MAP.get(disease_name, "General Medicine")
        if dept == "General Medicine":
            if "Heart" in disease_name: dept = "Cardiology"
            elif "Osteo" in disease_name: dept = "Orthopedics"
            elif "Thyroid" in disease_name: dept = "Endocrinology" 
        
        return f"""
--------------------------------------------------
Possible Condition: **{disease_name}**
Matched Symptoms: {", ".join(details['matches'])}
Recommended Department: **{dept}**
--------------------------------------------------
"""

# --- RUN ---
if __name__ == "__main__":
    bot = UniversalBot()
    bot.load_data(DATA_FILE)
    if not bot.disease_db:
        print("The bot is not working. Please contact an administrator")
        exit()  # <--- This stops the script completely

    print("\n💬 Describe your symptoms: ")
    while True:
        try:
            u = input("\nYou: ")
            if u.lower() in ["quit", "exit"]: break
            print(bot.get_response(u))
        except KeyboardInterrupt:
            break