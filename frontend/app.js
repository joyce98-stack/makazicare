const roleHome = {
  admin: "adminhomepage.html",
  tenant: "tenanthomepage.html",
  landlord: "landlordhomepage.html",
  manager: "propertymanager.html",
};

const pageRole = {
  tenanthomepage: "tenant", tenantreceipts: "tenant", tenantpaypage: "tenant",
  maintenance: "tenant", relocation: "tenant", extension: "tenant",
  landlordhomepage: "landlord", apartments: "landlord", tenantslist: "landlord",
  extensionrequests: "landlord", propertymanagerlist: "landlord", paymentreport: "landlord",
  propertymanager: "manager", pmpaymentreport: "manager", pmrequests: "manager",
  adminhomepage: "admin",
  collections: "landlord",
};
pageRole.tenantslist = ["landlord", "manager"];

const page = location.pathname.split("/").pop().replace(/\.html$/, "");
const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function showMessage(message, form = document.querySelector("main"), kind = "danger") {
  if (!form) return;
  let box = form.querySelector(":scope > .app-message");
  if (!box) {
    box = document.createElement("div");
    box.className = "app-message alert";
    box.setAttribute("role", "status");
    form.prepend(box);
  }
  box.className = `app-message alert alert-${kind}`;
  box.textContent = message;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function addLogout(user) {
  const nav = document.querySelector("nav .navbar-collapse");
  if (!nav || nav.querySelector("[data-logout]")) return;
  const group = document.createElement("div");
  group.className = "d-flex align-items-center gap-2 ms-lg-3 mt-3 mt-lg-0";
  const label = document.createElement("span");
  label.className = "small fw-semibold";
  label.textContent = user.name;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-earth btn-sm";
  button.dataset.logout = "true";
  button.textContent = "Sign out";
  button.addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } finally { location.href = "authpage.html"; }
  });
  group.append(label, button);
  nav.append(group);
}

function addLivePanel(title, lines) {
  const main = document.querySelector("main");
  if (!main) return;
  let panel = main.querySelector("[data-live-panel]");
  if (!panel) {
    panel = document.createElement("section");
    panel.dataset.livePanel = "true";
    panel.className = "app-data-panel my-4";
    panel.setAttribute("aria-live", "polite");
    main.prepend(panel);
  }
  const heading = document.createElement("h2");
  heading.className = "app-data-panel-title";
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "d-flex flex-wrap gap-3";
  for (const line of lines) {
    const item = document.createElement("span");
    item.textContent = line;
    list.append(item);
  }
  panel.replaceChildren(heading, list);
}

function recordPanel(title) {
  const main = document.querySelector("main");
  if (!main) return null;
  let panel = main.querySelector("[data-record-panel]");
  if (!panel) {
    panel = document.createElement("section");
    panel.dataset.recordPanel = "true";
    panel.className = "app-data-panel my-4";
    main.prepend(panel);
  }
  const heading = document.createElement("h2");
  heading.className = "app-data-panel-title";
  heading.textContent = title;
  const records = document.createElement("div");
  records.className = "d-grid gap-2";
  panel.replaceChildren(heading, records);
  return records;
}

async function initLogin() {
  const form = document.querySelector("#loginForm");
  if (!form) return;
  const requestedReturn = new URLSearchParams(location.search).get("return") || "";
  const returnMatch = requestedReturn.match(/^([\w-]+\.html)(#[\w-]+)?$/);
  const returnPage = returnMatch?.[1].replace(/\.html$/, "");
  const returnRole = pageRole[returnPage];
  if (returnMatch && (Array.isArray(returnRole) ? returnRole.includes("admin") : returnRole === "admin")) {
    const adminRole = form.querySelector('#roleAdmin');
    if (adminRole) adminRole.checked = true;
    const prompt = document.createElement("p");
    prompt.className = "alert alert-info py-2";
    prompt.setAttribute("role", "status");
    prompt.textContent = "Sign in with your system admin account to continue to admin registration.";
    form.prepend(prompt);
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.querySelector("#email").value,
          password: document.querySelector("#password").value,
          role: form.querySelector('[name="role"]:checked')?.value,
        }),
      });
      const canReturn = returnMatch && (Array.isArray(returnRole) ? returnRole.includes(result.user.role) : returnRole === result.user.role);
      location.href = canReturn ? requestedReturn : roleHome[result.user.role];
    } catch (error) {
      showMessage(error.message, form);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

async function initLandlordRegistration() {
  const form = page === "landlord-register" ? document.querySelector("#landlordRegisterForm") : null;
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#registerPassword").value;
    if (password !== document.querySelector("#registerPasswordConfirm").value) {
      return showMessage("The passwords do not match.", form);
    }
    try {
      await api("/api/auth/register", { method: "POST", body: JSON.stringify({
        name: document.querySelector("#registerName").value,
        email: document.querySelector("#registerEmail").value,
        password,
      }) });
      location.href = roleHome.landlord;
    } catch (error) { showMessage(error.message, form); }
  });
}

