"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PHOTO_KINDS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type Photo = {
  id: string; kind: string; url: string; notes: string | null;
  file_name: string | null; created_at: string; storage_path: string;
  report: { id: string; client_name: string; address: string; intervention_date: string; operator: { id: string; full_name: string } | null } | null;
};

export default function PhotoArchiveGrid({ photos, filters }: {
  photos: Photo[];
  filters: { date?: string; operatorId?: string; q?: string };
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = photos.filter((p) => {
    if (filters.date && p.report?.intervention_date !== filters.date) return false;
    if (filters.operatorId && p.report?.operator?.id !== filters.operatorId) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (!p.report?.client_name.toLowerCase().includes(q) && !p.report?.address.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function deletePhoto(photo: Photo) {
    if (!confirm("Eliminare questa foto?")) return;
    setDeleting(photo.id);
    const sbAdm = supabaseBrowser();
    await sbAdm.from("report_photos").delete().eq("id", photo.id);
    await sbAdm.storage.from("report-photos").remove([photo.storage_path]);
    setDeleting(null);
    toast.success("Foto eliminata");
    router.refresh();
  }

  const kindLabel = (k: string) => PHOTO_KINDS.find((x) => x.value === k)?.label ?? k;

  if (!filtered.length) return <div className="card p-6 text-center text-gray-500">Nessuna foto trovata.</div>;

  return (
    <div className="grid grid-cols-2 gap-3">
      {filtered.map((p) => (
        <div key={p.id} className="card overflow-hidden">
          <div className="aspect-square bg-gray-100 relative">
            {p.url && <img src={p.url} alt={kindLabel(p.kind)} className="w-full h-full object-cover" />}
            <span className="absolute top-1 left-1 chip bg-black/60 text-white text-[10px]">{kindLabel(p.kind)}</span>
          </div>
          <div className="p-2 space-y-1">
            <div className="text-xs font-semibold truncate">{p.report?.client_name ?? "—"}</div>
            <div className="text-[10px] text-gray-500">{p.report?.intervention_date ? formatDate(p.report.intervention_date) : "—"}</div>
            <div className="text-[10px] text-gray-500 truncate">{p.report?.operator?.full_name ?? "—"}</div>
            {p.notes && <div className="text-[10px] text-gray-600 italic truncate">{p.notes}</div>}
            <div className="flex gap-1 pt-1">
              {p.report?.id && (
                <Link href={`/reports/${p.report.id}`} className="flex-1 btn-secondary text-[10px] py-1 px-2">
                  <ExternalLink size={10} className="mr-1" />Report
                </Link>
              )}
              {p.url && (
                <a href={p.url} download={p.file_name ?? "foto.jpg"} className="btn-secondary text-[10px] py-1 px-2">
                  <Download size={10} />
                </a>
              )}
              <button onClick={() => deletePhoto(p)} disabled={deleting === p.id}
                className="btn-danger text-[10px] py-1 px-2">
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
