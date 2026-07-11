import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function TemplatesAdmin() {
  const { profile, sb } = await requireAdmin();
  const { data: templates, error: loadError } = await sb
    .from("report_templates")
    .select("id, name, description, is_default, template_tasks(count)")
    .eq("company_id", profile.company_id)
    .order("is_default", { ascending: false });
  if (loadError) throw new Error(`Caricamento template fallito: ${loadError.message}`);

  async function create(fd: FormData) {
    "use server";
    const { profile, sb } = await requireAdmin();
    const { error } = await sb.from("report_templates").insert({
      company_id: profile.company_id,
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "") || null
    });
    if (error) throw new Error(`Creazione template fallita: ${error.message}`);
    revalidatePath("/admin/templates");
  }

  async function remove(fd: FormData) {
    "use server";
    const { sb } = await requireAdmin();
    const { error } = await sb.from("report_templates").delete().eq("id", String(fd.get("id")));
    if (error) throw new Error(`Eliminazione template fallita: ${error.message}`);
    revalidatePath("/admin/templates");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Template checklist</h1>
      <form action={create} className="card p-3 space-y-2">
        <input name="name" required placeholder="Nome template *" className="input" />
        <input name="description" placeholder="Descrizione" className="input" />
        <button className="btn-primary w-full">Crea template</button>
      </form>

      <ul className="space-y-2">
        {templates?.map((t: any) => (
          <li key={t.id} className="card p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t.name}</div>
              <span className="text-xs text-gray-500">{t.template_tasks?.[0]?.count ?? 0} task</span>
            </div>
            {t.description && <div className="text-sm text-gray-600">{t.description}</div>}
            <div className="flex gap-3 mt-2">
              <Link href={`/admin/templates/${t.id}`} className="text-sm text-brand-700">Modifica task</Link>
              <form action={remove}>
                <input type="hidden" name="id" value={t.id} />
                <button className="text-sm text-red-600">Elimina</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
