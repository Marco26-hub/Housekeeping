import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildReportPdf } from "@/lib/pdf";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { optimizeForPdf } from "@/lib/image-optimize";
import { z } from "zod";
import type { Report } from "@/lib/database.types";

export const runtime = "nodejs";

const routeLog = logger.withContext({ route: "/api/reports/[id]/pdf" });
const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_report_id" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(ip, "/api/reports/[id]/pdf");
  if (!rl.allowed) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: rateLimitHeaders(rl) });

  const { profile, sb } = await requireUser();
  const { data: report, error: reportError } = await sb.from("reports").select("*").eq("id", parsed.data.id).single();
  if (reportError && reportError.code !== "PGRST116") {
    routeLog.error("Failed to load report", reportError, { reportId: parsed.data.id });
    return NextResponse.json({ error: "report_load_failed" }, { status: 503 });
  }
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (profile.role !== "admin" && report.operator_id !== profile.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const related = await Promise.all([
    sb.from("profiles").select("full_name").eq("id", report.operator_id).single(),
    sb.from("companies").select("*").eq("id", report.company_id).single(),
    sb.from("report_tasks").select("section, label, done, sort_order").eq("report_id", report.id).order("section").order("sort_order"),
    sb.from("report_anomalies").select("code, detail").eq("report_id", report.id),
    sb.from("report_photos").select("kind, storage_path, notes").eq("report_id", report.id),
    sb.from("report_signatures").select("kind, data_url").eq("report_id", report.id)
  ]);
  const relatedError = related.find((result) => result.error)?.error;
  if (relatedError) {
    routeLog.error("Failed to load PDF dependencies", relatedError, { reportId: report.id });
    return NextResponse.json({ error: "pdf_dependencies_failed" }, { status: 503 });
  }
  const [operatorResult, companyResult, tasksResult, anomaliesResult, photosResult, signaturesResult] = related;
  const operator = operatorResult.data;
  const company = companyResult.data;
  const tasks = tasksResult.data;
  const anomalies = anomaliesResult.data;
  const photos = photosResult.data;
  const signatures = signaturesResult.data;

  // download photo bytes via service role
  const admin = supabaseAdmin();
  interface PhotoRow { kind: string; storage_path: string; notes?: string | null }
  const photoBytes = await Promise.all((photos ?? []).map(async (p: PhotoRow) => {
    const { data, error } = await admin.storage.from("report-photos").download(p.storage_path);
    if (error || !data) throw new Error(`photo_download_failed:${p.storage_path}:${error?.message ?? "empty_file"}`);
    const ab = await data.arrayBuffer();
    const raw = new Uint8Array(ab);
    const optimized = await optimizeForPdf(raw);
    return { kind: p.kind, bytes: optimized.bytes, contentType: optimized.contentType, notes: p.notes };
  }));

  const bytes = await buildReportPdf({
    report: report as Report,
    operator_name: operator?.full_name ?? "",
    company,
    tasks: tasks ?? [],
    anomalies: anomalies ?? [],
    photos: photoBytes.filter((x): x is NonNullable<typeof x> => x !== null),
    signatures: signatures ?? []
  });

  const path = `${report.company_id}/${report.id}/report-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage.from("report-pdfs").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true
  });
  if (upErr) {
    routeLog.error("Failed to upload PDF to storage", upErr, { reportId: report.id });
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: signed, error: signedError } = await admin.storage.from("report-pdfs").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError || !signed?.signedUrl) {
    routeLog.error("Failed to sign PDF URL", signedError ?? new Error("missing signed URL"), { reportId: report.id });
    return NextResponse.json({ error: "pdf_sign_failed" }, { status: 500 });
  }
  const { error: updateError } = await sb.from("reports").update({ pdf_url: path }).eq("id", report.id);
  if (updateError) {
    await admin.storage.from("report-pdfs").remove([path]);
    routeLog.error("Failed to link PDF to report", updateError, { reportId: report.id });
    return NextResponse.json({ error: "pdf_link_failed" }, { status: 500 });
  }

  routeLog.info("PDF generated", { reportId: report.id });
  return NextResponse.json({ url: signed.signedUrl, path });
}
