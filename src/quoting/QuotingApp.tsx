import { useMemo, useState, type ReactNode } from 'react';
import {
  Bell, Calculator, ChevronRight, CircleDollarSign, FileText, Home, LayoutGrid,
  Menu, Package, Palette, Plus, Search, Settings, Users, Wrench, X, MoreVertical,
  Building2, Percent, Receipt, TrendingUp, Wallet, BarChart3, SlidersHorizontal
} from 'lucide-react';

type Screen = 'dashboard'|'clients'|'quotes'|'catalog'|'costs'|'settings'|'company'|'pricing';
type ItemType = 'material'|'service'|'labor';

type QuoteItem = {
  id:number; name:string; type:ItemType; qty:number; unit:string; cost:number;
};

const initialItems: QuoteItem[] = [
  {id:1,name:'Disjuntor Bipolar 32A',type:'material',qty:1,unit:'un',cost:45},
  {id:2,name:'Cabo Flexível 2,5mm²',type:'material',qty:20,unit:'m',cost:6},
  {id:3,name:'Tomada 20A',type:'material',qty:3,unit:'un',cost:25},
  {id:4,name:'Mão de obra elétrica',type:'labor',qty:1,unit:'serviço',cost:150},
];

const clients = [
  ['Maria Silva','(11) 98765-4321','maria@email.com'],
  ['João Souza','(11) 97654-3210','joao@email.com'],
  ['Pedro Lima','(11) 96543-2109','pedro@email.com'],
  ['Ana Paula','(11) 95432-1098','ana@email.com'],
  ['Carlos Alberto','(11) 94321-0987','carlos@email.com'],
];

const quotes = [
  ['#018','Maria Silva','R$ 1.850,00','Enviado'],
  ['#017','João Souza','R$ 950,00','Rascunho'],
  ['#016','Pedro Lima','R$ 2.300,00','Aprovado'],
  ['#015','Ana Paula','R$ 780,00','Enviado'],
];

const menuGroups = [
  {title:'Visão geral', items:[['dashboard','Início',Home],['quotes','Orçamentos',FileText],['clients','Clientes',Users]]},
  {title:'Catálogo', items:[['catalog','Serviços e materiais',Package],['costs','Custos da empresa',Wallet],['pricing','Formação de preço',Calculator]]},
  {title:'Configurações', items:[['company','Minha empresa',Building2],['settings','Preferências',Settings]]},
] as const;

