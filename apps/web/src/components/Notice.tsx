export function Notice({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] leading-5 text-emerald-200"
    >
      {message}
    </p>
  )
}
