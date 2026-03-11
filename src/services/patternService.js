import { supabase } from '../lib/supabase.js'

// ── CRIMEX Pattern Analysis API ──
const CRIMEX_API_URL = 'https://prospect01-crimex-api.hf.space'

// ---------- Session helpers ----------
function safeParse(item) {
  if (!item) return null
  try { return JSON.parse(item) } catch { return null }
}

function getStoredAuth() {
  const user = safeParse(localStorage.getItem('crimex_user'))
  const profile = safeParse(localStorage.getItem('crimex_profile'))
  const role = localStorage.getItem('crimex_role') || null
  return { user, profile, role }
}

/**
 * Get the current user's station_id from their profile.
 * Works for both OFFICER and STATION_ADMIN roles.
 */
function getStationId() {
  const { profile } = getStoredAuth()
  return profile?.station_id || null
}

/**
 * Get the current user's role.
 */
function getUserRole() {
  const { role } = getStoredAuth()
  return role
}

/**
 * Get the current user's officer ID (for LEOs only).
 */
function getOfficerId() {
  const { user } = getStoredAuth()
  return user?.id || null
}

// ---------- Error helper ----------

/** Safely extract a string message from any error type */
function errorMsg(e, fallback = 'Unknown error') {
  if (!e) return fallback
  if (typeof e === 'string') return e
  if (typeof e?.message === 'string') return e.message
  if (typeof e?.detail === 'string') return e.detail
  if (Array.isArray(e?.detail)) {
    return e.detail.map(d => d?.msg || JSON.stringify(d)).join('; ')
  }
  try { return JSON.stringify(e) } catch { return fallback }
}

// ---------- Authorization checks ----------

/**
 * Verify the user is authorized to use pattern analysis.
 * Only OFFICER and STATION_ADMIN roles are allowed.
 */
function assertAuthorized() {
  const role = getUserRole()
  if (!role || !['OFFICER', 'STATION_ADMIN'].includes(role)) {
    throw new Error('Unauthorized: Only law enforcement officers and station admins can access pattern analysis.')
  }
  const stationId = getStationId()
  if (!stationId) {
    throw new Error('Unauthorized: No station assigned to your profile.')
  }
  return { role, stationId }
}

// ---------- Station case loading ----------

/**
 * Load cases assigned to the current user's station.
 * - For OFFICER: only their own assigned cases
 * - For STATION_ADMIN: all cases assigned to their station
 */
export async function loadStationCases() {
  const { role, stationId } = assertAuthorized()

  if (role === 'OFFICER') {
    return await loadOfficerStationCases(stationId)
  } else {
    return await loadAllStationCases(stationId)
  }
}

/**
 * Load cases assigned to the logged-in officer (filtered by their station).
 */
async function loadOfficerStationCases(stationId) {
  const authUserId = getOfficerId()
  if (!authUserId) throw new Error('Invalid session: missing officer id')

  // Verify LEO belongs to this station (user_id is the FK to auth users)
  const { data: leoRow, error: leoErr } = await supabase
    .from('law_enforcement_officers')
    .select('id, station_id')
    .eq('user_id', authUserId)
    .maybeSingle()
  if (leoErr) throw new Error(errorMsg(leoErr, 'Failed to verify officer record'))
  if (!leoRow) throw new Error('Officer record not found. Your auth account may not be linked to an LEO record.')
  if (leoRow.station_id !== stationId) {
    throw new Error('Unauthorized: Officer does not belong to this station.')
  }

  const leoId = leoRow.id // actual LEO table PK

  // Get officer's assigned case report_ids
  const { data: assignments, error: asgErr } = await supabase
    .from('case_assignments')
    .select('report_id, status')
    .eq('leo_id', leoId)
    .in('status', ['assigned', 'in_progress', 'closed'])
  if (asgErr) throw new Error(errorMsg(asgErr, 'Failed to load case assignments'))

  const reportIds = (assignments || []).map(a => a.report_id).filter(Boolean)
  if (reportIds.length === 0) return []

  // Fetch full crime report details
  const { data: reports, error: repErr } = await supabase
    .from('crime_reports')
    .select('id, case_number, category, description, status, city, latitude, longitude, incident_date, created_at, assigned_station_id')
    .in('id', reportIds)
  if (repErr) throw new Error(errorMsg(repErr, 'Failed to load crime reports'))

  // Double-check station ownership
  return (reports || []).filter(r =>
    r.assigned_station_id === stationId || !r.assigned_station_id
  )
}

