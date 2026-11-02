import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function context(refresh){const c={restoringSession:false,sessionRestoreError:'',render(){},toast(){},refresh};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function restorePortalSession(){'),source.indexOf("\nif(routeName()==='portal')restorePortalSession();")),c);return c;}
test('network or temporary service failures retain a retryable session restoration screen',async()=>{
 for(const status of [undefined,503,429]){const c=context(async()=>{throw Object.assign(Error('Please retry'),{status});});await c.restorePortalSession();assert.equal(c.restoringSession,true);assert.equal(c.sessionRestoreError,'Please retry');}
});
test('rejected or disabled accounts return to sign-in, rather than an endless restoration screen',async()=>{
 for(const status of [401,403]){const c=context(async()=>{throw Object.assign(Error('Sign in'),{status});});await c.restorePortalSession();assert.equal(c.restoringSession,false);}
});
test('only principal and VP navigation include the alumni list',()=>{
 for(const role of ['principal','vp','hod','teacher','discipline','staff','student','parent','content_creator']){
  const c={profile:{role},tabs:{overview:'Home',alumni:'Alumni'},attendanceOverview:()=>false,requestingStaff:()=>false};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function allowedTabs(){'),source.indexOf('function portal(){')),c);assert.equal(c.allowedTabs().includes('alumni'),['principal','vp'].includes(role));
 }
});
