(() => {
  "use strict";

  const config = window.LUCRONOMIA_FECHOU_CONFIG || {};
  const form = document.querySelector("#deal-form");
  const resultSection = document.querySelector("#result");
  const deliverySection = document.querySelector("#delivery");
  const checkoutButton = document.querySelector("#checkout-button");
  const paymentDoneButton = document.querySelector("#payment-done-button");
  const checkoutStatus = document.querySelector("#checkout-status");
  const pdfButton = document.querySelector("#pdf-button");
  const whatsappButton = document.querySelector("#whatsapp-button");
  const formError = document.querySelector("#form-error");

  const state = {
    data: null,
    formStarted: false,
    checkoutOpened: false,
    deliveryUnlocked: false
  };

  document.querySelectorAll("[data-price]").forEach((node) => {
    node.textContent = config.price || "R$ 9,90";
  });

  function track(eventName, properties = {}) {
    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      version: config.version || "0",
      path: window.location.pathname,
      ...properties
    };

    try {
      const key = "lucronomia_fechou_events_v0";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      current.push(event);
      localStorage.setItem(key, JSON.stringify(current.slice(-100)));
    } catch (_) {
      // Analytics must never block the product flow.
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);

    if (config.analyticsEndpoint) {
      const body = JSON.stringify(event);
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(config.analyticsEndpoint, new Blob([body], { type: "application/json" }));
        } else {
          fetch(config.analyticsEndpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true
          }).catch(() => {});
        }
      } catch (_) {
        // Fire-and-forget only.
      }
    }
  }

  function clean(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function cleanMultiline(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  function formatBRL(value) {
    const original = clean(value);
    if (!original) return "";
    const normalized = original
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const number = Number(normalized);
    if (!Number.isFinite(number)) return original.startsWith("R$") ? original : `R$ ${original}`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
  }

  function formData() {
    const data = new FormData(form);
    return {
      providerName: clean(data.get("providerName")),
      clientName: clean(data.get("clientName")),
      service: clean(data.get("service")),
      amount: formatBRL(data.get("amount")),
      deadline: clean(data.get("deadline")),
      paymentMethod: clean(data.get("paymentMethod")),
      deposit: clean(data.get("deposit")),
      details: cleanMultiline(data.get("details")),
      notes: cleanMultiline(data.get("notes"))
    };
  }

  function validate() {
    const required = ["providerName", "clientName", "service", "amount", "deadline", "paymentMethod"];
    let firstInvalid = null;
    let valid = true;

    required.forEach((id) => {
      const input = document.getElementById(id);
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
      if (!clean(input.value)) {
        valid = false;
        input.classList.add("invalid");
        input.setAttribute("aria-invalid", "true");
        firstInvalid ||= input;
      }
    });

    if (!valid) {
      formError.textContent = "Preencha os campos obrigatórios para gerar o resumo.";
      firstInvalid?.focus();
    } else {
      formError.textContent = "";
    }
    return valid;
  }

  function appendPreviewField(container, label, value) {
    if (!value) return;
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    container.appendChild(row);
  }

  function renderPreview(data) {
    document.querySelector("#preview-service").textContent = data.service;
    document.querySelector("#preview-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date());
    const fields = document.querySelector("#preview-fields");
    fields.replaceChildren();
    appendPreviewField(fields, "Prestador", data.providerName);
    appendPreviewField(fields, "Cliente", data.clientName);
    appendPreviewField(fields, "Valor", data.amount);
    appendPreviewField(fields, "Pagamento", data.paymentMethod);
    appendPreviewField(fields, "Entrada / sinal", data.deposit);
    appendPreviewField(fields, "Prazo / data", data.deadline);
    appendPreviewField(fields, "Detalhes", data.details);
    appendPreviewField(fields, "Observações", data.notes);
  }

  function scrollTo(node) {
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.querySelectorAll('[data-action="start"]').forEach((button) => {
    button.addEventListener("click", () => {
      track("cta_start_click");
      scrollTo(document.querySelector("#app"));
      document.querySelector("#providerName").focus({ preventScroll: true });
    });
  });

  form.addEventListener("input", () => {
    if (!state.formStarted) {
      state.formStarted = true;
      track("form_start");
    }
  }, { once: true });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validate()) return;
    state.data = formData();
    renderPreview(state.data);
    resultSection.hidden = false;
    deliverySection.hidden = true;
    state.deliveryUnlocked = false;
    track("form_complete");
    scrollTo(resultSection);
  });

  document.querySelector('[data-action="edit"]').addEventListener("click", () => {
    track("edit_click");
    scrollTo(document.querySelector("#app"));
  });

  function checkoutReady() {
    return typeof config.checkoutUrl === "string" && /^https:\/\//i.test(config.checkoutUrl.trim());
  }

  function setCheckoutAvailability() {
    if (checkoutReady()) {
      checkoutButton.disabled = false;
      checkoutStatus.textContent = "";
    } else {
      checkoutButton.disabled = true;
      checkoutStatus.textContent = "Checkout aguardando ativação do link de pagamento.";
    }
  }

  checkoutButton.addEventListener("click", () => {
    if (!checkoutReady()) return;
    state.checkoutOpened = true;
    track("checkout_click", { price: config.price || "R$ 9,90" });
    paymentDoneButton.hidden = false;
    checkoutStatus.textContent = "Conclua o pagamento na nova aba e depois volte aqui.";
    window.open(config.checkoutUrl, "_blank", "noopener,noreferrer");
  });

  paymentDoneButton.addEventListener("click", () => {
    if (!state.checkoutOpened) return;
    state.deliveryUnlocked = true;
    deliverySection.hidden = false;
    paymentDoneButton.hidden = true;
    checkoutStatus.textContent = "PDF e WhatsApp liberados nesta sessão.";
    track("payment_return_declared");
    scrollTo(deliverySection);
  });

  function whatsappMessage(data) {
    const lines = [
      `Olá, ${data.clientName}. Organizei aqui o que combinamos sobre ${data.service}.`,
      "",
      `Valor: ${data.amount}`,
      `Forma de pagamento: ${data.paymentMethod}`,
      ...(data.deposit ? [`Entrada / sinal: ${data.deposit}`] : []),
      `Data/prazo: ${data.deadline}`,
      ...(data.details ? [`Detalhes: ${data.details.replace(/\n/g, " ")}`] : []),
      ...(data.notes ? [`Observações: ${data.notes.replace(/\n/g, " ")}`] : []),
      "",
      "Segue o resumo para conferirmos se está tudo certo."
    ];
    return lines.join("\n");
  }

  whatsappButton.addEventListener("click", () => {
    if (!state.deliveryUnlocked || !state.data) return;
    track("whatsapp_click");
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage(state.data))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  function winAnsi(value) {
    return String(value || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\u0000-\u00ff]/g, "?");
  }

  function escapePdf(value) {
    return winAnsi(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function wrapText(text, maxChars) {
    const paragraphs = String(text || "").split(/\n/);
    const lines = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let current = "";
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) {
          current = next;
        } else {
          if (current) lines.push(current);
          if (word.length > maxChars) {
            const chunks = word.match(new RegExp(`.{1,${maxChars}}`, "g")) || [word];
            lines.push(...chunks.slice(0, -1));
            current = chunks.at(-1) || "";
          } else {
            current = word;
          }
        }
      });
      if (current) lines.push(current);
      if (!words.length || paragraphIndex < paragraphs.length - 1) lines.push("");
    });
    return lines;
  }

  function pdfTextCommand(text, x, y, size = 11, bold = false, color = "0.08 0.13 0.10") {
    return `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${escapePdf(text)}) Tj ET\n`;
  }

  function buildPdf(data) {
    const pageWidth = 595;
    const pageHeight = 842;
    const left = 50;
    const top = 790;
    const bottom = 56;
    const lines = [];

    lines.push({ text: "LucronomIA Fechou", size: 15, bold: true, color: "0 0.55 0.30", gap: 25 });
    lines.push({ text: "RESUMO DO COMBINADO", size: 8, bold: true, color: "0.30 0.40 0.35", gap: 18 });
    wrapText(data.service, 56).forEach((text) => lines.push({ text, size: 20, bold: true, color: "0.08 0.13 0.10", gap: 25 }));
    lines.push({ rule: true, gap: 18 });

    const addField = (label, value) => {
      if (!value) return;
      lines.push({ text: label.toUpperCase(), size: 8, bold: true, color: "0.30 0.40 0.35", gap: 13 });
      wrapText(value, 76).forEach((text) => lines.push({ text, size: 11, bold: false, color: "0.08 0.13 0.10", gap: 15 }));
      lines.push({ spacer: true, gap: 7 });
    };

    addField("Prestador", data.providerName);
    addField("Cliente", data.clientName);
    addField("Valor", data.amount);
    addField("Forma de pagamento", data.paymentMethod);
    addField("Entrada / sinal", data.deposit);
    addField("Prazo / data", data.deadline);
    addField("Detalhes", data.details);
    addField("Observações", data.notes);
    lines.push({ rule: true, gap: 16 });
    wrapText("Este documento organiza informações informadas pelas partes sobre um serviço já combinado. Não constitui serviço jurídico nem promessa de validade jurídica automática.", 92)
      .forEach((text) => lines.push({ text, size: 7, bold: false, color: "0.38 0.45 0.41", gap: 10 }));
    lines.push({ spacer: true, gap: 8 });
    lines.push({ text: `Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date())}`, size: 7, bold: false, color: "0.38 0.45 0.41", gap: 10 });

    const pages = [];
    let current = [];
    let y = top;
    lines.forEach((line) => {
      const needed = line.gap || 14;
      if (y - needed < bottom && current.length) {
        pages.push(current);
        current = [];
        y = top;
      }
      current.push({ ...line, y });
      y -= needed;
    });
    if (current.length) pages.push(current);

    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    const firstPageObject = 5;
    const pageRefs = pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(" ");
    objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    pages.forEach((page, index) => {
      const pageObject = firstPageObject + index * 2;
      const contentObject = pageObject + 1;
      let stream = "";
      page.forEach((line) => {
        if (line.rule) {
          stream += `0.82 0.86 0.84 RG 0.7 w ${left} ${line.y} m ${pageWidth - left} ${line.y} l S\n`;
        } else if (line.text !== undefined) {
          stream += pdfTextCommand(line.text, left, line.y, line.size, line.bold, line.color);
        }
      });
      objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
      objects[contentObject] = `<< /Length ${winAnsi(stream).length} >>\nstream\n${stream}endstream`;
    });

    let pdf = "%PDF-1.4\n%âãÏÓ\n";
    const offsets = [0];
    for (let i = 1; i < objects.length; i += 1) {
      offsets[i] = pdf.length;
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes;
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

  pdfButton.addEventListener("click", () => {
    if (!state.deliveryUnlocked || !state.data) return;
    const pdf = buildPdf(state.data);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = href;
    link.download = `combinado-${slug(state.data.clientName)}-${date}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
    track("pdf_generated");
  });

  setCheckoutAvailability();
  track("landing_view");
})();
