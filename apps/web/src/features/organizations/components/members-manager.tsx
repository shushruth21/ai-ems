"use client";

import { Copy, MoreHorizontal, RefreshCw, UserMinus, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { inviteMemberSchema } from "@ai-ems/contracts/organization";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ai-ems/ui/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";
import { Input } from "@ai-ems/ui/components/ui/input";
import { NativeSelect } from "@ai-ems/ui/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ai-ems/ui/components/ui/table";

import {
  changeMemberRole,
  inviteMember,
  reactivateMember,
  removeMember,
  resendInvitation,
  revokeInvitation,
  suspendMember,
  type InvitationLink,
} from "../actions";

export interface MemberView {
  id: string;
  name: string | null;
  email: string;
  roleKey: string;
  roleName: string;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  isSelf: boolean;
  joinedAt: string;
}

export interface InvitationView {
  id: string;
  email: string;
  roleName: string;
  expiresAt: string;
}

export interface RoleOption {
  key: string;
  name: string;
}

const STATUS_TONE = { ACTIVE: "success", SUSPENDED: "warning", INVITED: "neutral" } as const;

export function MembersManager({
  slug,
  members,
  invitations,
  roles,
  canManage,
  canAssignOwner,
}: {
  slug: string;
  members: MemberView[];
  invitations: InvitationView[];
  roles: RoleOption[];
  canManage: boolean;
  canAssignOwner: boolean;
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastLink, setLastLink] = useState<InvitationLink | null>(null);
  const [pending, startTransition] = useTransition();

  const assignable = roles.filter((r) => canAssignOwner || r.key !== "owner");

  const run = (fn: () => Promise<{ ok: boolean; message?: string; formError?: string }>) =>
    startTransition(async () => {
      setFeedback(null);
      const result = await fn();
      setFeedback(
        result.ok
          ? result.message
            ? { tone: "success", message: result.message }
            : null
          : { tone: "danger", message: result.formError ?? "That didn't work." },
      );
    });

  return (
    <div className="grid gap-6">
      {canManage ? (
        <InviteForm
          slug={slug}
          roles={assignable}
          onInvited={(link) => {
            setLastLink(link);
            setFeedback({
              tone: "success",
              message: link.emailed
                ? `Invitation sent to ${link.email}.`
                : `Invitation created for ${link.email}. Email isn't configured, so share the link below.`,
            });
          }}
        />
      ) : null}

      <FormFeedback feedback={feedback} />
      {lastLink ? <InvitationLinkBox link={lastLink} /> : null}

      <section className="grid gap-2">
        <h2 className="text-md font-semibold">Members</h2>
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          tabIndex={0}
          aria-label="Members"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="w-10 text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <span className="block font-medium">
                      {member.name ?? member.email}
                      {member.isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                    </span>
                    <span className="block text-sm text-muted-foreground">{member.email}</span>
                  </TableCell>
                  <TableCell>
                    {canManage && !member.isSelf ? (
                      <NativeSelect
                        aria-label={`Role for ${member.email}`}
                        className="max-w-48"
                        value={member.roleKey}
                        disabled={pending}
                        onChange={(e) =>
                          run(() =>
                            changeMemberRole(slug, {
                              membershipId: member.id,
                              roleKey: e.target.value,
                            }),
                          )
                        }
                      >
                        {assignable.map((role) => (
                          <option key={role.key} value={role.key}>
                            {role.name}
                          </option>
                        ))}
                        {assignable.some((r) => r.key === member.roleKey) ? null : (
                          <option value={member.roleKey}>{member.roleName}</option>
                        )}
                      </NativeSelect>
                    ) : (
                      member.roleName
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[member.status]}>{member.status.toLowerCase()}</Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {member.isSelf ? null : (
                        <MemberActions
                          member={member}
                          pending={pending}
                          onSuspend={() =>
                            run(() => suspendMember(slug, { membershipId: member.id }))
                          }
                          onReactivate={() =>
                            run(() => reactivateMember(slug, { membershipId: member.id }))
                          }
                          onRemove={() =>
                            run(() => removeMember(slug, { membershipId: member.id }))
                          }
                        />
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {canManage ? (
        <section className="grid gap-2">
          <h2 className="text-md font-semibold">Pending invitations</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Pending invitations">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{invitation.email}</span>
                    <span className="block text-sm text-muted-foreground">
                      {invitation.roleName} · expires{" "}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await resendInvitation(slug, {
                            invitationId: invitation.id,
                          });
                          if (result.ok && result.data) {
                            setLastLink(result.data);
                            setFeedback({
                              tone: "success",
                              message: `New link created for ${invitation.email}.`,
                            });
                          } else if (!result.ok) {
                            setFeedback({
                              tone: "danger",
                              message: result.formError ?? "Couldn't resend.",
                            });
                          }
                        })
                      }
                    >
                      <RefreshCw aria-hidden />
                      New link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => revokeInvitation(slug, { invitationId: invitation.id }))
                      }
                    >
                      Revoke
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function InviteForm({
  slug,
  roles,
  onInvited,
}: {
  slug: string;
  roles: RoleOption[];
  onInvited: (link: InvitationLink) => void;
}) {
  type Values = z.input<typeof inviteMemberSchema>;
  const form = useForm<Values, unknown, z.output<typeof inviteMemberSchema>>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", roleKey: roles[0]?.key ?? "viewer" },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => inviteMember(slug, values),
    {
      onSuccess: (result) => {
        if (result.data) onInvited(result.data);
        form.reset({ email: "", roleKey: form.getValues("roleKey") });
      },
    },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        aria-label="Invite a member"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invite by email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  placeholder="teammate@company.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="roleKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <NativeSelect className="sm:w-56" {...field}>
                  {roles.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending}>
          <UserPlus aria-hidden />
          Send invite
        </Button>
        <div className="sm:col-span-3">
          <FormFeedback feedback={feedback} />
        </div>
      </form>
    </Form>
  );
}

function InvitationLinkBox({ link }: { link: InvitationLink }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2 rounded-lg border bg-surface p-3">
      <p className="text-sm text-muted-foreground">
        Invitation link for <span className="font-medium text-foreground">{link.email}</span> (
        {link.roleName}) — works once, expires {new Date(link.expiresAt).toLocaleDateString()}.
      </p>
      <div className="flex min-w-0 items-center gap-2">
        <code
          data-testid="invitation-link"
          className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-sm"
        >
          {link.link}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(link.link).then(() => setCopied(true))}
        >
          <Copy aria-hidden />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function MemberActions({
  member,
  pending,
  onSuspend,
  onReactivate,
  onRemove,
}: {
  member: MemberView;
  pending: boolean;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Actions for ${member.email}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {member.status === "ACTIVE" ? (
            <DropdownMenuItem onSelect={onSuspend}>Suspend access</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={onReactivate}>Reactivate</DropdownMenuItem>
          )}
          <DropdownMenuItem variant="danger" onSelect={() => setConfirmRemove(true)}>
            <UserMinus />
            Remove from workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.name ?? member.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access immediately. Their past activity stays in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction destructive onClick={onRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
