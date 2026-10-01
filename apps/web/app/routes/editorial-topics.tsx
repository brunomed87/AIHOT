import {Form,Link,useLoaderData} from 'react-router';
import type {EditorialTopic} from '@aihot/contracts/ophthalmology';
import {apiGet} from '../lib/api.server';
import {pageMeta} from '../lib/seo';
export async function loader({request}:{request:Request}){
  const q=new URL(request.url).searchParams;
  return apiGet<{memoryDays:number;topics:EditorialTopic[]}>('/api/v1/ophthalmology/topics?'+new URLSearchParams({memoryDays:q.get('memoryDays') ?? '14'}),{signal:request.signal});
}
export const headers=()=>({'Cache-Control':'no-store'});
export const meta=()=>pageMeta({title:'Memória editorial · Radar Oftalmologia Brasil',description:'Temas, recorrência e ângulos na janela escolhida.',path:'/editorial-topics'});
export default function EditorialTopics(){const {memoryDays,topics}=useLoaderData<typeof loader>();return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
  <h1 className="text-3xl font-semibold text-ink">Memória editorial</h1><p className="mt-3 max-w-prose text-ink-3">Acontecimentos diferentes podem ensinar sobre o mesmo tema. A saturação ajuda a escolher o próximo ângulo; um novo achado continua aparecendo no radar.</p>
  <Form className="my-6 flex items-end gap-3"><label className="flex flex-col gap-1 text-sm">Janela em dias<input className="w-32 rounded-control border border-line bg-bg p-2" type="number" min="1" name="memoryDays" defaultValue={memoryDays}/></label><button className="rounded-control bg-accent px-4 py-2 text-white">Aplicar</button></Form>
  {!topics.length&&<p className="my-12 text-ink-3">Os temas aparecerão após o processamento médico das matérias. <Link to="/radar" className="text-accent underline">Abrir radar</Link></p>}
  {topics.map(t=><article key={t.key} className="border-t border-line py-6"><div className="flex flex-wrap justify-between gap-4"><h2 className="text-xl font-semibold">{t.key}</h2><p className="text-sm text-ink-3">{t.saturation} · {t.saturationValue}</p></div>
    <dl className="mt-4 flex flex-wrap gap-5 text-sm">{[['Eventos',t.eventCount],['Reportagens',t.reportCount],['Fontes independentes',t.independentSources],['Heat agregado',t.aggregateHeat.toFixed(1)],['No radar',t.radarCount],['No topo',t.topCount],['Reels sugeridos',t.reelCount]].map(([label,value])=><div key={String(label)}><dt className="text-ink-3">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    <p className="mt-4 text-xs text-ink-4">Primeira detecção: {t.firstDetected} · Atualização: {t.latest}</p>
    <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="font-medium">Ângulos recomendados</h3><ul className="mt-2 space-y-2 text-sm text-ink-3">{t.recommendedAngles.map(a=><li key={a}>{a}</li>)}</ul></div><div><h3 className="font-medium">Ângulos usados</h3>{t.usedAngles.length?<ul className="mt-2 space-y-2 text-sm">{t.usedAngles.map(a=><li key={a}>{a}</li>)}</ul>:<p className="mt-2 text-sm text-ink-4">Nenhum uso registrado.</p>}</div></div>
  </article>)}<p className="mt-8 text-sm text-ink-4">Leitura editorial com revisão médica. Parâmetros de saturação ainda provisórios.</p>
</main>;}
