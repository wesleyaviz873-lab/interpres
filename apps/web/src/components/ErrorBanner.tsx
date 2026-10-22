type ErrorBannerProps = {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-5 text-red-200"
    >
      {message}
    </p>
  )
}
