import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/utils";
import Link from "next/link";

export default async function NewReportPage() {
  const { profile, sb } = await requireUser();
  const { data: templates, error: templatesError } = await sb
    .from("report_templates")
    .select("id, name, description, is_default")
    .eq("company_id", profile.company_id)
    .order("is_default", { ascending: false });
  if (templatesError) throw new Error(`Caricamento template fallito: ${templatesError.message}`);

  async function createWithTemplate(formData: FormData) {
    "use server";
    const { profile, sb } = await requireUser();
    const templateId = formData.get("template_id") as string;

    const { data: report, error } = await sb.from("reports").insert({
      company_id: profile.company_id,
      operator_id: profile.id,
      client_name: "",
      address: "",
      property_type: "appartamento",
      intervention_date: todayISO(),
      time_in: new Date().toTimeString().slice(0, 5),
      status: "bozza",
      template_id: templateId || null
    }).select("id").single();
    if (error || !report) throw new Error(error?.message);

    if (templateId) {
      const { data: tasks, error: tasksError } = await sb.from("template_tasks")
        .select("section, label, sort_order").eq("template_id", templateId);
      if (tasksError) {
        await sb.from("reports").delete().eq("id", report.id);
        throw new Error(`Caricamento attività template fallito: ${tasksError.message}`);
      }
      if (tasks?.length) {
        const { error: insertTasksError } = await sb.from("report_tasks").insert(
          tasks.map((t) => ({ report_id: report.id, section: t.section, label: t.label, sort_order: t.sort_order, done: false }))
        );
        if (insertTasksError) {
          await sb.from("reports").delete().eq("id", report.id);
          throw new Error(`Creazione checklist fallita: ${insertTasksError.message}`);
        }
      }
    }

    redirect(`/reports/${report.id}/edit`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Scegli un template</h1>
      <form action={createWithTemplate} className="space-y-2">
        <ul className="space-y-2">
          {templates?.map((t) => (
            <li key={t.id}>
              <button name="template_id" value={t.id} className="card p-4 w-full text-left hover:bg-gray-50">
                <div className="font-semibold">{t.name}{t.is_default && <span className="ml-2 chip bg-brand-50 text-brand-700">Default</span>}</div>
                {t.description && <div className="text-sm text-gray-500">{t.description}</div>}
              </button>
            </li>
          ))}
          <li>
            <button name="template_id" value="" className="card p-4 w-full text-left hover:bg-gray-50">
              <div className="font-semibold">Senza template</div>
              <div className="text-sm text-gray-500">Crea report vuoto</div>
            </button>
          </li>
        </ul>
      </form>
      <Link href="/reports" className="block text-center text-sm text-gray-500">Annulla</Link>
    </div>
  );
}
