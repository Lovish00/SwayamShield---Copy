import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, symptomSchema, modelPredictSchema } from '../middleware/validate.js';
import { analyzeSymptoms } from '../services/gemini.js';
import { getModelSymptoms, predictWithModel, extractSymptomsFromText, getModelBaseUrl } from '../services/aiModel.js';

const router = Router();
router.use(authenticate);

const QUESTION_CATEGORIES = {
  general: {
    label: 'General Symptoms',
    description: 'Fever, fatigue, appetite, and whole-body symptoms.',
  },
  respiratory: {
    label: 'Respiratory',
    description: 'Cough, breathlessness, throat and sinus symptoms.',
  },
  digestive: {
    label: 'Digestive',
    description: 'Nausea, abdominal issues, bowel and digestion symptoms.',
  },
  neurological: {
    label: 'Neurological',
    description: 'Headache, dizziness, vision, speech, and balance symptoms.',
  },
  skin: {
    label: 'Skin',
    description: 'Rashes, itching, eruptions, and skin texture changes.',
  },
  orthopedic: {
    label: 'Orthopedic',
    description: 'Joint pain, muscle pain, stiffness, and movement issues.',
  },
  cardiac: {
    label: 'Cardiac',
    description: 'Chest discomfort, heart rhythm, circulation-related symptoms.',
  },
};

