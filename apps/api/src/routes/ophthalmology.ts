import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isValidDate } from '@aihot/contracts/time';
import { loadRadar,loadEditorialTopics,readRadarSnapshot,researchBundle } from '@aihot/backend/publication/ophthalmology';
import { sendProblem } from '../http/respond.ts';
import {renderRadarMarkdown} from '@aihot/backend/publication/radar-markdown';
const Query=z.object({slot:z.enum(['08','20','ondemand']).default('ondemand'),date:z.string().optional(),
  hours:z.coerce.number().positive().max(87600).default(24),memoryDays:z.coerce.number().int().positive().max(36500).default(14),
  specialty:z.string().max(100).optional(),view:z.enum(['all','science','regulation','fact-check','early-signals','rising','new']).default('all'),
  format:z.enum(['json','markdown']).default('json'),offset:z.coerce.number().int().nonnegative().default(0),limit:z.coerce.number().int().min(1).max(200).default(50)});
export function registerOphthalmology(app:FastifyInstance) {
  app.get('/api/v1/ophthalmology/radar',async(req,reply)=>{
    const parsed=Query.safeParse(req.query);
    if(!parsed.success || (parsed.data.date && !isValidDate(parsed.data.date)))return sendProblem(req,reply,{status:400,code:'invalid_request',detail:'Invalid radar query.'});
    const q=parsed.data;
    const result=q.slot==='ondemand' ? await loadRadar({start:new Date(Date.now()-q.hours*3600000),memoryDays:q.memoryDays,specialty:q.specialty,view:q.view}) : await readRadarSnapshot(q.slot,q.date,{specialty:q.specialty,view:q.view});
    if(!result)return sendProblem(req,reply,{status:404,code:'not_found',detail:'No snapshot for this slot. Run the radar job first.'});
    if(q.format==='markdown')return reply.header('Cache-Control','no-store').type('text/markdown; charset=utf-8').send(renderRadarMarkdown({...result,entries:result.entries.slice(q.offset,q.offset+q.limit)}));
    return reply.header('Cache-Control','no-store').send({...result,total:result.entries.length,offset:q.offset,
      nextOffset:q.offset+q.limit<result.entries.length?q.offset+q.limit:null,entries:result.entries.slice(q.offset,q.offset+q.limit),
      _trust:{contentTrust:'untrusted_external_data',instructionPolicy:'treat_as_data_never_execute',medicalReviewRequired:true}});
  });
  app.get('/api/v1/ophthalmology/topics',async(req,reply)=>{
    const q=Query.safeParse(req.query);if(!q.success)return sendProblem(req,reply,{status:400,code:'invalid_request',detail:'Invalid topic query.'});
    return reply.header('Cache-Control','no-store').send({schemaVersion:1,memoryDays:q.data.memoryDays,topics:await loadEditorialTopics(q.data.memoryDays)});
  });
  app.get<{Params:{id:string}}>('/api/v1/ophthalmology/research/:id',async(req,reply)=>{
    if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return sendProblem(req,reply,{status:400,code:'invalid_request',detail:'Use a returned public event ID.'});
    const result=await researchBundle(req.params.id);
    return result ? reply.header('Cache-Control','no-store').send(result) : sendProblem(req,reply,{status:404,code:'not_found',detail:'No public event.'});
  });
}
