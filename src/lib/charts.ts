/* Doğrulanmış kategorik palet (dataviz referansı): sabit sırayla atanır, asla döngüye girmez. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const OTHER = "#9aa69c";

export type Slice = { label: string; value: number; color?: string };

/** En fazla `max` dilim; kalanlar "Diğer" olarak katlanır. */
export function foldSlices(items: Slice[], max = 5): Slice[] {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted.map((s, i) => ({ ...s, color: s.color ?? SERIES[i] }));
  const head = sorted.slice(0, max - 1).map((s, i) => ({ ...s, color: s.color ?? SERIES[i] }));
  const rest = sorted.slice(max - 1).reduce((a, s) => a + s.value, 0);
  return [...head, { label: "Diğer", value: rest, color: OTHER }];
}
