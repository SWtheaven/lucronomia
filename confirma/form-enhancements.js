(() => {
  "use strict";

  const form = document.querySelector("#deal-form");
  if (!form) return;

  const amountRaw = form.elements.amountRaw;
  const amount = form.elements.amount;
  const deadlineRaw = form.elements.deadlineRaw;
  const deadline = form.elements.deadline;

  function parseAmount(value) {
    let text = String(value || "")
      .trim()
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/[^0-9,.-]/g, "");

    if (!text) return null;

    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");

    if (comma > dot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else if (dot > comma && comma >= 0) {
      text = text.replace(/,/g, "");
    } else if (comma >= 0) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, "");
    }

    const number = Number(text);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function amountNumber(value) {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function syncAmount({ formatVisible = false } = {}) {
    const parsed = parseAmount(amountRaw.value);
    if (parsed === null) {
      amount.value = "";
      return;
    }

    const formatted = amountNumber(parsed);
    amount.value = `R$ ${formatted}`;
    if (formatVisible) amountRaw.value = formatted;
  }

  function syncDeadline() {
    const value = String(deadlineRaw.value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      deadline.value = "";
      return;
    }

    const [year, month, day] = value.split("-");
    deadline.value = `${day}/${month}/${year}`;
  }

  amountRaw.addEventListener("input", () => syncAmount());
  amountRaw.addEventListener("blur", () => syncAmount({ formatVisible: true }));
  deadlineRaw.addEventListener("change", syncDeadline);

  form.addEventListener("submit", () => {
    syncAmount({ formatVisible: true });
    syncDeadline();
  }, { capture: true });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      amount.value = "";
      deadline.value = "";
    }, 0);
  });
})();
