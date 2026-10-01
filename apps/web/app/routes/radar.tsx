import {Form,Link,useLoaderData} from 'react-router';
import type {RadarResponse,RadarEntry} from '@aihot/contracts/ophthalmology';
import {apiGet,ApiError} from '../lib/api.server';
import {pageMeta} from '../lib/seo';
const views=[['all','Todas'],['science','Ciência'],['regulation','Regulação'],['fact-check','Fact-check'],['early-signals','Sinais precoces'],['rising','Ganhando força'],['new','Novos acontecimentos']];
const dimensions:Record<string,string>={medicalEvidence:'Evidência médica',publicInterest:'Interesse público',ophthalmologyRelevance:'Relevância ocular',editorialNovelty:'Novidade editorial',momentum:'Momentum',patientUsefulness:'Utilidade para pacientes',reelPotential:'Reel',carouselPotential:'Carrossel',curiosity:'Curiosidade',factCheckPotential:'Fact-check',authorityPositioning:'Posicionamento'};
export async function loader({request,params}:{request:Request;params:Record<string,string|undefined>}) {
  const url=new URL(request.url),q=url.searchParams;
  const slot=params.slot ?? 'ondemand';q.set('slot',slot);
  if(params.view&&!q.has('view'))q.set('view',params.view);
  const view=q.get('view') ?? 'all';
  let radar:(RadarResponse&{total?:number;nextOffset?:number|null})|null=null;
  try{radar=await apiGet('/api/v1/ophthalmology/radar?'+q.toString(),{signal:request.signal});}
  catch(e){if(!(e instanceof ApiError && e.status===404))throw e;}
  return {radar,slot,view,specialty:q.get('specialty') ?? '',memoryDays:q.get('memoryDays') ?? '14',hours:q.get('hours') ?? '24'};
}
export const meta=()=>pageMeta({title:'Radar editorial de oftalmologia',description:'Acontecimentos, evidência médica e trajetória editorial no Brasil.',path:'/radar'});
export const headers=()=>({'Cache-Control':'no-store'});
const when=(date:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(date));
function Entry({entry:e}:{entry:RadarEntry}) {
  const a=e.analysis;
  return <article className="border-b border-line py-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl"><p className="mb-2 text-sm text-ink-3">{e.source} · {e.publishedAt?when(e.publishedAt):'Data de publicação não informada'}</p>
        <h2 className="text-2xl font-semibold leading-tight text-ink"><a href={e.originalUrl} target="_blank" rel="noreferrer" className="hover:text-accent focus-visible:outline-2">{e.title}</a></h2>
        {e.summary&&<p className="mt-3 max-w-prose leading-relaxed text-ink-2">{e.summary}</p>}</div>
      <div className="text-right"><span className="block text-3xl font-semibold text-accent">{e.editorialIndex ?? '—'}</span><span className="text-xs text-ink-4">Índice editorial / 100</span></div>
    </div>
    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-3">
      <div><dt className="inline">Atenção </dt><dd className="inline font-semibold">{e.attentionScore ?? '—'}</dd></div>
      <div><dt className="inline">Heat </dt><dd className="inline font-semibold">{e.heat}</dd></div>
      <div><dt className="inline">Fontes independentes </dt><dd className="inline font-semibold">{e.independentSources}</dd></div>
      <div><dt className="inline">Reportagens </dt><dd className="inline font-semibold">{e.reportCount}</dd></div>
      <div><dt className="inline">Saturação </dt><dd className="inline font-semibold">{e.saturation} ({e.saturationValue})</dd></div>
    </dl>
    <p className="mt-2 text-sm text-ink-4">{e.delta ?? e.trajectory} · {e.momentum}{!e.observationComplete&&' · Observação incompleta'}</p>
    {a ? <>
      <div className="mt-5 border-l-2 border-accent pl-4"><h3 className="font-semibold text-ink">Por que agora</h3><p className="mt-1 max-w-prose text-ink-2">{a.whyNow}</p><p className="mt-2 text-sm text-ink-3">Ângulo: {a.angle}</p></div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm"><a href={e.originalUrl} target="_blank" rel="noreferrer" className="text-accent underline">Matéria original</a>
        {e.storyId&&<Link to={'/story/'+e.storyId} className="text-accent underline">Linha do acontecimento</Link>}
        {a.primarySources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-accent underline">{s.status==='LOCATED'?'Fonte primária':'Referência candidata'} · {s.type}</a>)}
        {a.primarySourceStatus==='NOT_LOCATED'&&<span className="text-ink-4">Fonte primária não confirmada</span>}
      </div>
      <details className="mt-5 rounded-control bg-bg-sunk p-4"><summary className="cursor-pointer font-medium text-ink">Evidência, checagem e formatos</summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2"><div><h3 className="font-semibold">Dimensões editoriais</h3><dl className="mt-3 space-y-2">{Object.entries(a.dimensions).map(([key,value])=><div key={key} className="flex justify-between gap-4 text-sm"><dt>{dimensions[key] ?? key}</dt><dd>{value ?? 'Desconhecido'}</dd></div>)}</dl></div>
          <div><h3 className="font-semibold">Leitura médica</h3><p className="mt-2 text-sm">{a.evidence.categories.join(', ') || 'Categoria não estabelecida'}</p><p className="mt-2 text-sm">{a.qualityAssessment}</p><p className="mt-2 text-sm">{a.evidence.limitations.join(' ')}</p>
            <p className="mt-2 text-sm">Disponível no Brasil: {a.evidence.availableInBrazil===null?'Não verificado':a.evidence.availableInBrazil?'Sim, segundo a fonte':'Não, segundo a fonte'}</p>
            {a.claimChecks.length>0&&<ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{a.claimChecks.map((c,i)=><li key={i}>{c.explanation}</li>)}</ul>}
            <p className="mt-3 text-sm">Manchete: {a.sensationalism}. Confiança da extração: {Math.round(a.confidence*100)}%.</p>
            {a.hooks.length>0&&<><h3 className="mt-4 font-semibold">Ganchos para revisar</h3><ul className="mt-2 list-disc pl-5 text-sm">{a.hooks.map(h=><li key={h}>{h}</li>)}</ul></>}
          </div></div>
        <details className="mt-4"><summary className="cursor-pointer text-sm underline">Todos os campos</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(a,null,2)}</pre></details>
      </details>
    </> : <p className="mt-4 text-sm text-ink-4">Análise médica ainda não disponível. A matéria e os dados originais continuam acessíveis.</p>}
  </article>;
}
export default function Radar(){
  const {radar,slot,view,specialty,memoryDays,hours}=useLoaderData<typeof loader>();
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
    <header className="border-b-2 border-accent pb-6"><h1 className="max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">Radar Oftalmologia Brasil</h1><p className="mt-3 max-w-prose text-ink-3">Acontecimentos para acompanhar, evidência para conferir e oportunidades para conversar com pacientes.</p>
      <nav aria-label="Edições do radar" className="mt-5 flex gap-5 text-sm">{[['ondemand','Agora'],['08','08h · Descoberta'],['20','20h · Momentum']].map(([key,label])=><Link key={key} to={key==='ondemand'?'/radar':'/radar/'+key} aria-current={slot===key?'page':undefined} className={slot===key?'font-semibold text-accent underline':'text-ink-3 hover:text-ink'}>{label}</Link>)}</nav>
    </header>
    <Form key={[slot,view,specialty,memoryDays,hours].join(':')} method="get" className="my-6 flex flex-wrap gap-4 rounded-control bg-bg-sunk p-4">
      <label className="flex flex-col gap-1 text-sm text-ink-3">Visão<select name="view" defaultValue={view} className="rounded-control border border-line bg-bg p-2">{views.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm text-ink-3">Área<select name="specialty" defaultValue={specialty} className="rounded-control border border-line bg-bg p-2"><option value="">Todas as áreas</option>{['retina','catarata','refrativa','glaucoma','cornea','pediatria','trauma','saude-publica','inovacao'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      {slot==='ondemand'&&<label className="flex flex-col gap-1 text-sm text-ink-3">Memória em dias<input name="memoryDays" type="number" min="1" defaultValue={memoryDays} className="w-28 rounded-control border border-line bg-bg p-2"/></label>}
      {slot==='ondemand'&&<label className="flex flex-col gap-1 text-sm text-ink-3">Janela em horas<input name="hours" type="number" min="1" defaultValue={hours} className="w-28 rounded-control border border-line bg-bg p-2"/></label>}
      <button className="self-end rounded-control bg-accent px-4 py-2 font-medium text-white">Aplicar</button>
    </Form>
    {radar?<><p className="text-sm text-ink-3">{when(radar.windowStart)} a {when(radar.windowEnd)} · São Paulo · {radar.total ?? radar.entries.length} oportunidades · Memória de {radar.memoryDays} dias</p>
      {radar.baselineStatus==='MISSING'&&<p className="mt-3 text-sm text-ink-3">A edição das 08h não foi registrada. A comparação da noite está indisponível.</p>}
      {radar.entries.map(e=><Entry key={e.id} entry={e}/>)}
      {!radar.entries.length&&<div className="my-12 max-w-xl"><h2 className="text-xl font-semibold">Ainda não há acontecimentos nesta visão</h2><p className="mt-3 text-ink-3">Ajuste a janela ou acompanhe a coleta. Novas matérias aparecerão com seus links; a análise médica é acrescentada após o processamento.</p><Link to="/admin/sources" className="mt-4 inline-block text-accent underline">Ver fontes no painel</Link></div>}
      {radar.nextOffset!==null && radar.nextOffset!==undefined&&<Link to={'?'+new URLSearchParams({view,specialty,memoryDays,hours,offset:String(radar.nextOffset)})} className="my-6 inline-block text-accent underline">Próximas oportunidades</Link>}
      {radar.topics.length>0&&<section className="mt-10"><h2 className="text-2xl font-semibold">Memória editorial</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Tema','Eventos','Fontes independentes','Heat','Saturação','Recomendações'].map(x=><th key={x} className="border-b border-line py-3 pr-5">{x}</th>)}</tr></thead><tbody>{radar.topics.map(t=><tr key={t.key}><td className="border-b border-line py-3 pr-5">{t.key}</td><td>{t.eventCount}</td><td>{t.independentSources}</td><td>{t.aggregateHeat.toFixed(1)}</td><td>{t.saturation} ({t.saturationValue})</td><td>{t.radarCount}</td></tr>)}</tbody></table></div></section>}
    </>:<div className="my-12 max-w-xl"><h2 className="text-xl font-semibold">Esta edição ainda não foi registrada</h2><p className="mt-3 text-ink-3">A agenda salva uma edição às {slot}h, no horário de São Paulo. A visão Agora mostra o material disponível entre as edições.</p><Link to="/radar" className="mt-4 inline-block text-accent underline">Abrir o radar agora</Link></div>}
  </main>;
}
