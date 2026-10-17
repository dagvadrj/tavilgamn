import type { ModularKitchen } from './kitchenCabinets';
import { createCabinet, createHood, createRefrigerator } from './kitchenCabinets';
import { arrangeKitchen } from './kitchenAssembly';
import { withOpening } from './kitchenComponents';
import { placementIssues, findCabinetSpace } from './kitchenPlacement';
import type { KitchenSuggestionPreferences } from './kitchenSuggestions';

export const KITCHEN_FLOW_STAGES = ['room', 'size', 'equipment', 'space', 'design', 'suggestions', 'finish'] as const;
export type KitchenFlowStage = typeof KITCHEN_FLOW_STAGES[number];
export type KitchenSetupStage = 'room' | 'size' | 'equipment';
export function isKitchenFlowStage(value: unknown): value is KitchenFlowStage { return typeof value === 'string' && (KITCHEN_FLOW_STAGES as readonly string[]).includes(value); }
export function kitchenPreferences(kitchen: ModularKitchen): KitchenSuggestionPreferences {
  const fridge = kitchen.cabinets.find(c => c.opening === 'refrigerator');
  const hood = kitchen.cabinets.find(c => c.opening === 'hood');
  return { oven: kitchen.cabinets.some(c => c.opening === 'oven' && c.type === 'tall') ? 'high-cabinet' : 'under-worktop',
    hood: hood ? hood.hoodMount === 'wall' ? 'wall' : 'integrated' : 'none',
    refrigerator: fridge ? fridge.refrigeratorStyle === 'side-by-side' ? 'freestanding' : 'integrated' : 'none',
    layout: kitchen.layout === 'straight' || kitchen.layout === 'u' || kitchen.layout === 'double-side' ? kitchen.layout : 'l-right' };
}
export function restoreKitchenPreferences(value: unknown, kitchen: ModularKitchen): KitchenSuggestionPreferences {
  const result = kitchenPreferences(kitchen);
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  const choices = { oven: ['under-worktop','high-cabinet'], hood: ['integrated','wall','none'], refrigerator: ['integrated','freestanding','none'], layout: ['straight','l-right','u','double-side'] };
  for (const key of Object.keys(choices) as (keyof KitchenSuggestionPreferences)[]) if (typeof raw[key] === 'string' && choices[key].includes(raw[key] as string)) Object.assign(result, { [key]: raw[key] });
  return result;
}
/** Apply only changed equipment. Navigating never rebuilds the furnished design. */
export function updateKitchenEquipment(kitchen: ModularKitchen, preferences: KitchenSuggestionPreferences, previous = kitchenPreferences(kitchen)): ModularKitchen {
  let next = kitchen;
  const replace = (opening: string, replacement?: ModularKitchen['cabinets'][number]) => {
    const old = next.cabinets.find(c => c.opening === opening);
    if (old) {
      const updated = { ...next, cabinets: next.cabinets.flatMap(c => c.id !== old.id ? [c] : replacement ? [{ ...replacement, id: old.id, position: old.position }] : []) };
      if (replacement && placementIssues(updated).some(issue => issue.severity === 'error' && issue.ids.includes(old.id))) {
        const placed = findCabinetSpace({ ...next, cabinets: next.cabinets.filter(c => c.id !== old.id) }, { ...replacement, id: old.id });
        if (!placed) throw new Error('Төхөөрөмж өрөөнд багтахгүй байна.');
        next = placed;
      } else next = updated;
    }
    else if (replacement) {
      const placed = findCabinetSpace(next, replacement);
      if (!placed) throw new Error('Сонгосон төхөөрөмжид сул зай алга. Тавилгыг зөөх эсвэл өрөөг томруулна уу.');
      next = placed;
    }
  };
  if (preferences.oven !== previous.oven) {
    const old = next.cabinets.find(c => c.opening === 'oven');
    if (old) next = { ...next, cabinets: next.cabinets.map(c => c.id === old.id ? withOpening(c, c.type === 'base' ? 'hob' : 'doors') : c) };
    const base = next.cabinets.find(c => c.type === 'base' && c.opening === 'hob');
    if (preferences.oven === 'under-worktop' && base) next = { ...next, cabinets: next.cabinets.map(c => c.id === base.id ? withOpening(c, 'oven') : c) };
    else replace('oven', withOpening(createCabinet(preferences.oven === 'high-cabinet' ? 'tall' : 'base', crypto.randomUUID(), 600, next.room.height), 'oven'));
  }
  if (preferences.hood !== previous.hood) replace('hood', preferences.hood === 'none' ? undefined : createHood(crypto.randomUUID(), preferences.hood === 'wall' ? 'wall' : 'under-cabinet'));
  if (preferences.refrigerator !== previous.refrigerator) replace('refrigerator', preferences.refrigerator === 'none' ? undefined : createRefrigerator(crypto.randomUUID(), preferences.refrigerator === 'freestanding' ? 'side-by-side' : 'top-bottom'));
  if (preferences.layout !== previous.layout) next = arrangeKitchen(next, preferences.layout);
  return next;
}

export function saveKitchenFlowDraft(storage: Pick<Storage, 'setItem'>, input: { userId?: string; draftId: string; design: ModularKitchen; preferences: KitchenSuggestionPreferences; stage: KitchenFlowStage }) {
  storage.setItem(`tavilga-kitchen-draft-${input.userId ?? 'guest'}-${input.draftId}`, JSON.stringify({ id: '', name: 'Миний гал тогоо', design: input.design, preferences: input.preferences, flowStage: input.stage }));
  return `/kitchen?editor=1&space=1&draft=${input.draftId}`;
}

export const KITCHEN_FLOW_LABELS = ['1. Гал тогоо','2. Хэмжээ','3. Төхөөрөмж','4. 2D план','5. Өөрөө тохижуулах','6. Таван санал','7. Дуусгах'];