async function initAdminRegistration() {
  const form = page === "admin-register" ? document.querySelector("#adminRegistrationForm") : null;
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (values.password !== values.passwordConfirm) {
      return showMessage("The new admin passwords do not match.", form);
    }
    const payload = {
      currentAdminEmail: values.currentAdminEmail,
      currentAdminPassword: values.currentAdminPassword,
      name: values.name,
      email: values.email,
      password: values.password,
    };
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api("/api/auth/register-admin", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      showMessage(`System admin account created for ${result.user.email}. Sign in with the new account.`, form.parentElement, "success");
    } catch (error) { showMessage(error.message, form); }
    finally { submit.disabled = false; }
  });
}

async function initManagerAcceptance() {
  const isManager = page === "manager-accept";
  const isTenant = page === "tenant-accept";
  if (!isManager && !isTenant) return;
  const form = document.querySelector(isManager ? "#managerAcceptForm" : "#tenantAcceptForm");
  const message = document.querySelector(isManager ? "#managerAcceptMessage" : "#tenantAcceptMessage");
  const passwordInput = document.querySelector(isManager ? "#managerPassword" : "#tenantPassword");
  const confirmInput = document.querySelector(isManager ? "#managerPasswordConfirm" : "#tenantPasswordConfirm");
  const token = new URLSearchParams(location.search).get("token");
  if (!token) {
    message.textContent = "This invitation link is missing its token. Ask the landlord to send a new invitation.";
    form.hidden = true;
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    if (password !== confirmInput.value) {
      message.textContent = "The passwords do not match.";
      return;
    }
    try {
      const result = await api(isManager ? "/api/managers/accept" : "/api/tenants/accept", { method: "POST", body: JSON.stringify({ token, password }) });
      message.textContent = `Your account for ${result.user.email} is ready. Sign in with that email address.`;
      form.hidden = true;
      setTimeout(() => { location.href = "authpage.html"; }, 1500);
    } catch (error) { message.textContent = error.message; }
  });
}

function bindTenantForms() {
  const maintenanceForm = document.querySelector(".form-body");
  if (page === "maintenance" && maintenanceForm) {
    maintenanceForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(maintenanceForm);
      try {
        const result = await api("/api/maintenance", { method: "POST", body: JSON.stringify({
          title: document.querySelector("#issueTitle")?.value,
          category: data.get("category"),
          description: document.querySelector("#issueDesc")?.value,
          priority: data.get("urgency") || "normal",
          preferredDate: document.querySelector("#visitDate")?.value || null,
          accessAllowed: Boolean(document.querySelector("#accessOk")?.checked),
        }) });
        showMessage(`Request ${result.item.id} was submitted.`, maintenanceForm, "success");
        maintenanceForm.reset();
        await loadMaintenance();
      } catch (error) { showMessage(error.message, maintenanceForm); }
    });
  }

  const extensionForm = page === "extension" ? document.querySelector(".form-panel form") : null;
  if (extensionForm) {
    const customDate = document.createElement("input");
    customDate.type = "date";
    customDate.id = "customDate";
    customDate.className = "form-control mt-2";
    customDate.hidden = true;
    customDate.setAttribute("aria-label", "Choose a payment date");
    extensionForm.querySelector("#extCustom")?.closest(".choices")?.after(customDate);
    extensionForm.querySelectorAll('[name="extension_date"]').forEach((radio) => radio.addEventListener("change", () => {
      customDate.hidden = radio.value !== "custom";
      customDate.required = radio.value === "custom";
      customDate.min = new Date().toISOString().slice(0, 10);
    }));
    extensionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = extensionForm.querySelector('[name="extension_date"]:checked')?.value;
      const due = value && value !== "custom" ? value : document.querySelector("#customDate")?.value;
      if (!due) return showMessage("Choose a payment date.", extensionForm);
      const dueDate = new Date(`${due}T00:00:00`);
      const currentDueDate = `${due.slice(0, 7)}-15`;
      try {
        const result = await api("/api/extensions", { method: "POST", body: JSON.stringify({
          month: dueDate.getMonth() + 1, year: dueDate.getFullYear(), currentDueDate,
          requestedPaymentDate: due,
          paymentPlan: extensionForm.querySelector('[name="plan"]:checked')?.value || "full",
          reason: document.querySelector("#reasonSelect")?.value,
          note: document.querySelector("#extNotes")?.value,
        }) });
        showMessage(`Extension request ${result.item.id} was sent.`, extensionForm, "success");
        extensionForm.reset();
        await loadExtensions();
      } catch (error) { showMessage(error.message, extensionForm); }
    });
  }

  const relocationForm = page === "relocation" ? document.querySelector(".form-panel form") : null;
  if (relocationForm) {
    const extra = document.createElement("div");
    extra.className = "step";
    extra.innerHTML = '<label class="step-label" for="desiredUnit">Preferred unit (for an internal move)</label><input class="form-control" id="desiredUnit" maxlength="40" placeholder="e.g. 2B">';
    relocationForm.querySelector(".step")?.after(extra);
    relocationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const choice = relocationForm.querySelector('[name="move_type"]:checked')?.value;
      const moveType = choice === "another-unit" ? "internal" : choice === "another-property" ? "external" : "move_out";
      try {
        const result = await api("/api/relocations", { method: "POST", body: JSON.stringify({
          moveType, requestedDate: document.querySelector("#moveDate")?.value,
          desiredUnit: document.querySelector("#desiredUnit")?.value,
          note: document.querySelector("#moveNotes")?.value,
        }) });
        showMessage(`Relocation request ${result.item.id} was sent.`, relocationForm, "success");
      } catch (error) { showMessage(error.message, relocationForm); }
    });
  }
}

