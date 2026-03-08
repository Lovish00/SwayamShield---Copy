import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib
import json
import os

print("[+] Loading dataset...")
df = pd.read_csv("data/dataset.csv")
print(f"   Rows: {len(df)}, Columns: {list(df.columns)[:5]}...")

# This dataset has columns: Disease, Symptom_1, Symptom_2, ... Symptom_17
# We need to convert to one-hot encoding (binary columns per unique symptom)

symptom_cols = [c for c in df.columns if c.startswith("Symptom")]

# Collect all unique symptoms
all_symptoms = set()
for col in symptom_cols:
    symptoms = df[col].dropna().str.strip().str.lower().str.replace(" ", "_")
    all_symptoms.update(symptoms[symptoms != ""])

all_symptoms = sorted(list(all_symptoms))
print(f"   Found {len(all_symptoms)} unique symptoms")

# Create binary feature matrix
print("[+] Creating feature matrix...")
feature_matrix = np.zeros((len(df), len(all_symptoms)), dtype=int)

for i, row in df.iterrows():
    for col in symptom_cols:
        symptom = row[col]
        if pd.notna(symptom):
            clean = str(symptom).strip().lower().replace(" ", "_")
            if clean in all_symptoms:
                feature_matrix[i, all_symptoms.index(clean)] = 1

X = pd.DataFrame(feature_matrix, columns=all_symptoms)
y = df.iloc[:, 0]  # First column = Disease/prognosis

# Encode labels
le = LabelEncoder()
y_encoded = le.fit_transform(y)
print(f"   Diseases: {len(le.classes_)}")

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42
)

# Train
print("[+] Training Random Forest model...")
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=20,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\n[OK] Accuracy: {accuracy:.2%}")
print(classification_report(y_test, y_pred, target_names=le.classes_))

# Save model + encoder + feature names
joblib.dump(model, "model.pkl")
joblib.dump(le, "label_encoder.pkl")

with open("features.json", "w") as f:
    json.dump(all_symptoms, f)

# Also save disease descriptions and precautions if available
try:
    desc_df = pd.read_csv("data/symptom_Description.csv")
    desc_dict = dict(zip(desc_df.iloc[:,0].str.strip(), desc_df.iloc[:,1].str.strip()))
    with open("disease_descriptions.json", "w") as f:
        json.dump(desc_dict, f, indent=2)
    print(f"[OK] Saved {len(desc_dict)} disease descriptions")
except Exception as e:
    print(f"[WARN] Could not load descriptions: {e}")

try:
    prec_df = pd.read_csv("data/symptom_precaution.csv")
    prec_dict = {}
    for _, row in prec_df.iterrows():
        disease = str(row.iloc[0]).strip()
        precautions = [str(row.iloc[i]).strip() for i in range(1, len(row)) if pd.notna(row.iloc[i])]
        prec_dict[disease] = precautions
    with open("disease_precautions.json", "w") as f:
        json.dump(prec_dict, f, indent=2)
    print(f"[OK] Saved {len(prec_dict)} disease precautions")
except Exception as e:
    print(f"[WARN] Could not load precautions: {e}")

print(f"\n[DONE] All done! Model accuracy: {accuracy:.2%}")
print("   Files created: model.pkl, label_encoder.pkl, features.json")
