const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('constants/order-ui.ts','utf8');const api={};vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api});
for(const value of ['', '0', '-1','1.234','12..3','1e3','Infinity'])assert.equal(api.orderPrice(value),null,value);
assert.equal(api.orderPrice('6.25'),6.25);assert.equal(api.orderPrice('0.01'),.01);
for(const value of ['', '0','1.5','-1','abc','9007199254740992'])assert.equal(api.orderQuantity(value),null,value);
assert.equal(api.orderQuantity('2'),2);assert.equal(api.orderTotal(6.25,2),12.5);assert.equal(api.orderTotal(null,2),null);assert.equal(api.orderTotal(90071992547409,99),null);
console.log('19 input and total boundary assertions passed');
