import {sql} from '../db.ts';
import {audit} from '../audit.ts';
export async function recordEditorialUse(id:number,used:boolean,actor:string,reason:string) {
  if(!Number.isInteger(id)||id<=0||!reason.trim())throw Object.assign(new Error('Recommendation ID and reason are required'),{statusCode:400});
  return sql.begin(async tx=>{
    const [before]=await tx`SELECT id,article_id,topic_key,angle,used_at FROM editorial_recommendations WHERE id=${id} FOR UPDATE`;
    if(!before)return null;
    const [after]=await tx`UPDATE editorial_recommendations SET used_at=${used?new Date():null} WHERE id=${id} RETURNING id,used_at`;
    await audit(actor,'editorial.use',`recommendation:${id}`,reason,before,after,{db:tx});return after;
  });
}
export async function recommendationHistory(articleId?:string) {
  return sql`SELECT id,snapshot_id,article_id,topic_key,angle,format,is_top,created_at,used_at FROM editorial_recommendations
    ${articleId?sql`WHERE article_id=${articleId}`:sql``} ORDER BY created_at DESC LIMIT 500`;
}
