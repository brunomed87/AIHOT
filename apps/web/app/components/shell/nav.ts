// Site navigation, one place for the desktop sidebar, the mobile tab bar and the mobile "Mais" page.
import { withSubject } from "@aihot/industry/site";
import { FEATURES } from "@aihot/industry/features";
import type { ReactNode } from "react";
import {
  IconApps, IconBolt, IconBookmark, IconChart, IconDoc, IconFlame, IconGrid, IconHeart, IconHistory, IconList, IconMessage, IconPlug,
} from "../icons";

export interface NavItem {
  to: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  /** Match the path exactly (the home page). */
  end?: boolean;
  /** Shows the unread dot while the changelog has news. */
  changelog?: boolean;
}

export const SIDEBAR: Array<{ title: string; items: NavItem[] }> = [
  {title:"Oftalmologia",items:[
    {to:"/radar",label:"Radar agora",icon:IconBolt},
    {to:"/editorial-topics",label:"Memória editorial",icon:IconHistory},
    {to:"/radar/08",label:"Radar 08h",icon:IconDoc},
    {to:"/radar/20",label:"Radar 20h",icon:IconDoc},
    {to:"/ophthalmology/science",label:"Ciência",icon:IconGrid},
    {to:"/ophthalmology/regulation",label:"Regulação",icon:IconList},
    {to:"/ophthalmology/fact-check",label:"Checagem de fatos",icon:IconMessage},
    {to:"/ophthalmology/early-signals",label:"Sinais precoces",icon:IconChart},
  ]},
  {
    title: "Conteúdo",
    items: [
      { to: "/", label: "Destaques", icon: IconBolt, end: true },
      { to: "/all", label: "Todas as notícias", icon: IconList },
      { to: "/hot", label: "Mais discutidos", icon: IconFlame },
      { to: "/daily", label: withSubject("Relatórios"), icon: IconDoc },
      { to: "/topics", label: "Temas", icon: IconGrid },
      { to: "/starred", label: "Favoritos", icon: IconBookmark },
    ],
  },
  // The optional AI-only modules (industry/features.ts).
  ...(FEATURES.leaderboard || FEATURES.codexResetMonitor
    ? [
        {
          title: "Modelos e monitores",
          items: [
            ...(FEATURES.leaderboard ? [{ to: "/leaderboard", label: "Ranking de modelos", icon: IconChart }] : []),
            ...(FEATURES.codexResetMonitor ? [{ to: "/codex-reset", label: "Monitor Codex", icon: IconHistory }] : []),
          ],
        },
      ]
    : []),
  {
    title: "Mais",
    items: [
      { to: "/agent", label: "Integrações", icon: IconPlug },
      { to: "/about", label: "Sobre", icon: IconHeart },
      { to: "/changelog", label: "Atualizações", icon: IconHistory, changelog: true },
      { to: "/feedback", label: "Sugestões", icon: IconMessage },
    ],
  },
];

export const TABBAR: NavItem[] = [
  { to: "/", label: "Destaques", icon: IconBolt, end: true },
  { to: "/all", label: "Todas", icon: IconList },
  { to: "/daily", label: "Relatórios", icon: IconDoc },
  { to: "/more", label: "Mais", icon: IconApps, changelog: true },
];

/** Pages reached from the mobile "Mais" tab keep that tab highlighted. */
export const MORE_PATHS = ["/editorial-topics","/radar","/ophthalmology","/more", "/hot", "/topics", "/starred", "/leaderboard", "/codex-reset", "/agent", "/about", "/changelog", "/feedback", "/terms", "/privacy"];

export function tabIsActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  if (item.to === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (item.to === "/daily") return /^\/(daily|weekly|monthly)(\/|$)/.test(pathname);
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
