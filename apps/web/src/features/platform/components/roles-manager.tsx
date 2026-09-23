"use client";

import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { createRoleSchema } from "@ai-ems/contracts/platform";
import { Badge } from "@ai-ems/ui/components/ui/badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ai-ems/ui/components/ui/alert-dialog";
import { Checkbox } from "@ai-ems/ui/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";
import { Input } from "@ai-ems/ui/components/ui/input";

import { createCustomRole, deleteCustomRole, updateCustomRole } from "../actions";

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
}

export interface PermissionView {
  key: string;
  module: string;
  description: string;
}

type Values = z.input<typeof createRoleSchema>;

/**
 * Roles and their permissions. System roles are read-only; a custom role can
 * only be given permissions the editor holds themselves, which the server
 * enforces again — the checkboxes are a courtesy, not the guard.
 */
export function RolesManager({
  slug,
  roles,
  permissions,
  granted,
  canManage,
}: {
  slug: string;
  roles: RoleView[];
  permissions: PermissionView[];
  /** The viewer's own permissions: the ceiling for anything they create. */
  granted: string[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<RoleView | "new" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const grantedSet = useMemo(() => new Set(granted), [granted]);

  return (
    <div className="grid gap-6">
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")} disabled={pending}>
            <Plus aria-hidden />
            New role
          </Button>
        </div>
      ) : null}

      <FormFeedback feedback={feedback} />

      {editing ? (
        <RoleForm
          slug={slug}
          role={editing === "new" ? null : editing}
          permissions={permissions}
          grantedSet={grantedSet}
          onDone={(message) => {
            setEditing(null);
            setFeedback({ tone: "success", message });
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <ul className="grid gap-3" aria-label="Roles">
        {roles.map((role) => (
          <li key={role.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-semibold">
                  {role.name}
                  {role.isSystem ? (
                    <Badge tone="neutral">
                      <Lock aria-hidden className="size-3" />
                      built-in
                    </Badge>
                  ) : null}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {role.description ?? "No description."} · {role.memberCount}{" "}
                  {role.memberCount === 1 ? "member" : "members"} · {role.permissions.length}{" "}
                  permissions
                </p>
              </div>
              {canManage && !role.isSystem ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setEditing(role)}
                  >
                    <Pencil aria-hidden />
                    Edit
                  </Button>
                  <DeleteRole
                    name={role.name}
                    memberCount={role.memberCount}
                    disabled={pending}
                    onConfirm={() =>
                      startTransition(async () => {
                        const result = await deleteCustomRole(slug, { roleId: role.id });
                        setFeedback(
                          result.ok
                            ? { tone: "success", message: result.message ?? "Role deleted." }
                            : {
                                tone: "danger",
                                message: result.formError ?? "That didn't work.",
                              },
                        );
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleForm({
  slug,
  role,
  permissions,
  grantedSet,
  onDone,
  onCancel,
}: {
  slug: string;
  role: RoleView | null;
  permissions: PermissionView[];
  grantedSet: ReadonlySet<string>;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof createRoleSchema>>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissions: role?.permissions ?? [],
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) =>
      role
        ? updateCustomRole(slug, { ...values, roleId: role.id })
        : createCustomRole(slug, values),
    { onSuccess: (result) => onDone(result.message ?? "Saved.") },
  );

  const modules = useMemo(() => {
    const byModule = new Map<string, PermissionView[]>();
    for (const p of permissions) byModule.set(p.module, [...(byModule.get(p.module) ?? []), p]);
    return [...byModule.entries()];
  }, [permissions]);

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-4 rounded-lg border p-4"
        aria-label={role ? `Edit ${role.name}` : "New role"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role name</FormLabel>
                <FormControl>
                  <Input placeholder="Regional manager" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input placeholder="What this role is for" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="permissions"
          render={({ field }) => {
            const selected = new Set(field.value ?? []);
            const toggle = (key: string, on: boolean) => {
              const next = new Set(selected);
              if (on) next.add(key);
              else next.delete(key);
              field.onChange([...next]);
            };
            return (
              <FormItem>
                <FormLabel>Permissions</FormLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  {modules.map(([module, items]) => (
                    <fieldset key={module} className="grid gap-2 rounded-md border p-3">
                      <legend className="px-1 text-sm font-medium capitalize">{module}</legend>
                      {items.map((permission) => {
                        const allowed = grantedSet.has(permission.key);
                        return (
                          <label
                            key={permission.key}
                            className="flex items-start gap-2 text-sm data-[disabled=true]:opacity-60"
                            data-disabled={!allowed}
                          >
                            <Checkbox
                              checked={selected.has(permission.key)}
                              disabled={!allowed}
                              onCheckedChange={(value) => toggle(permission.key, value === true)}
                            />
                            <span>
                              {permission.description}
                              {allowed ? null : (
                                <span className="block text-xs text-muted-foreground">
                                  You don&apos;t have this permission yourself.
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormFeedback feedback={feedback} />
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            {role ? "Save role" : "Create role"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

function DeleteRole({
  name,
  memberCount,
  disabled,
  onConfirm,
}: {
  name: string;
  memberCount: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-label={`Delete ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {memberCount > 0
              ? `${memberCount} ${memberCount === 1 ? "person has" : "people have"} this role — move them to another role first.`
              : "This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
