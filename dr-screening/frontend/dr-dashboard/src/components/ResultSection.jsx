// src/components/ResultSection.jsx
// Shows AI grade, heatmap, findings, probability bars
// Spec: PRD FR-013 to FR-017, US-006, US-007

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, Volume2, VolumeX, Sliders, FileJson } from "lucide-react";

const GRADE_STYLES = {
  0: { bg: "bg-emerald-50",  border: "border-emerald-300", text: "text-emerald-800",  badge: "bg-emerald-100"  },
  1: { bg: "bg-amber-50",    border: "border-amber-300",   text: "text-amber-800",    badge: "bg-amber-100" },
  2: { bg: "bg-orange-50",   border: "border-orange-300",  text: "text-orange-800",   badge: "bg-orange-100" },
  3: { bg: "bg-rose-50",     border: "border-rose-400",    text: "text-rose-800",     badge: "bg-rose-100"    },
  4: { bg: "bg-rose-900",    border: "border-rose-800",    text: "text-white",        badge: "bg-rose-700"    },
};

const PROB_COLORS = ["#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#7f1d1d"];

const REGIONAL_TRANSLATIONS = {
  en: {
    label: "English",
    langCode: "en-US",
    title: "Patient Audio Summary",
    text: (res) => `Eye screening complete. Diagnosed as Grade ${res.grade}, ${res.grade_label}. Recommended action: ${res.recommended_action_timeline || res.action}. Diabetic Macular Edema risk is ${res.dme_risk || 'none'}.`
  },
  hi: {
    label: "हिंदी (Hindi)",
    langCode: "hi-IN",
    title: "मरीज़ के लिए ऑडियो सारांश",
    text: (res) => `आपकी आँखों की जाँच पूरी हो गई है। परिणाम: ग्रेड ${res.grade} - ${res.grade === 0 ? "सामान्य, कोई खराबी नहीं" : res.grade === 1 ? "हल्की डायबिटिक रेटिनोपैथी" : res.grade === 2 ? "मध्यम डायबिटिक रेटिनोपैथी" : "गंभीर डायबिटिक रेटिनोपैथी"}। सलाह: ${res.grade >= 2 ? "कृपया नेत्र विशेषज्ञ से तुरंत जाँच कराएं।" : "हर साल नियमित आँखों की जाँच कराते रहें।"}`
  },
  mr: {
    label: "मराठी (Marathi)",
    langCode: "mr-IN",
    title: "रुग्णासाठी ऑडिओ सारांश",
    text: (res) => `आपल्या डोळ्यांची तपासणी पूर्ण झाली आहे. निकाल: ग्रेड ${res.grade} - ${res.grade === 0 ? "डोळे निरोगी आहेत" : "डायबिटिक रेटिनोपॅथीचे लक्षणे आढळली आहेत"}। सल्ला: ${res.grade >= 2 ? "कृपया ताबडतोब नेत्रतज्ज्ञांचा सल्ला घ्या." : "नियमित डोळे तपासणी चालू ठेवा."}`
  },
  ta: {
    label: "தமிழ் (Tamil)",
    langCode: "ta-IN",
    title: "நோயாளிக்கான ஆடியோ சுருக்கம்",
    text: (res) => `கண் பரிசோதனை முடிந்தது. முடிவு: நிலை ${res.grade} - ${res.grade === 0 ? "கண்கள் ஆரோக்கியமாக உள்ளன" : "நீரிழிவு விழித்திரை பாதிப்பு கண்டறியப்பட்டது"}. பரிந்துரை: கண் மருத்துவரை அணுகவும்.`
  },
  te: {
    label: "తెలుగు (Telugu)",
    langCode: "te-IN",
    title: "రోగి ఆడియో సారాంశం",
    text: (res) => `కంటి పరీక్ష పూర్తయింది. ఫలితం: గ్రేడ్ ${res.grade}. సలహా: ${res.grade >= 2 ? "దయచేసి నేత్ర నిపుణుడిని సంప్రదించండి." : "క్రమం తప్పకుండా కంటి పరీక్షలు చేయించుకోండి."}`
  },
  bn: {
    label: "বাংলা (Bengali)",
    langCode: "bn-IN",
    title: "রোগীর জন্য অডিও সারাংশ",
    text: (res) => `চোখের পরীক্ষা সম্পন্ন হয়েছে। ফলাফল: গ্রেড ${res.grade}। পরামর্শ: ${res.grade >= 2 ? "অবিলম্বে চক্ষু বিশেষজ্ঞের পরামর্শ নিন।" : "নিয়মিত চোখ পরীক্ষা করান।"}`
  }
};

