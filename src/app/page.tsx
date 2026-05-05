import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import PricingCards from "@/components/landing/PricingCards";
import Stats from "@/components/landing/Stats";
import Testimonials from "@/components/landing/Testimonials";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <Hero />
      <Features />
      <Stats />
      <PricingCards />
      <Testimonials />
      <Footer />
    </main>
  );
}
