"use client";

import { ReactNode, useState } from "react";
import { cn } from "@sglara/cn";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value?: string) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  textInput?: {
    label: string;
    description?: string;
    placeholder?: string;
  };
  className?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  textInput,
  className,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div 
        className={cn(
          "w-full max-w-md bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg",
          className
        )}
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{title}</h3>
            <p className="text-sm text-neutral-400">{description}</p>
          </div>

          {textInput && (
            <div className="space-y-2">
              <label className="block">
                <span className="text-sm font-medium">{textInput.label}</span>
                {textInput.description && (
                  <span className="block text-xs text-neutral-400 mt-1">
                    {textInput.description}
                  </span>
                )}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={textInput.placeholder}
                  className="mt-2 w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600 placeholder:text-neutral-500"
                />
              </label>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button onClick={onClose} variant="regular">
              {cancelText}
            </Button>
            <Button 
              onClick={() => onConfirm(textInput ? inputValue : undefined)}
              variant="accent"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
