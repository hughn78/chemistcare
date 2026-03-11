import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, FileCheck, TrendingUp, Check, Menu, X,
  Lock, Server, Eye, ClipboardList, ChevronDown,
  Stethoscope, BarChart3, Zap, ExternalLink, ArrowRight,
  BookOpen, Clock, CheckCircle2, Shield, Users, BadgeCheck } from
"lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/chemistcare-logo.png";
import logoFullImg from "@/assets/chemistcare-logo-full.png";
import { Mic, Brain, FileText, MessageSquare, Languages, Sparkles } from "lucide-react";

/* ── Scrolling Marquee Banner ── */
function MarqueeBanner({ items, bgClass, textClass, speed = 30 }: {items: string[];bgClass: string;textClass: string;speed?: number;}) {
  const content = [...items, ...items, ...items];
  return (
    <div className={`overflow-hidden ${bgClass} py-3 relative`}>
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `marquee ${speed}s linear infinite`,
          width: "fit-content"
        }}>
        
        {content.map((item, i) =>
        <span key={i} className={`inline-flex items-center gap-3 mx-8 text-sm font-semibold tracking-wide uppercase ${textClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {item}
          </span>
        )}
      </div>
    </div>);

}

/* ── AI Feature Marquee with icons ── */
function AIMarqueeBanner() {
  const features = [
  { icon: Mic, text: "Real-Time Speech-to-Text Transcription" },
  { icon: Brain, text: "AI-Powered Clinical Note Generation" },
  { icon: FileText, text: "Auto-Generated SOAP Notes" },
  { icon: MessageSquare, text: "Smart GP Letter Drafting" },
  { icon: Languages, text: "Multi-Language Voice Recognition" },
  { icon: Sparkles, text: "Intelligent Red-Flag Detection" },
  { icon: Mic, text: "Live Consult Transcription" },
  { icon: Brain, text: "Evidence-Based Decision Support" },
  { icon: FileText, text: "Automated Audit Documentation" },
  { icon: MessageSquare, text: "AI Patient Summary Generation" }];

  const content = [...features, ...features, ...features];
  return (
    <div className="overflow-hidden bg-gradient-to-r from-[#2dd4bf]/10 via-[#2dd4bf]/5 to-[#2dd4bf]/10 border-y border-[#2dd4bf]/20 py-4 relative">
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `marquee 40s linear infinite`,
          width: "fit-content"
        }}>
        
        {content.map((item, i) =>
        <span key={i} className="inline-flex items-center gap-2 mx-8 text-sm font-medium text-[#2dd4bf]">
            <item.icon size={16} className="shrink-0" />
            {item.text}
          </span>
        )}
      </div>
    </div>);

}

/* ── Animated counter ── */
function AnimatedCounter({ target, suffix = "", prefix = "" }: {target: number;suffix?: string;prefix?: string;}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {setCount(target);clearInterval(timer);} else
      {setCount(Math.floor(current));}
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ── Section wrapper ── */
function Section({ children, className = "", id }: {children: React.ReactNode;className?: string;id?: string;}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section id={id} ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: "easeOut" }} className={className}>
      {children}
    </motion.section>);

}

/* ── FAQ Accordion ── */
function FAQItem({ q, a }: {q: string;a: string;}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-6 text-left group">
        <span className="text-white font-semibold text-lg pr-4" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{q}</span>
        <ChevronDown size={20} className={`text-[#2dd4bf] shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open &&
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <p className="text-[#94a3b8] text-base leading-relaxed pb-6">{a}</p>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}

/* ── Data ── */
const howItWorksSteps = [
{ num: "01", title: "Patient books online", desc: "Patients select a prescribing service through your branded booking portal. Intake forms, eligibility checks, and consent are auto-collected before arrival." },
{ num: "02", title: "Pre-consult snapshot", desc: "Review allergy alerts, dispense history, eligibility flags, and GP contact status — everything you need before the consult begins." },
{ num: "03", title: "Guided prescribing workflow", desc: "Follow protocol step-by-step with real-time decision support, red-flag prompts, and auto-drafted clinical notes as you consult." },
{ num: "04", title: "Post-consult in 60 seconds", desc: "eScript generated, GP letter drafted, billing recorded, follow-up scheduled — complete with audit-ready documentation." }];


const faqs = [
{ q: "How long does setup take?", a: "Most pharmacies are live within 48 hours. We handle onboarding, protocol configuration, and staff training remotely — no IT team required." },
{ q: "How does ChemistCare handle data security?", a: "All data is hosted on Australian-based infrastructure with AES-256 encryption at rest and TLS 1.3 in transit. We implement role-based access controls, full audit trails, and configurable data retention policies." },
{ q: "Does it integrate with existing dispensing systems?", a: "ChemistCare PrescriberOS complements your existing POS/dispensing system. We provide structured exports and are actively developing direct integrations with major Australian pharmacy platforms." },
{ q: "What does it cost?", a: "We offer transparent per-pharmacy pricing with no lock-in contracts. Early access partners receive founding-member rates. Contact us to discuss your specific needs." },
{ q: "Is this aligned with AHPRA and TGA requirements?", a: "Yes. ChemistCare PrescriberOS supports compliance with AHPRA professional standards and TGA requirements for pharmacist prescribing under Structured Prescribing Arrangements. Our protocols are reviewed by practising pharmacist prescribers." }];


const roles = [
{ value: "", label: "Select your role" },
{ value: "intern", label: "Pharmacy Intern" },
{ value: "pharmacist", label: "Registered Pharmacist" },
{ value: "prescriber", label: "Pharmacist Prescriber" },
{ value: "owner", label: "Pharmacy Owner / Manager" },
{ value: "other", label: "Other" }];


/* ── Waitlist Form ── */
function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {toast.error("Please enter a valid email.");return;}
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("waitlist-signup", {
        body: { email, role: role || undefined, pharmacy_name: pharmacyName || undefined }
      });
      if (error) throw error;
      toast.success(data?.message || "You're on the list!");
      setSubmitted(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#2dd4bf]/10 mb-4">
          <Check size={32} className="text-[#2dd4bf]" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>You're on the list!</h3>
        <p className="text-[#94a3b8]">We'll be in touch shortly with early access details.</p>
      </div>);

  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-3">
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacy.com.au" required
      className="w-full rounded-xl px-5 py-4 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-[#2dd4bf]/50 outline-none text-base transition-colors" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={role} onChange={(e) => setRole(e.target.value)}
        className="rounded-xl px-5 py-4 bg-white/10 border border-white/20 text-white outline-none text-base transition-colors focus:border-[#2dd4bf]/50 appearance-none">
          {roles.map((r) => <option key={r.value} value={r.value} className="bg-[#0f172a] text-white">{r.label}</option>)}
        </select>
        <input type="text" value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} placeholder="Pharmacy name (optional)"
        className="rounded-xl px-5 py-4 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-[#2dd4bf]/50 outline-none text-base transition-colors" />
      </div>
      <button type="submit" disabled={loading}
      className="w-full bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] font-semibold px-6 py-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 text-base">
        {loading ? "Joining..." : "Join the Waitlist →"}
      </button>
    </form>);

}

