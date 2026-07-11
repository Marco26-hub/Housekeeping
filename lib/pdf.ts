import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFFont, type RGB } from "pdf-lib";
import { PROPERTY_TYPES, ANOMALY_CODES, STATUS_LABELS, PHOTO_KINDS } from "./constants";
import { formatDate, formatDateTime } from "./utils";
import type { Report, Company } from "./database.types";

const MAX_PDF_PHOTOS = 10;

type PdfPhoto = { kind: string; bytes: Uint8Array; contentType: string; notes?: string | null };
type PdfSignature = { kind: string; data_url: string };

type ReportData = {
  report: Report;
  operator_name: string;
  company: Company | null;
  tasks: { section: string; label: string; done: boolean }[];
  anomalies: { code: string; detail: string | null }[];
  photos: PdfPhoto[];
  signatures: PdfSignature[];
};

export async function buildReportPdf(d: ReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const pageWidth = PageSizes.A4[0];
  const pageHeight = PageSizes.A4[1];
  let page = pdf.addPage(PageSizes.A4);
  let y = pageHeight - margin;

  const blue = rgb(0.11, 0.30, 0.85);
  const gray = rgb(0.4, 0.4, 0.4);
  const lineCol = rgb(0.85, 0.85, 0.9);

  function newPageIfNeeded(needed: number) {
    if (y - needed < margin) {
      page = pdf.addPage(PageSizes.A4);
      y = pageHeight - margin;
    }
  }

  function drawLine() {
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lineCol });
    y -= 10;
  }

  function text(t: string, opts: { size?: number; font?: PDFFont; color?: RGB; x?: number; indent?: number } = {}) {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const color = opts.color ?? rgb(0.1, 0.1, 0.1);
    const x = opts.x ?? margin + (opts.indent ?? 0);
    const maxWidth = pageWidth - margin - x;
    const words = t.split(/\s+/);
    let line = "";
    for (const w of words) {
      const trial = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(trial, size) > maxWidth) {
        newPageIfNeeded(size + 4);
        page.drawText(line, { x, y, size, font: f, color });
        y -= size + 4;
        line = w;
      } else line = trial;
    }
    if (line) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x, y, size, font: f, color });
      y -= size + 4;
    }
  }

  // Header
  page.drawRectangle({ x: 0, y: pageHeight - 70, width: pageWidth, height: 70, color: blue });
  page.drawText("Report Pulizia Giornaliero", { x: margin, y: pageHeight - 45, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText(d.company?.name ?? "", { x: margin, y: pageHeight - 62, size: 10, font, color: rgb(0.85, 0.85, 1) });
  y = pageHeight - 90;

  const statusLabel = STATUS_LABELS[d.report.status] ?? d.report.status;
  text(`Stato: ${statusLabel}`, { size: 9, color: gray });
  y -= 4;

  const propType = PROPERTY_TYPES.find((p) => p.value === d.report.property_type)?.label ?? d.report.property_type;
  const rows: [string, string][] = [
    ["Data intervento", formatDate(d.report.intervention_date)],
    ["Operatore", d.operator_name],
    ["Cliente/struttura", d.report.client_name],
    ["Indirizzo", d.report.address],
    ["Tipologia immobile", propType ?? ""],
    ["Orario entrata", d.report.time_in?.slice(0, 5) ?? "—"],
    ["Orario uscita", d.report.time_out?.slice(0, 5) ?? "—"],
    ["Pausa", `${d.report.break_minutes ?? 0} min`],
    ["Totale ore", String(d.report.total_hours ?? 0)]
  ];
  for (const [k, v] of rows) {
    newPageIfNeeded(14);
    page.drawText(k, { x: margin, y, size: 9, font: bold, color: gray });
    page.drawText(v ?? "", { x: margin + 130, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }
  y -= 6; drawLine();

  // Checklist
  text("Checklist attività", { size: 13, font: bold, color: blue });
  y -= 2;
  const grouped: Record<string, typeof d.tasks> = {};
  for (const t of d.tasks) (grouped[t.section] ??= []).push(t);
  for (const [section, items] of Object.entries(grouped)) {
    newPageIfNeeded(20);
    text(section, { size: 11, font: bold });
    for (const t of items) {
      text(`${t.done ? "[X]" : "[ ]"} ${t.label}`, { size: 9, indent: 12, color: t.done ? rgb(0.1, 0.1, 0.1) : gray });
    }
    y -= 4;
  }
  drawLine();

  // Anomalie
  text("Anomalie", { size: 13, font: bold, color: blue });
  if (!d.anomalies.length) {
    text("Nessuna anomalia segnalata.", { size: 10, color: gray });
  } else {
    for (const a of d.anomalies) {
      const lbl = ANOMALY_CODES.find((x) => x.code === a.code)?.label ?? a.code;
      text(`• ${lbl}${a.detail ? " — " + a.detail : ""}`, { size: 10 });
    }
  }
  y -= 4; drawLine();

  // Note
  text("Note operative", { size: 13, font: bold, color: blue });
  text(d.report.notes || "—", { size: 10 });
  y -= 4; drawLine();

  // Video link
  if (d.report.external_video_link) {
    text("Link video documentazione", { size: 13, font: bold, color: blue });
    text(`Link: ${d.report.external_video_link}`, { size: 9, color: rgb(0.1, 0.3, 0.8) });
    if (d.report.external_video_description) {
      text(`Descrizione: ${d.report.external_video_description}`, { size: 9, color: gray });
    }
    y -= 4; drawLine();
  }

  // Foto
  text("Foto allegate", { size: 13, font: bold, color: blue });
  const displayPhotos = d.photos.slice(0, MAX_PDF_PHOTOS);
  const extra = d.photos.length - MAX_PDF_PHOTOS;

  if (!d.photos.length) {
    text("Nessuna foto allegata al report.", { size: 10, color: gray });
  } else {
    // Group by kind for display
    const byKind = new Map<string, typeof displayPhotos>();
    for (const p of displayPhotos) {
      if (!byKind.has(p.kind)) byKind.set(p.kind, []);
      byKind.get(p.kind)!.push(p);
    }
    for (const [kind, kPhotos] of byKind) {
      const label = PHOTO_KINDS.find((k) => k.value === kind)?.label ?? kind;
      text(label, { size: 10, font: bold });
      let x = margin;
      const thumb = 110;
      const gap = 10;
      for (const p of kPhotos) {
        try {
          const img = p.contentType.includes("png") ? await pdf.embedPng(p.bytes) : await pdf.embedJpg(p.bytes);
          const scale = thumb / Math.max(img.width, img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          if (x + w > pageWidth - margin) { x = margin; y -= thumb + 16; newPageIfNeeded(thumb + 20); }
          newPageIfNeeded(h + 16);
          page.drawImage(img, { x, y: y - h, width: w, height: h });
          if (p.notes) page.drawText(p.notes.slice(0, 30), { x, y: y - h - 10, size: 7, font, color: gray });
          x += w + gap;
        } catch { /* skip bad image */ }
      }
      y -= thumb + 20;
    }
    if (extra > 0) {
      text(`Sono presenti ulteriori ${extra} foto nell'archivio digitale del report.`, { size: 9, color: gray });
    }
  }
  drawLine();

  // Firme
  if (d.signatures.length) {
    text("Firme", { size: 13, font: bold, color: blue });
    newPageIfNeeded(120);
    let sx = margin;
    for (const s of d.signatures) {
      try {
        const b64 = s.data_url.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const img = await pdf.embedPng(bytes);
        const scale = 160 / Math.max(img.width, img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawText(s.kind === "operator" ? "Firma Operatore" : "Firma Cliente", { x: sx, y: y - 4, size: 9, font: bold, color: gray });
        page.drawImage(img, { x: sx, y: y - h - 16, width: w, height: h });
        sx += 200;
      } catch { /* skip */ }
    }
    y -= 100;
  }

  // Footer
  page.drawText(`Generato il ${formatDateTime(new Date())} | Daily Cleaning Report`, {
    x: margin, y: margin / 2, size: 7, font, color: gray
  });

  return await pdf.save();
}
