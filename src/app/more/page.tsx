"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { loadGalleries, type Gallery } from "@/lib/galleryModel";
import { isOwnerEmail } from "@/lib/ownerAccess";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

const gold = "#D6A84F";
const goldBright = "#F5B548";
const cream = "#F0EAD6";
const muted = "#B8A978";
const dim = "#776D4B";
const cyan = "#44D9F2";
const green = "#4FD486";
const bg = "#02090C";
const panel = "rgba(4,14,18,0.84)";
const panel2 = "rgba(8,20,27,0.72)";
const border = "rgba(214,168,79,0.24)";
const borderSoft = "rgba(214,168,79,0.14)";
const serif = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";

type ProfileSummary = {
  displayName: string;
  username: string;
  memberSince: string;
  profileType: "personal" | "business";
};

type IconName =
  | "user"
  | "team"
  | "shield"
  | "card"
  | "cloud"
  | "globe"
  | "camera"
  | "vault"
  | "museum"
  | "spark"
  | "status";

type PanelKey =
  | "account"
  | "security"
  | "billing"
  | "importExport"
  | "backup"
  | "publicProfile"
  | "activity"
  | "help"
  | "notifications";

type CommandCardConfig = {
  icon: IconName;
  title: string;
  desc: string;
  href?: string;
  panel?: PanelKey;
  cta?: string;
  accent?: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function itemValue(item: VaultItem) {
  return Number(item.currentValue ?? item.estimatedValue ?? 0);
}

function itemCost(item: VaultItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function monthYear(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "Apr 2024";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function Icon({ name, size = 30 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    style: { color: goldBright },
    "aria-hidden": true,
  } as const;
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  if (name === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" fill="currentColor" opacity=".82" />
        <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" fill="currentColor" opacity=".38" />
      </svg>
    );
  }
  if (name === "team") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7" r="2.6" fill="currentColor" />
        <circle cx="5.5" cy="10" r="2" fill="currentColor" opacity=".55" />
        <circle cx="18.5" cy="10" r="2" fill="currentColor" opacity=".55" />
        <path d="M4 20c.7-3.1 3.2-4.8 8-4.8s7.3 1.7 8 4.8" fill="currentColor" opacity=".28" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3.2 19 6v5.2c0 4.4-2.7 7.6-7 9.6-4.3-2-7-5.2-7-9.6V6l7-2.8Z" {...stroke} fill="rgba(245,181,72,.14)" />
        <path d="M12 8v5M12 16h.01" {...stroke} />
      </svg>
    );
  }
  if (name === "card") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" {...stroke} fill="rgba(245,181,72,.12)" />
        <path d="M3 10h18M7 15h4" {...stroke} />
      </svg>
    );
  }
  if (name === "cloud") {
    return (
      <svg {...common}>
        <path d="M7.3 18.5h10.1a4 4 0 0 0 .6-8 6 6 0 0 0-11.3-1.9A4.9 4.9 0 0 0 7.3 18.5Z" {...stroke} />
        <path d="M12 12v6M9.5 15.4 12 18l2.5-2.6" {...stroke} />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" {...stroke} />
        <path d="M3.8 12h16.4M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5M12 3.5C9.7 5.9 8.6 8.7 8.6 12s1.1 6.1 3.4 8.5" {...stroke} />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg {...common}>
        <path d="M6 8h2l1.4-2h5.2L16 8h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" {...stroke} fill="rgba(245,181,72,.12)" />
        <circle cx="12" cy="13.5" r="3" {...stroke} />
      </svg>
    );
  }
  if (name === "vault") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="3" {...stroke} />
        <circle cx="12" cy="12" r="4" {...stroke} />
        <path d="M12 8v8M8 12h8M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" {...stroke} />
      </svg>
    );
  }
  if (name === "museum") {
    return (
      <svg {...common}>
        <path d="M3 20h18M5 18V10M19 18V10M2.5 10h19L12 4 2.5 10Z" {...stroke} />
        <path d="M9 18v-5h6v5" {...stroke} />
      </svg>
    );
  }
  if (name === "spark") {
    return (
      <svg {...common}>
        <path d="M12 2.8 14.6 9l6.5 3-6.5 3L12 21.2 9.4 15l-6.5-3 6.5-3L12 2.8Z" {...stroke} fill="rgba(245,181,72,.12)" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="m8.2 12.4 2.5 2.5 5.4-6" {...stroke} />
    </svg>
  );
}

