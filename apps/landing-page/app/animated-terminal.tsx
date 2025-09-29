"use client";

import { useState, useEffect, useRef } from 'react';

export interface Line {
  content: string;
  typing?: boolean;
  isComment?: boolean;
  blink?: boolean;
  delay?: number;
}

interface AnimatedTerminalProps {
  lines: Line[];
  delayBetweenLines?: number; // milliseconds
  typingSpeed?: number; // milliseconds per character
}

export function useAnimatedTerminal({ 
  lines, 
  delayBetweenLines = 1000, 
  typingSpeed = 50 
}: AnimatedTerminalProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (currentLineIndex >= lines.length) return;

    const currentLine = lines[currentLineIndex];
    if (!currentLine) return;
    
    if (currentLine.typing && currentCharIndex < currentLine.content.length) {
      // Typing animation
      setIsTyping(true);
      const timer = setTimeout(() => {
        setDisplayedLines(prev => {
          const newLines = [...prev];
          if (newLines[currentLineIndex] === undefined) {
            newLines[currentLineIndex] = '';
          }
          newLines[currentLineIndex] = currentLine.content.slice(0, currentCharIndex + 1);
          return newLines;
        });
        setCurrentCharIndex(prev => prev + 1);
      }, typingSpeed);

      return () => clearTimeout(timer);
    } else if (currentLine.typing && currentCharIndex >= currentLine.content.length) {
      // Finished typing current line, move to next after delay
      setIsTyping(false);
      const timer = setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, delayBetweenLines);

      return () => clearTimeout(timer);
    } else if (!currentLine.typing) {
      // Non-typing line - display immediately then move to next
      setDisplayedLines(prev => {
        const newLines = [...prev];
        newLines[currentLineIndex] = currentLine.content;
        return newLines;
      });
      
      const timer = setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, currentLine.delay ?? delayBetweenLines );

      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, currentCharIndex, lines, delayBetweenLines, typingSpeed]);

  return { displayedLines, isTyping };
}

export default function AnimatedTerminal({ 
  lines, 
  delayBetweenLines = 1000, 
  typingSpeed = 50 
}: AnimatedTerminalProps) {
  const { displayedLines, isTyping } = useAnimatedTerminal({ 
    lines, 
    delayBetweenLines, 
    typingSpeed 
  });
  
  const terminalContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (terminalContentRef.current) {
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
    }
  }, [displayedLines, isTyping]);

  return (
    <div className="bg-neutral-900/60 border border-accent-500/30 rounded-lg p-3 font-mono text-sm h-[380px] flex flex-col">
      <div className="flex items-center mb-4">
        <div className="flex space-x-1">
          <div className="w-[10px] h-[10px] bg-red-500 rounded-full"></div>
          <div className="w-[10px] h-[10px] bg-yellow-500 rounded-full"></div>
          <div className="w-[10px] h-[10px] bg-accent-500 rounded-full"></div>
        </div>
      </div>
      <div 
        ref={terminalContentRef}
        className="flex-1 overflow-y-auto terminal-scrollbar"
      >
        <div className="space-y-1 min-h-full flex flex-col justify-end">
          {displayedLines.map((line, index) => (
            <div key={index}>
              {line.split('\n').map((subLine, subIndex) => (
                <div key={`${index}-${subIndex}`} className="flex">
                  {displayedLines.length > index && lines[index]?.typing && subIndex === 0 && (
                    <span className="text-accent-300 mr-2">%</span>
                  )}
                  {displayedLines.length > index && lines[index]?.isComment && subIndex === 0 && (
                    <span className="text-neutral-500 mr-1">#</span>
                  )}
                <span className={`whitespace-pre ${displayedLines.length > index && lines[index]?.isComment ? 'text-neutral-500' : 'text-neutral-100'}`}>
                  {subLine}
                </span>
                {isTyping && index === displayedLines.length - 1 && subIndex === line.split('\n').length - 1 && (
                  <span className="animate-pulse text-accent-400 ml-1">|</span>
                )}
                {displayedLines.length > index && lines[index]?.blink && subIndex === line.split('\n').length - 1 && (
                  <>
                    <span className="text-accent-300 mr-2">%</span>
                    <span className="animate-pulse text-accent-400">|</span>
                  </>
                )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
