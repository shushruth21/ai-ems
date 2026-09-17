export function SkipLink({ targetId }: { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="fixed top-2 left-2 z-(--z-index-toast) -translate-y-16 rounded-md bg-primary px-3 py-2 text-base font-medium text-primary-foreground shadow-md transition-transform focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}