function commandCardStyle(accent: boolean) {
  return {
    background: accent
      ? "linear-gradient(150deg, rgba(23,30,25,.96), rgba(6,15,14,.96))"
      : "linear-gradient(150deg, rgba(9,23,31,.92), rgba(3,11,14,.92))",
    border: `1px solid ${accent ? "rgba(245,181,72,.48)" : border}`,
    boxShadow: accent ? "0 0 30px rgba(214,168,79,.12), inset 0 1px 0 rgba(255,255,255,.045)" : "inset 0 1px 0 rgba(255,255,255,.035)",
  };
}

function CommandCard({ icon, title, desc, href, panel: panelKey, cta, accent = false, onPanel }: CommandCardConfig & { onPanel: (panel: PanelKey) => void }) {
  const content = (
    <>
      <Icon name={icon} size={34} />
      <div className="mt-5 text-[15px] font-semibold leading-tight" style={{ color: cream }}>{title}</div>
      <p className="mt-2 min-h-[40px] text-[12px] leading-[1.45]" style={{ color: muted }}>{desc}</p>
      <span
        className="mt-4 inline-flex items-center rounded-[6px] px-5 py-2 text-[12px] font-semibold"
        style={{
          color: accent ? "#111" : cream,
          background: accent ? "linear-gradient(135deg,#FFE7A0,#D6A84F 58%,#8F6519)" : "rgba(0,0,0,.18)",
          border: accent ? "1px solid rgba(255,225,139,.5)" : `1px solid ${border}`,
        }}
      >
        {cta ?? (href ? "Open page" : "Open panel")}
      </span>
    </>
  );
  const className = "group block min-h-[154px] rounded-[8px] p-5 text-left transition hover:-translate-y-0.5";

  if (href) {
    return (
      <Link href={href} className={className} style={commandCardStyle(accent)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => panelKey && onPanel(panelKey)} className={className} style={commandCardStyle(accent)}>
      {content}
    </button>
  );
}

function MobileRow({ icon, title, href, panel: panelKey, onPanel }: { icon: IconName; title: string; href?: string; panel?: PanelKey; onPanel: (panel: PanelKey) => void }) {
  const content = (
    <>
      <Icon name={icon} size={20} />
      <span className="flex-1 text-[13px] font-semibold" style={{ color: cream }}>{title}</span>
      <span className="text-[24px] leading-none" style={{ color: "#E8D9AA" }}>›</span>
    </>
  );
  const className = "flex h-[52px] w-full items-center gap-3 border-b px-4 text-left last:border-b-0";

  if (href) {
    return (
      <Link href={href} className={className} style={{ borderColor: borderSoft }}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => panelKey && onPanel(panelKey)} className={className} style={{ borderColor: borderSoft }}>
      {content}
    </button>
  );
}

function MiniTool({ title, desc, href, panel: panelKey, onPanel }: { title: string; desc: string; href?: string; panel?: PanelKey; onPanel: (panel: PanelKey) => void }) {
  const content = (
    <>
      <span className="text-[13px] font-semibold" style={{ color: cream }}>{title}</span>
      <span className="mt-1 block text-[11px] leading-[1.35]" style={{ color: muted }}>{desc}</span>
    </>
  );
  const className = "rounded-[7px] border px-4 py-3 text-left transition hover:bg-white/[.03]";

  if (href) {
    return (
      <Link href={href} className={className} style={{ borderColor: borderSoft }}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => panelKey && onPanel(panelKey)} className={className} style={{ borderColor: borderSoft }}>
      {content}
    </button>
  );
}

function PanelDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 px-4 py-8" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close panel" onClick={onClose} />
      <section className="relative w-full max-w-[760px] overflow-hidden rounded-[10px] border" style={{ borderColor: border, background: "linear-gradient(150deg, rgba(6,18,24,.98), rgba(1,7,10,.98))" }}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: borderSoft }}>
          <h2 className="text-[22px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>{title}</h2>
          <button type="button" onClick={onClose} className="rounded-[6px] border px-3 py-1 text-[13px]" style={{ borderColor: border, color: cream }}>Close</button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex rounded-[6px] border px-4 py-2 text-[12px] font-semibold" style={{ borderColor: gold, color: goldBright }}>
      {children}
    </Link>
  );
}

