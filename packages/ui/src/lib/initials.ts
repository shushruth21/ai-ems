/** "Ada Lovelace" → "AL"; "ada@x.com" → "A". */
export function initialsOf(name: string): string {
  const clean = name.split("@")[0]?.trim() ?? "";
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join("").toUpperCase() || "?";
}