/**
 * Load ALL cases assigned to a station (for station admins).
 */
async function loadAllStationCases(stationId) {
  // Get all cases with assigned_station_id matching the admin's station
  const { data: reports, error: repErr } = await supabase
    .from('crime_reports')
    .select('id, case_number, category, description, status, city, latitude, longitude, incident_date, created_at, assigned_station_id')
    .eq('assigned_station_id', stationId)
    .order('created_at', { ascending: false })
  if (repErr) throw new Error(errorMsg(repErr, 'Failed to load station cases'))

  return reports || []
}

// ---------- Verify case belongs to station ----------

/**
 * Check that a specific case belongs to the user's station.
 */
export async function verifyCaseAccess(caseNumber) {
  const { role, stationId } = assertAuthorized()

  // Get the case by case_number
  const { data: report, error } = await supabase
    .from('crime_reports')
    .select('id, case_number, assigned_station_id')
    .eq('case_number', caseNumber)
    .maybeSingle()
  if (error) throw new Error(errorMsg(error, `Failed to look up case ${caseNumber}`))
  if (!report) throw new Error(`Case ${caseNumber} not found.`)

  // Check station ownership
  if (report.assigned_station_id !== stationId) {
    throw new Error(`Access denied: Case ${caseNumber} is not assigned to your station.`)
  }

  // For officers, also verify the case is assigned to them
  if (role === 'OFFICER') {
    const authUserId = getOfficerId()
    // Look up the actual LEO table id from auth user id
    const { data: leoRow, error: leoLookupErr } = await supabase
      .from('law_enforcement_officers')
      .select('id')
      .eq('user_id', authUserId)
      .maybeSingle()
    if (leoLookupErr) throw new Error(errorMsg(leoLookupErr, 'Failed to verify officer record'))
    if (!leoRow) throw new Error('Officer record not found.')

    const { data: assignment, error: asgErr } = await supabase
      .from('case_assignments')
      .select('id')
      .eq('report_id', report.id)
      .eq('leo_id', leoRow.id)
      .maybeSingle()
    if (asgErr) throw new Error(errorMsg(asgErr, 'Failed to verify case assignment'))
    if (!assignment) {
      throw new Error(`Access denied: Case ${caseNumber} is not assigned to you.`)
    }
  }

  return report
}

// ---------- CRIMEX API calls ----------

/**
 * Health check - verify the CRIMEX API is available.
 */
export async function checkApiHealth() {
  const res = await fetch(`${CRIMEX_API_URL}/health`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`API health check failed: ${res.status}`)
  return res.json()
}

/**
 * Find similar cases for an EXISTING case in the database.
 * Verifies the case belongs to the user's station before querying.
 * 
 * IMPORTANT: We use the /new endpoint with the LIVE description from Supabase
 * instead of the /existing endpoint (which uses stale pre-computed embeddings).
 * This ensures the actual case description drives the similarity — not an
 * outdated snapshot from the CSV.
 */
