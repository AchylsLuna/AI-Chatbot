import argparse
import csv
import random
from collections import defaultdict

from med_bot_tree import UniversalBot


def load_rows(csv_path):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            return rows
        for row in reader:
            if not row:
                continue
            disease = (row[0] or "").strip()
            if not disease:
                continue
            symptoms = []
            for val in row[1:]:
                if val and val != "0":
                    clean_sym = str(val).strip().replace("_", " ").lower()
                    if clean_sym:
                        symptoms.append(clean_sym)
            if symptoms:
                rows.append((disease, symptoms))
    return rows


def build_db(rows):
    db = {}
    for disease, symptoms in rows:
        if disease in db:
            db[disease].update(symptoms)
        else:
            db[disease] = set(symptoms)
    return db


def split_rows(rows, test_ratio=0.2, seed=13):
    by_disease = defaultdict(list)
    for disease, symptoms in rows:
        by_disease[disease].append((disease, symptoms))

    rng = random.Random(seed)
    train, test = [], []
    for disease, items in by_disease.items():
        rng.shuffle(items)
        cut = max(1, int(len(items) * (1 - test_ratio)))
        train.extend(items[:cut])
        test.extend(items[cut:])
    return train, test


def build_user_input(symptoms):
    # Simple synthetic query: "i have <symptom1> and <symptom2> ..."
    return "i have " + " and ".join(symptoms)


def sample_symptoms(symptoms, rng, fraction=0.6, min_symptoms=2, max_symptoms=None):
    if not symptoms:
        return symptoms
    count = max(min_symptoms, int(round(len(symptoms) * fraction)))
    if max_symptoms is not None:
        count = min(count, max_symptoms)
    count = min(count, len(symptoms))
    return rng.sample(symptoms, count)


def score_all(bot, user_input):
    clean_text = bot.clean_regex.sub("", user_input.lower())
    scores = {}
    for disease, disease_symptoms in bot.disease_db.items():
        match_count = 0
        matched_symptoms = []
        for symptom in disease_symptoms:
            if symptom in clean_text:
                match_count += 1
                matched_symptoms.append(symptom)
                continue
            else:
                if bot.fuzz_token_set_ratio(symptom, clean_text) > 80:
                    match_count += 1
                    matched_symptoms.append(symptom)
        if match_count > 0:
            scores[disease] = {"score": match_count, "matches": list(set(matched_symptoms))}
    if not scores:
        return []
    return sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)


def main():
    parser = argparse.ArgumentParser(description="Evaluate Medica AI Chatbot accuracy.")
    parser.add_argument("--csv", default="data/symptoms_cleaned.csv", help="Path to symptoms CSV.")
    parser.add_argument("--test-ratio", type=float, default=0.2, help="Test split ratio.")
    parser.add_argument("--seed", type=int, default=13, help="Random seed.")
    parser.add_argument("--topk", type=int, default=3, help="Compute top-k accuracy.")
    parser.add_argument("--symptom-fraction", type=float, default=0.6, help="Fraction of symptoms used per query.")
    parser.add_argument("--min-symptoms", type=int, default=2, help="Minimum symptoms per query.")
    parser.add_argument("--max-symptoms", type=int, default=None, help="Maximum symptoms per query.")
    parser.add_argument("--trials-per-row", type=int, default=1, help="Queries sampled per test row.")
    args = parser.parse_args()

    rows = load_rows(args.csv)
    if not rows:
        print("No data rows found. Check the CSV path.")
        return

    train_rows, test_rows = split_rows(rows, test_ratio=args.test_ratio, seed=args.seed)
    bot = UniversalBot()

    # Avoid pandas in med_bot_tree.load_data by directly assigning the DB.
    bot.disease_db = build_db(train_rows)

    # Inject the fuzz ratio so score_all can call it without importing fuzzywuzzy globally.
    try:
        from fuzzywuzzy import fuzz  # Local import to avoid hard dependency if unused elsewhere
    except Exception:
        print("Missing dependency: fuzzywuzzy. Install it to run accuracy evaluation.")
        print("Example: pip install fuzzywuzzy python-Levenshtein")
        return

    bot.fuzz_token_set_ratio = fuzz.token_set_ratio

    total = 0
    correct_top1 = 0
    correct_topk = 0
    no_prediction = 0
    rng = random.Random(args.seed)

    for disease, symptoms in test_rows:
        for _ in range(max(1, args.trials_per_row)):
            sampled = sample_symptoms(
                symptoms,
                rng,
                fraction=args.symptom_fraction,
                min_symptoms=args.min_symptoms,
                max_symptoms=args.max_symptoms,
            )
            user_input = build_user_input(sampled)
            ranked = score_all(bot, user_input)
            if not ranked:
                no_prediction += 1
                total += 1
                continue
            total += 1
            top1 = ranked[0][0]
            if top1 == disease:
                correct_top1 += 1
            topk = [d for d, _ in ranked[: max(1, args.topk)]]
            if disease in topk:
                correct_topk += 1

    denom = total if total else 1
    print(f"Total test queries: {total}")
    print(f"No prediction: {no_prediction} ({no_prediction/denom:.2%})")
    print(f"Top-1 accuracy: {correct_top1/denom:.2%}")
    print(f"Top-{max(1, args.topk)} accuracy: {correct_topk/denom:.2%}")


if __name__ == "__main__":
    main()