export default function ResultSection({ result, onValidate }) {
  const [showProbs, setShowProbs] = useState(false);
  const [selectedLang, setSelectedLang] = useState("hi");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [heatmapSensitivity, setHeatmapSensitivity] = useState(40);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  if (!result) return null;

  const style = GRADE_STYLES[result.grade] ?? GRADE_STYLES[0];
  const langConfig = REGIONAL_TRANSLATIONS[selectedLang] || REGIONAL_TRANSLATIONS.en;
  const audioSummaryText = langConfig.text(result);

  const toggleSpeech = () => {
    if (!window.speechSynthesis) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(audioSummaryText);
      utterance.lang = langConfig.langCode;
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-4 mt-6">

      {/* ── Grade banner ──────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-5 ${style.bg} ${style.border}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {result.grade >= 2
                ? <AlertTriangle size={20} className={style.text} />
                : <CheckCircle  size={20} className={style.text} />
              }
              <span className={`text-xl font-bold ${style.text}`}>
                Grade {result.grade} — {result.grade_label}
              </span>
            </div>
            <p className={`text-sm font-semibold ${style.text}`}>{result.action}</p>
            {result.recommended_action_timeline && (
              <p className="text-xs font-medium text-[#657685] mt-1 bg-white/70 inline-block px-2.5 py-0.5 rounded-lg border border-[#E1E9EC]">
                ⏱ {result.recommended_action_timeline}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${style.text}`}>
              {result.confidence}%
            </span>
            <p className={`text-xs ${style.text} opacity-70`}>confidence</p>
          </div>
        </div>

        {/* ── DME & Multi-Modal Badges ── */}
        <div className="mt-3 pt-3 border-t border-[#E1E9EC]/60 flex flex-wrap gap-2 items-center text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-semibold ${
            result.dme_risk === "high_risk"
              ? "bg-rose-100 text-rose-800 border border-rose-200"
              : result.dme_risk === "suspected"
              ? "bg-amber-100 text-amber-800 border border-amber-200"
              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
          }`}>
            👁 DME: {result.dme_risk === "high_risk" ? "High Risk (CSME)" : result.dme_risk === "suspected" ? "Suspected" : "No Edema"}
          </span>

          {result.progression_risk_5yr !== undefined && (
            <span className="px-2.5 py-1 rounded-lg font-semibold bg-[#E8F7F6] text-[#22AEB0] border border-[#22AEB0]/20">
              📈 5-Yr Risk: {result.progression_risk_5yr}% ({result.systemic_risk?.toUpperCase()})
            </span>
          )}

          {result.screening_id && (
            <a
              href={`/api/report/${result.screening_id}/fhir`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium bg-[#F7FAFB] hover:bg-[#E8F7F6] text-[#657685] border border-[#E1E9EC] transition"
              title="Download official HL7 FHIR DiagnosticReport JSON"
            >
              <FileJson size={13} /> FHIR (ABHA)
            </a>
          )}
        </div>
      </div>

      {/* ── Rural Multi-Language Voice Summary (ASHA Support) ── */}
      <div className="bg-gradient-to-r from-[#E8F7F6] to-[#F7FAFB] border border-[#22AEB0]/15 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl p-2.5 bg-white rounded-2xl shadow-soft border border-[#E1E9EC]">🗣️</span>
            <div>
              <p className="text-xs font-bold text-[#1F2F42] uppercase tracking-wider">{langConfig.title}</p>
              <p className="text-xs text-[#657685] font-medium leading-relaxed mt-0.5">{audioSummaryText}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedLang}
              onChange={(e) => {
                if (isPlayingAudio && window.speechSynthesis) window.speechSynthesis.cancel();
                setIsPlayingAudio(false);
                setSelectedLang(e.target.value);
              }}
              aria-label="Select Patient Summary Language"
              className="text-xs border border-[#E1E9EC] bg-white rounded-xl px-4 py-2 font-semibold text-[#263746] focus:outline-none focus:ring-2 focus:ring-[#22AEB0]"
            >
              {Object.entries(REGIONAL_TRANSLATIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={toggleSpeech}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isPlayingAudio
                  ? "bg-rose-600 text-white hover:bg-rose-700 shadow-md"
                  : "btn-ai text-xs py-2 px-4"
              }`}
            >
              {isPlayingAudio ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isPlayingAudio ? "Stop Audio" : "Play Voice"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Image comparison: original | heatmap ─────── */}
      <div className="card-static overflow-hidden p-0">
        <div className="px-5 py-3.5 text-xs font-semibold text-[#1F2F42] border-b border-[#E1E9EC] bg-[#F7FAFB] flex flex-wrap items-center justify-between gap-2">
          <span>Grad-CAM Explainability — <span className="font-medium text-[#657685]">Red regions show pathological focal clusters</span></span>
          <div className="flex items-center gap-2 text-xs font-medium text-[#657685]">
            <Sliders size={13} className="text-[#22AEB0]" />
            <span>Sensitivity:</span>
            <input
              type="range"
              min="10"
              max="90"
              value={heatmapSensitivity}
              onChange={(e) => setHeatmapSensitivity(Number(e.target.value))}
              className="w-20 accent-[#22AEB0] h-1.5 cursor-pointer"
            />
            <span className="w-6 font-mono text-right font-bold text-[#22AEB0]">{heatmapSensitivity}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0">
          <div className="border-r border-[#E1E9EC]">
            <p className="text-xs text-center text-[#94A1AB] py-1 font-medium">Original Fundus</p>
            <img
              src={`data:image/jpeg;base64,${result.original_image}`}
              alt="Original fundus"
              className="w-full object-contain bg-[#0a0a0a] max-h-56"
            />
          </div>
          <div>
            <p className="text-xs text-center text-[#94A1AB] py-1 font-medium">Grad-CAM Heatmap</p>
            <img
              src={`data:image/jpeg;base64,${result.heatmap_image}`}
              alt="Grad-CAM heatmap"
              style={{ filter: `contrast(${100 + (heatmapSensitivity - 50) * 0.8}%)` }}
              className="w-full object-contain bg-[#0a0a0a] max-h-56"
            />
          </div>
        </div>
      </div>

      {/* ── Multi-Modal Vitals & Doctor Triage Summary ── */}
      {result.doctor_summary && (
        <div className="bg-[#E8F7F6] border border-[#22AEB0]/15 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#1F2F42] uppercase tracking-wider">
              🏥 Multi-Modal Triage & Doctor Summary
            </p>
            {result.progression_risk_5yr !== undefined && (
              <span className="text-xs font-semibold text-[#22AEB0] bg-white px-3 py-0.5 rounded-lg border border-[#22AEB0]/15">
                5-Yr Progression: {result.progression_risk_5yr}%
              </span>
            )}
          </div>
          <p className="text-xs text-[#263746] leading-relaxed font-medium">
            {result.doctor_summary}
          </p>
        </div>
      )}

      {/* ── Clinical findings ─────────────────────────── */}
      <div className="card-static p-4">
        <p className="text-sm font-bold text-[#1F2F42] mb-2">Clinical Findings (AI Detected)</p>
        <ul className="space-y-1">
          {(result.findings || []).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#657685] font-medium">
              <span className="mt-0.5 text-[#22AEB0] font-bold text-xs">{i + 1}.</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Probability bars (collapsible) ───────────── */}
      <div className="card-static p-4">
        <button
          className="w-full flex items-center justify-between text-sm font-bold text-[#1F2F42]"
          onClick={() => setShowProbs(!showProbs)}
        >
          Grade Probability Distribution
          {showProbs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showProbs && (
          <div className="mt-3 space-y-2">
            {result.probabilities && Object.entries(result.probabilities).map(([label, prob], i) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-[#657685] mb-0.5 font-medium">
                  <span>{label}</span><span>{prob.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[#F7FAFB] rounded-full overflow-hidden border border-[#E1E9EC]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${prob}%`, backgroundColor: PROB_COLORS[i] }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ICDRS note ────────────────────────────────── */}
      {result.icdrs_notes && (
        <div className="bg-[#F7FAFB] border border-[#E1E9EC] rounded-2xl p-3.5">
          <div className="flex gap-2">
            <Info size={16} className="text-[#22AEB0] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[#263746] font-medium leading-relaxed">{result.icdrs_notes}</p>
          </div>
        </div>
      )}

      {/* ── Doctor validation buttons (FE-004) ───────── */}
      {onValidate && (
        <ValidationButtons
          screeningId={result.screening_id}
          onValidate={onValidate}
        />
      )}
    </div>
  );
}

// ── FE-004 — Validation buttons ──────────────────────────────
function ValidationButtons({ screeningId, onValidate }) {
  const [done, setDone]     = useState(false);
  const [note, setNote]     = useState("");
  const [reason, setReason] = useState("");
  const [show, setShow]     = useState(false);

  const confirm = () => {
    onValidate({ action: "confirmed", note, screening_id: screeningId });
    setDone(true);
  };
  const override = () => {
    if (!reason) { alert("Please select an override reason"); return; }
    onValidate({ action: "overridden", override_reason: reason, note, screening_id: screeningId });
    setDone(true);
  };

  if (done) return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
      <CheckCircle className="text-emerald-600" size={20} />
      <p className="text-sm font-medium text-emerald-800">Validation recorded successfully</p>
    </div>
  );

  return (
    <div className="card-static p-5 space-y-4">
      <p className="text-sm font-bold text-[#1F2F42]">Doctor Validation</p>

      <textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Clinical note (optional)..."
        className="w-full text-sm border border-[#E1E9EC] bg-[#F7FAFB] rounded-xl p-3.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#22AEB0] focus:bg-white transition"
      />

      <div className="flex gap-2">
        <button onClick={confirm}
          className="flex-1 btn-primary py-2.5 px-4 text-sm">
          ✓ Confirm AI Recommendation
        </button>
        <button onClick={() => setShow(!show)}
          className="flex-1 border border-rose-300 text-rose-600 py-2.5 px-4 rounded-xl text-sm font-semibold hover:bg-rose-50 transition cursor-pointer">
          ✗ Override
        </button>
      </div>

      {show && (
        <div className="space-y-3 pt-1 border-t border-[#E1E9EC]">
          <p className="text-xs font-medium text-[#657685]">Override reason:</p>
          {["Image quality insufficient for confident grading",
            "Clinical examination shows different findings",
            "Patient history suggests different grade"].map(r => (
            <label key={r} className="flex items-center gap-2 text-sm text-[#657685] cursor-pointer">
              <input type="radio" name="reason" value={r}
                onChange={e => setReason(e.target.value)}
                className="accent-[#22AEB0]" />
              {r}
            </label>
          ))}
          <button onClick={override}
            className="w-full bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-700 shadow-md transition cursor-pointer">
            Submit Override
          </button>
        </div>
      )}
    </div>
  );
}
