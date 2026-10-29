-- Full kitchen module catalog: tall/wall height ranges, corner, over-fridge and island sizes.
-- Codes follow kitchenModuleDefinition(): PREFIX-W for standard H/D, PREFIX-W-H…-D… otherwise.
-- Rows whose exact type+size already exist (under any legacy code) are skipped.
begin;

with candidates(code,name,cabinet_type,width_mm,height_mm,depth_mm) as (
  -- Base: wider bodies.
  select 'BASE-'||w, w||' мм доод шүүгээ', 'base', w, 840, 600
  from unnest(array[150,200,300,400,450,500,600,700,800,900,1000,1100,1200]) w
  union all
  -- Wall: short (above hood/fridge), standard and tall upper cabinets.
  select 'WALL-'||w||'-H'||h||'-D350', w||' мм дээд шүүгээ · '||h||'×350', 'wall', w, h, 350
  from unnest(array[300,400,450,500,600,700,800,900,1000,1200]) w,
       unnest(array[360,400,540,600,900,960,1000,1200]) h
  union all
  -- Tall: pantry, oven/microwave tower and fridge housing heights.
  select 'TALL-'||w||'-H'||h||'-D'||d, w||' мм өндөр шүүгээ · '||h||'×'||d, 'tall', w, h, d
  from unnest(array[300,400,450,500,600,700,800,900]) w,
       unnest(array[1800,2000,2100,2200,2300,2400]) h,
       unnest(array[560,600]) d
  union all
  -- Corner base (L/blind corner) and corner wall.
  select 'CORNER-BASE-'||w, w||' мм булангийн доод шүүгээ', 'corner', w, 840, 600
  from unnest(array[900,1000,1100,1200]) w
  union all
  select 'CORNER-WALL-'||w||'-H'||h||'-D350', w||' мм булангийн дээд шүүгээ · '||h, 'wall', w, h, 350
  from unnest(array[600,650,680]) w, unnest(array[720,900]) h
  union all
  -- Over-fridge wall cabinets.
  select 'FRIDGE-WALL-'||w||'-H'||h||'-D'||d, w||' мм хөргөгчний дээд шүүгээ · '||h||'×'||d, 'wall', w, h, d
  from unnest(array[600,700,900]) w, unnest(array[300,400,600]) h, unnest(array[350,600]) d
  union all
  -- Islands.
  select 'ISLAND-'||w||'-H'||h||'-D900', w||' мм гал тогооны арал · '||h, 'base', w, h, 900
  from unnest(array[900,1200,1500,1800,2400]) w, unnest(array[840,900]) h
)
insert into public.kitchen_modules(code,name,cabinet_type,width_mm,height_mm,depth_mm)
select c.code,c.name,c.cabinet_type,c.width_mm,c.height_mm,c.depth_mm
from candidates c
where not exists (
  select 1 from public.kitchen_modules m
  where m.cabinet_type=c.cabinet_type and m.width_mm=c.width_mm
    and m.height_mm=c.height_mm and m.depth_mm=c.depth_mm
    and split_part(m.code,'-',1)=split_part(c.code,'-',1)
)
on conflict(code) do nothing;

notify pgrst,'reload schema';
commit;
