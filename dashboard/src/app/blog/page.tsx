import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { blogPosts } from "@/lib/blog-data";

export const metadata = {
  title: "Blog — Land Buying Guides & Investment Tips",
  description: "Expert guides on buying land, owner financing, investment strategies, and more.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <div className="pt-16">
        <div className="border-b border-white/5 py-12" style={{ background: "var(--surface-low)" }}>
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Land Buying Blog</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Guides, tips, and insights on buying and investing in vacant land.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          {blogPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}
              className="group block rounded-xl overflow-hidden border border-white/5 transition-all hover:border-[var(--primary)]/30"
              style={{ background: "var(--surface)" }}>
              <div className="md:flex">
                <div className="md:w-72 h-48 md:h-auto shrink-0">
                  <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
                      {post.category}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
                      <Clock className="w-3 h-3" /> {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold mb-2 group-hover:text-[var(--primary)] transition-colors">{post.title}</h2>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>{post.excerpt}</p>
                  <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--primary)" }}>
                    Read More <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
