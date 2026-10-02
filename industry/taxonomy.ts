// Classificação do setor: categorias, marcadores, instituições e vocabulário de identidade.
// Modelos usam este vocabulário; temas classificam por marcadores e filtros agrupam categorias.
// Preserve key de categoria após publicação, pois aparece no endereço. Marcadores e catálogo podem mudar.

/** Categorias visíveis em filtros, cartões e RSS. key é estável; section agrupa seções de relatórios na ordem definida; guide orienta modelo. Sem categoria, usa seção industry ou a última. */
export const CATEGORIES = [
  { key: "science", label: "Ciência", section: "Ciência", guide: "Estudos, ensaios, revisões, congresso e ciência pré-clínica; conservar estágio de evidência" },
  { key: "regulation", label: "Regulação", section: "Regulação e segurança", guide: "ANVISA, Conitec, FDA, EMA, CFM, alertas, aprovações e recomendações oficiais" },
  { key: "public-health", label: "Saúde pública", section: "Saúde pública", guide: "Acesso, SUS, campanhas, epidemias, acidentes, perda visual e ações regionais" },
  { key: "innovation", label: "Inovação", section: "Inovação", guide: "Medicamentos, dispositivos, IA ocular e novas tecnologias" },
  { key: "patient-interest", label: "Pacientes", section: "Interesse público", guide: "Comportamento, celebridades, estética, esportes e ângulos de saúde ocular" },
  { key: "fact-check", label: "Checagem de fatos", section: "Checagem", guide: "Afirmações médicas problemáticas, percentuais, causalidade e sensacionalismo" },
  { key: "ai-models", label: "Modelo", section: "Lançamentos e atualizações de modelos", guide: "Lançamentos e resultados de avaliações de modelos, versões, pesos abertos, capacidades e preços" },
  { key: "ai-products", label: "Produto", section: "Lançamentos e atualizações de produtos", guide: "Lançamentos e atualizações de produtos, funções, aplicações, ferramentas, APIs e plataformas de IA" },
  { key: "industry", label: "Setor", section: "Notícias do setor", guide: "Operação de empresas, investimentos, aquisições, pessoas, parcerias, processos judiciais, regulação, políticas, mercado e infraestrutura" },
  { key: "paper", label: "Pesquisa", section: "Pesquisas científicas", guide: "Artigos científicos, relatórios técnicos, avaliações e conjuntos de dados" },
  { key: "tip", label: "Tutoriais", section: "Práticas e opiniões", guide: "Tutoriais, experiências, técnicas de uso, prompts, ferramentas e explicações técnicas" },
  { key: "opinion", label: "Opiniões", section: "Práticas e opiniões", guide: "Opiniões, comentários, análises, entrevistas e discussões de tendências" },
] as const;

/** Tipos de conteúdo devem corresponder a prompts/content-understanding.md e aos pesos das cinco dimensões em selection-score.md. */
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// Vocabulário de marcadores

/** Primeiro marcador obrigatoriamente pertence às categorias. */
export const CATEGORY_TAGS = [
  "Ciência", "Regulação", "Saúde pública", "Inovação", "Interesse público", "Checagem de fatos",
  "Atualização de produtos", "Lançamento de modelos", "Artigos/Pesquisa", "Código aberto/Repositórios", "Tutoriais/Prática", "Fenômenos/Tendências", "Opiniões de especialistas", "Avaliações/Referências", "Segurança/Alinhamento", "Notícias do setor", "Políticas/Regulação",
  "Ferramentas gerais/Sem IA", "Outros",
] as const;

/** Marcadores temáticos opcionais. */
export const TOPIC_TAGS = [
  "Retina", "Catarata", "Refrativa", "Glaucoma", "Córnea", "Miopia infantil", "Neuro-oftalmologia", "Trauma", "Lentes de contato", "Estética", "Diabetes", "Brasil",
  "Agentes", "Programação", "Raciocínio", "Multimodalidade", "Voz", "Vídeo", "Geração de imagens", "RAG", "Dispositivos locais", "Dados/Treinamento", "Buscar", "Implantação/Engenharia", "Ecossistema aberto", "Inteligência incorporada", "MCP/Chamadas de ferramentas",
] as const;

/** Marcadores opcionais de empresas, instituições e plataformas. */
export const ENTITY_TAGS = [
  "ANVISA", "CBO", "CFM", "Conitec", "Ministério da Saúde", "FDA", "EMA", "NEI","OpenAI", "Anthropic", "DeepSeek", "DeepMind", "Google", "Meta", "Microsoft", "xAI", "Hugging Face", "GitHub", "arXiv"] as const;