export async function findSimilarExisting(caseNumber, options = {}) {
  assertAuthorized()

  // Verify the officer/admin has access to this case
  const report = await verifyCaseAccess(caseNumber)

  // Fetch the FULL case details from Supabase (live data)
  const { data: fullCase, error: fetchErr } = await supabase
    .from('crime_reports')
    .select('id, case_number, category, description, city, latitude, longitude, incident_date')
    .eq('case_number', caseNumber)
    .maybeSingle()
  if (fetchErr) throw new Error(errorMsg(fetchErr, `Failed to fetch case ${caseNumber}`))
  if (!fullCase) throw new Error(`Case ${caseNumber} not found in database.`)

  // Validate the description is meaningful (not gibberish)
  const desc = (fullCase.description || '').trim()
  if (desc.length < 50) {
    throw new Error(`Case ${caseNumber} has an insufficient description (${desc.length} chars). A minimum of 50 characters is required for pattern analysis.`)
  }

  // Check for gibberish — description must have at least 5 unique words
  const words = desc.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const uniqueWords = new Set(words)
  if (uniqueWords.size < 5) {
    throw new Error(`Case ${caseNumber} has a low-quality description (only ${uniqueWords.size} distinct words). Pattern analysis requires a meaningful incident description.`)
  }

  // Extract temporal features from incident_date
  let incidentHour = null
  let incidentDow = null
  if (fullCase.incident_date) {
    const d = new Date(fullCase.incident_date)
    if (!isNaN(d.getTime())) {
      incidentHour = d.getHours()
      incidentDow = d.getDay() === 0 ? 6 : d.getDay() - 1 // Convert Sun=0 to Mon=0 format
    }
  }

  // Use the /new endpoint with the LIVE description for real-time embedding
  const body = {
    description: desc,
    category: fullCase.category || 'OTHER',
    city: fullCase.city || 'Lahore',
    latitude: parseFloat(fullCase.latitude) || 31.5204,
    longitude: parseFloat(fullCase.longitude) || 74.3587,
    incident_hour: incidentHour,
    incident_day_of_week: incidentDow,
    top_k: options.topK || 10,
    min_similarity: options.minSimilarity || 0.3,
    same_city_only: options.sameCityOnly || false,
    return_components: true,
  }

  const res = await fetch(`${CRIMEX_API_URL}/api/v1/similar-cases/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(errorMsg(err, `API error: ${res.status}`))
  }

  const result = await res.json()
  // Override query_case with the actual case number for display
  result.query_case = caseNumber
  return result
}

/**
 * Find similar cases for a NEW case description.
 * Only accessible by authorized station personnel.
 */
export async function findSimilarNew(caseData, options = {}) {
  assertAuthorized()

  // Validate description quality
  const desc = (caseData.description || '').trim()
  if (desc.length < 50) {
    throw new Error(`Description too short (${desc.length} chars). Minimum 50 characters required for meaningful pattern analysis.`)
  }
  const words = desc.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const uniqueWords = new Set(words)
  if (uniqueWords.size < 5) {
    throw new Error(`Description has too few distinct words (${uniqueWords.size}). Please provide a detailed incident description for accurate analysis.`)
  }

  const body = {
    description: caseData.description,
    category: caseData.category,
    city: caseData.city,
    latitude: parseFloat(caseData.latitude) || 31.5204,
    longitude: parseFloat(caseData.longitude) || 74.3587,
    incident_hour: caseData.incident_hour ?? null,
    incident_day_of_week: caseData.incident_day_of_week ?? null,
    top_k: options.topK || 10,
    min_similarity: options.minSimilarity || 0.3,
    same_city_only: options.sameCityOnly || false,
    return_components: true,
  }

  const res = await fetch(`${CRIMEX_API_URL}/api/v1/similar-cases/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(errorMsg(err, `API error: ${res.status}`))
  }

  return res.json()
}

// ========================================================================
// Client-side cross-comparison (compares station cases against each other)
// ========================================================================

