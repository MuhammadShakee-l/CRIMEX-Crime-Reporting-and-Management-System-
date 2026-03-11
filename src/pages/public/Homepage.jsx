import React from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheckIcon,
  ChartBarIcon,
  UserGroupIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

const features = [
  {
    icon: ShieldCheckIcon,
    title: 'Secure Reporting',
    body: 'A strong and safe process that protects every report from start to finish.'
  },
  {
    icon: ChartBarIcon,
    title: 'Lifecycle Insight',
    body: 'Track each case step-by-step in real time through all its stages.'
  },
  {
    icon: UserGroupIcon,
    title: 'Role Precision',
    body: 'Distinct dashboards for System Admin, Station Admin, and LEO.'
  },
  {
    icon: Cog6ToothIcon,
    title: 'Configurable Controls',
    body: 'Flexible statuses, assignments, and case-closing rules that are always applied correctly.'
  }
]

const Homepage = () => {
  return (
    <div className="hero-shell">
      <header className="topbar bg-transparent border-none">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-greenbrand-primary flex items-center justify-center shadow-soft">
            <ShieldCheckIcon className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-display font-semibold tracking-tight">CRIMEX</h1>
        </div>
        <nav className="flex items-center gap-4">
          <Link to="/login" className="pill-link">Sign In</Link>
          <Link
            to="/login"
            className="pill-link bg-greenbrand-primary/25 hover:bg-greenbrand-primary/40 border-greenbrand-primary/40"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <div className="hero-content">
        <h2 className="hero-headline">
          Crime Reporting and Management System
        </h2>
        <p className="hero-sub">
          Crimex is a modern crime-reporting platform designed to improve public safety. It enables citizens to quickly report incidents with accuracy and ease.
        </p>

        <div className="hero-actions">
          <Link to="/login" className="btn btn-accent">Get Started</Link>
          <Link to="/login" className="btn btn-primary">Sign In</Link>
        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="card card-hover p-6 group">
                <div className="h-12 w-12 rounded-xl bg-greenbrand-primary/15 flex items-center justify-center mb-4 group-hover:bg-greenbrand-primary/25 transition">
                  <Icon className="h-7 w-7 text-greenbrand-primary" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-base-muted mt-2 leading-relaxed">{f.body}</p>
              </div>
            )
          })}
        </div>
      </div>

      <footer className="footer">
        © {new Date().getFullYear()} CRIMEX – Crafted for secure institutional excellence.
      </footer>
    </div>
  )
}

export default Homepage