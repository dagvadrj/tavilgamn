"use client";

import Image from "next/image";
import { Box, Plus } from "lucide-react";
import { useState } from "react";

export function PlannerModelCard({ name, image, dimensions, detail, file, disabled, onAdd, onPrefetch }: {
  name: string; image?: string | null; dimensions: string; detail?: string;
  file: string; disabled?: boolean; onAdd: () => void; onPrefetch?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="planner-model-card" disabled={disabled}
    onClick={onAdd} onPointerEnter={onPrefetch} onFocus={onPrefetch} onTouchStart={onPrefetch}
    aria-label={`${name} — өрөөнд нэмэх`}>
    <div className="planner-model-image">
      {image && !failed ? <Image src={image} alt={name} fill sizes="170px" unoptimized onError={() => setFailed(true)} /> : <Box size={36} />}
      <span className="planner-model-format">GLB</span>
      <span className="planner-model-add"><Plus size={17}/></span>
    </div>
    <div className="planner-model-info"><strong>{name}</strong><span>{dimensions}</span>
      {detail && <span>{detail}</span>}<small title={file}>{file}</small>
    </div>
  </button>;
}
