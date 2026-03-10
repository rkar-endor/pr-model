import { useState, useRef } from "react";
import {
  ComposedChart, Scatter, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Label,
} from "recharts";

// ── Model ─────────────────────────────────────────────────────────────────────
const BASE_RATES = { low: 7.5, median: 12.4, high: 18.0 };
const DRAG_COEFF = 0.085;

function rateAtN(base, N) {
  const drag = 1 - DRAG_COEFF * Math.log10(Math.max(N, 10) / 10);
  return base * Math.max(drag, 0.72);
}
function prsAtN(base, N) { return Math.round(N * rateAtN(base, N)); }

const HEADCOUNTS = [10, 25, 50, 100, 200, 374, 500, 755, 880, 1200, 1900, 2400, 3000, 4000, 5000, 6000, 8000];

// Band lines: x = devs, y = prs
const bandData = HEADCOUNTS.map((N) => ({
  devs: N,
  high:   prsAtN(BASE_RATES.high,   N),
  median: prsAtN(BASE_RATES.median, N),
  low:    prsAtN(BASE_RATES.low,    N),
}));

// Dev counts updated to real sourced data (2024/2025)
const ANCHORS = [
  { company: "Notion (374)",    devs: 374,  prs: prsAtN(12.4, 374),  tier: "Mid-scale",       source: "Unify 2024" },
  { company: "Figma (755)",     devs: 755,  prs: prsAtN(12.4, 755),  tier: "Growth-scale",    source: "Unify / SEC S-1 2024" },
  { company: "Brex (~380)",     devs: 380,  prs: prsAtN(12.4, 380),  tier: "Mid-scale",       source: "Post-layoff est. 2024" },
  { company: "Lyft (~880)",     devs: 880,  prs: prsAtN(12.4, 880),  tier: "Pre-enterprise",  source: "SEC 10-K 2024 (2,934 total × 30%)" },
  { company: "Coinbase (~1200)",devs: 1200, prs: prsAtN(12.4, 1200), tier: "Pre-enterprise",  source: "Est. ~3,400 total × 35%" },
  { company: "Airbnb (1900)",   devs: 1900, prs: prsAtN(12.4, 1900), tier: "Enterprise",      source: "Airbnb direct disclosure 2024" },
  { company: "DoorDash (2400)", devs: 2400, prs: prsAtN(12.4, 2400), tier: "Enterprise",      source: "Unify 2024" },
  { company: "Stripe (~3000)",  devs: 3000, prs: prsAtN(12.4, 3000), tier: "Large enterprise",source: "8,000 total × ~38% eng" },
  { company: "Uber (~8000)",    devs: 8000, prs: prsAtN(12.4, 8000), tier: "Hyperscale",      source: "31,100 total × ~25% eng" },
];

const TIER_COLORS = {
  "Mid-scale":        "#38bdf8",
  "Growth-scale":     "#a78bfa",
  "Pre-enterprise":   "#34d399",
  "Enterprise":       "#fb923c",
  "Large enterprise": "#f472b6",
  "Hyperscale":       "#facc15",
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
const LINE_META = {
  high:   { label: "High performer", color: "#22d3ee" },
  median: { label: "Median",         color: "#818cf8" },
  low:    { label: "Low performer",  color: "#f87171" },
};

const TIP = {
  background: "#0f172a", border: "1px solid #334155", borderRadius: 10,
  padding: "12px 16px", fontFamily: "'DM Mono',monospace", fontSize: 12,
  color: "#e2e8f0", boxShadow: "0 8px 32px rgba(0,0,0,0.7)", minWidth: 210,
};
const TIP_TITLE = {
  fontWeight: 700, marginBottom: 8, color: "#f8fafc", fontSize: 13,
  borderBottom: "1px solid #1e293b", paddingBottom: 6,
};

function TipRow({ label, val, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{val}</span>
    </div>
  );
}

function RatePill({ rate, prs }) {
  const cost = prs != null ? `$${(prs * 25).toLocaleString()}` : null;
  return (
    <>
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#64748b" }}>PRs / dev / mo</span>
        <span style={{
          color: "#f8fafc", fontWeight: 700, fontSize: 16,
          background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.45)",
          borderRadius: 5, padding: "2px 9px",
        }}>{rate}</span>
      </div>
      {cost && (
        <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#64748b" }}>Code review cost / mo</span>
          <span style={{
            color: "#fbbf24", fontWeight: 700, fontSize: 14,
            background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 5, padding: "2px 9px",
          }}>{cost}</span>
        </div>
      )}
    </>
  );
}

