import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/school.js';
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.SESSION_SECRET='x'.repeat(64);process.env.APP_ORIGIN='https://school.example';
async function call(headers,body){let code=200,value;const res={setHeader(){},status(n){code=n;return this},json(v){value=v;return this}};await handler({method:'POST',headers,body},res);return {code,value};}
test('API rejects cross-origin writes before database access',async()=>{const a=await call({origin:'https://attacker.example'},{op:'save'});assert.equal(a.code,403);});
test('API ignores forged roles without a valid session',async()=>{const a=await call({origin:process.env.APP_ORIGIN},{op:'save',profile:{role:'principal'}});assert.equal(a.code,401);});
test('API rejects unsigned session cookies',async()=>{const a=await call({origin:process.env.APP_ORIGIN,cookie:'school_session=e30.forged'},{op:'state'});assert.equal(a.code,401);});
