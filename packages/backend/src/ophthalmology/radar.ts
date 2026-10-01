import { sql } from '../db.ts';
import { loadRadar,readRadarSnapshot,compareWithMorning } from '../publication/ophthalmology.ts';
import { OPHTHALMOLOGY as P } from '@aihot/industry/ophthalmology';
import { localDate,localInstant } from './rules.ts';
import { addDays } from '@aihot/contracts/time';
export async function composeRadar(slot:'08'|'20'|'ondemand',options:{now?:Date;hours?:number;memoryDays?:number}={}) {
  if (options.hours !== undefined && (!Number.isFinite(options.hours) || options.hours <= 0)) throw new Error('hours must be positive');
  if (options.memoryDays !== undefined && (!Number.isInteger(options.memoryDays) || options.memoryDays <= 0)) throw new Error('memoryDays must be a positive integer');
  const now=options.now ?? new Date(),date=localDate(now),end=slot==='ondemand'?now:localInstant(date,Number(slot));
  if(slot!=='ondemand' && end>now)throw new Error('Scheduled slot is still in the future');
  const start=options.hours ? new Date(end.getTime()-options.hours*3600000) : slot==='08' ? localInstant(addDays(date,-1),20) : slot==='20'?localInstant(date,8):new Date(end.getTime()-24*3600000);
  const fresh=await loadRadar({start,end,memoryDays:options.memoryDays,slot});
  const content=slot==='20'?compareWithMorning(fresh,await readRadarSnapshot('08',date)):fresh;
  const id=await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`radar:${slot}:${date}`}))`;
    if(slot!=='ondemand') {
      const [exists]=await tx<{id:number}[]>`SELECT id FROM radar_snapshots WHERE slot=${slot} AND local_date=${date}`;
      if(exists)return exists.id;
    }
    const [row]=await tx<{id:number}[]>`INSERT INTO radar_snapshots(slot,local_date,captured_at,window_start,window_end,memory_days,profile_version,content)
      VALUES (${slot},${date},${now},${start},${end},${content.memoryDays},${P.version},${tx.json(content as never)}) RETURNING id`;
    for(const entry of content.entries)for(const key of entry.analysis?.topicKeys ?? []) {
      const format=(entry.analysis?.dimensions.reelPotential ?? 0) >= (entry.analysis?.dimensions.carouselPotential ?? 0)?'reel':'carousel';
      await tx`INSERT INTO editorial_recommendations(snapshot_id,article_id,topic_key,angle,format,is_top)
        VALUES (${row!.id},${entry.id},${key},${entry.analysis!.angle},${format},${entry.editorialIndex!==null && entry.editorialIndex>=75}) ON CONFLICT DO NOTHING`;
    }
    return row!.id;
  });
  return {id,entries:content.entries.length,slot,date};
}
