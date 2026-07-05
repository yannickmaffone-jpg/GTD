import React, { useState, useEffect, useRef } from "react";

/* ───────────────────────── Palette moderne & pétante ───────────────────────── */
const C = {
  bg: "#F4F5FB", card: "#FFFFFF", card2: "#F2F3FA", line: "#E5E6F1",
  text: "#16172E", muted: "#6B7089", faint: "#9AA0B8", white: "#FFFFFF",
  indigo: "#6366F1", violet: "#8B5CF6", teal: "#0D9488", cyan: "#06B6D4",
  pink: "#DB2777", amber: "#E08A00", orange: "#F97316",
  green: "#10B981", red: "#EF4444",
};

/* Un onglet = une identité couleur (dégradés pétants) */
const TABS = [
  { key: "projet", label: "Projet",   icon: "📁", color: C.indigo, grad: "linear-gradient(135deg,#6366F1,#8B5CF6)" },
  { key: "rapide", label: "Rapide",   icon: "⚡", color: C.teal,   grad: "linear-gradient(135deg,#06B6D4,#0D9488)" },
  { key: "suivre", label: "À suivre", icon: "👀", color: C.pink,   grad: "linear-gradient(135deg,#EC4899,#DB2777)" },
  { key: "inbox",  label: "Inbox",    icon: "📥", color: C.amber,  grad: "linear-gradient(135deg,#F59E0B,#F97316)" },
];
const tabOf = (k) => TABS.find((t) => t.key === k) || TABS[0];

const PORTEURS = ["", "moi", "Assistant", "Comptable", "Avocat", "Agent", "Artisan", "Sarah", "maman", "Maunnia", "Talel"];
const CTX = ["", "Maison", "Bureau", "Ordi", "Nomade", "Dehors"];
const CTX_ICON = { "": "+ lieu", Maison: "🏠 Maison", Bureau: "💼 Bureau", Ordi: "💻 Ordi", Nomade: "🧳 Nomade", Dehors: "🌳 Dehors" };
const MAX = 3; // étoiles & éclairs : 0 à 3

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const leaf = (t, who = "") => ({ id: uid(), t, done: false, who, ctx: "", stars: 0, urgent: 0, quick5: false });

/* ───────────────────────── Données de départ ───────────────────────── */
const SEED = [
  { t: "Greffe", subs: [leaf("Réserver date + vols"), leaf("Réserver la suite en Grèce")] },
  { t: "Gérer le problème Foued", subs: [
    leaf("Aller voir un pénaliste"), leaf("Mettre la double authentification"),
    leaf("Voir combien a été pris sur Formalink"), leaf("Vérifier les mouvements sur B2C")] },
  { t: "Finir la villa + mettre en loc", subs: [
    leaf("Appeler Sarah pour mettre des artisans et terminer", "Sarah"), leaf("Acheter un canapé", "moi")] },
  { t: "Gérer Nova (contrat, factures)", subs: [
    leaf("Faire signer le partenariat", "moi"), leaf("Présenter l'offre d'expert-comptable", "Comptable"), leaf("Former les commerciaux")] },
  { t: "Fermer Didactiz + ADN", subs: [
    leaf("Mise au propre comptable", "Comptable"), leaf("Mise au propre juridique", "Avocat")] },
  { t: "Acheter un canapé", subs: [
    leaf("Définir style + délai"), leaf("Présélectionner 3 modèles", "moi"), leaf("RDV magasins", "moi"), leaf("Suivre la livraison", "maman")] },
  { t: "Vacances de Léna", subs: [leaf("Définir le sport"), leaf("Planning devoirs"), leaf("Réserver les hôtels")] },
  { t: "David", subs: [
    leaf("Remonter mes dividendes", "moi"), leaf("Renflouer Formalink"), leaf("Remboursement Soukaina", "Comptable"), leaf("Récupérer 25 % Majorelle")] },
  { t: "Louer l'appart de Cagnes", subs: [leaf("Appeler Sarah et la laisser faire", "Sarah")] },
  { t: "Calculer la rentabilité du Maroc", subs: [leaf("Récupérer les relevés de toutes les banques")] },
  // tâches rapides isolées
  { t: "Payer les charges CMS", bucket: "rapide", who: "Maunnia" },
  { t: "Récupérer les lunettes", bucket: "rapide", who: "moi", quick5: true },
  { t: "Confirmer le RDV dentiste", bucket: "rapide", quick5: true },
  // inbox (le tout-venant)
  { t: "Idée : newsletter mensuelle", bucket: "inbox" },
  { t: "Regarder la formation Notion", bucket: "inbox" },
];