async function loadMaintenance() {
  const data = await api("/api/maintenance");
  addLivePanel("Your maintenance requests", data.items.map((ticket) => `${ticket.id}: ${ticket.title} — ${ticket.status}`));
}

async function loadExtensions() {
  const data = await api("/api/extensions");
  const records = recordPanel("Extension requests");
  if (!data.items.length) records.textContent = "No extension requests.";
  for (const item of data.items) {
    const row = document.createElement("div");
    row.className = "d-flex flex-wrap align-items-center gap-2 border-bottom pb-2";
    const summary = document.createElement("span");
    summary.className = "me-auto";
    summary.textContent = `${item.tenant?.name || "Tenant"} · ${item.property?.name || "Property"} · ${item.status} · pay by ${item.requestedPaymentDate}`;
    row.append(summary);
    if (item.status === "pending") {
      for (const decision of ["approve", "decline"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = decision === "approve" ? "btn btn-sage btn-sm" : "btn btn-outline-clay btn-sm";
        button.textContent = decision === "approve" ? "Approve" : "Decline";
        button.addEventListener("click", async () => {
          try {
            await api(`/api/extensions/${encodeURIComponent(item.id)}/decision`, { method: "PATCH", body: JSON.stringify({ decision }) });
            await loadExtensions();
          } catch (error) { showMessage(error.message); }
        });
        row.append(button);
      }
    }
    records.append(row);
  }
}

async function loadMaintenanceRecords(canManage) {
  const data = await api("/api/maintenance");
  const records = recordPanel(canManage ? "Maintenance requests to review" : "Your maintenance requests");
  if (!data.items.length) records.textContent = "No maintenance requests.";
  for (const ticket of data.items) {
    const row = document.createElement("div");
    row.className = "d-flex flex-wrap align-items-center gap-2 border-bottom pb-2";
    const summary = document.createElement("span");
    summary.className = "me-auto";
    summary.textContent = `${ticket.id} · ${ticket.title} · ${ticket.tenant?.name || "You"} · ${ticket.status}`;
    row.append(summary);
    if (canManage && ticket.status !== "resolved") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-olive btn-sm";
      button.textContent = ticket.status === "new" ? "Start work" : "Mark resolved";
      button.addEventListener("click", async () => {
        try {
          await api(`/api/maintenance/${encodeURIComponent(ticket.id)}`, { method: "PATCH", body: JSON.stringify({ status: ticket.status === "new" ? "in_progress" : "resolved" }) });
          await loadMaintenanceRecords(true);
        } catch (error) { showMessage(error.message); }
      });
      row.append(button);
    }
    records.append(row);
  }
}

