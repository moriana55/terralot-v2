import { Metadata } from "next";
import Link from "next/link";
import { Clock, ArrowLeft, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { blogPosts } from "@/lib/blog-data";

export async function generateStaticParams() {
  return blogPosts.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find(p => p.slug === slug);
  return {
    title: post?.title || "Blog Post",
    description: post?.excerpt,
  };
}

function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith("- **")) return `<li>${trimmed.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
      if (trimmed.startsWith("- ")) return `<li>${trimmed.slice(2)}</li>`;
      return `<p>${trimmed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
    })
    .join("\n");
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPosts.find(p => p.slug === slug);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
          <Link href="/blog" style={{ color: "var(--primary)" }}>Back to blog</Link>
        </div>
      </div>
    );
  }

  const idx = blogPosts.indexOf(post);
  const prev = blogPosts[idx - 1];
  const next = blogPosts[idx + 1];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--muted)" }}>
            <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-[var(--primary)]">Blog</Link>
            <span>/</span>
            <span style={{ color: "var(--foreground)" }}>{post.title}</span>
          </div>

          <img src={post.coverImage} alt={post.title} className="w-full h-64 md:h-80 object-cover rounded-2xl mb-8" />

          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
              {post.category}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
              <Clock className="w-3 h-3" /> {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold mb-8">{post.title}</h1>

          <article
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
          />

          {/* CTA */}
          <div className="mt-12 rounded-2xl p-8 text-center border border-[var(--primary)]/20" style={{ background: "var(--surface)" }}>
            <h3 className="text-xl font-bold mb-2">Ready to Find Your Land?</h3>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Browse our available properties with owner financing.</p>
            <Link href="/properties" className="px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--background)" }}>
              Browse Properties
            </Link>
          </div>

          {/* Nav */}
          <div className="mt-10 flex items-center justify-between border-t border-white/5 pt-6">
            {prev ? (
              <Link href={`/blog/${prev.slug}`} className="flex items-center gap-2 text-sm hover:text-[var(--primary)] transition-colors" style={{ color: "var(--muted)" }}>
                <ArrowLeft className="w-4 h-4" /> {prev.title}
              </Link>
            ) : <div />}
            {next ? (
              <Link href={`/blog/${next.slug}`} className="flex items-center gap-2 text-sm hover:text-[var(--primary)] transition-colors text-right" style={{ color: "var(--muted)" }}>
                {next.title} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : <div />}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
