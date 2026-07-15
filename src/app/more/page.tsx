"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getOnboardingStatus } from "@/lib/auth";
import { loadGalleries, type Gallery } from "@/lib/galleryModel";
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
  | "status"
  | "sync";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
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
  const stroke = { stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.2" fill="currentColor" opacity=".82" /><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" fill="currentColor" opacity=".38" /></svg>;
  if (name === "team") return <svg {...common}><circle cx="12" cy="7" r="2.6" fill="currentColor" /><circle cx="5.5" cy="10" r="2" fill="currentColor" opacity=".55" /><circle cx="18.5" cy="10" r="2" fill="currentColor" opacity=".55" /><path d="M4 20c.7-3.1 3.2-4.8 8-4.8s7.3 1.7 8 4.8" fill="currentColor" opacity=".28" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3.2 19 6v5.2c0 4.4-2.7 7.6-7 9.6-4.3-2-7-5.2-7-9.6V6l7-2.8Z" {...stroke} fill="rgba(245,181,72,.14)" /><path d="M12 8v5M12 16h.01" {...stroke} /></svg>;
  if (name === "card") return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" {...stroke} fill="rgba(245,181,72,.12)" /><path d="M3 10h18M7 15h4" {...stroke} /></svg>;
  if (name === "cloud") return <svg {...common}><path d="M7.3 18.5h10.1a4 4 0 0 0 .6-8 6 6 0 0 0-11.3-1.9A4.9 4.9 0 0 0 7.3 18.5Z" {...stroke} /><path d="M12 12v6M9.5 15.4 12 18l2.5-2.6" {...stroke} /></svg>;
  if (name === "globe") return <svg {...common}><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M3.8 12h16.4M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5M12 3.5C9.7 5.9 8.6 8.7 8.6 12s1.1 6.1 3.4 8.5" {...stroke} /></svg>;
  if (name === "camera") return <svg {...common}><path d="M6 8h2l1.4-2h5.2L16 8h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" {...stroke} fill="rgba(245,181,72,.12)" /><circle cx="12" cy="13.5" r="3" {...stroke} /></svg>;
  if (name === "vault") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" {...stroke} /><circle cx="12" cy="12" r="4" {...stroke} /><path d="M12 8v8M8 12h8M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" {...stroke} /></svg>;
  if (name === "museum") return <svg {...common}><path d="M3 20h18M5 18V10M19 18V10M2.5 10h19L12 4 2.5 10Z" {...stroke} /><path d="M9 18v-5h6v5" {...stroke} /></svg>;
  if (name === "spark") return <svg {...common}><path d="M12 2.8 14.6 9l6.5 3-6.5 3L12 21.2 9.4 15l-6.5-3 6.5-3L12 2.8Z" {...stroke} fill="rgba(245,181,72,.12)" /></svg>;
  if (name === "status") return <svg {...common}><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="m8.2 12.4 2.5 2.5 5.4-6" {...stroke} /></svg>;
  return <svg {...common}><path d="M20 12a8 8 0 0 1-13.7 5.6M4 12A8 8 0 0 1 17.7 6.4" {...stroke} /><path d="M20 6v6h-6M4 18v-6h6" {...stroke} /></svg>;
}

