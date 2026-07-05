import React, { useState, useEffect, useRef } from "react";

const C = {
  ink: "#FFFFFF", panel: "#F1EFE8", panel2: "#E7E4DA", line: "#B8B3A6",
  bone: "#111111", muted: "#1A1A1A", brass: "#7A5600", green: "#1E6B22", slate: "#144E86",
  amber: "#E8A800", red: "#C62222", tick: "#FFFFFF",
};

const PORTEURS = ["", "moi", "Assistant", "Comptable", "Avocat", "Agent", "Artisan", "Sarah", "maman", "Maunnia", "Talel"];
const CTX = ["", "Maison", "Bureau", "Ordi", "Nomade", "Dehors"];
const CTX_ICON = { "": "+ lieu", Maison: "🏠 Maison", Bureau: "💼 Bureau", Ordi: "💻 Ordi", Nomade: "🧳 Nomade", Dehors: "🌳 Dehors" };
const MAX = 3; // étoiles et éclairs : 0 à 3

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const leaf = (t, who = "") => ({ id: uid(), t, done: false, who, ctx: "", stars: 0, urgent: 0 });

const SEED = [
  { t: "Greffe", subs: [leaf("Réserver date + vols"), leaf("Réserver la suite en Grèce")] },
  { t: "Gérer le problème Foued", subs: [
    leaf("Aller voir un pénaliste"), leaf("Mettre la double authentification"),
    leaf("Voir combien a été pris sur Formalink"), leaf("Vérifier les mouvements sur B2C")] },
  { t: "Finir la villa + mettre en loc", subs: [
    leaf("Appeler Sarah pour mettre des artisans et terminer", "moi"), leaf("Acheter un canapé", "moi")] },
  { t: "Gérer Nova (contrat, factures)", subs: [
    leaf("Faire signer le partenariat", "moi"), leaf("Présenter l'offre d'expert-comptable", "moi"), leaf("Former les commerciaux")] },
  { t: "Fermer Didactiz + ADN", subs: [
    leaf("Mise au propre comptable", "moi"), leaf("Mise au propre juridique", "moi")] },
  { t: "Payer les charges CMS", subs: [], who: "Maunnia" },
  { t: "Acheter un canapé", subs: [
    leaf("Définir style + délai"), leaf("Présélectionner 3 modèles", "moi"), leaf("RDV magasins", "moi"), leaf("Suivre la livraison", "maman")] },
  { t: "Vacances de Léna", subs: [leaf("Définir le sport"), leaf("Planning devoirs"), leaf("Réserver les hôtels")] },
  { t: "David", subs: [
    leaf("Remonter mes dividendes", "moi"), leaf("Renflouer Formalink"), leaf("Remboursement Soukaina"), leaf("Récupérer 25 % Majorelle")] },
  { t: "Louer l'appart de Cagnes", subs: [leaf("Appeler Sarah et la laisser faire", "moi")] },
  { t: "Calculer la rentabilité du Maroc", subs: [leaf("Récupérer les relevés de toutes les banques")] },
  { t: "Récupérer les lunettes", subs: [], who: "moi" },
];

const buildSeed = () => SEED.map((it) => it.subs.length
  ? { id: uid(), t: it.t, open: false, subs: it.subs.map((s) => ({ ...s, id: uid() })) }
  : { id: uid(), t: it.t, open: false, subs: [], leaf: { ...leaf(it.t, it.who || ""), t: undefined } });

const KEY = "liste-v3";

