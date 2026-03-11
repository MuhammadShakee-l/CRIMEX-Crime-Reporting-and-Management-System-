import React, { useEffect, useState, useMemo } from 'react'
import Layout from '../../components/Layout'
import StatusChip from '../../components/StatusChip'
import { toast } from 'react-toastify'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  DocumentMagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'
import {
  loadStationCases,
  findSimilarExisting,
  findSimilarNew,
  crossCompareStationCases,
  crossCompareNewDescription,
  checkApiHealth,
} from '../../services/patternService'
import { formatDateTimePretty } from '../../utils/format'

// ── Similarity score color helper ──
function simColor(score) {
  if (score >= 0.75) return 'text-semantic-danger'
  if (score >= 0.5) return 'text-yellow-400'
  return 'text-greenbrand-primary'
}
function simBg(score) {
  if (score >= 0.75) return 'bg-semantic-danger/15 border-semantic-danger/40'
  if (score >= 0.5) return 'bg-yellow-400/10 border-yellow-400/30'
  return 'bg-greenbrand-primary/10 border-greenbrand-primary/30'
}

// ── Component bar (NLP / Category / Geo / Temporal) ──
const ComponentBar = ({ label, value }) => {
  const pct = Math.round((value || 0) * 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-base-muted shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-base-panelAlt overflow-hidden">
        <div
          className="h-full rounded-full bg-greenbrand-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-base-muted">{pct}%</span>
    </div>
  )
}