function CommandCard({ icon, title, desc, href, cta = "Open", accent = false }: { icon: IconName; title: string; desc: string; href: string; cta?: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className="group block min-h-[154px] rounded-[8px] p-5 transition hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(150deg, rgba(9,23,31,.92), rgba(3,11,14,.92))",
        border: `1px solid ${border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.035)",
      }}
    >
      <Icon name={icon} size={34} />
      <div className="mt-5 text-[15px] font-semibold leading-tight" style={{ color: cream }}>{title}</div>
      <p className="mt-2 min-h-[40px] text-[12px] leading-[1.45]" style={{ color: muted }}>{desc}</p>
      <span
        className="mt-4 inline-flex h-30px items-center rounded-[6px] px-5 py-2 text-[12px] font-semibold"
        style={{
          color: accent ? "#111" : cream,
          background: accent ? "linear-gradient(135deg,#FFE7A0,#D6A84F 58%,#8F6519)" : "rgba(0,0,0,.18)",
          border: accent ? "1px solid rgba(255,225,139,.5)" : `1px solid ${border}`,
          boxShadow: accent ? "0 0 24px rgba(214,168,79,.24)" : "none",
        }}
      >
        {cta}
      </span>
    </Link>
  );
}

function MobileRow({ icon, title, href }: { icon: IconName; title: string; href: string }) {
  return (
    <Link href={href} className="flex h-[52px] items-center gap-3 border-b px-4 last:border-b-0" style={{ borderColor: borderSoft }}>
      <Icon name={icon} size={20} />
      <span className="flex-1 text-[13px] font-semibold" style={{ color: cream }}>{title}</span>
      <span className="text-[24px] leading-none" style={{ color: "#E8D9AA" }}>›</span>
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
            <div className="mt-2 text-[26px] leading-none" style={{ color: stat.tone === "cyan" ? cyan : cream, fontFamily: stat.label === "Member Since" ? "inherit" : serif, fontWeight: 600 }}>
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
  const [profile, setProfile] = useState<ProfileSummary>({ displayName: "EK's Collection", username: "collection", memberSince: "Apr 2024", profileType: "personal" });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const status = await getOnboardingStatus();
        if (!active) return;
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

  const commandCards = [
    { icon: "user" as const, title: "Account & Profile", desc: "Manage your collector identity, public handle, and preferences.", href: "/account" },
    ...(isBusiness
      ? [
          { icon: "vault" as const, title: "Workspace Settings", desc: "Manage business workspace details, defaults, and controls.", href: "/account/workspace" },
          { icon: "team" as const, title: "Team & Access", desc: "Invite team members and manage roles for your workspace.", href: "/account/team" },
        ]
      : []),
    { icon: "shield" as const, title: "Security", desc: "Passwords, 2FA, sessions, and privacy controls.", href: "/account/security" },
    { icon: "card" as const, title: "Billing & Plans", desc: "Manage subscription, payment methods, and invoices.", href: "/account/billing" },
    { icon: "cloud" as const, title: "Import & Export", desc: "Import collections or export your data and reports.", href: "/vault/import" },
    { icon: "cloud" as const, title: "Backup & Restore", desc: "Back up your vault. Restore or download archives.", href: "/account/backup" },
    { icon: "globe" as const, title: "Public Profile & Share", desc: "Customize your public profile and share your collections.", href: "/user/profile" },
    { icon: "camera" as const, title: "Scan & Capture", desc: "Scan cards, parts, and docs. Add to your vault instantly.", href: "/capture", cta: "Start Scan", accent: true },
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
        <header className="mb-7 hidden items-center justify-between gap-8 lg:grid lg:grid-cols-[360px_minmax(310px,1fr)_minmax(520px,auto)]">
          <div className="relative h-[156px] overflow-hidden rounded-[10px] border" style={{ borderColor: border, background: "rgba(2,9,12,.88)" }}>
            <Image src="/brand/vltd-command-vault-medallion.png" alt="" fill className="object-cover" priority />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(2,9,12,.08), transparent 46%, rgba(2,9,12,.44))" }} />
          </div>
          <div className="flex items-center gap-7">
            <div className="h-20 w-px" style={{ background: border }} />
            <div>
              <h1 className="text-[42px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>More / Command Center</h1>
              <p className="mt-2 max-w-[440px] text-[15px]" style={{ color: cream }}>Account hub for collectors. Manage your vault, tools, and world.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-7">
            {[
              ["shield", "Private", "Your data. Your control."],
              ["museum", "Museum-Grade", "Preserve. Curate. Share."],
              ["spark", "Intelligent", "Tools that work for you."],
              ["cloud", "Always Yours", "Anywhere. Any device."],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex items-center gap-3">
                <Icon name={icon as IconName} size={34} />
                <div>
                  <div className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: goldBright }}>{title}</div>
                  <div className="mt-1 text-[11px]" style={{ color: cream }}>{desc}</div>
                </div>
              </div>
            ))}
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
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_250px]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <p className="text-[13px]" style={{ color: cream }}>Welcome back,</p>
                      <div className="mt-1 flex items-center gap-3">
                        <h2 className="text-[40px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>{profile.displayName}</h2>
                        <Link href="/account" className="grid h-8 w-8 place-items-center rounded-[6px]" style={{ color: goldBright, border: `1px solid ${border}`, background: "rgba(214,168,79,.08)" }}>⌕</Link>
                      </div>
                      <p className="mt-2 text-[17px] font-semibold" style={{ color: cream }}>Command Center</p>
                      <p className="mt-2 max-w-[330px] text-[12px] leading-[1.55]" style={{ color: muted }}>Everything you need to manage your collection, tools, and account.</p>
                    </div>
                    <div className="w-full max-w-[690px]">
                      <StatStrip value={totalValue} items={items.length} galleries={publicGalleries} memberSince={profile.memberSince} />
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {commandCards.map((card) => <CommandCard key={card.title} {...card} />)}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-[8px] border" style={{ borderColor: border, background: panel }}>
                      <h3 className="border-b px-5 py-3 text-[15px] font-semibold" style={{ borderColor: borderSoft, color: cream }}>Recent Activity</h3>
                      <div className="divide-y" style={{ borderColor: borderSoft }}>
                        {activity.map((row) => (
                          <div key={row.text} className="flex items-center justify-between gap-4 px-5 py-3 text-[12px]">
                            <span style={{ color: cream }}>◷ &nbsp;{row.text}</span>
                            <span className="shrink-0" style={{ color: muted }}>{row.time}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <Link href="/museum" className="relative overflow-hidden rounded-[8px] border p-5" style={{ borderColor: border, background: panel }}>
                      <div className="relative max-w-[270px]">
                        <h3 className="text-[30px] font-semibold leading-[.96]" style={{ color: cream, fontFamily: serif }}>Your vault.<br />Your legacy.</h3>
                        <p className="mt-3 text-[12px] leading-[1.45]" style={{ color: muted }}>Preserve it. Curate it. Share it on your terms.</p>
                        <span className="mt-4 inline-flex rounded-[6px] border px-4 py-2 text-[12px] font-semibold" style={{ borderColor: gold, color: goldBright }}>Explore Exhibitions →</span>
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
                    <Link href="/activity" className="mt-4 inline-flex text-[12px] font-semibold" style={{ color: goldBright }}>View status details →</Link>
                  </section>

                  <section className="rounded-[8px] border p-4" style={{ borderColor: border, background: panel }}>
                    <h3 className="text-[15px] font-semibold" style={{ color: cream }}>Quick Links</h3>
                    <div className="mt-3 grid gap-2 text-[13px]">
                      {[
                        ["Help Center", "/guide"],
                        ["Collector Guide", "/learn"],
                        ["What's New", "/activity"],
                        ["Feature Requests", "/community-board"],
                        ["Contact Support", "/account"],
                      ].map(([label, href]) => <Link key={label} href={href} style={{ color: label === "Contact Support" ? goldBright : cream }}>{label}</Link>)}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[390px] lg:hidden">
          <div className="mb-2 inline-flex rounded-[6px] border px-4 py-2 text-[13px] font-bold uppercase" style={{ borderColor: gold, color: goldBright }}>More Mobile</div>
          <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: border, background: panel }}>
            <div className="flex items-center justify-between px-4 py-4">
              <Image src="/brand/vltd-logo-header.png" alt="VLTD" width={92} height={32} className="h-auto w-[92px]" />
              <div className="flex gap-4 text-[24px]" style={{ color: cream }}><span>⌕</span><span>♢</span></div>
            </div>
            <Link href="/account" className="mx-4 mb-4 flex h-10 items-center justify-between rounded-full border px-4" style={{ borderColor: border, color: cream }}>
              <span className="text-[13px] font-semibold">◎ &nbsp; {profile.displayName}</span>
              <span style={{ color: goldBright }}>⌕</span>
            </Link>
            <div className="mx-4 grid grid-cols-3 rounded-[8px] border" style={{ borderColor: borderSoft, background: panel2 }}>
              <div className="p-3">
                <div className="text-[9px] uppercase" style={{ color: dim }}>Value</div>
                <div className="text-[20px] font-semibold" style={{ color: cyan }}>{money(totalValue)}</div>
                <div className="text-[10px]" style={{ color: green }}>▲ +{gain.toFixed(1)}% (30D)</div>
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
              <h2 className="text-[15px] font-semibold" style={{ color: cream }}>Command Center</h2>
              <p className="mt-1 text-[11px]" style={{ color: muted }}>Your tools, settings, and account hub.</p>
              <div className="mt-4 overflow-hidden rounded-[8px] border" style={{ borderColor: border, background: "rgba(3,12,16,.82)" }}>
                <MobileRow icon="user" title="Account & Profile" href="/account" />
                {isBusiness ? <MobileRow icon="vault" title="Workspace Settings" href="/account/workspace" /> : null}
                {isBusiness ? <MobileRow icon="team" title="Team & Access" href="/account/team" /> : null}
                <MobileRow icon="shield" title="Security" href="/account/security" />
                <MobileRow icon="card" title="Billing & Plans" href="/account/billing" />
              </div>
              <div className="mt-4 overflow-hidden rounded-[8px] border" style={{ borderColor: border, background: "rgba(3,12,16,.82)" }}>
                <MobileRow icon="cloud" title="Import & Export" href="/vault/import" />
                <MobileRow icon="cloud" title="Backup & Restore" href="/account/backup" />
                <MobileRow icon="camera" title="Scan & Capture" href="/capture" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
