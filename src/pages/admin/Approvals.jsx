import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import api from '../../services/api'
import { toast } from 'react-toastify'
import DataTable from '../../components/DataTable'
import { ROLE_LABELS, ROLES } from '../../utils/constants'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

const Approvals = () => {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [actioning, setActioning] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/pending')
      setItems(data.items || [])
    } catch (e) {
      toast.error(e.message || 'Failed to load pending requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const approve = async (id) => {
    setActioning(id)
    try {
      await api.post(`/admin/pending/${id}/approve`)
      toast.success('Approved')
      load()
    } catch (e) {
      toast.error(e.message || 'Approve failed')
    } finally {
      setActioning(null)
    }
  }

  const reject = async (id) => {
    if (!confirm('Reject this request?')) return
    setActioning(id)
    try {
      await api.post(`/admin/pending/${id}/reject`)
      toast.info('Rejected')
      load()
    } catch (e) {
      toast.error(e.message || 'Reject failed')
    } finally {
      setActioning(null)
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Role', render: r => ROLE_LABELS[r.role] || r.role },
    { title: 'CNIC', dataIndex: 'cnic' },
    { title: 'Phone', dataIndex: 'phone' },
    {
      title: 'Badge',
      render: r => r.role === ROLES.OFFICER ? (r.badgeNumber || 'Pending') : '—'
    },
    { title: 'Requested At', render: r => new Date(r.createdAt).toLocaleString() },
    {
      title: 'Action',
      render: r => (
        <div className="flex gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={actioning === r.id}
            onClick={()=>approve(r.id)}
            title="Approve"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={actioning === r.id}
            onClick={()=>reject(r.id)}
            title="Reject"
          >
            <XCircleIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <Layout>
      <div className="card p-6 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold">Pending Approvals</h1>
          <p className="text-xs text-base-muted mt-1">
            Review and manage incoming role-based signup requests.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={loading}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-base-muted">Loading...</p>
      ) : items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-base-muted">
          No pending requests.
        </div>
      ) : (
        <DataTable columns={columns} data={items} keyField="id" />
      )}
    </Layout>
  )
}

export default Approvals