// ── Linked case card ──
const LinkedCaseCard = ({ c, index }) => {
  const [open, setOpen] = useState(false)
  const pct = (c.similarity * 100).toFixed(1)

  return (
    <div className={`rounded-xl border p-4 ${simBg(c.similarity)} transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-base-muted">#{index + 1}</span>
          <div>
            <span className="font-semibold text-sm">{c.case_number}</span>
            <span className="ml-2 text-xs text-base-muted">{c.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-display font-bold ${simColor(c.similarity)}`}>{pct}%</span>
          <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm p-1">
            {open ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-base-muted">
        <span>{c.city}</span>
        <span>{c.incident_date ? new Date(c.incident_date).toLocaleDateString() : '—'}</span>
        {c.location && <span>{c.location}</span>}
      </div>

      {/* Snippet */}
      <p className="text-xs text-base-muted mt-2 line-clamp-2">{c.snippet}</p>

      {/* Expanded detail */}
      {open && c.components && (
        <div className="mt-4 p-3 rounded-lg bg-base-bg/40 space-y-2">
          <p className="text-xs font-semibold text-base-muted uppercase tracking-wide mb-2">Similarity Breakdown</p>
          <ComponentBar label="NLP" value={c.components.nlp} />
          <ComponentBar label="Category" value={c.components.category} />
          <ComponentBar label="Location" value={c.components.geo} />
          <ComponentBar label="Temporal" value={c.components.temporal} />
        </div>
      )}
    </div>
  )
}

const OfficerBehavior = () => {
  // ── State ──
  const [apiOnline, setApiOnline] = useState(null) // null = checking, true/false
  const [cases, setCases] = useState([])
  const [loadingCases, setLoadingCases] = useState(true)
  const [caseError, setCaseError] = useState('')

  // Search mode: 'existing' | 'new' | 'cross'
  const [mode, setMode] = useState('existing')

  // Existing case search
  const [selectedCase, setSelectedCase] = useState('')
  const [caseSearch, setCaseSearch] = useState('')

  // New case search
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState('THEFT')
  const [newCity, setNewCity] = useState('Lahore')
  const [newLat, setNewLat] = useState('')
  const [newLng, setNewLng] = useState('')

  // Options
  const [topK, setTopK] = useState(5)
  const [minSim, setMinSim] = useState(0.3)
  const [sameCityOnly, setSameCityOnly] = useState(false)

  // Results
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // ── Init: health check + load station cases ──
  useEffect(() => {
    checkApiHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))

    loadStationCases()
      .then(data => {
        setCases(data || [])
        setLoadingCases(false)
      })
      .catch(e => {
        setCaseError(e?.message || 'Failed to load cases')
        setLoadingCases(false)
      })
  }, [])

  // ── Filter cases dropdown ──
  const filteredCases = useMemo(() => {
    if (!caseSearch) return cases
    const q = caseSearch.toLowerCase()
    return cases.filter(c =>
      (c.case_number || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    )
  }, [cases, caseSearch])

  // ── Categories from case data ──
  const categories = useMemo(() => {
    const set = new Set(cases.map(c => c.category).filter(Boolean))
    return ['THEFT', 'ROBBERY', 'FRAUD', 'ASSAULT', 'KIDNAPPING', 'MURDER', 'NARCOTICS', 'CYBERCRIME', 'OTHER', ...set]
      .filter((v, i, a) => a.indexOf(v) === i)
  }, [cases])

  // ── Cities from case data ──
  const cities = useMemo(() => {
    const set = new Set(cases.map(c => c.city).filter(Boolean))
    return ['Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Sialkot', ...set]
      .filter((v, i, a) => a.indexOf(v) === i)
  }, [cases])

  // ── Search handler ──
  const handleSearch = async () => {
    setSearchError('')
    setResults(null)
    setSearching(true)

    try {
      let data
      if (mode === 'existing') {
        if (!selectedCase) {
          toast.error('Select a case from your assigned cases')
          setSearching(false)
          return
        }
        data = await findSimilarExisting(selectedCase, { topK, minSimilarity: minSim, sameCityOnly })
      } else if (mode === 'cross') {
        if (!selectedCase) {
          toast.error('Select a case to cross-compare')
          setSearching(false)
          return
        }
        data = await crossCompareStationCases(selectedCase, { topK, minSimilarity: minSim, sameCityOnly })
      } else {
        if (!newDesc || newDesc.length < 50) {
          toast.error('Description must be at least 50 characters')
          setSearching(false)
          return
        }
        data = await findSimilarNew(
          { description: newDesc, category: newCategory, city: newCity, latitude: newLat, longitude: newLng },
          { topK, minSimilarity: minSim, sameCityOnly }
        )
      }
      setResults(data)
      if (data.total_results === 0) {
        toast.info('No similar cases found above the threshold.')
      } else {
        toast.success(`Found ${data.total_results} similar case(s)`)
      }
    } catch (e) {
      setSearchError(e?.message || 'Search failed')
      toast.error(e?.message || 'Pattern analysis failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold flex items-center gap-2">
              <ShieldExclamationIcon className="h-6 w-6 text-greenbrand-primary" />
              Behavioral Pattern Analysis
            </h1>
            <p className="text-xs text-base-muted mt-1">
              AI-powered crime pattern detection — analyze cases assigned to your station only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              apiOnline === true ? 'bg-greenbrand-primary/15 border-greenbrand-primary/40 text-greenbrand-primary'
              : apiOnline === false ? 'bg-semantic-danger/15 border-semantic-danger/40 text-semantic-danger'
              : 'bg-base-panelAlt border-base-border text-base-muted'
            }`}>
              <SignalIcon className="h-3.5 w-3.5" />
              {apiOnline === true ? 'AI Engine Online' : apiOnline === false ? 'AI Engine Offline' : 'Checking...'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Unauthorized / error banner ── */}
      {caseError && (
        <div className="card p-4 mb-6 flex items-center gap-3 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          {caseError}
        </div>
      )}

      {/* ── Mode selector ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button
            className={`btn ${mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('existing')}
          >
            <DocumentMagnifyingGlassIcon className="h-4 w-4 mr-1.5" />
            Analyze vs Historical DB
          </button>
          <button
            className={`btn ${mode === 'cross' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('cross')}
          >
            <ArrowPathIcon className="h-4 w-4 mr-1.5" />
            Cross-Compare Station Cases
          </button>
          <button
            className={`btn ${mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('new')}
          >
            <MagnifyingGlassIcon className="h-4 w-4 mr-1.5" />
            Analyze New Description
          </button>
        </div>

        {/* Info banner for cross-compare mode */}
        {mode === 'cross' && (
          <div className="mb-4 p-3 rounded-lg bg-greenbrand-primary/10 border border-greenbrand-primary/30 text-xs text-greenbrand-light">
            <strong>Cross-Compare:</strong> Compares cases directly against each other using real-time analysis.
            Unlike the historical DB mode, this includes all new and recent reports in the comparison.
          </div>
        )}

        {/* ── Existing / Cross-Compare case mode ── */}
        {(mode === 'existing' || mode === 'cross') && (
          <div className="space-y-4">
            <div>
              <label className="input-label">Search Your Cases</label>
              <input
                className="input-base mb-2"
                placeholder="Type to filter by case number, category, or description..."
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
              />
              {loadingCases ? (
                <p className="text-xs text-base-muted">Loading your assigned cases...</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-base-border bg-base-panelAlt">
                  {filteredCases.length === 0 ? (
                    <p className="p-3 text-xs text-base-muted text-center">No cases found</p>
                  ) : filteredCases.map(c => (
                    <button
                      key={c.id}
                      className={`w-full text-left px-4 py-2.5 text-sm border-b border-base-border/50 hover:bg-greenbrand-primary/10 transition flex items-center justify-between ${
                        selectedCase === c.case_number ? 'bg-greenbrand-primary/20 text-greenbrand-light' : ''
                      }`}
                      onClick={() => setSelectedCase(c.case_number)}
                    >
                      <div>
                        <span className="font-mono font-medium">{c.case_number}</span>
                        <span className="ml-2 text-xs text-base-muted">{c.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip status={(c.status || 'assigned').toLowerCase()} />
                        {selectedCase === c.case_number && (
                          <CheckCircleIcon className="h-4 w-4 text-greenbrand-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedCase && (
                <p className="text-xs text-greenbrand-primary mt-2">
                  ✓ Selected: <span className="font-mono font-semibold">{selectedCase}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── New case mode ── */}
        {mode === 'new' && (
          <div className="space-y-4">
            <div>
              <label className="input-label">Case Description *</label>
              <textarea
                className="input-base"
                rows={4}
                placeholder="Describe the incident in detail (minimum 50 characters)..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <p className="text-[10px] text-base-muted mt-1">{newDesc.length}/50 min characters</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Category *</label>
                <select className="input-base" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">City *</label>
                <select className="input-base" value={newCity} onChange={e => setNewCity(e.target.value)}>
                  {cities.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Latitude</label>
                <input className="input-base" type="number" step="0.0001" placeholder="e.g. 31.5204" value={newLat} onChange={e => setNewLat(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Longitude</label>
                <input className="input-base" type="number" step="0.0001" placeholder="e.g. 74.3587" value={newLng} onChange={e => setNewLng(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Options ── */}
        <div className="mt-5 pt-4 border-t border-base-border">
          <p className="text-xs text-base-muted font-semibold uppercase tracking-wide mb-3">Analysis Options</p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Max Results</label>
              <select className="input-base" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                {[3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Min Similarity</label>
              <select className="input-base" value={minSim} onChange={e => setMinSim(Number(e.target.value))}>
                <option value={0.2}>20% (Broad)</option>
                <option value={0.3}>30% (Default)</option>
                <option value={0.5}>50% (Focused)</option>
                <option value={0.7}>70% (High Match)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="sameCityOnly"
                checked={sameCityOnly}
                onChange={e => setSameCityOnly(e.target.checked)}
                className="w-4 h-4 rounded border-base-border accent-greenbrand-primary"
              />
              <label htmlFor="sameCityOnly" className="text-sm text-base-muted">Same city only</label>
            </div>
          </div>
        </div>

        {/* ── Search button ── */}
        <div className="flex justify-end mt-5">
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={searching || (apiOnline === false && mode !== 'cross')}
          >
            {searching ? (
              <><ArrowPathIcon className="h-4 w-4 mr-1.5 animate-spin" /> Analyzing...</>
            ) : (
              <><MagnifyingGlassIcon className="h-4 w-4 mr-1.5" /> Run Pattern Analysis</>
            )}
          </button>
        </div>
      </div>

      {/* ── Search error ── */}
      {searchError && (
        <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10">
          <ExclamationTriangleIcon className="h-4 w-4 inline mr-2" />
          {searchError}
        </div>
      )}

      {/* ── Results ── */}
      {results && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-display font-semibold">Analysis Results</h2>
              <p className="text-xs text-base-muted mt-0.5">
                Query: <span className="font-mono">{results.query_case}</span>
                {' · '}{results.total_results} match{results.total_results !== 1 ? 'es' : ''} found
                {' · '}{results.processing_time_ms?.toFixed(0)}ms
              </p>
            </div>
            {results.weights_used && (
              <div className="text-[10px] text-base-muted bg-base-panelAlt rounded-lg px-3 py-2 border border-base-border">
                <span className="font-semibold">Weights:</span>{' '}
                NLP {(results.weights_used.nlp * 100).toFixed(0)}% ·
                Cat {(results.weights_used.category * 100).toFixed(0)}% ·
                Geo {(results.weights_used.geo * 100).toFixed(0)}% ·
                Time {(results.weights_used.temporal * 100).toFixed(0)}%
              </div>
            )}
          </div>

          {results.total_results === 0 ? (
            <div className="text-center py-10 text-base-muted">
              <DocumentMagnifyingGlassIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No similar cases found above the threshold.</p>
              <p className="text-xs mt-1">Try lowering the minimum similarity or broadening your search.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.linked_cases.map((c, i) => (
                <LinkedCaseCard key={c.case_number || i} c={c} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Info footer ── */}
      <div className="card p-4 text-[11px] text-base-muted">
        <p>
          <strong>Security:</strong> Only cases assigned to your station are accessible.
          {' '}Officers can only analyze their own assigned cases.
          {' '}Station admins can analyze all cases within their station.
        </p>
        <p className="mt-1">
          <strong>AI Engine:</strong> Historical DB mode uses SentenceTransformer (all-MiniLM-L6-v2) with multi-modal scoring.
          {' '}Cross-Compare mode uses real-time TF-IDF analysis to compare new and recent cases against each other.
        </p>
      </div>
    </Layout>
  )
}

export default OfficerBehavior