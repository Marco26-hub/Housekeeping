import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/utils";
import { z } from "zod";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

const routeLog = logger.withContext({ route: "/api/reports/[id]/send-telegram" });

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_report_id" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(ip, "/api/reports/[id]/send-telegram");
  if (!rl.allowed) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: rateLimitHeaders(rl) });

  const { profile, sb } = await requireUser();
  const { data: report, error: reportError } = await sb.from("reports").select("*").eq("id", parsed.data.id).single();
  if (reportError && reportError.code !== "PGRST116") return NextResponse.json({ error: "report_load_failed" }, { status: 503 });
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (profile.role !== "admin" && report.operator_id !== profile.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: company, error: companyError } = await sb.from("companies").select("telegram_chat_id, name").eq("id", report.company_id).single();
  if (companyError) return NextResponse.json({ error: "company_load_failed" }, { status: 503 });
  const chatId = company?.telegram_chat_id;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return NextResponse.json({ error: "telegram_not_configured" }, { status: 400 });

  if (!report.pdf_url) {
    const pdfResponse = await fetch(`${appUrl()}/api/reports/${report.id}/pdf`, {
      method: "POST",
      headers: { cookie: (await import("next/headers")).headers().get("cookie") ?? "" }
    });
    if (!pdfResponse.ok) return NextResponse.json({ error: "pdf_failed" }, { status: 502 });
  }

  const admin = supabaseAdmin();
  const { data: r2, error: pdfRowError } = await admin.from("reports").select("pdf_url").eq("id", report.id).single();
  if (pdfRowError || !r2?.pdf_url) return NextResponse.json({ error: "pdf_not_linked" }, { status: 502 });
  const { data: blob, error: pdfDownloadError } = await admin.storage.from("report-pdfs").download(r2.pdf_url);
  if (pdfDownloadError || !blob) return NextResponse.json({ error: "pdf_download_failed" }, { status: 502 });
  const buf = Buffer.from(await blob.arrayBuffer());

  const videoLine = report.external_video_link
    ? `\n🎥 Video: ${report.external_video_link}${report.external_video_description ? ` — ${report.external_video_description}` : ""}`
    : "";
  const caption = `📋 Report pulizia\nCliente: ${report.client_name}\nIndirizzo: ${report.address}\nData: ${formatDate(report.intervention_date)}\nOre: ${report.total_hours ?? 0}${videoLine}`;

  let success = false; let error: string | null = null;
  try {
    const fd = new FormData();
    fd.append("chat_id", chatId);
    fd.append("caption", caption);
    fd.append("document", new Blob([buf], { type: "application/pdf" }), `report-${report.id}.pdf`);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: fd });
    const json = await res.json().catch(() => null) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !json?.ok) throw new Error(json?.description || `telegram_http_${res.status}`);
    success = true;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    routeLog.error("Failed to send Telegram", e, { reportId: report.id, chatId });
  }

  const { error: logError } = await sb.from("report_sends").insert({
    report_id: report.id, channel: "telegram", target: chatId,
    success, error, sent_by: profile.id
  });
  if (logError) return NextResponse.json({ error: "send_log_failed", delivered: success }, { status: 500 });

  if (success && report.status === "completato") {
    const { error: statusError } = await sb.from("reports").update({ status: "inviato" }).eq("id", report.id);
    if (statusError) return NextResponse.json({ error: "status_update_failed", delivered: true }, { status: 500 });
  }

  if (success) routeLog.info("Telegram sent", { reportId: report.id, chatId });
  return success ? NextResponse.json({ ok: true }) : NextResponse.json({ error }, { status: 500 });
}
