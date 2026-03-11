import React, { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../services/api'
import { toast } from 'react-toastify'
import {
  MagnifyingGlassIcon,
  UserIcon
} from '@heroicons/react/24/outline'

/*
  Station Admin user lookup:
  - Exact CNIC (13 digits) OR exact badge number.
  - Does NOT filter by partial strings.
  - Uses /station/users endpoint to fetch all users (read-only).
*/

const StationUsers = () => {
  const [query, setQuery] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/station/users?all=true')
        setAllUsers(data.items || [])
      } catch {
        toast.error('Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const search = (e) => {
    e.preventDefault()
    if (!query.trim()) {
      setResults([])
      return toast.error('Enter CNIC (13 digits) or Badge number')
    }
    const term = query.trim()
    const isCNIC = /^\d{13}$/.test(term)
    const isBadge = /^\d{3,}$/.test(term) && !isCNIC

    const matches = allUsers.filter(u =>
      (isCNIC && u.cnic === term) ||
      (isBadge && u.badgeNumber === term)
    )
    setResults(matches)
    if (matches.length === 0) toast.info('No data found')
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
  }

  return (
    <Layout>
      <div className="card p-6 mb-6">
        <h1 className="text-xl font-display font-semibold">User Lookup</h1>
        <p className="text-sm text-base-muted mt-1">
          Exact CNIC or Badge number search only.
        </p>
        <form onSubmit={search} className="mt-6 space-y-4">
          <div className="relative">
            <MagnifyingGlassIcon className="input-inline-icon" />
            <input
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              className="input-base pl-10"
              placeholder="Enter CNIC or Badge #"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >{loading ? 'Searching...' : 'Search'}</button>
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={clearSearch}
              disabled={loading}
            >Clear</button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {(results.length ? results : []).map(u => (
          <div key={u.id} className="card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-greenbrand-primary/20 flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-greenbrand-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{u.name}</p>
                <p className="text-xs text-base-muted">
                  {u.role === 'OFFICER' ? `Badge: ${u.badgeNumber}` : `CNIC: ${u.cnic}`}
                </p>
              </div>
            </div>
            <div className="text-xs text-base-muted">
              Role: {u.role} | Phone: {u.phone || '—'}
            </div>
          </div>
        ))}
        {results.length === 0 && query && (
          <div className="card p-6 text-center text-sm text-base-muted">
            No data found
          </div>
        )}
        {!query && (
          <div className="card p-6 text-center text-xs text-base-muted">
            Enter an identifier and press Search.
          </div>
        )}
      </div>
    </Layout>
  )
}

export default StationUsers