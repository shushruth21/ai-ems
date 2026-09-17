"use client";

import {
  Archive,
  ChevronDown,
  Copy,
  Info,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { KpiCard } from "@ai-ems/ui/components/data/kpi-card";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@ai-ems/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ai-ems/ui/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@ai-ems/ui/components/ui/avatar";
import { Badge } from "@ai-ems/ui/components/ui/badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ai-ems/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@ai-ems/ui/components/ui/dropdown-menu";
import { Input } from "@ai-ems/ui/components/ui/input";
import { Kbd, KbdGroup } from "@ai-ems/ui/components/ui/kbd";
import { Label } from "@ai-ems/ui/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ai-ems/ui/components/ui/popover";
import { Progress } from "@ai-ems/ui/components/ui/progress";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@ai-ems/ui/components/ui/sheet";
import { Skeleton } from "@ai-ems/ui/components/ui/skeleton";
import { toast } from "@ai-ems/ui/components/ui/sonner";
import { Spinner } from "@ai-ems/ui/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ai-ems/ui/components/ui/tabs";
import { SimpleTooltip } from "@ai-ems/ui/components/ui/tooltip";

const STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "IN_PRODUCTION",
  "SHIPPED",
  "CANCELLED",
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function ButtonsGallery() {
  return (
    <div className="grid gap-4">
      <Row label="Variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="danger-outline">Remove</Button>
        <Button variant="ai">
          <Sparkles /> Ask AI
        </Button>
        <Button variant="link">Link</Button>
      </Row>
      <Row label="Sizes">
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <SimpleTooltip label="Add">
          <Button size="icon" variant="outline" aria-label="Add">
            <Plus />
          </Button>
        </SimpleTooltip>
      </Row>
      <Row label="States">
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
        <Button variant="outline">
          <Plus /> With icon
        </Button>
      </Row>
      <Row label="Badges">
        {STATUSES.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
        <Badge tone="ai">
          <Sparkles /> AI
        </Badge>
        <Badge tone="outline">Outline</Badge>
      </Row>
      <Row label="Keyboard">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <KbdGroup>
          <Kbd>G</Kbd>
          <Kbd>O</Kbd>
        </KbdGroup>
        <Kbd>?</Kbd>
      </Row>
      <Row label="Avatar · spinner">
        <Avatar>
          <AvatarFallback>RM</AvatarFallback>
        </Avatar>
        <Spinner />
      </Row>
    </div>
  );
}

export function OverlaysGallery() {
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename work center</DialogTitle>
            <DialogDescription>
              The new name appears on route cards and schedules.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="wc-name">Name</Label>
            <Input id="wc-name" defaultValue="Assembly" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => toast.success("Saved")}>Save</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="danger-outline">
            <Trash2 /> Delete…
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              Reserved stock is released and linked work orders are put on hold. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => toast.error("Order cancelled (sample)")}>
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Open drawer</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record details</SheetTitle>
            <SheetDescription>Drawers show a record without leaving the list.</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-3 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24" />
          </SheetBody>
          <SheetFooter>
            <Button className="ml-auto">Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Actions <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Pencil /> Edit <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Archive /> Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="danger">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Popover</Button>
        </PopoverTrigger>
        <PopoverContent className="space-y-2">
          <p className="text-base font-medium">Stock on hand</p>
          <p className="text-sm text-muted-foreground">120 m available · 30 m reserved</p>
          <Progress value={75} aria-label="Reserved share" />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        onClick={() =>
          toast("Quote QT-2026-00042 sent", {
            description: "Delivered to buyer@example.com",
            action: { label: "Undo", onClick: () => undefined },
          })
        }
      >
        Show toast
      </Button>
    </div>
  );
}

export function FeedbackGallery() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-3">
        <Alert tone="info">
          <Info />
          <AlertTitle>Price list updated</AlertTitle>
          <AlertDescription>New prices apply to quotes created from today.</AlertDescription>
        </Alert>
        <Alert tone="warning">
          <TriangleAlert />
          <AlertTitle>Low stock</AlertTitle>
          <AlertDescription>Oak board 18mm is below its reorder point.</AlertDescription>
        </Alert>
        <Alert tone="ai">
          <Sparkles />
          <AlertTitle>Suggestion ready</AlertTitle>
          <AlertDescription>
            AI drafted a purchase order. Review it before sending.
          </AlertDescription>
        </Alert>
      </div>
      <div className="grid gap-3">
        <KpiCard
          label="Gross margin"
          value="34.2%"
          delta={0.012}
          deltaLabel="vs last quarter"
          trend={[30, 31, 33, 32, 34, 34.2]}
        />
        <KpiCard label="Loading state" value="" loading />
      </div>
      <div className="rounded-lg border lg:col-span-2">
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Invite teammates to collaborate on orders and production."
          action={
            <Button size="sm">
              <Plus /> Invite
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function TabsGallery() {
  return (
    <div className="grid gap-6">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="text-base text-muted-foreground">
          Underline tabs for page sections.
        </TabsContent>
        <TabsContent value="lines" className="text-base text-muted-foreground">
          Order lines go here.
        </TabsContent>
        <TabsContent value="activity" className="text-base text-muted-foreground">
          Comments and history go here.
        </TabsContent>
      </Tabs>
      <Tabs defaultValue="week">
        <TabsList variant="segmented" aria-label="Period">
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
        <TabsContent value="day" className="text-base text-muted-foreground">
          Segmented tabs for compact view switches — today.
        </TabsContent>
        <TabsContent value="week" className="text-base text-muted-foreground">
          Segmented tabs for compact view switches — this week.
        </TabsContent>
        <TabsContent value="month" className="text-base text-muted-foreground">
          Segmented tabs for compact view switches — this month.
        </TabsContent>
      </Tabs>
    </div>
  );
}
