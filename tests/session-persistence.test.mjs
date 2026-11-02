import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import handler from '../api/school.js';
process.env.SUPABASE_URL='https://session.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';process.env.SESSION_SECRET='session-test-secret-with-more-than-32-characters';process.env.APP_ORIGIN='https://school.test';
const duration=30*24*60*60,profile={id:'staff',kind:'profile',data:{name:'TEST TEACHER',role:'teacher',authId:'user',authEpoch:2,active:true}};
function signed(extra={}){const data=Buffer.from(JSON.stringify({authId:'user',accessToken:'access-old',refreshToken:'refresh-old',authEpoch:2,exp:Date.now()+duration*1000,...extra})).toString('base64url');return 'school_session='+data+'.'+crypto.createHmac('sha256',process.env.SESSION_SECRET).update(data).digest('base64url');}
const decode=cookie=>JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url'));
async function request(body,cookie='',config={}){
 const original=globalThis.fetch,calls=[];let status=200,value,headers={};
 globalThis.fetch=async(url,options={})=>{
  calls.push({url,options});
  if(url.includes('/rpc/school_rate_limit'))return Response.json(1);
  if(url.includes('grant_type=password'))return Response.json({user:{id:'user'},access_token:'access-old',refresh_token:'refresh-old'});
  if(url.includes('grant_type=refresh_token'))return config.refreshFailure?Response.json({error:'unavailable'},{status:config.refreshFailure}):Response.json({user:{id:config.wrongUser?'other':'user'},access_token:'access-new',refresh_token:'refresh-new'});
  if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer access-new'||!config.expiredAccess?Response.json({id:'user'}):Response.json({error:'expired'},{status:config.authFailure||401});
  if(url.includes('/school_records'))return Response.json(url.includes('kind=in.(profile')?[{...profile,data:{...profile.data,...config.profile}}]:[]);
  throw Error('Unexpected fixture URL');
 };
 try{await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN,cookie},body},{setHeader(k,v){headers[k]=v;},status(n){status=n;return this;},json(v){value=v;return this;}});}finally{globalThis.fetch=original;}
 return {status,value,headers,calls};
}
test('password login persists for 30 days using secure HTTP-only cookies and no JSON token disclosure',async()=>{
 const r=await request({op:'login',email:'teacher@example.test',password:'example-pass'});assert.equal(r.status,200);
 for(const part of ['HttpOnly','Secure','SameSite=Strict',`Max-Age=${duration}`])assert.ok(r.headers['Set-Cookie'].includes(part));
 assert.equal(decode(r.headers['Set-Cookie']).refreshToken,'refresh-old');assert.ok(!JSON.stringify(r.value).includes('refresh-old'));
});
test('idle expiry refreshes access and rotates the cookie, and the next reload retains the account',async()=>{
 const r=await request({op:'state'},signed(),{expiredAccess:true});assert.equal(r.status,200);assert.equal(r.value.profile.id,'staff');
 const renewed=decode(r.headers['Set-Cookie']);assert.equal(renewed.accessToken,'access-new');assert.equal(renewed.refreshToken,'refresh-new');
 assert.equal(r.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);assert.ok(!JSON.stringify(r.value).includes('refresh-new'));
 const reload=await request({op:'state'},r.headers['Set-Cookie'].split(';')[0]);assert.equal(reload.status,200);assert.equal(reload.headers['Set-Cookie'],undefined);
});
test('a recent parallel request does not rewrite tokens, while continued use renews an older cookie',async()=>{
 assert.equal((await request({op:'state'},signed())).headers['Set-Cookie'],undefined);
 const old=await request({op:'state'},signed({exp:Date.now()+86400000}));assert.equal(old.status,200);assert.ok(decode(old.headers['Set-Cookie']).exp>Date.now()+29*86400000);
});
test('invalid refresh tokens and mismatched identities cannot recover access',async()=>{
 for(const config of [{refreshFailure:400},{wrongUser:true}]){const r=await request({op:'state'},signed(),{expiredAccess:true,...config});assert.equal(r.status,401);assert.equal(r.headers['Set-Cookie'],undefined);}
});
test('account reset barriers and disabled accounts apply after token renewal',async()=>{
 const reset=await request({op:'state'},signed(),{expiredAccess:true,profile:{authEpoch:3}});assert.equal(reset.status,401);assert.match(reset.value.error,/reset/);assert.equal(reset.headers['Set-Cookie'],undefined);
 const disabled=await request({op:'state'},signed(),{expiredAccess:true,profile:{active:false}});assert.equal(disabled.status,403);assert.equal(disabled.headers['Set-Cookie'],undefined);
});
test('temporary provider failures return retryable errors without clearing the cookie',async()=>{
 for(const config of [{authFailure:503},{refreshFailure:503},{refreshFailure:429}]){const r=await request({op:'state'},signed(),{expiredAccess:true,...config});assert.equal(r.status,503);assert.equal(r.headers['Set-Cookie'],undefined);}
});
test('expired or tampered cookies remain invalid and explicit logout clears the cookie',async()=>{
 assert.equal((await request({op:'state'},signed({exp:Date.now()-1}))).status,401);
 assert.equal((await request({op:'state'},signed()+'tampered')).status,401);
 const out=await request({op:'logout'},signed());assert.equal(out.status,200);assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
});
