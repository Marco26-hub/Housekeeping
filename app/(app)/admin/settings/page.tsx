import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export default async function SettingsAdmin() {
  const { profile, sb } = await requireAdmin();
  const { data: company, error: companyError } = await sb.from("companies").select("*").eq("id", profile.company_id).single();
  if (companyError) throw new Error(`Caricamento azienda fallito: ${companyError.message}`);

  async function save(fd: FormData) {
    "use server";
    const { profile, sb } = await requireAdmin();
    const { error } = await sb.from("companies").update({
      name: String(fd.get("name") ?? "").trim(),
      admin_email: String(fd.get("admin_email") ?? "").trim() || null,
      manager_whatsapp_number: String(fd.get("manager_whatsapp_number") ?? "").trim() || null,
      company_whatsapp_number: String(fd.get("company_whatsapp_number") ?? "").trim() || null,
      telegram_chat_id: String(fd.get("telegram_chat_id") ?? "").trim() || null,
      default_send_channel: String(fd.get("default_send_channel") ?? "whatsapp")
    }).eq("id", profile.company_id);
    if (error) throw new Error(`Salvataggio impostazioni fallito: ${error.message}`);
    revalidatePath("/admin/settings");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Impostazioni azienda</h1>
      <form action={save} className="card p-4 space-y-3">
        <div>
          <label className="label">Nome azienda</label>
          <input name="name" defaultValue={company?.name} className="input" />
        </div>
        <div>
          <label className="label">Email responsabile (destinatario report)</label>
          <input name="admin_email" type="email" defaultValue={company?.admin_email ?? ""} className="input" />
        </div>
        <div>
          <label className="label">WhatsApp responsabile</label>
          <input name="manager_whatsapp_number" type="tel" defaultValue={company?.manager_whatsapp_number ?? ""}
            className="input" placeholder="+39 333 000 0000" />
          <p className="text-xs text-gray-500 mt-1">Numero che riceve i messaggi WhatsApp dei report.</p>
        </div>
        <div>
          <label className="label">WhatsApp aziendale</label>
          <input name="company_whatsapp_number" type="tel" defaultValue={company?.company_whatsapp_number ?? ""}
            className="input" placeholder="+39 333 000 0000" />
        </div>
        <div>
          <label className="label">Telegram chat_id</label>
          <input name="telegram_chat_id" defaultValue={company?.telegram_chat_id ?? ""} className="input" />
          <p className="text-xs text-gray-500 mt-1">
            Token bot: env <code>TELEGRAM_BOT_TOKEN</code>. Avvia la chat con il bot prima di inviare.
          </p>
        </div>
        <div>
          <label className="label">Canale invio predefinito</label>
          <select name="default_send_channel" defaultValue={company?.default_send_channel ?? "whatsapp"} className="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
          </select>
        </div>
        <button className="btn-primary w-full">Salva</button>
      </form>

      <div className="card p-3 text-sm text-gray-600">
        <p className="font-semibold mb-1">Setup Telegram Bot</p>
        <ol className="list-decimal pl-5 space-y-1 text-xs">
          <li>Crea bot con <strong>@BotFather</strong> su Telegram</li>
          <li>Salva il token in <code>TELEGRAM_BOT_TOKEN</code> nel file .env.local</li>
          <li>Avvia una chat con il bot dall&apos;account/gruppo destinatario</li>
          <li>Recupera il chat_id da: <code>api.telegram.org/bot[TOKEN]/getUpdates</code></li>
          <li>Inserisci il chat_id qui sopra</li>
        </ol>
      </div>
    </div>
  );
}
