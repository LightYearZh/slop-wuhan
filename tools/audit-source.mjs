import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync}from'node:child_process';
const root=process.cwd(),version=JSON.parse(fs.readFileSync('package.json')).version,archive=path.join(root,'release',`shanghai-waterfront-${version}-source.tar.gz`),dir=path.resolve(process.argv[2]||'docs/acceptance');
const clientOnly=process.argv.includes('--client-only');
fs.mkdirSync(dir,{recursive:true});
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});const stage=fs.mkdtempSync(path.join(root,'.cache/source-repro-')),log=fs.openSync(path.join(dir,'source-reproduction.log'),'w');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const result={archiveSHA256:hash(archive),startedAt:new Date().toISOString(),geographyRebuilt:!clientOnly,scope:clientOnly?'Client-only change: archived geography is verified byte-for-byte in the output; geodata generators are not rerun.':'Complete source and geography rebuild.',pythonDependencies:'Existing pinned .venv runtime; source and npm installation are isolated.',commands:[],assets:[]},start=Date.now();
function run(args){const started=Date.now();try{execFileSync('rtk',['proxy',...args],{cwd:stage,stdio:['ignore',log,log]});result.commands.push({args,exitCode:0,seconds:(Date.now()-started)/1000});}catch(error){result.commands.push({args,exitCode:error.status,seconds:(Date.now()-started)/1000});throw error;}}
try{
 run(['tar','-xzf',archive,'-C',stage]);run(['npm','ci']);run(['npm','test']);run([path.join(root,'.venv/bin/python'),'-m','unittest','discover','-s','tests','-p','test_*.py','-v']);if(!clientOnly)run([path.join(root,'.venv/bin/python'),'tools/build-data.py']);
 const citySHA256=hash(path.join(stage,'public/data/city.json'));result[clientOnly?'archivedCitySHA256':'regeneratedCitySHA256']=citySHA256;result.expectedCitySHA256=hash(path.join(root,'public/data/city.json'));if(citySHA256!==result.expectedCitySHA256)throw Error('City data differs');
 run(['npm','run','build']);
 function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else{const name=path.relative(path.join(root,'dist'),file),actual=hash(path.join(stage,'dist',name));if(actual!==hash(file))throw Error('Build differs: '+name);result.assets.push({path:name,sha256:actual});}}}walk(path.join(root,'dist'));
 result.status='passed';result.filesCompared=result.assets.length;
}catch(error){result.status='failed';result.error=String(error.stack||error);}finally{fs.closeSync(log);fs.rmSync(stage,{recursive:true,force:true});result.seconds=(Date.now()-start)/1000;fs.writeFileSync(path.join(dir,'source-reproduction.json'),JSON.stringify(result,null,2));}
console.log({...result,commands:undefined,assets:undefined});if(result.status!=='passed')process.exitCode=1;
