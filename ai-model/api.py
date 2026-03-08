from flask import Flask, request, jsonify
import joblib
import json
import numpy as np
import os

app = Flask(__name__)

try:
    from flask_cors import CORS
    CORS(app)
except ImportError:
    # CORS is optional for local server-to-server calls.
    print("[WARN] flask_cors not installed. Continuing without CORS middleware.")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load model
model = joblib.load(os.path.join(BASE_DIR, "model.pkl"))
le = joblib.load(os.path.join(BASE_DIR, "label_encoder.pkl"))
with open(os.path.join(BASE_DIR, "features.json"), encoding="utf-8") as f:
    features = json.load(f)

# Load descriptions and precautions if available
descriptions = {}
precautions = {}
try:
    with open(os.path.join(BASE_DIR, "disease_descriptions.json"), encoding="utf-8") as f:
        descriptions = json.load(f)
except: pass
try:
    with open(os.path.join(BASE_DIR, "disease_precautions.json"), encoding="utf-8") as f:
        precautions = json.load(f)
except: pass

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    symptoms = data.get("symptoms", [])

    # Create feature vector
    vector = np.zeros(len(features))
    matched = []
    for symptom in symptoms:
        symptom_clean = symptom.lower().strip().replace(" ", "_")
        if symptom_clean in features:
            idx = features.index(symptom_clean)
            vector[idx] = 1
            matched.append(symptom_clean)

    if len(matched) == 0:
        return jsonify({
            "predictions": [],
            "symptoms_matched": 0,
            "total_symptoms": len(symptoms),
            "message": "No matching symptoms found. Try using terms like: headache, fever, cough, fatigue, etc."
        })

    # Predict with probabilities
    proba = model.predict_proba([vector])[0]
    top_indices = proba.argsort()[-5:][::-1]

    predictions = []
    for idx in top_indices:
        if proba[idx] > 0.01:
            disease = le.inverse_transform([idx])[0]
            predictions.append({
                "disease": disease,
                "confidence": round(float(proba[idx]) * 100, 1),
                "description": descriptions.get(disease, ""),
                "precautions": precautions.get(disease, [])
            })

    return jsonify({
        "predictions": predictions,
        "symptoms_matched": len(matched),
        "total_symptoms": len(symptoms),
        "matched_symptoms": [s.replace("_", " ").title() for s in matched]
    })

@app.route("/symptoms", methods=["GET"])
def get_symptoms():
    return jsonify({
        "symptoms": [f.replace("_", " ").title() for f in features],
        "count": len(features)
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": "RandomForest",
        "diseases": len(le.classes_),
        "symptoms": len(features)
    })

if __name__ == "__main__":
    print(f"[AI] Model API running with {len(le.classes_)} diseases, {len(features)} symptoms")
    app.run(host="127.0.0.1", port=5001, debug=False)
