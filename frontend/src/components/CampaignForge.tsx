import React, { useState } from 'react';
import { BookOpen, Scroll, Users, Tent, ArrowRight, Save, X, Plus, Trash2, Bookmark } from 'lucide-react';

interface CampaignForgeProps {
    onClose: () => void;
    onComplete: (campaignData: any) => void;
}

const CampaignForge: React.FC<CampaignForgeProps> = ({ onClose, onComplete }) => {
    const [activeStep, setActiveStep] = useState(1);
    const [activeChapterId, setActiveChapterId] = useState<number>(1);

    const [campaign, setCampaign] = useState({
        name: '',
        coverUrl: '',
        synopsis: '',
        rules: '',
        // 👉 A MÁGICA DOS CAPÍTULOS ACONTECE AQUI!
        chapters: [
            {
                id: 1,
                title: 'Capítulo 1: O Início',
                story: '',
                mainQuest: { title: '', description: '' },
                sideQuests: [] as { title: string, description: string }[]
            }
        ],
        npcs: [] as { name: string, role: string, description: string }[],
        rumors: [] as string[]
    });

    const STEPS = [
        { id: 1, title: 'Identidade', icon: <BookOpen size={18} />, desc: 'Capa e Sinopse' },
        { id: 2, title: 'História & Missões', icon: <Scroll size={18} />, desc: 'Capítulos e Objetivos' },
        { id: 3, title: 'Elenco Principal', icon: <Users size={18} />, desc: 'NPCs e Vilões' },
        { id: 4, title: 'Sessão Zero', icon: <Tent size={18} />, desc: 'Regras e Rumores' },
    ];

    const handleSave = () => {
        onComplete(campaign);
    };

    // --- FUNÇÕES DE GERENCIAMENTO DE CAPÍTULOS ---
    const addChapter = () => {
        const newId = Date.now();
        setCampaign(prev => ({
            ...prev,
            chapters: [
                ...prev.chapters,
                {
                    id: newId,
                    title: `Capítulo ${prev.chapters.length + 1}`,
                    story: '',
                    mainQuest: { title: '', description: '' },
                    sideQuests: []
                }
            ]
        }));
        setActiveChapterId(newId);
    };

    const updateChapter = (id: number, updates: any) => {
        setCampaign(prev => ({
            ...prev,
            chapters: prev.chapters.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    };

    const removeChapter = (id: number) => {
        if (window.confirm("Apagar este capítulo inteiro? Todas as missões dele serão perdidas!")) {
            setCampaign(prev => {
                const newChapters = prev.chapters.filter(c => c.id !== id);
                if (newChapters.length > 0 && activeChapterId === id) {
                    setActiveChapterId(newChapters[newChapters.length - 1].id);
                }
                return { ...prev, chapters: newChapters };
            });
        }
    };

    const activeChapter = campaign.chapters.find(c => c.id === activeChapterId);

    return (
        <div className="fixed inset-0 z-[500] bg-[#0a0a0e] flex items-center justify-center animate-in fade-in duration-300 font-serif">
            {/* Background com textura */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay"></div>
            
            <div className="relative w-full max-w-6xl h-[85vh] bg-[#15151a] border border-purple-500/30 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.15)] flex overflow-hidden">
                
                {/* Menu Lateral de Passos */}
                <div className="w-64 bg-black/60 border-r border-white/5 flex flex-col p-4 shrink-0">
                    <div className="mb-8 mt-2">
                        <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-500 uppercase tracking-widest text-center" style={{ fontFamily: 'Cinzel Decorative' }}>
                            Forja de Mundos
                        </h2>
                        <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest mt-1">Criação de Campanha</p>
                    </div>

                    <div className="flex flex-col gap-2 flex-grow">
                        {STEPS.map(step => (
                            <button
                                key={step.id}
                                onClick={() => setActiveStep(step.id)}
                                className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${activeStep === step.id ? 'bg-purple-900/40 border border-purple-500/50 text-purple-200 shadow-[inset_4px_0_0_#a855f7]' : 'border border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                            >
                                <div className={`${activeStep === step.id ? 'text-purple-400' : 'text-gray-500'}`}>{step.icon}</div>
                                <div>
                                    <div className="text-sm font-bold">{step.title}</div>
                                    <div className="text-[9px] uppercase tracking-widest opacity-60">{step.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} className="mt-auto py-3 text-gray-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                        <X size={14}/> Cancelar Criação
                    </button>
                </div>

                {/* Área de Conteúdo */}
                <div className="flex-1 flex flex-col relative bg-[#1a1a24]">
                    
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        
                        {/* STEP 1: IDENTIDADE */}
                        {activeStep === 1 && (
                            <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-500">
                                <div>
                                    <h3 className="text-2xl font-black text-white mb-1">A Fachada</h3>
                                    <p className="text-sm text-gray-400 mb-6">A primeira impressão que seus jogadores terão da sua campanha.</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1 block">Nome da Campanha *</label>
                                        <input 
                                            type="text" 
                                            value={campaign.name}
                                            onChange={e => setCampaign({...campaign, name: e.target.value})}
                                            placeholder="Ex: A Maldição de Strahd" 
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white text-lg font-bold outline-none focus:border-purple-500 transition-colors" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1 block">URL da Imagem de Capa</label>
                                        <input 
                                            type="text" 
                                            value={campaign.coverUrl}
                                            onChange={e => setCampaign({...campaign, coverUrl: e.target.value})}
                                            placeholder="Cole o link de uma imagem épica..." 
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500 transition-colors" 
                                        />
                                    </div>
                                    {campaign.coverUrl && (
                                        <div className="w-full h-48 rounded-xl overflow-hidden border border-white/10 shadow-lg relative">
                                            <img src={campaign.coverUrl} alt="Capa" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                                <span className="text-2xl font-black text-white drop-shadow-lg" style={{ fontFamily: 'Cinzel Decorative' }}>{campaign.name || 'Sua Campanha'}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1 block">Sinopse (O Pitch) *</label>
                                        <textarea 
                                            value={campaign.synopsis}
                                            onChange={e => setCampaign({...campaign, synopsis: e.target.value})}
                                            placeholder="Descreva brevemente o gancho principal. O que os heróis vão enfrentar?" 
                                            rows={4}
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-gray-300 text-sm outline-none focus:border-purple-500 transition-colors resize-none" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 👉 STEP 2: HISTÓRIA & MISSÕES (AGORA COM CAPÍTULOS!) */}
                        {activeStep === 2 && (
                            <div className="max-w-4xl mx-auto flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
                                
                                <div>
                                    <h3 className="text-2xl font-black text-white mb-1">Os Crônicas da Campanha</h3>
                                    <p className="text-sm text-gray-400 mb-4">Divida sua aventura por Capítulos ou Sessões para não se perder.</p>
                                </div>

                                {/* ABAS DE CAPÍTULOS */}
                                <div className="flex gap-2 overflow-x-auto custom-scrollbar mb-6 border-b border-white/10 pb-2">
                                    {campaign.chapters.map((chap, idx) => (
                                        <button
                                            key={chap.id}
                                            onClick={() => setActiveChapterId(chap.id)}
                                            className={`px-5 py-2.5 rounded-t-lg font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${activeChapterId === chap.id ? 'bg-purple-900/50 text-purple-100 border-t-2 border-purple-500 shadow-[0_-5px_15px_rgba(168,85,247,0.15)]' : 'bg-black/30 text-gray-500 hover:text-gray-300 hover:bg-black/50 border-t-2 border-transparent'}`}
                                        >
                                            <Bookmark size={14} className={activeChapterId === chap.id ? 'text-amber-400' : 'opacity-0 w-0'} />
                                            {chap.title || `Capítulo ${idx + 1}`}
                                        </button>
                                    ))}
                                    <button 
                                        onClick={addChapter} 
                                        className="px-4 py-2.5 bg-black/20 hover:bg-purple-900/30 text-purple-400/70 hover:text-purple-300 rounded-t-lg font-bold text-[10px] uppercase transition-colors flex items-center gap-1 border-t-2 border-transparent border-dashed hover:border-purple-500/50"
                                    >
                                        <Plus size={14}/> Novo Capítulo
                                    </button>
                                </div>

                                {/* CONTEÚDO DO CAPÍTULO SELECIONADO */}
                                {activeChapter && (
                                    <div className="space-y-6 animate-in fade-in duration-300 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                        
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1 block">Nome do Capítulo / Sessão</label>
                                                <input 
                                                    type="text" 
                                                    value={activeChapter.title}
                                                    onChange={e => updateChapter(activeChapter.id, { title: e.target.value })}
                                                    placeholder="Ex: Capítulo 1: O Início, ou Sessão 1: A Taverna" 
                                                    className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 text-white text-xl font-black outline-none focus:border-purple-500 transition-colors" 
                                                />
                                            </div>
                                            {campaign.chapters.length > 1 && (
                                                <button onClick={() => removeChapter(activeChapter.id)} className="mt-6 p-3 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors shadow-md" title="Excluir este capítulo">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 block">História / Acontecimentos Planejados</label>
                                            <textarea 
                                                value={activeChapter.story}
                                                onChange={e => updateChapter(activeChapter.id, { story: e.target.value })}
                                                placeholder="Descreva o que acontece neste capítulo. Desafios, locais, segredos a revelar..." 
                                                rows={5}
                                                className="w-full bg-black/40 border border-amber-900/50 rounded-lg p-4 text-gray-300 text-sm outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed" 
                                            />
                                        </div>

                                        <div className="bg-black/40 border border-purple-900/50 rounded-xl p-5 shadow-inner">
                                            <h4 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Scroll size={16}/> Missão Principal (Main Quest)</h4>
                                            <input 
                                                type="text" 
                                                value={activeChapter.mainQuest.title}
                                                onChange={e => updateChapter(activeChapter.id, { mainQuest: { ...activeChapter.mainQuest, title: e.target.value } })}
                                                placeholder="Qual o objetivo primário deste capítulo?" 
                                                className="w-full bg-black/50 border border-gray-700 rounded p-3 text-white font-bold text-sm outline-none focus:border-amber-500 mb-3" 
                                            />
                                            <textarea 
                                                value={activeChapter.mainQuest.description}
                                                onChange={e => updateChapter(activeChapter.id, { mainQuest: { ...activeChapter.mainQuest, description: e.target.value } })}
                                                placeholder="Descrição detalhada do objetivo principal..." 
                                                rows={3}
                                                className="w-full bg-black/50 border border-gray-700 rounded p-3 text-gray-300 text-xs outline-none focus:border-amber-500 resize-none" 
                                            />
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-black text-purple-400 uppercase tracking-widest">Missões Secundárias (Side Quests)</h4>
                                                <button 
                                                    onClick={() => updateChapter(activeChapter.id, { sideQuests: [...activeChapter.sideQuests, { title: '', description: '' }] })}
                                                    className="text-[10px] bg-purple-900/50 text-purple-200 px-3 py-1.5 rounded uppercase font-bold hover:bg-purple-600 transition-colors flex items-center gap-1"
                                                >
                                                    <Plus size={12}/> Adicionar Side Quest
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {activeChapter.sideQuests.map((sq, idx) => (
                                                    <div key={idx} className="bg-black/30 border border-white/10 rounded-lg p-3 flex gap-3 group">
                                                        <div className="flex-1 space-y-2">
                                                            <input 
                                                                type="text" 
                                                                value={sq.title}
                                                                onChange={e => { 
                                                                    const newSq = [...activeChapter.sideQuests]; 
                                                                    newSq[idx].title = e.target.value; 
                                                                    updateChapter(activeChapter.id, { sideQuests: newSq }); 
                                                                }}
                                                                placeholder="Título da Missão Secundária..." 
                                                                className="w-full bg-black/50 border border-gray-800 rounded p-2 text-white text-sm outline-none focus:border-purple-500" 
                                                            />
                                                            <input 
                                                                type="text" 
                                                                value={sq.description}
                                                                onChange={e => { 
                                                                    const newSq = [...activeChapter.sideQuests]; 
                                                                    newSq[idx].description = e.target.value; 
                                                                    updateChapter(activeChapter.id, { sideQuests: newSq }); 
                                                                }}
                                                                placeholder="Breve descrição ou objetivo..." 
                                                                className="w-full bg-black/50 border border-gray-800 rounded p-2 text-gray-400 text-xs outline-none focus:border-purple-500" 
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => { 
                                                                const newSq = activeChapter.sideQuests.filter((_, i) => i !== idx); 
                                                                updateChapter(activeChapter.id, { sideQuests: newSq }); 
                                                            }}
                                                            className="text-red-500/50 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                ))}
                                                {activeChapter.sideQuests.length === 0 && <p className="text-xs text-gray-600 italic text-center py-4 border border-dashed border-gray-800 rounded">Nenhuma side quest neste capítulo.</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* OUTROS PASSOS */}
                        {(activeStep === 3 || activeStep === 4) && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 animate-in zoom-in duration-500">
                                <Users size={48} className="opacity-20" />
                                <h3 className="text-xl font-bold text-white">Forja em Construção</h3>
                                <p className="text-sm max-w-md text-center leading-relaxed">
                                    Nesta área você poderá preparar seus NPCs e definir as Regras da Mesa (Sessão Zero). 
                                    <br/><br/>
                                    <span className="text-purple-400">A Identidade e os Capítulos já estão prontos para você iniciar a campanha de forma épica!</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Barra Inferior de Ações */}
                    <div className="bg-black/80 border-t border-white/5 p-4 flex justify-between items-center shrink-0">
                        <div>
                            {activeStep > 1 && (
                                <button onClick={() => setActiveStep(activeStep - 1)} className="text-gray-400 hover:text-white px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors">
                                    Voltar
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            {activeStep < STEPS.length ? (
                                <button 
                                    onClick={() => setActiveStep(activeStep + 1)} 
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                                >
                                    Próximo Passo <ArrowRight size={16}/>
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSave} 
                                    disabled={!campaign.name.trim()}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:grayscale text-white px-8 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center gap-2"
                                >
                                    <Save size={16}/> Criar Campanha
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CampaignForge;