function StatStrip({ value, items, galleries, memberSince }: { value: number; items: number; galleries: number; memberSince: string }) {
  const stats = [
    { label: "Collection Value", value: money(value), sub: "+12.6% (30D)", tone: "cyan" },
    { label: "Items", value: String(items), sub: "Total" },
    { label: "Exhibitions", value: String(galleries), sub: "Public" },
    { label: "Followers", value: "276", sub: "Total" },
    { label: "Member Since", value: memberSince, sub: "1 year" },
  ];
  return (
    <div className="grid rounded-[9px] border" style={{ borderColor: border, background: panel }}>
      <div className="grid grid-cols-2 md:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="min-h-[86px] px-5 py-4 md:border-r md:last:border-r-0" style={{ borderColor: borderSoft }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: dim }}>{stat.label}</div>
            <div className="mt-2 text-[26px] font-semibold leading-none" style={{ color: stat.tone === "cyan" ? cyan : cream, fontFamily: stat.label === "Member Since" ? "inherit" : serif }}>
              {stat.value}
            </div>
            <div className="mt-2 text-[12px]" style={{ color: stat.tone === "cyan" ? green : muted }}>{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MorePage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [profile, setProfile] = useState<ProfileSummary>({
    displayName: "EK's Collection",
    username: "collection",
    memberSince: "Apr 2024",
    profileType: "personal",
  });
  const [canUseOwnerTools, setCanUseOwnerTools] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const status = await getOnboardingStatus();
        const userResult = await getCurrentUser();
        if (!active) return;
        setCanUseOwnerTools(isOwnerEmail(userResult.data.user?.email));
        if (status.activeProfile) {
          const profileId = status.activeProfile.id;
          setProfile({
            displayName: status.activeProfile.display_name || "EK's Collection",
            username: status.activeProfile.username || "collection",
            memberSince: monthYear((status.activeProfile as Record<string, unknown>).created_at),
            profileType: status.activeProfile.profile_type === "business" ? "business" : "personal",
          });
          const profileItems = loadItems({ profileId });
          const profileGalleries = loadGalleries({ profileId });
          setItems(profileItems.length > 0 ? profileItems : loadItems({ includeAllProfiles: true }));
          setGalleries(profileGalleries.length > 0 ? profileGalleries : loadGalleries({ includeAllProfiles: true }));
          return;
        }
      } catch {
        // Keep local visual shell available if auth lookup is delayed.
      }
      if (!active) return;
      setCanUseOwnerTools(false);
      setItems(loadItems({ includeAllProfiles: true }));
      setGalleries(loadGalleries({ includeAllProfiles: true }));
    }
    void load();
    return () => { active = false; };
  }, []);

  const totalValue = useMemo(() => items.reduce((sum, item) => sum + itemValue(item), 0), [items]);
  const totalCost = useMemo(() => items.reduce((sum, item) => sum + itemCost(item), 0), [items]);
  const gain = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 12.6;
  const publicGalleries = galleries.filter((gallery) => gallery.visibility === "PUBLIC").length || galleries.length;
  const isBusiness = profile.profileType === "business";

  const commandCards: CommandCardConfig[] = [
    { icon: "user", title: "Account & Profile", desc: "Curator identity, handle, contact, and public profile controls.", panel: "account" },
    ...(isBusiness
      ? [
          { icon: "vault" as const, title: "Workspace Settings", desc: "Business workspace details, defaults, and controls.", href: "/account/workspace" },
          { icon: "team" as const, title: "Team & Access", desc: "Invite team members and manage workspace roles.", href: "/account/team" },
        ]
      : []),
    { icon: "shield", title: "Security", desc: "Passwords, sessions, privacy controls, and account protection.", panel: "security" },
    { icon: "card", title: "Billing & Plans", desc: "Plan, payment, invoice, and portal shortcuts.", panel: "billing" },
    { icon: "cloud", title: "Import & Export", desc: "Bring data in, export records, or prepare reports.", panel: "importExport" },
    ...(canUseOwnerTools
      ? [{ icon: "cloud" as const, title: "Backup & Restore", desc: "Archive, restore, and protect your vault data.", panel: "backup" as const }]
      : []),
    { icon: "globe", title: "Public Profile & Share", desc: "Profile, gallery sharing, and public presentation controls.", panel: "publicProfile" },
    { icon: "camera", title: "Scan & Capture", desc: "Open the full capture flow for camera and scan work.", href: "/capture", cta: "Start Scan", accent: true },
  ];

  const activity = [
    { text: `You added ${Math.min(3, Math.max(items.length, 1))} items to the ${profile.displayName}`, time: "2 min ago" },
    { text: "You created a new exhibition", time: "1 hour ago" },
    { text: "Backup completed successfully", time: "Today, 9:41 AM" },
    { text: "You exported an inventory report", time: "Yesterday, 2:18 PM" },
  ];

  return (
    <main className="min-h-screen px-4 pb-[calc(var(--bottomnav-h,0px)+32px)] pt-6 text-white sm:px-6 lg:px-8" style={{ background: `radial-gradient(circle at 16% 12%, rgba(20,58,76,.38), transparent 34%), ${bg}` }}>
      <div className="mx-auto max-w-[1460px]">
        <header className="mb-7 hidden items-center justify-between gap-8 lg:grid lg:grid-cols-[320px_minmax(340px,1fr)_minmax(480px,auto)]">
          <div className="relative h-[136px] overflow-hidden rounded-[10px] border" style={{ borderColor: border, background: "rgba(2,9,12,.88)" }}>
            <Image src="/brand/vltd-command-vault-medallion.png" alt="" fill className="object-cover" priority />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(2,9,12,.04), transparent 48%, rgba(2,9,12,.5))" }} />
          </div>
          <div className="flex items-center gap-7">
            <div className="h-20 w-px" style={{ background: border }} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: dim }}>{profile.profileType === "business" ? "Business Hub" : "Curator Hub"}</p>
              <h1 className="mt-2 text-[42px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>Command Center</h1>
              <p className="mt-2 max-w-[440px] text-[15px]" style={{ color: cream }}>Open account, data, sharing, help, and utility tools without hunting through menus.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniTool title="Activity" desc="Updates and recent account movement." panel="activity" onPanel={setActivePanel} />
            <MiniTool title="Notifications" desc="Alerts, follows, and exhibition updates." panel="notifications" onPanel={setActivePanel} />
            <MiniTool title="Help" desc="Guide, learning, and support paths." panel="help" onPanel={setActivePanel} />
            <MiniTool title="VLT Lounge" desc="Community board and feedback." href="/community-board" onPanel={setActivePanel} />
          </div>
        </header>

        <section className="hidden rounded-[10px] border lg:block" style={{ borderColor: border, background: "rgba(2,9,12,.74)" }}>
          <div className="grid grid-cols-[230px_minmax(0,1fr)]">
            <aside className="relative min-h-[690px] border-r p-6" style={{ borderColor: borderSoft }}>
              <div className="relative h-[430px] overflow-hidden rounded-[10px] border" style={{ borderColor: border, background: "rgba(2,9,12,.86)" }}>
                <Image src="/brand/vltd-command-vault-door.png" alt="" fill className="object-contain" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(2,9,12,.04), transparent 54%, rgba(2,9,12,.2))" }} />
              </div>
            </aside>

            <div className="p-7">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <p className="text-[13px]" style={{ color: cream }}>Welcome back,</p>
                      <div className="mt-1 flex items-center gap-3">
                        <h2 className="text-[40px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>{profile.displayName}</h2>
                        <button type="button" onClick={() => setActivePanel("account")} className="grid h-8 w-8 place-items-center rounded-[6px]" style={{ color: goldBright, border: `1px solid ${border}`, background: "rgba(214,168,79,.08)" }}>Edit</button>
                      </div>
                      <p className="mt-2 text-[17px] font-semibold" style={{ color: cream }}>{profile.profileType === "business" ? "Business command tools" : "Curator command tools"}</p>
                      <p className="mt-2 max-w-[430px] text-[12px] leading-[1.55]" style={{ color: muted }}>Panels keep common actions here. Deep workflows still open as full pages when they need room.</p>
                    </div>
                    <div className="w-full max-w-[690px]">
                      <StatStrip value={totalValue} items={items.length} galleries={publicGalleries} memberSince={profile.memberSince} />
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {commandCards.map((card) => <CommandCard key={card.title} {...card} onPanel={setActivePanel} />)}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-[8px] border" style={{ borderColor: border, background: panel }}>
                      <h3 className="border-b px-5 py-3 text-[15px] font-semibold" style={{ borderColor: borderSoft, color: cream }}>Recent Activity</h3>
                      <div className="divide-y" style={{ borderColor: borderSoft }}>
                        {activity.map((row) => (
                          <button key={row.text} type="button" onClick={() => setActivePanel("activity")} className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left text-[12px]">
                            <span style={{ color: cream }}>- {row.text}</span>
                            <span className="shrink-0" style={{ color: muted }}>{row.time}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <Link href="/museum" className="relative overflow-hidden rounded-[8px] border p-5" style={{ borderColor: border, background: panel }}>
                      <div className="relative max-w-[270px]">
                        <h3 className="text-[30px] font-semibold leading-[.96]" style={{ color: cream, fontFamily: serif }}>Your vault.<br />Your legacy.</h3>
                        <p className="mt-3 text-[12px] leading-[1.45]" style={{ color: muted }}>Preserve it. Curate it. Share it on your terms.</p>
                        <span className="mt-4 inline-flex rounded-[6px] border px-4 py-2 text-[12px] font-semibold" style={{ borderColor: gold, color: goldBright }}>Explore Exhibitions</span>
                      </div>
                    </Link>
                  </div>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-[8px] border p-4" style={{ borderColor: border, background: panel }}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold" style={{ color: cream }}>System Status</h3>
                      <Icon name="status" size={24} />
                    </div>
                    <p className="mt-2 text-[12px]" style={{ color: green }}>All Systems Operational</p>
                    {["Vault & Storage", "Web Services", "Background Sync"].map((label) => (
                      <div key={label} className="mt-4 flex justify-between border-t pt-3 text-[12px]" style={{ borderColor: borderSoft }}>
                        <span style={{ color: cream }}>{label}</span>
                        <span style={{ color: green }}>Operational</span>
                      </div>
                    ))}
                    <button type="button" onClick={() => setActivePanel("activity")} className="mt-4 inline-flex text-[12px] font-semibold" style={{ color: goldBright }}>View status details</button>
                  </section>

                  <section className="rounded-[8px] border p-4" style={{ borderColor: border, background: panel }}>
                    <h3 className="text-[15px] font-semibold" style={{ color: cream }}>More Tools</h3>
                    <div className="mt-3 grid gap-2">
                      <MiniTool title="Watchlist" desc="Saved pieces and follows." href="/wishlist" onPanel={setActivePanel} />
                      <MiniTool title="Goals" desc="Collection targets." href="/goals" onPanel={setActivePanel} />
                      <MiniTool title="Marketplace" desc="Browse collector listings." href="/market" onPanel={setActivePanel} />
                      <MiniTool title="Help & Support" desc="Guides and support links." panel="help" onPanel={setActivePanel} />
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[390px] lg:hidden">
          <div className="mb-2 inline-flex rounded-[6px] border px-4 py-2 text-[13px] font-bold uppercase" style={{ borderColor: gold, color: goldBright }}>Command Center</div>
          <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: border, background: panel }}>
            <div className="flex items-center justify-between px-4 py-4">
              <Image src="/brand/vltd-logo-header.png" alt="VLTD" width={92} height={32} className="h-auto w-[92px]" />
              <button type="button" onClick={() => setActivePanel("notifications")} className="text-[13px]" style={{ color: goldBright }}>Alerts</button>
            </div>
            <button type="button" onClick={() => setActivePanel("account")} className="mx-4 mb-4 flex h-10 w-[calc(100%-2rem)] items-center justify-between rounded-full border px-4" style={{ borderColor: border, color: cream }}>
              <span className="text-[13px] font-semibold">@{profile.username}</span>
              <span style={{ color: goldBright }}>{profile.profileType === "business" ? "Business" : "Curator"}</span>
            </button>
            <div className="mx-4 grid grid-cols-3 rounded-[8px] border" style={{ borderColor: borderSoft, background: panel2 }}>
              <div className="p-3">
                <div className="text-[9px] uppercase" style={{ color: dim }}>Value</div>
                <div className="text-[20px] font-semibold" style={{ color: cyan }}>{money(totalValue)}</div>
                <div className="text-[10px]" style={{ color: green }}>+{gain.toFixed(1)}% (30D)</div>
              </div>
              <div className="border-l p-3" style={{ borderColor: borderSoft }}>
                <div className="text-[9px] uppercase" style={{ color: dim }}>Items</div>
                <div className="text-[22px]" style={{ color: cream }}>{items.length}</div>
                <div className="text-[10px]" style={{ color: muted }}>Total</div>
              </div>
              <div className="border-l p-3" style={{ borderColor: borderSoft }}>
                <div className="text-[9px] uppercase" style={{ color: dim }}>Exhibitions</div>
                <div className="text-[22px]" style={{ color: cream }}>{publicGalleries}</div>
                <div className="text-[10px]" style={{ color: muted }}>Public</div>
              </div>
            </div>

            <div className="px-4 pb-5 pt-4">
              <h2 className="text-[15px] font-semibold" style={{ color: cream }}>Tools</h2>
              <p className="mt-1 text-[11px]" style={{ color: muted }}>Common actions open here. Larger workflows still use full pages.</p>
              <div className="mt-4 overflow-hidden rounded-[8px] border" style={{ borderColor: border, background: "rgba(3,12,16,.82)" }}>
                <MobileRow icon="user" title="Account & Profile" panel="account" onPanel={setActivePanel} />
                {isBusiness ? <MobileRow icon="vault" title="Workspace Settings" href="/account/workspace" onPanel={setActivePanel} /> : null}
                {isBusiness ? <MobileRow icon="team" title="Team & Access" href="/account/team" onPanel={setActivePanel} /> : null}
                <MobileRow icon="shield" title="Security" panel="security" onPanel={setActivePanel} />
                <MobileRow icon="card" title="Billing & Plans" panel="billing" onPanel={setActivePanel} />
              </div>
              <div className="mt-4 overflow-hidden rounded-[8px] border" style={{ borderColor: border, background: "rgba(3,12,16,.82)" }}>
                <MobileRow icon="cloud" title="Import & Export" panel="importExport" onPanel={setActivePanel} />
                {canUseOwnerTools ? <MobileRow icon="cloud" title="Backup & Restore" panel="backup" onPanel={setActivePanel} /> : null}
                <MobileRow icon="globe" title="Public Profile & Share" panel="publicProfile" onPanel={setActivePanel} />
                <MobileRow icon="camera" title="Scan & Capture" href="/capture" onPanel={setActivePanel} />
              </div>
              <div className="mt-4 overflow-hidden rounded-[8px] border" style={{ borderColor: border, background: "rgba(3,12,16,.82)" }}>
                <MobileRow icon="status" title="Activity" panel="activity" onPanel={setActivePanel} />
                <MobileRow icon="spark" title="Help & Learning" panel="help" onPanel={setActivePanel} />
              </div>
            </div>
          </div>
        </section>
      </div>
      {activePanel ? (
        <PanelDialog title="Command Panel" onClose={() => setActivePanel(null)}>
          <PanelContent activePanel={activePanel} profile={profile} items={items} galleries={galleries} />
        </PanelDialog>
      ) : null}
    </main>
  );
}

