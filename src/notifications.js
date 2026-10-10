import nodemailer from 'nodemailer';
import webpush from 'web-push';
import crypto from 'node:crypto';
export const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function validSubscription(s){try{const u=new URL(s?.endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))&&u.href.length<2000&&/^[A-Za-z0-9_-]{80,120}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{16,32}$/.test(s.keys?.auth||'');}catch{return false;}}
export const activeRecipient=r=>['profile','student'].includes(r.kind)&&r.data.active!==false&&!['graduated','dismissed','transferred out','completed'].includes(r.data.status);
export async function notificationAction(op,b,ctx){
 const {p,all,db,crypt,fail,rate,req}=ctx;
 const read=async id=>{const rows=await db('school_secrets?id=eq.'+encodeURIComponent(id));return rows[0]?JSON.parse(crypt(rows[0].value,true)):null;};
 const write=async(id,value)=>{const body={id,value:crypt(JSON.stringify(value))};try{await db('school_secrets','POST',body);}catch(error){if(error.status!==409)throw error;await db('school_secrets?id=eq.'+encodeURIComponent(id),'PATCH',{value:body.value});}};
 let config=await read('notifications');
 if(!config){const candidate={vapid:webpush.generateVAPIDKeys()};try{await db('school_secrets','POST',{id:'notifications',value:crypt(JSON.stringify(candidate))});config=candidate;}catch(error){if(error.status!==409)throw error;config=await read('notifications');}}
 const prefId='notification-pref:'+p.id;
 const prefs=await read(prefId)||{emailEnabled:false,pushEnabled:false,subscriptions:[]};
 const mailer=()=> (ctx.transportFactory||nodemailer.createTransport)({host:'smtp.gmail.com',port:465,secure:true,auth:{user:config.gmailUser,pass:config.gmailPass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
 const sendEmail=async(to,subject,text)=>{if(!config.gmailUser||!config.gmailPass)fail('The principal must connect the school Gmail first.',409);return mailer().sendMail({from:{name:'GHS MBONJO LIMBE',address:config.gmailUser},to,subject,text});};
 if(op==='notification-status')return {configured:!!config.gmailPass,sender:p.role==='principal'?config.gmailUser||'':undefined,publicKey:config.vapid.publicKey,prefs:{email:prefs.email||'',verified:!!prefs.verifiedEmail,emailEnabled:!!prefs.emailEnabled,pushEnabled:!!prefs.pushEnabled,devices:(prefs.subscriptions||[]).length}};
 if(op==='notification-config'){
  if(p.role!=='principal')fail('Principal access required.',403);
  await rate(req,'notification-config',5);
  const email=String(b.email||'').trim().toLowerCase(),password=String(b.appPassword||'').replace(/\s/g,'');
  if(!validEmail(email)||!email.endsWith('@gmail.com'))fail('Enter the school Gmail address.');
  if(!/^[a-zA-Z]{16}$/.test(password))fail('Enter the 16-letter Gmail App Password.');
  const next={...config,gmailUser:email,gmailPass:password};
  const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:email,pass:password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
  try{await transport.verify();}catch{fail('Gmail could not be connected. Check the App Password and 2-Step Verification.',400);}
  await write('notifications',next);return {ok:true};
 }
 if(op==='notification-email-code'){
  await rate(req,'notification-email-code',4);const email=String(b.email||'').trim().toLowerCase();if(!validEmail(email))fail('Enter a valid notification email.');
  const code=String(crypto.randomInt(100000,1000000));
  await sendEmail(email,'GHS MBONJO: confirm your notification email',`Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`);
  await write(prefId,{...prefs,email,emailEnabled:false,verifiedEmail:undefined,codeHash:crypto.createHash('sha256').update(code).digest('hex'),codeExpires:Date.now()+600000});return {ok:true};
 }
 if(op==='notification-email-verify'){
  await rate(req,'notification-email-verify',10);const digest=crypto.createHash('sha256').update(String(b.code||'')).digest('hex');if(!prefs.codeHash||prefs.codeExpires<Date.now()||digest!==prefs.codeHash)fail('The code is incorrect or expired. Request another code.');
  const next={...prefs,verifiedEmail:prefs.email,emailEnabled:true};delete next.codeHash;delete next.codeExpires;await write(prefId,next);return {ok:true};
 }
 if(op==='notification-preferences'){
  if(b.emailEnabled===true&&!prefs.verifiedEmail)fail('Verify your email before enabling notifications.');
  await write(prefId,{...prefs,emailEnabled:b.emailEnabled===true,pushEnabled:b.pushEnabled===true&&(prefs.subscriptions||[]).length>0});return {ok:true};
 }
 if(op==='notification-subscribe'){
  if(!validSubscription(b.subscription))fail('This push subscription is not supported.');
  const sub={endpoint:b.subscription.endpoint,keys:{p256dh:b.subscription.keys.p256dh,auth:b.subscription.keys.auth}};
  const otherPrefs=await db('school_secrets?id=like.notification-pref%3A*&select=id,value');for(const item of otherPrefs){if(item.id===prefId)continue;const other=JSON.parse(crypt(item.value,true));if((other.subscriptions||[]).some(s=>s.endpoint===sub.endpoint))await write(item.id,{...other,subscriptions:other.subscriptions.filter(s=>s.endpoint!==sub.endpoint)});}
  const subscriptions=[...(prefs.subscriptions||[]).filter(s=>s.endpoint!==sub.endpoint),sub].slice(-5);
  await write(prefId,{...prefs,pushEnabled:true,subscriptions});return {ok:true};
 }
 if(op==='notification-unsubscribe'){
  const subscriptions=(prefs.subscriptions||[]).filter(s=>s.endpoint!==b.endpoint);await write(prefId,{...prefs,subscriptions,pushEnabled:subscriptions.length>0&&prefs.pushEnabled});return {ok:true};
 }
 async function deliver(record,title,body){const pref=await read('notification-pref:'+record.id);let email='disabled',push='disabled';if(!pref)return {id:record.id,name:record.data.name,email,push};
  if(pref.emailEnabled&&pref.verifiedEmail){try{await sendEmail(pref.verifiedEmail,title,body+'\n\nOpen your school portal: https://ghs-mbonjo-app.vercel.app/portal');email='sent';}catch{email='failed';}}
  if(pref.pushEnabled&&(pref.subscriptions||[]).length){const retained=[];let successes=0,failures=0;for(const sub of pref.subscriptions){try{await (ctx.pushSender||webpush.sendNotification)(sub,JSON.stringify({title,body,url:'/portal'}),{TTL:3600,timeout:10000,vapidDetails:{subject:config.gmailUser?'mailto:'+config.gmailUser:'https://ghs-mbonjo-app.vercel.app',publicKey:config.vapid.publicKey,privateKey:config.vapid.privateKey}});retained.push(sub);successes++;}catch(error){if(![404,410].includes(error.statusCode))retained.push(sub);failures++;}}if(retained.length!==pref.subscriptions.length)await write('notification-pref:'+record.id,{...pref,subscriptions:retained,pushEnabled:retained.length>0});push=failures?(successes?'partial':'failed'):'sent';}
  return {id:record.id,name:record.data.name,email,push};
 }
 if(op==='notification-test')return {ok:true,results:[await deliver(all.find(r=>r.id===p.id),'GHS MBONJO notification test','Your school notifications are working.')]};
 if(op==='notification-send'){
  if(p.role!=='principal')fail('Principal access required.',403);await rate(req,'notification-send',40);
  const title=String(b.title||'').trim(),body=String(b.message||'').trim();if(!title||title.length>100||!body||body.length>1000)fail('Enter a title up to 100 characters and a message up to 1,000 characters.');
  if(!Array.isArray(b.recordIds)||b.recordIds.length>20||!b.recordIds.length)fail('Select between 1 and 20 recipients per batch.');
  const recipients=[...new Set(b.recordIds)].map(id=>all.find(r=>r.id===id));if(recipients.some(r=>!r||!activeRecipient(r)))fail('Choose active school recipients.');
  const results=[];for(let i=0;i<recipients.length;i+=5)results.push(...await Promise.all(recipients.slice(i,i+5).map(r=>deliver(r,title,body))));
  await db('school_audit','POST',{actor:p.id,action:'send school notification to '+recipients.length+' recipients',record_id:'notifications'});
  return {ok:true,results};
 }
 fail('Unknown notification action.');
}
