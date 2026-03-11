import React, { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase.js'
import * as faceapi from 'face-api.js'
import { toast } from 'react-toastify'
import {
  CameraIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  FingerPrintIcon,
  UserCircleIcon,
  XMarkIcon,
  CheckBadgeIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'

/* ───────── constants ───────── */
const MODEL_URL = '/models'
const MATCH_THRESHOLD = 0.55 // Euclidean distance — lower = closer match

/* ───────── component ───────── */
const FaceSearch = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [criminals, setCriminals] = useState([])
  const [dbLoading, setDbLoading] = useState(true)

  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [noFace, setNoFace] = useState(false)

  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  /* ── 1. Load face-api models ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        if (!cancelled) {
          setModelsLoaded(true)
          setModelsLoading(false)
        }
      } catch (err) {
        console.error('Model load error:', err)
        if (!cancelled) {
          toast.error('Failed to load face recognition models')
          setModelsLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ── 2. Load criminal records with face_encoding ── */
  useEffect(() => {
    ;(async () => {
      try {
        const PAGE = 1000
        let all = [], from = 0, more = true
        while (more) {
          const { data, error } = await supabase
            .from('criminal_records')
            .select('id, cnic, full_name, photo_url, face_encoding, offenses')
            .not('face_encoding', 'is', null)
            .range(from, from + PAGE - 1)
          if (error) throw error
          all = all.concat(data || [])
          more = (data || []).length === PAGE
          from += PAGE
        }
        setCriminals(all)
      } catch (err) {
        console.error('Criminal DB load error:', err)
        toast.error('Failed to load criminal database')
      } finally {
        setDbLoading(false)
      }
    })()
  }, [])

  /* ── helpers ── */
  const euclidean = (a, b) => {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
    return Math.sqrt(sum)
  }

  const confidenceFromDistance = (d) => {
    // 0 distance → 100 %, threshold distance → ~0 %
    return Math.max(0, Math.min(100, ((MATCH_THRESHOLD - d) / MATCH_THRESHOLD) * 100))
  }

  /* ── file select ── */
  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setResults(null)
    setNoFace(false)
  }

  const clearFile = () => {
    setFile(null)
    setPreviewUrl(null)
    setResults(null)
    setNoFace(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /* ── 3. Search ── */
  const handleSearch = useCallback(async () => {
    if (!modelsLoaded) return toast.error('Models still loading…')
    if (!file) return toast.error('Upload a photo first')
    if (criminals.length === 0) return toast.warn('Criminal database is empty or still loading')

    setSearching(true)
    setResults(null)
    setNoFace(false)

    try {
      const img = imgRef.current
      if (!img) throw new Error('Image not loaded')

      // Detect face + extract descriptor
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        setNoFace(true)
        toast.warn('No face detected in the image. Try a clearer photo.')
        return
      }

      const queryDescriptor = Array.from(detection.descriptor)

      // Draw detection box on canvas overlay
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const dims = faceapi.matchDimensions(canvas, img, true)
        faceapi.draw.drawDetections(canvas, faceapi.resizeResults([detection], dims))
      }

      // Compare against all stored encodings
      const matches = []
      for (const criminal of criminals) {
        try {
          const stored = typeof criminal.face_encoding === 'string'
            ? JSON.parse(criminal.face_encoding)
            : criminal.face_encoding

          if (!Array.isArray(stored) || stored.length !== 128) continue

          const dist = euclidean(queryDescriptor, stored)
          if (dist < MATCH_THRESHOLD) {
            matches.push({
              ...criminal,
              distance: dist,
              confidence: confidenceFromDistance(dist),
            })
          }
        } catch { /* skip invalid encodings */ }
      }

      matches.sort((a, b) => a.distance - b.distance)
      setResults(matches)

      if (matches.length === 0) {
        toast.info('No matching records found in the database')
      } else {
        toast.success(`Found ${matches.length} potential match${matches.length > 1 ? 'es' : ''}`)
      }
    } catch (err) {
      console.error('Search error:', err)
      toast.error('Search failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setSearching(false)
    }
  }, [modelsLoaded, file, criminals])

  /* ── confidence bar color ── */
  const confColor = (c) =>
    c >= 75 ? '#EF4444' : c >= 50 ? '#F97316' : c >= 30 ? '#F59E0B' : '#6B7280'

  const ready = modelsLoaded && !dbLoading

  /* ───────── render ───────── */
  return (
    <Layout>
      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-semantic-info/30 to-greenbrand-primary/20 flex items-center justify-center shadow-soft">
            <FingerPrintIcon className="h-6 w-6 text-semantic-info" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight">Face Recognition Search</h1>
            <p className="text-xs text-base-muted mt-0.5">
              Upload a suspect photo to match against the criminal records database
            </p>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${modelsLoaded ? 'bg-greenbrand-primary' : modelsLoading ? 'bg-semantic-warning animate-pulse' : 'bg-semantic-danger'}`} />
          <span className="text-xs">{modelsLoading ? 'Loading face models…' : modelsLoaded ? 'Face models ready' : 'Model load failed'}</span>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${!dbLoading && criminals.length > 0 ? 'bg-greenbrand-primary' : dbLoading ? 'bg-semantic-warning animate-pulse' : 'bg-semantic-danger'}`} />
          <span className="text-xs">{dbLoading ? 'Loading criminal database…' : `${criminals.length} records with face data`}</span>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${ready ? 'bg-greenbrand-primary' : 'bg-semantic-warning animate-pulse'}`} />
          <span className="text-xs">{ready ? 'System ready' : 'Initializing…'}</span>
        </div>
      </div>

      {/* Upload + Preview area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upload card */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-display font-semibold flex items-center gap-2">
            <PhotoIcon className="h-4 w-4 text-greenbrand-primary" />
            Upload Suspect Photo
          </h2>

          {!previewUrl ? (
            <label
              className="flex flex-col items-center justify-center border-2 border-dashed border-base-panelAlt rounded-xl p-10 cursor-pointer hover:border-greenbrand-primary/50 transition-colors"
              htmlFor="face-upload"
            >
              <CameraIcon className="h-12 w-12 text-base-muted mb-3" />
              <p className="text-sm text-base-muted">Click to upload or drag & drop</p>
              <p className="text-[10px] text-base-muted mt-1">JPG, PNG — clear frontal face preferred</p>
              <input
                ref={fileInputRef}
                id="face-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          ) : (
            <div className="relative">
              <div className="relative inline-block w-full">
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Suspect"
                  className="rounded-lg w-full max-h-[400px] object-contain bg-black/5"
                  crossOrigin="anonymous"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                />
              </div>
              <button
                onClick={clearFile}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={!ready || !file || searching}
            className="btn btn-primary w-full gap-2"
          >
            {searching ? (
              <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Analyzing face…</>
            ) : (
              <><FingerPrintIcon className="h-4 w-4" /> Search Criminal Database</>
            )}
          </button>

          {noFace && (
            <div className="flex items-start gap-2 text-sm text-semantic-warning bg-semantic-warning/10 border border-semantic-warning/30 rounded-lg p-3">
              <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <span>No face could be detected. Please upload a clearer, front-facing photo with good lighting.</span>
            </div>
          )}
        </div>

        {/* Results card */}
        <div className="card p-6">
          <h2 className="text-sm font-display font-semibold flex items-center gap-2 mb-4">
            <ShieldExclamationIcon className="h-4 w-4 text-semantic-danger" />
            Match Results
          </h2>

          {results === null && !searching && (
            <div className="flex flex-col items-center justify-center text-base-muted py-16">
              <UserCircleIcon className="h-16 w-16 mb-3 opacity-30" />
              <p className="text-sm">Upload a photo and click search</p>
              <p className="text-[10px] mt-1">Results will appear here</p>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center py-16 animate-pulse">
              <ArrowPathIcon className="h-10 w-10 text-greenbrand-primary animate-spin mb-3" />
              <p className="text-sm text-base-muted">Scanning database…</p>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="flex flex-col items-center justify-center text-base-muted py-16">
              <CheckBadgeIcon className="h-16 w-16 mb-3 text-greenbrand-primary opacity-50" />
              <p className="text-sm font-medium">No matches found</p>
              <p className="text-[10px] mt-1">The uploaded face does not match any criminal record</p>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {results.map((m, idx) => {
                const conf = m.confidence.toFixed(1)
                const offenses = Array.isArray(m.offenses) ? m.offenses : []
                return (
                  <div
                    key={m.id}
                    className="border border-base-panelAlt rounded-lg p-4 space-y-3 hover:border-semantic-danger/40 transition"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.full_name} className="h-12 w-12 rounded-full object-cover border-2 border-semantic-danger/30" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-base-panelAlt flex items-center justify-center">
                            <UserCircleIcon className="h-8 w-8 text-base-muted" />
                          </div>
                        )}
                        <div>
                          <p className="font-display font-bold text-sm">{m.full_name}</p>
                          <p className="text-[11px] text-base-muted">CNIC: {m.cnic}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: confColor(m.confidence) + '22', color: confColor(m.confidence) }}>
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-base-muted uppercase tracking-wider">Match Confidence</span>
                        <span className="font-mono font-bold" style={{ color: confColor(m.confidence) }}>{conf}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-base-panelAlt overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${conf}%`, background: confColor(m.confidence) }}
                        />
                      </div>
                      <p className="text-[9px] text-base-muted mt-1">Euclidean distance: {m.distance.toFixed(4)}</p>
                    </div>

                    {/* Offenses */}
                    {offenses.length > 0 && (
                      <div>
                        <p className="text-[10px] text-base-muted uppercase tracking-wider mb-1">Prior Offenses</p>
                        <div className="space-y-1">
                          {offenses.map((o, oi) => (
                            <div key={oi} className="text-[11px] bg-base-panelAlt rounded px-2 py-1">
                              {typeof o === 'string' ? o : (
                                <>
                                  <span className="font-medium">{o.offense || o.type || 'Offense'}</span>
                                  {o.date && <span className="text-base-muted ml-2">{o.date}</span>}
                                  {o.details && <span className="text-base-muted ml-1">— {o.details}</span>}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default FaceSearch