// Renders the same content as hover tooltip for a company (used for click-to-select)
function CompanyTipContent({ company, devs, prs, source }) {
  const rate = (prs / devs).toFixed(1);
  return (
    <div style={TIP}>
      <div style={TIP_TITLE}>{company}</div>
      <TipRow label="Developers"  val={devs.toLocaleString()} color="#38bdf8" />
      <TipRow label="PRs / month" val={prs.toLocaleString()}  color="#a78bfa" />
      <RatePill rate={rate} prs={prs} />
      {source && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#475569", fontFamily: "'DM Mono',monospace" }}>
          Source: {source}
        </div>
      )}
    </div>
  );
}

function TooltipBox({ active, payload }) {
  if (!active || !payload?.length) return null;
  const first = payload[0]?.payload;

  // Scatter point
  if (first?.company) {
    return (
      <CompanyTipContent
        company={first.company}
        devs={first.devs}
        prs={first.prs}
        source={first.source}
      />
    );
  }

  // Band lines
  const devs = first?.devs;
  const lineRows = payload
    .map((p) => {
      const meta = LINE_META[p.name];
      if (!meta || p.value == null) return null;
      return { ...meta, prs: p.value, rate: devs ? (p.value / devs).toFixed(1) : "—" };
    })
    .filter(Boolean);

  if (!lineRows.length) return null;

  return (
    <div style={TIP}>
      <div style={{ ...TIP_TITLE, color: "#94a3b8", fontSize: 11 }}>
        {devs?.toLocaleString()} developers
      </div>
      {lineRows.map(({ label, color, prs, rate }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ color, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
          <TipRow label="PRs / month" val={prs.toLocaleString()} color={color} />
          <RatePill rate={rate} prs={prs} />
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PRModel() {
  const [showAnchors, setShowAnchors] = useState(true);
  const [showBands,   setShowBands]   = useState(true);
  const [inputVal,    setInputVal]    = useState("");
  const [customDevs,  setCustomDevs]  = useState(null);
  const [highlightedCompany, setHighlightedCompany] = useState(null);
  const chartContainerRef = useRef(null);

  const handleInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setInputVal(raw);
    const n = parseInt(raw, 10);
    setCustomDevs(!isNaN(n) && n > 0 ? Math.min(n, 50000) : null);
  };

  const customLow    = customDevs ? prsAtN(BASE_RATES.low,    customDevs) : null;
  const customMedian = customDevs ? prsAtN(BASE_RATES.median, customDevs) : null;
  const customHigh   = customDevs ? prsAtN(BASE_RATES.high,   customDevs) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#020617 0%,#0f172a 60%,#1e1b4b 100%)",
      padding: "32px 24px", fontFamily: "'DM Sans',sans-serif", color: "#e2e8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .tbtn { transition: all .15s ease; cursor: pointer; }
        .tbtn:hover { opacity: .85; transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 28px" }}>
        <div style={{
          display: "inline-block", background: "rgba(99,102,241,.15)",
          border: "1px solid rgba(99,102,241,.3)", borderRadius: 6,
          padding: "4px 12px", fontSize: 11, fontFamily: "'DM Mono',monospace",
          color: "#818cf8", letterSpacing: ".1em", marginBottom: 12, textTransform: "uppercase",
        }}>Statistical Model · v1.1</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", color: "#f8fafc", letterSpacing: "-.5px" }}>
          Monthly PRs vs. Engineering Headcount
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>
          <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>PRs = N × r(N)</code>
          {"  ·  "}
          <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>r(N) = base × (1 − 0.085 × log₁₀(N/10))</code>
          <br />Sources: Swarmia 2025 · LinearB 8.1M PR Study · GitHub Octoverse 2025
        </p>
      </div>

      {/* Toggles */}
      <div style={{ maxWidth: 900, margin: "0 auto 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Performance bands", val: showBands,   set: setShowBands },
          { label: "Company anchors",   val: showAnchors, set: setShowAnchors },
        ].map(({ label, val, set }) => (
          <button key={label} className="tbtn" onClick={() => set(!val)} style={{
            background: val ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.05)",
            border: `1px solid ${val ? "#6366f1" : "#334155"}`,
            borderRadius: 6, padding: "6px 14px",
            color: val ? "#a5b4fc" : "#64748b",
            fontSize: 12, fontFamily: "'DM Mono',monospace",
          }}>
            {val ? "● " : "○ "}{label}
          </button>
        ))}
      </div>

      {/* Custom dev input */}
      <div style={{
        maxWidth: 900, margin: "0 auto 20px",
        background: "rgba(15,23,42,.7)", border: `1px solid ${customDevs ? "rgba(99,102,241,.5)" : "#1e293b"}`,
        borderRadius: 12, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        transition: "border-color .2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>
            Your dev count →
          </span>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={inputVal}
              onChange={handleInput}
              placeholder="e.g. 450"
              style={{
                background: "#0f172a", border: "1px solid #334155", borderRadius: 7,
                padding: "8px 12px", color: "#f8fafc", fontSize: 14, fontFamily: "'DM Mono',monospace",
                width: 110, outline: "none",
                boxShadow: customDevs ? "0 0 0 2px rgba(99,102,241,.4)" : "none",
                transition: "box-shadow .2s",
              }}
            />
          </div>
          {customDevs && (
            <button className="tbtn" onClick={() => { setInputVal(""); setCustomDevs(null); }} style={{
              background: "rgba(255,255,255,.05)", border: "1px solid #334155",
              borderRadius: 6, padding: "6px 10px", color: "#64748b",
              fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer",
            }}>✕ clear</button>
          )}
        </div>

        {customDevs ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flex: 1 }}>
            {[
              { label: "Low",    prs: customLow,    color: "#f87171" },
              { label: "Median", prs: customMedian, color: "#818cf8" },
              { label: "High",   prs: customHigh,   color: "#22d3ee" },
            ].map(({ label, prs, color }) => (
              <div key={label} style={{
                background: "rgba(0,0,0,.3)", border: `1px solid ${color}33`,
                borderRadius: 8, padding: "8px 14px", minWidth: 130,
              }}>
                <div style={{ fontSize: 10, color, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>{prs?.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'DM Mono',monospace" }}>PRs / month</div>
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>
                  ${(prs * 25).toLocaleString()} review cost
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>
            Enter a number to see your team's projected PR volume plotted on the graph
          </span>
        )}
      </div>

      {/* Chart */}
      <div
        ref={chartContainerRef}
        style={{
          maxWidth: 900, margin: "0 auto 28px",
          background: "rgba(15,23,42,.6)", border: "1px solid #1e293b",
          borderRadius: 16, padding: "24px 12px 16px",
          position: "relative",
        }}
      >
        {highlightedCompany && (() => {
          const anchor = ANCHORS.find((p) => p.company === highlightedCompany);
          if (!anchor) return null;
          return (
            <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
              <CompanyTipContent company={anchor.company} devs={anchor.devs} prs={anchor.prs} source={anchor.source} />
            </div>
          );
        })()}
        <ResponsiveContainer width="100%" height={480}>
          <ComposedChart margin={{ top: 36, right: 30, bottom: 44, left: 64 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

            <XAxis
              dataKey="devs"
              type="number"
              domain={[0, 9000]}
              tickCount={10}
              tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v}
              stroke="#334155"
              tick={{ fill: "#64748b", fontSize: 11, fontFamily: "'DM Mono',monospace" }}
            >
              <Label value="Number of developers" offset={-12} position="insideBottom"
                fill="#64748b" fontSize={12} fontFamily="'DM Sans',sans-serif" />
            </XAxis>

            <YAxis
              type="number"
              domain={[0, 95000]}
              tickCount={10}
              tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v}
              stroke="#334155"
              tick={{ fill: "#64748b", fontSize: 11, fontFamily: "'DM Mono',monospace" }}
            >
              <Label value="PRs opened per month" angle={-90} position="insideLeft"
                offset={14} fill="#64748b" fontSize={12} fontFamily="'DM Sans',sans-serif" />
            </YAxis>

            <Tooltip content={<TooltipBox />} />

            {showBands && (
              <>
                <Line data={bandData} dataKey="high"   name="high"
                  type="monotone" stroke="#22d3ee" strokeWidth={2}
                  strokeDasharray="6 3" dot={false} activeDot={{ r: 5, fill: "#22d3ee" }} />
                <Line data={bandData} dataKey="median" name="median"
                  type="monotone" stroke="#818cf8" strokeWidth={2.5}
                  dot={false} activeDot={{ r: 5, fill: "#818cf8" }} />
                <Line data={bandData} dataKey="low"    name="low"
                  type="monotone" stroke="#f87171" strokeWidth={2}
                  strokeDasharray="6 3" dot={false} activeDot={{ r: 5, fill: "#f87171" }} />
              </>
            )}

            {showAnchors && Object.entries(TIER_COLORS).map(([tier, color]) => (
              <Scatter
                key={tier} name={tier}
                data={ANCHORS.filter((p) => p.tier === tier).map((p) => ({
                  devs: p.devs, prs: p.prs, company: p.company, tier: p.tier, source: p.source,
                }))}
                dataKey="prs"
                fill={color}
                opacity={0.9}
                shape={(props) => {
                  const { cx, cy, payload } = props;
                  const isHighlighted = payload?.company === highlightedCompany;
                  return (
                    <g key={payload?.company ?? `${cx}-${cy}`}>
                      {isHighlighted && (
                        <circle cx={cx} cy={cy} r={14} fill="none" stroke="#f8fafc" strokeWidth={2} opacity={0.9}>
                          <animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle cx={cx} cy={cy} r={isHighlighted ? 10 : 7} fill={color} opacity={isHighlighted ? 1 : 0.9} stroke={isHighlighted ? "#f8fafc" : "none"} strokeWidth={isHighlighted ? 2.5 : 0} />
                    </g>
                  );
                }}
              />
            ))}

            {/* Custom dev count: vertical line + dots on each band */}
            {customDevs && (
              <>
                <ReferenceLine
                  x={customDevs}
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  label={{
                    value: `${customDevs.toLocaleString()} devs`,
                    position: "top",
                    fill: "#a5b4fc",
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                  }}
                />
                <Scatter
                  name="Your team"
                  data={[
                    { devs: customDevs, prs: customHigh,   band: "High",   color: "#22d3ee" },
                    { devs: customDevs, prs: customMedian, band: "Median", color: "#818cf8" },
                    { devs: customDevs, prs: customLow,    band: "Low",    color: "#f87171" },
                  ]}
                  dataKey="prs"
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <g key={`${payload.band}-${cx}-${cy}`}>
                        <circle cx={cx} cy={cy} r={9}  fill="#0f172a" stroke={payload.color} strokeWidth={2.5} />
                        <circle cx={cx} cy={cy} r={4}  fill={payload.color} />
                      </g>
                    );
                  }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend pills — click to scroll to point on graph */}
      {showAnchors && (
        <div style={{ maxWidth: 900, margin: "0 auto 24px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ANCHORS.map((p) => (
            <button
              key={p.company}
              type="button"
              className="tbtn"
              onClick={() => {
                setHighlightedCompany(p.company);
                chartContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => setHighlightedCompany(null), 2500);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: highlightedCompany === p.company ? "rgba(99,102,241,.2)" : "rgba(15,23,42,.6)",
                border: `1px solid ${highlightedCompany === p.company ? "#6366f1" : "#1e293b"}`,
                borderRadius: 8, padding: "5px 11px",
                fontSize: 11, fontFamily: "'DM Mono',monospace",
                cursor: "pointer", color: "inherit", textAlign: "left",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: TIER_COLORS[p.tier] }} />
              <span style={{ color: "#cbd5e1" }}>{p.company}</span>
              <span style={{ color: "#475569" }}>~{(p.prs/1000).toFixed(1)}k PRs</span>
              <span style={{ color: "#334155", fontSize: 10 }}>· {p.source}</span>
            </button>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ maxWidth: 900, margin: "0 auto 24px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Median rate",       value: "12.4", unit: "PRs / dev / mo",      sub: "Swarmia 2025, 6.1M PRs",     color: "#818cf8" },
          { label: "Elite rate",        value: "18+",  unit: "PRs / dev / mo",      sub: "Top quartile performers",    color: "#22d3ee" },
          { label: "Coordination drag", value: "8.5%", unit: "per decade of scale", sub: "per 10× headcount increase", color: "#fb923c" },
        ].map(({ label, value, unit, sub, color }) => (
          <div key={label} style={{
            background: "rgba(15,23,42,.6)", border: "1px solid #1e293b",
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'DM Mono',monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{unit}</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        maxWidth: 900, margin: "0 auto",
        background: "rgba(15,23,42,.6)", border: "1px solid #1e293b",
        borderRadius: 12, padding: "14px 18px",
        fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#64748b", lineHeight: 1.9,
      }}>
        <span style={{ color: "#818cf8" }}>MODEL</span>{"  "}
        PRs/month = N × r(N){"  "}|{"  "}
        <span style={{ color: "#22d3ee" }}>r(N) = base × (1 − 0.085 × log₁₀(N/10))</span>
        {"  "}|{"  "}bases: low=7.5 · median=12.4 · high=18.0
        <br />
        <span style={{ color: "#818cf8" }}>SOURCES</span>{"  "}
        Swarmia 2025 (6.1M PRs) · LinearB 2026 (8.1M PRs, 4,800 teams) · GitHub Octoverse 2025 (43.2M PRs/mo)
      </div>
    </div>
  );
}