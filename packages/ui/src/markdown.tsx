
import ReactMarkdown from 'react-markdown';

interface MarkdownProps {
  children: string;
  className?: string;
}

export default function Markdown({ children, className = "" }: MarkdownProps) {
  return (
    <div className={`prose prose-invert prose-lg max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({children}) => <h1 className="text-2xl font-bold mt-8 mb-4 border-b border-neutral-700 pb-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-xl font-bold mt-8 mb-4 border-b border-neutral-700 pb-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-lg font-semibold mt-6 mb-3">{children}</h3>,
          h4: ({children}) => <h4 className="text-base font-medium mt-4 mb-2">{children}</h4>,
          p: ({children}) => <p className="text-neutral-300 mb-4 leading-relaxed">{children}</p>,
          ul: ({children}) => <ul className="text-neutral-300 mb-4 space-y-2 list-disc list-inside ml-4">{children}</ul>,
          ol: ({children}) => <ol className="text-neutral-300 mb-4 space-y-2 list-decimal list-inside ml-4">{children}</ol>,
          li: ({children}) => <li className="leading-relaxed">{children}</li>,
          code: ({children}) => {
            return (
              <div className="bg-neutral-700/40 p-2 rounded-lg">
                <code
                  className="text-accent-300 px-2 py-1 rounded text-sm font-mono whitespace-pre-wrap">
                  {children}
                </code>
              </div>
            )
          },
          pre: ({children}) => <div className="mb-6">{children}</div>,
          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
          em: ({children}) => <em className="text-accent-400 italic">{children}</em>,
          a: ({href, children}) => (
            <a 
              href={href} 
              className="text-accent-400 hover:text-accent-300 transition-colors underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({children}) => (
            <blockquote className="border-l-4 border-accent-500/50 pl-4 my-4 text-neutral-400 italic">
              {children}
            </blockquote>
          ),
          table: ({children}) => (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full border-collapse border border-neutral-700">
                {children}
              </table>
            </div>
          ),
          th: ({children}) => (
            <th className="border border-neutral-700 px-4 py-2 bg-neutral-800 text-left text-accent-300 font-semibold">
              {children}
            </th>
          ),
          td: ({children}) => (
            <td className="border border-neutral-700 px-4 py-2 text-neutral-300">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
