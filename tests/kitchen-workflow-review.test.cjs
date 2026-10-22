const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const { KitchenWorkflowReview } = loadSource('src/features/kitchen-planner/components/KitchenWorkflowReview.tsx', {
  react: { ...React, useEffect(){}, useRef(){ return {current:null}; } },
  '@/components/PlannerLink': { PlannerLink: props => React.createElement('a',props) },
});
const props = {
  measurement:false,name:'Draft',bom:{items:[{id:'module',label:'Cabinet',quantity:1,unit:'ш',dimensions:'800 mm',material:'CMS material',unitPrice:null,included:false}],knownSubtotal:0,unpricedCount:1,complete:false},
  itemCount:1,issueMessages:[],plan:React.createElement('p',null,'PLAN'),report:null,quoteRequest:null,saveActions:React.createElement('button',null,'SAVE'),exports:null,onEdit(){},onEstimate(){},onMeasurement(){},
};
test('an unpriced estimate remains visibly incomplete instead of claiming a free production-ready kitchen', () => {
  const html=renderToStaticMarkup(KitchenWorkflowReview(props));
  assert.match(html,/Үнэ тодруулна/);
  assert.match(html,/мөрийн үнэ дутуу/);
  assert.doesNotMatch(html,/0 <span>₮/);
  assert.match(html,/Cabinet/);
});
test('the measurement screen offers an existing factory route without fabricating submission success', () => {
  const html=renderToStaticMarkup(KitchenWorkflowReview({...props,measurement:true}));
  assert.match(html,/href="\/kitchens"/);
  assert.match(html,/биечлэн хэмж/);
  assert.match(html,/SAVE/);
  assert.doesNotMatch(html,/амжилттай илгээгд/);
});
test('an eligible project gets its real quote form rather than the factory-selection fallback', () => {
  const html=renderToStaticMarkup(KitchenWorkflowReview({...props,measurement:true,quoteRequest:React.createElement('form',null,'REAL QUOTE')}));
  assert.match(html,/REAL QUOTE/);
  assert.doesNotMatch(html,/href="\/kitchens"/);
});
