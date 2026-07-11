import { requireAdmin } from "@/lib/auth";
import { PROPERTY_TYPES } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export default async function PropertiesAdmin() {
  const { profile, sb } = await requireAdmin();
  const { data: properties, error: loadError } = await sb
    .from("properties")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("client_name");
  if (loadError) throw new Error(`Caricamento immobili fallito: ${loadError.message}`);

  async function create(fd: FormData) {
    "use server";
    const { profile, sb } = await requireAdmin();
    const { error } = await sb.from("properties").insert({
      company_id: profile.company_id,
      client_name: String(fd.get("client_name") ?? "").trim(),
      address: String(fd.get("address") ?? "").trim(),
      property_type: String(fd.get("property_type") ?? "appartamento"),
      notes: String(fd.get("notes") ?? "") || null
    });
    if (error) throw new Error(`Creazione immobile fallita: ${error.message}`);
    revalidatePath("/admin/properties");
  }

  async function remove(fd: FormData) {
    "use server";
    const { sb } = await requireAdmin();
    const { error } = await sb.from("properties").delete().eq("id", String(fd.get("id")));
    if (error) throw new Error(`Eliminazione immobile fallita: ${error.message}`);
    revalidatePath("/admin/properties");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Immobili / Clienti</h1>
      <form action={create} className="card p-3 space-y-2">
        <input name="client_name" required placeholder="Cliente *" className="input" />
        <input name="address" required placeholder="Indirizzo *" className="input" />
        <select name="property_type" className="input">
          {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <input name="notes" placeholder="Note" className="input" />
        <button className="btn-primary w-full">Aggiungi</button>
      </form>

      <ul className="space-y-2">
        {properties?.map((p) => (
          <li key={p.id} className="card p-3">
            <div className="font-semibold">{p.client_name}</div>
            <div className="text-sm text-gray-600">{p.address}</div>
            <div className="text-xs text-gray-500">{PROPERTY_TYPES.find((x) => x.value === p.property_type)?.label}</div>
            <form action={remove} className="mt-2">
              <input type="hidden" name="id" value={p.id} />
              <button className="text-sm text-red-600">Elimina</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
