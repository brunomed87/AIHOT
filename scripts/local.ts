// User-level Windows installation. Isolated PostgreSQL 17 and loopback-only processes.
import {spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,openSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {parseEnv} from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const directory=path.join(root,'.data');mkdirSync(directory,{recursive:true});
const pipe=process.platform==='win32'?'\\\\.\\pipe\\radar-oftalmologia-brasil':path.join(directory,'local.sock');
const env={...process.env,...parseEnv(readFileSync(path.join(root,'.env'),'utf8'))};
const command=process.argv[2] ?? 'status';
const child=(args:string[])=>spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['inherit','inherit','inherit','ipc']});
async function run(args:string[]){const c=child(args);await new Promise<void>((resolve,reject)=>{c.once('error',reject);c.once('exit',code=>code===0?resolve():reject(new Error(`Command failed (${code}): ${args[0]}`)));});}
async function control(message:string){return new Promise<string>((resolve,reject)=>{const c=net.createConnection(pipe);let text='';c.setTimeout(message==='stop'?180000:2000,()=>c.destroy(new Error('Local controller timeout')));c.on('connect',()=>c.write(message));c.on('data',d=>text+=d);c.on('end',()=>resolve(text));c.on('error',reject);});}
if(command==='serve') {
  const url=new URL(env.DATABASE_URL!);
  const pg=new EmbeddedPostgres({databaseDir:path.join(directory,'postgres'),user:url.username,password:decodeURIComponent(url.password),port:Number(url.port),persistent:true,postgresFlags:['-c','listen_addresses=127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C']});
  if(!existsSync(path.join(directory,'postgres','PG_VERSION')))await pg.initialise();
  await pg.start();
  const client=pg.getPgClient();await client.connect();
  for(const name of ['radar_oftalmologia','radar_oftalmologia_test']) {
    const found=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);
    if(!found.rowCount)await client.query(`CREATE DATABASE ${name}`);
  }
  await client.end();
  await run(['scripts/migrate.ts']);await run(['scripts/seed.ts']);
  const children=[child(['apps/api/src/main.ts']),child(['apps/worker/src/main.ts']),child(['apps/web/server.ts'])];
  const state={pid:process.pid,children:children.map(c=>c.pid),root,url:env.SITE_URL,databasePort:Number(url.port)};
  writeFileSync(path.join(directory,'local-state.json'),JSON.stringify(state,null,2));
  const server=net.createServer(connection=>{
    connection.once('data',async d=>{
      if(d.toString()==='stop') {
        await Promise.all(children.map(c=>new Promise<void>(resolve=>{
          if(c.exitCode!==null||c.signalCode!==null)return resolve();
          c.once('exit',()=>resolve());
          if(c.connected)c.send({type:'aihot.shutdown'});else c.kill();
        })));
        await pg.stop();connection.end('Local installation stopped.');server.close();process.exit(0);
      }else connection.end(JSON.stringify({...state,childrenAlive:children.every(c=>c.exitCode===null&&c.signalCode===null)}));
    });
  });server.listen(pipe);
  children.forEach(c=>c.once('exit',code=>console.error(`Application process ${c.pid} exited: ${code}`)));
}else if(command==='start') {
  const existing=await control('status').catch(()=>null);
  if(existing){console.log(existing);process.exit(0);}
  if(!existsSync(path.join(root,'apps/web/build/server/index.js')))throw new Error('Build first: npm run build -w @aihot/web');
  const log=openSync(path.join(directory,'local.log'),'a');
  const c=spawn(process.execPath,['--env-file=.env','scripts/local.ts','serve'],{cwd:root,env,detached:true,windowsHide:true,stdio:['ignore',log,log]});c.unref();
  console.log(`Starting in background. Logs: ${path.join(directory,'local.log')}`);
  // The startup helper may itself have an IPC parent (backup). Detach that helper as well.
  process.exit(0);
}else if(command==='stop'||command==='status')console.log(await control(command).catch(()=> 'Local installation is not running.'));
else if(command==='backup') {
  const running=await control('status').catch(()=>null);
  if(running)await control('stop');
  if(!existsSync(path.join(directory,'postgres','PG_VERSION')))throw new Error('No initialized local database to back up');
  const destination=path.join(directory,'backups',new Date().toISOString().replace(/[:.]/g,'-'));
  mkdirSync(destination,{recursive:true});
  for(const name of ['postgres','uploads','media','feedback'])if(existsSync(path.join(directory,name)))cpSync(path.join(directory,name),path.join(destination,name),{recursive:true});
  writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),postgresMajor:17,root,database:'radar_oftalmologia',type:'offline-physical-backup'},null,2));
  console.log(`Backup: ${destination}`);
  if(running)await run(['--env-file=.env','scripts/local.ts','start']);
}
else if(command==='radar')await run(['scripts/radar.ts',...process.argv.slice(3)]);
else if(command==='report')await run(['scripts/compose-report.ts',...process.argv.slice(3)]);
else if(command==='test') {
  // This installation owns this throwaway database. Upstream fixtures require a fresh run.
  const target=new URL(env.DATABASE_URL!);
  if(target.hostname!=='127.0.0.1'||target.port!=='5547'||target.pathname!=='/radar_oftalmologia')throw new Error('Local tests require the isolated installation database');
  const pg=new EmbeddedPostgres({port:Number(target.port),user:target.username,password:decodeURIComponent(target.password)});
  const admin=pg.getPgClient('postgres');await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS radar_oftalmologia_test WITH (FORCE)');
  await admin.query('CREATE DATABASE radar_oftalmologia_test');await admin.end();
  env.DATABASE_URL=env.DATABASE_URL!.replace('/radar_oftalmologia','/radar_oftalmologia_test');
  // Model execution in the upstream tests uses local HTTP stubs and test-only credentials.
  env.COLLECT_ENABLED='false';env.MODEL_CALLS_ENABLED='true';env.OPHTHALMOLOGY_SCOUT_ENABLED='false';
  await run(['scripts/migrate.ts']);
  await run(['--test','--test-concurrency=1','--test-timeout=120000','tests/*.test.ts']);
}else throw new Error('Use start, stop, status, backup, test, report daily|weekly|monthly or radar 08|20|ondemand|enrich|scout');
