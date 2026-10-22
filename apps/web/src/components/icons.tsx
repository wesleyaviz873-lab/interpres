import type { ReactNode } from 'react'

type IconProps = {
  className?: string
}

type IconShellProps = IconProps & {
  children: ReactNode
}

function IconShell({ className = 'h-4 w-4', children }: IconShellProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function Eye({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconShell>
  )
}

export function EyeOff({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5c1.9 0 3.6.55 5 1.4" />
      <path d="M21.5 12s-3.5 6.5-9.5 6.5c-2.2 0-4.1-.7-5.7-1.8" />
      <path d="M3 3l18 18" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </IconShell>
  )
}

export function Copy({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </IconShell>
  )
}

export function Check({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
    </IconShell>
  )
}

export function Chat({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3.5 20.5l1.4-4.7a8.5 8.5 0 1 1 15.6-4.3Z" />
      <path d="M8.5 11.5h7M8.5 8.5h4.5" />
    </IconShell>
  )
}

export function Settings({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </IconShell>
  )
}

export function Logout({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5" />
      <path d="M16 16.5 20.5 12 16 7.5" />
      <path d="M20.5 12H9.5" />
    </IconShell>
  )
}

export function Shield({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 3l7 3v5.2c0 4.4-2.9 7.6-7 9.3-4.1-1.7-7-4.9-7-9.3V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconShell>
  )
}

export function ShieldCheck({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 3l7 3v5.2c0 4.4-2.9 7.6-7 9.3-4.1-1.7-7-4.9-7-9.3V6l7-3Z" />
      <path d="m8.5 12 2.5 2.5L16 9.5" />
    </IconShell>
  )
}

export function Smartphone({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </IconShell>
  )
}

export function QrCode({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M14.5 20.5h.01M20.5 20.5v-3" />
    </IconShell>
  )
}

export function Menu({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconShell>
  )
}

export function X({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </IconShell>
  )
}

export function User({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </IconShell>
  )
}

export function Key({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="8.5" cy="15.5" r="3.5" />
      <path d="m11 13 7.5-7.5M15 5.5 18.5 9M13 7.5 15.5 10" />
    </IconShell>
  )
}

export function Mail({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </IconShell>
  )
}

export function Refresh({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M20 11.5a8 8 0 0 0-13.7-5L4 9" />
      <path d="M4 4.5V9h4.5" />
      <path d="M4 12.5a8 8 0 0 0 13.7 5L20 15" />
      <path d="M20 19.5V15h-4.5" />
    </IconShell>
  )
}

export function Warning({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 4.5 21 20H3L12 4.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </IconShell>
  )
}

export function Download({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </IconShell>
  )
}

export function Folder({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </IconShell>
  )
}

export function ChevronDown({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="m6 9 6 6 6-6" />
    </IconShell>
  )
}

export function Globe({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17" />
      <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </IconShell>
  )
}

export function Link({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4" />
    </IconShell>
  )
}

export function Bell({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.5 20a2 2 0 0 0 3 0" />
    </IconShell>
  )
}

export function Sliders({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4 7h8M16 7h4M4 12h4M12 12h8M4 17h10M18 17h2" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="17" r="2" />
    </IconShell>
  )
}

export function Terminal({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M12.5 15H17" />
    </IconShell>
  )
}

export function Mic({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </IconShell>
  )
}

export function Cpu({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3" />
    </IconShell>
  )
}

export function Database({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </IconShell>
  )
}

export function Info({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5h.01" />
    </IconShell>
  )
}

export function Send({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="m4 12 16-8-5.5 16L12 14l-8-2Z" />
      <path d="M12 14 20 4" />
    </IconShell>
  )
}
