"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ANOMALY_CODES, PROPERTY_TYPES } from "@/lib/constants";
import { calcTotalHours } from "@/lib/utils";
import CollapsibleSection from "@/components/CollapsibleSection";
import SignaturePad from "@/components/SignaturePad";
import PhotoUpload from "@/components/PhotoUpload";
import type { Report } from "@/lib/database.types";
import type { PhotoKind, PropertyType } from "@/lib/constants";

type Task = { id: string; section: string; label: string; done: boolean; sort_order: number };
type Anomaly = { id: string; code: string; detail: string | null };
type Photo = { id: string; kind: PhotoKind; storage_path: string; notes?: string | null; previewUrl?: string };
type Signature = { id: string; kind: "operator" | "client"; data_url: string };

export default function ReportEditor(props: {
  report: Report;
  tasks: Task[];
  anomalies: Anomaly[];
  photos: Photo[];
  signatures: Signature[];
  properties: Pick<import("@/lib/database.types").Property, "id" | "client_name" | "address" | "property_type">[];
  companyId: string;
  operatorId: string;
}) {
  const router = useRouter();
  const sb = supabaseBrowser();

  const [form, setForm] = useState({
    client_name: props.report.client_name || "",
    address: props.report.address || "",
    property_type: props.report.property_type || "appartamento",
    intervention_date: props.report.intervention_date,
    time_in: props.report.time_in?.slice(0, 5) || "",
    time_out: props.report.time_out?.slice(0, 5) || "",
    break_minutes: props.report.break_minutes ?? 0,
    notes: props.report.notes || "",
    external_video_link: props.report.external_video_link || "",
    external_video_description: props.report.external_video_description || "",
    property_id: props.report.property_id || ""
  });
  const [wantsPhotos, setWantsPhotos] = useState<"yes" | "no" | null>(
    props.photos.length > 0 ? "yes" : null
  );
  const [wantsVideo, setWantsVideo] = useState(!!props.report.external_video_link);
  const [tasks, setTasks] = useState<Task[]>(props.tasks);
  const [anomalies, setAnomalies] = useState<Set<string>>(new Set(props.anomalies.map((a) => a.code)));
  const [anomalyDetail, setAnomalyDetail] = useState(props.anomalies.find((a) => a.code === "altro")?.detail || "");
  const [opSig, setOpSig] = useState<string | null>(props.signatures.find((s) => s.kind === "operator")?.data_url || null);
  const [clientSig, setClientSig] = useState<string | null>(props.signatures.find((s) => s.kind === "client")?.data_url || null);

  const totalHours = useMemo(
    () => calcTotalHours(form.time_in, form.time_out, Number(form.break_minutes) || 0),
    [form.time_in, form.time_out, form.break_minutes]
  );

  const completion = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
  }, [tasks]);

  const sections = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!map.has(t.section)) map.set(t.section, []);
      map.get(t.section)!.push(t);
    });
    return Array.from(map.entries());
  }, [tasks]);

  const savingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Restore offline draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`draft-${props.report.id}`);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.form) setForm(draft.form);
      if (draft.tasks) setTasks(draft.tasks);
      if (draft.anomalies) setAnomalies(new Set(draft.anomalies));
      if (draft.anomalyDetail !== undefined) setAnomalyDetail(draft.anomalyDetail);
      if (draft.opSig !== undefined) setOpSig(draft.opSig);
      if (draft.clientSig !== undefined) setClientSig(draft.clientSig);
      toast.success("Bozza offline ripristinata");
      localStorage.removeItem(`draft-${props.report.id}`);
    } catch { /* ignore corrupt draft */ }
  }, [props.report.id]);

  // Use refs so save() always reads the latest state without stale closures
  const formRef = useRef(form);
  formRef.current = form;
  const anomaliesRef = useRef(anomalies);
  anomaliesRef.current = anomalies;
  const anomalyDetailRef = useRef(anomalyDetail);
  anomalyDetailRef.current = anomalyDetail;

  function validateVideoUrl(url: string): boolean {
    if (!url) return true;
    try { new URL(url); return true; } catch { return false; }
  }

  function saveOfflineDraft() {
    const f = formRef.current;
    const a = anomaliesRef.current;
    const ad = anomalyDetailRef.current;
    try {
      localStorage.setItem(`draft-${props.report.id}`, JSON.stringify({
        form: f, tasks,
        anomalies: Array.from(a), anomalyDetail: ad,
        opSig, clientSig
      }));
    } catch { /* storage full */ }
  }

  async function save(showToast = true) {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const f = formRef.current;
      const a = anomaliesRef.current;
      const ad = anomalyDetailRef.current;
      const h = calcTotalHours(f.time_in, f.time_out, Number(f.break_minutes) || 0);

      if (f.external_video_link && !validateVideoUrl(f.external_video_link)) {
        if (showToast) toast.error("URL video non valido");
        return;
      }

      if (!online) {
        saveOfflineDraft();
        if (showToast) toast.success("Bozza salvata offline");
        return;
      }

      const payload = {
        ...f,
        total_hours: h,
        time_out: f.time_out || null,
        external_video_link: f.external_video_link || null,
        external_video_description: f.external_video_description || null
      };
      const { error } = await sb.from("reports").update(payload).eq("id", props.report.id);
      if (error) return toast.error(error.message);

      const { error: deleteAnomaliesError } = await sb.from("report_anomalies").delete().eq("report_id", props.report.id);
      if (deleteAnomaliesError) throw deleteAnomaliesError;
      if (a.size) {
        const { error: insertAnomaliesError } = await sb.from("report_anomalies").insert(
          Array.from(a).map((code) => ({
            report_id: props.report.id,
            code,
            detail: code === "altro" ? ad : null
          }))
        );
        if (insertAnomaliesError) throw insertAnomaliesError;
      }
      if (showToast) toast.success("Salvato");
    } finally {
      savingRef.current = false;
    }
  }

  const saveRef = useRef(save);
  saveRef.current = save;

  // Debounced auto-save: resets timer on every change, saves 4s after the last one
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { saveRef.current(false); }, 4000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [form, anomalies, anomalyDetail]);

  async function toggleTask(t: Task) {
    const next = !t.done;
    const { error } = await sb.from("report_tasks").update({ done: next }).eq("id", t.id);
    if (error) return toast.error(`Attività non aggiornata: ${error.message}`);
    setTasks((arr) => arr.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
  }

  async function saveSignature(kind: "operator" | "client", dataUrl: string | null) {
    const { error: deleteError } = await sb.from("report_signatures").delete().eq("report_id", props.report.id).eq("kind", kind);
    if (deleteError) return toast.error(`Firma non aggiornata: ${deleteError.message}`);
    if (dataUrl) {
      const { error: insertError } = await sb.from("report_signatures").insert({ report_id: props.report.id, kind, data_url: dataUrl });
      if (insertError) return toast.error(`Firma non salvata: ${insertError.message}`);
    }
    if (kind === "operator") setOpSig(dataUrl);
    else setClientSig(dataUrl);
  }

  function onPickProperty(id: string) {
    const p = props.properties.find((x) => x.id === id);
    if (!p) return setForm((f) => ({ ...f, property_id: "" }));
    setForm((f) => ({
      ...f, property_id: id, client_name: p.client_name, address: p.address, property_type: p.property_type
    }));
  }

  const completedRef = useRef(false);

  async function waitForSave(): Promise<void> {
    if (!savingRef.current) return;
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!savingRef.current) { clearInterval(check); resolve(); }
      }, 100);
    });
  }

  async function complete() {
    if (completedRef.current) return;
    const f = formRef.current;
    if (!f.client_name || !f.address || !f.time_in) {
      return toast.error("Compila cliente, indirizzo e orario entrata");
    }
    if (!f.time_out) return toast.error("Inserisci orario uscita");
    if (totalHours <= 0) return toast.error("Orario uscita precedente all'entrata");
    if (!opSig) return toast.error("Manca la firma operatore");
    if (f.external_video_link && !validateVideoUrl(f.external_video_link)) {
      return toast.error("URL video non valido");
    }
    if (!online) {
      saveOfflineDraft();
      toast.success("Completamento salvato offline — sincronizza quando torni online");
      return;
    }
    await waitForSave();
    await save(false);
    const { error } = await sb.from("reports")
      .update({ status: "completato", time_out: f.time_out || null })
      .eq("id", props.report.id);
    if (error) return toast.error(error.message);
    completedRef.current = true;
    toast.success("Report completato");
    router.push(`/reports/${props.report.id}`);
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Dati intervento */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Dati intervento</h2>
          {form.time_in && form.time_out && (
            <span className="text-sm font-medium text-brand-700">{totalHours} h totali</span>
          )}
        </div>
        {props.properties.length > 0 && (
          <div>
            <label className="label">Cliente esistente (opzionale)</label>
            <select className="input" value={form.property_id} onChange={(e) => onPickProperty(e.target.value)}>
              <option value="">— Nessuno —</option>
              {props.properties.map((p) => (
                <option key={p.id} value={p.id}>{p.client_name} · {p.address}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Cliente/struttura *</label>
          <input className="input" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Indirizzo *</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Tipologia immobile</label>
          <select className="input" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value as PropertyType })}>
            {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={form.intervention_date}
              onChange={(e) => setForm({ ...form, intervention_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Pausa (min)</label>
            <input type="number" min={0} className="input" value={form.break_minutes}
              onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Entrata *</label>
            <input type="time" className="input" value={form.time_in}
              onChange={(e) => setForm({ ...form, time_in: e.target.value })} />
          </div>
          <div>
            <label className="label">Uscita *</label>
            <input type="time" className="input" value={form.time_out}
              onChange={(e) => setForm({ ...form, time_out: e.target.value })} />
          </div>
        </div>
        {form.time_in && form.time_out && totalHours <= 0 && (
          <p className="text-sm text-red-600">⚠ Uscita precedente all&apos;entrata</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Checklist attività</h2>
          <span className="text-sm font-medium text-gray-600">{completion}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${completion}%` }} />
        </div>
      </div>

      {sections.map(([section, items]) => {
        const done = items.filter((i) => i.done).length;
        return (
          <CollapsibleSection key={section} title={section} count={`${done}/${items.length}`}>
            {items.map((t) => (
              <label key={t.id} className="flex items-center gap-3 py-2.5 px-1 rounded-lg active:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-brand-600 flex-shrink-0"
                  checked={t.done} onChange={() => toggleTask(t)} />
                <span className={t.done ? "line-through text-gray-400" : ""}>{t.label}</span>
              </label>
            ))}
          </CollapsibleSection>
        );
      })}

      <CollapsibleSection title="Anomalie" count={anomalies.size ? String(anomalies.size) : undefined}>
        {ANOMALY_CODES.map((a) => (
          <label key={a.code} className="flex items-center gap-3 py-2.5 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-brand-600 flex-shrink-0"
              checked={anomalies.has(a.code)}
              onChange={(e) => {
                const next = new Set(anomalies);
                if (e.target.checked) {
                  if (a.code === "none") { next.clear(); next.add("none"); }
                  else { next.delete("none"); next.add(a.code); }
                } else next.delete(a.code);
                setAnomalies(next);
              }} />
            <span>{a.label}</span>
          </label>
        ))}
        {anomalies.has("altro") && (
          <input className="input mt-2" placeholder="Descrivi anomalia…"
            value={anomalyDetail} onChange={(e) => setAnomalyDetail(e.target.value)} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Note operative">
        <textarea className="input" rows={4} placeholder="Note per il responsabile…"
          value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </CollapsibleSection>

      {/* Foto */}
      <CollapsibleSection title="Foto">
        <div className="space-y-3">
          {wantsPhotos === null && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Vuoi allegare foto al report?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWantsPhotos("no")} className="btn-secondary">No, nessuna foto</button>
                <button type="button" onClick={() => setWantsPhotos("yes")} className="btn-primary">Sì, allega foto</button>
              </div>
            </div>
          )}
          {wantsPhotos === "no" && (
            <div className="text-sm text-gray-500 text-center py-2">
              Nessuna foto allegata al report.
              <button type="button" onClick={() => setWantsPhotos("yes")} className="ml-2 text-brand-700 underline">Cambia</button>
            </div>
          )}
          {wantsPhotos === "yes" && (
            <PhotoUpload
              reportId={props.report.id}
              companyId={props.companyId}
              operatorId={props.operatorId}
              initial={props.photos}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Link video */}
      <CollapsibleSection title="Link video documentazione">
        <div className="space-y-3">
          {!wantsVideo ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Vuoi aggiungere un link video?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => {}} className="btn-secondary opacity-50">No</button>
                <button type="button" onClick={() => setWantsVideo(true)} className="btn-primary">Sì</button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Link video (Google Drive, iCloud, Dropbox…)</label>
                <input className="input" type="url" value={form.external_video_link}
                  onChange={(e) => setForm({ ...form, external_video_link: e.target.value })}
                  placeholder="https://drive.google.com/..." />
                {form.external_video_link && !validateVideoUrl(form.external_video_link) && (
                  <p className="text-xs text-red-600 mt-1">URL non valido</p>
                )}
              </div>
              <div>
                <label className="label">Descrizione video (opzionale)</label>
                <input className="input" value={form.external_video_description}
                  onChange={(e) => setForm({ ...form, external_video_description: e.target.value })}
                  placeholder="Es. video panoramica appartamento" />
              </div>
              <button type="button" onClick={() => { setWantsVideo(false); setForm((f) => ({ ...f, external_video_link: "", external_video_description: "" })); }}
                className="text-sm text-gray-500 underline">Rimuovi link video</button>
            </>
          )}
        </div>
      </CollapsibleSection>

      <SignaturePad label="Firma operatore *" initial={opSig} onChange={(d) => saveSignature("operator", d)} />
      <SignaturePad label="Firma cliente (opzionale)" initial={clientSig} onChange={(d) => saveSignature("client", d)} />

      <div className="sticky bottom-20 grid grid-cols-2 gap-2 bg-gray-50/80 backdrop-blur pt-2">
        <button onClick={() => save()} className="btn-secondary">Salva bozza</button>
        <button onClick={complete} className="btn-primary">Completa ✓</button>
      </div>
    </div>
  );
}
