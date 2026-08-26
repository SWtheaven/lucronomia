(() => {
  "use strict";

  const API = "https://jxuazdoflabqerkccevi.supabase.co/functions/v1/confirma/api";
  const TOKEN_KEY = "lucronomia_confirma_wallet_v0";
  const DRAFT_KEY = "lucronomia_confirma_pending_draft_v0";
  const LAST_CONFIRMATION_KEY = "lucronomia_confirma_last_confirmation_v0";
  const PENDING_ORDER_KEY = "confirma_pending_order";
  const DRAFT_ID_KEY = "confirma_draft_id";

  const initialParams = new URLSearchParams(location.search);
  const paymentReturnAtLoad = initialParams.get("payment_return") === "1";
  const returnOrderAtLoad = initialParams.get("order") || sessionStorage.getItem(PENDING_ORDER_KEY) || "";

  const form = document.querySelector("#deal-form");
  const preview = document.querySelector("#preview");
  const purchase = document.querySelector("#purchase");
  const delivery = document.querySelector("#delivery");
  const whatsappButton = document.querySelector("#whatsapp");
  const finalizeButton = document.querySelector("#finalize");

  let checkoutLocked = false;
  let finalizeRequested = false;

  function walletToken() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    return hash.get("wallet") || localStorage.getItem(TOKEN_KEY) || "";
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function snapshotDraft() {
    if (!form) return null;
    const names = [
      "providerName", "clientName", "service", "amountRaw", "amount",
      "deadlineRaw", "deadline", "paymentMethod", "deposit", "details", "notes"
    ];
    const values = {};
    for (const name of names) values[name] = clean(form.elements[name]?.value);
    if (!values.providerName || !values.clientName || !values.service) return null;
    return { values, savedAt: new Date().toISOString() };
  }

  function saveDraft() {
    const snapshot = snapshotDraft();
    if (snapshot) localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
  }

  function readDraft() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return parsed?.values?.service ? parsed : null;
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function restoreDraft(snapshot) {
    if (!form || !snapshot?.values) return;
    for (const [name, value] of Object.entries(snapshot.values)) {
      const field = form.elements[name];
      if (field) field.value = value;
    }
    form.elements.amountRaw?.dispatchEvent(new Event("input", { bubbles: true }));
    form.elements.deadlineRaw?.dispatchEvent(new Event("change", { bubbles: true }));
    form.requestSubmit();
  }

  function startNewDraft() {
    clearDraft();
    sessionStorage.removeItem(DRAFT_ID_KEY);
    form?.reset();
    if (preview) preview.hidden = true;
    if (purchase) purchase.hidden = true;
    if (delivery) delivery.hidden = true;
    document.querySelector("#form-section")?.scrollIntoView({ behavior: "smooth" });
  }

  function removeResumeChoice() {
    document.querySelector("#resume-choice-overlay")?.remove();
  }

  function showResumeChoice(snapshot) {
    if (!snapshot || document.querySelector("#resume-choice-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "resume-choice-overlay";
    overlay.className = "resume-choice-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "resume-choice-title");

    const card = document.createElement("div");
    card.className = "resume-choice-card";
    card.innerHTML = `
      <p class="eyebrow">PAGAMENTO CONFIRMADO</p>
      <h2 id="resume-choice-title">Seu resumo grátis continua aqui.</h2>
      <p>Você quer seguir com o resumo que preparou antes da compra ou começar uma nova confirmação?</p>
      <p class="resume-choice-note">Nenhum crédito é usado agora. O débito de 1 confirmação acontece somente quando você clicar em <strong>Finalizar confirmação</strong>.</p>
      <div class="resume-choice-actions">
        <button type="button" class="primary" data-resume>Continuar com este resumo</button>
        <button type="button" class="secondary" data-new>Fazer um novo resumo</button>
      </div>`;

    overlay.append(card);
    document.body.append(overlay);

    card.querySelector("[data-resume]").onclick = () => {
      removeResumeChoice();
      restoreDraft(snapshot);
    };
    card.querySelector("[data-new]").onclick = () => {
      removeResumeChoice();
      startNewDraft();
    };
  }

  async function waitForApprovedPayment() {
    if (!paymentReturnAtLoad || !returnOrderAtLoad) return;
    const snapshot = readDraft();
    if (!snapshot) return;

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const token = walletToken();
      if (token) {
        try {
          const response = await fetch(`${API}/payment-status?order=${encodeURIComponent(returnOrderAtLoad)}`, {
            headers: { "x-wallet-token": token, "content-type": "application/json" },
            cache: "no-store"
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && data?.order?.status === "approved") {
            showResumeChoice(snapshot);
            return;
          }
        } catch {}
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  function track(eventName, properties = {}) {
    const token = walletToken();
    fetch(`${API}/event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-wallet-token": token } : {})
      },
      body: JSON.stringify({ event_name: eventName, properties }),
      keepalive: true
    }).catch(() => {});
  }

  function messageForWhatsApp(data) {
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
      "Estou enviando também o PDF com o resumo do combinado."
    ].join("\n");
  }

  function buildShareFile() {
    if (!window.ConfirmaPdf) return null;
    const payload = window.ConfirmaPdf.collectDocumentData(document);
    if (!payload?.service) return null;
    const confirmationId = localStorage.getItem(LAST_CONFIRMATION_KEY) || "";
    const bytes = window.ConfirmaPdf.buildProfessionalPdf(payload, {
      confirmationId,
      generatedAt: new Date()
    });
    const filename = `combinado-${window.ConfirmaPdf.slug(payload.clientName)}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = new Blob([bytes], { type: "application/pdf" });
    const file = typeof File === "function" ? new File([blob], filename, { type: "application/pdf" }) : null;
    return { payload, blob, file, filename };
  }

  function downloadBlob(blob, filename) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }

  async function shareSummaryAndPdf(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const built = buildShareFile();
    if (!built) return;
    const message = messageForWhatsApp(built.payload);

    const canShareFile = !!(
      built.file &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [built.file] }))
    );

    if (canShareFile) {
      try {
        await navigator.share({
          title: "LucronomIA Confirma — Resumo do combinado",
          text: message,
          files: [built.file]
        });
        track("pdf_generated", { confirmation_id: localStorage.getItem(LAST_CONFIRMATION_KEY) || "" });
        track("whatsapp_click", { confirmation_id: localStorage.getItem(LAST_CONFIRMATION_KEY) || "", mode: "native_share_with_pdf" });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    downloadBlob(built.blob, built.filename);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    track("pdf_generated", { confirmation_id: localStorage.getItem(LAST_CONFIRMATION_KEY) || "" });
    track("whatsapp_click", { confirmation_id: localStorage.getItem(LAST_CONFIRMATION_KEY) || "", mode: "download_plus_whatsapp_fallback" });
    alert("Seu navegador não permite anexar o PDF diretamente ao WhatsApp. O PDF foi baixado e a mensagem foi aberta; anexe o arquivo baixado antes de enviar.");
  }

  form?.addEventListener("submit", () => {
    setTimeout(saveDraft, 0);
  });

  form?.addEventListener("input", () => {
    if (!preview?.hidden) saveDraft();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(".package button");
    if (!button) return;

    if (checkoutLocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    checkoutLocked = true;
    saveDraft();
    const originalText = button.textContent;
    setTimeout(() => {
      document.querySelectorAll(".package button").forEach((item) => { item.disabled = true; });
      button.textContent = "Abrindo pagamento…";
    }, 0);

    setTimeout(() => {
      checkoutLocked = false;
      document.querySelectorAll(".package button").forEach((item) => { item.disabled = false; });
      if (button.isConnected) button.textContent = originalText;
    }, 10000);
  }, true);

  finalizeButton?.addEventListener("click", () => {
    finalizeRequested = true;
  }, true);

  if (delivery) {
    new MutationObserver(() => {
      if (finalizeRequested && !delivery.hidden) {
        clearDraft();
        finalizeRequested = false;
      }
    }).observe(delivery, { attributes: true, attributeFilter: ["hidden"] });
  }

  whatsappButton?.addEventListener("click", shareSummaryAndPdf, true);

  waitForApprovedPayment();
})();