function PanelContent({ activePanel, profile, items, galleries }: { activePanel: PanelKey; profile: ProfileSummary; items: VaultItem[]; galleries: Gallery[] }) {
  const panelCopy: Record<PanelKey, { title: string; intro: string; bullets: string[]; links: Array<[string, string]> }> = {
    account: {
      title: "Account & Profile",
      intro: "Fast account summary without leaving the command center.",
      bullets: [`Display: ${profile.displayName}`, `Handle: @${profile.username}`, `Account type: ${profile.profileType === "business" ? "Business" : "Curator"}`],
      links: [["Open account settings", "/account"], ["Edit public profile", "/user/profile"]],
    },
    security: {
      title: "Security",
      intro: "Review sign-in, sessions, and privacy controls.",
      bullets: ["Password and login methods", "Session review", "Privacy controls"],
      links: [["Open security settings", "/account/security"]],
    },
    billing: {
      title: "Billing & Plans",
      intro: "Plan and payment controls live here, but checkout and invoice history stay on the billing page.",
      bullets: ["Current plan summary", "Payment method access", "Invoice and portal shortcuts"],
      links: [["Open billing", "/account/billing"]],
    },
    importExport: {
      title: "Import & Export",
      intro: "Move collection data in or out of VLTD.",
      bullets: ["Import spreadsheets or text lists", "Export vault records", "Prepare data for backup or reports"],
      links: [["Open import/export", "/vault/import"]],
    },
    backup: {
      title: "Backup & Restore",
      intro: "Keep the data control tools close without making this page a settings maze.",
      bullets: ["Download archive", "Restore from backup", "Review backup status"],
      links: [["Open backup tools", "/account/backup"]],
    },
    publicProfile: {
      title: "Public Profile & Share",
      intro: "Control how your collector identity appears when you choose to share.",
      bullets: [`Public exhibitions: ${galleries.length}`, "Profile presentation", "Share-ready public links"],
      links: [["Edit public profile", "/user/profile"], ["View exhibitions", "/museum"]],
    },
    activity: {
      title: "Activity",
      intro: "Recent account and collection movement at a glance.",
      bullets: [`Vault items: ${items.length}`, `Exhibitions: ${galleries.length}`, "Recent imports, exports, follows, and updates"],
      links: [["Open activity", "/activity"]],
    },
    help: {
      title: "Help & Learning",
      intro: "Guides and support without hunting through the More dropdown.",
      bullets: ["Collector guide", "Feature requests", "Support path"],
      links: [["Help center", "/guide"], ["Collector guide", "/learn"], ["Feature requests", "/community-board"]],
    },
    notifications: {
      title: "Notifications",
      intro: "Quick view for alerts and updates.",
      bullets: ["New follows and exhibition updates", "System notices", "Collection reminders"],
      links: [["Open notifications", "/notifications"]],
    },
  };
  const content = panelCopy[activePanel];

  return (
    <>
      <h3 className="text-[24px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>{content.title}</h3>
      <p className="mt-3 max-w-[620px] text-[13px] leading-[1.55]" style={{ color: muted }}>{content.intro}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {content.bullets.map((bullet) => (
          <div key={bullet} className="rounded-[7px] border p-4 text-[12px] leading-[1.4]" style={{ borderColor: borderSoft, color: cream, background: "rgba(255,255,255,.025)" }}>
            {bullet}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {content.links.map(([label, href]) => <PanelLink key={label} href={href}>{label}</PanelLink>)}
      </div>
    </>
  );
}
