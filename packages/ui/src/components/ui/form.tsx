"use client";

import { Slot } from "radix-ui";
import { createContext, useContext, useId, type ComponentProps } from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "../../lib/utils";

import { Label } from "./label";

/**
 * React Hook Form bindings. Wires label ↔ control ↔ description ↔ error with
 * ids and aria attributes so every field is accessible by construction.
 */
export const Form = FormProvider;

interface FormFieldContextValue {
  name: string;
}
const FormFieldContext = createContext<FormFieldContextValue | null>(null);
const FormItemContext = createContext<{ id: string } | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(props: ControllerProps<TFieldValues, TName, TTransformedValues>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

export function useFormField() {
  const field = useContext(FormFieldContext);
  const item = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  if (!field || !item)
    throw new Error("useFormField must be used inside <FormField> and <FormItem>");
  const formState = useFormState({ name: field.name });
  const state = getFieldState(field.name, formState);
  return {
    id: item.id,
    name: field.name,
    controlId: `${item.id}-control`,
    descriptionId: `${item.id}-description`,
    messageId: `${item.id}-message`,
    ...state,
  };
}

export function FormItem({ className, ...props }: ComponentProps<"div">) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({
  className,
  required,
  children,
  ...props
}: ComponentProps<typeof Label> & { required?: boolean }) {
  const { error, controlId } = useFormField();
  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      htmlFor={controlId}
      className={cn("data-[error=true]:text-danger", className)}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden className="text-danger">
          *
        </span>
      ) : null}
    </Label>
  );
}

export function FormControl(props: ComponentProps<typeof Slot.Root>) {
  const { error, controlId, descriptionId, messageId } = useFormField();
  return (
    <Slot.Root
      data-slot="form-control"
      id={controlId}
      aria-describedby={error ? `${descriptionId} ${messageId}` : descriptionId}
      aria-invalid={!!error}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: ComponentProps<"p">) {
  const { descriptionId } = useFormField();
  return (
    <p id={descriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export function FormMessage({ className, children, ...props }: ComponentProps<"p">) {
  const { error, messageId } = useFormField();
  const body = error ? String(error.message ?? "") : children;
  if (!body) return null;
  return (
    <p
      id={messageId}
      role="alert"
      className={cn("text-sm font-medium text-danger", className)}
      {...props}
    >
      {body}
    </p>
  );
}
