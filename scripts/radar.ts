import {closeDb} from '@aihot/backend/db';
import {composeRadar} from '@aihot/backend/ophthalmology/radar';
import {enrichPendingMedical} from '@aihot/backend/ophthalmology/enrich';
import {runScout} from '@aihot/backend/ophthalmology/scout';
import {readRadarSnapshot} from '@aihot/backend/publication/ophthalmology';
import {renderRadarMarkdown} from '@aihot/backend/publication/radar-markdown';
import {mkdirSync,writeFileSync} from 'node:fs';
const command=process.argv[2] ?? 'ondemand';
const value=(name:string)=>process.argv[process.argv.indexOf(name)+1];
try {
  if(command==='enrich')console.log(JSON.stringify(await enrichPendingMedical()));
  else if(command==='scout')console.log(JSON.stringify(await runScout()));
  else if(['08','20','ondemand'].includes(command)) {
    const result=await composeRadar(command as '08'|'20'|'ondemand',{
      hours:process.argv.includes('--hours')?Number(value('--hours')):undefined,memoryDays:process.argv.includes('--memory-days')?Number(value('--memory-days')):undefined});
    const radar=await readRadarSnapshot(command,result.date);mkdirSync('.data/radars',{recursive:true});
    const file=`.data/radars/${result.date}-${command}-${result.id}.md`;
    if(radar)writeFileSync(file,renderRadarMarkdown(radar));console.log(JSON.stringify({...result,markdown:file}));
  }
  else throw new Error('Use 08, 20, ondemand, enrich or scout');
} finally {await closeDb();}
