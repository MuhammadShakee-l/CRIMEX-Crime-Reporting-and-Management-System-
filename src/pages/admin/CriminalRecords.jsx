import React, { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase.js'
import { toast } from 'react-toastify'
import * as faceapi from 'face-api.js'
import {
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  UserCircleIcon,
  ShieldExclamationIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

const MODEL_URL = '/models'

/* ───────── component ───────── */
const CriminalRecords = () => {
  /* ── list state ── */
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  /* ── form state ── */
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    cnic: '',
    full_name: '',
    photo_url: '',
    offenses: [{ offense: '', date: '', details: '' }],
  })

  /* ── photo upload + face encoding ── */
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [encodingStatus, setEncodingStatus] = useState('')  // '', 'loading', 'done', 'failed', 'no-face'
  const [faceEncoding, setFaceEncoding] = useState(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const imgRef = useRef(null)

  /* ── delete confirm ── */
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  /* ── load face-api models ── */
  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        setModelsLoaded(true)
      } catch (err) {
        console.error('Face model load error:', err)
      }
    })()
  }, [])

  /* ── fetch records ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const PAGE = 1000
      let all = [], from = 0, more = true
      while (more) {
        const { data, error } = await supabase
          .from('criminal_records')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) throw error
        all = all.concat(data || [])
        more = (data || []).length === PAGE
        from += PAGE
      }
      setRecords(all)
    } catch (err) {
      toast.error('Failed to load records: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  /* ── form helpers ── */
  const resetForm = () => {
    setForm({ cnic: '', full_name: '', photo_url: '', offenses: [{ offense: '', date: '', details: '' }] })
    setPhotoFile(null)
    setPhotoPreview(null)
    setFaceEncoding(null)
    setEncodingStatus('')
    setEditingId(null)
    setShowForm(false)
  }

  const openNew = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (rec) => {
    const offenses = Array.isArray(rec.offenses) && rec.offenses.length > 0
      ? rec.offenses.map(o => typeof o === 'string' ? { offense: o, date: '', details: '' } : { offense: o.offense || '', date: o.date || '', details: o.details || '' })
      : [{ offense: '', date: '', details: '' }]
    setForm({
      cnic: rec.cnic || '',
      full_name: rec.full_name || '',
      photo_url: rec.photo_url || '',
      offenses,
    })
    setPhotoFile(null)
    setPhotoPreview(rec.photo_url || null)
    setFaceEncoding(rec.face_encoding || null)
    setEncodingStatus(rec.face_encoding ? 'done' : '')
    setEditingId(rec.id)
    setShowForm(true)
  }

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const updateOffense = (idx, field, value) => {
    setForm(f => {
      const offenses = [...f.offenses]
      offenses[idx] = { ...offenses[idx], [field]: value }
      return { ...f, offenses }
    })
  }

  const addOffense = () => setForm(f => ({ ...f, offenses: [...f.offenses, { offense: '', date: '', details: '' }] }))

  const removeOffense = (idx) => {
    setForm(f => {
      const offenses = f.offenses.filter((_, i) => i !== idx)
      return { ...f, offenses: offenses.length > 0 ? offenses : [{ offense: '', date: '', details: '' }] }
    })
  }

  /* ── photo handling + face encoding extraction ── */

  /** Convert a File to a base64 data-URL string */
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5 MB')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setFaceEncoding(null)
    setEncodingStatus('')
  }

  const extractEncoding = async () => {
    if (!modelsLoaded) return toast.warn('Face models still loading…')
    if (!imgRef.current) return
    setEncodingStatus('loading')
    try {
      const detection = await faceapi
        .detectSingleFace(imgRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!detection) {
        setEncodingStatus('no-face')
        toast.warn('No face detected. Try a clearer photo.')
        return
      }
      const enc = JSON.stringify(Array.from(detection.descriptor))
      setFaceEncoding(enc)
      setEncodingStatus('done')
      toast.success('Face encoding extracted successfully')
    } catch (err) {
      console.error(err)
      setEncodingStatus('failed')
      toast.error('Encoding extraction failed')
    }
  }

  /* ── save ── */
  const handleSave = async () => {
    if (!form.cnic || !/^\d{13}$/.test(form.cnic)) return toast.error('CNIC must be exactly 13 digits')
    if (!form.full_name.trim()) return toast.error('Full name is required')

    setSaving(true)
    try {
      let photoUrl = form.photo_url

      // Convert uploaded file to base64 data-URL (no storage bucket needed)
      if (photoFile) {
        photoUrl = await fileToBase64(photoFile)
      }

      // Clean offenses — remove empty rows
      const offenses = form.offenses.filter(o => o.offense.trim())

      const payload = {
        cnic: form.cnic,
        full_name: form.full_name.trim(),
        photo_url: photoUrl || null,
        face_encoding: faceEncoding || null,
        offenses,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase
          .from('criminal_records')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Criminal record updated')
      } else {
        const { error } = await supabase
          .from('criminal_records')
          .insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
        toast.success('Criminal record added')
      }

      resetForm()
      fetchRecords()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  /* ── delete ── */
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('criminal_records').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Record deleted')
      setDeleteId(null)
      fetchRecords()
    } catch (err) {
      toast.error('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  /* ── filtered list ── */
  const filtered = records.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r.full_name?.toLowerCase().includes(s) ||
      r.cnic?.includes(s)
    )
  })

  /* ───────── render ───────── */
  return (
    <Layout>
      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-semantic-danger/30 to-semantic-warning/20 flex items-center justify-center shadow-soft">
              <ShieldExclamationIcon className="h-6 w-6 text-semantic-danger" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Criminal Records</h1>
              <p className="text-xs text-base-muted mt-0.5">Manage the criminal database — add, edit, or remove records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRecords} className="btn btn-sm btn-ghost gap-1.5" disabled={loading}>
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={openNew} className="btn btn-sm btn-primary gap-1.5">
              <PlusIcon className="h-4 w-4" />
              Add Criminal
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" />
          <input
            type="text"
            placeholder="Search by name or CNIC…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input input-sm w-full pl-9"
            style={{ color: '#182B25' }}
          />
        </div>
      </div>

      {/* Records list */}
      <div className="card overflow-hidden mb-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-base-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-base-muted">
            <UserCircleIcon className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">{search ? 'No records match your search' : 'No criminal records yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-panelAlt text-left text-[10px] uppercase tracking-wider text-base-muted">
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">CNIC</th>
                  <th className="px-4 py-3">Offenses</th>
                  <th className="px-4 py-3">Face Data</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => {
                  const offenses = Array.isArray(rec.offenses) ? rec.offenses : []
                  return (
                    <tr key={rec.id} className="border-b border-base-panelAlt/50 hover:bg-base-panelAlt/30 transition">
                      <td className="px-4 py-3">
                        {rec.photo_url ? (
                          <img src={rec.photo_url} alt="" className="h-10 w-10 rounded-full object-cover border border-base-panelAlt" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-base-panelAlt flex items-center justify-center">
                            <UserCircleIcon className="h-6 w-6 text-base-muted" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{rec.full_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{rec.cnic}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{offenses.length} offense{offenses.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        {rec.face_encoding ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-greenbrand-primary/20 text-greenbrand-primary font-medium">Encoded</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-semantic-warning/20 text-semantic-warning font-medium">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-base-muted">
                        {rec.created_at ? new Date(rec.created_at).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(rec)} className="btn btn-xs btn-ghost" title="Edit">
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteId(rec.id)} className="btn btn-xs btn-ghost text-semantic-danger" title="Delete">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => resetForm()}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold">
                {editingId ? 'Edit Criminal Record' : 'Add Criminal Record'}
              </h2>
              <button onClick={resetForm} className="btn btn-xs btn-ghost"><XMarkIcon className="h-5 w-5" /></button>
            </div>

            {/* CNIC + Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">CNIC *</label>
                <input
                  type="text"
                  value={form.cnic}
                  onChange={e => updateField('cnic', e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="13-digit CNIC"
                  className="input input-sm w-full"
                  style={{ color: '#182B25' }}
                  maxLength={13}
                />
                {form.cnic && !/^\d{13}$/.test(form.cnic) && (
                  <p className="text-[10px] text-semantic-danger mt-1">Must be exactly 13 digits</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => updateField('full_name', e.target.value)}
                  placeholder="Full name"
                  className="input input-sm w-full"
                  style={{ color: '#182B25' }}
                />
              </div>
            </div>

            {/* Photo section */}
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">Photo</label>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="shrink-0">
                  {photoPreview ? (
                    <img ref={imgRef} src={photoPreview} alt="Preview" crossOrigin="anonymous"
                      className="h-28 w-28 rounded-lg object-cover border border-base-panelAlt" />
                  ) : (
                    <div className="h-28 w-28 rounded-lg bg-base-panelAlt flex items-center justify-center">
                      <PhotoIcon className="h-10 w-10 text-base-muted opacity-30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoFile}
                    className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-greenbrand-primary/20 file:text-greenbrand-primary hover:file:bg-greenbrand-primary/30 cursor-pointer"
                  />
                  <p className="text-[10px] text-base-muted">Or paste a URL directly:</p>
                  <input
                    type="url"
                    value={form.photo_url}
                    onChange={e => { updateField('photo_url', e.target.value); if (!photoFile) setPhotoPreview(e.target.value) }}
                    placeholder="https://..."
                    className="input input-sm w-full"
                    style={{ color: '#182B25' }}
                  />
                  {/* Extract encoding button */}
                  {photoPreview && (
                    <button
                      onClick={extractEncoding}
                      disabled={encodingStatus === 'loading' || !modelsLoaded}
                      className="btn btn-xs btn-ghost gap-1.5 mt-1"
                    >
                      {encodingStatus === 'loading' ? (
                        <><ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Extracting…</>
                      ) : encodingStatus === 'done' ? (
                        <><CheckIcon className="h-3.5 w-3.5 text-greenbrand-primary" /> Face Encoding Ready</>
                      ) : encodingStatus === 'no-face' ? (
                        <><ExclamationTriangleIcon className="h-3.5 w-3.5 text-semantic-warning" /> No face found — retry</>
                      ) : (
                        <><FingerPrintIcon className="h-3.5 w-3.5" /> Extract Face Encoding</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Offenses */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] text-base-muted uppercase tracking-wider">Offenses</label>
                <button onClick={addOffense} className="btn btn-xs btn-ghost gap-1">
                  <PlusIcon className="h-3.5 w-3.5" /> Add Offense
                </button>
              </div>
              <div className="space-y-3">
                {form.offenses.map((o, idx) => (
                  <div key={idx} className="border border-base-panelAlt rounded-lg p-3 space-y-2 relative">
                    {form.offenses.length > 1 && (
                      <button onClick={() => removeOffense(idx)} className="absolute top-2 right-2 text-base-muted hover:text-semantic-danger transition">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] text-base-muted uppercase mb-0.5">Offense Type *</label>
                        <input
                          type="text"
                          value={o.offense}
                          onChange={e => updateOffense(idx, 'offense', e.target.value)}
                          placeholder="e.g. Robbery, Assault"
                          className="input input-sm w-full"
                          style={{ color: '#182B25' }}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-base-muted uppercase mb-0.5">Date</label>
                        <input
                          type="date"
                          value={o.date}
                          onChange={e => updateOffense(idx, 'date', e.target.value)}
                          className="input input-sm w-full"
                          style={{ color: '#182B25' }}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-base-muted uppercase mb-0.5">Details</label>
                        <input
                          type="text"
                          value={o.details}
                          onChange={e => updateOffense(idx, 'details', e.target.value)}
                          placeholder="Additional details"
                          className="input input-sm w-full"
                          style={{ color: '#182B25' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={resetForm} className="btn btn-sm btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary gap-1.5">
                {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Saving…</> : <><CheckIcon className="h-4 w-4" /> {editingId ? 'Update' : 'Save'} Record</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteId(null)}>
          <div className="card p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-semantic-danger/20 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-semantic-danger" />
              </div>
              <div>
                <h3 className="font-display font-bold">Delete Record?</h3>
                <p className="text-xs text-base-muted">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-sm btn-ghost">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn btn-sm bg-semantic-danger text-white hover:bg-semantic-danger/80 gap-1.5">
                {deleting ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Deleting…</> : <><TrashIcon className="h-4 w-4" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

/* need FingerPrintIcon for the encoding button inside the form */
const FingerPrintIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a48.667 48.667 0 00-1.232 8.41M7.97 16.488A48.433 48.433 0 019 10.5a3 3 0 016 0c0 2.795-.487 5.48-1.38 7.97M14.634 15.518A35.09 35.09 0 0015 10.5a4.5 4.5 0 10-9 0 47.834 47.834 0 00-.842 6.883M12 10.5a1.5 1.5 0 10-3 0c0 3.1-.457 6.097-1.308 8.922" />
  </svg>
)

export default CriminalRecords
