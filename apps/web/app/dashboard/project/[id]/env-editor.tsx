"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/button";
import { X } from "lucide-react";
import { cn } from "@sglara/cn";
import { parseEnvContent, EnvVar } from "./utils";

export interface EnvEditorProps {
  content: string;
  onChange: (content: string) => void;
  className?: string;
}

export function EnvEditor({ content, onChange, className }: EnvEditorProps) {
  const [vars, setVars] = useState<EnvVar[]>(parseEnvContent(content));

  useEffect(() => {
    const newContent = vars.map(v => `${v.name}=${v.value}`).join("\n");
    onChange(newContent);
  }, [vars, onChange]);

  const addVar = () => {
    const newVar: EnvVar = { name: "", value: "" };
    setVars(vars.concat(newVar));
  };

  const removeVar = (index: number) => {
    setVars(vars.filter((_, i) => i !== index));
  };

  const updateVar = (index: number, key: keyof EnvVar, value: string) => {
    const newVars = vars.map((v, i) => 
      i === index ? { ...v, [key]: value } : v
    );
    setVars(newVars);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {vars.map((envVar, index) => (
        <div key={index} className="flex gap-2 items-center">
          <input
            type="text"
            value={envVar.name}
            onChange={(e) => updateVar(index, "name", e.target.value)}
            placeholder="Variable name"
            className="min-w-[100px] flex-1 text-xs px-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
          />
          <input
            type="text"
            value={envVar.value}
            onChange={(e) => updateVar(index, "value", e.target.value)}
            placeholder="Value"
            className="min-w-[100px] flex-1 text-xs px-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
          />
          <button
            type="button"
            onClick={() => removeVar(index)}
            className="text-neutral-400 hover:text-red-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <Button
        onClick={addVar}
        className="w-full"
      >
        Add Variable
      </Button>
    </div>
  );
}