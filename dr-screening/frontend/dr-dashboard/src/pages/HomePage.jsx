// src/pages/HomePage.jsx — VisionRaksha Complete Landing Page
// Premium healthcare AI landing with 15+ sections
import { useEffect, useRef } from "react";
import {
  Eye, Brain, UserCheck, Smartphone, Shield, Heart,
  ClipboardList, Camera, CheckCircle, Sparkles, Search as SearchIcon,
  Layers, FileText, BookOpen, Database, HelpCircle, Mail,
  ArrowRight, Download, Calendar, AlertTriangle,
  Stethoscope, Activity, Globe, Users, TrendingUp,
  Wifi, WifiOff, RefreshCw, ChevronRight,
  MapPin, Star, Link2
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
      <GradCAMSection />
      <RuralImpactSection />
      <DashboardPreview />
      <KeyFeaturesSection />
      <DoctorDashboardSection />
      <FieldWorkerSection />
      <ImageQualitySection />
      <DoctorInTheLoopSection />
      <ReportsSection />
      <ResourcesSection />
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
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left Content */}
          <div className="space-y-6">
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
          <div className="relative animate-float">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl overflow-hidden bg-[#0A1628] aspect-square flex items-center justify-center relative">
                  <img src="/fundus.jpg" alt="Retinal Fundus" className="w-full h-full object-cover" />
                  <p className="absolute bottom-2 text-[9px] bg-black/50 px-2 py-0.5 rounded-full text-white font-medium">Retinal Fundus</p>
                </div>
                <div className="rounded-xl overflow-hidden bg-[#0A1628] aspect-square flex items-center justify-center relative">
                  <img src="/heatmap.jpg" alt="Grad-CAM Heatmap" className="w-full h-full object-cover" />
                  <p className="absolute bottom-2 text-[9px] bg-black/50 px-2 py-0.5 rounded-full text-white font-medium">Grad-CAM Heatmap</p>
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="card-themed text-center animate-on-scroll" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="icon-circle mx-auto">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-[#1F2F42] mb-2">{title}</h3>
              <p className="text-sm text-[#657685] leading-relaxed">{desc}</p>
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
   4. GRAD-CAM / EXPLAINABLE AI
   ══════════════════════════════════════════════════════════════ */
function GradCAMSection() {
  return (
    <section className="py-20 bg-[#E8F7F6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Image Comparison */}
          <div className="animate-on-scroll">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl overflow-hidden shadow-card bg-[#0a0a0a]">
                <div className="aspect-square relative">
                  <img src="/fundus.jpg" alt="Original Fundus" className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs font-semibold bg-black/70 text-white px-3 py-1 rounded-full">Original Fundus</span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-card bg-[#0a0a0a]">
                <div className="aspect-square relative">
                  <img src="/heatmap.jpg" alt="Grad-CAM Heatmap" className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs font-semibold bg-black/70 text-white px-3 py-1 rounded-full">Grad-CAM Heatmap</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="animate-on-scroll space-y-5">
            <h2 className="section-title text-left">See the Difference with Explainable AI</h2>
            <p className="text-base text-[#657685] leading-relaxed">
              VisionRaksha does not only predict the disease grade. It helps doctors understand <strong className="text-[#263746]">why</strong> the AI made the prediction by highlighting retinal regions influencing the result.
            </p>

            <div className="space-y-3">
              {[
                "Visual explanation using Grad-CAM",
                "Lesion-level evidence",
                "Confidence score",
                "Doctor validation"
              ].map(point => (
                <div key={point} className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#22AEB0] flex-shrink-0" />
                  <span className="text-sm font-medium text-[#263746]">{point}</span>
                </div>
              ))}
            </div>

            <button className="btn-primary gap-2 text-sm mt-4">
              View Example <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   5. RURAL INDIA IMPACT
   ══════════════════════════════════════════════════════════════ */
function RuralImpactSection() {
  const stats = [
    { value: "500K+",  label: "People Screened",      icon: Users },
    { value: "95%",    label: "AI Accuracy Target",   icon: TrendingUp },
    { value: "2.5K+",  label: "Rural Health Centres",  icon: MapPin },
    { value: "12+",    label: "States Covered",        icon: Globe },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Image Card */}
          <div className="animate-on-scroll relative rounded-3xl overflow-hidden bg-cover bg-center min-h-[320px] flex items-end p-8" style={{ backgroundImage: 'url(/bg_login.jpg)' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#1F2F42] via-[#1F2F42]/60 to-transparent z-10"></div>
            <div className="relative z-20 space-y-3">
              <p className="text-xs font-semibold text-[#76D6D2] uppercase tracking-wider">Healthcare for All</p>
              <h3 className="text-2xl font-bold text-white">Designed for Rural India</h3>
              <p className="text-sm text-[#76D6D2]">Portable. Accessible. Explainable.</p>
              <button className="btn-outline border-white/30 text-white hover:bg-white/10 text-sm gap-2 mt-2">
                Learn More <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Stats Card */}
          <div className="animate-on-scroll space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#22AEB0] uppercase tracking-wider mb-2">Impact & Reach</p>
              <h3 className="text-2xl font-bold text-[#1F2F42]">Your Health, Our Priority</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {stats.map(({ value, label, icon: Icon }) => (
                <div key={label} className="card-static p-5 text-center">
                  <Icon size={20} className="text-[#22AEB0] mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-2xl font-bold text-[#1F2F42] stat-value">{value}</p>
                  <p className="text-xs text-[#657685] font-medium mt-1">{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#E8F7F6] rounded-2xl p-5 border border-[#22AEB0]/15 text-center">
              <p className="text-lg font-bold text-[#1F2F42]">Prevent Blindness.</p>
              <p className="text-sm text-[#22AEB0] font-semibold">Enable Brighter Futures.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   6. REAL-TIME AI DASHBOARD PREVIEW
   ══════════════════════════════════════════════════════════════ */
function DashboardPreview() {
  return (
    <section className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Real-Time AI Dashboard</h2>
          <p className="section-subtitle">Comprehensive analysis results at your fingertips.</p>
        </div>

        <div className="animate-on-scroll">
          <div className="bg-white rounded-3xl shadow-card border border-[#E1E9EC] overflow-hidden max-w-4xl mx-auto">
            {/* Tab bar */}
            <div className="flex border-b border-[#E1E9EC] bg-[#F7FAFB]">
              {["Original Image", "Grad-CAM", "Segmentation", "Findings"].map((tab, i) => (
                <button
                  key={tab}
                  className={`flex-1 py-3.5 text-xs font-semibold transition-all ${
                    i === 1
                      ? "text-[#22AEB0] border-b-2 border-[#22AEB0] bg-white"
                      : "text-[#94A1AB] hover:text-[#657685]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Mock analysis image */}
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden bg-[#0a0a0a] aspect-square relative">
                    <img src="/ai_dashboard.jpg" alt="AI Dashboard" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-[#94A1AB] text-center font-medium">Grad-CAM Heatmap Overlay</p>
                </div>

                {/* Results panel */}
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-[#94A1AB] uppercase tracking-wider mb-1">DR Grade</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#1F2F42]">Level 2</span>
                      <span className="text-sm text-orange-600 font-semibold bg-orange-50 px-2.5 py-0.5 rounded-lg">(Moderate)</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#94A1AB] uppercase tracking-wider mb-1">Confidence</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-[#E8F7F6] rounded-full overflow-hidden">
                        <div className="h-full bg-[#22AEB0] rounded-full" style={{ width: "87%" }}></div>
                      </div>
                      <span className="text-xl font-bold text-[#22AEB0]">87%</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#94A1AB] uppercase tracking-wider mb-3">Key Findings</p>
                    <div className="space-y-2">
                      {[
                        { name: "Microaneurysms", severity: "Moderate" },
                        { name: "Hemorrhages", severity: "Present" },
                        { name: "Exudates", severity: "Few" },
                      ].map(({ name, severity }) => (
                        <div key={name} className="flex items-center justify-between bg-[#F7FAFB] rounded-xl px-4 py-2.5 border border-[#E1E9EC]">
                          <span className="text-sm font-medium text-[#263746]">{name}</span>
                          <span className="text-xs font-semibold text-[#22AEB0] bg-[#E8F7F6] px-2.5 py-0.5 rounded-full">{severity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   7. KEY FEATURES
   ══════════════════════════════════════════════════════════════ */
function KeyFeaturesSection() {
  const features = [
    { icon: SearchIcon,    title: "Image Quality Check",       desc: "Focus, contrast and field-of-view analysis." },
    { icon: Layers,        title: "U-Net Segmentation",        desc: "Optic disc, vessels and lesion detection." },
    { icon: Activity,      title: "EfficientNet Classification",desc: "DR Grade 0 to Grade 4 with confidence score." },
    { icon: Eye,           title: "Grad-CAM Explainability",   desc: "Visual heatmaps and lesion evidence." },
    { icon: FileText,      title: "Automated Reports",         desc: "Generate PDF reports and patient follow-up reminders." },
    { icon: Stethoscope,   title: "Tele-Ophthalmology",        desc: "Specialist review, referral priority and hospital escalation." },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Key Features</h2>
          <p className="section-subtitle">Complete screening solution with AI, explainability and specialist support.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="card-themed animate-on-scroll" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="icon-circle">
                <Icon size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#1F2F42] mb-2">{title}</h3>
              <p className="text-sm text-[#657685] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   8. DOCTOR DASHBOARD PREVIEW
   ══════════════════════════════════════════════════════════════ */
function DoctorDashboardSection() {
  return (
    <section className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Doctor Dashboard</h2>
          <p className="section-subtitle">Review AI predictions, validate results, and manage referrals.</p>
        </div>

        <div className="animate-on-scroll">
          <div className="bg-white rounded-3xl shadow-card border border-[#E1E9EC] overflow-hidden max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-5">
              {/* Patient List */}
              <div className="lg:col-span-2 border-r border-[#E1E9EC]">
                <div className="p-4 border-b border-[#E1E9EC] bg-[#F7FAFB]">
                  <p className="text-xs font-bold text-[#1F2F42] uppercase tracking-wider">Patient Queue</p>
                </div>
                {[
                  { name: "Ramesh Verma",   grade: 3, age: 58, status: "Urgent" },
                  { name: "Sunita Devi",    grade: 1, age: 45, status: "Routine" },
                  { name: "Amit Patel",     grade: 2, age: 52, status: "Review" },
                ].map((p, i) => (
                  <div key={p.name} className={`px-4 py-3.5 border-b border-[#E1E9EC]/50 flex items-center justify-between hover:bg-[#F7FAFB] transition cursor-pointer ${i === 0 ? "bg-[#E8F7F6]" : ""}`}>
                    <div>
                      <p className="text-sm font-semibold text-[#263746]">{p.name}</p>
                      <p className="text-[11px] text-[#94A1AB]">Age {p.age} · Grade {p.grade}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      p.status === "Urgent" ? "bg-rose-50 text-rose-600" :
                      p.status === "Review" ? "bg-amber-50 text-amber-600" :
                      "bg-emerald-50 text-emerald-600"
                    }`}>{p.status}</span>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="lg:col-span-3 p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#1F2F42]">Ramesh Verma</h3>
                    <p className="text-xs text-[#657685]">58y Male · ABHA: 91-4521-8902 · Grade 3 — Severe</p>
                  </div>
                  <span className="text-lg font-bold text-[#22AEB0]">89%</span>
                </div>

                {/* Decision buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button className="py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer">
                    ✓ Confirm AI
                  </button>
                  <button className="py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-semibold hover:bg-amber-100 transition cursor-pointer">
                    ↻ Request Recheck
                  </button>
                  <button className="py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold hover:bg-rose-100 transition cursor-pointer">
                    ✗ Override
                  </button>
                </div>

                {/* Referral Priority */}
                <div>
                  <p className="text-xs font-semibold text-[#94A1AB] uppercase tracking-wider mb-2">Referral Priority</p>
                  <div className="flex gap-3">
                    {["Low", "Medium", "High"].map((level, i) => (
                      <span key={level} className={`flex-1 text-center py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        i === 2 ? "bg-rose-600 text-white border-rose-600" : "bg-white text-[#657685] border-[#E1E9EC] hover:border-[#22AEB0]"
                      }`}>{level}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   9. FIELD WORKER SECTION
   ══════════════════════════════════════════════════════════════ */
function FieldWorkerSection() {
  const features = [
    { icon: ClipboardList, text: "Simple patient registration" },
    { icon: Camera,        text: "Portable image capture" },
    { icon: CheckCircle,   text: "Real-time image quality feedback" },
    { icon: RefreshCw,     text: "Recapture guidance" },
    { icon: WifiOff,       text: "Offline / low connectivity support" },
    { icon: Wifi,          text: "Automatic sync when internet available" },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Mobile Mockup */}
          <div className="animate-on-scroll flex justify-center">
            <div className="w-72 bg-white rounded-[2.5rem] shadow-card-hover border-2 border-[#E1E9EC] p-3 mx-auto">
              <div className="bg-[#F7FAFB] rounded-[2rem] p-5 space-y-4">
                {/* Status bar */}
                <div className="flex items-center justify-between text-[10px] text-[#94A1AB] font-medium">
                  <span>VisionRaksha</span>
                  <span className="flex items-center gap-1"><Wifi size={10} /> 4G</span>
                </div>
                {/* Patient form mock */}
                <div className="space-y-3">
                  <div className="bg-white rounded-xl p-3 border border-[#E1E9EC]">
                    <p className="text-[10px] text-[#94A1AB] font-semibold">Patient Name</p>
                    <p className="text-xs text-[#263746] font-medium">Lakshmi Devi</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-[#E1E9EC]">
                    <p className="text-[10px] text-[#94A1AB] font-semibold">ABHA ID</p>
                    <p className="text-xs text-[#263746] font-mono">91-6789-1234</p>
                  </div>
                  <div className="bg-[#E8F7F6] rounded-xl p-3 flex items-center gap-2 border border-[#22AEB0]/20">
                    <Camera size={16} className="text-[#22AEB0]" />
                    <span className="text-xs font-semibold text-[#22AEB0]">Capture Fundus Image</span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span className="text-[11px] font-semibold text-emerald-700">Image Quality: Good</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="animate-on-scroll space-y-5">
            <h2 className="section-title text-left">Built for Field Healthcare Workers</h2>
            <p className="text-base text-[#657685] leading-relaxed">
              ASHA workers and vision technicians can use VisionRaksha with minimal training. The mobile-friendly interface guides every step of the screening process.
            </p>
            <div className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 bg-[#F7FAFB] rounded-xl px-4 py-3 border border-[#E1E9EC]">
                  <Icon size={18} className="text-[#22AEB0] flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-[#263746]">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   10. IMAGE QUALITY SECTION
   ══════════════════════════════════════════════════════════════ */
function ImageQualitySection() {
  const examples = [
    { status: "Recapture Required", color: "rose", msg: "Motion blur — hold the camera steady.", icon: AlertTriangle, label: "Blurry Image" },
    { status: "Adjust Position",    color: "amber", msg: "Insufficient illumination detected.", icon: AlertTriangle, label: "Dark Image" },
    { status: "Ready for AI Analysis", color: "emerald", msg: "Clear retinal image captured.", icon: CheckCircle, label: "Clear Image" },
  ];

  return (
    <section className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Image Quality Assessment</h2>
          <p className="section-subtitle">Automated quality checks ensure reliable AI analysis.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {examples.map(({ status, color, msg, icon: Icon, label }, i) => (
            <div key={label} className="card-themed text-center animate-on-scroll" style={{ transitionDelay: `${i * 100}ms` }}>
              {/* Placeholder image */}
              <div className={`w-full aspect-square rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br ${
                color === "rose" ? "from-rose-100 to-rose-50" :
                color === "amber" ? "from-amber-100 to-amber-50" :
                "from-emerald-100 to-emerald-50"
              }`}>
                <div className={`w-20 h-20 rounded-full ${
                  color === "rose" ? "bg-rose-200/50" :
                  color === "amber" ? "bg-amber-200/50" :
                  "bg-emerald-200/50"
                } flex items-center justify-center`}>
                  <Eye size={28} className={`${
                    color === "rose" ? "text-rose-400" :
                    color === "amber" ? "text-amber-400" :
                    "text-emerald-400"
                  }`} strokeWidth={1.5} />
                </div>
              </div>
              <p className="text-sm font-semibold text-[#263746] mb-1">{label}</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-2 ${
                color === "rose" ? "bg-rose-50 text-rose-600" :
                color === "amber" ? "bg-amber-50 text-amber-600" :
                "bg-emerald-50 text-emerald-600"
              }`}>
                <Icon size={12} />
                {status}
              </span>
              <p className="text-xs text-[#657685]">{msg}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   11. DOCTOR-IN-THE-LOOP
   ══════════════════════════════════════════════════════════════ */
function DoctorInTheLoopSection() {
  const steps = [
    { label: "AI Prediction", icon: Brain },
    { label: "Explainability Evidence", icon: Eye },
    { label: "Doctor Review", icon: Stethoscope },
    { label: "Confirm or Override", icon: UserCheck },
    { label: "Final Clinical Decision", icon: CheckCircle },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="animate-on-scroll space-y-5">
            <h2 className="section-title text-left">AI Assists. Doctors Decide.</h2>
            <p className="text-base text-[#657685] leading-relaxed">
              VisionRaksha is designed to support healthcare professionals rather than replace them. Every AI prediction is reviewed and validated by qualified doctors.
            </p>

            {/* Vertical flow */}
            <div className="space-y-0">
              {steps.map(({ label, icon: Icon }, i) => (
                <div key={label} className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[#E8F7F6] border-2 border-[#22AEB0] flex items-center justify-center">
                      <Icon size={16} className="text-[#22AEB0]" strokeWidth={1.5} />
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-[2px] h-8 bg-[#22AEB0]/20"></div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#263746] -mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Visual card */}
          <div className="animate-on-scroll">
            <div className="bg-[#E8F7F6] rounded-3xl p-8 border border-[#22AEB0]/15">
              <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1F2F42] flex items-center justify-center">
                    <Stethoscope size={20} className="text-[#22AEB0]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1F2F42]">Dr. Sharma</p>
                    <p className="text-[11px] text-[#657685]">Ophthalmologist · Reviewing AI Report</p>
                  </div>
                </div>
                <div className="bg-[#F7FAFB] rounded-xl p-4 border border-[#E1E9EC] space-y-2">
                  <p className="text-xs font-semibold text-[#94A1AB] uppercase tracking-wider">AI Prediction</p>
                  <p className="text-sm font-bold text-[#1F2F42]">Grade 3 — Severe NPDR</p>
                  <p className="text-xs text-[#657685]">Confidence: 89% · Key: Hemorrhages, Hard Exudates</p>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-semibold">✓ Confirmed</button>
                  <button className="flex-1 py-2.5 bg-[#F7FAFB] text-[#657685] rounded-xl text-xs font-semibold border border-[#E1E9EC]">Refer to Hospital</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   12. REPORTS & FOLLOW-UP
   ══════════════════════════════════════════════════════════════ */
function ReportsSection() {
  return (
    <section className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Reports & Follow-Up</h2>
          <p className="section-subtitle">Automated PDF reports with comprehensive screening results.</p>
        </div>

        <div className="animate-on-scroll max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-card border border-[#E1E9EC] overflow-hidden">
            {/* Report Header */}
            <div className="bg-[#1F2F42] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-[#22AEB0]" />
                <div>
                  <p className="text-sm font-bold text-white">VisionRaksha Screening Report</p>
                  <p className="text-[10px] text-[#76D6D2]">Auto-generated · PDF Ready</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#94A1AB]">RPT-2026-0906</span>
            </div>

            {/* Report Content */}
            <div className="p-6 space-y-4">
              {[
                { label: "Patient DR Grade", value: "Grade 2 — Moderate NPDR" },
                { label: "Confidence Score", value: "87%" },
                { label: "Grad-CAM Explanation", value: "Hemorrhages, Microaneurysms detected" },
                { label: "Doctor Validation", value: "Confirmed by Dr. Sharma" },
                { label: "Referral Recommendation", value: "District Hospital — Moderate Priority" },
                { label: "Follow-Up Date", value: "3 months from screening" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#E1E9EC] last:border-0">
                  <span className="text-sm text-[#657685]">{label}</span>
                  <span className="text-sm font-semibold text-[#263746]">{value}</span>
                </div>
              ))}

              <div className="flex gap-3 pt-4">
                <button className="btn-primary flex-1 gap-2 text-sm py-2.5">
                  <Download size={16} /> Download Report
                </button>
                <button className="btn-outline flex-1 gap-2 text-sm py-2.5">
                  <Calendar size={16} /> Schedule Follow-Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   13. RESOURCES & SUPPORT
   ══════════════════════════════════════════════════════════════ */
function ResourcesSection() {
  const resources = [
    { icon: BookOpen, title: "Documentation",  desc: "System guide and AI workflow documentation.", btn: "View" },
    { icon: Database, title: "Datasets",       desc: "IDRiD, EyePACS, Messidor, APTOS datasets.", btn: "Explore" },
    { icon: HelpCircle, title: "Support",      desc: "Get help with the platform.", btn: "Get Help" },
    { icon: Mail,     title: "Contact",        desc: "Contact our VisionRaksha team.", btn: "Contact" },
  ];

  return (
    <section id="resources" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">Resources & Support</h2>
          <p className="section-subtitle">Find documentation, datasets and helpful resources for VisionRaksha.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {resources.map(({ icon: Icon, title, desc, btn }, i) => (
            <div key={title} className="card-themed animate-on-scroll" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="icon-circle">
                <Icon size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#1F2F42] mb-2">{title}</h3>
              <p className="text-sm text-[#657685] leading-relaxed mb-4">{desc}</p>
              <button className="text-sm font-semibold text-[#22AEB0] flex items-center gap-1 hover:gap-2 transition-all">
                {btn} <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Featured About Card */}
        <div className="animate-on-scroll">
          <div className="bg-[#E8F7F6] rounded-3xl p-8 border border-[#22AEB0]/15 max-w-3xl mx-auto text-center">
            <h3 className="text-xl font-bold text-[#1F2F42] mb-3">About VisionRaksha</h3>
            <p className="text-sm text-[#657685] leading-relaxed mb-5">
              VisionRaksha is an AI-powered retinal screening platform designed to detect and explain Diabetic Retinopathy early. Our goal is to make eye screening more accessible, affordable and trustworthy, especially in underserved and rural communities.
            </p>
            <button className="btn-primary gap-2 text-sm">
              Learn More <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   14. ABOUT SECTION
   ══════════════════════════════════════════════════════════════ */
function AboutSection() {
  return (
    <section id="about" className="py-20 bg-[#F7FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="section-title">About VisionRaksha</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {/* Mission */}
          <div className="card-static p-8 animate-on-scroll">
            <div className="icon-circle">
              <Star size={22} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-[#1F2F42] mb-3">Our Mission</h3>
            <p className="text-sm text-[#657685] leading-relaxed">
              To make early Diabetic Retinopathy screening accessible through Explainable AI and doctor-supported healthcare technology.
            </p>
          </div>

          {/* Vision */}
          <div className="card-static p-8 animate-on-scroll" style={{ transitionDelay: "100ms" }}>
            <div className="icon-circle">
              <Eye size={22} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-[#1F2F42] mb-3">Our Vision</h3>
            <p className="text-sm text-[#657685] leading-relaxed">
              Prevent avoidable vision loss by bringing intelligent retinal screening closer to every community.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { icon: Heart, title: "Accessibility", desc: "Screening for every community" },
            { icon: Eye,   title: "Explainability", desc: "Transparent AI decisions" },
            { icon: Shield, title: "Trust", desc: "Doctor-validated results" },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="text-center animate-on-scroll" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="w-16 h-16 rounded-2xl bg-[#E8F7F6] border border-[#22AEB0]/15 flex items-center justify-center mx-auto mb-4">
                <Icon size={24} className="text-[#22AEB0]" strokeWidth={1.5} />
              </div>
              <h4 className="text-base font-bold text-[#1F2F42] mb-1">{title}</h4>
              <p className="text-sm text-[#657685]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   15. FOOTER
   ══════════════════════════════════════════════════════════════ */
function FooterSection() {
  return (
    <footer className="bg-[#1F2F42] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="space-y-4">
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
          <div>
            <p className="text-xs font-bold text-[#76D6D2] uppercase tracking-wider mb-4">Platform</p>
            <ul className="space-y-2.5">
              {["Home", "Features", "How It Works", "Dashboard", "Reports"].map(link => (
                <li key={link}>
                  <a href="#" className="text-sm text-[#94A1AB] hover:text-white transition">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="text-xs font-bold text-[#76D6D2] uppercase tracking-wider mb-4">Resources</p>
            <ul className="space-y-2.5">
              {["Documentation", "Research", "Datasets", "Support", "FAQ"].map(link => (
                <li key={link}>
                  <a href="#" className="text-sm text-[#94A1AB] hover:text-white transition">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-bold text-[#76D6D2] uppercase tracking-wider mb-4">Company</p>
            <ul className="space-y-2.5">
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