async function loadRelocations(canManage) {
  const data = await api("/api/relocations");
  const records = recordPanel("Relocation requests");
  if (!data.items.length) records.textContent = "No relocation requests.";
  for (const item of data.items) {
    const row = document.createElement("div");
    row.className = "d-flex flex-wrap align-items-center gap-2 border-bottom pb-2";
    const summary = document.createElement("span");
    summary.className = "me-auto";
    summary.textContent = `${item.tenant?.name || "You"} · ${item.moveType.replaceAll("_", " ")} · ${item.requestedDate} · ${item.status}`;
    row.append(summary);
    if (canManage && item.status === "pending") {
      for (const status of ["approved", "declined"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = status === "approved" ? "btn btn-sage btn-sm" : "btn btn-outline-clay btn-sm";
        button.textContent = status === "approved" ? "Approve" : "Decline";
        button.addEventListener("click", async () => {
          try {
            await api(`/api/relocations/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
            await loadRelocations(true);
          } catch (error) { showMessage(error.message); }
        });
        row.append(button);
      }
    }
    records.append(row);
  }
}

async function loadPageData(user) {
  if (page === "tenanthomepage" || page === "landlordhomepage" || page === "propertymanager") {
    const data = await api("/api/dashboard");
    if (user.role === "tenant") {
      const paymentInfo = data.paymentDetails?.mpesaShortCode
        ? [`PayBill ${data.paymentDetails.mpesaShortCode}`, `Account reference ${data.paymentDetails.paymentReference}`]
        : ["Electronic payment details are not set up yet."];
      const mpesaText = document.querySelector("#tenantMpesaDetails");
      if (mpesaText && data.paymentDetails?.mpesaShortCode) mpesaText.textContent = `PayBill: ${data.paymentDetails.mpesaShortCode} · Account: ${data.paymentDetails.paymentReference}`;
      const bank = data.paymentDetails?.bank;
      if (document.querySelector("#tenantBankName")) {
        document.querySelector("#tenantBankName").textContent = bank?.bankName || "Bank details are not set up yet.";
        document.querySelector("#tenantBankAccountName").textContent = bank?.bankAccountName ? `Account name: ${bank.bankAccountName}` : "";
        document.querySelector("#tenantBankAccountNumber").textContent = bank?.bankAccountNumber ? `Account number: ${bank.bankAccountNumber}` : "";
      }
      addLivePanel("Live account", [data.tenant.name, `${data.property?.name || "Property"} · Unit ${data.tenant.unit}`, `Monthly rent ${currency.format(data.tenant.rent)}`, ...paymentInfo, `${data.maintenanceOpen} open maintenance requests`]);
    } else {
      addLivePanel("Live portfolio summary", [`${data.tenants} tenants`, `${data.properties.length} properties`, `${currency.format(data.summary.collected)} collected`, `${currency.format(data.summary.outstanding)} outstanding`, `${data.maintenanceOpen} open maintenance requests`]);
    }
  }
  if (page === "adminhomepage") await loadAdminOverview();
  if (page === "tenantreceipts") {
    const data = await api("/api/receipts");
    addLivePanel("Recorded receipts", data.items.length ? data.items.map((item) => `${item.receiptNumber || item.id} · ${currency.format(item.amount)} · ${item.method || "Payment"}`) : ["No receipts recorded yet."]);
  }
  if (page === "maintenance") await loadMaintenanceRecords(false);
  if (page === "extensionrequests") await loadExtensions();
  if (page === "pmrequests") await loadMaintenanceRecords(true);
  if (page === "pmrequests") await bindMaintenanceScheduler();
  if (page === "relocation") await loadRelocations(false);
  if (page === "propertymanager" || page === "landlordhomepage") await loadRelocations(true);
  if (page === "paymentreport" || page === "pmpaymentreport") {
    const data = await api("/api/reports/payments");
    addLivePanel("Live payment report", [`${currency.format(data.summary.billed)} billed`, `${currency.format(data.summary.collected)} collected`, `${currency.format(data.summary.outstanding)} outstanding`, `${data.summary.collectionRate}% collected`]);
    await bindPaymentEntry();
  }
  if (page === "tenantslist") {
    const data = await api("/api/tenants");
    addLivePanel("Live tenant directory", data.items.map((tenant) => `${tenant.name} · Unit ${tenant.unit} · ${tenant.email} · ${currency.format(tenant.rent)}`));
  }
  if (page === "apartments") {
    const data = await api("/api/properties");
    addLivePanel("Your properties", data.items.map((property) => `${property.name} · ${property.address} · ${property.occupiedCount}/${property.unitCount} units occupied`));
    bindPropertyForm();
  }
  if (page === "tenantslist") bindTenantCreateForm();
  if (page === "propertymanagerlist") {
    const data = await api("/api/managers");
    addLivePanel("Manager invitations", data.invitations.map((item) => `${item.name} · ${item.email} · ${item.status}`));
    bindManagerInvite();
  }
  if (page === "collections") await loadCollectionSettings();
}

async function loadCollectionSettings() {
  const [settings, transactions] = await Promise.all([
    api("/api/integrations/collections"),
    api("/api/integrations/collections/transactions"),
  ]);
  const form = document.querySelector("#collectionSettingsForm");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.elements.shortCode.value = settings.mpesa?.shortCode || "";
    form.elements.bankName.value = settings.bank?.bankName || "";
    form.elements.bankAccountName.value = settings.bank?.bankAccountName || "";
    form.elements.bankAccountNumber.value = settings.bank?.bankAccountNumber || "";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/integrations/collections/mpesa", { method: "POST", body: JSON.stringify({
          shortCode: form.elements.shortCode.value,
          bankName: form.elements.bankName.value,
          bankAccountName: form.elements.bankAccountName.value,
          bankAccountNumber: form.elements.bankAccountNumber.value,
        }) });
        const urls = document.querySelector("#callbackUrls");
        urls.hidden = false;
        urls.querySelector("#confirmationUrl").textContent = result.confirmationUrl;
        urls.querySelector("#validationUrl").textContent = result.validationUrl;
        document.querySelector("#callbackWarning").hidden = !result.publicHttpsRequired;
        showMessage("PayBill settings saved. Copy the callback URLs into the Daraja C2B configuration.", form, "success");
      } catch (error) { showMessage(error.message, form); }
    });
  }
  const now = new Date();
  const chargeForm = document.querySelector("#chargeGenerationForm");
  if (chargeForm && !chargeForm.dataset.initialized) {
    chargeForm.dataset.initialized = "true";
    chargeForm.elements.month.value = String(now.getMonth() + 1);
    chargeForm.elements.year.value = String(now.getFullYear());
    chargeForm.elements.dueDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
  }

  const records = recordPanel("Incoming M-Pesa payments");
  if (!transactions.items.length) records.textContent = "No incoming payment notifications yet.";
  for (const transaction of transactions.items) {
    const row = document.createElement("div");
    row.className = "d-flex flex-wrap align-items-center gap-2 border-bottom pb-2";
    const details = document.createElement("span");
    details.className = "me-auto";
    details.textContent = `${transaction.transactionId} · ${currency.format(transaction.amount)} · reference ${transaction.paymentReference || "(empty)"} · ${transaction.status}${transaction.unappliedAmount ? ` · unapplied ${currency.format(transaction.unappliedAmount)}` : ""}`;
    row.append(details);
    if (transaction.status === "unmatched") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-outline-earth btn-sm";
      button.textContent = "Try matching again";
      button.addEventListener("click", async () => {
        try {
          await api(`/api/integrations/collections/transactions/${encodeURIComponent(transaction.id)}/reconcile`, { method: "POST" });
          await loadCollectionSettings();
        } catch (error) { showMessage(error.message); }
      });
      row.append(button);
    }
    records.append(row);
  }
  bindChargeGeneration();
}

function bindChargeGeneration() {
  const form = document.querySelector("#chargeGenerationForm");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/payments/generate-monthly", { method: "POST", body: JSON.stringify({
        month: Number(form.elements.month.value),
        year: Number(form.elements.year.value),
        dueDate: form.elements.dueDate.value,
      }) });
      showMessage(`Created ${result.created} rent charges. ${result.skipped} existing charges were skipped.`, form, "success");
    } catch (error) { showMessage(error.message, form); }
  });
}

async function loadAdminOverview() {
  const adminForm = document.querySelector("#adminRegisterForm");
  if (adminForm && !adminForm.dataset.bound) {
    adminForm.dataset.bound = "true";
    adminForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(adminForm));
      try {
        const result = await api("/api/admin/users", { method: "POST", body: JSON.stringify(values) });
        adminForm.reset();
        showMessage(`System administrator account created for ${result.user.email}.`, adminForm, "success");
      } catch (error) { showMessage(error.message, adminForm); }
    });
  }
  const data = await api("/api/admin/overview");
  const stats = document.querySelector("#adminStats");
  if (stats) {
    const items = [
      ["Landlords", data.summary.landlordCount, "bi-person-badge"],
      ["Properties", data.summary.propertyCount, "bi-buildings"],
      ["Apartments", data.summary.apartmentCount, "bi-building"],
      ["Houses", data.summary.houseCount, "bi-house"],
      ["Tenants", data.summary.tenantCount, "bi-people"],
      ["Managers", data.summary.managerCount, "bi-clipboard-check"],
    ];
    stats.replaceChildren(...items.map(([label, value, icon]) => {
      const cell = document.createElement("div");
      cell.className = "admin-stat-cell";
      const badge = document.createElement("span");
      badge.className = "admin-stat-icon";
      const glyph = document.createElement("i");
      glyph.className = `bi ${icon}`;
      glyph.setAttribute("aria-hidden", "true");
      badge.append(glyph);
      const copy = document.createElement("div");
      const count = document.createElement("b");
      count.textContent = String(value ?? 0);
      const name = document.createElement("span");
      name.textContent = label;
      copy.append(count, name);
      cell.append(badge, copy);
      return cell;
    }));
    stats.setAttribute("aria-busy", "false");
  }
  const records = document.querySelector("#adminLandlordRecords");
  if (!records) return;
  records.replaceChildren();
  if (!data.landlords.length) {
    const empty = document.createElement("p");
    empty.className = "text-muted mb-0";
    empty.textContent = "No landlords have registered yet.";
    records.append(empty);
  }
  for (const landlord of data.landlords) {
    const card = document.createElement("article");
    card.className = "admin-landlord-card";
    card.dataset.search = `${landlord.name} ${landlord.email} ${landlord.properties.map((property) => `${property.name} ${property.address}`).join(" ")}`.toLowerCase();
    const top = document.createElement("div");
    top.className = "d-flex flex-wrap align-items-start justify-content-between gap-2";
    const identity = document.createElement("div");
    const heading = document.createElement("h3");
    heading.className = "h5 mb-1";
    heading.textContent = landlord.name;
    const email = document.createElement("p");
    email.className = "text-muted mb-0";
    email.textContent = landlord.email;
    const counts = document.createElement("p");
    counts.className = "small text-muted mt-3 mb-2";
    counts.textContent = `${landlord.propertyCount} properties · ${landlord.apartmentCount} apartments · ${landlord.houseCount} houses · ${landlord.tenantCount} tenants · ${landlord.managerCount} managers · ${landlord.pendingManagerInvitations} pending invitations`;
    identity.append(heading, email);
    top.append(identity, counts);
    card.append(top);
    if (landlord.properties.length) {
      const list = document.createElement("ul");
      list.className = "admin-property-list mb-0";
      for (const property of landlord.properties) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.className = "d-block";
        name.textContent = property.name;
        const details = document.createElement("span");
        details.className = "small text-muted";
        details.textContent = `${property.type} · ${property.unitCount} units · ${property.tenantCount} tenants`;
        const address = document.createElement("span");
        address.className = "d-block small text-muted mt-1";
        address.textContent = property.address;
        item.append(name, details, address);
        list.append(item);
      }
      card.append(list);
    } else {
      const empty = document.createElement("p");
      empty.className = "small text-muted mb-0";
      empty.textContent = "No properties have been added.";
      card.append(empty);
    }
    records.append(card);
  }
  records.setAttribute("aria-busy", "false");
  const search = document.querySelector("#landlordSearchInput");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "true";
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      records.querySelectorAll(".admin-landlord-card").forEach((card) => {
        card.hidden = !card.dataset.search.includes(query);
      });
    });
  }
}

function bindTenantCreateForm() {
  const records = recordPanel("Add tenant");
  const form = document.createElement("form");
  form.className = "d-flex flex-wrap gap-2 align-items-end";
  form.innerHTML = '<label>Name <input class="form-control" name="name" required></label><label>Email <input class="form-control" name="email" type="email" required></label><label>Phone <input class="form-control" name="phone" type="tel"></label><label>Property <select class="form-select" name="propertyId" required></select></label><label>Unit <input class="form-control" name="unit" required></label><label>Monthly rent (KES) <input class="form-control" name="rent" type="number" min="1" step="1" required></label><button class="btn btn-sage" type="submit">Add tenant</button>';
  records.append(form);
  api("/api/properties").then(({ items }) => {
    const select = form.elements.propertyId;
    select.add(new Option("Choose a property", ""));
    for (const property of items) select.add(new Option(property.name, property.id));
  }).catch((error) => showMessage(error.message, form));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await api("/api/tenants", { method: "POST", body: JSON.stringify({ ...values, rent: Number(values.rent) }) });
      showMessage(`${result.item.name} was added.`, form, "success");
      const notice = form.querySelector(":scope > .app-message");
      const inviteLink = document.createElement("a"); 
      inviteLink.href = result.acceptanceUrl;
      inviteLink.textContent = "Share tenant account setup link";
      inviteLink.className = "d-block text-break mt-2";
      notice.append(inviteLink);
      const data = await api("/api/tenants");
      addLivePanel("Live tenant directory", data.items.map((tenant) => `${tenant.name} · Unit ${tenant.unit} · ${tenant.email} · ${currency.format(tenant.rent)}`));
    } catch (error) { showMessage(error.message, form); }
  });
}

function bindManagerInvite() {
  const form = document.querySelector("#onboardModal form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const propertyIds = [...form.querySelectorAll('[name="assigned_prop"]:checked')].map((input) => input.value);
    try {
      const result = await api("/api/managers/invitations", { method: "POST", body: JSON.stringify({
        name: document.querySelector("#mgrName").value,
        email: document.querySelector("#mgrEmail").value,
        propertyIds,
      }) });
      showMessage("Invitation created. Share this one-time setup link with the manager: ", form, "success");
      const message = form.querySelector(":scope > .app-message");
      const link = document.createElement("a");
      link.href = result.acceptanceUrl;
      link.textContent = result.acceptanceUrl;
      link.className = "d-block text-break mt-2";
      message.append(link);
    } catch (error) { showMessage(error.message, form); }
  });
}

function bindPropertyForm() {
  const form = document.querySelector("#addModal form");
  if (!form) return;
  if (!form.querySelector("#propertyCategory")) {
    const field = document.createElement("div");
    field.className = "mb-3";
    field.innerHTML = '<label class="form-label" for="propertyCategory">Property category</label><select class="form-select" id="propertyCategory" required><option value="apartment">Apartment building</option><option value="house">Houses</option></select>';
    form.querySelector("#aptLocation")?.closest(".mb-3, .field, div")?.after(field);
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const name = document.querySelector("#aptName").value;
      const address = document.querySelector("#aptLocation").value;
      const unitCount = ["#count1", "#count2", "#count3"].reduce((sum, selector) => sum + Number(document.querySelector(selector)?.value || 0), 0);
      const type = document.querySelector("#propertyCategory")?.value || "apartment";
      const result = await api("/api/properties", { method: "POST", body: JSON.stringify({ name, address, unitCount, type }) });
      showMessage(`${result.item.name} was added.`, form, "success");
      const data = await api("/api/properties");
      addLivePanel("Your properties", data.items.map((property) => `${property.name} · ${property.address} · ${property.occupiedCount}/${property.unitCount} units occupied`));
    } catch (error) { showMessage(error.message, form); }
  });
}

async function bindPaymentEntry() {
  bindChargeCreation();
  const form = document.querySelector("#recordModal form");
  if (!form) return;
  const select = document.querySelector("#tenantSelect");
  const period = document.createElement("div");
  period.className = "row g-2 mb-2";
  period.innerHTML = `<div class="col"><label for="recordMonth" class="form-label">Rent month</label><input id="recordMonth" class="form-control" type="number" min="1" max="12" value="${new Date().getMonth() + 1}" required></div><div class="col"><label for="recordYear" class="form-label">Year</label><input id="recordYear" class="form-control" type="number" min="2020" value="${new Date().getFullYear()}" required></div>`;
  select.before(period);
  const tenants = await api("/api/tenants");
  select.replaceChildren(new Option("Choose a tenant", ""));
  for (const tenant of tenants.items) select.add(new Option(`${tenant.name} · ${tenant.unit}`, tenant.id));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const tenantId = select.value;
      const payments = await api(`/api/payments?month=${document.querySelector("#recordMonth").value}&year=${document.querySelector("#recordYear").value}`);
      const payment = payments.items.find((item) => item.tenantId === tenantId);
      if (!payment) return showMessage("Create a rent charge for this tenant and month before recording payment.", form);
      const result = await api(`/api/payments/${encodeURIComponent(payment.id)}/record`, { method: "POST", body: JSON.stringify({
        amount: Number(document.querySelector("#amount").value),
        method: document.querySelector("#method").value,
        paidAt: document.querySelector("#receivedDate").value,
      }) });
      showMessage(`Payment recorded. Receipt: ${result.item.receiptNumber}`, form, "success");
    } catch (error) { showMessage(error.message, form); }
  });
}

async function bindMaintenanceScheduler() {
  const form = document.querySelector("#scheduleModal form");
  if (!form) return;
  const select = document.querySelector("#scheduleTicket");
  const { items } = await api("/api/maintenance");
  select.replaceChildren(new Option("Choose a request", ""));
  for (const ticket of items.filter((entry) => entry.status !== "resolved")) {
    select.add(new Option(`${ticket.id} · ${ticket.title}`, ticket.id));
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api(`/api/maintenance/${encodeURIComponent(select.value)}`, { method: "PATCH", body: JSON.stringify({
        status: "scheduled",
        assignedTo: document.querySelector("#technician")?.value,
        visit: {
          date: document.querySelector("#scheduleDate")?.value,
          window: document.querySelector("#scheduleTime")?.value,
          note: "Scheduled by property manager.",
        },
      }) });
      showMessage(`Visit scheduled for ${result.item.id}.`, form, "success");
      await loadMaintenanceRecords(true);
    } catch (error) { showMessage(error.message, form); }
  });
}

function bindChargeCreation() {
  const existing = document.querySelector("[data-charge-form]");
  if (existing) return;
  const main = document.querySelector("main");
  if (!main) return;
  const panel = document.createElement("section");
  panel.className = "container my-3 p-3 rounded border bg-white";
  panel.dataset.chargeForm = "true";
  panel.innerHTML = `<h2 class="h5">Create rent charge</h2><form class="d-flex flex-wrap gap-2 align-items-end"><label>Tenant <select class="form-select" name="tenantId" required></select></label><label>Month <input class="form-control" name="month" type="number" min="1" max="12" value="${new Date().getMonth() + 1}" required></label><label>Year <input class="form-control" name="year" type="number" min="2020" value="${new Date().getFullYear()}" required></label><label>Due date <input class="form-control" name="dueDate" type="date" required></label><label>Amount (KES) <input class="form-control" name="amount" type="number" min="1" step="1"></label><button class="btn btn-sage" type="submit">Create charge</button></form>`;
  main.prepend(panel);
  const form = panel.querySelector("form");
  api("/api/tenants").then(({ items }) => {
    const select = form.elements.tenantId;
    select.add(new Option("Choose a tenant", ""));
    for (const tenant of items) select.add(new Option(`${tenant.name} · ${tenant.unit}`, tenant.id));
  }).catch((error) => showMessage(error.message, form));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await api("/api/payments", { method: "POST", body: JSON.stringify({ ...values, month: Number(values.month), year: Number(values.year), amount: values.amount ? Number(values.amount) : undefined }) });
      showMessage(`Rent charge ${result.item.id} created.`, form, "success");
    } catch (error) { showMessage(error.message, form); }
  });
}

async function boot() {
  document.querySelectorAll("nav .navbar-collapse").forEach((collapse) => {
    collapse.addEventListener("click", (event) => {
      const link = event.target.closest("a.nav-link");
      if (link && collapse.classList.contains("show") && window.bootstrap?.Collapse) {
        window.bootstrap.Collapse.getOrCreateInstance(collapse).hide();
      }
    });
  });
  await initLogin();
  await initLandlordRegistration();
  await initAdminRegistration();
  await initManagerAcceptance();
  const requiredRole = pageRole[page];
  if (!requiredRole) return;
  let user;
  try {
    ({ user } = await api("/api/auth/me"));
  } catch {
    location.replace(`authpage.html?return=${encodeURIComponent(page + ".html" + location.hash)}`);
    return;
  }
  if (!(Array.isArray(requiredRole) ? requiredRole.includes(user.role) : user.role === requiredRole)) {
    location.replace(roleHome[user.role]);
    return;
  }
  addLogout(user);
  bindTenantForms();
  try { await loadPageData(user); }
  catch (error) {
    document.querySelector("#adminStats")?.setAttribute("aria-busy", "false");
    document.querySelector("#adminLandlordRecords")?.setAttribute("aria-busy", "false");
    showMessage(error.message, document.querySelector("main"));
  }
}

boot().catch((error) => showMessage(error.message));
