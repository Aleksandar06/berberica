"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

export interface OtpInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Fires when the user finishes filling all boxes. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  /** Marks all boxes as invalid (red border + ring). */
  invalid?: boolean;
  /** Auto-focus the first box on mount. Defaults to true. */
  autoFocus?: boolean;
}

export interface OtpInputHandle {
  focus(): void;
  clear(): void;
}

/**
 * Six-box OTP input with auto-advance, backspace-to-previous, and paste
 * support (paste-of-6 fills every box). Each box accepts a single digit;
 * `value` is the concatenated string of all boxes.
 *
 * `onComplete` fires when the last empty box is filled — the parent can
 * use it to auto-submit, removing one tap from the verification flow.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(
  function OtpInput(
    {
      value,
      onChange,
      onComplete,
      length = 6,
      disabled = false,
      invalid = false,
      autoFocus = true,
    },
    ref,
  ) {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    useImperativeHandle(ref, () => ({
      focus: () => inputs.current[0]?.focus(),
      clear: () => {
        onChange("");
        inputs.current[0]?.focus();
      },
    }), [onChange]);

    useEffect(() => {
      if (autoFocus) inputs.current[0]?.focus();
    }, [autoFocus]);

    const writeDigit = useCallback(
      (index: number, digit: string) => {
        const next = value.split("");
        next[index] = digit;
        const joined = next.join("").slice(0, length);
        onChange(joined);
        if (joined.length === length && onComplete) {
          onComplete(joined);
        }
      },
      [length, onChange, onComplete, value],
    );

    function handleChange(index: number, raw: string) {
      const digit = raw.replace(/\D/g, "").slice(-1);
      if (!digit) {
        writeDigit(index, "");
        return;
      }
      writeDigit(index, digit);
      // Advance focus
      if (index + 1 < length) {
        inputs.current[index + 1]?.focus();
      }
    }

    function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Backspace" && !value[index]) {
        // Empty box → backspace moves to previous + clears it
        if (index > 0) {
          inputs.current[index - 1]?.focus();
          writeDigit(index - 1, "");
        }
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputs.current[index - 1]?.focus();
        e.preventDefault();
      } else if (e.key === "ArrowRight" && index + 1 < length) {
        inputs.current[index + 1]?.focus();
        e.preventDefault();
      }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (!text) return;
      e.preventDefault();
      onChange(text);
      if (text.length === length && onComplete) onComplete(text);
      // Focus the last filled box
      inputs.current[Math.min(text.length, length - 1)]?.focus();
    }

    return (
      <div
        role="group"
        aria-label="Verification code"
        className="flex justify-center gap-2 sm:gap-3"
      >
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={value[i] ?? ""}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Digit ${i + 1}`}
            className={cn(
              "h-14 w-12 sm:h-12 sm:w-11 rounded-xl border bg-background text-center text-2xl font-semibold tabular-nums shadow-sm transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              invalid
                ? "border-destructive ring-2 ring-destructive/30"
                : "border-input",
            )}
          />
        ))}
      </div>
    );
  },
);
