import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Brain,
  AlertTriangle,
  Sparkles,
  Stethoscope,
  Layers,
} from 'lucide-react';
import { symptomAPI } from '../../lib/api';
import SymptomTracker from '../../components/patient/SymptomTracker';

function normalizeSymptom(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findNextQuestionIndex(questions, fromIndex, selectedSymptoms) {
  const selected = new Set(selectedSymptoms.map(normalizeSymptom));

  for (let i = fromIndex; i < questions.length; i += 1) {
    const q = questions[i];
    if (!q) continue;
    if (!q.dependsOn || selected.has(normalizeSymptom(q.dependsOn))) {
      return i;
    }
  }

  return -1;
}

function buildGeminiPrompt(selectedCategories, selectedSymptoms, answers, questions) {
  const selectedSet = new Set(selectedSymptoms.map(normalizeSymptom));
  const negativeQuestions = questions
    .filter((q) => answers[q.id] === false)
    .slice(0, 10)
    .map((q) => q.question);

  const lines = [
    'Patient completed a guided symptom questionnaire.',
    `Selected disease categories: ${selectedCategories.join(', ') || 'Not specified'}`,
    `Positive symptoms: ${selectedSymptoms.join(', ') || 'None'}`,
    `Negative responses: ${negativeQuestions.length > 0 ? negativeQuestions.join('; ') : 'None captured'}`,
    `Total positive symptoms: ${selectedSet.size}`,
    '',
    'Please provide:',
    '1) Most likely conditions (top 3).',
    '2) Red-flag signs requiring emergency care.',
    '3) Specialty to consult next.',
    '4) Immediate self-care precautions.',
  ];

  return lines.join('\n');
}

const ANALYSIS_MODES = [
  { id: 'local', label: 'Local Trained Model', description: 'Fast offline prediction from your trained dataset.', icon: Brain },
  { id: 'gemini', label: 'Gemini', description: 'LLM reasoning and narrative triage guidance.', icon: Sparkles },
  { id: 'both', label: 'Both', description: 'Run both and compare outcomes side-by-side.', icon: Layers },
];

export default function SymptomChecker() {
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  const [step, setStep] = useState('category');
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState('');

  const [analysisMode, setAnalysisMode] = useState('both');
  const [analyzing, setAnalyzing] = useState(false);
  const [localResult, setLocalResult] = useState(null);
  const [geminiResult, setGeminiResult] = useState(null);
  const [openSymptoms, setOpenSymptoms] = useState('');
  const [openAnalyzing, setOpenAnalyzing] = useState(false);
  const [openResult, setOpenResult] = useState('');

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      setError('');
      try {
        const res = await symptomAPI.guidedQuestions();
        if (!active) return;

        const categories = Array.isArray(res.data?.categories) ? res.data.categories : [];
        setCategoryOptions(categories);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.error || 'Failed to load symptom categories');
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  const currentQuestion = questionIndex >= 0 ? questions[questionIndex] : null;
  const askedCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progress = questions.length > 0 ? Math.round((askedCount / questions.length) * 100) : 0;
  const guidedCategories = useMemo(
    () => selectedCategories.filter((id) => id !== 'open'),
    [selectedCategories]
  );

  const toggleCategory = (categoryId) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) return prev.filter((id) => id !== categoryId);
      return [...prev, categoryId];
    });
  };

  const startQuestionnaire = async () => {
    if (guidedCategories.length === 0) {
      setError('Select at least one guided category to start the questionnaire, or use Open Symptoms.');
      return;
    }

    setLoadingQuestions(true);
    setError('');

    try {
      const res = await symptomAPI.guidedQuestions(guidedCategories);
      const loadedQuestions = Array.isArray(res.data?.questions) ? res.data.questions : [];

      setQuestions(loadedQuestions);
      setAnswers({});
      setSelectedSymptoms([]);
      setLocalResult(null);
      setGeminiResult(null);

      const first = findNextQuestionIndex(loadedQuestions, 0, []);
      setQuestionIndex(first);
      setStep('questionnaire');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load curated questionnaire');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleAnswer = (value) => {
    if (!currentQuestion) return;

    const symptom = normalizeSymptom(currentQuestion.symptom);

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));

    const nextSelected = value
      ? Array.from(new Set([...selectedSymptoms.map(normalizeSymptom), symptom]))
      : selectedSymptoms.map(normalizeSymptom).filter((s) => s !== symptom);

    setSelectedSymptoms(nextSelected);

    const nextIndex = findNextQuestionIndex(questions, questionIndex + 1, nextSelected);
    if (nextIndex === -1) {
      setQuestionIndex(-1);
      setStep('review');
    } else {
      setQuestionIndex(nextIndex);
    }
  };

  const runAnalysis = async () => {
    if (selectedSymptoms.length === 0) {
      setError('At least one positive symptom is required for analysis.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setLocalResult(null);
    setGeminiResult(null);

    const runLocal = analysisMode === 'local' || analysisMode === 'both';
    const runGemini = analysisMode === 'gemini' || analysisMode === 'both';

    const localTask = runLocal
      ? symptomAPI.guidedPredict(selectedSymptoms, guidedCategories)
      : Promise.resolve(null);

    const geminiTask = runGemini
      ? symptomAPI.analyze(
          [{ role: 'user', content: buildGeminiPrompt(guidedCategories, selectedSymptoms, answers, questions) }],
          {
            disable_fallback: true,
            selected_symptoms: selectedSymptoms,
          }
        )
      : Promise.resolve(null);

    const [localRes, geminiRes] = await Promise.allSettled([localTask, geminiTask]);

    if (runLocal) {
      if (localRes.status === 'fulfilled') {
        setLocalResult(localRes.value.data);
      } else {
        const msg = localRes.reason?.response?.data?.details
          ? `${localRes.reason?.response?.data?.error}: ${localRes.reason?.response?.data?.details}`
          : (localRes.reason?.response?.data?.error || 'Local model analysis failed');
        setError((prev) => (prev ? `${prev} | ${msg}` : msg));
      }
    }

    if (runGemini) {
      if (geminiRes.status === 'fulfilled') {
        setGeminiResult(geminiRes.value.data);
      } else {
        const msg = geminiRes.reason?.response?.data?.error || 'Gemini analysis failed';
        setError((prev) => (prev ? `${prev} | ${msg}` : msg));
      }
    }

    setAnalyzing(false);
  };

  const handleResetAll = () => {
    setStep('category');
    setQuestions([]);
    setQuestionIndex(-1);
    setAnswers({});
    setSelectedSymptoms([]);
    setLocalResult(null);
    setGeminiResult(null);
    setError('');
    setAnalyzing(false);
    setAnalysisMode('both');
    setOpenSymptoms('');
    setOpenResult('');
    setOpenAnalyzing(false);
  };

  const analyzeOpenSymptoms = async () => {
    if (!openSymptoms.trim()) return;
    setOpenAnalyzing(true);
    setError('');
    try {
      const response = await symptomAPI.analyze(
        [{ role: 'user', content: openSymptoms }],
        { disable_fallback: false }
      );
      setOpenResult(response.data?.response || response.data?.guidance || 'No analysis available.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to analyze open symptoms.');
    }
    setOpenAnalyzing(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Bot size={24} className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Deep Guided Symptom Assessment</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Curated by disease category, then analyze with Gemini, local model, or both.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm"
          style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card-base">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading categories...</p>
        </div>
      ) : step === 'category' ? (
        <div className="card-base flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>1) Select Disease Categories</h2>
            <button onClick={handleResetAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:underline">
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categoryOptions.map((cat) => {
              const active = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`text-left rounded-xl border p-4 transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : ''}`}
                  style={active ? {} : { borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
                >
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{cat.label}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{cat.description}</p>
                </button>
              );
            })}
          </div>

          <button
            onClick={startQuestionnaire}
            disabled={loadingQuestions || guidedCategories.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            <Stethoscope size={16} />
            {loadingQuestions ? 'Loading Questions...' : `Start Questionnaire (${guidedCategories.length} categories)`}
            <ArrowRight size={14} />
          </button>

          <SymptomTracker
            value={openSymptoms}
            onChange={setOpenSymptoms}
            onAnalyze={analyzeOpenSymptoms}
            loading={openAnalyzing}
            result={openResult}
          />
        </div>
      ) : step === 'questionnaire' ? (
        <div className="card-base flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              2) Deep Questionnaire Progress: {progress}%
            </p>
            <button onClick={handleResetAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:underline">
              <RotateCcw size={14} /> Start Over
            </button>
          </div>

          <div className="w-full h-2 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>

          {currentQuestion ? (
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                {currentQuestion.category}
              </p>
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {currentQuestion.question}
              </h3>

              <div className="flex gap-3">
                <button
                  onClick={() => handleAnswer(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:opacity-90"
                >
                  <CheckCircle2 size={16} /> Yes
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-500 text-white text-sm font-semibold hover:opacity-90"
                >
                  <XCircle size={16} /> No
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No more questions.</p>
          )}
        </div>
      ) : (
        <div className="card-base flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>3) Choose Analysis Engine</h2>
            <button onClick={handleResetAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:underline">
              <RotateCcw size={14} /> Restart
            </button>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Positive symptoms captured: {selectedSymptoms.length}. Select how you want the final analysis.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ANALYSIS_MODES.map((mode) => {
              const active = analysisMode === mode.id;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAnalysisMode(mode.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : ''}`}
                  style={active ? {} : { borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} className="text-blue-500" />
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{mode.label}</p>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{mode.description}</p>
                </button>
              );
            })}
          </div>

          <button
            onClick={runAnalysis}
            disabled={analyzing || selectedSymptoms.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {analyzing ? 'Running Analysis...' : 'Run Final Analysis'}
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {selectedSymptoms.length > 0 && (
        <div className="card-base">
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Selected Symptoms</h2>
          <div className="flex flex-wrap gap-2">
            {selectedSymptoms.map((sym) => (
              <span
                key={sym}
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                {sym}
              </span>
            ))}
          </div>
        </div>
      )}

      {localResult && (
        <div className="card-base">
          <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Local Model Results</h2>
          {Array.isArray(localResult.predictions) && localResult.predictions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {localResult.predictions.slice(0, 5).map((item, idx) => (
                <div
                  key={`local-${item.disease}-${idx}`}
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{item.disease}</h3>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-500/10 text-blue-500">
                      {item.confidence}%
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                  )}
                  {Array.isArray(item.precautions) && item.precautions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Precautions</p>
                      <ul className="list-disc pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {item.precautions.slice(0, 4).map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No high-confidence local model prediction yet.
            </p>
          )}
        </div>
      )}

      {geminiResult && (
        <div className="card-base">
          <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Gemini Results</h2>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Source: {geminiResult.source || 'gemini'}
            </p>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {String(geminiResult.response || 'No Gemini response available.')
                .split('\n')
                .map((line, idx) => (
                  <p key={`g-line-${idx}`} className="mb-1">{line || ' '}</p>
                ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