const QUESTION_BANK = {
  general: [
    { id: 'g_fever_high', question: 'Do you currently have high fever?', symptom: 'high fever' },
    { id: 'g_fever_mild', question: 'Do you have mild fever that keeps recurring?', symptom: 'mild fever' },
    { id: 'g_chills', question: 'Are you having chills or shivering?', symptom: 'chills' },
    { id: 'g_fatigue', question: 'Do you feel unusual fatigue?', symptom: 'fatigue' },
    { id: 'g_lethargy', question: 'Do you feel persistent lethargy or low activity?', symptom: 'lethargy' },
    { id: 'g_sweating', question: 'Are you sweating more than usual?', symptom: 'sweating' },
    { id: 'g_loss_appetite', question: 'Have you lost appetite recently?', symptom: 'loss of appetite' },
    { id: 'g_dehydration', question: 'Do you feel dehydrated frequently?', symptom: 'dehydration' },
    { id: 'g_weight_loss', question: 'Have you noticed unexplained weight loss?', symptom: 'weight loss' },
    { id: 'g_weight_gain', question: 'Have you noticed unusual weight gain?', symptom: 'weight gain' },
  ],
  respiratory: [
    { id: 'r_cough', question: 'Do you have cough?', symptom: 'cough' },
    { id: 'r_phlegm', question: 'Do you produce phlegm with cough?', symptom: 'phlegm', dependsOn: 'cough' },
    { id: 'r_breathless', question: 'Are you experiencing breathlessness?', symptom: 'breathlessness' },
    { id: 'r_chest_pain', question: 'Do you have chest pain while breathing or coughing?', symptom: 'chest pain' },
    { id: 'r_runny_nose', question: 'Do you have runny nose?', symptom: 'runny nose' },
    { id: 'r_congestion', question: 'Do you feel nasal or chest congestion?', symptom: 'congestion' },
    { id: 'r_throat_irritation', question: 'Do you have throat irritation?', symptom: 'throat irritation' },
    { id: 'r_sinus_pressure', question: 'Do you feel sinus pressure around your face?', symptom: 'sinus pressure' },
    { id: 'r_loss_smell', question: 'Have you reduced or lost your sense of smell?', symptom: 'loss of smell' },
  ],
  digestive: [
    { id: 'd_nausea', question: 'Are you feeling nausea?', symptom: 'nausea' },
    { id: 'd_vomiting', question: 'Have you vomited recently?', symptom: 'vomiting' },
    { id: 'd_abdominal_pain', question: 'Do you have abdominal pain?', symptom: 'abdominal pain' },
    { id: 'd_stomach_pain', question: 'Do you have stomach pain?', symptom: 'stomach pain' },
    { id: 'd_diarrhoea', question: 'Do you have loose motions or diarrhoea?', symptom: 'diarrhoea' },
    { id: 'd_constipation', question: 'Are you constipated?', symptom: 'constipation' },
    { id: 'd_acidity', question: 'Do you have acidity or heartburn?', symptom: 'acidity' },
    { id: 'd_indigestion', question: 'Do you feel indigestion after meals?', symptom: 'indigestion' },
    { id: 'd_distention_abdomen', question: 'Do you feel abdominal bloating or distention?', symptom: 'distention of abdomen' },
    { id: 'd_bloody_stool', question: 'Have you noticed blood in stool?', symptom: 'bloody stool' },
  ],
  neurological: [
    { id: 'n_headache', question: 'Are you having headache?', symptom: 'headache' },
    { id: 'n_dizziness', question: 'Do you feel dizzy?', symptom: 'dizziness' },
    { id: 'n_loss_balance', question: 'Do you lose balance while walking?', symptom: 'loss of balance' },
    { id: 'n_blurred_vision', question: 'Do you have blurred or distorted vision?', symptom: 'blurred and distorted vision' },
    { id: 'n_weakness_limbs', question: 'Do you feel weakness in limbs?', symptom: 'weakness in limbs' },
    { id: 'n_neck_pain', question: 'Do you have neck pain?', symptom: 'neck pain' },
    { id: 'n_slurred_speech', question: 'Do you have slurred speech?', symptom: 'slurred speech' },
    { id: 'n_spinning', question: 'Do you feel spinning movements (vertigo)?', symptom: 'spinning movements' },
    { id: 'n_lack_concentration', question: 'Do you have lack of concentration?', symptom: 'lack of concentration' },
    { id: 'n_unsteadiness', question: 'Do you feel unsteady while standing?', symptom: 'unsteadiness' },
  ],
  skin: [
    { id: 's_skin_rash', question: 'Do you have skin rash?', symptom: 'skin rash' },
    { id: 's_itching', question: 'Do you have itching?', symptom: 'itching' },
    { id: 's_nodal_eruptions', question: 'Do you have nodal skin eruptions?', symptom: 'nodal skin eruptions' },
    { id: 's_pus_pimples', question: 'Do you have pus-filled pimples?', symptom: 'pus filled pimples' },
    { id: 's_blackheads', question: 'Do you have blackheads?', symptom: 'blackheads' },
    { id: 's_blister', question: 'Do you have skin blisters?', symptom: 'blister' },
    { id: 's_skin_peeling', question: 'Do you have skin peeling?', symptom: 'skin peeling' },
    { id: 's_red_spots', question: 'Do you see red spots over body?', symptom: 'red spots over body' },
    { id: 's_yellow_crust', question: 'Do skin lesions ooze yellow crust?', symptom: 'yellow crust ooze' },
  ],
  orthopedic: [
    { id: 'm_joint_pain', question: 'Do you have joint pain?', symptom: 'joint pain' },
    { id: 'm_muscle_pain', question: 'Do you have muscle pain?', symptom: 'muscle pain' },
    { id: 'm_muscle_weakness', question: 'Do you have muscle weakness?', symptom: 'muscle weakness' },
    { id: 'm_back_pain', question: 'Do you have back pain?', symptom: 'back pain' },
    { id: 'm_knee_pain', question: 'Do you have knee pain?', symptom: 'knee pain' },
    { id: 'm_swelling_joints', question: 'Do you have swelling in joints?', symptom: 'swelling joints' },
    { id: 'm_stiffness', question: 'Do you feel movement stiffness?', symptom: 'movement stiffness' },
    { id: 'm_painful_walking', question: 'Is walking painful for you?', symptom: 'painful walking' },
    { id: 'm_stiff_neck', question: 'Do you have stiff neck?', symptom: 'stiff neck' },
  ],
  cardiac: [
    { id: 'c_chest_pain', question: 'Do you have chest pain or pressure?', symptom: 'chest pain' },
    { id: 'c_palpitations', question: 'Do you feel palpitations?', symptom: 'palpitations' },
    { id: 'c_fast_heart_rate', question: 'Do you have fast heart rate episodes?', symptom: 'fast heart rate' },
    { id: 'c_breathlessness', question: 'Do you experience breathlessness with activity?', symptom: 'breathlessness' },
    { id: 'c_dizziness', question: 'Do you feel dizziness with exertion?', symptom: 'dizziness' },
    { id: 'c_sweating', question: 'Do you have cold sweating episodes?', symptom: 'sweating' },
    { id: 'c_swollen_legs', question: 'Do you have swelling in legs?', symptom: 'swollen legs' },
  ],
};