/** Normaliza sinônimos usados pelos modelos para o vocabulário canônico. */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
"产品更新":"Atualização de produtos",
"模型发布":"Lançamento de modelos",
"开源/仓库":"Código aberto/Repositórios",
"推理":"Raciocínio",
"多模态":"Multimodalidade",
"语音":"Voz",
"视频":"Vídeo",
  "\u6559\u7a0b/\u73a9\u6cd5": "Tutoriais/Prática", "\u6280\u5de7/\u6700\u4f73\u5b9e\u8df5": "Tutoriais/Prática", "\u5408\u4f5c/\u751f\u6001": "Notícias do setor", "\u878d\u8d44/\u6536\u8d2d": "Notícias do setor", "\u516c\u53f8\u52a8\u6001": "Notícias do setor",
  合作: "Notícias do setor", 生态: "Notícias do setor", 融资: "Notícias do setor", 收购: "Notícias do setor", 投资: "Notícias do setor", 并购: "Notícias do setor",
  政策: "Políticas/Regulação", 监管: "Políticas/Regulação", 法规: "Políticas/Regulação", 安全: "Segurança/Alinhamento", 对齐: "Segurança/Alinhamento",
  论文: "Artigos/Pesquisa", 研究: "Artigos/Pesquisa", paper: "Artigos/Pesquisa", papers: "Artigos/Pesquisa",
  "open-source": "Código aberto/Repositórios", 开源: "Código aberto/Repositórios", 仓库: "Código aberto/Repositórios", repo: "Código aberto/Repositórios",
  教程: "Tutoriais/Prática", 玩法: "Tutoriais/Prática", 指南: "Tutoriais/Prática", 技巧: "Tutoriais/Prática", 最佳实践: "Tutoriais/Prática", 实践: "Tutoriais/Prática",
  产品: "Atualização de produtos", 更新: "Atualização de produtos", 发布: "Lançamento de modelos", 模型: "Lançamento de modelos", 趋势: "Fenômenos/Tendências", 现象: "Fenômenos/Tendências", 观点: "Opiniões de especialistas",
  视频生成: "Vídeo", 非ai: "Ferramentas gerais/Sem IA", "non-ai": "Ferramentas gerais/Sem IA", 通用工具: "Ferramentas gerais/Sem IA", 工程工具: "Ferramentas gerais/Sem IA",
  安全扫描: "Ferramentas gerais/Sem IA", devops: "Ferramentas gerais/Sem IA", 行业: "Notícias do setor", 动态: "Notícias do setor",
};

/** Completa categoria ausente conforme tipo de conteúdo. */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  model_release: "Lançamento de modelos", product_launch: "Atualização de produtos", tool_or_prompt: "Tutoriais/Prática", research_paper: "Artigos/Pesquisa",
  industry_event: "Notícias do setor", opinion_analysis: "Opiniões de especialistas", tutorial_explainer: "Tutoriais/Prática",
};

// Empresas e instituições

/** Instituições por id: nome, marcador e aliases. null classifica apenas por entity:<id>. */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  anvisa: { name: "ANVISA", displayTag: "ANVISA", aliases: ["ANVISA", "Agência Nacional de Vigilância Sanitária"] },
  cbo: { name: "CBO", displayTag: "CBO", aliases: ["CBO", "Conselho Brasileiro de Oftalmologia"] },
  fda: { name: "FDA", displayTag: "FDA", aliases: ["FDA", "Food and Drug Administration"] },
  openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT", "Sora", "Codex", "GPT"] },
  anthropic: { name: "Anthropic", displayTag: "Anthropic", aliases: ["Anthropic", "Claude"] },
  google: { name: "Google", displayTag: "Google", aliases: ["Google", "DeepMind", "Gemini", "\u8c37\u6b4c"] },
  deepseek: { name: "DeepSeek", displayTag: "DeepSeek", aliases: ["DeepSeek", "\u6df1\u5ea6\u6c42\u7d22"] },
  qwen: { name: "Qwen", displayTag: null, aliases: ["Qwen", "\u901a\u4e49", "\u963f\u91cc"] },
  kimi: { name: "Kimi / Moonshot", displayTag: null, aliases: ["Kimi", "\u6708\u4e4b\u6697\u9762", "Moonshot"] },
  minimax: { name: "MiniMax", displayTag: null, aliases: ["MiniMax", "\u6d77\u87ba"] },
  zhipu: { name: "Zhipu GLM", displayTag: null, aliases: ["\u667a\u8c31", "GLM", "Z.ai"] },
  xai: { name: "xAI", displayTag: "xAI", aliases: ["xAI", "Grok"] },
  meta: { name: "Meta", displayTag: "Meta", aliases: ["Meta", "Llama"] },
  microsoft: { name: "Microsoft", displayTag: "Microsoft", aliases: ["Microsoft", "\u5fae\u8f6f", "Copilot"] },
  nvidia: { name: "NVIDIA", displayTag: null, aliases: ["NVIDIA", "\u82f1\u4f1f\u8fbe"] },
  "hugging-face": { name: "Hugging Face", displayTag: "Hugging Face", aliases: ["Hugging Face"] },
  cursor: { name: "Cursor", displayTag: null, aliases: ["Cursor", "Anysphere"] },
  openrouter: { name: "OpenRouter", displayTag: null, aliases: ["OpenRouter"] },
};

