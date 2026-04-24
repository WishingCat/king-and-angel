"use client";

import { useFormStatus } from "react-dom";

type Props = {
  text: string;
  pendingText?: string;
  className?: string;
};

export function SubmitButton({ text, pendingText = "处理中...", className }: Props) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className ?? "button"} disabled={pending}>
      {pending ? pendingText : text}
    </button>
  );
}