import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground",
      "focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
