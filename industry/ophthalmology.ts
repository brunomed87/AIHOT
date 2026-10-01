// Additive editorial profile. Thresholds are provisional until physician-labelled evaluation.
export const OPHTHALMOLOGY = {
  version: "ophthalmology-v1",
  timezone: "America/Sao_Paulo",
  memoryDays: 14,
  priorities: { retina: 1.15, catarata: 1.1, refrativa: 1.08 } as Record<string, number>,
  weights: { medicalEvidence: .10, publicInterest: .10, ophthalmologyRelevance: .15, editorialNovelty: .10,
    momentum: .10, patientUsefulness: .10, reelPotential: .05, carouselPotential: .05, curiosity: .05,
    factCheckPotential: .05, authorityPositioning: .05, attention: .10 } as Record<string, number>,
  saturation: { moderate: 3, high: 6, saturated: 10, maximumPenalty: 10 },
  queries: [
    'retina catarata cirurgia refrativa Brasil', 'perda de visão medicamento diabetes obesidade',
    'celebridade atleta olho visão acidente', 'metanol intoxicação cegueira Brasil',
    'cílios maquiagem estética lentes de contato complicação ocular', 'miopia crianças telas escolas tempo ao ar livre',
    'glaucoma córnea transplante saúde pública SUS', 'cegueira processo judicial cirurgia ocular',
    'retina inteligência artificial neurologia diagnóstico', 'ophthalmology phase 3 gene cell therapy trial',
    'FDA EMA ANVISA oftalmologia alerta aprovação', 'visão idosos tecnologia laser realidade virtual esportes espaço',
    'saúde ocular Norte Nordeste Centro-Oeste Sudeste Sul Brasil',
  ],
} as const;
