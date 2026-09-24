// src/pages/HomePage.jsx — VisionRaksha Landing Page
import { useEffect, useRef } from "react";
import {
  Eye, Brain, UserCheck, Smartphone, Shield, Heart,
  ClipboardList, Camera, Search as SearchIcon,
  Layers, FileText, ArrowRight, Star, Globe, Link2, Mail,
  Activity, Sparkles, Calendar, ChevronRight
} from "lucide-react";

/* ── Scroll Animation Hook ── */
function useScrollReveal() {
  const ref = useRef();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    const elements = ref.current?.querySelectorAll(".animate-on-scroll");
    elements?.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function HomePage() {
  const pageRef = useScrollReveal();

  return (
    <div ref={pageRef}>
      <HeroSection />
      <WhyVisionRaksha />
      <WorkflowSection />
      <KeyFeaturesSection />
      <AboutSection />
      <FooterSection />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   1. HERO SECTION
   ══════════════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F7FAFB] to-[#E8F7F6] pt-12 pb-20 lg:pt-16 lg:pb-28">
      {/* Subtle background circles */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-[#22AEB0]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#38C4C4]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="row g-4 g-lg-5 align-items-center">

          {/* Left Content */}
          <div className="col-12 col-lg-6 space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 border border-[#E1E9EC] shadow-soft">
              <span className="w-2 h-2 bg-[#22AEB0] rounded-full animate-pulse-soft"></span>
              <span className="text-xs font-semibold text-[#657685]">
                AI-Powered <span className="text-[#94A1AB] mx-1">|</span> Explainable <span className="text-[#94A1AB] mx-1">|</span> Accessible
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1F2F42] leading-[1.1]">
              Vision<span className="text-[#22AEB0]">Raksha</span>
            </h1>

            <p className="text-lg sm:text-xl font-medium text-[#26394D]">
              Explainable AI for Diabetic Retinopathy Screening in Rural India
            </p>

            <p className="text-base text-[#657685] leading-relaxed max-w-xl">
              VisionRaksha helps detect and grade Diabetic Retinopathy early using AI, while Explainable AI shows doctors why the prediction was made. The platform supports reliable screening, specialist validation, and follow-up care.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-4 pt-2">
              <a href="#features" className="btn-primary gap-2 text-sm">
                Get Started <ArrowRight size={16} />
              </a>
              <a href="#about" className="btn-outline gap-2 text-sm">
                Learn More
              </a>
            </div>
          </div>

          {/* Right: AI Dashboard Mockup */}
          <div className="col-12 col-lg-6 relative animate-float">
            <div className="bg-white rounded-3xl shadow-card-hover border border-[#E1E9EC] p-6 space-y-4">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <span className="text-[10px] font-semibold text-[#94A1AB] bg-[#F7FAFB] px-3 py-1 rounded-full">VisionRaksha AI Dashboard</span>
              </div>

              {/* Mock Images */}
              <div className="row g-3">
                <div className="col-6">
                  <div className="rounded-xl overflow-hidden bg-[#0A1628] aspect-square flex items-center justify-center relative">
                    <img src="/fundus.jpg" alt="Retinal Fundus" className="img-fluid w-full h-full object-cover" />
                    <p className="absolute bottom-2 text-[9px] bg-black/50 px-2 py-0.5 rounded-full text-white font-medium">Retinal Fundus</p>
                  </div>
                </div>
                <div className="col-6">
                  <div className="rounded-xl overflow-hidden bg-[#0A1628] aspect-square flex items-center justify-center relative">
                    <img src="/heatmap.jpg" alt="Grad-CAM Heatmap" className="img-fluid w-full h-full object-cover" />
                    <p className="absolute bottom-2 text-[9px] bg-black/50 px-2 py-0.5 rounded-full text-white font-medium">Grad-CAM Heatmap</p>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#657685]">DR Grade</p>
                    <p className="text-lg font-bold text-rose-600">Level 3 <span className="text-sm font-medium text-[#657685]">(Severe)</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#657685]">Confidence</p>
                    <p className="text-2xl font-bold text-[#22AEB0]">92%</p>
                  </div>
                </div>

                <div className="bg-[#F7FAFB] rounded-xl p-3 border border-[#E1E9EC]">
                  <p className="text-[10px] font-semibold text-[#94A1AB] uppercase tracking-wider mb-2">Key Regions Influencing Prediction</p>
                  <div className="flex flex-wrap gap-2">
                    {["Microaneurysms", "Hemorrhages", "Exudates"].map(tag => (
                      <span key={tag} className="text-xs font-medium bg-[#E8F7F6] text-[#22AEB0] px-3 py-1 rounded-full border border-[#22AEB0]/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating label */}
              <div className="absolute -bottom-4 -right-4 bg-[#22AEB0] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-btn">
                Explainable AI (Grad-CAM)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   2. WHY VISIONRAKSHA
   ══════════════════════════════════════════════════════════════ */
function WhyVisionRaksha() {
  const features = [
    { icon: Eye,       title: "Early Detection",      desc: "Identify Diabetic Retinopathy before vision loss." },
    { icon: Brain,     title: "Explainable AI",        desc: "See why the AI made its prediction using Grad-CAM." },
    { icon: UserCheck, title: "Doctor-in-the-Loop",    desc: "Doctors can validate, confirm, or override AI results." },
    { icon: Smartphone,title: "Rural Friendly",        desc: "Works with portable retinal cameras and supports field screening." },
    { icon: Shield,    title: "Secure & Compliant",    desc: "Secure patient data and responsible AI workflow." },
    { icon: Heart,     title: "Better Access",         desc: "Connect rural communities with specialist eye care." },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Why VisionRaksha?</h2>
          <p className="section-subtitle">Advanced AI. Clear Explanations. Real Impact.</p>
        </div>

        <div className="row g-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="col-12 col-sm-6 col-lg-4">
              <div className="card-themed text-center animate-on-scroll h-100" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="icon-circle mx-auto">
                  <Icon size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-[#1F2F42] mb-2">{title}</h3>
                <p className="text-sm text-[#657685] leading-relaxed mb-0">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   3. END-TO-END SCREENING WORKFLOW
   ══════════════════════════════════════════════════════════════ */
function WorkflowSection() {
  const steps = [
    { icon: ClipboardList, label: "Register",      desc: "Patient Intake & Registration" },
    { icon: Camera,        label: "Capture",       desc: "Portable Retinal Image Capture" },
    { icon: SearchIcon,    label: "Quality Check", desc: "Focus, illumination & field-of-view" },
    { icon: Sparkles,      label: "Enhance",       desc: "Image restoration when required" },
    { icon: Activity,      label: "Analyze",       desc: "Retinal segmentation & DR classification" },
    { icon: Eye,           label: "Explain",       desc: "Grad-CAM & lesion-level evidence" },
    { icon: UserCheck,     label: "Validate",      desc: "Doctor-in-the-loop review" },
    { icon: FileText,      label: "Report",        desc: "PDF report & referral recommendation" },
    { icon: Calendar,      label: "Follow-Up",     desc: "Records & patient reminders" },
  ];

  return (
    <section id="workflow" className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">End-to-End Screening Workflow</h2>
          <p className="section-subtitle">From image capture to follow-up, VisionRaksha covers every step.</p>
        </div>

        {/* Horizontal scrollable on mobile */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex items-start gap-4 min-w-max">
            {steps.map(({ icon: Icon, label, desc }, i) => (
              <div key={label} className="flex items-start">
                <div className="workflow-step animate-on-scroll" style={{ transitionDelay: `${i * 60}ms` }}>
                  <div className="workflow-icon">
                    <Icon size={22} strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-bold text-[#1F2F42] mb-1">{label}</p>
                  <p className="text-[11px] text-[#657685] leading-snug px-1">{desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex items-center mt-8 mx-1">
                    <div className="w-8 h-[2px] bg-[#22AEB0]/30"></div>
                    <ChevronRight size={14} className="text-[#22AEB0] -ml-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   4. KEY FEATURES
   ══════════════════════════════════════════════════════════════ */
function KeyFeaturesSection() {
  const features = [
    { icon: SearchIcon,    title: "Image Quality Check",       desc: "Focus, contrast and field-of-view analysis." },
    { icon: Layers,        title: "U-Net Segmentation",        desc: "Optic disc, vessels and lesion detection." },
    { icon: Activity,      title: "EfficientNet Classification",desc: "DR Grade 0 to Grade 4 with confidence score." },
    { icon: Eye,           title: "Grad-CAM Explainability",   desc: "Visual heatmaps and lesion evidence." },
    { icon: FileText,      title: "Automated Reports",         desc: "Generate PDF reports and patient follow-up reminders." },
    { icon: UserCheck,     title: "Tele-Ophthalmology",        desc: "Specialist review, referral priority and hospital escalation." },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Key Features</h2>
          <p className="section-subtitle">Complete screening solution with AI, explainability and specialist support.</p>
        </div>

        <div className="row g-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="col-12 col-sm-6 col-lg-4">
              <div className="card-themed animate-on-scroll h-100" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="icon-circle">
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-[#1F2F42] mb-2">{title}</h3>
                <p className="text-sm text-[#657685] leading-relaxed mb-0">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   5. ABOUT SECTION
   ══════════════════════════════════════════════════════════════ */
function AboutSection() {
  return (
    <section id="about" className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">About VisionRaksha</h2>
        </div>

        <div className="row g-4 max-w-4xl mx-auto mb-12">
          {/* Mission */}
          <div className="col-12 col-md-6">
            <div className="card-static p-4 p-lg-5 animate-on-scroll h-100">
              <div className="icon-circle">
                <Star size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-[#1F2F42] mb-3">Our Mission</h3>
              <p className="text-sm text-[#657685] leading-relaxed mb-0">
                To make early Diabetic Retinopathy screening accessible through Explainable AI and doctor-supported healthcare technology.
              </p>
            </div>
          </div>

          {/* Vision */}
          <div className="col-12 col-md-6">
            <div className="card-static p-4 p-lg-5 animate-on-scroll h-100" style={{ transitionDelay: "100ms" }}>
              <div className="icon-circle">
                <Eye size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-[#1F2F42] mb-3">Our Vision</h3>
              <p className="text-sm text-[#657685] leading-relaxed mb-0">
                Prevent avoidable vision loss by bringing intelligent retinal screening closer to every community.
              </p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="row g-4 max-w-3xl mx-auto">
          {[
            { icon: Heart, title: "Accessibility", desc: "Screening for every community" },
            { icon: Eye,   title: "Explainability", desc: "Transparent AI decisions" },
            { icon: Shield, title: "Trust", desc: "Doctor-validated results" },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="col-12 col-sm-4">
              <div className="text-center animate-on-scroll h-100" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="w-16 h-16 rounded-2xl bg-[#E8F7F6] border border-[#22AEB0]/15 flex items-center justify-center mx-auto mb-4">
                  <Icon size={24} className="text-[#22AEB0]" strokeWidth={1.5} />
                </div>
                <h4 className="text-base font-bold text-[#1F2F42] mb-1">{title}</h4>
                <p className="text-sm text-[#657685] mb-0">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   6. FOOTER
   ══════════════════════════════════════════════════════════════ */
function FooterSection() {
  return (
    <footer className="bg-[#1F2F42] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="row g-4 g-lg-5 mb-12">

          {/* Brand */}
          <div className="col-12 col-sm-6 col-lg-3 space-y-4">
            <div className="flex items-center gap-2">
              <Eye size={24} className="text-[#22AEB0]" />
              <span className="text-xl font-bold">Vision<span className="text-[#22AEB0]">Raksha</span></span>
            </div>
            <p className="text-xs font-semibold text-[#76D6D2] uppercase tracking-wider">AI for Healthier Tomorrows</p>
            <p className="text-sm text-[#94A1AB] leading-relaxed">
              Explainable AI-powered retinal screening for accessible and reliable Diabetic Retinopathy detection.
            </p>
            <div className="flex gap-3 pt-2">
              {[
                { icon: Link2, label: "LinkedIn" },
                { icon: Globe, label: "GitHub" },
                { icon: Mail, label: "Contact" },
              ].map(({ icon: Icon, label }) => (
                <a key={label} href="#" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#94A1AB] hover:text-[#22AEB0] hover:border-[#22AEB0]/30 transition" aria-label={label}>
                  <Icon size={16} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="col-12 col-sm-6 col-lg-3">
            <p className="text-xs font-bold text-[#76D6D2] uppercase tracking-wider mb-4">Platform</p>
            <ul className="space-y-2.5 list-unstyled">
              {["Home", "Features", "How It Works", "Dashboard", "Reports"].map(link => (
                <li key={link}>
                  <a href="#" className="text-sm text-[#94A1AB] hover:text-white transition">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="col-12 col-sm-6 col-lg-3">
            <p className="text-xs font-bold text-[#76D6D2] uppercase tracking-wider mb-4">Resources</p>
            <ul className="space-y-2.5 list-unstyled">
              {["Documentation", "Research", "Datasets", "Support", "FAQ"].map(link => (
                <li key={link}>
                  <a href="#" className="text-sm text-[#94A1AB] hover:text-white transition">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="col-12 col-sm-6 col-lg-3">
            <p className="text-xs font-bold text-[#76D6D2] uppercase tracking-wider mb-4">Company</p>
            <ul className="space-y-2.5 list-unstyled">
              {["About Us", "Contact", "Privacy Policy", "Terms of Service"].map(link => (
                <li key={link}>
                  <a href="#" className="text-sm text-[#94A1AB] hover:text-white transition">{link}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 text-center">
          <p className="text-xs text-[#94A1AB]">© 2026 VisionRaksha. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
