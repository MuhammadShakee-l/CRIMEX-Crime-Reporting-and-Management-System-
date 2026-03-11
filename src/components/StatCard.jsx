import React from 'react'
import { motion } from 'framer-motion'

const StatCard = ({ icon: Icon, label, value, suffix, onClick, active }) => {
  const clickable = typeof onClick === 'function'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: .96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: .45, ease: [0.16,0.8,0.3,1] }}
      onClick={onClick}
      className={`stat-card relative overflow-hidden ${clickable ? 'cursor-pointer group' : ''}`}
      style={active ? { boxShadow: '0 0 0 2px rgba(6,193,103,0.4)' } : {}}
    >
      <div className="stat-accent-bar" />
      <div className={`flex items-start gap-4 ${clickable ? 'group-hover:-translate-y-0.5 transition-transform' : ''}`}>
        <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-greenbrand-primary/15 border border-greenbrand-primary/40">
          {Icon && <Icon className="h-7 w-7 text-greenbrand-primary" />}
        </div>
        <div className="flex flex-col">
          <span className="stat-label">{label}</span>
          <span className="stat-value">
            {value}{suffix && <span className="text-lg font-medium ml-1">{suffix}</span>}
          </span>
        </div>
      </div>
      {clickable && !active && (
        <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-2 ring-greenbrand-primary/40 transition" />
      )}
    </motion.div>
  )
}

export default StatCard