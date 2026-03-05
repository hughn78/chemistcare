import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Menu, X, ChevronDown, ArrowRight, ExternalLink,
  Stethoscope, GraduationCap, Handshake,
  ShieldCheck, HeartPulse, Pill, Baby, Ear, Wind, Flame,
  Bandage, ThermometerSun, Bone, Activity, Scale, Syringe, CigaretteOff,
  CheckCircle2, Clock, TrendingUp, FileCheck, Lock, MessageSquare,
  ClipboardList, Monitor
} from "lucide-react";
import logoFullImg from "@/assets/chemistcare-logo-full.png";
import logoImg from "@/assets/chemistcare-logo.png";

/* ── Reusable Section wrapper ── */
function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section id={id} ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: "easeOut" }} className={className}>
      {children}
    </motion.section>
  );
}

/* ── Animated counter ── */
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
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
      if (current >= target) { setCount(target); clearInterval(timer); } else { setCount(Math.floor(current)); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ── FAQ Accordion ── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-6 text-left group">
        <span className="text-white font-semibold text-lg pr-4" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{q}</span>
        <ChevronDown size={20} className={`text-[#2dd4bf] shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <p className="text-[#94a3b8] text-base leading-relaxed pb-6">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── State table data ── */
const stateData = [
  { state: "QLD", status: "Fully operational", badge: "✅", badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", acute: "UTI, ear, rhinitis, reflux, shingles, impetigo, acne, eczema, wound care, nausea, MSK pain, obesity", chronic: "Asthma, COPD, hypertension, dyslipidaemia, T2DM (Chronic Pilot to Jun 2026)", hospital: "State-wide CPMP (Apr 2025) — ED, inpatient, discharge", contraception: "Hormonal contraception initiation + resupply (permanent)" },
  { state: "VIC", status: "22 new services by 2027", badge: "🔄", badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", acute: "UTI, OCP resupply, shingles, psoriasis, travel/HepA/HepB/typhoid/polio vaccines", chronic: "In development under expansion", hospital: "25+ hospitals, PPMC since 2012", contraception: "OCP resupply (16–50 yrs)" },
  { state: "NSW", status: "Expanding from 2026", badge: "🔄", badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", acute: "Skin conditions (trial); ear + wound care planned; QLD-aligned 2026", chronic: "Excluded pending QLD pilot evaluation", hospital: "17 LHDs PPMC in EDs (2024)", contraception: "OCP resupply only" },
  { state: "WA", status: "Trial from 2026", badge: "🔜", badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30", acute: "All QLD pilot acute + chronic conditions", chronic: "Planned (QLD aligned)", hospital: "5 metro hospitals + wider rollout 2025", contraception: "Hormonal contraception initiation + resupply (2026)" },
  { state: "SA", status: "Jan 2026", badge: "🔜", badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30", acute: "QLD-aligned acute conditions", chronic: "Not yet confirmed", hospital: "All Local Health Networks PPMP/PPMC since 2023", contraception: "OCP resupply" },
  { state: "TAS", status: "Expanding", badge: "🔄", badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", acute: "Ear, reflux, shingles, eczema, rhinitis, wound care", chronic: "Developing", hospital: "State-wide PPMC since 2020", contraception: "OCP resupply" },
  { state: "NT", status: "Aug 2025", badge: "✅", badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", acute: "All QLD acute + chronic conditions", chronic: "Included (Aug 2025)", hospital: "No implementation (workforce shortage)", contraception: "Hormonal contraception initiation + resupply" },
  { state: "ACT", status: "Hospital-focused", badge: "🏥", badgeColor: "bg-slate-500/20 text-slate-400 border-slate-500/30", acute: "Limited community pharmacy", chronic: "N/A", hospital: "Inpatient/discharge PPMC at Canberra Health (2024)", contraception: "OCP resupply" },
];

/* ── Condition cards data ── */
const conditions = [
  { icon: HeartPulse, name: "Urinary Tract Infections (UTIs)" },
  { icon: Baby, name: "Hormonal Contraception" },
  { icon: ShieldCheck, name: "Skin Conditions", sub: "eczema, psoriasis, acne, shingles, impetigo" },
  { icon: Ear, name: "Ear Infections" },
  { icon: Wind, name: "Allergic & Non-allergic Rhinitis" },
  { icon: Flame, name: "Reflux & GORD" },
  { icon: Bandage, name: "Acute Wound Care" },
  { icon: ThermometerSun, name: "Nausea & Vomiting" },
  { icon: Bone, name: "Musculoskeletal Pain" },
  { icon: Activity, name: "Asthma & COPD", sub: "selected states" },
  { icon: TrendingUp, name: "Cardiovascular Risk", sub: "hypertension, dyslipidaemia, type 2 diabetes — selected states" },
  { icon: Syringe, name: "Travel Health & Vaccinations" },
  { icon: CigaretteOff, name: "Smoking Cessation" },
  { icon: Scale, name: "Weight Management" },
];

const faqItems = [
  { q: "Do I need a GP referral to see a prescribing pharmacist?", a: "No. Under Full Scope of Practice, an Endorsed Pharmacist Prescriber can independently assess, diagnose, and prescribe for conditions within their documented scope — no GP referral is required. However, your pharmacist will always communicate with your GP to ensure coordinated care." },
  { q: "Is this the same as the current UTI/OCP service?", a: "No. Current services like UTI treatment and oral contraceptive pill resupply operate under Structured Prescribing Arrangements with limited conditions. Full Scope of Practice is autonomous prescribing — covering a much broader range of acute and chronic conditions, with the pharmacist independently managing the full clinical episode." },
  { q: "Are these services covered by Medicare or PBS?", a: "PBS access for pharmacist-prescribed medicines is a key advocacy goal but has not yet been confirmed nationally. Some pilot programs have government-funded service fees. Costs vary by pharmacy — ask your local ChemistCare pharmacy about fees and available subsidies." },
  { q: "Which states currently offer Full Scope of Practice?", a: "Queensland and the Northern Territory have the broadest scope currently. Victoria, NSW, WA, SA, and Tasmania are expanding, with most states aligning to Queensland's pilot model from 2026. The ACT is currently focused on hospital-based prescribing. See the table above for full details." },
  { q: "How do I know if my pharmacist is an Endorsed Prescriber?", a: "Endorsed Pharmacist Prescribers hold a specific endorsement on their AHPRA registration after completing an APC-accredited prescriber course. You can verify your pharmacist's credentials on the AHPRA register, or look for the Endorsed Pharmacist Prescriber credential displayed at participating ChemistCare pharmacies." },
];

/* ── Page ── */
export default function FullScopeOfPractice() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Full Scope of Practice", href: "/full-scope-of-practice" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif", scrollBehavior: "smooth" }}>

      {/* ─── NAVBAR ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <Link to="/"><img src={logoFullImg} alt="ChemistCare PrescriberOS" className="h-10 w-auto" /></Link>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) =>
              l.href.startsWith("/") && !l.href.startsWith("/#") ? (
                <Link key={l.label} to={l.href} className="text-white text-sm font-semibold transition-colors border-b-2 border-[#2dd4bf] pb-0.5">{l.label}</Link>
              ) : l.href.startsWith("/#") ? (
                <Link key={l.label} to={l.href} className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">{l.label}</Link>
              ) : (
                <a key={l.label} href={l.href} className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors">{l.label}</a>
              )
            )}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-[#94a3b8] hover:text-white text-sm font-medium transition-colors px-4 py-2">Log in</button>
            <button onClick={() => navigate("/dashboard")} className="bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] font-semibold text-sm px-5 py-2.5 rounded-lg transition-all">
              Start Prescribing Now
            </button>
          </div>
          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0f172a] border-t border-white/5 px-6 py-4 flex flex-col gap-3">
              {navLinks.map((l) => (
                <Link key={l.label} to={l.href.startsWith("/#") ? l.href : l.href} className="text-[#94a3b8] text-sm py-2" onClick={() => setMenuOpen(false)}>{l.label}</Link>
              ))}
              <button onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}
                className="bg-[#2dd4bf] text-[#0f172a] font-semibold text-sm px-5 py-3 rounded-lg w-full mt-2">Start Prescribing Now</button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-[72px]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #2dd4bf 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2dd4bf]/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#1D6FA4]/[0.06] rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-36 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 text-[#2dd4bf] text-sm font-medium px-4 py-2 mb-8">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2dd4bf] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#2dd4bf]" /></span>
            Pharmacist Prescribing · Australia-Wide
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-white mb-6 max-w-5xl mx-auto"
            style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
            Full Scope of Practice — <span className="text-[#2dd4bf]">The Future of Pharmacy Is Here</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl md:text-2xl text-[#94a3b8] max-w-3xl mx-auto mb-10 leading-relaxed">
            Endorsed Pharmacist Prescribers can now independently prescribe medicines for a wide range of conditions — no GP referral required.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}>
            <button onClick={() => navigate("/dashboard")}
              className="bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 inline-flex items-center gap-2">
              ChemistCare PrescriberOS <ArrowRight size={20} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── SECTION 1: What Is Full Scope of Practice? ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Understanding Full Scope</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              What Is Full Scope of Practice?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Stethoscope, title: "Autonomous Prescribing", body: "An Endorsed Pharmacist Prescriber can prescribe Schedule 2, 3, 4 and 8 medicines independently, within their documented scope of practice — without needing a doctor's referral." },
              { icon: GraduationCap, title: "Nationally Endorsed", body: "Pharmacists must complete an APC-accredited prescriber course approved by the Pharmacy Board of Australia before practising at full scope." },
              { icon: Handshake, title: "Part of Your Healthcare Team", body: "Full scope pharmacists work collaboratively with GPs, specialists and other health professionals to deliver seamless, patient-centred care." },
            ].map((card, i) => (
              <motion.div key={card.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:-translate-y-1 hover:border-[#2dd4bf]/30 transition-all duration-300">
                <div className="bg-[#2dd4bf]/10 rounded-xl p-3 inline-flex mb-6">
                  <card.icon size={28} className="text-[#2dd4bf]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>{card.title}</h3>
                <p className="text-[#94a3b8] leading-relaxed">{card.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 2: What Can They Prescribe For? ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Conditions Treated</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              What Can a Full Scope Pharmacist Prescribe For?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {conditions.map((c, i) => (
              <motion.div key={c.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                className="flex items-start gap-4 bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:border-[#2dd4bf]/20 transition-colors">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-[#2dd4bf]/10 flex items-center justify-center">
                  <c.icon size={20} className="text-[#2dd4bf]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{c.name}</p>
                  {c.sub && <p className="text-[#64748b] text-xs mt-0.5">{c.sub}</p>}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-[#64748b] text-sm mt-8">Services vary by state. See the table below for what's available in your state.</p>
        </div>
      </Section>

      {/* ─── SECTION 3: State Table ─── */}
      <Section id="state-table" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">By State</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Available Services by State
            </h2>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {[
              { badge: "✅", label: "Fully Operational", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
              { badge: "🔄", label: "Expanding", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
              { badge: "🔜", label: "Launching Soon", cls: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
              { badge: "🏥", label: "Hospital-only", cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
            ].map((l) => (
              <span key={l.label} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${l.cls}`}>
                {l.badge} {l.label}
              </span>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-auto rounded-2xl border border-white/10 bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-semibold">State</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-semibold">Status</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-semibold">Acute Conditions</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-semibold">Chronic Disease</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-semibold">Hospital Prescribing</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-semibold">Contraception</th>
                </tr>
              </thead>
              <tbody>
                {stateData.map((s) => (
                  <tr key={s.state} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-white font-bold text-base">{s.state}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${s.badgeColor}`}>
                        {s.badge} {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#94a3b8] max-w-[220px]">{s.acute}</td>
                    <td className="px-5 py-4 text-[#94a3b8] max-w-[180px]">{s.chronic}</td>
                    <td className="px-5 py-4 text-[#94a3b8] max-w-[200px]">{s.hospital}</td>
                    <td className="px-5 py-4 text-[#94a3b8] max-w-[200px]">{s.contraception}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-4">
            {stateData.map((s) => (
              <div key={s.state} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-lg">{s.state}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${s.badgeColor}`}>
                    {s.badge} {s.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-[#64748b] font-medium">Acute:</span> <span className="text-[#94a3b8]">{s.acute}</span></div>
                  <div><span className="text-[#64748b] font-medium">Chronic:</span> <span className="text-[#94a3b8]">{s.chronic}</span></div>
                  <div><span className="text-[#64748b] font-medium">Hospital:</span> <span className="text-[#94a3b8]">{s.hospital}</span></div>
                  <div><span className="text-[#64748b] font-medium">Contraception:</span> <span className="text-[#94a3b8]">{s.contraception}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECTION 4: Why Choose a Prescribing Pharmacist? ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">The Evidence</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Why Choose a Prescribing Pharmacist?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              { value: 97, suffix: "%", label: "Patient satisfaction in Australian prescribing pilots" },
              { prefix: "$", value: 5.1, suffix: "B", label: "Annual estimated benefit to the Australian healthcare system" },
              { value: 96, suffix: "%", label: "of Australians live within 2.5km of a pharmacy" },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="text-center bg-white/[0.03] border border-white/10 rounded-2xl p-10">
                <p className="text-5xl md:text-6xl font-bold text-[#2dd4bf] tabular-nums mb-3" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
                  {stat.prefix || ""}{stat.value}{stat.suffix}
                </p>
                <p className="text-[#94a3b8] text-base leading-snug">{stat.label}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-[#94a3b8] text-lg leading-relaxed max-w-3xl mx-auto">
            Pharmacists are Australia's most accessible healthcare professionals. With Full Scope of Practice, they can now offer more — from diagnosing and treating common conditions to managing chronic disease — all in one convenient, trusted location.
          </p>
        </div>
      </Section>

      {/* ─── SECTION 5: Powered by PrescriberOS ─── */}
      <Section className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Technology</p>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-6" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
                Powered by ChemistCare <span className="text-[#2dd4bf]">PrescriberOS</span>
              </h2>
              <p className="text-lg text-[#94a3b8] leading-relaxed mb-8">
                Participating ChemistCare pharmacies use PrescriberOS — Australia's purpose-built prescribing workflow platform for endorsed pharmacist prescribers.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Stethoscope, text: "Clinical decision support" },
                  { icon: ClipboardList, text: "Integrated patient records" },
                  { icon: FileCheck, text: "Prescription generation and documentation" },
                  { icon: Monitor, text: "State-by-state compliance tools" },
                  { icon: MessageSquare, text: "Secure referral and GP communication" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-[#2dd4bf]/10 flex items-center justify-center">
                      <item.icon size={20} className="text-[#2dd4bf]" />
                    </div>
                    <p className="text-white text-base font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link to="/"
                  className="bg-white/[0.06] hover:bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2 transition-all">
                  Learn About PrescriberOS <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl border border-white/10 p-10 md:p-14">
                <p className="text-sm font-semibold text-[#2dd4bf] mb-6 tracking-wide uppercase">PrescriberOS Features</p>
                <div className="space-y-4">
                  {[
                    { label: "Protocol-Driven Workflows", color: "#2dd4bf" },
                    { label: "Real-Time Safety Checks", color: "#1FA971" },
                    { label: "Auto SOAP Notes & GP Letters", color: "#3B82F6" },
                    { label: "Integrated Billing & Claims", color: "#F6D860" },
                    { label: "Audit-Ready Documentation", color: "#E879F9" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-6 py-4">
                      <CheckCircle2 size={18} style={{ color: m.color }} />
                      <span className="text-[#94a3b8] text-sm font-medium">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── SECTION 6: FAQ ─── */}
      <Section id="faq" className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2dd4bf] text-sm font-semibold tracking-wider uppercase mb-4">Common Questions</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
              Frequently Asked Questions
            </h2>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl px-8">
            {faqItems.map((f) => <FAQItem key={f.q} {...f} />)}
          </div>
        </div>
      </Section>

      {/* ─── FOOTER CTA BANNER ─── */}
      <section className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] border-y border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6" style={{ fontFamily: "'Recoleta', 'Manrope', serif" }}>
            Ready to experience the future of pharmacy care?
          </h2>
          <button onClick={() => navigate("/dashboard")}
            className="bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0f172a] px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 inline-flex items-center gap-2">
            Book a Consultation <ArrowRight size={20} />
          </button>
        </div>
      </section>

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
                <Link to="/#features" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">Features</Link>
                <Link to="/#how-it-works" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">How It Works</Link>
                <Link to="/full-scope-of-practice" className="block text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">Full Scope of Practice</Link>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Contact</h4>
              <a href="mailto:hugh@burkeroadpharmacy.com.au" className="text-[#94a3b8] text-sm hover:text-[#2dd4bf] transition-colors">
                hugh@burkeroadpharmacy.com.au
              </a>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap justify-between items-center gap-4 text-[#475569] text-xs">
            <span>© 2026 ChemistCare PrescriberOS. All rights reserved.</span>
            <div className="flex flex-wrap gap-4">
              <span>Designed to support AHPRA & TGA compliance</span>
              <span>Privacy Act aligned</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
