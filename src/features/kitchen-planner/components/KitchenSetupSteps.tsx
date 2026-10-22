"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CookingPot } from 'lucide-react';
import type { ModularKitchen } from '@/lib/kitchenCabinets';
import type { KitchenFlowStage } from '@/lib/kitchenFlow';
import { resizeKitchenRoom } from '@/lib/kitchenSpace';
import { DimensionInput } from './PlannerPanels';
import '@/features/planner/components/planner-entry-theme.css';

export function KitchenSetupSteps({ stage, kitchen, disabled, message, onChange, onStage }: {
  stage: 'room' | 'size'; kitchen: ModularKitchen; disabled: boolean; message: string;
  onChange: (kitchen: ModularKitchen) => boolean; onStage: (stage: KitchenFlowStage) => void;
}) {
  const [error, setError] = useState("");
  return <section className="kitchen-setup-steps planner-entry-theme">
    <div className="kitchen-setup-card">
      <CookingPot size={32} />
      <p>Өрөө · 1 / 4</p>
      <h1>{stage === 'room' ? 'Гал тогоогоо төлөвлөх' : 'Өрөөний хэмжээ'}</h1>
      <p>{'Алхам солиход таны сонголт, тавилгын байрлал хадгалагдана.'}</p>
      {stage === 'room' ? <div className="kitchen-setup-room-choice"><CookingPot size={24} /><strong>{'Гал тогоо'}</strong><span>{kitchen.room.width} × {kitchen.room.depth} мм</span></div> : <div className="kitchen-setup-fields">
        {(['width','depth','height'] as const).map((axis, index) => <DimensionInput key={axis + kitchen.room[axis]} label={['Өргөн','Урт','Өндөр'][index]} value={kitchen.room[axis]} min={axis === 'height' ? 1800 : 2000} max={axis === 'height' ? 4000 : 8000} disabled={disabled} onCommit={value => { try { if (onChange({ ...kitchen, room: resizeKitchenRoom(kitchen.room, { [axis]: value }) })) setError(""); } catch(reason) { setError((reason as Error).message); } }} />)}
      </div>}
      {(error || message) && <p role="alert">{error || message}</p>}
      <footer>{stage === 'size' && <button type="button" onClick={() => onStage('room')}><ArrowLeft size={17}/>{'Буцах'}</button>}<button type="button" disabled={disabled} onClick={() => onStage(stage === 'room' ? 'size' : 'equipment')}>{'Үргэлжлүүлэх'}<ArrowRight size={17}/></button></footer>
    </div>
  </section>;
}
