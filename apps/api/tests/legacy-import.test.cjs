const test=require('node:test');
const assert=require('node:assert/strict');
const {parseLegacy}=require('../scripts/legacy-csv.cjs');
const {classify,summary}=require('../scripts/import-legacy-users.cjs');
const {JwtAuthGuard}=require('../dist/auth/jwt-auth.guard');
const {AccountController}=require('../dist/account.controller');
const {hash,compare}=require('bcryptjs');
const header='Tên đăng nhập;Email;Chức vụ;SDT;Số dư;Tổng nạp;Ngày tạo\n';
const row='customer;customer@example.com;Thành Viên;="0123456789";="1234";="5000";2025/01/02 03:04:05';
test('legacy exporter wrappers, BOM, CRLF, phone and Vietnam dates',()=>{
 const [r]=parseLegacy('\uFEFF'+header.replace('\n','\r\n')+row+'\r\n');
 assert.equal(r.openingBalance,'1234');assert.equal(r.historicalDeposited,'5000');assert.equal(r.phone,'0123456789');assert.equal(r.legacyCreatedAt.toISOString(),'2025-01-01T20:04:05.000Z');
});
test('reject duplicate emails, negative money, elevated roles, malformed dates',()=>{
 for(const text of [row+'\n'+row,row.replace('="1234"','="-1"'),row.replace('Thành Viên','Admin'),row.replace('2025/01/02','2025/02/30')])assert.throws(()=>parseLegacy(header+text));
});
test('normal CSV quoted fields and escaped quotes remain intact',()=>{
 const [r]=parseLegacy(header+row.replace('customer;','"customer; ""VIP""";'));assert.equal(r.legacyUsername,'customer; "VIP"');
});
test('replay skips imported rows; existing users are not modified; changed snapshots conflict',async()=>{
 const rows=parseLegacy(header+row),r=rows[0];
 const plan=await classify({user:{findMany:async()=>[{email:r.email,legacyImport:{rowHash:r.rowHash}}]}},rows);
 assert.equal(plan.fresh.length,0);assert.equal(plan.already.length,1);assert.equal(summary(plan,'hash').openingBalanceVnd,'0');
 assert.equal((await classify({user:{findMany:async()=>[{email:r.email,legacyImport:null}]}},rows)).skipped.length,1);
 assert.equal((await classify({user:{findMany:async()=>[{email:r.email,legacyImport:{rowHash:'different'}}]}},rows)).changed.length,1);
 assert.equal(summary(await classify({user:{findMany:async()=>[]}},rows),'hash').openingBalanceVnd,'1234');
});
function guardContext(){return {getHandler:()=>()=>{},getClass:()=>class{},switchToHttp:()=>({getRequest:()=>({cookies:{svn_access:'test'}})})};}
test('password-change requirement enforced server-side and only allowed routes pass',async()=>{
 let allowed=false;const reflector={getAllAndOverride:key=>key==='isPublic'?false:allowed};
 const guard=new JwtAuthGuard(reflector,{verifyAsync:async()=>({sub:'u',v:0})},{getOrThrow:()=>''},{user:{findUnique:async()=>({email:'customer@example.com',role:'CUSTOMER',status:'ACTIVE',tokenVersion:0,passwordChangeRequired:true})}});
 await assert.rejects(()=>guard.canActivate(guardContext()),e=>e.getStatus()===403&&e.getResponse().code==='PASSWORD_CHANGE_REQUIRED');
 allowed=true;assert.equal(await guard.canActivate(guardContext()),true);
});
test('changing password clears requirement and revokes old sessions; same password rejected',async()=>{
 const old='Initial-test-password',passwordHash=await hash(old,4);let updates;
 const db={user:{findUniqueOrThrow:async()=>({passwordHash}),update:args=>{updates=args.data;return Promise.resolve({})}},refreshSession:{updateMany:()=>Promise.resolve({})},$transaction:async ops=>Promise.all(ops)};
 const controller=new AccountController(db);
 await assert.rejects(()=>controller.password({sub:'u'},{currentPassword:old,newPassword:old}),e=>e.getResponse().code==='PASSWORD_UNCHANGED');
 await controller.password({sub:'u'},{currentPassword:old,newPassword:'Separate-new-password'});
 assert.equal(updates.passwordChangeRequired,false);assert.deepEqual(updates.tokenVersion,{increment:1});assert.equal(await compare('Separate-new-password',updates.passwordHash),true);
});
