import test from 'node:test';
import assert from 'node:assert/strict';
import {temporaryPassword} from '../src/login-password.js';
test('temporary logins have exactly nine characters and all character groups',()=>{
 const samples=Array.from({length:1000},temporaryPassword);
 for(const p of samples){assert.equal(p.length,9);assert.match(p,/[A-Z]/);assert.match(p,/[a-z]/);assert.match(p,/[2-9]/);assert.match(p,/[!@#]/);}
 assert.equal(new Set(samples).size,samples.length);
});
