import type { ReactNode } from 'react'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.14),transparent_46%)]"
      />
      <div className="relative w-full max-w-md">
        <header className="mb-7 flex items-center gap-3">
          <img
            src="/icon-192.png"
            alt=""
            className="h-10 w-10 rounded-xl border border-line object-cover"
          />
          <div>
            <p className="text-sm font-semibold tracking-wide text-paper">Interpres</p>
            <p className="text-[11px] leading-4 text-muted">workspace de IA auto-hospedado</p>
          </div>
        </header>

        <section className="rounded-2xl border border-line bg-panel/90 p-7 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="text-xl font-semibold tracking-tight text-paper">{title}</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>

        <p className="mt-6 text-center text-[11px] leading-4 text-muted">
          MIT · seus dados ficam nesta instalação
        </p>
      </div>
    </main>
  )
}
