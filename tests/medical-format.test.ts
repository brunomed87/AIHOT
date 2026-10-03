import { stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { enrichMedical, MedicalSchema } from "@aihot/backend/ophthalmology/enrich";
import { completeReceipt } from "@aihot/backend/providers/receipts";

after(closeDb);

test("accented theme identifiers keep their meaning without relaxing medical field validation", () => {
  const value = {
    editorialTitle:"Estudo ocular",topicKeys:["catarata-midríase-ciclopentolato-mydrane"],angle:"Limites do estudo",specialties:["catarata"],classifications:["SCIENCE"],
    dimensions:{},whyNow:"Publicação científica",publicInterest:"Saúde ocular",patientUsefulness:"Conhecer limitações",
    evidence:{categories:["OBSERVATIONAL_STUDY"],sampleSize:84},sensationalism:"INSUFFICIENT_EVIDENCE",confidence:.7,qualityAssessment:"Requer revisão médica",
  };
  assert.deepEqual(MedicalSchema.parse(value).topicKeys,["catarata-midriase-ciclopentolato-mydrane"]);
  assert.equal(MedicalSchema.safeParse({...value,evidence:{...value.evidence,sampleSize:"84 pessoas"}}).success,false);
  assert.equal(MedicalSchema.safeParse({...value,evidence:{...value.evidence,endpoint:["desfecho"]}}).success,false);
  assert.equal(MedicalSchema.safeParse({...value,topicKeys:["tema/inválido"]}).success,false);
});

test("medical requests describe the exact JSON types to a model without schema enforcement", async () => {
  const key = `medical-format-${tag()}`;
  const bodyText = `Estudo com 84 adultos. Referência de teste: ${key}.`;
  await sql`INSERT INTO sources (id,name,kind,tier) VALUES (${key},'Test medical source','rss','T1')`;
  const { articleId } = await upsertMaterial({ sourceId:key,url:`https://example.com/${key}`,title:"Estudo ocular",bodyText,bodyStatus:"ok",via:"fetch" });
  let instructions = "";
  const provider = await stub((_hit, request) => {
    const body = JSON.parse(request.body);
    instructions = body.messages[0].content;
    return { choices:[{ message:{ content:JSON.stringify({
      editorialTitle:"Estudo ocular",topicKeys:["estudo-ocular"],angle:"Limites do estudo",specialties:["retina"],classifications:["SCIENCE"],
      dimensions:{},whyNow:"Publicação científica",publicInterest:"Saúde ocular",patientUsefulness:"Conhecer limitações",
      evidence:{ categories:["OBSERVATIONAL_STUDY"],sampleSize:84,limitations:["Sem inferência causal"] },
      sensationalism:"INSUFFICIENT_EVIDENCE",confidence:.7,qualityAssessment:"Requer revisão médica",
    }) } }] };
  });
  const keys = ["LLM_TRANSPORT","LLM_BASE_URL","LLM_API_KEY","LLM_MODEL","MEDICAL_MODEL"];
  const before = Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{ LLM_TRANSPORT:"chat-completions",LLM_BASE_URL:provider.url,LLM_API_KEY:"test-only",LLM_MODEL:"test-medical",MEDICAL_MODEL:"default" });
  try {
    const result = await enrichMedical({ id:articleId,title:"Estudo ocular",originalTitle:"Estudo ocular",summary:null,body:bodyText,html:null,revision:1 });
    await completeReceipt(sql,result.receiptId);
    const contract = JSON.parse(instructions.split("Contrato JSON obrigatório:\n")[1] ?? "null");
    assert(contract,"O pedido deve informar o contrato completo, inclusive tipos de campos médicos");
    assert.equal(contract.properties.topicKeys.items.pattern,"^[a-z0-9]+(?:-[a-z0-9]+)*$");
    const evidence = contract.properties.evidence.properties;
    assert.deepEqual(evidence.sampleSize.anyOf.map((type:{type:string})=>type.type),["integer","null"]);
    assert.equal(evidence.limitations.type,"array");
    assert.equal(provider.hits(),1);
    assert.equal(result.payload.evidence.sampleSize,84);
  } finally {
    await provider.close();
    for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];
  }
});
