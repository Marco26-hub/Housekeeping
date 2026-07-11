"use client";
import { useState } from "react";
import imageCompression from "browser-image-compression";
import { supabaseBrowser } from "@/lib/supabase/client";
import { X, ImagePlus, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { PHOTO_KINDS, PhotoKind } from "@/lib/constants";

const MAX_PHOTOS = 10;

export type UploadedPhoto = {
  id?: string;
  storage_path: string;
  kind: PhotoKind;
  notes?: string | null;
  previewUrl?: string;
};

export default function PhotoUpload({
  reportId,
  companyId,
  initial = [],
  operatorId
}: {
  reportId: string;
  companyId: string;
  initial?: UploadedPhoto[];
  operatorId: string;
}) {
  const sb = supabaseBrowser();
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial);
  const [busy, setBusy] = useState(false);
  const [selectedKind, setSelectedKind] = useState<PhotoKind>("after");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      return toast.error(`Massimo ${MAX_PHOTOS} foto per report`);
    }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true
        });
        const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        const path = `${companyId}/reports/${reportId}/photos/${Date.now()}-${safeName}`;
        const { error } = await sb.storage.from("report-photos").upload(path, compressed, { upsert: false });
        if (error) throw error;
        const { data: row, error: insErr } = await sb.from("report_photos").insert({
          report_id: reportId,
          kind: selectedKind,
          storage_path: path,
          file_name: safeName,
          file_size: compressed.size,
          operator_id: operatorId
        }).select("id, storage_path, kind, notes").single();
        if (insErr) {
          await sb.storage.from("report-photos").remove([path]);
          throw insErr;
        }
        const { data: signed, error: signError } = await sb.storage.from("report-photos").createSignedUrl(path, 3600);
        if (signError) throw signError;
        setPhotos((p) => [...p, { ...row, previewUrl: signed?.signedUrl }]);
      }
      toast.success("Foto caricate");
    } catch (e: any) {
      toast.error(e.message || "Errore upload");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: UploadedPhoto) {
    if (!p.id) return;
    const { error: storageError } = await sb.storage.from("report-photos").remove([p.storage_path]);
    if (storageError) return toast.error(`Foto non eliminata: ${storageError.message}`);
    const { error: rowError } = await sb.from("report_photos").delete().eq("id", p.id);
    if (rowError) return toast.error(`Archivio non aggiornato: ${rowError.message}`);
    setPhotos((arr) => arr.filter((x) => x.id !== p.id));
    toast.success("Foto eliminata");
  }

  async function saveNote(p: UploadedPhoto, note: string) {
    if (!p.id) return;
    const { error } = await sb.from("report_photos").update({ notes: note || null }).eq("id", p.id);
    if (error) return toast.error(`Nota non salvata: ${error.message}`);
    setPhotos((arr) => arr.map((x) => x.id === p.id ? { ...x, notes: note || null } : x));
    setEditingNoteId(null);
  }

  const total = photos.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{total}/{MAX_PHOTOS} foto</div>
      </div>

      <div>
        <label className="label">Categoria foto</label>
        <select className="input" value={selectedKind} onChange={(e) => setSelectedKind(e.target.value as PhotoKind)}>
          {PHOTO_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>

      <label className={`btn-secondary w-full cursor-pointer ${busy || total >= MAX_PHOTOS ? "opacity-50 cursor-not-allowed" : ""}`}>
        <ImagePlus size={18} className="mr-2" />
        {busy ? "Caricamento…" : `Aggiungi foto — ${PHOTO_KINDS.find(k => k.value === selectedKind)?.label}`}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
          multiple hidden disabled={busy || total >= MAX_PHOTOS}
          onChange={(e) => handleFiles(e.target.files)} />
      </label>

      {PHOTO_KINDS.map((kind) => {
        const items = photos.filter((p) => p.kind === kind.value);
        if (!items.length) return null;
        return (
          <div key={kind.value}>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{kind.label}</div>
            <div className="grid grid-cols-3 gap-2">
              {items.map((p, i) => (
                <div key={p.id ?? i} className="space-y-1">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {p.previewUrl && <img src={p.previewUrl} alt={kind.label} className="w-full h-full object-cover" />}
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button type="button"
                        onClick={() => { setEditingNoteId(p.id ?? null); setNoteText(p.notes ?? ""); }}
                        className="bg-black/60 text-white rounded-full p-1">
                        <MessageSquare size={10} />
                      </button>
                      <button type="button" onClick={() => remove(p)}
                        className="bg-black/60 text-white rounded-full p-1">
                        <X size={10} />
                      </button>
                    </div>
                    {p.notes && <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">{p.notes}</div>}
                  </div>
                  {editingNoteId === p.id && (
                    <div className="flex gap-1">
                      <input autoFocus className="input text-xs py-1 flex-1" value={noteText}
                        onChange={(e) => setNoteText(e.target.value)} placeholder="Nota foto…" />
                      <button type="button" onClick={() => saveNote(p, noteText)}
                        className="btn-primary text-xs px-2 py-1">OK</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
