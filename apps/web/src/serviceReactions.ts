export const REACTIONS = [
  { code: 'like', emoji: '👍', label: 'Thích' },
  { code: 'love', emoji: '❤️', label: 'Yêu thích' },
  { code: 'care', emoji: '🥰', label: 'Thương thương' },
  { code: 'haha', emoji: '😂', label: 'Haha' },
  { code: 'wow', emoji: '😮', label: 'Wow' },
  { code: 'sad', emoji: '😢', label: 'Buồn' },
  { code: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const;
export type ReactionCode = typeof REACTIONS[number]['code'];
type ReactionService = { id: string | number; name: string; providerName?: string; platform: string };
const suffix = /\(\s*(like|love|care|haha|wow|sad|angry)\s*\)\s*$/i;

// The provider exposes reactions as separate service IDs, not an add-order parameter.
// Only group explicitly advertised variants; never infer support from a generic "like" name.
export function serviceReaction(service: ReactionService): ReactionCode | null {
  const name = service.providerName ?? service.name;
  if (!/chọn cảm xúc/i.test(name)) return null;
  return (name.match(suffix)?.[1].toLowerCase() as ReactionCode | undefined) ?? null;
}

export function groupReactionServices<T extends ReactionService>(services: T[]) {
  const groups = new Map<string, { key: string; name: string; variants: T[] }>();
  for (const service of services) {
    const reaction = serviceReaction(service);
    const canonical = (service.providerName ?? service.name).replace(suffix, '').trim().toLowerCase();
    const key = reaction ? JSON.stringify([service.platform, canonical]) : `service:${service.id}`;
    const group = groups.get(key);
    if (group) group.variants.push(service);
    else groups.set(key, { key, name: service.name.replace(reaction ? suffix : /$^/, '').replace(/\s*\|\s*$/, '').trim(), variants: [service] });
  }
  for (const group of groups.values()) {
    group.variants.sort((a, b) =>
      REACTIONS.findIndex(r => r.code === serviceReaction(a)) - REACTIONS.findIndex(r => r.code === serviceReaction(b)));
  }
  return [...groups.values()];
}