function normalizeSymptom(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueSymptoms(symptoms) {
  const seen = new Set();
  const result = [];

  for (const item of symptoms || []) {
    const normalized = normalizeSymptom(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeCategoryList(categoryIds) {
  const allowed = Object.keys(QUESTION_CATEGORIES).filter((id) => id !== 'general');
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return [];

  return Array.from(
    new Set(
      categoryIds
        .map((id) => String(id || '').trim().toLowerCase())
        .filter((id) => allowed.includes(id))
    )
  );
}

function parseCategoryQuery(raw) {
  const allowed = Object.keys(QUESTION_CATEGORIES).filter((id) => id !== 'general');
  if (!raw || !String(raw).trim()) {
    return [];
  }

  return Array.from(
    new Set(
      String(raw)
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter((id) => allowed.includes(id))
    )
  );
}

function buildGuidedQuestions(requestedCategoryIds = []) {
  const selectedCategories = normalizeCategoryList(requestedCategoryIds);
  const categorySequence = ['general', ...(selectedCategories.length > 0 ? selectedCategories : Object.keys(QUESTION_BANK).filter((id) => id !== 'general'))];

  const seenQuestionIds = new Set();
  const seenSymptoms = new Set();
  const questions = [];

  for (const categoryId of categorySequence) {
    const bucket = QUESTION_BANK[categoryId] || [];
    for (const q of bucket) {
      const symptomKey = normalizeSymptom(q.symptom);
      if (seenQuestionIds.has(q.id) || seenSymptoms.has(symptomKey)) continue;

      seenQuestionIds.add(q.id);
      seenSymptoms.add(symptomKey);
      questions.push({
        ...q,
        category_id: categoryId,
        category: QUESTION_CATEGORIES[categoryId].label,
      });
    }
  }

  return questions;
}

function buildFallbackResponse(modelData) {
  const predictions = Array.isArray(modelData?.predictions) ? modelData.predictions.slice(0, 3) : [];
  const matched = Array.isArray(modelData?.matched_symptoms) ? modelData.matched_symptoms : [];

  if (predictions.length === 0) {
    return 'Gemini is unavailable, and no strong model prediction could be made yet. Please continue guided symptom questions.';
  }

  const lines = ['Gemini is unavailable, so local trained model was used:', ''];
  lines.push(`Matched symptoms: ${matched.length ? matched.join(', ') : 'none'}`);
  lines.push('Possible conditions:');

  predictions.forEach((p, index) => {
    lines.push(`${index + 1}. ${p.disease} (${p.confidence}% confidence)`);
  });

  lines.push('');
  lines.push('Continue adding symptoms for better accuracy and consult a doctor for confirmation.');

  return lines.join('\n');
}

function getNextQuestions(selectedSymptoms, categoryIds = []) {
  const selected = new Set(uniqueSymptoms(selectedSymptoms));
  const pool = buildGuidedQuestions(categoryIds);

  return pool
    .filter((q) => !selected.has(normalizeSymptom(q.symptom)))
    .filter((q) => !q.dependsOn || selected.has(normalizeSymptom(q.dependsOn)))
    .slice(0, 10)
    .map(({ id, category, category_id, question, symptom, dependsOn }) => ({
      id,
      category,
      category_id,
      question,
      symptom,
      dependsOn: dependsOn || null,
    }));
}

router.get('/guided', async (req, res) => {
  try {
    const selectedCategories = parseCategoryQuery(req.query.categories);
    const questions = buildGuidedQuestions(selectedCategories);

    res.json({
      mode: 'guided',
      categories: [
        ...Object.entries(QUESTION_CATEGORIES)
          .filter(([id]) => id !== 'general')
          .map(([id, meta]) => ({ id, ...meta })),
        {
          id: 'open',
          label: 'Open Symptoms',
          description: 'Use free text if you do not know the category.',
        },
      ],
      selected_categories: selectedCategories,
      total_questions: questions.length,
      questions: questions.map(({ id, category, category_id, question, symptom, dependsOn }) => ({
        id,
        category,
        category_id,
        question,
        symptom,
        dependsOn: dependsOn || null,
      })),
    });
  } catch (err) {
    console.error('Guided symptom questions error:', err);
    res.status(500).json({ error: 'Failed to load guided questions' });
  }
});

router.get('/model/symptoms', async (req, res) => {
  try {
    const symptoms = await getModelSymptoms();
    res.json({
      source: 'local_model',
      model_base_url: getModelBaseUrl(),
      count: symptoms.length,
      symptoms,
    });
  } catch (err) {
    console.error('Model symptom list error:', err);
    res.status(502).json({
      error: 'Failed to load symptoms from local model service',
      details: err.message,
    });
  }
});

router.post('/model/predict', validate(modelPredictSchema), async (req, res) => {
  try {
    const selectedSymptoms = uniqueSymptoms(req.body.symptoms);
    const selectedCategories = normalizeCategoryList(req.body.categories);
    const prediction = await predictWithModel(selectedSymptoms);

    res.json({
      source: 'local_model',
      selected_symptoms: selectedSymptoms,
      selected_categories: selectedCategories,
      next_questions: getNextQuestions(selectedSymptoms, selectedCategories),
      ...prediction,
    });
  } catch (err) {
    console.error('Model prediction error:', err);
    res.status(502).json({
      error: 'Failed to get prediction from local model service',
      details: err.message,
    });
  }
});

// Analyze symptoms with Gemini. Fallback to local model unless explicitly disabled.
router.post('/analyze', validate(symptomSchema), async (req, res) => {
  try {
    const { messages } = req.body;
    const disableFallback = Boolean(req.body.disable_fallback);
    const selectedSymptoms = uniqueSymptoms(req.body.selected_symptoms || []);

    const geminiResult = await analyzeSymptoms(messages);

    if (!geminiResult?.error) {
      return res.json({ ...geminiResult, source: 'gemini' });
    }

    if (disableFallback) {
      return res.json({ ...geminiResult, source: 'gemini_error' });
    }

    const userText = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    const extractedSymptoms = await extractSymptomsFromText(userText);
    const fallbackSymptoms = uniqueSymptoms([...selectedSymptoms, ...extractedSymptoms]);

    if (fallbackSymptoms.length === 0) {
      return res.json({
        ...geminiResult,
        source: 'gemini_failed_no_symptoms',
        guidance: 'No symptoms could be extracted. Use guided questionnaire for local model diagnosis.',
      });
    }

    const fallbackPrediction = await predictWithModel(fallbackSymptoms);

    return res.json({
      response: buildFallbackResponse(fallbackPrediction),
      error: false,
      demo: false,
      source: 'local_model_fallback',
      extracted_symptoms: fallbackSymptoms,
      fallback_prediction: fallbackPrediction,
    });
  } catch (err) {
    console.error('Symptom analysis error:', err);
    res.status(500).json({ error: 'Symptom analysis failed' });
  }
});

export default router;
