const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/serviceReactions.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const helper = new Module(filename, module);
helper._compile(compiled.outputText, filename);
const { groupReactionServices, serviceReaction } = helper.exports;

function service(id, code, family = 'Sv61', extras = {}) {
  const name = `${family} | Like FB | Chọn cảm xúc |( ${code} )`;
  return { id, name, providerName: name, platform: 'LIKE BÀI VIẾT ( FB )', ...extras };
}

test('Sad-first API ordering does not make Sad the family default; exact variant IDs and prices survive', () => {
  const rows = [service('10463', 'sad', 'Sv61', {price:20}), service('10458', 'like', 'Sv61', {price:10}), service('10459', 'love', 'Sv61', {price:15})];
  const groups = groupReactionServices(rows);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].variants.map(v => v.id), ['10458', '10459', '10463']);
  assert.equal(groups[0].variants.find(v => serviceReaction(v) === 'love').price, 15);
  assert.equal(rows[0].id, '10463'); // Input and existing orders stay untouched.
  assert.ok(!groups[0].name.includes('( sad )'));
});

test('only available variants from the same family and category are grouped', () => {
  const groups = groupReactionServices([service('a','like'), service('b','love'), service('c','sad','Sv10'), service('d','like','Sv61',{platform:'OTHER'})]);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].variants.map(serviceReaction), ['like','love']);
});

test('provider name remains authoritative when admin renames display names; generic likes are not guessed', () => {
  assert.equal(serviceReaction(service('a', 'care', 'Sv6', {name:'Dịch vụ Việt Nam'})), 'care');
  const normal = {id:'n',name:'Like TikTok ( love )',providerName:'Like TikTok ( love )',platform:'TikTok'};
  assert.equal(serviceReaction(normal), null);
  assert.equal(groupReactionServices([normal])[0].name, normal.name);
  assert.equal(serviceReaction({id:'x',name:'Chọn cảm xúc (unknown)',platform:'FB'}), null);
});
