import React, { useState, useCallback } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClipboardButtonProps {
  value: unknown;
  className?: string;
}

export function ClipboardButton({ value, className }: ClipboardButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      navigator.clipboard.writeText(
        typeof value !== "object"
          ? String(value)
          : JSON.stringify(value, null, 2)
      );
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    },
    [value]
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(className, isCopied && "!visible", "p-0 w-auto h-auto")}
      onClick={handleCopy}
    >
      {isCopied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Clipboard className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
