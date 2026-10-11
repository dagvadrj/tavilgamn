const test = require('node:test');
const assert = require('node:assert/strict');
const {loadSource} = require('./helpers/load-source.cjs');
const {kitchenWallPanels} = loadSource('src/lib/kitchenWallPanels.ts');
const {roomWalls} = loadSource('src/lib/kitchenCabinets.ts');

test('3D walls have exactly the door and window holes drawn in the room plan on all four walls', () => {
  const size = {width:4000, depth:3000, height:2600};
  for (const wall of roomWalls(size)) {
    const horizontal = wall.id === 'front' || wall.id === 'back';
    const make = (id, kind, centre, width) => ({ id, kind, wall:wall.id, width, depth:100, x: horizontal ? centre : wall.start.x, z: horizontal ? wall.start.z : centre });
    const room = {...size, items:[make('door','door',600,900), make('window','window',2000,1000)]};
    const {solids, openings} = kitchenWallPanels(wall, room);
    assert.equal(openings.length,2);
    const length = horizontal ? 4 : 3;
    assert.ok(Math.abs(solids.reduce((sum,p) => sum + p.width*p.height,0) - (length*2.6 - .9*2.1 - 1*1.1)) < 1e-8);
    for (const opening of openings) for (const panel of solids) {
      const overlapsX = panel.x-panel.width/2 < opening.x+opening.width/2-1e-8 && panel.x+panel.width/2 > opening.x-opening.width/2+1e-8;
      const overlapsY = panel.y-panel.height/2 < opening.top-1e-8 && panel.y+panel.height/2 > opening.bottom+1e-8;
      assert.ok(!(overlapsX && overlapsY));
    }
    assert.ok(solids.every(p=>p.width>0 && p.height>0));
  }
});

test('walls without openings stay whole and open-front rooms omit their front wall', () => {
  const room={width:4000,depth:3000,height:2600,openFront:true};
  const walls=roomWalls(room);
  assert.equal(walls.length,3);
  for(const wall of walls) {
    const panels=kitchenWallPanels(wall,room);
    assert.equal(panels.openings.length,0);
    assert.equal(panels.solids.length,1);
    assert.equal(panels.solids[0].height,2.6);
  }
});
