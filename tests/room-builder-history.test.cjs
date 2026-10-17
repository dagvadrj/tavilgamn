const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const builder = loadSource('src/lib/roomBuilderDraft.ts');
const { createRoomBuilderHistory, reduceRoomBuilderHistory: reduce } = loadSource('src/lib/roomBuilderHistory.ts');
const { createOpening } = loadSource('src/lib/roomOpenings.ts');
const initial = () => builder.initializeRoomBuilder({width:5,depth:4,height:2.7,wallColor:'#123456',floorColor:'#654321',floorMaterial:'legacy'});

test('opening an existing plain room preserves finishes and canonicalizes only its outline', () => {
  const room = {width:5,depth:4,height:2.7,wallColor:'#123456',floorColor:'#654321',floorMaterial:'legacy',wallMaterials:{north:{color:'#aabbcc',material:'wall-paint'}}};
  const draft = builder.initializeRoomBuilder(room);
  for (const key of ['wallColor','floorColor','floorMaterial','wallMaterials']) assert.deepEqual(draft[key],room[key]);
  assert.equal(draft.outline.length,4);
  assert.equal(builder.selectedRoomTemplate(draft),'rectangle');
  assert.equal(room.outline,undefined);
  draft.wallMaterials.north.color='#ffffff';
  assert.equal(room.wallMaterials.north.color,'#aabbcc');
});

test('a multi-sample door gesture is one reversible history entry', () => {
  const draft = initial();
  draft.openings=[{...createOpening('door-single','north',.3),segmentId:draft.outline[0].segmentId}];
  let history=createRoomBuilderHistory(draft);
  history=reduce(history,{type:'begin'});
  for(const position of [.32,.34,.4,.45]) history=reduce(history,{type:'change',draft:{...history.draft,openings:[{...history.draft.openings[0],position}]}});
  assert.equal(history.past.length,0);
  history=reduce(history,{type:'end'});
  assert.equal(history.past.length,1);
  history=reduce(history,{type:'undo'});
  assert.deepEqual(history.draft,draft);
  history=reduce(history,{type:'redo'});
  assert.equal(history.draft.openings[0].position,.45);
});

test('invalid geometry keeps the last valid sample; cancellation restores the entire draft and redo', () => {
  let history=createRoomBuilderHistory(initial());
  const original=structuredClone(history.draft);
  history=reduce(history,{type:'change',draft:builder.chooseRoomTemplate(history.draft,'u')});
  history=reduce(history,{type:'undo'});
  const future=structuredClone(history.future);
  history=reduce(history,{type:'begin'});
  history=reduce(history,{type:'change',draft:{...history.draft,wallColor:'#abcdef'}});
  const last=structuredClone(history.draft);
  history=reduce(history,{type:'change',draft:{...history.draft,width:0}});
  assert.ok(history.error);
  assert.deepEqual(history.draft,last);
  history=reduce(history,{type:'cancel'});
  assert.deepEqual(history.draft,original);
  assert.deepEqual(history.future,future);
  assert.equal(history.past.length,0);
  assert.equal(history.error,null);
});

test('no-op transactions retain redo; a completed new edit discards it and snapshots do not alias', () => {
  let history=createRoomBuilderHistory(initial());
  const candidate={...history.draft,wallColor:'#abcdef'};
  history=reduce(history,{type:'change',draft:candidate});
  candidate.wallColor='#000000';
  assert.equal(history.draft.wallColor,'#abcdef');
  history=reduce(history,{type:'undo'});
  history=reduce(reduce(history,{type:'begin'}),{type:'end'});
  assert.equal(history.future.length,1);
  history=reduce(history,{type:'begin'});
  history=reduce(history,{type:'change',draft:{...history.draft,floorColor:'#fedcba'}});
  history=reduce(history,{type:'end'});
  assert.equal(history.future.length,0);
  assert.equal(history.past.length,1);
});

test('undoing an eight-wall template safely resolves a previously selected last wall', () => {
  let history=createRoomBuilderHistory(initial());
  history=reduce(history,{type:'change',draft:builder.chooseRoomTemplate(history.draft,'u')});
  assert.equal(builder.builderWallIndex(7,history.draft.outline.length),7);
  history=reduce(history,{type:'undo'});
  const index=builder.builderWallIndex(7,history.draft.outline.length);
  assert.equal(index,3);
  assert.ok(history.draft.outline[index]);
  assert.equal(builder.selectedRoomTemplate(history.draft),'rectangle');
  for(const key of ['rectangle','l','cut','t','u','beveled']) {
    assert.equal(builder.selectedRoomTemplate(builder.chooseRoomTemplate(history.draft,key)),key);
  }
});

test('each stage exposes only its intended interaction and unfinished drafts do not touch saved designs', () => {
  assert.deepEqual([0,1,2,3].map(i=>builder.builderInteraction(i).view),['plan','plan','perspective','perspective']);
  assert.equal(builder.builderInteraction(1).wallEditing,true);
  assert.equal(builder.builderInteraction(1,true).orbit,true);
  assert.equal(builder.builderInteraction(1,true).wallEditing,false);
  assert.equal(builder.builderInteraction(2).openingEditing,true);
  assert.equal(builder.builderInteraction(3).openingEditing,false);
  const source=initial(),before=structuredClone(source);
  let history=createRoomBuilderHistory(source);
  history=reduce(history,{type:'change',draft:builder.chooseRoomTemplate(history.draft,'beveled')});
  assert.deepEqual(source,before);
  assert.notDeepEqual(history.draft.outline,source.outline);
});