/** Tokenize + stem-light: lowercase, split, remove stopwords, keep 3+ char tokens */
const STOPWORDS = new Set([
  'the','a','an','is','was','were','are','been','be','have','has','had','do','does','did',
  'will','would','could','should','shall','may','might','can','of','in','to','for','with',
  'on','at','by','from','as','into','about','between','through','during','after','before',
  'above','below','up','down','out','off','over','under','again','further','then','once',
  'and','but','or','nor','not','so','very','just','than','that','this','these','those',
  'it','its','he','she','they','them','his','her','their','him','we','me','my','our',
  'your','who','which','what','when','where','how','all','each','every','both','few',
  'more','most','other','some','such','no','only','own','same','too','also','there',
])

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

/** Build TF map for a single document */
function termFreq(tokens) {
  const tf = {}
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1
  const len = tokens.length || 1
  for (const t in tf) tf[t] /= len // normalize
  return tf
}

/** Cosine similarity between two TF-IDF-weighted vectors */
function cosineSim(tfA, tfB, idf) {
  let dot = 0, magA = 0, magB = 0
  const allTerms = new Set([...Object.keys(tfA), ...Object.keys(tfB)])
  for (const t of allTerms) {
    const w = idf[t] || 1
    const a = (tfA[t] || 0) * w
    const b = (tfB[t] || 0) * w
    dot += a * b
    magA += a * a
    magB += b * b
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

/** Haversine distance in km */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Geographic similarity: 1.0 when same spot, decays with distance */
function geoSim(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0
  const d = haversineKm(lat1, lon1, lat2, lon2)
  return Math.exp(-d / 20) // ~0.6 at 10 km, ~0.37 at 20 km
}

/** Temporal similarity: same hour / day-of-week overlap */
function temporalSim(dateA, dateB) {
  if (!dateA || !dateB) return 0
  const a = new Date(dateA)
  const b = new Date(dateB)
  if (isNaN(a) || isNaN(b)) return 0
  const hourDiff = Math.abs(a.getHours() - b.getHours())
  const hourSim = 1 - Math.min(hourDiff, 24 - hourDiff) / 12
  const dowSame = a.getDay() === b.getDay() ? 1 : 0
  return hourSim * 0.6 + dowSame * 0.4
}

/**
 * Cross-compare a selected case against ALL other station cases from Supabase.
 * This is entirely client-side — no external API needed — so new reports
 * are compared against each other in real time.
 */
export async function crossCompareStationCases(caseNumber, options = {}) {
  assertAuthorized()
  await verifyCaseAccess(caseNumber)

  const { role, stationId } = assertAuthorized()

  // Load all station cases
  const allCases = role === 'OFFICER'
    ? await loadOfficerStationCases(stationId)
    : await loadAllStationCases(stationId)

  const queryCase = allCases.find(c => c.case_number === caseNumber)
  if (!queryCase) throw new Error(`Case ${caseNumber} not found among station cases.`)

  const others = allCases.filter(c => c.case_number !== caseNumber)
  if (others.length === 0) throw new Error('No other station cases to compare against.')

  // Tokenize all documents for TF-IDF
  const queryTokens = tokenize(queryCase.description)
  const otherTokenized = others.map(c => tokenize(c.description))

  // Build IDF across the corpus (query + others)
  const N = others.length + 1
  const df = {}
  const allDocs = [queryTokens, ...otherTokenized]
  for (const doc of allDocs) {
    const seen = new Set(doc)
    for (const t of seen) df[t] = (df[t] || 0) + 1
  }
  const idf = {}
  for (const t in df) idf[t] = Math.log(N / df[t]) + 1

  const queryTf = termFreq(queryTokens)

  // Weights matching the API approach
  const W_NLP = 0.50
  const W_CAT = 0.20
  const W_GEO = 0.15
  const W_TIME = 0.15

  const minSimilarity = options.minSimilarity || 0.3
  const topK = options.topK || 10
  const sameCityOnly = options.sameCityOnly || false

  const scored = others.map((c, i) => {
    const nlp = cosineSim(queryTf, termFreq(otherTokenized[i]), idf)
    const cat = (queryCase.category && c.category && queryCase.category === c.category) ? 1 : 0
    const geo = geoSim(queryCase.latitude, queryCase.longitude, c.latitude, c.longitude)
    const temporal = temporalSim(queryCase.incident_date, c.incident_date)
    const combined = W_NLP * nlp + W_CAT * cat + W_GEO * geo + W_TIME * temporal

    return {
      case_number: c.case_number,
      similarity: combined,
      category: c.category,
      city: c.city,
      incident_date: c.incident_date || '',
      location: '',
      snippet: (c.description || '').slice(0, 200),
      components: { nlp, category: cat, geo, temporal },
    }
  })
    .filter(r => r.similarity >= minSimilarity)
    .filter(r => !sameCityOnly || r.city === queryCase.city)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)

  return {
    query_case: caseNumber,
    total_results: scored.length,
    linked_cases: scored,
    processing_time_ms: 0,
    weights_used: { nlp: W_NLP, category: W_CAT, geo: W_GEO, temporal: W_TIME },
  }
}

/**
 * Cross-compare a free-text description against ALL station cases (client-side).
 */
export async function crossCompareNewDescription(caseData, options = {}) {
  const { role, stationId } = assertAuthorized()

  const allCases = role === 'OFFICER'
    ? await loadOfficerStationCases(stationId)
    : await loadAllStationCases(stationId)

  if (allCases.length === 0) throw new Error('No station cases available to compare against.')

  const desc = (caseData.description || '').trim()
  if (desc.length < 50) throw new Error('Description too short for analysis.')

  const queryTokens = tokenize(desc)
  const otherTokenized = allCases.map(c => tokenize(c.description))

  const N = allCases.length + 1
  const df = {}
  const allDocs = [queryTokens, ...otherTokenized]
  for (const doc of allDocs) {
    const seen = new Set(doc)
    for (const t of seen) df[t] = (df[t] || 0) + 1
  }
  const idf = {}
  for (const t in df) idf[t] = Math.log(N / df[t]) + 1

  const queryTf = termFreq(queryTokens)

  const W_NLP = 0.50, W_CAT = 0.20, W_GEO = 0.15, W_TIME = 0.15
  const minSimilarity = options.minSimilarity || 0.3
  const topK = options.topK || 10
  const sameCityOnly = options.sameCityOnly || false

  const scored = allCases.map((c, i) => {
    const nlp = cosineSim(queryTf, termFreq(otherTokenized[i]), idf)
    const cat = (caseData.category && c.category && caseData.category === c.category) ? 1 : 0
    const geo = geoSim(
      parseFloat(caseData.latitude) || 0, parseFloat(caseData.longitude) || 0,
      parseFloat(c.latitude) || 0, parseFloat(c.longitude) || 0
    )
    const temporal = temporalSim(caseData.incident_date || null, c.incident_date)
    const combined = W_NLP * nlp + W_CAT * cat + W_GEO * geo + W_TIME * temporal
    return {
      case_number: c.case_number,
      similarity: combined,
      category: c.category,
      city: c.city,
      incident_date: c.incident_date || '',
      location: '',
      snippet: (c.description || '').slice(0, 200),
      components: { nlp, category: cat, geo, temporal },
    }
  })
    .filter(r => r.similarity >= minSimilarity)
    .filter(r => !sameCityOnly || r.city === caseData.city)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)

  return {
    query_case: 'NEW_CASE',
    total_results: scored.length,
    linked_cases: scored,
    processing_time_ms: 0,
    weights_used: { nlp: W_NLP, category: W_CAT, geo: W_GEO, temporal: W_TIME },
  }
}

export default {
  loadStationCases,
  verifyCaseAccess,
  checkApiHealth,
  findSimilarExisting,
  findSimilarNew,
  crossCompareStationCases,
  crossCompareNewDescription,
  getStationId,
  getUserRole,
}
