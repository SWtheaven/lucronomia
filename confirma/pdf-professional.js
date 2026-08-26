(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.ConfirmaPdf = api;
    if (root.document) {
      const install = () => {
        const button = root.document.querySelector("#pdf");
        if (!button) return;
        button.onclick = () => {
          const payload = api.collectDocumentData(root.document);
          if (!payload.service) return;
          const confirmationId = root.localStorage?.getItem("lucronomia_confirma_last_confirmation_v0") || "";
          const bytes = api.buildProfessionalPdf(payload, {
            confirmationId,
            generatedAt: new Date()
          });
          const blob = new Blob([bytes], { type: "application/pdf" });
          const href = URL.createObjectURL(blob);
          const link = root.document.createElement("a");
          link.href = href;
          link.download = `combinado-${api.slug(payload.clientName)}-${new Date().toISOString().slice(0, 10)}.pdf`;
          root.document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(href), 2000);
        };
      };
      if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", install, { once: true });
      else install();
    }
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const COLORS = {
    ink: "0.055 0.090 0.074",
    muted: "0.36 0.43 0.40",
    accent: "0.000 0.640 0.360",
    line: "0.84 0.88 0.86",
    soft: "0.965 0.975 0.970",
    softAccent: "0.930 0.975 0.950",
    white: "1 1 1"
  };

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function slug(value) {
    return String(value || "cliente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "cliente";
  }

  function collectDocumentData(doc) {
    const labels = {};
    doc.querySelectorAll("#document dl > div").forEach((row) => {
      const key = clean(row.querySelector("dt")?.textContent);
      const value = clean(row.querySelector("dd")?.textContent);
      if (key) labels[key] = value;
    });
    return {
      providerName: labels.Prestador || "",
      clientName: labels.Cliente || "",
      service: clean(doc.querySelector("#document h2")?.textContent),
      amount: labels.Valor || "",
      paymentMethod: labels["Forma de pagamento"] || "",
      deposit: labels["Entrada / sinal"] || "",
      deadline: labels["Prazo / data"] || "",
      details: labels.Detalhes || "",
      notes: labels["Observações"] || ""
    };
  }

  function winAnsi(value) {
    return String(value || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/\u00a0/g, " ")
      .replace(/[^\u0000-\u00ff]/g, "?");
  }

  function escapePdf(value) {
    return winAnsi(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function wrapText(text, maxChars) {
    const paragraphs = String(text || "").replace(/\r/g, "").split(/\n+/).map((item) => clean(item)).filter(Boolean);
    const output = [];
    for (const paragraph of paragraphs.length ? paragraphs : [""]) {
      const words = paragraph.split(" ").filter(Boolean);
      let current = "";
      for (const word of words) {
        if (word.length > maxChars && !current) {
          for (let i = 0; i < word.length; i += maxChars) output.push(word.slice(i, i + maxChars));
          continue;
        }
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) current = next;
        else {
          if (current) output.push(current);
          current = word;
        }
      }
      if (current) output.push(current);
    }
    return output.filter((line) => line.length > 0);
  }

  function textWidth(text, size, bold = false) {
    const factor = bold ? 0.54 : 0.50;
    return winAnsi(text).length * size * factor;
  }

  function cmdText(text, x, y, size = 10, bold = false, color = COLORS.ink) {
    return `BT ${color} rg /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(text)}) Tj ET\n`;
  }

  function cmdTextRight(text, rightX, y, size = 10, bold = false, color = COLORS.ink) {
    return cmdText(text, rightX - textWidth(text, size, bold), y, size, bold, color);
  }

  function cmdRect(x, y, width, height, fill = null, stroke = null, lineWidth = 1) {
    let out = "q\n";
    if (fill) out += `${fill} rg\n`;
    if (stroke) out += `${stroke} RG ${lineWidth} w\n`;
    out += `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill && stroke ? "B" : fill ? "f" : "S"}\nQ\n`;
    return out;
  }

  function cmdLine(x1, y1, x2, y2, color = COLORS.line, lineWidth = 1) {
    return `q ${color} RG ${lineWidth} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q\n`;
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function shortReference(value) {
    const raw = String(value || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return raw ? raw.slice(0, 10) : "SEM-ID";
  }

  function buildProfessionalPdf(data, options = {}) {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = 72;
    const generatedAt = options.generatedAt || new Date();
    const reference = shortReference(options.confirmationId);
    const pages = [];
    let stream = "";
    let y = 0;
    let pageNumber = 0;

    function addFooter() {
      const footerY = 38;
      stream += cmdLine(margin, footerY + 20, pageWidth - margin, footerY + 20, COLORS.line, 0.7);
      stream += cmdText("LucronomIA Confirma", margin, footerY + 6, 8, true, COLORS.muted);
      stream += cmdTextRight(`Página ${pageNumber}`, pageWidth - margin, footerY + 6, 8, false, COLORS.muted);
      const disclaimer = "Este documento organiza informações de um serviço já combinado. Não constitui serviço jurídico nem promessa de validade jurídica automática.";
      wrapText(disclaimer, 112).slice(0, 2).forEach((line, index) => {
        stream += cmdText(line, margin, footerY - 7 - index * 9, 6.8, false, COLORS.muted);
      });
    }

    function startPage(continuation = false) {
      if (stream) {
        addFooter();
        pages.push(stream);
      }
      pageNumber += 1;
      stream = "";
      stream += cmdRect(0, pageHeight - 5, pageWidth, 5, COLORS.accent);
      if (continuation) {
        stream += cmdText("LucronomIA Confirma", margin, 795, 11, true, COLORS.ink);
        stream += cmdText("RESUMO DO COMBINADO - CONTINUAÇÃO", margin, 779, 7.5, true, COLORS.accent);
        stream += cmdTextRight(`Ref. ${reference}`, pageWidth - margin, 795, 8, false, COLORS.muted);
        stream += cmdLine(margin, 763, pageWidth - margin, 763, COLORS.line, 0.7);
        y = 738;
      } else {
        stream += cmdText("LucronomIA", margin, 793, 14, true, COLORS.ink);
        stream += cmdText("CONFIRMA", margin, 775, 8, true, COLORS.accent);
        stream += cmdTextRight("RESUMO DO COMBINADO", pageWidth - margin, 793, 9.5, true, COLORS.ink);
        stream += cmdTextRight(`Ref. ${reference}  |  PDF gerado em ${formatDate(generatedAt)}`, pageWidth - margin, 776, 7.5, false, COLORS.muted);
        stream += cmdLine(margin, 758, pageWidth - margin, 758, COLORS.line, 0.8);
        y = 727;
      }
    }

    function ensureSpace(required) {
      if (y - required < bottomLimit) startPage(true);
    }

    function sectionLabel(label) {
      ensureSpace(26);
      stream += cmdText(label.toUpperCase(), margin, y, 7.5, true, COLORS.accent);
      y -= 19;
    }

    function paragraph(text, opts = {}) {
      if (!clean(text)) return;
      const size = opts.size || 10.2;
      const lineHeight = opts.lineHeight || 14.2;
      const maxChars = opts.maxChars || 88;
      const lines = wrapText(text, maxChars);
      lines.forEach((line) => {
        ensureSpace(lineHeight + 3);
        stream += cmdText(line, opts.x || margin, y, size, !!opts.bold, opts.color || COLORS.ink);
        y -= lineHeight;
      });
    }

    startPage(false);

    sectionLabel("Serviço acordado");
    const titleLines = wrapText(data.service, 52).slice(0, 3);
    titleLines.forEach((line) => {
      ensureSpace(25);
      stream += cmdText(line, margin, y, 18.5, true, COLORS.ink);
      y -= 23;
    });
    y -= 8;

    ensureSpace(86);
    const gap = 12;
    const cardWidth = (contentWidth - gap) / 2;
    const cardHeight = 66;
    const cardY = y - cardHeight + 8;
    stream += cmdRect(margin, cardY, cardWidth, cardHeight, COLORS.soft, COLORS.line, 0.6);
    stream += cmdRect(margin + cardWidth + gap, cardY, cardWidth, cardHeight, COLORS.soft, COLORS.line, 0.6);
    stream += cmdText("PRESTADOR", margin + 14, y - 7, 7.2, true, COLORS.muted);
    wrapText(data.providerName || "-", 34).slice(0, 2).forEach((line, index) => {
      stream += cmdText(line, margin + 14, y - 27 - index * 14, 10.5, index === 0, COLORS.ink);
    });
    const clientX = margin + cardWidth + gap + 14;
    stream += cmdText("CLIENTE", clientX, y - 7, 7.2, true, COLORS.muted);
    wrapText(data.clientName || "-", 34).slice(0, 2).forEach((line, index) => {
      stream += cmdText(line, clientX, y - 27 - index * 14, 10.5, index === 0, COLORS.ink);
    });
    y -= cardHeight + 17;

    sectionLabel("Condições principais");
    ensureSpace(88);
    const summaryHeight = 72;
    const summaryY = y - summaryHeight + 9;
    stream += cmdRect(margin, summaryY, contentWidth, summaryHeight, COLORS.softAccent, COLORS.line, 0.6);
    const col1 = margin + 16;
    const col2 = margin + contentWidth * 0.38;
    const col3 = margin + contentWidth * 0.70;
    stream += cmdLine(margin + contentWidth * 0.34, summaryY + 10, margin + contentWidth * 0.34, summaryY + summaryHeight - 10, COLORS.line, 0.6);
    stream += cmdLine(margin + contentWidth * 0.66, summaryY + 10, margin + contentWidth * 0.66, summaryY + summaryHeight - 10, COLORS.line, 0.6);

    stream += cmdText("VALOR COMBINADO", col1, y - 7, 7.0, true, COLORS.muted);
    stream += cmdText(data.amount || "-", col1, y - 31, 15.5, true, COLORS.ink);
    stream += cmdText("FORMA DE PAGAMENTO", col2, y - 7, 7.0, true, COLORS.muted);
    wrapText(data.paymentMethod || "-", 27).slice(0, 2).forEach((line, index) => {
      stream += cmdText(line, col2, y - 28 - index * 13, 9.5, index === 0, COLORS.ink);
    });
    stream += cmdText("DATA / PRAZO", col3, y - 7, 7.0, true, COLORS.muted);
    wrapText(data.deadline || "-", 23).slice(0, 2).forEach((line, index) => {
      stream += cmdText(line, col3, y - 28 - index * 13, 9.5, index === 0, COLORS.ink);
    });
    y -= summaryHeight + 15;

    if (clean(data.deposit)) {
      ensureSpace(34);
      stream += cmdText("ENTRADA / SINAL", margin, y, 7.2, true, COLORS.muted);
      stream += cmdText(data.deposit, margin + 106, y, 9.5, true, COLORS.ink);
      y -= 27;
    }

    if (clean(data.details)) {
      sectionLabel("Detalhes do serviço");
      paragraph(data.details, { maxChars: 88, size: 10.2, lineHeight: 14.3 });
      y -= 10;
    }

    if (clean(data.notes)) {
      sectionLabel("Observações");
      paragraph(data.notes, { maxChars: 88, size: 10.0, lineHeight: 14.0 });
      y -= 8;
    }

    ensureSpace(62);
    const recordHeight = 50;
    const recordY = y - recordHeight + 7;
    stream += cmdRect(margin, recordY, contentWidth, recordHeight, COLORS.soft, COLORS.line, 0.6);
    stream += cmdText("REGISTRO DO COMBINADO", margin + 14, y - 6, 7.2, true, COLORS.muted);
    stream += cmdText("Informações organizadas a partir dos dados fornecidos no Confirma.", margin + 14, y - 25, 8.8, false, COLORS.ink);
    stream += cmdTextRight(`Referência ${reference}`, pageWidth - margin - 14, y - 25, 8.5, true, COLORS.accent);
    y -= recordHeight + 10;

    addFooter();
    pages.push(stream);

    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    const firstPageObject = 5;
    const pageRefs = pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(" ");
    objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    pages.forEach((pageStream, index) => {
      const pageObject = firstPageObject + index * 2;
      const contentObject = pageObject + 1;
      objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
      objects[contentObject] = `<< /Length ${winAnsi(pageStream).length} >>\nstream\n${pageStream}endstream`;
    });

    let pdf = "%PDF-1.4\n%PDFConfirma\n";
    const offsets = [0];
    for (let i = 1; i < objects.length; i += 1) {
      offsets[i] = pdf.length;
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes;
  }

  return { buildProfessionalPdf, collectDocumentData, slug };
});