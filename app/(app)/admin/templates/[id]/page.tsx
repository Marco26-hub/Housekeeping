import { requireAdmin } from "@/lib/auth";
import { CHECKLIST_SECTIONS } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export default async function TemplateEdit({ params }: { params: { id: string } }) {
  const { sb } = await requireAdmin();
  const { data: template, error: templateError } = await sb.from("report_templates").select("*").eq("id", params.id).single();
  if (templateError) throw new Error(`Caricamento template fallito: ${templateError.message}`);
  const { data: tasks, error: tasksError } = await sb.from("template_tasks").select("*").eq("template_id", params.id).order("section").order("sort_order");
  if (tasksError) throw new Error(`Caricamento attività fallito: ${tasksError.message}`);

  async function addTask(fd: FormData) {
    "use server";
    const { sb } = await requireAdmin();
    const { error } = await sb.from("template_tasks").insert({
      template_id: params.id,
      section: String(fd.get("section")),
      label: String(fd.get("label") ?? "").trim(),
      sort_order: Number(fd.get("sort_order") || 0)
    });
    if (error) throw new Error(`Creazione attività fallita: ${error.message}`);
    revalidatePath(`/admin/templates/${params.id}`);
  }

  async function removeTask(fd: FormData) {
    "use server";
    const { sb } = await requireAdmin();
    const { error } = await sb.from("template_tasks").delete().eq("id", String(fd.get("id")));
    if (error) throw new Error(`Eliminazione attività fallita: ${error.message}`);
    revalidatePath(`/admin/templates/${params.id}`);
  }

  const grouped = (tasks ?? []).reduce<Record<string, typeof tasks>>((acc, t) => {
    (acc[t!.section] ??= [] as any).push(t!);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{template?.name}</h1>

      <form action={addTask} className="card p-3 space-y-2">
        <select name="section" className="input">
          {CHECKLIST_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input name="label" required placeholder="Descrizione attività *" className="input" />
        <input name="sort_order" type="number" placeholder="Ordine" className="input" defaultValue={0} />
        <button className="btn-primary w-full">Aggiungi task</button>
      </form>

      {Object.entries(grouped).map(([section, items]) => (
        <div key={section} className="card p-3">
          <h3 className="font-semibold mb-2">{section}</h3>
          <ul className="space-y-1 text-sm">
            {items!.map((t: any) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>{t.label}</span>
                <form action={removeTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-red-600 text-xs">Elimina</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
