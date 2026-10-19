-- Additional measured kitchen families. Keep existing catalog dimensions intact.
insert into public.kitchen_modules(code,name,cabinet_type,width_mm,height_mm,depth_mm)
values
 ('BASE-150','150 мм нарийн карго шүүгээ','base',150,840,600),
 ('BASE-200','200 мм нарийн карго шүүгээ','base',200,840,600),
 ('CORNER-WALL-600','600 мм булангийн дээд шүүгээ','wall',600,720,350),
 ('CORNER-WALL-680','680 мм булангийн дээд шүүгээ','wall',680,720,350),
 ('FRIDGE-WALL-600-H400-D600','600 мм хөргөгчний дээд шүүгээ','wall',600,400,600),
 ('FRIDGE-WALL-900-H400-D600','900 мм хөргөгчний дээд шүүгээ','wall',900,400,600),
 ('ISLAND-900-H840-D900','900 мм гал тогооны арал','base',900,840,900),
 ('ISLAND-1200-H840-D900','1200 мм гал тогооны арал','base',1200,840,900)
on conflict(code) do nothing;
notify pgrst,'reload schema';
