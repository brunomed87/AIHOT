import { SITE } from "@aihot/industry/site";
import { pageMeta } from "../lib/seo";
import { prepareCopy } from "../lib/site-copy";
import copy from "@aihot/industry/pages/privacy.md?raw";
import { CopyPage, LegalFooterLinks } from "../features/copy/CopyPage";

const PRIVACY = prepareCopy(copy);

/** Shared caches may keep this page for five minutes. */
export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" };
}

export function meta() {
  return pageMeta({ title: "Privacidade", description: `Como o site trata dados locais do navegador, informações de feedback e registros de acesso.`, path: "/privacy", image: "/og/pages/privacy.png" });
}

export default function PrivacyPage() {
  return (
    <CopyPage
      doc={PRIVACY.doc}
      rendered={PRIVACY.rendered}
      eyebrow={SITE.name}
      footer={<LegalFooterLinks links={[{ to: "/terms", label: "Regras de uso" }, { to: "/feedback", label: "Página de feedback" }]} note={`Privacidade ${PRIVACY.doc.meta["Versão"] ?? ""} · ${PRIVACY.doc.meta["Data de vigência"] ?? ""}`} />}
    />
  );
}
