"use client";

import { Plus } from "lucide-react";
import { KITCHEN_STANDARD_CHOICES, standardCabinetWidths, type KitchenStandardType } from "@/lib/kitchenStandardCatalog";
import type { CabinetWidth } from "@/lib/kitchenCabinets";

export function KitchenStandardLibrary({ type, width, disabled, atLimit, onType, onWidth, onAdd }: {
  type: KitchenStandardType; width: CabinetWidth; disabled: boolean; atLimit: boolean;
  onType: (type: KitchenStandardType) => void; onWidth: (width: CabinetWidth) => void; onAdd: () => void;
}) {
  const widths = standardCabinetWidths(type);
  const selected = KITCHEN_STANDARD_CHOICES.find(choice => choice.id === type)!;
  const groups = [
    { title: "Шүүгээ", ids: ["base", "wall", "tall"] },
    { title: "Хоол хийх, угаах", ids: ["hob", "sink", "oven-base", "oven-tall"] },
    { title: "Сорогч, хөргөгч", ids: ["hood-integrated", "hood-wall", "fridge-top", "fridge-side"] },
  ];
  return <section className="kp-panel planner-standard-builder" aria-label="Бэлэн шүүгээ, төхөөрөмж">
    <div className="planner-inspector-intro"><h2>Шүүгээ, төхөөрөмж сонгох</h2><p>Төрлөө сонгоод өргөнөө тохируулна. Нэмсний дараа 3D дээр байрлалыг нь өөрчилж болно.</p></div>
    <fieldset className="km-fields" disabled={disabled}>
      {groups.map(group => <div className="kitchen-choice-group" key={group.title}>
        <h3>{group.title}</h3>
        <div className="reference-type-grid" role="group" aria-label={group.title}>
          {KITCHEN_STANDARD_CHOICES.filter(choice => group.ids.includes(choice.id)).map(choice =>
            <button type="button" key={choice.id} aria-pressed={type === choice.id} onClick={() => onType(choice.id)}>
              <span className="reference-cabinet-symbol" data-type={choice.symbol} aria-hidden="true"/>
              <span>{choice.label}</span>
            </button>)}
        </div>
      </div>)}
      <div className="kitchen-add-summary">
        <span className="kitchen-eyebrow">Сонгосон төрөл</span><strong>{selected.label}</strong>
        {widths.length > 0 ? <div className="kitchen-width-control">
          <span>Өргөн <small>см</small></span>
          <div className="kitchen-width-options" role="group" aria-label="Шүүгээний өргөн, сантиметр">
            {widths.map(value => <button type="button" key={value} aria-pressed={width === value} onClick={() => onWidth(value)}>{value / 10}</button>)}
          </div>
        </div> : <p>Стандарт хэмжээтэй. Нэмсний дараа тохиргоог нь шалгаарай.</p>}
        <button type="button" className="kp-primary" disabled={atLimit} onClick={onAdd}><Plus size={16} aria-hidden="true"/> {selected.label} нэмэх</button>
        {atLimit && <p role="status">80 шүүгээний хязгаарт хүрсэн. Шүүгээ хасаж байж шинээр нэмнэ.</p>}
      </div>
    </fieldset>
  </section>;
}
