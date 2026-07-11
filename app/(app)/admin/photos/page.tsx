import { requireAdmin } from "@/lib/auth";
import { PHOTO_KINDS } from "@/lib/constants";
import PhotoArchiveGrid from "./PhotoArchiveGrid";

export default async function PhotoArchive({ searchParams }: {
  searchParams: { date?: string; operator?: string; kind?: string; q?: string };
}) {
  const { profile, sb } = await requireAdmin();

  let q = sb
    .from("report_photos")
    .select(`
      id, kind, storage_path, notes, file_name, created_at,
      report:reports!report_photos_report_id_fkey(id, client_name, address, intervention_date, operator:profiles!reports_operator_id_fkey(id, full_name))
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (searchParams.date) {
    // filter by intervention_date of parent report — done client-side for simplicity
  }
  if (searchParams.kind) q = q.eq("kind", searchParams.kind);

  const { data: photos } = await q;
  const { data: operators } = await sb
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id);

  // sign urls
  const photosWithUrl = await Promise.all((photos ?? []).map(async (p) => {
    const { data } = await sb.storage.from("report-photos").createSignedUrl(p.storage_path, 3600);
    return { ...p, url: data?.signedUrl };
  }));

  // client-side filters applied in component
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Archivio Foto</h1>

      <form className="card p-3 grid grid-cols-2 gap-2 text-sm">
        <input type="date" name="date" defaultValue={searchParams.date} className="input" />
        <select name="operator" defaultValue={searchParams.operator || ""} className="input">
          <option value="">Tutti operatori</option>
          {operators?.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </select>
        <select name="kind" defaultValue={searchParams.kind || ""} className="input">
          <option value="">Tutte categorie</option>
          {PHOTO_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <input name="q" placeholder="Cerca cliente…" defaultValue={searchParams.q} className="input" />
        <button className="btn-primary col-span-2">Filtra</button>
      </form>

      <PhotoArchiveGrid
        photos={photosWithUrl as any}
        filters={{
          date: searchParams.date,
          operatorId: searchParams.operator,
          q: searchParams.q
        }}
      />
    </div>
  );
}
