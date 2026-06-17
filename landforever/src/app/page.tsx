import Hero from "@/components/Hero";
import Trust from "@/components/Trust";
import HowItWorks from "@/components/HowItWorks";
import FeaturedListings from "@/components/FeaturedListings";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTASection from "@/components/CTASection";

export default function Home() {
  return (
    <main>
      <Hero />
      <Trust />
      <FeaturedListings />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      <CTASection />
    </main>
  );
}
