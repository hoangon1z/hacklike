const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const filename=path.resolve(__dirname,'../src/depositStatus.ts');
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});
const helper=new Module(filename,module);helper._compile(compiled.outputText,filename);
const {depositSucceeded,depositNotice}=helper.exports;
const request={publicId:'DEP-TEST',status:'WAITING',requestedVnd:'500000',creditedVnd:null};
test('Only final status with confirmed credited VND can trigger success',()=>{
 for(const status of ['CREATED','WAITING','CONFIRMING','UNDERPAID','EXPIRED','MANUAL_REVIEW','UNMATCHED','REJECTED'])assert.equal(depositSucceeded({...request,status,creditedVnd:'500000'}),false);
 for(const status of ['COMPLETED','OVERPAID']){
  assert.equal(depositSucceeded({...request,status,creditedVnd:'500000'}),true);
  for(const creditedVnd of [null,'NaN','0','499999'])assert.equal(depositSucceeded({...request,status,creditedVnd}),false);
 }
});
test('Rejected and canceled results are distinct; expiry is not payment failure',()=>{
 assert.equal(depositNotice({...request,status:'REJECTED'}).title,'Nạp tiền không thành công');
 assert.equal(depositNotice({...request,status:'CANCELED'}).title,'Giao dịch đã bị hủy');
 assert.equal(depositNotice({...request,status:'EXPIRED'}),null);
 assert.equal(depositNotice(request),null);
});
