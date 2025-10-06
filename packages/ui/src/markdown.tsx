"use client";

import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { gruvboxDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface MarkdownProps {
  children: string;
  className?: string;
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-800/80 hover:bg-neutral-700/80 transition-colors opacity-0 group-hover:opacity-100"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-neutral-400" />
      )}
    </button>
  );
}

export default function Markdown({ children, className = "", ...rest }: MarkdownProps) {
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
            // Check if we're inside a pre by looking at the component tree
            const isInline = typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code className="bg-neutral-900/60 text-neutral-200 px-1.5 py-0.5 text-sm font-mono border-neutral-800 border">
                  {children}
                </code>
              )
            }
            const languageMatch = /language-(\w+)/.exec(className || '')
            return (
              <div className="relative group bg-neutral-900/60 p-3 border-neutral-800 border">
                <CopyButton content={children as string} />
                  <SyntaxHighlighter
                    {...rest}
                    className="text-sm"
                    PreTag="div"
                    children={String(children).replace(/\n$/, '')}
                    language={languageMatch?.[1] ?? "bash"}
                    wrapLongLines={true}
                    customStyle={{ 
                      background: "transparent", 
                      // margin: 0,
                      // overflowX: "auto",
                      // maxWidth: "100%"
                    }}
                    style={gruvboxDark}
                  />
              </div>
            )
          },
          pre: ({children}) => <div className="mb-6">{children}</div>,
          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
          em: ({children}) => <em className="text-accent-300 italic">{children}</em>,
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