/* ── Page ── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to hash anchor on mount (e.g. /#waitlist from external pages)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 300);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif", scrollBehavior: "smooth" }}>

      {/* ─── NAVBAR ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <img src={logoFullImg} alt="ChemistCare PrescriberOS" className="h-10 w-auto" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">Features</a>
            <a href="#how-it-works" className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">How It Works</a>
            <Link to="/full-scope-of-practice" className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">Full Scope of Practice</Link>
            <a href="#security" className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">Security</a>
            <a href="#faq" className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">FAQ</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors px-4 py-2">Log in</button>
            <button onClick={() => navigate("/dashboard")}
            className="bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] font-semibold text-sm px-5 py-2.5 rounded-lg transition-all">
              Start Prescribing Now
            </button>
            
          </div>
          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen &&
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-[#0f172a] border-t border-white/5 px-6 py-4 flex flex-col gap-3">
              <a href="#features" className="text-[#94a3b8] text-sm py-2" onClick={() => setMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="text-[#94a3b8] text-sm py-2" onClick={() => setMenuOpen(false)}>How It Works</a>
              <Link to="/full-scope-of-practice" className="text-[#94a3b8] text-sm py-2" onClick={() => setMenuOpen(false)}>Full Scope of Practice</Link>
              <a href="#security" className="text-[#94a3b8] text-sm py-2" onClick={() => setMenuOpen(false)}>Security</a>
              <a href="#faq" className="text-[#94a3b8] text-sm py-2" onClick={() => setMenuOpen(false)}>FAQ</a>
              <button onClick={() => {setMenuOpen(false);navigate("/dashboard");}}
            className="bg-[#2dd4bf] text-[#0f172a] font-semibold text-sm px-5 py-3 rounded-lg w-full mt-2">Start Prescribing Now</button>
            </motion.div>
          }
        </AnimatePresence>
      </nav>

      {/* ─── SCROLLING BANNERS (below fixed navbar) ─── */}
      <div className="pt-[72px]">
        <AIMarqueeBanner />
      </div>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[80vh] flex items-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #2dd4bf 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2dd4bf]/[0.04] rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 text-[#2dd4bf] text-sm font-medium px-4 py-2 mb-8">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2dd4bf] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#2dd4bf]" /></span>
              Now Available in Victoria · Early Access 2026
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-bold leading-[1.05] tracking-tight text-white mb-8"
            style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              <span className="text-[#2dd4bf]">ChemistCare</span> Your partner for full scope of practice, pharmacy prescribing
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl md:text-2xl text-[#94a3b8] max-w-2xl mb-10 leading-relaxed">Protocol-driven prescribing, automated documentation, and practice-ready workflow — so you consult and prescribe{' '}
              <strong className="text-white">confidently</strong>, not just compliantly.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-start gap-4">
              <button onClick={() => navigate("/dashboard")}
              className="bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2">
                Start Prescribing Now <ArrowRight size={20} />
              </button>
              <button onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
              className="border border-white/20 text-white bg-white/5 px-8 py-4 text-lg font-semibold rounded-xl hover:bg-white/10 transition-all duration-300">
                Join the Waitlist
              </button>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ─── TRUST BADGES BAR ─── */}
      <div className="border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {[
            { icon: ShieldCheck, label: "AHPRA Aligned" },
            { icon: Lock, label: "AES-256 Encrypted" },
            { icon: Server, label: "Australian Data Residency" },
            { icon: FileCheck, label: "Privacy Act Compliant" },
            { icon: BadgeCheck, label: "Victorian SPA Compatible" }].
            map((b) =>
            <div key={b.label} className="flex items-center gap-2 text-[#94a3b8] text-sm">
                <b.icon size={16} className="text-[#2dd4bf]" />
                <span className="font-medium">{b.label}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── STATS STRIP ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Real-World Impact</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Pharmacist prescribing is already transforming healthcare
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
            { target: 62000, suffix: "+", label: "Services across 800+ VIC pharmacies", source: "Vic Health", href: "https://www.health.vic.gov.au/news/chemist-care-now-is-expanding-to-treat-more-conditions" },
            { target: 23000, suffix: "+", label: "Pilot services — zero serious safety concerns", source: "Vic Pilot Summary", href: "https://www.health.vic.gov.au/publications/victorian-community-pharmacist-statewide-pilot-summary-report" },
            { target: 12000, suffix: "+", label: "NSW trial consultations milestone", source: "NSW Health", href: "https://www.health.nsw.gov.au/news/Pages/20240305_00.aspx" },
            { target: 18, suffix: "", label: "National Scope of Practice recommendations", source: "Australian Government", href: "https://www.health.gov.au/our-work/scope-of-practice-review" }].
            map((s, i) =>
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="text-center bg-white/[0.03] border border-white/10 rounded-2xl p-8">
                <p className="text-5xl md:text-6xl font-bold text-white tabular-nums mb-3" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
                  <AnimatedCounter target={s.target} suffix={s.suffix} />
                </p>
                <p className="text-[#94a3b8] text-base leading-snug mb-3">{s.label}</p>
                <a href={s.href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#2dd4bf] text-sm font-medium hover:underline">
                  {s.source} <ExternalLink size={12} />
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── PROBLEM / SOLUTION ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-6" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
                Unseen admin destroys clinical capacity
              </h2>
              <p className="text-lg text-[#94a3b8] leading-relaxed mb-8">Australian pharmacist prescribers spend more time on paperwork than patients. Documentation, compliance checks, GP letters, billing... it all adds up. ChemistCare PrescriberOS gives you that time back.

              </p>
              <div className="space-y-5">
                {[
                { icon: Clock, text: "Cut post-consult admin by up to 50%" },
                { icon: Shield, text: "Protocol-guided workflows reduce clinical risk" },
                { icon: TrendingUp, text: "Track revenue, volume, and outcomes in real time" },
                { icon: Users, text: "Built specifically for Australian pharmacist prescribers" }].
                map((item) =>
                <div key={item.text} className="flex items-start gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-[#2dd4bf]/10 flex items-center justify-center">
                      <item.icon size={20} className="text-[#2dd4bf]" />
                    </div>
                    <p className="text-white text-base font-medium pt-2">{item.text}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl border border-white/10 p-10 md:p-14">
                <p className="text-sm font-semibold text-[#2dd4bf] mb-6 tracking-wide uppercase">Today's Overview</p>
                <div className="space-y-4">
                  {[
                  { metric: "12", label: "Consults Today", color: "#2dd4bf" },
                  { metric: "$1,840", label: "Revenue Generated", color: "#1FA971" },
                  { metric: "3", label: "GP Referrals Sent", color: "#3B82F6" },
                  { metric: "5", label: "Follow-ups Scheduled", color: "#F6D860" }].
                  map((m) =>
                  <div key={m.label} className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-6 py-4">
                      <span className="text-[#94a3b8] text-sm font-medium">{m.label}</span>
                      <span className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>{m.metric}</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-[#475569] text-xs mt-6">Simulated dashboard · Updated in real time when live</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── FEATURES ─── */}
      <Section id="features" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Platform</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Your clinical command centre
            </h2>
            <p className="text-lg text-[#94a3b8] max-w-xl mx-auto">Everything you need for safe, efficient prescribing in one place.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
            { icon: Stethoscope, title: "Protocol-Driven Prescribing", body: "Victoria-approved clinical playbooks for UTI, shingles, OCP, skin conditions, and more. Instant eligibility screening, red-flag alerts, and real-time decision support." },
            { icon: FileCheck, title: "One-Click Documentation", body: "Auto-generated SOAP notes, GP referral letters, and audit-ready logs. Reduce post-consult admin by up to 50% with structured, compliant records." },
            { icon: BarChart3, title: "Practice Growth Engine", body: "Smart patient intake, real-time revenue dashboards, automated follow-ups, and configurable service menus. Turn your credential into a business asset." }].
            map((f, i) =>
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
            className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:-translate-y-1 hover:border-[#2dd4bf]/30 transition-all duration-300">
                <div className="bg-[#2dd4bf]/10 rounded-xl p-3 inline-flex mb-6">
                  <f.icon size={28} className="text-[#2dd4bf]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{f.title}</h3>
                <p className="text-[#94a3b8] leading-relaxed">{f.body}</p>
              </motion.div>
            )}
          </div>
        </div>
      </Section>


      {/* ─── HOW IT WORKS ─── */}
      <Section id="how-it-works" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">How It Works</p>
            <h2 className="text-4xl md:text-[3.5rem] font-bold text-white mb-4" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              From booking to billing, streamlined
            </h2>
            <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto">From the first click to the final note, ChemistCare is fast, secure, and designed around how you care.</p>
          </div>

          <div className="max-w-3xl mx-auto">
            {howItWorksSteps.map((step, i) =>
            <motion.div key={step.num} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
            className="relative flex gap-8 pb-16 last:pb-0">
                {i < howItWorksSteps.length - 1 &&
              <div className="absolute left-7 top-16 bottom-0 w-px bg-[#2dd4bf]/20" />
              }
                <div className="shrink-0 w-14 h-14 rounded-full bg-[#2dd4bf] flex items-center justify-center text-[#0f172a] font-bold text-lg relative z-10">
                  {step.num}
                </div>
                <div className="pt-2">
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{step.title}</h3>
                  <p className="text-[#94a3b8] text-base leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="text-center mt-16">
            <button onClick={() => navigate("/dashboard")}
            className="bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] px-8 py-4 text-base font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 inline-flex items-center gap-2">
              See it in action <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </Section>

      {/* ─── SECURITY ─── */}
      <Section id="security" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Security & Privacy</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Your duty of care, built in
            </h2>
            <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto">We hold ourselves to the highest standard there is: the one you set when you care for patients.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {["Privacy Act", "AHPRA Standards", "TGA Compliant", "APPs Aligned", "AES-256"].map((badge) =>
            <div key={badge} className="bg-white/[0.04] border border-white/10 rounded-lg px-5 py-3 text-sm font-medium text-[#94a3b8]">
                {badge}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
            { icon: Server, title: "Australian Data Residency", desc: "All patient and clinical data hosted on Australian-based infrastructure." },
            { icon: Lock, title: "Encryption at Rest & Transit", desc: "AES-256 encryption for stored data, TLS 1.3 for all data in transit." },
            { icon: Eye, title: "Role-Based Access Controls", desc: "Granular permissions ensuring staff only access data relevant to their role." },
            { icon: ClipboardList, title: "Audit Trails & Retention", desc: "Comprehensive activity logging with configurable data retention policies." }].
            map((sf, i) =>
            <motion.div key={sf.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center hover:-translate-y-1 transition-all duration-300">
                <div className="bg-[#2dd4bf]/10 rounded-xl p-3 inline-flex mb-5">
                  <sf.icon size={24} className="text-[#2dd4bf]" />
                </div>
                <h3 className="font-bold text-white mb-2" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{sf.title}</h3>
                <p className="text-sm text-[#94a3b8] leading-relaxed">{sf.desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── TESTIMONIALS ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Early Feedback</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              What early partners say
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
            { quote: "This gave me the clinical structure I needed after completing my prescriber training. Consultations are now half the time with zero second-guessing.", author: "Pharmacist Prescriber", location: "Burke Road Pharmacy, Melbourne" },
            { quote: "Protocol playbooks, billing, documentation — all in one screen. We scaled our prescribing service in the first month. Nothing else comes close for pharmacy.", author: "Pharmacy Owner", location: "Community Pharmacy, Victoria" }].
            map((t) =>
            <div key={t.location} className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 md:p-10">
                <Zap size={20} className="text-[#2dd4bf] mb-6" />
                <p className="text-[#cbd5e1] leading-relaxed text-lg mb-6 italic">"{t.quote}"</p>
                <p className="text-white font-semibold">{t.author}</p>
                <p className="text-[#64748b] text-sm">{t.location}</p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── POLICY MOMENTUM ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">In the Media</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Policy momentum is building
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
            { title: "Chemist Care Now Expanding", summary: "Victoria is expanding its pharmacist prescribing program to treat more conditions across 800+ pharmacies.", href: "https://www.health.vic.gov.au/news/chemist-care-now-is-expanding-to-treat-more-conditions" },
            { title: "VIC Pilot Summary Report", summary: "23,000+ services delivered safely in the first 12 months with no serious safety concerns reported.", href: "https://www.health.vic.gov.au/publications/victorian-community-pharmacist-statewide-pilot-summary-report" },
            { title: "Community Pharmacist Program", summary: "Victoria's program continues to expand access to healthcare across the state.", href: "https://www.health.vic.gov.au/primary-care/community-pharmacist-program" },
            { title: "National Scope of Practice Review", summary: "18 recommendations from the Australian Government to expand pharmacist scope of practice nationally.", href: "https://www.health.gov.au/our-work/scope-of-practice-review" },
            { title: "NSW Trial Hits 12,000 Consults", summary: "NSW pharmacist prescribing pilot reaches a major milestone with 12,000+ patient consultations.", href: "https://www.health.nsw.gov.au/news/Pages/20240305_00.aspx" },
            { title: "Queensland Pharmacist Prescribing", summary: "Queensland announces expanded scope of practice for pharmacists to improve community healthcare.", href: "https://statements.qld.gov.au/statements/102216" }].
            map((item, i) =>
            <motion.a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className="group bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#2dd4bf]/30 hover:-translate-y-1 transition-all duration-300 block">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#2dd4bf] transition-colors" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{item.title}</h3>
                <p className="text-[#94a3b8] text-sm leading-relaxed mb-4">{item.summary}</p>
                <span className="inline-flex items-center gap-1.5 text-[#2dd4bf] text-sm font-medium">Read more <ExternalLink size={12} /></span>
              </motion.a>
            )}
          </div>
        </div>
      </Section>

      {/* ─── VIDEOS ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">See the Buzz</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Stay present in the moments that matter
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
            "https://www.youtube.com/embed/bN94eaY-QDE",
            "https://www.youtube.com/embed/XnFnxe5y0_k",
            "https://www.youtube.com/embed/GbVFtOOmEQ4"].
            map((url, i) =>
            <motion.div key={url} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe src={url} title={`Video ${i + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                className="absolute inset-0 w-full h-full" loading="lazy" />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── FAQ ─── */}
      <Section id="faq" className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Common Questions</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Frequently asked questions
            </h2>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl px-8">
            {faqs.map((f) => <FAQItem key={f.q} {...f} />)}
          </div>
        </div>
      </Section>

      {/* ─── WAITLIST CTA ─── */}
      <Section id="waitlist" className="py-24 md:py-32 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
            Ready to transform your prescribing practice?
          </h2>
          <p className="text-[#94a3b8] text-lg mt-4 max-w-xl mx-auto mb-10">
            Join the waitlist and be among the first to experience ChemistCare Prescriber<span className="text-[#2dd4bf]">OS</span>.
          </p>
          <WaitlistForm />
          <p className="text-[#475569] text-sm mt-6">No spam · Instant confirmation · Founding partner rates</p>
        </div>
      </Section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <img src={logoImg} alt="ChemistCare" className="h-10 w-auto mb-4" />
              <p className="text-[#64748b] text-sm max-w-sm leading-relaxed">
                Clinical workflow software for pharmacist prescribers. Built in Australia, designed for the full scope of pharmacy practice.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Platform</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">Features</a>
                <a href="#how-it-works" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">How It Works</a>
                <Link to="/full-scope-of-practice" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">Full Scope of Practice</Link>
                <a href="#security" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">Security</a>
                <a href="#faq" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Contact</h4>
            <a href="mailto:hugh@blackshawsroadpharmacy.com.au" className="text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">
                hugh@blackshawsroadpharmacy.com.au
              </a>
              <p className="text-[#64748b] text-xs mt-2">General enquiries & partnership requests</p>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap justify-between items-center gap-4 text-[#475569] text-xs">
            <span>© 2026 ChemistCare PrescriberOS. All rights reserved.</span>
            <div className="flex flex-wrap gap-4">
              <span>Designed to support AHPRA & TGA compliance</span>
              <span>Privacy Act aligned</span>
              <span>Victorian SPA compatible</span>
            </div>
          </div>
        </div>
      </footer>
    </div>);

}