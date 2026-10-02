// Identidade e textos visíveis do site. Primeiro arquivo ao adaptar setor.
// Interface e backend compartilham configuração; recompilar para aplicar, como docker compose up --build.
// Endereço público definido por SITE_URL na implantação.

export const SITE = {
  /** Nome em navegação, títulos, imagens, RSS, MCP e administração. */
  name: "Radar Oftalmologia Brasil",
  /** Nome do setor combinado aos rótulos de notícias e relatórios; adaptar ao segmento desejado. */
  subject: "Oftalmologia",
  /** Título completo inicial para aba do navegador e busca. */
  homeTitle: "Radar Oftalmologia Brasil — notícias, ciência e oportunidades editoriais",
  /** Apresentação curta para buscadores, cartões, RSS e llms.txt. */
  description: "Descoberta contínua de notícias, ciência e regulação, com memória editorial e evidência médica.",
  /** Texto curto no início e abaixo da navegação. */
  tagline: "O que mudou na saúde dos olhos",
  /** Idioma de HTML lang e og:locale. */
  locale: "pt-BR",
  /** Endereço padrão quando SITE_URL não está definido. */
  defaultUrl: "http://localhost:3000",
  /** Prefixo de ferramentas MCP com letras minúsculas, números e sublinhado. Preserve depois que clientes integrarem. */
  mcpPrefix: "radar_oftalmo",
  /** Contato público opcional nos termos, llms.txt e cabeçalhos. */
  contactEmail: null as string | null,
  /** Nota opcional de rodapé. */
  footerNote: "Desenvolvido com o framework de código aberto AIHOT",
  /** Registro ICP opcional para China continental, com link ao órgão responsável. */
  icp: null as string | null,
  /** Organização responsável nos dados estruturados de busca. */
  organization: {
    name: "Radar Oftalmologia Brasil",
    /** Fundador opcional: name, url e description. */
    founder: null as null | { name: string; url?: string; description?: string },
  },
  /** Nome do coletor em User-Agent; não usar nome de outro site. */
  crawlerName: "RadarOftalmologiaBot",
} as const;

/** Apresentação do site; contagens de fontes, materiais, selecionados e relatórios vêm das estatísticas atuais. */
export const ABOUT = {
  kicker: `Sobre ${SITE.name}`,
  /** Título com primeira linha normal e segunda em cor de destaque. */
  headline: ["A saúde dos olhos muda todos os dias.", "Acompanhe os acontecimentos e a evidência."] as [string, string],
  /** Texto abaixo do título; {sources} recebe contagem atual de fontes. */
  lead: `${SITE.name} acompanha {sources} fontes, agrupa acontecimentos e preserva a trajetória de notícias e ciência.`,
  /** Quatro etapas abaixo da animação de fontes. */
  steps: {
    collect: "Fontes oficiais, ciência, imprensa nacional e regional e descoberta na web.",
    store: "Material preservado com origem; acontecimentos distintos e temas editoriais têm memórias separadas.",
    select: "Atenção original e dimensões médicas se complementam; campos desconhecidos permanecem explícitos.",
    publish: "Radar às 08h e 20h em São Paulo, sob demanda, repercussão e relatórios periódicos.",
  },
  /** Autoria opcional, oculta quando null. avatarSourceId usa avatar de fonte X. QR pelo painel ou industry/brand/contact/; ausência oculta cartão. */
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  /** Direitos e retirada no rodapé, seguido do link de sugestões. */
  copyright: `${SITE.name} publica resumos próprios e links. Os direitos dos originais pertencem às fontes. Solicitações de correção e retirada podem ser enviadas por`,
} as const;

/** Combina substantivo e setor em português, como Relatório de Oftalmologia. */
export function withSubject(noun: string): string {
  return `${noun} de ${SITE.subject}`;
}
