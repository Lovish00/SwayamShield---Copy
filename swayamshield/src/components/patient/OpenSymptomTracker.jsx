import { Sparkles } from 'lucide-react';

export default function OpenSymptomTracker({ value, onChange, onAnalyze, loading, result }) {
  return (
    <div className="card-base flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Open Symptoms</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Not sure about category? Describe your symptoms in free text and run AI analysis.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Example: I feel dizzy and have chest tightness"
        className="w-full px-3 py-2 rounded-xl border text-sm resize-none"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
      />

      <button
        onClick={onAnalyze}
        disabled={loading || !value.trim()}
        className="w-full sm:w-fit px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-700 hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2"
      >
        <Sparkles size={15} />
        {loading ? 'Analyzing...' : 'Analyze Open Symptoms'}
      </button>

      {result && (
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>AI Symptom Insight</p>
          <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
            {String(result)
              .split('\n')
              .map((line, idx) => (
                <p key={`open-symptom-line-${idx}`}>{line || ' '}</p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