const buildSeed = () => SEED.map((it) => {
  if (it.subs && it.subs.length)
    return { id: uid(), t: it.t, open: false, kind: "project", subs: it.subs.map((s) => ({ ...s, id: uid() })) };
  return {
    id: uid(), t: it.t, open: false, kind: "task", bucket: it.bucket || "rapide",
    leaf: { ...leaf("", it.who || ""), t: undefined, quick5: !!it.quick5 },
  };
});

/* Migration depuis l'ancienne version (liste-v3) */
const migrate = (old) => old.map((it) => {
  if (it.subs && it.subs.length)
    return { id: it.id, t: it.t, open: false, kind: "project", subs: it.subs.map((s) => ({ quick5: false, ...s })) };
  return {
    id: it.id, t: it.t, open: false, kind: "task", bucket: "rapide",
    leaf: { quick5: false, ...(it.leaf || leaf("")), t: undefined },
  };
});

const KEY = "gtd-v4";
const OLD = "liste-v3";
const PEOPLE_KEY = "gtd-people-v1";

/* ───────────────────────── App ───────────────────────── */
export default function App() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("projet");
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [showF, setShowF] = useState(false);
  const [f, setF] = useState({ who: "", ctx: "", proj: "", urgent: false, stars: false, quick: false });
  const [confirmReset, setConfirmReset] = useState(false);
  const [storedPeople, setStoredPeople] = useState([]);
  const [whoPicker, setWhoPicker] = useState(null); // { current, onPick }
  const [newPerson, setNewPerson] = useState("");

  useEffect(() => {
    const id = "montserrat";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(l);
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
      else { const o = localStorage.getItem(OLD); setItems(o ? migrate(JSON.parse(o)) : buildSeed()); }
    } catch (e) { setItems(buildSeed()); }
    try {
      const rp = localStorage.getItem(PEOPLE_KEY);
      setStoredPeople(rp ? JSON.parse(rp) : PORTEURS.filter((p) => p && p !== "moi"));
    } catch (e) { setStoredPeople(PORTEURS.filter((p) => p && p !== "moi")); }
    setReady(true);
  }, []);

  const persist = (n) => { setItems(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} };
  const persistPeople = (n) => { setStoredPeople(n); try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(n)); } catch (e) {} };
  const addPerson = () => {
    const n = newPerson.trim();
    if (!n || n.toLowerCase() === "moi") { setNewPerson(""); return; }
    if (!storedPeople.some((p) => p.toLowerCase() === n.toLowerCase())) persistPeople([...storedPeople, n]);
    if (whoPicker) { whoPicker.onPick(n); setWhoPicker(null); }
    setNewPerson("");
  };
  const removePerson = (name) => persistPeople(storedPeople.filter((p) => p !== name));
  const updItem = (iid, fn) => persist(items.map((it) => it.id === iid ? fn(it) : it));

  const cycleAttr = (o, key, arr) => {
    if (key === "stars") return { ...o, stars: (o.stars + 1) % (MAX + 1) };
    if (key === "urgent") return { ...o, urgent: (o.urgent + 1) % (MAX + 1) };
    if (key === "quick5") return { ...o, quick5: !o.quick5 };
    return { ...o, [key]: arr[(arr.indexOf(o[key]) + 1) % arr.length] };
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
  const addProject = () => { const it = { id: uid(), t: "Nouveau projet", open: true, kind: "project", subs: [leaf("Première étape")] }; persist([...items, it]); setEditing(it.id); };
  const addTask = (bucket) => { const it = { id: uid(), t: "", open: false, kind: "task", bucket, leaf: leaf("") }; persist([...items, it]); setEditing(it.id); };

  /* triage inbox → ailleurs */
  const toBucket = (iid, bucket) => updItem(iid, (it) => ({ ...it, kind: "task", bucket }));
  const toProject = (iid) => updItem(iid, (it) => ({ id: it.id, t: it.t || "Nouveau projet", open: true, kind: "project", subs: [leaf("Première étape")] }));

  /* ── filtres ── */
  const anyFilter = q.trim() !== "" || f.who || f.ctx || f.proj || f.urgent || f.stars || f.quick;
  const nActive = (q.trim() !== "" ? 1 : 0) + (f.who ? 1 : 0) + (f.ctx ? 1 : 0) + (f.proj ? 1 : 0) + (f.urgent ? 1 : 0) + (f.stars ? 1 : 0) + (f.quick ? 1 : 0);
  const clearFilters = () => { setQ(""); setF({ who: "", ctx: "", proj: "", urgent: false, stars: false, quick: false }); };
  const ql = q.trim().toLowerCase();
  const match = (lf, title, projName) => {
    if (!lf) return false;
    if (ql) { const hay = `${title || ""} ${lf.who || ""} ${projName || ""}`.toLowerCase(); if (!hay.includes(ql)) return false; }
    if (f.ctx && lf.ctx !== f.ctx) return false;
    if (f.who && lf.who !== f.who) return false;
    if (f.urgent && !(lf.urgent > 0)) return false;
    if (f.stars && !(lf.stars > 0)) return false;
    if (f.quick && !lf.quick5) return false;
    return true;
  };

  const projects = items.filter((it) => it.kind === "project");
  const tasks = items.filter((it) => it.kind === "task");

  /* Liste des intervenants : ceux enregistrés + ceux déjà utilisés dans les données */
  const whosInData = new Set();
  items.forEach((it) => {
    if (it.kind === "project") it.subs.forEach((sub) => { if (sub.who && sub.who !== "moi") whosInData.add(sub.who); });
    else if (it.leaf && it.leaf.who && it.leaf.who !== "moi") whosInData.add(it.leaf.who);
  });
  const people = Array.from(new Set([...storedPeople, ...whosInData])).sort((a, b) => a.localeCompare(b, "fr"));

  /* Toutes les tâches "à plat" avec leur contexte projet */
  const flatRows = () => {
    const rows = [];
    for (const it of items) {
      if (it.kind === "project") {
        for (const sub of it.subs) rows.push({ editId: sub.id, title: sub.t, leaf: sub, projId: it.id, projName: it.t, ref: { itemId: it.id, subId: sub.id } });
      } else {
        rows.push({ editId: it.id, title: it.t, leaf: it.leaf, projId: null, projName: null, bucket: it.bucket, ref: { itemId: it.id, subId: null } });
      }
    }
    return rows;
  };

  /* comptage done/total du tab courant */
  const tabLeaves = () => {
    if (tab === "projet") return projects.flatMap((p) => p.subs);
    if (tab === "rapide") return tasks.filter((t) => t.bucket === "rapide").map((t) => t.leaf);
    if (tab === "inbox") return tasks.filter((t) => t.bucket === "inbox").map((t) => t.leaf);
    return flatRows().filter((r) => r.leaf.who && r.leaf.who !== "moi").map((r) => r.leaf);
  };
  const leaves = tabLeaves();
  const nDone = leaves.filter((x) => x && x.done).length;
  const pct = leaves.length ? Math.round((nDone / leaves.length) * 100) : 0;

  const th = tabOf(tab);

  /* callbacks génériques pour une "row" à plat */
  const rowCbs = (row) => ({
    onRename: (v) => row.ref.subId ? updSub(row.ref.itemId, row.ref.subId, (x) => ({ ...x, t: v })) : renameItem(row.ref.itemId, v),
    onToggle: () => row.ref.subId ? updSub(row.ref.itemId, row.ref.subId, (x) => ({ ...x, done: !x.done })) : updAtomicLeaf(row.ref.itemId, (x) => ({ ...x, done: !x.done })),
    onDel: () => row.ref.subId ? delSub(row.ref.itemId, row.ref.subId) : delItem(row.ref.itemId),
    onAttr: (k, arr) => row.ref.subId ? updSub(row.ref.itemId, row.ref.subId, (x) => cycleAttr(x, k, arr)) : updAtomicLeaf(row.ref.itemId, (x) => cycleAttr(x, k, arr)),
    onSetWho: (name) => row.ref.subId ? updSub(row.ref.itemId, row.ref.subId, (x) => ({ ...x, who: name })) : updAtomicLeaf(row.ref.itemId, (x) => ({ ...x, who: name })),
  });

  if (!ready) return <div style={s.root(th)}><style>{css}</style></div>;

  /* ── Carte tâche ── */
  const LeafRow = ({ lf, title, editId, atomic, subLabel, onRename, onToggle, onDel, onAttr, onSetWho }) => (
    <div style={atomic ? s.leafCardAtom : s.leafCard}>
      <div style={s.leafTop}>
        <button onClick={onToggle} style={s.checkBtn}><Box d={lf.done} /></button>
        <Editable id={editId} value={title} editing={editing} setEditing={setEditing} onSave={onRename} done={lf.done} bold={atomic} />
        <button style={s.del} onClick={onDel}>×</button>
      </div>
      <div style={s.chips}>
        <button style={chip(lf.who && lf.who !== "", th)} onClick={() => setWhoPicker({ current: lf.who, onPick: onSetWho })}>
          {lf.who ? (lf.who === "moi" ? "🙋 moi" : `👤 ${lf.who}`) : "+ qui"}
        </button>
        <button style={chip(lf.ctx !== "", th)} onClick={() => onAttr("ctx", CTX)}>{CTX_ICON[lf.ctx]}</button>
        <button style={chip(lf.stars > 0, th)} onClick={() => onAttr("stars", null)}>{lf.stars > 0 ? "★".repeat(lf.stars) : "★ 0"}</button>
        <button style={{ ...chip(lf.urgent > 0, th), color: lf.urgent >= 3 ? C.red : lf.urgent > 0 ? C.amber : C.muted, borderColor: lf.urgent >= 3 ? C.red : lf.urgent > 0 ? C.amber : C.line }}
          onClick={() => onAttr("urgent", null)}>{lf.urgent > 0 ? "⚡".repeat(lf.urgent) : "⚡ 0"}</button>
        <button style={{ ...chip(lf.quick5, th), ...(lf.quick5 ? { borderColor: C.green, color: C.green, background: "rgba(16,185,129,.1)" } : {}) }}
          onClick={() => onAttr("quick5")}>⏱ -5′</button>
      </div>
      {subLabel && <div style={s.projTag}>{subLabel}</div>}
    </div>
  );

  return (
    <div style={s.root(th)}>
      <style>{css}</style>

      {/* En-tête */}
      <div style={s.head}>
        <div style={s.titleRow}>
          <button style={s.brand} onClick={() => { setTab("projet"); clearFilters(); }}>
            <span style={{ ...s.dot, background: th.grad }} />
            <span style={{ ...s.h1, backgroundImage: th.grad }}>{th.icon} {th.label}</span>
          </button>
          <button style={s.reset} onClick={() => { if (confirmReset) { persist(buildSeed()); setConfirmReset(false); clearFilters(); } else { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 2500); } }}>
            {confirmReset ? "Tout réinitialiser ?" : "↺"}
          </button>
        </div>

        {/* Onglets */}
        <div style={s.tabs}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ ...s.tab, ...(on ? { background: t.grad, color: "#fff", boxShadow: `0 4px 14px ${t.color}55` } : {}) }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Progression */}
        <div style={s.progress}>
          <div style={s.bar}><div style={{ ...s.fill, width: `${pct}%`, background: th.grad }} /></div>
          <span style={s.count}>{nDone}/{leaves.length}</span>
        </div>

        {/* Recherche + filtres multicritères */}
        <div style={s.searchRow}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 chercher (tâche, personne, projet…)" style={s.search} />
          <button style={{ ...s.fBtn, ...(showF || nActive ? { borderColor: th.color, color: th.color, background: `${th.color}12` } : {}) }} onClick={() => setShowF(!showF)}>
            ⚙︎ Filtres{nActive ? ` · ${nActive}` : ""}
          </button>
        </div>

        {showF && (
          <div style={s.fPanel}>
            <div style={s.fGrid}>
              <label style={s.fLabel}>Intervenant
                <select value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} style={s.select}>
                  <option value="">Tout le monde</option>
                  <option value="moi">Moi</option>
                  {people.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label style={s.fLabel}>Lieu
                <select value={f.ctx} onChange={(e) => setF({ ...f, ctx: e.target.value })} style={s.select}>
                  <option value="">Tous lieux</option>
                  {CTX.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={s.fLabel}>Projet
                <select value={f.proj} onChange={(e) => setF({ ...f, proj: e.target.value })} style={s.select}>
                  <option value="">Tous les projets</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.t}</option>)}
                </select>
              </label>
            </div>
            <div style={s.fToggles}>
              <button style={{ ...s.tog, ...(f.urgent ? { borderColor: C.red, color: C.red, background: "rgba(239,68,68,.1)" } : {}) }} onClick={() => setF({ ...f, urgent: !f.urgent })}>⚡ Urgent</button>
              <button style={{ ...s.tog, ...(f.stars ? { borderColor: C.amber, color: C.amber, background: "rgba(224,138,0,.1)" } : {}) }} onClick={() => setF({ ...f, stars: !f.stars })}>★ Important</button>
              <button style={{ ...s.tog, ...(f.quick ? { borderColor: C.green, color: C.green, background: "rgba(16,185,129,.1)" } : {}) }} onClick={() => setF({ ...f, quick: !f.quick })}>⏱ -5′</button>
              {nActive > 0 && <button style={s.clear} onClick={clearFilters}>✕ Tout effacer</button>}
            </div>
          </div>
        )}
        {!showF && nActive > 0 && (
          <div style={s.activeRow}><span style={s.activeTxt}>{nActive} filtre{nActive > 1 ? "s" : ""} actif{nActive > 1 ? "s" : ""}</span><button style={s.clearSm} onClick={clearFilters}>✕ effacer</button></div>
        )}
      </div>

      {/* ───────────── Contenu ───────────── */}
      <div style={s.list}>

        {/* PROJET */}
        {tab === "projet" && projects.map((it) => {
          const rows = it.subs.map((sub) => ({ sub, ok: match(sub, sub.t, it.t) }));
          const projMatch = !f.proj || f.proj === it.id;
          const shown = anyFilter ? rows.filter((r) => r.ok && projMatch) : rows;
          if (anyFilter && shown.length === 0) return null;
          const done = it.subs.filter((x) => x.done).length;
          const isOpen = anyFilter ? true : it.open;
          return (
            <div key={it.id} style={s.group}>
              <div style={s.projHead}>
                <button onClick={() => toggleOpen(it.id)} style={s.checkBtn}>
                  <span style={{ ...s.ring, borderColor: done === it.subs.length && it.subs.length ? C.green : done > 0 ? th.color : C.line }}>
                    {done === it.subs.length && it.subs.length ? "✓" : ""}</span>
                </button>
                <Editable id={it.id} value={it.t} editing={editing} setEditing={setEditing} onSave={(v) => renameItem(it.id, v)} bold done={false} />
                <span style={{ ...s.frac, color: th.color }}>{done}/{it.subs.length}</span>
                <button style={s.iconBtn} onClick={() => toggleOpen(it.id)}><span style={{ ...s.chev, transform: isOpen ? "rotate(90deg)" : "none" }}>›</span></button>
                <button style={s.del} onClick={() => delItem(it.id)}>×</button>
              </div>
              {isOpen && (
                <div style={s.subsWrap}>
                  {shown.map(({ sub }) => (
                    <LeafRow key={sub.id} lf={sub} title={sub.t} editId={sub.id}
                      onRename={(v) => updSub(it.id, sub.id, (x) => ({ ...x, t: v }))}
                      onToggle={() => updSub(it.id, sub.id, (x) => ({ ...x, done: !x.done }))}
                      onDel={() => delSub(it.id, sub.id)}
                      onAttr={(k, arr) => updSub(it.id, sub.id, (x) => cycleAttr(x, k, arr))}
                      onSetWho={(name) => updSub(it.id, sub.id, (x) => ({ ...x, who: name }))} />
                  ))}
                  {!anyFilter && <button style={{ ...s.addSub, color: th.color }} onClick={() => addSub(it.id)}>+ sous-tâche</button>}
                </div>
              )}
            </div>
          );
        })}
        {tab === "projet" && projects.length === 0 && <Empty t="Aucun projet. Ajoute-en un ci-dessous." />}

        {/* RAPIDE */}
        {tab === "rapide" && (() => {
          const rows = flatRows().filter((r) => r.bucket === "rapide").filter((r) => !anyFilter || (match(r.leaf, r.title) && !f.proj));
          if (rows.length === 0) return <Empty t={anyFilter ? "Aucune tâche rapide ne correspond." : "Aucune tâche rapide."} />;
          return rows.map((row) => (
            <LeafRow key={row.editId} lf={row.leaf} title={row.title} editId={row.editId} atomic subLabel="· tâche isolée" {...rowCbs(row)} />
          ));
        })()}

        {/* À SUIVRE (délégué à qqn ≠ moi) */}
        {tab === "suivre" && (() => {
          const rows = flatRows()
            .filter((r) => r.leaf.who && r.leaf.who !== "moi")
            .filter((r) => !anyFilter || (match(r.leaf, r.title, r.projName) && (!f.proj || r.projId === f.proj)));
          if (rows.length === 0) return <Empty t={anyFilter ? "Rien à suivre pour ces critères." : "Rien de délégué pour l'instant."} />;
          return rows.map((row) => (
            <LeafRow key={row.editId} lf={row.leaf} title={row.title} editId={row.editId} atomic
              subLabel={row.projName ? `📁 ${row.projName}` : "· tâche isolée"} {...rowCbs(row)} />
          ));
        })()}

        {/* INBOX */}
        {tab === "inbox" && (() => {
          const rows = flatRows().filter((r) => r.bucket === "inbox").filter((r) => !anyFilter || (match(r.leaf, r.title) && !f.proj));
          if (rows.length === 0) return <Empty t={anyFilter ? "Aucune note pour ces critères." : "Inbox vide. Balance tes idées ici 👇"} />;
          return rows.map((row) => (
            <div key={row.editId}>
              <LeafRow lf={row.leaf} title={row.title} editId={row.editId} atomic {...rowCbs(row)} />
              <div style={s.triage}>
                <span style={s.triageLbl}>Trier →</span>
                <button style={s.triBtn} onClick={() => toBucket(row.ref.itemId, "rapide")}>⚡ Rapide</button>
                <button style={s.triBtn} onClick={() => toProject(row.ref.itemId)}>📁 Projet</button>
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Bouton d'ajout selon l'onglet */}
      {tab === "projet" && <button style={{ ...s.addItem, borderColor: th.color, color: th.color }} onClick={addProject}>+ Ajouter un projet</button>}
      {tab === "rapide" && <button style={{ ...s.addItem, borderColor: th.color, color: th.color }} onClick={() => addTask("rapide")}>+ Ajouter une tâche rapide</button>}
      {tab === "inbox"  && <button style={{ ...s.addItem, borderColor: th.color, color: th.color }} onClick={() => addTask("inbox")}>+ Nouvelle note / idée</button>}
      {tab === "suivre" && <div style={s.hint}>Cet onglet regroupe automatiquement tout ce qui est délégué à quelqu'un d'autre que toi.</div>}

      {/* Sélecteur d'intervenant */}
      {whoPicker && (
        <div style={s.overlay} onClick={() => { setWhoPicker(null); setNewPerson(""); }}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalTitle}>Qui s'en occupe ?</div>
            <div style={s.peopleGrid}>
              <button style={pill(whoPicker.current === "moi")} onClick={() => { whoPicker.onPick("moi"); setWhoPicker(null); }}>🙋 moi</button>
              {people.map((p) => (
                <span key={p} style={s.peopleItem}>
                  <button style={pill(whoPicker.current === p)} onClick={() => { whoPicker.onPick(p); setWhoPicker(null); }}>👤 {p}</button>
                  {storedPeople.includes(p) && <button style={s.pRemove} title="Supprimer de la liste" onClick={() => removePerson(p)}>×</button>}
                </span>
              ))}
            </div>
            <div style={s.addPerson}>
              <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Nouvel intervenant…" style={s.pInput}
                onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }} autoFocus />
              <button style={{ ...s.pAdd, background: th.grad }} onClick={addPerson}>Ajouter</button>
            </div>
            <div style={s.modalActions}>
              <button style={s.mClear} onClick={() => { whoPicker.onPick(""); setWhoPicker(null); }}>Personne / effacer</button>
              <button style={s.mClose} onClick={() => { setWhoPicker(null); setNewPerson(""); }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Petits composants ───────────────────────── */
const Empty = ({ t }) => <div style={s.empty}>{t}</div>;

function Editable({ id, value, editing, setEditing, onSave, done, bold }) {
  const ref = useRef(null);
  const isEd = editing === id;
  useEffect(() => { if (isEd && ref.current) { ref.current.focus(); ref.current.select(); } }, [isEd]);
  if (isEd) return (
    <input ref={ref} defaultValue={value} style={{ ...st.input, fontWeight: bold ? 700 : 500 }}
      onBlur={(e) => { onSave(e.target.value.trim() || value); setEditing(null); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
  );
  return (
    <span onClick={() => setEditing(id)} style={{ ...st.txt, fontWeight: bold ? 700 : 500,
      color: done ? C.faint : C.text, textDecoration: done ? "line-through" : "none" }}>{value || <em style={{ color: C.faint }}>sans titre…</em>}</span>
  );
}

const Box = ({ d }) => (
  <span style={{ ...st.box, borderColor: d ? C.green : C.line, background: d ? C.green : "transparent" }}>{d ? "✓" : ""}</span>
);

/* ───────────────────────── Styles ───────────────────────── */
const font = "'Montserrat', system-ui, -apple-system, sans-serif";
const css = `
*{box-sizing:border-box}
html,body{margin:0}
button{font-family:inherit;cursor:pointer;background:none;border:none;padding:0;color:inherit}
input,select{font-family:inherit;outline:none}
input::placeholder{color:#9AA0B8;opacity:1}
select{-webkit-appearance:none;appearance:none}
button:focus-visible,input:focus,select:focus{outline:2px solid #6366F1;outline-offset:1px}
`;

const chip = (on, th) => ({
  fontFamily: font, fontSize: 11, fontWeight: 600, letterSpacing: 0.2, padding: "5px 10px", borderRadius: 999,
  border: `1.5px solid ${on ? th.color : C.line}`, color: on ? th.color : C.muted,
  background: on ? `${th.color}12` : C.card, whiteSpace: "nowrap",
});

const pill = (on) => ({
  fontFamily: font, fontSize: 13, fontWeight: 700, padding: "9px 13px", borderRadius: 999,
  border: `1.5px solid ${on ? C.indigo : C.line}`, color: on ? C.indigo : C.text,
  background: on ? `${C.indigo}14` : C.card2, whiteSpace: "nowrap",
});

const st = {
  txt: { flex: 1, fontSize: 14.5, lineHeight: 1.3, minWidth: 0, wordBreak: "break-word" },
  input: { flex: 1, background: C.white, color: C.text, border: `1.5px solid ${C.indigo}`, borderRadius: 8, padding: "6px 9px", minWidth: 0, fontSize: 14.5 },
  box: { width: 22, height: 22, borderRadius: 7, border: "2px solid", display: "grid", placeItems: "center", fontSize: 12, color: "#fff", fontWeight: 800, flexShrink: 0 },
};

const s = {
  root: (th) => ({ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: font, padding: "18px 12px 70px", maxWidth: 540, margin: "0 auto" }),
  head: { marginBottom: 14 },
  titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  brand: { display: "flex", alignItems: "center", gap: 9 },
  dot: { width: 12, height: 12, borderRadius: 4 },
  h1: { fontSize: 26, fontWeight: 800, letterSpacing: -0.5, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" },
  reset: { fontSize: 15, color: C.muted, border: `1.5px solid ${C.line}`, background: C.card, borderRadius: 10, padding: "6px 11px", fontWeight: 700 },

  tabs: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, background: C.card, padding: 5, borderRadius: 14, border: `1px solid ${C.line}` },
  tab: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 2px", borderRadius: 10, fontSize: 11.5, fontWeight: 700, color: C.muted, transition: "all .15s ease" },

  progress: { display: "flex", alignItems: "center", gap: 12, marginTop: 14 },
  bar: { flex: 1, height: 8, background: C.card2, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5, transition: "width .35s ease" },
  count: { fontSize: 12.5, fontWeight: 700, color: C.muted },

  searchRow: { display: "flex", gap: 8, marginTop: 12 },
  search: { flex: 1, background: C.card, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "11px 13px", fontSize: 14, fontWeight: 500 },
  fBtn: { flexShrink: 0, fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${C.line}`, background: C.card, color: C.muted, borderRadius: 11, padding: "0 13px" },

  fPanel: { marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12 },
  fGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  fLabel: { display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.3, textTransform: "uppercase" },
  select: { background: C.card2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "9px 10px", fontSize: 13.5, fontWeight: 600 },
  fToggles: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 },
  tog: { fontSize: 12, fontWeight: 700, border: `1.5px solid ${C.line}`, background: C.card2, color: C.muted, borderRadius: 999, padding: "7px 13px" },
  clear: { fontSize: 12, fontWeight: 700, color: C.red, marginLeft: "auto", padding: "7px 6px" },

  activeRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 9, paddingLeft: 2 },
  activeTxt: { fontSize: 12, fontWeight: 600, color: C.muted },
  clearSm: { fontSize: 12, fontWeight: 700, color: C.red },

  list: { display: "flex", flexDirection: "column", gap: 8 },
  group: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(20,22,50,.04)" },
  projHead: { display: "flex", alignItems: "center", gap: 10, padding: "13px 11px 13px 13px", minHeight: 52 },
  checkBtn: { flexShrink: 0, display: "grid", placeItems: "center" },
  ring: { width: 23, height: 23, borderRadius: "50%", border: "2.5px solid", display: "grid", placeItems: "center", fontSize: 12, color: C.green, fontWeight: 800 },
  frac: { fontSize: 12, fontWeight: 800, flexShrink: 0 },
  iconBtn: { flexShrink: 0, display: "grid", placeItems: "center", width: 20 },
  chev: { fontSize: 22, color: C.muted, transition: "transform .2s ease", lineHeight: 1 },
  del: { flexShrink: 0, color: C.faint, fontSize: 21, width: 24, height: 24, display: "grid", placeItems: "center", lineHeight: 1 },

  subsWrap: { borderTop: `1px solid ${C.line}`, padding: "8px 9px 9px", background: C.card2 },
  leafCard: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 11px 9px", marginBottom: 7 },
  leafCardAtom: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "13px 12px 10px", boxShadow: "0 1px 3px rgba(20,22,50,.04)" },
  leafTop: { display: "flex", alignItems: "center", gap: 11 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingLeft: 33 },
  projTag: { marginTop: 8, paddingLeft: 33, fontSize: 11.5, fontWeight: 600, color: C.faint },

  triage: { display: "flex", alignItems: "center", gap: 7, margin: "-2px 0 8px 12px" },
  triageLbl: { fontSize: 11, fontWeight: 700, color: C.faint },
  triBtn: { fontSize: 11.5, fontWeight: 700, color: C.muted, border: `1.5px solid ${C.line}`, background: C.card, borderRadius: 999, padding: "5px 11px" },

  addSub: { margin: "3px 0 3px 4px", fontSize: 12.5, fontWeight: 700, padding: "6px 0" },
  addItem: { width: "100%", marginTop: 14, fontSize: 14, fontWeight: 700, border: `2px dashed`, borderRadius: 16, padding: "15px", background: C.card },
  hint: { marginTop: 14, fontSize: 12.5, fontWeight: 500, color: C.muted, textAlign: "center", lineHeight: 1.5, padding: "0 20px" },
  empty: { textAlign: "center", color: C.faint, fontSize: 13.5, fontWeight: 500, padding: "40px 20px", lineHeight: 1.5 },

  overlay: { position: "fixed", inset: 0, background: "rgba(16,17,40,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 12 },
  modal: { width: "100%", maxWidth: 460, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 20, padding: 18, boxShadow: "0 -8px 40px rgba(16,17,40,.25)" },
  modalTitle: { fontSize: 16, fontWeight: 800, marginBottom: 14, color: C.text },
  peopleGrid: { display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" },
  peopleItem: { display: "inline-flex", alignItems: "center", gap: 3 },
  pRemove: { color: C.faint, fontSize: 17, width: 20, height: 20, display: "grid", placeItems: "center", lineHeight: 1 },
  addPerson: { display: "flex", gap: 8, marginTop: 16 },
  pInput: { flex: 1, background: C.card, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "11px 13px", fontSize: 14, fontWeight: 600 },
  pAdd: { flexShrink: 0, color: "#fff", fontSize: 13.5, fontWeight: 800, borderRadius: 11, padding: "0 18px" },
  modalActions: { display: "flex", justifyContent: "space-between", marginTop: 16 },
  mClear: { fontSize: 13, fontWeight: 700, color: C.red },
  mClose: { fontSize: 13, fontWeight: 700, color: C.muted },
};