function money(v:number){ return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function statusClass(s:string){
  return s==='Aprovado'?'text-emerald-400 bg-emerald-400/10':s==='Enviado'?'text-orange-300 bg-orange-400/10':'text-slate-400 bg-slate-400/10';
}

export default function QuotingApp(){
  const [screen,setScreen]=useState<Screen>('dashboard');
  const [menu,setMenu]=useState(false);
  const [search,setSearch]=useState('');
  const [items,setItems]=useState<QuoteItem[]>(initialItems);
  const [taxService,setTaxService]=useState(5);
  const [taxMaterial,setTaxMaterial]=useState(8);
  const [margin,setMargin]=useState(20);
  const [discount,setDiscount]=useState(0);
  const [showBreakdown,setShowBreakdown]=useState(true);
  const [company,setCompany]=useState('Minha Empresa');
  const [primary,setPrimary]=useState(localStorage.getItem('quote-primary') || '#ff7a00');

  const base=useMemo(()=>items.reduce((s,i)=>s+i.qty*i.cost,0),[items]);
  const tax=useMemo(()=>items.reduce((s,i)=>{
    const rate=i.type==='material'?taxMaterial:taxService;
    return s+(i.qty*i.cost)/(1-(rate+margin)/100)*(rate/100);
  },0),[items,taxMaterial,taxService,margin]);
  const subtotal=useMemo(()=>items.reduce((s,i)=>{
    const rate=i.type==='material'?taxMaterial:taxService;
    return s+(i.qty*i.cost)/(1-(rate+margin)/100);
  },0),[items,taxMaterial,taxService,margin]);
  const profit=Math.max(0,subtotal-base-tax);
  const total=Math.max(0,subtotal-discount);

  const theme={'--q-primary':primary} as React.CSSProperties;

  const nav=(s:Screen)=>{setScreen(s);setMenu(false);};
  const addItem=()=>{
    const next=items.length+1;
    setItems([...items,{id:next,name:'Novo item',type:'service',qty:1,unit:'un',cost:100}]);
    setScreen('quotes');
  };

  return <div style={theme} className="min-h-screen bg-[#03070d] text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#03070d]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={()=>setMenu(true)} className="rounded-xl p-2 hover:bg-white/6" aria-label="Abrir menu"><Menu size={22}/></button>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--q-primary)] text-white shadow-lg shadow-orange-500/20"><Calculator size={19}/></div>
          <div><div className="font-bold leading-none">Orça<span className="text-[var(--q-primary)]">Fácil</span></div><div className="text-[10px] text-slate-500">Prestadores de serviços</div></div>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm sm:block">{company}</button>
          <button className="rounded-xl p-2 hover:bg-white/6"><Bell size={19}/></button>
        </div>
      </div>
    </header>

    {menu && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={()=>setMenu(false)}>
      <aside onClick={e=>e.stopPropagation()} className="h-full w-[310px] max-w-[88vw] overflow-y-auto border-r border-white/8 bg-[#07101a] p-5 shadow-2xl">
        <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--q-primary)]"><Calculator size={20}/></div><div className="font-bold">OrçaFácil</div></div><button onClick={()=>setMenu(false)}><X/></button></div>
        {menuGroups.map(g=><div key={g.title} className="mb-6"><div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{g.title}</div>{g.items.map(([key,label,Icon])=><button key={key} onClick={()=>nav(key as Screen)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${screen===key?'bg-[var(--q-primary)]/12 text-white':'text-slate-300 hover:bg-white/5'}`}><Icon size={18}/><span>{label}</span><ChevronRight size={15} className="ml-auto opacity-40"/></button>)}</div>)}
        <div className="mt-8 rounded-2xl border border-white/8 bg-white/3 p-4"><div className="mb-1 text-sm font-semibold">Administrador</div><div className="mb-3 text-xs text-slate-500">Configura o aplicativo globalmente</div><a href="/admin-orcamentos" className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-2 text-sm hover:bg-white/10">Abrir painel admin <ChevronRight size={15}/></a></div>
      </aside>
    </div>}

    <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6">
      {screen==='dashboard' && <Dashboard onNew={()=>setScreen('quotes')} onMenu={()=>setMenu(true)} total={total} />}
      {screen==='clients' && <Clients search={search} setSearch={setSearch}/>}
      {screen==='quotes' && <QuoteBuilder items={items} setItems={setItems} taxService={taxService} taxMaterial={taxMaterial} margin={margin} discount={discount} setDiscount={setDiscount} showBreakdown={showBreakdown} setShowBreakdown={setShowBreakdown} base={base} tax={tax} profit={profit} total={total} onAdd={addItem}/>}
      {screen==='catalog' && <Catalog onAdd={addItem}/>}
      {screen==='costs' && <Costs/>}
      {screen==='pricing' && <Pricing taxService={taxService} setTaxService={setTaxService} taxMaterial={taxMaterial} setTaxMaterial={setTaxMaterial} margin={margin} setMargin={setMargin}/>}
      {screen==='company' && <Company company={company} setCompany={setCompany}/>}
      {screen==='settings' && <Settings showBreakdown={showBreakdown} setShowBreakdown={setShowBreakdown} primary={primary} setPrimary={p=>{setPrimary(p);localStorage.setItem('quote-primary',p)}}/>}
    </main>

    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/8 bg-[#050b12]/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        <Bottom icon={Home} label="Início" active={screen==='dashboard'} onClick={()=>nav('dashboard')}/>
        <Bottom icon={Users} label="Clientes" active={screen==='clients'} onClick={()=>nav('clients')}/>
        <button onClick={()=>setScreen('quotes')} className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-[var(--q-primary)] text-white shadow-xl shadow-orange-500/25"><Plus size={28}/></button>
        <Bottom icon={FileText} label="Orçamentos" active={screen==='quotes'} onClick={()=>nav('quotes')}/>
        <Bottom icon={Menu} label="Menu" active={menu} onClick={()=>setMenu(true)}/>
      </div>
    </nav>
  </div>
}

function Bottom({icon:Icon,label,active,onClick}:{icon:any;label:string;active:boolean;onClick:()=>void}){
  return <button onClick={onClick} className={`flex min-w-[58px] flex-col items-center gap-1 py-1 text-[10px] ${active?'text-[var(--q-primary)]':'text-slate-500'}`}><Icon size={19}/>{label}</button>
}

function Dashboard({onNew,total}:{onNew:()=>void;onMenu:()=>void;total:number}){
  return <div>
    <div className="mb-5"><div className="text-sm text-slate-400">Bom dia 👋</div><h1 className="text-2xl font-bold">Visão geral</h1></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric title="Faturamento" value={money(24680)} icon={TrendingUp}/>
      <Metric title="Orçamentos" value="18" sub="7 aprovados" icon={FileText}/>
      <Metric title="Taxa de aprovação" value="38,9%" sub="+5,2%" icon={BarChart3}/>
    </div>
    <button onClick={onNew} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--q-primary)] px-5 py-4 font-semibold text-white shadow-lg shadow-orange-500/15"><Plus size={20}/> Novo orçamento</button>
    <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recentes</h2><button className="text-xs text-[var(--q-primary)]">Ver todos</button></div>{quotes.slice(0,3).map(q=><div key={q[0]} className="mb-2 flex items-center gap-3 rounded-2xl border border-white/7 bg-[#09121c] p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5"><FileText size={18}/></div><div className="min-w-0 flex-1"><div className="text-sm font-medium">Orçamento {q[0]}</div><div className="text-xs text-slate-500">Cliente: {q[1]}</div></div><div className="text-right"><div className="text-sm font-semibold">{q[2]}</div><span className={`rounded-md px-2 py-1 text-[10px] ${statusClass(q[3])}`}>{q[3]}</span></div></div>)}</section>
  </div>
}

function Metric({title,value,sub,icon:Icon}:{title:string;value:string;sub?:string;icon:any}){return <div className="rounded-2xl border border-white/7 bg-[#09121c] p-4"><div className="mb-3 flex items-center justify-between text-xs text-slate-500"><span>{title}</span><Icon size={17} className="text-[var(--q-primary)]"/></div><div className="text-xl font-bold">{value}</div>{sub&&<div className="mt-1 text-xs text-emerald-400">{sub}</div>}</div>}

function Clients({search,setSearch}:{search:string;setSearch:(v:string)=>void}){
  const filtered=clients.filter(c=>c.join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div><PageTitle title="Clientes" action={<button className="rounded-xl bg-[var(--q-primary)] p-2"><Plus size={20}/></button>}/><div className="relative mb-4"><Search className="absolute left-3 top-3 text-slate-500" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar clientes..." className="w-full rounded-xl border border-white/8 bg-white/4 py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--q-primary)]"/></div>{filtered.map((c,i)=><div key={c[0]} className="mb-2 flex items-center gap-3 rounded-2xl border border-white/7 bg-[#09121c] p-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--q-primary)]/15 font-semibold text-[var(--q-primary)]">{c[0][0]}</div><div className="min-w-0 flex-1"><div className="font-medium">{c[0]}</div><div className="text-xs text-slate-500">{c[1]} · {c[2]}</div></div><MoreVertical size={18} className="text-slate-500"/></div>)}</div>
}

function QuoteBuilder(p:{items:QuoteItem[];setItems:any;taxService:number;taxMaterial:number;margin:number;discount:number;setDiscount:any;showBreakdown:boolean;setShowBreakdown:any;base:number;tax:number;profit:number;total:number;onAdd:()=>void}){
  return <div><PageTitle title="Novo orçamento" action={<button className="rounded-xl p-2 hover:bg-white/5"><SlidersHorizontal size={19}/></button>}/><div className="mb-5 rounded-2xl border border-white/7 bg-[#09121c] p-4"><div className="text-[11px] uppercase tracking-wider text-slate-500">Cliente</div><div className="mt-1 font-medium">Maria Silva</div><div className="mt-1 text-xs text-slate-500">Selecione ou cadastre um cliente</div></div><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Itens</h2><button onClick={p.onAdd} className="text-sm text-[var(--q-primary)]">+ Adicionar item</button></div>{p.items.map(i=><div key={i.id} className="mb-2 flex items-center gap-3 rounded-2xl border border-white/7 bg-[#09121c] p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">{i.type==='material'?<Package size={17}/>:<Wrench size={17}/>}</div><div className="min-w-0 flex-1"><div className="text-sm font-medium">{i.name}</div><div className="text-xs text-slate-500">{i.qty} {i.unit} · custo {money(i.cost)}</div></div><div className="text-sm font-semibold">{money((i.qty*i.cost)/(1-((i.type==='material'?p.taxMaterial:p.taxService)+p.margin)/100))}</div></div>)}<div className="mt-5 rounded-2xl border border-white/7 bg-[#09121c] p-4"><Row l="Custo base" v={money(p.base)}/><Row l="Impostos" v={money(p.tax)}/><Row l="Margem" v={money(p.profit)}/><div className="my-3 h-px bg-white/7"/><label className="flex items-center justify-between text-sm"><span>Desconto</span><input type="number" value={p.discount} onChange={e=>p.setDiscount(Number(e.target.value))} className="w-28 rounded-lg border border-white/8 bg-white/4 px-2 py-2 text-right"/></label><label className="mt-3 flex items-center justify-between text-sm"><span>Exibir composição no orçamento</span><input type="checkbox" checked={p.showBreakdown} onChange={e=>p.setShowBreakdown(e.target.checked)} /></label><div className="mt-4 flex items-end justify-between"><span className="font-semibold">Total</span><span className="text-2xl font-bold text-[var(--q-primary)]">{money(p.total)}</span></div></div><button className="mt-4 w-full rounded-2xl bg-[var(--q-primary)] py-4 font-semibold">Continuar e pré-visualizar</button></div>
}

function Row({l,v}:{l:string;v:string}){return <div className="flex justify-between py-1.5 text-sm"><span className="text-slate-400">{l}</span><span>{v}</span></div>}

function Catalog({onAdd}:{onAdd:()=>void}){const cats=[['Materiais','45 itens',Package],['Serviços','18 itens',Wrench],['Mão de obra','8 itens',Users]] as const;return <div><PageTitle title="Serviços e materiais" action={<button onClick={onAdd} className="rounded-xl bg-[var(--q-primary)] p-2"><Plus size={20}/></button>}/><div className="grid gap-3 sm:grid-cols-3">{cats.map(([t,s,I])=><div key={t} className="rounded-2xl border border-white/7 bg-[#09121c] p-4"><I className="text-[var(--q-primary)]"/><div className="mt-4 font-semibold">{t}</div><div className="text-xs text-slate-500">{s}</div></div>)}</div><div className="mt-5 rounded-2xl border border-white/7 bg-[#09121c] p-4"><div className="mb-4 flex items-center justify-between"><span className="font-semibold">Itens cadastrados</span><Search size={18} className="text-slate-500"/></div>{initialItems.map(i=><div key={i.id} className="flex items-center justify-between border-b border-white/5 py-3 last:border-0"><div><div className="text-sm">{i.name}</div><div className="text-xs text-slate-500">{i.type}</div></div><span className="font-medium">{money(i.cost)}</span></div>)}</div></div>}

function Costs(){return <div><PageTitle title="Custos da empresa" action={<button className="rounded-xl bg-[var(--q-primary)] p-2"><Plus size={20}/></button>}/><div className="rounded-2xl border border-white/7 bg-[#09121c] p-5"><div className="text-xs text-slate-500">Custo mensal estimado</div><div className="mt-1 text-3xl font-bold">{money(6000)}</div><div className="mt-2 text-xs text-slate-500">132 horas produtivas/mês · custo mínimo sugerido {money(45.45)}/h</div></div><div className="mt-4 space-y-2">{[['Aluguel','R$ 1.500'],['Contabilidade','R$ 400'],['Internet','R$ 150'],['Veículo','R$ 800'],['Pró-labore','R$ 3.000'],['Software','R$ 150']].map(x=><div key={x[0]} className="flex justify-between rounded-xl border border-white/7 bg-[#09121c] p-3 text-sm"><span>{x[0]}</span><span>{x[1]}</span></div>)}</div></div>}

function Pricing({taxService,setTaxService,taxMaterial,setTaxMaterial,margin,setMargin}:{taxService:number;setTaxService:any;taxMaterial:number;setTaxMaterial:any;margin:number;setMargin:any}){return <div><PageTitle title="Formação de preço"/><div className="grid gap-3 sm:grid-cols-3">{[['Imposto sobre serviços',taxService,setTaxService,Percent],['Imposto sobre materiais',taxMaterial,setTaxMaterial,Receipt],['Margem de lucro',margin,setMargin,TrendingUp]].map(([label,val,setter,I]:any)=><div key={label} className="rounded-2xl border border-white/7 bg-[#09121c] p-4"><I size={19} className="text-[var(--q-primary)]"/><div className="mt-3 text-sm text-slate-400">{label}</div><div className="mt-2 flex items-center gap-2"><input type="number" value={val} onChange={e=>setter(Number(e.target.value))} className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-3 text-lg font-semibold"/><span>%</span></div></div>)}</div><div className="mt-4 rounded-2xl border border-[var(--q-primary)]/20 bg-[var(--q-primary)]/5 p-4 text-sm text-slate-300">O cálculo usa os percentuais como parte do preço final, fazendo o gross-up para preservar a margem desejada após os impostos.</div></div>}

function Company({company,setCompany}:{company:string;setCompany:any}){return <div><PageTitle title="Minha empresa"/><div className="rounded-2xl border border-white/7 bg-[#09121c] p-5 space-y-4">{[['Nome da empresa',company],['CNPJ / CPF',''],['Telefone',''],['E-mail',''],['Endereço','']].map(([l,v])=><label key={l} className="block text-sm"><span className="mb-2 block text-slate-400">{l}</span><input defaultValue={v} onChange={e=>l==='Nome da empresa'&&setCompany(e.target.value)} className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-3 outline-none focus:border-[var(--q-primary)]"/></label>)}<div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Logo da empresa · upload será conectado ao armazenamento na próxima etapa</div><button className="w-full rounded-xl bg-[var(--q-primary)] py-3 font-semibold">Salvar empresa</button></div></div>}

function Settings({showBreakdown,setShowBreakdown,primary,setPrimary}:{showBreakdown:boolean;setShowBreakdown:any;primary:string;setPrimary:any}){return <div><PageTitle title="Preferências"/><div className="space-y-3">{[['Mostrar impostos no orçamento',showBreakdown,setShowBreakdown],['Mostrar margem no orçamento',false,()=>{}],['Usar preços calculados automaticamente',true,()=>{}]].map(([l,v,s]:any)=><label key={l} className="flex items-center justify-between rounded-2xl border border-white/7 bg-[#09121c] p-4 text-sm"><span>{l}</span><input type="checkbox" checked={v} onChange={e=>s(e.target.checked)}/></label>)}<div className="rounded-2xl border border-white/7 bg-[#09121c] p-4"><div className="mb-3 flex items-center gap-2"><Palette size={18} className="text-[var(--q-primary)]"/>Cor principal</div><div className="flex items-center gap-3"><input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} className="h-12 w-16 rounded-lg bg-transparent"/><input value={primary} onChange={e=>setPrimary(e.target.value)} className="flex-1 rounded-xl border border-white/8 bg-white/4 px-3 py-3 font-mono text-sm"/></div></div></div></div>}

function PageTitle({title,action}:{title:string;action?:ReactNode}){return <div className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-bold">{title}</h1>{action}</div>}
