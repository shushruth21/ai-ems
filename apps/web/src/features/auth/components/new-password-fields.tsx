"use client";

import { useWatch, type Control, type FieldValues, type Path } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";

import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";

interface NewPasswordValues extends FieldValues {
  password: string;
  confirmPassword: string;
}

export function NewPasswordFields<T extends NewPasswordValues>({
  control,
  context,
  autoFocus,
}: {
  control: Control<T, unknown, unknown>;
  context?: string[];
  autoFocus?: boolean;
}) {
  const password = useWatch({ control, name: "password" as Path<T> }) as string | undefined;
  return (
    <>
      <FormField
        control={control}
        name={"password" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>New password</FormLabel>
            <FormControl>
              <PasswordInput autoComplete="new-password" autoFocus={autoFocus} {...field} />
            </FormControl>
            <PasswordStrength password={password ?? ""} context={context} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"confirmPassword" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm new password</FormLabel>
            <FormControl>
              <PasswordInput autoComplete="new-password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