export default function App() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [ctxF, setCtxF] = useState("");
  const [urgOnly, setUrgOnly] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const id = "plex-v3";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(l);
    }
    (async () => {
      try { const raw = localStorage.getItem(KEY); setItems(raw ? JSON.parse(raw) : buildSeed()); }
      catch (e) { setItems(buildSeed()); }
      setReady(true);
    })();
  }, []);

  const persist = (n) => { setItems(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} };
  const updItem = (iid, fn) => persist(items.map((it) => it.id === iid ? fn(it) : it));

  // leaf accessor : atomic item uses it.leaf ; sub uses the sub object
  const cycleAttr = (leafObj, key, arr) => {
    if (key === "stars") return { ...leafObj, stars: (leafObj.stars + 1) % (MAX + 1) };
    if (key === "urgent") return { ...leafObj, urgent: (leafObj.urgent + 1) % (MAX + 1) };
    return { ...leafObj, [key]: arr[(arr.indexOf(leafObj[key]) + 1) % arr.length] };
  };

  const updAtomicLeaf = (iid, fn) => updItem(iid, (it) => ({ ...it, leaf: fn(it.leaf) }));
  const updSub = (iid, sid, fn) => updItem(iid, (it) => ({ ...it, subs: it.subs.map((s) => s.id === sid ? fn(s) : s) }));

  const toggleOpen = (iid) => updItem(iid, (it) => ({ ...it, open: !it.open }));
  const renameItem = (iid, t) => updItem(iid, (it) => ({ ...it, t }));
  const delItem = (iid) => persist(items.filter((it) => it.id !== iid));
  const delSub = (iid, sid) => updItem(iid, (it) => ({ ...it, subs: it.subs.filter((s) => s.id !== sid) }));
  const addSub = (iid) => updItem(iid, (it) => {
    const sub = leaf("Nouvelle sous-tâche");
    setTimeout(() => setEditing(sub.id), 0);
    return { ...it, open: true, subs: [...it.subs, sub] };
  });
  const addItem = () => { const it = { id: uid(), t: "Nouveau", open: false, subs: [], leaf: leaf("") }; persist([...items, it]); setEditing(it.id); };

  // ---- filtres ----
  const active = q.trim() !== "" || ctxF !== "" || urgOnly;
  const ql = q.trim().toLowerCase();
  const matchLeaf = (lf, title) => {
    const txt = (title || "").toLowerCase();
    const okQ = ql === "" || txt.includes(ql) || (lf.who || "").toLowerCase().includes(ql);
    const okC = ctxF === "" || lf.ctx === ctxF;
    const okU = !urgOnly || lf.urgent > 0;
    return okQ && okC && okU;
  };

  const allLeaves = items.flatMap((it) => it.subs.length ? it.subs : [it.leaf]);
  const nDone = allLeaves.filter((x) => x && x.done).length;
  const pct = allLeaves.length ? Math.round((nDone / allLeaves.length) * 100) : 0;

  if (!ready) return <div style={s.root}><style>{css}</style></div>;

  const LeafRow = ({ lf, title, onRename, onToggle, onDel, onAttr, atomic }) => (
    <div style={atomic ? s.leafCardAtom : s.leafCard}>
      <div style={s.leafTop}>
        <button onClick={onToggle} style={s.checkBtn}><Box d={lf.done} /></button>
        <Editable id={lf.id} value={title} editing={editing} setEditing={setEditing}
          onSave={onRename} done={lf.done} bold={atomic} />
        <button style={s.del} onClick={onDel}>×</button>
      </div>
      <div style={s.chips}>
        <button style={chipStyle(lf.who && lf.who !== "")} onClick={() => onAttr("who", PORTEURS)}>
          {lf.who ? (lf.who === "moi" ? "MOI" : lf.who) : "+ qui"}
        </button>
        <button style={chipStyle(lf.ctx !== "")} onClick={() => onAttr("ctx", CTX)}>{CTX_ICON[lf.ctx]}</button>
        <button style={chipStyle(lf.stars > 0)} onClick={() => onAttr("stars", null)}>
          {lf.stars > 0 ? "★".repeat(lf.stars) : "★ 0"}
        </button>
        <button style={{ ...chipStyle(lf.urgent > 0), color: lf.urgent >= 3 ? C.red : lf.urgent > 0 ? C.amber : C.muted, borderColor: lf.urgent >= 3 ? C.red : lf.urgent > 0 ? C.amber : C.line }}
          onClick={() => onAttr("urgent", null)}>
          {lf.urgent > 0 ? "⚡".repeat(lf.urgent) : "⚡ 0"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.root}>
      <style>{css}</style>
      <div style={s.head}>
        <div style={s.titleRow}>
          <h1 style={s.h1}>À faire</h1>
          <button style={s.reset} onClick={() => { if (confirmReset) { persist(buildSeed()); setConfirmReset(false); } else setConfirmReset(true); }}>
            {confirmReset ? "Confirmer ?" : "↺ Reset"}
          </button>
        </div>
        <div style={s.progress}>
          <div style={s.bar}><div style={{ ...s.fill, width: `${pct}%` }} /></div>
          <span style={s.count}>{nDone}/{allLeaves.length}</span>
        </div>

        {/* recherche + filtres */}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 chercher (personne, mot…)" style={s.search} />
        <div style={s.filters}>
          {CTX.map((c) => (
            <button key={c || "all"} onClick={() => setCtxF(ctxF === c ? "" : c)}
              style={{ ...s.fchip, ...(ctxF === c && c !== "" ? s.fchipOn : {}) }}>
              {c === "" ? "Tous lieux" : CTX_ICON[c]}
            </button>
          ))}
          <button onClick={() => setUrgOnly(!urgOnly)} style={{ ...s.fchip, ...(urgOnly ? s.fchipUrg : {}) }}>⚡ Urgent</button>
        </div>
      </div>

      <div style={s.list}>
        {items.map((it) => {
          const atomic = it.subs.length === 0;
          if (atomic) {
            const lf = it.leaf;
            if (active && !matchLeaf(lf, it.t)) return null;
            return <LeafRow key={it.id} lf={lf} title={it.t} atomic
              onRename={(v) => renameItem(it.id, v)}
              onToggle={() => updAtomicLeaf(it.id, (x) => ({ ...x, done: !x.done }))}
              onDel={() => delItem(it.id)}
              onAttr={(k, arr) => updAtomicLeaf(it.id, (x) => cycleAttr(x, k, arr))} />;
          }
          const shownSubs = active ? it.subs.filter((sub) => matchLeaf(sub, sub.t)) : it.subs;
          if (active && shownSubs.length === 0) return null;
          const done = it.subs.filter((x) => x.done).length;
          const isOpen = active ? true : it.open;
          return (
            <div key={it.id} style={s.group}>
              <div style={s.projHead}>
                <button onClick={() => toggleOpen(it.id)} style={s.checkBtn}>
                  <span style={{ ...s.ring, borderColor: done === it.subs.length ? C.green : done > 0 ? C.brass : C.line }}>
                    {done === it.subs.length ? "✓" : ""}</span>
                </button>
                <Editable id={it.id} value={it.t} editing={editing} setEditing={setEditing}
                  onSave={(v) => renameItem(it.id, v)} bold done={false} />
                <span style={s.frac}>{done}/{it.subs.length}</span>
                <button style={s.iconBtn} onClick={() => toggleOpen(it.id)}>
                  <span style={{ ...s.chev, transform: isOpen ? "rotate(90deg)" : "none" }}>›</span></button>
                <button style={s.del} onClick={() => delItem(it.id)}>×</button>
              </div>
              {isOpen && (
                <div style={s.subsWrap}>
                  {shownSubs.map((sub) => (
                    <LeafRow key={sub.id} lf={sub} title={sub.t}
                      onRename={(v) => updSub(it.id, sub.id, (x) => ({ ...x, t: v }))}
                      onToggle={() => updSub(it.id, sub.id, (x) => ({ ...x, done: !x.done }))}
                      onDel={() => delSub(it.id, sub.id)}
                      onAttr={(k, arr) => updSub(it.id, sub.id, (x) => cycleAttr(x, k, arr))} />
                  ))}
                  {!active && <button style={s.addSub} onClick={() => addSub(it.id)}>+ sous-tâche</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!active && <button style={s.addItem} onClick={addItem}>+ Ajouter un truc</button>}
    </div>
  );
}

function subTitle(it, sub) { return sub.t; }

function Editable({ id, value, editing, setEditing, onSave, done, bold }) {
  const ref = useRef(null);
  const isEd = editing === id;
  useEffect(() => { if (isEd && ref.current) { ref.current.focus(); ref.current.select(); } }, [isEd]);
  if (isEd) return (
    <input ref={ref} defaultValue={value} style={{ ...st.input, fontWeight: bold ? 600 : 400 }}
      onBlur={(e) => { onSave(e.target.value.trim() || value); setEditing(null); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
  );
  return (
    <span onClick={() => setEditing(id)} style={{ ...st.txt, fontWeight: bold ? 600 : 400,
      color: done ? C.muted : C.bone, textDecoration: done ? "line-through" : "none" }}>{value}</span>
  );
}

const Box = ({ d }) => (
  <span style={{ ...st.box, borderColor: d ? C.green : C.line, background: d ? C.green : "transparent" }}>{d ? "✓" : ""}</span>
);

const mono = "'IBM Plex Mono', ui-monospace, monospace";
const sans = "'Inter', system-ui, sans-serif";
const css = `*{box-sizing:border-box}button{font-family:inherit;cursor:pointer;background:none;border:none;padding:0}input{font-family:inherit;outline:none}input::placeholder{color:#333;opacity:1}button:focus-visible,input:focus{outline:2px solid #A9823F;outline-offset:-2px}`;

const chipStyle = (on) => ({
  fontFamily: mono, fontSize: 10, letterSpacing: 0.3, padding: "5px 9px", borderRadius: 7,
  border: `1px solid ${on ? C.slate : C.line}`, color: on ? C.bone : C.muted,
  background: on ? "rgba(110,140,168,0.12)" : "transparent", whiteSpace: "nowrap",
});

const st = {
  txt: { flex: 1, fontSize: 14, lineHeight: 1.3, minWidth: 0, wordBreak: "break-word" },
  input: { flex: 1, background: C.ink, color: C.bone, border: `1px solid ${C.brass}`, borderRadius: 6, padding: "6px 8px", minWidth: 0, fontSize: 14 },
  box: { width: 22, height: 22, borderRadius: 6, border: "1.5px solid", display: "grid", placeItems: "center", fontSize: 12, color: C.tick, fontWeight: 700, flexShrink: 0 },
};

const s = {
  root: { background: C.ink, color: C.bone, minHeight: "100vh", fontFamily: sans, padding: "20px 12px 60px", maxWidth: 520, margin: "0 auto" },
  head: { marginBottom: 12 },
  titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  h1: { fontFamily: mono, fontSize: 25, fontWeight: 600, margin: 0 },
  reset: { fontFamily: mono, fontSize: 10, letterSpacing: 1, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 10px" },
  progress: { display: "flex", alignItems: "center", gap: 12, marginTop: 12 },
  bar: { flex: 1, height: 6, background: C.panel2, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", background: C.brass, borderRadius: 3, transition: "width .3s ease" },
  count: { fontFamily: mono, fontSize: 12, color: C.muted },

  search: { width: "100%", marginTop: 12, background: C.panel, color: C.bone, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 13.5 },
  filters: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  fchip: { fontFamily: mono, fontSize: 10, letterSpacing: 0.3, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.line}`, color: C.muted },
  fchipOn: { borderColor: C.slate, color: C.bone, background: "rgba(110,140,168,0.15)" },
  fchipUrg: { borderColor: C.red, color: C.red },

  list: { display: "flex", flexDirection: "column", gap: 5 },
  group: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, overflow: "hidden" },
  projHead: { display: "flex", alignItems: "center", gap: 9, padding: "12px 10px 12px 12px", minHeight: 50 },
  checkBtn: { flexShrink: 0, display: "grid", placeItems: "center" },
  ring: { width: 22, height: 22, borderRadius: "50%", border: "2px solid", display: "grid", placeItems: "center", fontSize: 12, color: C.green, fontWeight: 700 },
  frac: { fontFamily: mono, fontSize: 11, color: C.brass, flexShrink: 0 },
  iconBtn: { flexShrink: 0, display: "grid", placeItems: "center", width: 20 },
  chev: { fontSize: 20, color: C.muted, transition: "transform .2s ease", lineHeight: 1 },
  del: { flexShrink: 0, color: C.muted, fontSize: 19, width: 22, height: 22, display: "grid", placeItems: "center", lineHeight: 1 },

  subsWrap: { borderTop: `1px solid ${C.line}`, padding: "6px 8px 8px" },
  leafCard: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 10px 8px", marginBottom: 6 },
  leafCardAtom: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, padding: "12px 10px 9px" },
  leafTop: { display: "flex", alignItems: "center", gap: 10 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9, paddingLeft: 32 },

  addSub: { margin: "2px 0 2px 4px", fontFamily: mono, fontSize: 11, color: C.brass, padding: "6px 0" },
  addItem: { width: "100%", marginTop: 12, fontFamily: mono, fontSize: 13, color: C.bone, border: `1px dashed ${C.line}`, borderRadius: 11, padding: "14px" },
};
