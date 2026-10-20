"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "./toast";

export type FormState = { error?: string; ok?: string } | null;
export type FormAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

/**
 * Form wired to a Server Action that returns {error} / {ok}.
 * Submits manually so React doesn't clear the inputs when validation fails;
 * resets only on success.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Set false for edit forms so they keep showing the saved values. */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  // Effects re-run when a cached page is shown again; toast each result once.
  const announced = useRef<FormState>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  useEffect(() => {
    if (!state || state === announced.current) return;
    announced.current = state;
    if (state.error) toast("error", state.error);
    else if (state.ok) toast("success", state.ok);
  }, [state]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(
          e.currentTarget,
          (e.nativeEvent as SubmitEvent).submitter,
        );
        startTransition(() => formAction(data));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
