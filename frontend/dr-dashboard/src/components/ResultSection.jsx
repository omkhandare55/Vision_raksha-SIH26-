// src/components/ResultSection.jsx
// Shows AI grade, heatmap, findings, probability bars
// Spec: PRD FR-013 to FR-017, US-006, US-007

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, Volume2, VolumeX, Sliders, FileJson } from "lucide-react";

const GRADE_STYLES = {
  0: { bg: "bg-green-50",  border: "border-green-400", text: "text-green-800",  badge: "bg-green-100"  },
  1: { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-800", badge: "bg-yellow-100" },
  2: { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-800", badge: "bg-orange-100" },
  3: { bg: "bg-red-50",    border: "border-red-500",    text: "text-red-800",    badge: "bg-red-100"    },
  4: { bg: "bg-red-900",   border: "border-red-800",    text: "text-white",      badge: "bg-red-700"    },
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
    text: (res) => `आपकी आँखों की जाँच पूरी हो गई है। परिणाम: ग्रेड ${res.grade} - ${res.grade === 0 ? "सामान्य, कोई खराबी नहीं" : res.grade === 1 ? "हल्की डायबिटिक रेटिनोपैथी" : res.grade === 2 ? "मध्यम डायबिटिक रेटिनोपैथी" : res.grade === 3 ? "गंभीर डायबिटिक रेटिनोपैथी" : "प्रोलिफेरेटिव डायबिटिक रेटिनोपैथी"}। सलाह: ${res.grade >= 2 ? "कृपया नेत्र विशेषज्ञ से तुरंत जाँच कराएं।" : "हर साल नियमित आँखों की जाँच कराते रहें।"}`
  },
  mr: {
    label: "मराठी (Marathi)",
    langCode: "mr-IN",
    title: "रुग्णासाठी ऑडिओ सारांश",
    text: (res) => `आपल्या डोळ्यांची तपासणी पूर्ण झाली आहे. निकाल: ग्रेड ${res.grade} - ${res.grade === 0 ? "डोळे निरोगी आहेत" : res.grade === 1 ? "सौम्य डायबिटिक रेटिनोपॅथी" : res.grade === 2 ? "मध्यम डायबिटिक रेटिनोपॅथी" : res.grade === 3 ? "तीव्र डायबिटिक रेटिनोपॅथी" : "प्रोलिफेरेटिव डायबिटिक रेटिनोपॅथी"}। सल्ला: ${res.grade >= 2 ? "कृपया ताबडतोब नेत्रतज्ज्ञांचा सल्ला घ्या." : "नियमित डोळे तपासणी चालू ठेवा."}`
  },
  ta: {
    label: "தமிழ் (Tamil)",
    langCode: "ta-IN",
    title: "நோயாளிக்கான ஆடியோ சுருக்கம்",
    text: (res) => `கண் பரிசோதனை முடிந்தது. முடிவு: நிலை ${res.grade} - ${res.grade_label}. பரிந்துரை: கண் மருத்துவரை அணுகவும்.`
  },
  te: {
    label: "తెలుగు (Telugu)",
    langCode: "te-IN",
    title: "రోగి ఆడియో సారాంశం",
    text: (res) => `కంటి పరీక్ష పూర్తయింది. ఫలితం: గ్రేడ్ ${res.grade} - ${res.grade_label}. సలహా: ${res.grade >= 2 ? "దయచేసి నేత్ర నిపుణుడిని సంప్రదించండి." : "క్రమం తప్పకుండా కంటి పరీక్షలు చేయించుకోండి."}`
  },
  bn: {
    label: "বাংলা (Bengali)",
    langCode: "bn-IN",
    title: "রোগীর জন্য অডিও সারাংশ",
    text: (res) => `চোখের পরীক্ষা সম্পন্ন হয়েছে। ফলাফল: গ্রেড ${res.grade} - ${res.grade_label}। পরামর্শ: ${res.grade >= 2 ? "অবিলম্বে চক্ষু বিশেষজ্ঞের পরামর্শ নিন।" : "নিয়মিত চোখ পরীক্ষা করान।"}`
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
      <div className={`rounded-xl border-2 p-5 ${style.bg} ${style.border}`}>
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
              <p className="text-xs font-medium text-gray-700 mt-1 bg-white/70 inline-block px-2.5 py-0.5 rounded-md border border-gray-200">
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
        <div className="mt-3 pt-3 border-t border-gray-200/60 flex flex-wrap gap-2 items-center text-xs">
          <span className={`px-2.5 py-1 rounded-full font-semibold ${
            result.dme_risk === "high_risk"
              ? "bg-red-100 text-red-800 border border-red-300"
              : result.dme_risk === "suspected"
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : "bg-green-100 text-green-800 border border-green-200"
          }`}>
            👁 DME: {result.dme_risk === "high_risk" ? "High Risk (CSME)" : result.dme_risk === "suspected" ? "Suspected" : "No Edema"}
          </span>

          {result.progression_risk_5yr !== undefined && (
            <span className="px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              📈 5-Yr Risk: {result.progression_risk_5yr}% ({result.systemic_risk?.toUpperCase()})
            </span>
          )}

          {result.screening_id && (
            <a
              href={`/api/report/${result.screening_id}/fhir`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition"
              title="Download official HL7 FHIR DiagnosticReport JSON"
            >
              <FileJson size={13} /> FHIR (ABHA)
            </a>
          )}
        </div>

        {result.demo_mode && (
          <p className={`mt-2 text-xs opacity-60 ${style.text}`}>
            ⚠ Demo mode — train model on Kaggle for real predictions
          </p>
        )}
      </div>

      {/* ── Rural Multi-Language Voice Summary (ASHA Support) ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🗣️</span>
            <div>
              <p className="text-xs font-bold text-blue-900">{langConfig.title}</p>
              <p className="text-xs text-blue-700">{audioSummaryText}</p>
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
              className="text-xs border border-blue-300 bg-white rounded-lg px-2.5 py-1.5 font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(REGIONAL_TRANSLATIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={toggleSpeech}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                isPlayingAudio
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isPlayingAudio ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isPlayingAudio ? "Stop Audio" : "Play Voice"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Image comparison: original | heatmap ─────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 text-sm font-semibold text-gray-700 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <span>Grad-CAM Explainability — <span className="font-normal text-gray-500">Red regions show pathological focal clusters</span></span>
          <div className="flex items-center gap-2 text-xs font-normal text-gray-500">
            <Sliders size={13} />
            <span>Sensitivity:</span>
            <input
              type="range"
              min="10"
              max="90"
              value={heatmapSensitivity}
              onChange={(e) => setHeatmapSensitivity(Number(e.target.value))}
              className="w-20 accent-blue-600 h-1 cursor-pointer"
            />
            <span className="w-6 font-mono text-right">{heatmapSensitivity}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0">
          <div className="border-r border-gray-100">
            <p className="text-xs text-center text-gray-400 py-1">Original Fundus</p>
            <img
              src={`data:image/jpeg;base64,${result.original_image}`}
              alt="Original fundus"
              className="w-full object-contain bg-gray-900 max-h-56"
            />
          </div>
          <div>
            <p className="text-xs text-center text-gray-400 py-1">Grad-CAM Heatmap</p>
            <img
              src={`data:image/jpeg;base64,${result.heatmap_image}`}
              alt="Grad-CAM heatmap"
              style={{ filter: `contrast(${100 + (heatmapSensitivity - 50) * 0.8}%)` }}
              className="w-full object-contain bg-gray-900 max-h-56"
            />
          </div>
        </div>
      </div>

      {/* ── Multi-Modal Vitals & Doctor Triage Summary ── */}
      {result.doctor_summary && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              🏥 Multi-Modal Triage & Doctor Summary
            </p>
            {result.progression_risk_5yr !== undefined && (
              <span className="text-xs font-bold text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                5-Yr Progression: {result.progression_risk_5yr}%
              </span>
            )}
          </div>
          <p className="text-xs text-indigo-900 leading-relaxed font-medium">
            {result.doctor_summary}
          </p>
        </div>
      )}

      {/* ── Clinical findings ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Clinical Findings (AI Detected)</p>
        <ul className="space-y-1">
          {(result.findings || []).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-0.5 text-blue-400 font-bold text-xs">{i + 1}.</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Probability bars (collapsible) ───────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <button
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
          onClick={() => setShowProbs(!showProbs)}
        >
          Grade Probability Distribution
          {showProbs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showProbs && (
          <div className="mt-3 space-y-2">
            {result.probabilities && Object.entries(result.probabilities).map(([label, prob], i) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{label}</span><span>{prob.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex gap-2">
            <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">{result.icdrs_notes}</p>
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
    <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl p-4">
      <CheckCircle className="text-green-600" size={20} />
      <p className="text-sm font-medium text-green-800">Validation recorded successfully</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Doctor Validation</p>

      <textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Clinical note (optional)..."
        className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      <div className="flex gap-2">
        <button onClick={confirm}
          className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 transition">
          ✓ Confirm AI Recommendation
        </button>
        <button onClick={() => setShow(!show)}
          className="flex-1 border border-red-300 text-red-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-50 transition">
          ✗ Override
        </button>
      </div>

      {show && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Override reason:</p>
          {["Image quality insufficient for confident grading",
            "Clinical examination shows different findings",
            "Patient history suggests different grade"].map(r => (
            <label key={r} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="reason" value={r}
                onChange={e => setReason(e.target.value)}
                className="accent-red-500" />
              {r}
            </label>
          ))}
          <button onClick={override}
            className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition mt-1">
            Submit Override
          </button>
        </div>
      )}
    </div>
  );
}
