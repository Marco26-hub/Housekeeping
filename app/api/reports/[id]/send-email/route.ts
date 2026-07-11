import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import nodemailer from "nodemailer";
import { formatDate } from "@/lib/utils";
import { z } from "zod";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

const routeLog = logger.withContext({ route: "/api/reports/[id]/send-email" });

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_report_id" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(ip, "/api/reports/[id]/send-email");
  if (!rl.allowed) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: rateLimitHeaders(rl) });

  const { profile, sb } = await requireUser();
  const smtpRequired = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  if (smtpRequired.some((key) => !process.env[key])) {
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 400 });
  }
  const { data: report, error: reportError } = await sb.from("reports").select("*").eq("id", parsed.data.id).single();
  if (reportError && reportError.code !== "PGRST116") return NextResponse.json({ error: "report_load_failed" }, { status: 503 });
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (profile.role !== "admin" && report.operator_id !== profile.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: company, error: companyError } = await sb.from("companies").select("name, admin_email").eq("id", report.company_id).single();
  if (companyError) return NextResponse.json({ error: "company_load_failed" }, { status: 503 });
  if (!company?.admin_email) return NextResponse.json({ error: "admin_email_not_set" }, { status: 400 });

  // ensure PDF
  if (!report.pdf_url) {
    const pdfRes = await fetch(`${appUrl()}/api/reports/${report.id}/pdf`, {
      method: "POST",
      headers: { cookie: (await import("next/headers")).headers().get("cookie") ?? "" }
    });
    if (!pdfRes.ok) return NextResponse.json({ error: "pdf_failed" }, { status: 502 });
  }

  const admin = supabaseAdmin();
  const { data: r2, error: pdfRowError } = await admin.from("reports").select("pdf_url").eq("id", report.id).single();
  if (pdfRowError || !r2?.pdf_url) return NextResponse.json({ error: "pdf_not_linked" }, { status: 502 });
  const { data: blob, error: pdfDownloadError } = await admin.storage.from("report-pdfs").download(r2.pdf_url);
  if (pdfDownloadError || !blob) return NextResponse.json({ error: "pdf_download_failed" }, { status: 502 });
  const buf = Buffer.from(await blob.arrayBuffer());

  let success = false; let error: string | null = null;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! }
    });
    const videoLine = report.external_video_link
      ? `\nLink video: ${report.external_video_link}${report.external_video_description ? ` — ${report.external_video_description}` : ""}`
      : "";
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: company.admin_email,
      subject: `Report pulizia ${report.client_name} — ${formatDate(report.intervention_date)}`,
      text: `In allegato il report di pulizia di ${report.client_name} (${report.address}).${videoLine}`,
      attachments: [{ filename: `report-${report.id}.pdf`, content: buf }]
    });
    success = true;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
    routeLog.error("Failed to send email", e, { reportId: report.id, target: company.admin_email });
  }

  const { error: logError } = await sb.from("report_sends").insert({
    report_id: report.id, channel: "email", target: company.admin_email,
    success, error, sent_by: profile.id
  });
  if (logError) return NextResponse.json({ error: "send_log_failed", delivered: success }, { status: 500 });

  if (success && report.status === "completato") {
    const { error: statusError } = await sb.from("reports").update({ status: "inviato" }).eq("id", report.id);
    if (statusError) return NextResponse.json({ error: "status_update_failed", delivered: true }, { status: 500 });
  }

  if (success) routeLog.info("Email sent", { reportId: report.id, target: company.admin_email });

  return success ? NextResponse.json({ ok: true }) : NextResponse.json({ error }, { status: 500 });
}