/** Instituição no título ou resumo deve existir no original; caso contrário, retorna título original ou vazio e remove resumo. Pode ficar vazio em setores sem esse problema. */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "anvisa", name: "ANVISA", patterns: [/anvisa|agência nacional de vigilância sanitária/i] },
  { id: "cbo", name: "CBO", patterns: [/\bcbo\b|conselho brasileiro de oftalmologia/i] },
  { id: "fda", name: "FDA", patterns: [/\bfda\b|food and drug administration/i] },
  { id: "openai", name: "OpenAI", patterns: [/openai|chatgpt|\bgpt-?[o\d]|\bsora\b|\bcodex\b/i] },
  { id: "anthropic", name: "Anthropic", patterns: [/anthropic|\bclaude\b/i, /\b(?:opus|sonnet|haiku)\s*\d+(?:[.\-]\d+)*\b/i, /\bfable\s*\d+(?:[.\-]\d+)*\b|\bmythos\b/i] },
  { id: "google", name: "Google / Gemini", patterns: [/google|deepmind|\bgemini\b|notebooklm|\bveo\s?\d|\bAlphaFold\b|\bAMIE\b/i] },
  { id: "deepseek", name: "DeepSeek", patterns: [/deepseek|深度求索/i] },
  { id: "xai", name: "xAI / Grok", patterns: [/\bxai\b|\bgrok\b/i] },
  { id: "meta", name: "Meta / Llama", patterns: [/\bMeta\b/, /\bmeta\s?ai\b|\bllama\b/i] },
  { id: "microsoft", name: "Microsoft / Copilot", patterns: [/microsoft|copilot|微软/i] },
  { id: "nvidia", name: "NVIDIA", patterns: [/nvidia|英伟达|\bnemotron\b|\bnemo\b|\bblackwell\b|\brubin(?:\s+ultra)?\b|\bcuda\b/i] },
  { id: "qwen", name: "Qwen", patterns: [/\bqwen|通义|千问/i] },
  { id: "hugging-face", name: "Hugging Face", patterns: [/hugging\s?face/i] },
  { id: "cursor", name: "Cursor", patterns: [/\bCursor\b/] },
  { id: "kimi", name: "Kimi / Moonshot", patterns: [/\bkimi\b|月之暗面|\bmoonshot\s?ai\b/i] },
  { id: "openrouter", name: "OpenRouter", patterns: [/openrouter/i] },
  { id: "minimax", name: "MiniMax", patterns: [/minimax/i] },
  { id: "zhipu", name: "Zhipu GLM", patterns: [/智谱|\bglm-?[4-9]/i] },
  { id: "hunyuan", name: "Tencent Hunyuan", patterns: [/混元|hunyuan/i] },
  { id: "doubao", name: "ByteDance Doubao", patterns: [/豆包|doubao|字节跳动|bytedance/i] },
  { id: "mistral", name: "Mistral", patterns: [/mistral/i] },
  { id: "perplexity", name: "Perplexity", patterns: [/\bPerplexity\b/] },
  { id: "runway", name: "Runway", patterns: [/\brunway\b/i] },
  { id: "suno", name: "Suno", patterns: [/\bsuno\b/i] },
  { id: "midjourney", name: "Midjourney", patterns: [/midjourney/i] },
  { id: "stability-ai", name: "Stability AI", patterns: [/stability\s?ai/i] },
  { id: "elevenlabs", name: "ElevenLabs", patterns: [/eleven\s?labs/i] },
  { id: "vllm", name: "vLLM", patterns: [/\bvllm\b/i] },
  { id: "ollama", name: "Ollama", patterns: [/\bollama\b/i] },
  { id: "windsurf", name: "Windsurf", patterns: [/windsurf/i] },
  { id: "devin", name: "Devin", patterns: [/\bdevin\b/i] },
  { id: "manus", name: "Manus", patterns: [/\bmanus\b/i] },
  { id: "apple", name: "Apple AI", patterns: [/\bapple\s?(intelligence|silicon|ai)\b|苹果(智能|\s?AI)/i] },
  { id: "amazon", name: "Amazon / AWS", patterns: [/amazon|\baws\b|亚马逊/i] },
  { id: "baidu", name: "Baidu ERNIE", patterns: [/百度|baidu|文心|\bernie\s?bot\b/i] },
];

/** Domínios de publicadores próprios; plataformas GitHub e arXiv não implicam autoria institucional. */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "openai", domains: ["openai.com"] },
  { entityId: "anthropic", domains: ["anthropic.com", "claude.com"] },
  { entityId: "google", domains: ["deepmind.google", "ai.google", "blog.google"] },
  { entityId: "deepseek", domains: ["deepseek.com"] },
  { entityId: "xai", domains: ["x.ai"] },
  { entityId: "meta", domains: ["ai.meta.com"] },
  { entityId: "microsoft", domains: ["microsoft.com"] },
  { entityId: "nvidia", domains: ["nvidia.com"] },
  { entityId: "qwen", domains: ["qwen.ai"] },
  { entityId: "cursor", domains: ["cursor.com"] },
  { entityId: "openrouter", domains: ["openrouter.ai"] },
];

/** Grafias no original que também identificam a instituição. */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "meta", pattern: /@AIatMeta\b/i },
  { entityId: "zhipu", pattern: /\bZhipu(?:\s+AI\b|['’]s\b)/i },
];
