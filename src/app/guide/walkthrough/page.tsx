import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Getting started with VLTD",
  description: "Learn how to add an item, build an exhibition, and choose what to share in VLTD.",
  alternates: { canonical: "/guide/walkthrough" },
};

const lessons = [
  {
    id: "add-item",
    title: "Add your first item",
    video: "add-item",
    href: "/capture",
    action: "Add an item",
    steps: [
      ["Open the form", "In Vault, choose ADD ITEM. Upload a photo or enter the details manually. A photo is optional."],
      ["Describe the piece", "Enter its item name. Add the brand, series, condition and notes you know. Record a certification or grade only when it applies to your item."],
      ["Choose its category", "Open CATEGORY. Choose a universe, then a category and subcategory. Use the other sections for storage, value and documents when you have those details."],
      ["Save and find it", "Choose Save to Vault. Return to Vault and search for the item by name. Your vault item starts private."],
    ],
  },
  {
    id: "exhibition",
    title: "Build and share an exhibition",
    video: "build-exhibition",
    href: "/museum/new",
    action: "Create an exhibition",
    steps: [
      ["Create the exhibition", "Open Exhibitions and choose New exhibit or Create Exhibition. Add a title and description. Keep it Private while you build. Choose a theme and display mode, then Create Exhibition."],
      ["Choose the pieces", "In the builder, open Edit/Add. Search or filter your vault, select the pieces you want on the exhibit, then choose Save at the bottom of the picker."],
      ["Arrange and preview", "Use the theme and shelf controls to set the appearance. Use Organize to arrange the display. Save your changes, then open Preview to check how the exhibition looks."],
      ["Choose who can see it", "Review USER ACCESS MODE. Keep Private for your own use. Choose Public Exhibit only when you want public access. Review the other access options and their help text if you need a different audience."],
      ["Share the visitor link", "For a public exhibition, use Copy Link. Open that link in a signed-out browser to check exactly what visitors can see before you send it. Check individual item visibility if a piece is missing."],
    ],
  },
];

export default function WalkthroughPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6" style={{ color: "var(--fg)" }}>
      <Link href="/guide" className="text-sm underline underline-offset-4">Back to Help</Link>
      <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Your first collection in VLTD</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8" style={{ color: "var(--muted)" }}>
        Start with one favorite piece. Follow the steps at your own pace, then build an exhibition around the items you want to show.
      </p>
      <nav aria-label="Walkthrough lessons" className="my-8 flex flex-wrap gap-5">
        {lessons.map((lesson) => <a key={lesson.id} href={`#${lesson.id}`} className="font-semibold underline underline-offset-4">{lesson.title}</a>)}
      </nav>
      {lessons.map((lesson) => (
        <section key={lesson.id} id={lesson.id} aria-labelledby={`${lesson.id}-title`} className="scroll-mt-24 border-t py-10" style={{ borderColor: "var(--border)" }}>
          <h2 id={`${lesson.id}-title`} className="mb-5 text-3xl font-bold">{lesson.title}</h2>
          <video controls playsInline preload="none" poster={`/guide-media/${lesson.video}.png`} className="aspect-video w-full rounded-xl bg-black" aria-label={`${lesson.title}: narrated screen walkthrough`}>
            <source src={`/guide-media/${lesson.video}.mp4`} type="video/mp4" />
            <track kind="captions" src={`/guide-media/${lesson.video}.vtt`} srcLang="en" label="English" />
            <p>Your browser does not support this video. Follow the written steps below.</p>
          </video>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>Narrated screen guide. Pause at any step, or use the written instructions below.</p>
          <ol className="my-7 list-decimal space-y-5 pl-6">
            {lesson.steps.map(([title, body]) => <li key={title} className="pl-2"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 max-w-3xl leading-7" style={{ color: "var(--muted)" }}>{body}</p></li>)}
          </ol>
          <Link href={lesson.href} className="inline-flex min-h-11 items-center rounded-lg px-5 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-4" style={{ background: "var(--fg)", color: "var(--bg)" }}>{lesson.action}</Link>
        </section>
      ))}
    </main>
  );
}
