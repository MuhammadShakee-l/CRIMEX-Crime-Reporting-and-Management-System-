import React from 'react'

export const passwordRules = [
    { key: 'minLength',   label: 'At least 6 characters',           test: (p) => p.length >= 6 },
    { key: 'uppercase',   label: 'At least one capital letter',      test: (p) => /[A-Z]/.test(p) },
    { key: 'lowercase',   label: 'At least one small letter',        test: (p) => /[a-z]/.test(p) },
    { key: 'number',      label: 'At least one number',              test: (p) => /[0-9]/.test(p) },
    { key: 'special',     label: 'At least one special character (!@#$% etc.)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function validatePassword(password) {
    return passwordRules.every(r => r.test(password))
}

export default function PasswordStrengthChecklist({ password }) {
    return (
        <ul className="mt-2 space-y-1">
            {passwordRules.map(rule => {
                const passed = password && rule.test(password)
                return (
                    <li key={rule.key} className={`flex items-center gap-2 text-xs transition-colors ${passed ? 'text-green-400' : 'text-white/40'}`}>
                        <span className="text-sm leading-none">{passed ? '✓' : '○'}</span>
                        {rule.label}
                    </li>
                )
            })}
        </ul>
    )
}
