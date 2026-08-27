(() => {
  "use strict";

  const API = "https://jxuazdoflabqerkccevi.supabase.co/functions/v1/confirma/api";
  const TOKEN_KEY = "lucronomia_confirma_wallet_v0";
  const LAST_CONFIRMATION_KEY = "lucronomia_confirma_last_confirmation_v0";
  const REF_KEY = "lucronomia_confirma_ref_v0";

  let walletToken = "";
  let wallet = { balance: 0 };
  let packages = [];
  let draft = null;
  let finalized = null;

  const $ = (selector) => document.querySelector(selector);
  const form = $("#deal-form");
  const preview = $("#preview");
  const purchase = $("#purchase");
  const delivery = $("#delivery");

  function tokenFromHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    return params.get("wallet") || "";
  }

  function captureRef() {
    const fromUrl = new URLSearchParams(location.search).get("ref");
    if (fromUrl) {
      localStorage.setItem(REF_KEY, fromUrl.trim().slice(0, 200));
    }
  }

  function capturedRef() {
    return localStorage.getItem(REF_KEY) || "";
  }

  function persistWalletToken(token) {
    walletToken = token;
    localStorage.setItem(TOKEN_KEY, token);
    const hash = `wallet=${encodeURIComponent(token)}`;
    history.replaceState({}, "", `${location.pathname}${location.search}#${hash}`);
  }

  async function api(path, options = {}) {
    const headers = { "content-type": "application/json", ...(options.headers || {}) };
    if (walletToken) headers["x-wallet-token"] = walletToken;
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "REQUEST_FAILED");
      error.code = data.error;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function ensureWallet() {
    const hashToken = tokenFromHash();
    const storedToken = localStorage.getItem(TOKEN_KEY) || "";
    walletToken = hashToken || storedToken;

    if (walletToken) {
      try {
        const data = await api("/wallet");
        wallet = data.wallet;
        persistWalletToken(walletToken);
        renderBalance();
        return;
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        walletToken = "";
      }
    }

    const data = await api("/wallet", { method: "POST", body: "{}" });
    persistWalletToken(data.access_token);
    wallet = data.wallet;
    renderBalance();
  }

  function renderBalance() {
    $("#wallet-pill").textContent = `Saldo: ${wallet.balance} confirmaç${wallet.balance === 1 ? "ão" : "ões"}`;
    updateReminderBlock();
  }

  function money(cents) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  }

  function packageCard(pkg) {
    const element = document.createElement("article");
    element.className = `package${pkg.recommended ? " recommended" : ""}`;
    element.innerHTML = `${pkg.recommended ? '<div class="eyebrow">RECOMENDADO</div>' : ""}<h3>${pkg.label}</h3><div class="price">${money(pkg.price_cents)}</div><p>${pkg.description}</p><button class="primary">Comprar ${pkg.label} — ${money(pkg.price_cents)}</button>`;
    element.querySelector("button").onclick = () => buy(pkg.code);
    return element;
  }

  function renderPackages() {
    for (const id of ["#packages", "#purchase-packages"]) {
      const box = $(id);
      box.replaceChildren(...packages.map(packageCard));
    }
  }

  async function buy(packageCode) {
    try {
      track("buy_click", { package_code: packageCode });
      const data = await api("/checkout", {
        method: "POST",
        body: JSON.stringify({ package_code: packageCode, ref: capturedRef() })
      });
      sessionStorage.setItem("confirma_pending_order", data.order_id);
      location.href = data.checkout_url;
    } catch (error) {
      alert("Não foi possível iniciar o pagamento agora. Tente novamente em instantes ou fale com o suporte.");
    }
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function formValues() {
    const data = new FormData(form);
    return {
      providerName: clean(data.get("providerName")),
      clientName: clean(data.get("clientName")),
      service: clean(data.get("service")),
      amount: clean(data.get("amount")),
      deadline: clean(data.get("deadline")),
      paymentMethod: clean(data.get("paymentMethod")),
      deposit: clean(data.get("deposit")),
      details: clean(data.get("details")),
      notes: clean(data.get("notes")),
      clientPhone: clean(data.get("clientPhone")),
      reminderConsent: data.get("reminderConsent") === "on"
    };
  }

  function updateReminderBlock() {
    const block = $("#reminder-block");
    if (block) block.hidden = !wallet.lembrete_automatico_habilitado;
  }

  function renderDocument(data) {
    const fields = [
      ["Prestador", data.providerName],
      ["Cliente", data.clientName],
      ["Valor", data.amount],
      ["Forma de pagamento", data.paymentMethod],
      ["Entrada / sinal", data.deposit],
      ["Prazo / data", data.deadline],
      ["Detalhes", data.details],
      ["Observações", data.notes]
    ].filter(([, value]) => value);

    const dl = document.createElement("dl");
    for (const [label, value] of fields) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      dl.append(row);
    }

    const documentNode = $("#document");
    documentNode.replaceChildren();
    const brand = document.createElement("h3");
    brand.textContent = "LucronomIA Confirma — Resumo do combinado";
    const title = document.createElement("h2");
    title.textContent = data.service;
    documentNode.append(brand, title, dl);
  }

  function newClientConfirmationId() {
    return crypto.randomUUID();
  }

  async function finalize() {
    if (!draft) return;
    if (wallet.balance <= 0) {
      purchase.hidden = false;
      purchase.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const status = $("#finalize-status");
    status.textContent = "Finalizando…";

    try {
      const clientId = sessionStorage.getItem("confirma_draft_id") || newClientConfirmationId();
      sessionStorage.setItem("confirma_draft_id", clientId);

      const data = await api("/finalize", {
        method: "POST",
        body: JSON.stringify({ client_confirmation_id: clientId, payload: draft })
      });

      wallet.balance = data.balance;
      renderBalance();
      finalized = { id: data.confirmation_id, payload: draft };
      localStorage.setItem(LAST_CONFIRMATION_KEY, finalized.id);

      status.textContent = data.consumed
        ? "1 confirmação utilizada."
        : "Esta confirmação já estava finalizada; nenhum crédito adicional foi consumido.";

      $("#balance-message").textContent = `Você tem ${wallet.balance} confirmações disponíveis.`;
      delivery.hidden = false;
      delivery.scrollIntoView({ behavior: "smooth" });
      track("confirmation_finalized", { balance: wallet.balance, consumed: data.consumed });
    } catch (error) {
      if (error.code === "INSUFFICIENT_CREDITS") {
        wallet.balance = 0;
        renderBalance();
        purchase.hidden = false;
      } else {
        status.textContent = "Não foi possível finalizar.";
      }
    }
  }

  function whatsappMessage(data) {
    return [
      `Olá, ${data.clientName}. Organizei o que combinamos sobre ${data.service} para ficar tudo claro para nós dois.`,
      "",
      `Valor: ${data.amount}`,
      `Forma de pagamento: ${data.paymentMethod}`,
      `Data/prazo: ${data.deadline}`,
      ...(data.deposit ? [`Entrada / sinal: ${data.deposit}`] : []),
      ...(data.details ? [`Detalhes: ${data.details}`] : []),
      ...(data.notes ? [`Observações: ${data.notes}`] : []),
      "",
      "Segue o resumo do combinado."
    ].join("\n");
  }

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
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) current = next;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function pdfText(text, x, y, size = 11, bold = false) {
    return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET\n`;
  }

  function buildPdf(data) {
    const pageWidth = 595;
    const pageHeight = 842;
    const left = 50;
    const top = 790;
    const bottom = 55;
    const rows = [];

    rows.push({ text: "LucronomIA Confirma", size: 16, bold: true, gap: 26 });
    rows.push({ text: "RESUMO DO COMBINADO", size: 8, bold: true, gap: 18 });
    wrapText(data.service, 56).forEach((text) => rows.push({ text, size: 20, bold: true, gap: 25 }));

    const addField = (label, value) => {
      if (!value) return;
      rows.push({ text: label.toUpperCase(), size: 8, bold: true, gap: 13 });
      wrapText(value, 76).forEach((text) => rows.push({ text, size: 11, gap: 15 }));
      rows.push({ spacer: true, gap: 7 });
    };

    addField("Prestador", data.providerName);
    addField("Cliente", data.clientName);
    addField("Valor", data.amount);
    addField("Forma de pagamento", data.paymentMethod);
    addField("Entrada / sinal", data.deposit);
    addField("Prazo / data", data.deadline);
    addField("Detalhes", data.details);
    addField("Observações", data.notes);

    wrapText("Este documento organiza informações de um serviço já combinado. Não constitui serviço jurídico nem promessa de validade jurídica automática.", 92)
      .forEach((text) => rows.push({ text, size: 7, gap: 10 }));

    const pages = [];
    let page = [];
    let y = top;
    for (const row of rows) {
      const needed = row.gap || 14;
      if (y - needed < bottom && page.length) {
        pages.push(page);
        page = [];
        y = top;
      }
      page.push({ ...row, y });
      y -= needed;
    }
    if (page.length) pages.push(page);

    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    const firstPageObject = 5;
    const pageRefs = pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(" ");
    objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    pages.forEach((currentPage, index) => {
      const pageObject = firstPageObject + index * 2;
      const contentObject = pageObject + 1;
      let stream = "";
      currentPage.forEach((row) => {
        if (row.text !== undefined) stream += pdfText(row.text, left, row.y, row.size, row.bold);
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

  function downloadPdf() {
    if (!finalized) return;
    const pdf = buildPdf(finalized.payload);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `combinado-${slug(finalized.payload.clientName)}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
    track("pdf_generated", { confirmation_id: finalized.id });
  }

  function track(eventName, properties = {}) {
    api("/event", {
      method: "POST",
      body: JSON.stringify({ event_name: eventName, properties })
    }).catch(() => {});
  }

  async function restoreLastConfirmation() {
    const id = localStorage.getItem(LAST_CONFIRMATION_KEY);
    if (!id) return;
    try {
      const data = await api(`/confirmation/${encodeURIComponent(id)}`);
      finalized = { id: data.confirmation.id, payload: data.confirmation.payload };
      draft = finalized.payload;
      renderDocument(finalized.payload);
      preview.hidden = false;
      delivery.hidden = false;
      $("#balance-message").textContent = `Você tem ${wallet.balance} confirmações disponíveis.`;
      $("#finalize-status").textContent = "Confirmação já finalizada. Rebaixar PDF ou reenviar no WhatsApp não consome novo crédito.";
    } catch {
      localStorage.removeItem(LAST_CONFIRMATION_KEY);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    draft = formValues();
    const required = [draft.providerName, draft.clientName, draft.service, draft.amount, draft.deadline, draft.paymentMethod];
    if (required.some((value) => !value)) {
      $("#form-error").textContent = "Preencha os campos obrigatórios.";
      return;
    }
    if (draft.clientPhone && !draft.reminderConsent) {
      $("#form-error").textContent = "Marque a autorização do cliente para usar o lembrete automático, ou deixe o WhatsApp em branco.";
      return;
    }
    $("#form-error").textContent = "";
    sessionStorage.removeItem("confirma_draft_id");
    finalized = null;
    renderDocument(draft);
    preview.hidden = false;
    delivery.hidden = true;
    purchase.hidden = true;
    preview.scrollIntoView({ behavior: "smooth" });
    track("preview_generated");
  });

  form.addEventListener("input", () => track("form_start"), { once: true });
  $("#finalize").onclick = finalize;
  $("#edit").onclick = () => $("#form-section").scrollIntoView({ behavior: "smooth" });
  $("#pdf").onclick = downloadPdf;
  $("#whatsapp").onclick = () => {
    if (!finalized) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage(finalized.payload))}`, "_blank");
    track("whatsapp_click", { confirmation_id: finalized.id });
  };
  $("#new-doc").onclick = () => {
    draft = null;
    finalized = null;
    form.reset();
    preview.hidden = true;
    delivery.hidden = true;
    purchase.hidden = true;
    sessionStorage.removeItem("confirma_draft_id");
    $("#form-section").scrollIntoView({ behavior: "smooth" });
  };
  $("#copy-access").onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $("#copy-access").textContent = "Acesso copiado";
      setTimeout(() => { $("#copy-access").textContent = "Copiar acesso"; }, 1800);
    } catch {
      alert("Copie o endereço desta página para guardar seu acesso à carteira.");
    }
  };
  document.querySelector("[data-start]").onclick = () => $("#form-section").scrollIntoView({ behavior: "smooth" });

  function setPaymentBanner(text, { spinning = true } = {}) {
    const banner = $("#payment-status-banner");
    if (!banner) return;
    banner.hidden = false;
    banner.classList.toggle("spinning", spinning);
    banner.querySelector("span").textContent = text;
  }
  function hidePaymentBanner() {
    const banner = $("#payment-status-banner");
    if (banner) banner.hidden = true;
  }

  async function handlePaymentReturn() {
    const params = new URLSearchParams(location.search);
    const orderId = params.get("order") || sessionStorage.getItem("confirma_pending_order");
    if (!params.get("payment_return") || !orderId) return;

    // Pix costuma demorar mais que cartão para confirmar: mantemos a checagem por até ~2 minutos,
    // com o status sempre visível, em vez de desistir em silêncio depois de poucos segundos.
    setPaymentBanner("Confirmando seu pagamento…");
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await api(`/payment-status?order=${encodeURIComponent(orderId)}`).catch(() => null);
      if (status) {
        wallet.balance = status.balance;
        renderBalance();
        if (status.order.status === "approved") {
          hidePaymentBanner();
          alert(`${status.order.expected_credits} confirmações adicionadas. Saldo atual: ${status.balance}.`);
          sessionStorage.removeItem("confirma_pending_order");
          history.replaceState({}, "", `${location.pathname}#wallet=${encodeURIComponent(walletToken)}`);
          return;
        }
        if (["rejected", "cancelled"].includes(status.order.status)) {
          setPaymentBanner("Pagamento não aprovado. Você pode tentar novamente ou escolher outra forma de pagamento.", { spinning: false });
          sessionStorage.removeItem("confirma_pending_order");
          setTimeout(hidePaymentBanner, 8000);
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setPaymentBanner("Ainda estamos confirmando seu pagamento — com Pix isso pode levar alguns minutos. Seu saldo atualiza sozinho assim que for aprovado; pode continuar navegando.", { spinning: false });
  }

  async function boot() {
    captureRef();
    await ensureWallet();
    const packageData = await api("/packages");
    packages = packageData.packages;
    renderPackages();
    track("landing_view", { ref: capturedRef() });
    await handlePaymentReturn();
    await restoreLastConfirmation();
  }

  boot().catch(() => alert("Não foi possível iniciar o Confirma."));
})();
