import {composeDaily,composeWeekly,composeMonthly} from '@aihot/backend/reports/compose';
import {config} from '@aihot/backend/config';
import {closeDb} from '@aihot/backend/db';
import {isValidDate} from '@aihot/contracts/time';
const [kind,key]=process.argv.slice(2);
try{
  if(!config.modelCallsEnabled)throw new Error('Configure the model and enable MODEL_CALLS_ENABLED before composing an original edited report');
  if(kind==='daily'&&key&&isValidDate(key))console.log(JSON.stringify(await composeDaily(key,'manual')));
  else if(kind==='weekly'&&key&&/^\d{4}-W\d{2}$/.test(key))console.log(JSON.stringify(await composeWeekly(key,'manual')));
  else if(kind==='monthly'&&key&&/^\d{4}-(0[1-9]|1[0-2])$/.test(key))console.log(JSON.stringify(await composeMonthly(key,'manual')));
  else throw new Error('Use daily YYYY-MM-DD, weekly YYYY-Www or monthly YYYY-MM');
}finally{await closeDb();}
