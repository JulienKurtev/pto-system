"use client";

import { useEffect, useRef, useState } from "react";

// No look-alikes (I/l/1, O/0): the password gets passed on to a person.
const SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*-_=+?",
];
const LENGTH = 16;

/** Unbiased random integer in [0, n) from the crypto RNG. */
function randomInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % n;
}

/** Strong password with at least one character from every set. */
function generatePassword(): string {
  const all = SETS.join("");
  const chars = SETS.map((s) => s[randomInt(s.length)]!);
  while (chars.length < LENGTH) chars.push(all[randomInt(all.length)]!);
  // Fisher–Yates, so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/**
 * Password input with a Generate button. A generated password is shown in
 * plain text with a Copy button, so it can be handed to the user.
 */
export function PasswordField({
  name,
  placeholder,
  className,
}: {
  name: string;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hide again when the form resets after a successful submit.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setShown(false);
      setCopied(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function generate() {
    inputRef.current!.value = generatePassword();
    setShown(true);
    setCopied(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(inputRef.current!.value);
    setCopied(true);
  }

  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        ref={inputRef}
        name={name}
        type={shown ? "text" : "password"}
        autoComplete="new-password"
        spellCheck={false}
        minLength={10}
        maxLength={128}
        required
        placeholder={placeholder}
        // Typing your own hides it again.
        onInput={() => {
          setShown(false);
          setCopied(false);
        }}
        className={`input min-w-0 flex-1 ${shown ? "font-mono" : ""}`}
      />
      <button type="button" onClick={generate} className="btn-text shrink-0">
        Generate
      </button>
      {shown && (
        <button type="button" onClick={copy} className="btn-text shrink-0">
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </span>
  );
}
