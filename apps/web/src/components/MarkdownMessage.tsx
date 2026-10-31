import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownMessageProps = {
  content: string
}

function childrenToText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  return ''
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="interpres-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, title, children }) {
            return (
              <a
                href={href}
                title={title}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:text-orange-300"
              >
                {children}
              </a>
            )
          },
          p({ children }) {
            return <p className="my-2 first:mt-0 last:mb-0">{children}</p>
          },
          strong({ children }) {
            return <strong className="font-semibold text-paper">{children}</strong>
          },
          em({ children }) {
            return <em className="italic text-paper/90">{children}</em>
          },
          del({ children }) {
            return <del className="text-muted line-through">{children}</del>
          },
          ul({ children }) {
            return <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>
          },
          ol({ children }) {
            return (
              <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>
            )
          },
          li({ children }) {
            return <li className="pl-0.5 [&>p]:my-0">{children}</li>
          },
          h1({ children }) {
            return <h1 className="mb-2 mt-3 text-[14px] font-semibold text-paper">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="mb-1.5 mt-3 text-[13px] font-semibold text-paper">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="mb-1 mt-2 text-[12.5px] font-semibold text-paper">{children}</h3>
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-2 border-accent/40 pl-3 text-muted">
                {children}
              </blockquote>
            )
          },
          hr() {
            return <hr className="my-3 border-line" />
          },
          code({ className, children }) {
            const text = childrenToText(children)
            const language = /language-(\w+)/.exec(className ?? '')?.[1]
            const inline = !language && !text.includes('\n')
            if (inline) {
              return (
                <code className="rounded border border-line bg-ink/80 px-1 py-0.5 font-mono text-[11px] text-paper/90">
                  {children}
                </code>
              )
            }
            return <code className="font-mono text-[11px]">{children}</code>
          },
          pre({ children }) {
            return (
              <pre className="my-2 max-w-full overflow-x-auto rounded-lg border border-line bg-ink/80 p-2.5 leading-5 first:mt-0 last:mb-0">
                {children}
              </pre>
            )
          },
          table({ children }) {
            return (
              <div className="my-2 w-full overflow-x-auto">
                <table className="w-full border-collapse text-[11.5px]">{children}</table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-line bg-ink/60 px-2 py-1 text-left font-semibold text-paper">
                {children}
              </th>
            )
          },
          td({ children }) {
            return <td className="border border-line px-2 py-1 align-top">{children}</td>
          },
          img({ src, alt }) {
            return (
              <img
                src={typeof src === 'string' ? src : undefined}
                alt={alt ?? ''}
                className="my-2 max-h-64 rounded-lg border border-line"
              />
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
