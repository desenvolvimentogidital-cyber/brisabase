import { useState } from 'react';
import { ArrowLeft, Check, Image, LayoutDashboard, Palette, Save, Settings2, SlidersHorizontal } from 'lucide-react';

const presets=[['Laranja vivo','#ff7a00'],['Azul elétrico','#1677ff'],['Verde energia','#10b981'],['Roxo moderno','#8b5cf6']];

export default function AdminApp(){
 const [primary,setPrimary]=useState(localStorage.getItem('quote-primary')||'#ff7a00');
 const [logo,setLogo]=useState(localStorage.getItem('quote-logo')||'');
 const [name,setName]=useState(localStorage.getItem('quote-name')||'OrçaFácil');
 const [saved,setSaved]=useState(false);
 const save=()=>{localStorage.setItem('quote-primary',primary);localStorage.setItem('quote-logo',logo);localStorage.setItem('quote-name',name);setSaved(true);setTimeout(()=>setSaved(false),1800)};
 return <div style={{'--admin-primary':primary} as React.CSSProperties} className="min-h-screen bg-[#03070d] text-slate-100">
  <header className="border-b border-white/8 bg-[#07101a]"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--admin-primary)]"><SlidersHorizontal size={19}/></div><div><div className="font-bold">Administração</div><div className="text-[10px] text-slate-500">Painel global do aplicativo</div></div></div><a href="/orcamentos" className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-sm"><ArrowLeft size={16}/> Aplicativo</a></div></header>
  <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[220px_1fr] sm:px-6">
   <aside className="hidden rounded-2xl border border-white/7 bg-[#09121c] p-3 lg:block"><div className="mb-3 px-3 text-[10px] uppercase tracking-widest text-slate-500">Admin</div>{[['Visão geral',LayoutDashboard],['Marca e cores',Palette],['Configurações',Settings2]].map(([l,I])=><button key={l as string} className="mb-1 flex w-full items-center gap-3 rounded-xl bg-white/4 px-3 py-3 text-sm"><I size={17}/>{l as string}</button>)}</aside>
   <main><div className="mb-5"><h1 className="text-2xl font-bold">Marca e aparência</h1><p className="mt-1 text-sm text-slate-500">As alterações aqui controlam a identidade visual exibida aos clientes.</p></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
     <section className="space-y-4">
      <div className="rounded-2xl border border-white/7 bg-[#09121c] p-5"><div className="mb-4 flex items-center gap-2 font-semibold"><Palette size={18} className="text-[var(--admin-primary)]"/> Cor principal</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{presets.map(([l,c])=><button key={c} onClick={()=>setPrimary(c)} className="rounded-xl border border-white/8 p-3 text-left hover:bg-white/5"><span className="mb-2 block h-7 rounded-lg" style={{background:c}}/><span className="text-xs">{l}</span></button>)}</div><div className="mt-4 flex gap-3"><input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} className="h-12 w-16"/><input value={primary} onChange={e=>setPrimary(e.target.value)} className="flex-1 rounded-xl border border-white/8 bg-white/4 px-3 font-mono"/></div></div>
      <div className="rounded-2xl border border-white/7 bg-[#09121c] p-5"><div className="mb-4 flex items-center gap-2 font-semibold"><Image size={18} className="text-[var(--admin-primary)]"/> Identidade</div><label className="block text-sm"><span className="mb-2 block text-slate-400">Nome do aplicativo</span><input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-3"/></label><label className="mt-4 block text-sm"><span className="mb-2 block text-slate-400">URL da logo</span><input value={logo} onChange={e=>setLogo(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-3"/></label></div>
      <button onClick={save} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--admin-primary)] py-4 font-semibold shadow-lg"><Save size={18}/>{saved?'Alterações salvas':'Salvar alterações'}</button>
     </section>
     <section className="rounded-2xl border border-white/7 bg-[#09121c] p-5"><div className="mb-3 text-xs uppercase tracking-widest text-slate-500">Prévia</div><div className="overflow-hidden rounded-3xl border border-white/8 bg-[#03070d] p-4"><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl" style={{background:primary}}>{logo?<img src={logo} alt="" className="h-full w-full object-contain"/>:<SlidersHorizontal size={19}/>}</div><div><div className="font-bold">{name}</div><div className="text-[10px] text-slate-500">Prestadores de serviços</div></div></div><div className="rounded-2xl border border-white/7 bg-[#09121c] p-4"><div className="text-xs text-slate-500">Faturamento</div><div className="mt-1 text-2xl font-bold">R$ 24.680,00</div><div className="mt-4 h-2 rounded-full bg-white/5"><div className="h-2 w-3/4 rounded-full" style={{background:primary}}/></div></div><button className="mt-3 w-full rounded-xl py-3 font-semibold text-white" style={{background:primary}}>Novo orçamento</button></div><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Check size={15} className="text-emerald-400"/> Preview em tempo real</div></section>
    </div>
   </main>
  </div>
 </div>
}
