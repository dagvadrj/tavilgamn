// Compares two previously captured screenshots; does not operate a browser.
const sharp=require('sharp');
async function compareScreenshots(baseline,actual,{maxChangedRatio=.005,channelTolerance=24}={}) {
  const a=await sharp(baseline).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(actual).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(a.info.width!==b.info.width||a.info.height!==b.info.height)throw new Error('Viewport mismatch: recapture at the baseline dimensions.');
  let changed=0;
  for(let i=0;i<a.data.length;i+=4)if([0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>channelTolerance))changed++;
  const ratio=changed/(a.info.width*a.info.height);
  if(ratio>maxChangedRatio)throw new Error(`Visual regression: ${(ratio*100).toFixed(3)}% pixels changed (limit ${maxChangedRatio*100}%).`);
  return {width:a.info.width,height:a.info.height,changedRatio:ratio};
}
module.exports={compareScreenshots};
if(require.main===module){
  const [baseline,actual]=process.argv.slice(2);
  if(!baseline||!actual){console.error('Usage: node scripts/verify/kitchen-visual.cjs baseline.png actual.png');process.exitCode=2;}
  else compareScreenshots(baseline,actual).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
