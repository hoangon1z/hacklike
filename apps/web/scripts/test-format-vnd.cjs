const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/utils/formatVND.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}});
const helper = new Module(filename, module);
helper._compile(compiled.outputText, filename);
const {formatVND} = helper.exports;
const nbsp = '\u00a0'; // Intl's non-breaking space keeps the currency with the amount.
test('VND display rounds both numeric and API string amounts with vi-VN grouping',()=>{
  for (const [value,expected] of [[0,'0'],[226,'226'],[26369,'26.369'],[207916.56,'207.917'],[488300,'488.300'],[-207916.56,'-207.917'],[0.49,'0'],[0.5,'1']]) {
    assert.equal(formatVND(value),expected+nbsp+'₫');
    assert.equal(formatVND(String(value)),expected+nbsp+'₫');
  }
});
test('Missing, invalid and non-finite values safely display zero',()=>{
  for (const value of [null,undefined,NaN,Infinity,-Infinity,'NaN','Infinity','bad','',' ',{},[],true,Symbol('invalid'),-0]) {
    assert.equal(formatVND(value),'0'+nbsp+'₫');
  }
});
test('Formatting never changes the original decimal value',()=>{
  const wallet={balance:'207916.56',reserved:'226.49'};
  formatVND(wallet.balance);formatVND(wallet.reserved);
  assert.deepEqual(wallet,{balance:'207916.56',reserved:'226.49'});
});
