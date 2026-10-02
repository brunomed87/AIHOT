import './setup.ts';
import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {z} from 'zod';
import {buildApp} from '../apps/api/src/app.ts';
import {closeDb} from '@aihot/backend/db';
import {stopBoss} from '@aihot/backend/jobs/queue';
const app=await buildApp();
after(async()=>{await app.close();await stopBoss();await closeDb();});
test('erros públicos são apresentados em português e mantêm códigos e status',async()=>{
  const response=await app.inject({method:'GET',url:'/api/v1/items?q=a'});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().code,'invalid_request');
  assert.equal(response.json().title,'Solicitação inválida');
  assert.equal(response.json().detail,'q deve conter de 2 a 200 caracteres.');
  const validation=z.string().min(3).safeParse('a');
  assert.equal(validation.success,false);
  assert.match(validation.error!.issues[0]!.message,/pequeno|mínimo|caracteres/i);
});
