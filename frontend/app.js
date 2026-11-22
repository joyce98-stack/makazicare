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
  "manager-profile": "manager",
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
  for (const name of nav.querySelectorAll(".small.fw-semibold")) {
    if (/^(?:rosa(?: aquino| may)?|mira cruz|joyce|alex morgan)$/i.test(name.textContent.trim())) {
      name.closest(".d-flex")?.remove();
    }
  }
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

function renderRoleNavigation(user) {
  const collapse = document.querySelector("nav .navbar-collapse");
  if (!collapse) return;
  const navbar = collapse.closest(".navbar");
  if (navbar?.classList.contains("navbar-expand-lg")) navbar.classList.replace("navbar-expand-lg", "navbar-expand-xl");
  const linksByRole = {
    landlord: [
      ["Dashboard", "landlordhomepage.html", ["landlordhomepage"]],
      ["Tenants", "tenantslist.html", ["tenantslist"]],
      ["Apartments", "apartments.html", ["apartments"]],
      ["Extensions", "extensionrequests.html", ["extensionrequests"]],
      ["Property managers", "propertymanagerlist.html", ["propertymanagerlist"]],
      ["Payment report", "paymentreport.html", ["paymentreport"]],
      ["Payment setup", "collections.html", ["collections"]],
    ],
    tenant: [
      ["Home", "tenanthomepage.html", ["tenanthomepage"]],
      ["Receipts", "tenantreceipts.html", ["tenantreceipts"]],
      ["Maintenance", "maintenance.html", ["maintenance"]],
      ["Relocation", "relocation.html", ["relocation"]],
      ["Extension", "extension.html", ["extension"]],
    ],
    manager: [
      ["Overview", "propertymanager.html#overview", ["propertymanager"]],
      ["Tenants", "tenantslist.html", ["tenantslist"]],
      ["Properties", "propertymanager.html#properties", ["propertymanager"]],
      ["Payments", "pmpaymentreport.html", ["pmpaymentreport"]],
      ["Maintenance", "pmrequests.html", ["pmrequests"]],
      ["My listing", "manager-profile.html", ["manager-profile"]],
    ],
    admin: [
      ["Overview", "adminhomepage.html#overview", ["adminhomepage"]],
      ["Landlords & properties", "adminhomepage.html#landlordsSection", ["adminhomepage"]],
      ["Register admin", "adminhomepage.html#registerAdmin", ["adminhomepage"]],
    ],
  };
  const existingLists = [...collapse.querySelectorAll("ul.navbar-nav")];
  let list = existingLists[0];
  if (!list) {
    list = document.createElement("ul");
    collapse.prepend(list);
  }
  for (const duplicateList of existingLists.slice(1)) duplicateList.remove();
  list.className = "navbar-nav me-auto gap-lg-1";
  list.replaceChildren();
  for (const [label, href] of linksByRole[user.role] || []) {
    const item = document.createElement("li");
    item.className = "nav-item";
    const link = document.createElement("a");
    const [targetPage, targetHash] = href.split("#");
    const isCurrentPage = targetPage.replace(/\.html$/, "") === page;
    const isCurrent = isCurrentPage && (!targetHash || location.hash === `#${targetHash}` || (!location.hash && targetHash === "overview"));
    link.className = `nav-link${isCurrent ? " active" : ""}`;
    if (isCurrent) link.setAttribute("aria-current", "page");
    link.href = href;
    link.textContent = label;
    item.append(link);
    list.append(item);
  }
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

function renderEmptyWorkspace(title, description, actionLabel = "Set up your first property", href = "apartments.html") {
  const main = document.querySelector("main");
  if (!main) return;
  const container = document.createElement("div");
  container.className = "container py-5";
  const heading = document.createElement("h1");
  heading.className = "page-title";
  heading.textContent = title;
  const message = document.createElement("p");
  message.className = "page-sub";
  message.textContent = description;
  const action = document.createElement("a");
  action.href = href;
  action.className = "btn btn-sage mt-3";
  action.textContent = actionLabel;
  container.append(heading, message, action);
  main.replaceChildren(container);
}

async function initLogin() {
  const form = document.querySelector("#loginForm");
  if (!form) return;
  if (location.hash === "#loginError") showMessage("We couldn’t sign you in. Check your email and password, then try again.", form);
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
          email: document.querySelector("#email").value.trim(),
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

function bindManagerAccountForm() {
  const form = page === "manager-register" ? document.querySelector("#managerRegisterForm") : null;
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#managerPassword").value;
    if (password !== document.querySelector("#managerPasswordConfirm").value) return showMessage("The passwords do not match.", form);
    const payload = {
      name: document.querySelector("#managerName").value,
      email: document.querySelector("#managerEmail").value,
      password,
      headline: document.querySelector("#managerHeadline").value,
      bio: document.querySelector("#managerBio").value,
      experienceYears: Number(document.querySelector("#managerExperience").value),
      serviceAreas: document.querySelector("#managerAreas").value.split(",").map((area) => area.trim()).filter(Boolean),
      skills: [...form.querySelectorAll('[name="managerSkill"]:checked')].map((input) => input.value),
      propertyTypes: [...form.querySelectorAll('[name="managerPropertyType"]:checked')].map((input) => input.value),
      listed: document.querySelector("#managerListed").checked,
    };
    try {
      await api("/api/auth/register-manager", { method: "POST", body: JSON.stringify(payload) });
      location.href = roleHome.manager;
    } catch (error) { showMessage(error.message, form); }
  });
}

async function bindManagerProfile() {
  const form = document.querySelector("#managerProfileForm");
  if (!form) return;
  const { item } = await api("/api/managers/profile");
  document.querySelector("#profileHeadline").value = item.headline || "";
  document.querySelector("#profileBio").value = item.bio || "";
  document.querySelector("#profileExperience").value = item.experienceYears ?? 0;
  document.querySelector("#profileAreas").value = (item.serviceAreas || []).join(", ");
  for (const input of form.querySelectorAll('[name="managerSkill"]')) input.checked = (item.skills || []).includes(input.value);
  for (const input of form.querySelectorAll('[name="managerPropertyType"]')) input.checked = (item.propertyTypes || []).includes(input.value);
  document.querySelector("#profileListed").checked = Boolean(item.listed);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/managers/profile", { method: "PATCH", body: JSON.stringify({
        headline: document.querySelector("#profileHeadline").value,
        bio: document.querySelector("#profileBio").value,
        experienceYears: Number(document.querySelector("#profileExperience").value),
        serviceAreas: document.querySelector("#profileAreas").value.split(",").map((area) => area.trim()).filter(Boolean),
        skills: [...form.querySelectorAll('[name="managerSkill"]:checked')].map((input) => input.value),
        propertyTypes: [...form.querySelectorAll('[name="managerPropertyType"]:checked')].map((input) => input.value),
        listed: document.querySelector("#profileListed").checked,
      }) });
      showMessage(result.item.listed ? "Your manager listing is live." : "Your manager listing is hidden.", form, "success");
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
  const main = document.querySelector("main");
  if (!main) return;
  main.replaceChildren();
  const container = document.createElement("div");
  container.className = "container app py-4";
  const header = document.createElement("div");
  header.className = "d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4";
  const heading = document.createElement("h1");
  heading.className = "page-title mb-0";
  heading.innerHTML = 'Rent <em>extensions.</em>';
  const back = document.createElement("a");
  back.className = "btn btn-outline-earth";
  back.href = "landlordhomepage.html";
  back.innerHTML = '<i class="bi bi-arrow-left" aria-hidden="true"></i> Back to dashboard';
  header.append(heading, back);
  const panel = document.createElement("section");
  panel.className = "app-data-panel";
  const panelHeading = document.createElement("h2");
  panelHeading.className = "app-data-panel-title";
  panelHeading.textContent = "Extension requests";
  panel.append(panelHeading);
  if (!data.items.length) {
    const empty = document.createElement("p");
    empty.className = "mb-0";
    empty.textContent = "No extension requests yet. Requests from your tenants will appear here.";
    panel.append(empty);
  }
  container.append(header, panel);
  main.append(container);
  for (const item of data.items) {
    const row = document.createElement("article");
    row.className = `card-ext${item.status === "pending" ? " pending-highlight" : ""}`;
    const top = document.createElement("div");
    top.className = "ext-head";
    const who = document.createElement("div");
    who.className = "ext-who";
    const unit = document.createElement("span");
    unit.className = "unit-badge unit-pill";
    unit.textContent = item.tenant?.unit || "—";
    const tenant = document.createElement("div");
    tenant.className = "tenant-name";
    const tenantName = document.createElement("b");
    tenantName.textContent = item.tenant?.name || "Tenant";
    const propertyName = document.createElement("span");
    propertyName.textContent = item.property?.name || "Property";
    tenant.append(tenantName, propertyName);
    who.append(unit, tenant);
    const status = document.createElement("span");
    status.className = `status-badge badge-${item.status === "declined" ? "denied" : item.status}`;
    status.textContent = item.status === "pending" ? "Needs your decision" : item.status;
    top.append(who, status);
    const facts = document.createElement("div");
    facts.className = "ext-facts";
    const entries = [
      ["Monthly rent", currency.format(item.amount)],
      ["Standard due date", item.currentDueDate],
      ["Requested date", item.requestedPaymentDate],
      ["Payment plan", item.paymentPlan === "split" ? `Split · ${currency.format(item.firstPaymentAmount || 0)} first` : "Full payment"],
    ];
    for (const [label, value] of entries) {
      const cell = document.createElement("div");
      cell.className = "fact-cell";
      const caption = document.createElement("small");
      caption.textContent = label;
      const content = document.createElement("b");
      content.textContent = value;
      cell.append(caption, content);
      facts.append(cell);
    }
    row.append(top, facts);
    if (item.note) {
      const note = document.createElement("p");
      note.className = "mt-3 mb-0";
      note.textContent = item.note;
      row.append(note);
    }
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
    panel.append(row);
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
  if (user.role === "manager" && page !== "manager-profile") {
    const { items: assignedProperties } = await api("/api/properties");
    if (!assignedProperties.length) {
      renderEmptyWorkspace("Your manager workspace is ready", "There is no property or tenant data to show yet. Your assigned properties and activity will appear here when they are added.", "Manage my listing", "manager-profile.html");
      return;
    }
  }
  if (user.role === "tenant" && page !== "tenanthomepage") {
    const [payments, maintenance, extensions, relocations] = await Promise.all([
      api("/api/payments"), api("/api/maintenance"), api("/api/extensions"), api("/api/relocations"),
    ]);
    const hasActivity = [payments, maintenance, extensions, relocations]
      .some((result) => Array.isArray(result.items) && result.items.length > 0);
    if (!hasActivity) {
      renderEmptyWorkspace("Nothing here yet", "This page will show your records and activity when they are added to your account.", "Back to my home", "tenanthomepage.html");
      return;
    }
  }
  if (page === "propertymanager" && user.role === "manager") {
    const [dashboard, properties] = await Promise.all([api("/api/dashboard"), api("/api/properties")]);
    renderManagerWorkspace(user, dashboard, properties.items);
    return;
  }
  if (user.role === "landlord" && page !== "apartments") {
    const { items: ownedProperties } = await api("/api/properties");
    if (!ownedProperties.length) {
      renderEmptyWorkspace("Your workspace is ready", "Your tenants, payments, and property managers will appear here after you add your first property.");
      const workspace = document.querySelector("main .container") || document.querySelector("main");
      if (workspace) {
        const paymentSetup = document.createElement("a");
        paymentSetup.className = "btn btn-outline-earth mt-3 ms-2";
        paymentSetup.href = "collections.html";
        paymentSetup.innerHTML = '<i class="bi bi-credit-card me-1" aria-hidden="true"></i> Add payment details';
        workspace.append(paymentSetup);
      }
      return;
    }
  }
  if (page === "landlordhomepage" && user.role === "landlord") {
    const [dashboard, { items: properties }] = await Promise.all([api("/api/dashboard"), api("/api/properties")]);
    renderLandlordDashboard(user, dashboard, properties);
    return;
  } else if (page === "tenanthomepage" || page === "landlordhomepage" || page === "propertymanager") {
    const data = await api("/api/dashboard");
    if (user.role === "tenant") {
      const propertyName = document.querySelector("#tenantPropertyName");
      const propertyAddress = document.querySelector("#tenantPropertyAddress");
      const tenantName = document.querySelector("#tenantFullName");
      const unit = document.querySelector("#tenantUnit");
      const rent = document.querySelector("#tenantRent");
      const leaseDate = document.querySelector("#tenantLeaseDate");
      const propertyManager = document.querySelector("#tenantPropertyManager");
      const unitTag = document.querySelector("#tenantUnitTag");
      const propertyPhoto = document.querySelector("#tenantPropertyPhoto");
      if (propertyName) propertyName.textContent = data.property?.name || "Your home";
      if (propertyAddress) {
        const icon = document.createElement("i");
        icon.className = "bi bi-geo-alt me-1";
        icon.setAttribute("aria-hidden", "true");
        propertyAddress.replaceChildren(icon, document.createTextNode(data.property?.address || "Property location not set"));
      }
      if (tenantName) tenantName.textContent = data.tenant.name;
      if (unit) unit.textContent = data.tenant.unit || "—";
      if (rent) rent.textContent = currency.format(data.tenant.rent);
      if (leaseDate) leaseDate.textContent = data.tenant.occupiedSince
        ? new Date(`${data.tenant.occupiedSince}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
        : "Not set";
      if (propertyManager) propertyManager.textContent = data.propertyManager?.name || "Not assigned";
      if (unitTag) unitTag.lastChild.textContent = ` Unit: ${data.tenant.unit || "—"}`;
      if (propertyPhoto) {
        if (data.property?.photoUrl) propertyPhoto.src = data.property.photoUrl;
        else {
          propertyPhoto.remove();
          const pane = document.querySelector(".window-pane");
          pane?.classList.add("window-pane-empty");
          if (pane) {
            const icon = document.createElement("i");
            icon.className = "bi bi-buildings";
            icon.setAttribute("aria-hidden", "true");
            pane.append(icon);
          }
        }
        propertyPhoto.alt = data.property ? `${data.property.name} property` : "Property photo not available";
      }
      const dueDate = document.querySelector("#tenantDueDate");
      const dueNote = document.querySelector("#tenantDueNote");
      if (dueDate) dueDate.textContent = data.nextPayment?.dueDate
        ? new Date(`${data.nextPayment.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" })
        : data.tenant.rentDueDay ? `${data.tenant.rentDueDay}${({1:"st",2:"nd",3:"rd"}[data.tenant.rentDueDay] || "th")} of each month` : "Not set";
      if (dueNote) dueNote.textContent = data.nextPayment ? `Payment status: ${data.nextPayment.status}` : "Monthly rent due date";
      const mpesaText = document.querySelector("#tenantMpesaDetails");
      if (mpesaText && data.paymentDetails?.mpesaShortCode) mpesaText.textContent = `PayBill: ${data.paymentDetails.mpesaShortCode} · Account: ${data.paymentDetails.paymentReference}`;
      else if (mpesaText) mpesaText.textContent = "PayBill details are not set up yet.";
      const bank = data.paymentDetails?.bank;
      if (document.querySelector("#tenantBankName")) {
        document.querySelector("#tenantBankName").textContent = bank?.bankName || "Bank details are not set up yet.";
        document.querySelector("#tenantBankAccountName").textContent = bank?.bankAccountName ? `Account name: ${bank.bankAccountName}` : "";
        document.querySelector("#tenantBankAccountNumber").textContent = bank?.bankAccountNumber ? `Account number: ${bank.bankAccountNumber}` : "";
      }
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
  if (page === "propertymanager") await loadRelocations(true);
  if (page === "paymentreport" || page === "pmpaymentreport") {
    const data = await api("/api/reports/payments");
    if (!data.items.length && user.role === "landlord") {
      renderEmptyWorkspace("No rent payments yet", "Payments will appear after you add a property, onboard tenants, and create rent charges.", "Manage tenants", "tenantslist.html");
    }
    addLivePanel("Live payment report", [`${currency.format(data.summary.billed)} billed`, `${currency.format(data.summary.collected)} collected`, `${currency.format(data.summary.outstanding)} outstanding`, `${data.summary.collectionRate}% collected`]);
    await bindPaymentEntry();
  }
  if (page === "tenantslist") {
    const data = await api("/api/tenants");
    if (!data.items.length) {
      renderEmptyWorkspace("No tenants yet", "Your tenant list is empty. Add your first tenant to a property to start managing leases and rent.", "Add a tenant", "#tenant-create");
      bindTenantCreateForm();
      document.querySelector("[data-record-panel]")?.setAttribute("id", "tenant-create");
      return;
    }
    renderTenantDirectory(data.items);
    bindTenantCreateForm();
  }
  if (page === "apartments") {
    const data = await api("/api/properties");
    renderProperties(data.items);
    bindPropertyForm(data.items);
    if (location.hash === "#addModal" && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(document.querySelector("#addModal")).show();
    }
  }
  if (page === "propertymanagerlist") {
    const [assignments, directory, properties] = await Promise.all([
      api("/api/managers"), api("/api/manager-directory"), api("/api/properties"),
    ]);
    renderManagerMarketplace(assignments, directory.items, properties.items);
    await bindManagerInvite();
  }
  if (page === "collections") await loadCollectionSettings();
}

function renderLandlordDashboard(user, dashboard, properties) {
  const main = document.querySelector("main");
  if (!main) return;
  main.replaceChildren();
  const container = document.createElement("div");
  container.className = "container";
  const heading = document.createElement("div");
  heading.className = "d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4";
  const intro = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = "Your property portfolio.";
  const subtitle = document.createElement("p");
  subtitle.className = "page-sub mb-0";
  subtitle.textContent = `Welcome, ${user.name}. Here is your portfolio overview.`;
  intro.append(title, subtitle);
  const addProperty = document.createElement("a");
  addProperty.className = "btn btn-sage";
  addProperty.href = "apartments.html#addModal";
  addProperty.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i> Add apartment';
  heading.append(intro, addProperty);

  const row = document.createElement("div");
  row.className = "row g-4 align-items-stretch";
  const propertyColumn = document.createElement("div");
  propertyColumn.className = "col-lg-5";
  const propertyList = document.createElement("div");
  propertyList.className = "d-grid gap-3 h-100";
  for (const property of properties) {
    const card = document.createElement("article");
    card.className = "property-card d-flex flex-column";
    const photo = document.createElement("div");
    photo.className = "property-photo";
    if (property.photoUrl) {
      const image = document.createElement("img");
      image.src = property.photoUrl;
      image.alt = `${property.name} property`;
      photo.append(image);
    } else {
      photo.classList.add("property-photo-placeholder");
      photo.innerHTML = '<i class="bi bi-buildings" aria-hidden="true"></i>';
    }
    const photoTag = document.createElement("span");
    photoTag.className = "photo-tag";
    photoTag.innerHTML = '<i class="bi bi-buildings" aria-hidden="true"></i>';
    photoTag.append(document.createTextNode(` ${property.name}`));
    photo.append(photoTag);
    const body = document.createElement("div");
    body.className = "property-body d-flex flex-column flex-grow-1";
    const name = document.createElement("h2");
    name.className = "property-name";
    name.textContent = property.name;
    const address = document.createElement("p");
    address.className = "property-address";
    address.textContent = property.address;
    const houseNames = document.createElement("p");
    houseNames.className = "small text-muted mb-3";
    houseNames.textContent = property.units?.length ? `Houses: ${property.units.map((unit) => unit.name).join(", ")}` : "No houses listed yet";
    const units = document.createElement("div");
    units.className = "units";
    for (const [value, label] of [[property.unitCount, "Units"], [property.occupiedCount, "Occupied"], [Math.max(0, property.unitCount - property.occupiedCount), "Vacant"]]) {
      const stat = document.createElement("div");
      stat.className = "unit-stat";
      const amount = document.createElement("b");
      amount.textContent = value;
      const caption = document.createElement("span");
      caption.textContent = label;
      stat.append(amount, caption);
      units.append(stat);
    }
    const link = document.createElement("a");
    link.className = "card-link mt-auto";
    link.href = `apartments.html?edit=${encodeURIComponent(property.id)}#addModal`;
    link.innerHTML = 'Edit details <i class="bi bi-pencil" aria-hidden="true"></i>';
    body.append(name, address, houseNames, units, link);
    card.append(photo, body);
    propertyList.append(card);
  }
  propertyColumn.append(propertyList);

  const summary = dashboard.summary || { billed: 0, collected: 0, outstanding: 0, collectionRate: 0 };
  const summaryColumn = document.createElement("div");
  summaryColumn.className = "col-lg-7";
  const panel = document.createElement("section");
  panel.className = "panel h-100 d-flex flex-column";
  const panelHead = document.createElement("div");
  panelHead.className = "panel-head";
  const panelTitle = document.createElement("h2");
  panelTitle.textContent = "Rent summary";
  const period = document.createElement("span");
  period.className = "status";
  period.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date());
  panelHead.append(panelTitle, period);
  const panelBody = document.createElement("div");
  panelBody.className = "panel-body d-flex flex-column flex-grow-1";
  const ringWrap = document.createElement("div");
  ringWrap.className = "ring-wrap";
  const ring = document.createElement("div");
  ring.className = "ring";
  ring.setAttribute("role", "img");
  ring.setAttribute("aria-label", `${summary.collectionRate}% of rent charges collected`);
  ring.innerHTML = '<svg width="210" height="210" viewBox="0 0 210 210" aria-hidden="true"><circle class="track" cx="105" cy="105" r="84" fill="none" stroke-width="16"></circle><circle class="fill" cx="105" cy="105" r="84" fill="none" stroke-width="16"></circle></svg>';
  const fill = ring.querySelector(".fill");
  fill.style.strokeDasharray = `${527.8 * Math.min(100, Math.max(0, summary.collectionRate)) / 100} 527.8`;
  const center = document.createElement("div");
  center.className = "ring-center";
  const percent = document.createElement("b");
  percent.textContent = `${summary.collectionRate}%`;
  const collectedLabel = document.createElement("span");
  collectedLabel.textContent = "Collected";
  center.append(percent, collectedLabel);
  ring.append(center);
  ringWrap.append(ring);
  const metrics = document.createElement("div");
  metrics.className = "metrics";
  for (const [icon, label, sub, value, color] of [
    ["bi-cash-stack", "Rent billed", `${dashboard.tenants} tenant accounts`, currency.format(summary.billed), ""],
    ["bi-wallet2", "Rent collected", "Payments received", currency.format(summary.collected), "sage"],
    ["bi-hourglass-split", "Outstanding", `${summary.overdueCount || 0} overdue or extended`, currency.format(summary.outstanding), "brown"],
  ]) {
    const metric = document.createElement("div");
    metric.className = "metric";
    const iconBox = document.createElement("span");
    iconBox.className = `metric-icon ${color === "sage" ? "tint-sage" : "tint-brown"}`;
    iconBox.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
    const detail = document.createElement("div");
    const metricLabel = document.createElement("p");
    metricLabel.className = "metric-label";
    metricLabel.textContent = label;
    const metricSub = document.createElement("p");
    metricSub.className = "metric-sub";
    metricSub.textContent = sub;
    detail.append(metricLabel, metricSub);
    const amount = document.createElement("p");
    amount.className = `metric-value ${color}`;
    amount.textContent = value;
    metric.append(iconBox, detail, amount);
    metrics.append(metric);
  }
  panelBody.append(ringWrap, metrics);
  const panelFoot = document.createElement("div");
  panelFoot.className = "panel-foot mt-auto";
  panelFoot.innerHTML = `<i class="bi bi-people me-1" aria-hidden="true"></i>${dashboard.tenants} active tenant${dashboard.tenants === 1 ? "" : "s"} across ${properties.length} propert${properties.length === 1 ? "y" : "ies"} · <a href="paymentreport.html">View payment report</a>`;
  panel.append(panelHead, panelBody, panelFoot);
  summaryColumn.append(panel);
  row.append(propertyColumn, summaryColumn);
  container.append(heading, row);
  main.replaceChildren(container);
}

function renderManagerWorkspace(user, dashboard, properties) {
  if (!properties.length) {
    renderEmptyWorkspace("Your manager workspace is ready", "Create or update your public profile so landlords can find your skills, experience, and service areas.", "Manage my listing", "manager-profile.html");
    return;
  }
  const main = document.querySelector("main");
  if (!main) return;
  main.replaceChildren();
  const container = document.createElement("div");
  container.className = "container py-5";
  const header = document.createElement("div");
  header.className = "d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4";
  const text = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = `Welcome, ${user.name}.`;
  const description = document.createElement("p");
  description.className = "page-sub mb-0";
  description.textContent = "Here are the properties assigned to your care.";
  text.append(title, description);
  const edit = document.createElement("a");
  edit.href = "manager-profile.html";
  edit.className = "btn btn-outline-earth";
  edit.textContent = "Manage my listing";
  header.append(text, edit);
  const grid = document.createElement("div");
  grid.className = "row g-4";
  for (const property of properties) {
    const column = document.createElement("div");
    column.className = "col-md-6 col-xl-4";
    const card = document.createElement("article");
    card.className = "property-card h-100";
    const body = document.createElement("div");
    body.className = "property-body";
    const name = document.createElement("h2");
    name.className = "property-name";
    name.textContent = property.name;
    const address = document.createElement("p");
    address.className = "property-address";
    address.textContent = property.address;
    const summary = document.createElement("p");
    summary.className = "mt-3 mb-0";
    summary.textContent = `${property.occupiedCount} of ${property.unitCount} homes occupied`;
    body.append(name, address, summary);
    card.append(body);
    column.append(card);
    grid.append(column);
  }
  container.append(header, grid);
  main.replaceChildren(container);
}

function renderTenantDirectory(tenants) {
  const main = document.querySelector("main");
  if (!main) return;
  main.replaceChildren();
  const container = document.createElement("div");
  container.className = "container app";
  const header = document.createElement("div");
  header.className = "mb-4";
  const heading = document.createElement("h1");
  heading.className = "page-title";
  heading.textContent = "Your tenants.";
  const description = document.createElement("p");
  description.className = "page-sub";
  description.textContent = "Tenant records for properties you manage.";
  header.append(heading, description);
  const rentRoll = tenants.reduce((total, tenant) => total + Number(tenant.rent || 0), 0);
  const stats = document.createElement("div");
  stats.className = "stats mb-4";
  for (const [icon, label, value] of [
    ["bi-people", "Tenants", tenants.length],
    ["bi-cash-stack", "Monthly rent roll", currency.format(rentRoll)],
    ["bi-buildings", "Properties", new Set(tenants.map((tenant) => tenant.propertyId)).size],
  ]) {
    const stat = document.createElement("div");
    stat.className = "stat";
    const symbol = document.createElement("span");
    symbol.className = "stat-icon tint-sage";
    symbol.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
    const detail = document.createElement("div");
    const amount = document.createElement("b");
    amount.textContent = value;
    const title = document.createElement("span");
    title.textContent = label;
    detail.append(amount, title);
    stat.append(symbol, detail);
    stats.append(stat);
  }
  const panel = document.createElement("section");
  panel.className = "panel";
  const panelHead = document.createElement("div");
  panelHead.className = "panel-head";
  const panelTitle = document.createElement("h2");
  panelTitle.textContent = "All tenants";
  const count = document.createElement("span");
  count.className = "status";
  count.textContent = `${tenants.length} saved`;
  panelHead.append(panelTitle, count);
  const columnHead = document.createElement("div");
  columnHead.className = "rhead";
  columnHead.innerHTML = "<span>Unit</span><span>Tenant</span><span>Monthly rent</span><span>Occupied since</span><span>Status</span><span></span>";
  const rows = document.createElement("div");
  rows.className = "rows";
  for (const [index, tenant] of tenants.entries()) {
    const row = document.createElement("details");
    row.className = "trow";
    row.style.setProperty("--u", index + 1);
    const summary = document.createElement("summary");
    const unitCell = document.createElement("span");
    unitCell.className = "c-unit";
    const unitBadge = document.createElement("span");
    unitBadge.className = "unit-badge";
    unitBadge.textContent = tenant.unit || "—";
    unitCell.append(unitBadge);
    const who = document.createElement("span");
    who.className = "who";
    const avatar = document.createElement("span");
    avatar.className = "who-avatar";
    avatar.textContent = tenant.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const whoText = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = tenant.name;
    const property = document.createElement("span");
    property.textContent = tenant.property?.name || "Property";
    whoText.append(name, property);
    who.append(avatar, whoText);
    const meta = document.createElement("span");
    meta.className = "c-meta";
    const rent = document.createElement("span");
    rent.className = "c-rent";
    const rentValue = document.createElement("b");
    rentValue.textContent = currency.format(tenant.rent);
    const rentPeriod = document.createElement("span");
    rentPeriod.textContent = "/mo";
    rent.append(rentValue, rentPeriod);
    const occupied = document.createElement("span");
    occupied.className = "c-date";
    const since = document.createElement("b");
    since.textContent = tenant.occupiedSince || "—";
    const sinceLabel = document.createElement("span");
    sinceLabel.textContent = "Occupied";
    occupied.append(since, sinceLabel);
    const tenantStatus = document.createElement("span");
    const chip = document.createElement("span");
    chip.className = "chip chip-open";
    chip.textContent = tenant.status || "active";
    tenantStatus.append(chip);
    meta.append(rent, occupied, tenantStatus);
    const chevron = document.createElement("span");
    chevron.className = "chev";
    chevron.innerHTML = '<i class="bi bi-chevron-down" aria-hidden="true"></i>';
    summary.append(unitCell, who, meta, chevron);
    const expanded = document.createElement("div");
    expanded.className = "tdetail";
    const details = document.createElement("dl");
    details.className = "tdetail-grid mb-0";
    for (const [label, value] of [["Email", tenant.email], ["Phone", tenant.phone || "Not provided"], ["Property location", tenant.property?.address || "Not provided"]]) {
      const field = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      field.append(term, description);
      details.append(field);
    }
    expanded.append(details);
    row.append(summary, expanded);
    rows.append(row);
  }
  panel.append(panelHead, columnHead, rows);
  container.append(header, stats, panel);
  main.append(container);
}

function renderManagerMarketplace(assignments, directory, properties) {
  const records = document.querySelector("#managerRecords");
  const directoryPanel = document.querySelector("#managerDirectory");
  records?.replaceChildren();
  directoryPanel?.replaceChildren();
  const stats = document.querySelectorAll(".stats-strip .stat-item");
  const assignedUnits = new Map();
  for (const assignment of assignments.items) for (const property of assignment.properties || []) assignedUnits.set(property.id, property.unitCount);
  if (stats[0]) {
    stats[0].querySelector("b").textContent = `${assignments.items.length} Active`;
    stats[0].querySelector("span:last-child").textContent = "Assigned managers";
  }
  if (stats[1]) {
    const pending = assignments.invitations.filter((invite) => invite.status === "pending").length;
    stats[1].querySelector("b").textContent = `${pending} Pending`;
    stats[1].querySelector("span:last-child").textContent = "Invitations awaiting setup";
  }
  if (stats[2]) {
    const units = [...assignedUnits.values()].reduce((total, count) => total + count, 0);
    stats[2].querySelector("b").textContent = `${units} Units`;
    stats[2].querySelector("span:last-child").textContent = "With assigned managers";
  }
  const makeManagerCard = ({ name, headline, status, propertyNames = [], email = "", profile = null, assigned = false }) => {
    const card = document.createElement("article");
    card.className = "card-manager";
    const header = document.createElement("div");
    header.className = "mgr-head";
    const who = document.createElement("div");
    who.className = "mgr-who";
    const avatar = document.createElement("span");
    avatar.className = "mgr-avatar";
    avatar.textContent = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const title = document.createElement("div");
    title.className = "mgr-title";
    const managerName = document.createElement("b");
    managerName.textContent = name;
    const subTitle = document.createElement("span");
    subTitle.textContent = headline || "Property manager";
    title.append(managerName, subTitle);
    who.append(avatar, title);
    const badge = document.createElement("span");
    badge.className = `status-badge ${status === "Active" || status === "Available" ? "badge-active" : "badge-pending"}`;
    badge.textContent = status;
    header.append(who, badge);
    card.append(header);
    if (profile) {
      const bio = document.createElement("p");
      bio.className = "mt-3 mb-0";
      bio.textContent = profile.bio;
      card.append(bio);
      const grid = document.createElement("div");
      grid.className = "mgr-grid mt-3";
      for (const [label, values] of [["Skills", profile.skills], ["Property types", profile.propertyTypes], ["Service areas", profile.serviceAreas]]) {
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        const caption = document.createElement("small");
        caption.textContent = label;
        const value = document.createElement("b");
        value.textContent = values.join(" · ");
        cell.append(caption, value);
        grid.append(cell);
      }
      const experience = document.createElement("p");
      experience.className = "small text-muted mt-2 mb-0";
      experience.textContent = `${profile.experienceYears} years of experience`;
      card.append(grid, experience);
    } else {
      const details = document.createElement("div");
      details.className = "mgr-grid mt-3";
      const propertiesCell = document.createElement("div");
      propertiesCell.className = "grid-cell";
      const caption = document.createElement("small");
      caption.textContent = "Assigned properties";
      const value = document.createElement("b");
      value.textContent = propertyNames.join(" · ") || "No property assigned";
      propertiesCell.append(caption, value);
      const contactCell = document.createElement("div");
      contactCell.className = "grid-cell";
      const emailLabel = document.createElement("small");
      emailLabel.textContent = "Email";
      const emailValue = document.createElement("b");
      emailValue.textContent = email || "—";
      contactCell.append(emailLabel, emailValue);
      details.append(propertiesCell, contactCell);
      card.append(details);
    }
    return card;
  };
  if (records) {
    if (!assignments.items.length && !assignments.invitations.length) {
      const empty = document.createElement("p");
      empty.className = "app-data-panel";
      empty.textContent = "You have not assigned or invited a property manager yet.";
      records.append(empty);
    }
    for (const assignment of assignments.items) {
      records.append(makeManagerCard({
        name: assignment.user?.name || "Property manager",
        headline: assignment.user?.managerProfile?.headline || "Assigned manager",
        status: "Active",
        propertyNames: (assignment.properties || []).map((property) => property.name),
        email: assignment.user?.email,
      }));
    }
    for (const invite of assignments.invitations) records.append(makeManagerCard({ name: invite.name, headline: invite.email, status: invite.status }));
    const callout = document.createElement("div");
    callout.className = "invite-callout";
    callout.innerHTML = '<h3>Have a manager in mind?</h3><p>Invite them directly by email, or choose a listed manager below.</p>';
    const inviteButton = document.createElement("button");
    inviteButton.className = "btn btn-sage";
    inviteButton.type = "button";
    inviteButton.dataset.bsToggle = "modal";
    inviteButton.dataset.bsTarget = "#onboardModal";
    inviteButton.textContent = "Invite by email";
    callout.append(inviteButton);
    records.append(callout);
  }
  if (directoryPanel) {
    if (!directory.length) {
      const empty = document.createElement("p");
      empty.className = "app-data-panel";
      empty.textContent = "No property managers have published a listing yet. You can invite someone you know by email.";
      directoryPanel.append(empty);
    }
    for (const profile of directory) {
      const card = makeManagerCard({ name: profile.name, headline: profile.headline, status: "Available", profile });
      const form = document.createElement("div");
      form.className = "mgr-actions mt-3";
      const picker = document.createElement("div");
      picker.className = "d-flex flex-wrap gap-3";
      picker.setAttribute("aria-label", `Properties to assign to ${profile.name}`);
      for (const property of properties) {
        const label = document.createElement("label");
        label.className = "form-check form-check-inline";
        const checkbox = document.createElement("input");
        checkbox.className = "form-check-input";
        checkbox.type = "checkbox";
        checkbox.value = property.id;
        checkbox.checked = assignments.items.some((assignment) => assignment.user?.id === profile.id && assignment.propertyIds.includes(property.id));
        const text = document.createElement("span");
        text.className = "form-check-label";
        text.textContent = property.name;
        label.append(checkbox, text);
        picker.append(label);
      }
      const assign = document.createElement("button");
      assign.className = "btn btn-sage btn-sm";
      assign.type = "button";
      assign.textContent = "Assign to selected properties";
      assign.addEventListener("click", async () => {
        const propertyIds = [...picker.querySelectorAll("input:checked")].map((input) => input.value);
        assign.disabled = true;
        try {
          await api("/api/managers/assign-listed", { method: "POST", body: JSON.stringify({ managerId: profile.id, propertyIds }) });
          location.reload();
        } catch (error) {
          showMessage(error.message, card);
          assign.disabled = false;
        }
      });
      form.append(picker, assign);
      card.append(form);
      directoryPanel.append(card);
    }
  }
}

function renderProperties(properties) {
  const list = document.querySelector(".apartments");
  if (!list) return;
  list.setAttribute("aria-busy", "false");
  list.replaceChildren();
  if (!properties.length) {
    const empty = document.createElement("p");
    empty.className = "app-data-panel";
    empty.textContent = "No apartments are linked to this landlord account. If you expected existing details, sign in with the landlord account that owns them, or add a property for this account.";
    list.append(empty);
    return;
  }
  for (const property of properties) {
    const card = document.createElement("article");
    card.className = "apt";
    const photo = document.createElement("div");
    photo.className = "apt-photo";
    if (property.photoUrl) {
      const image = document.createElement("img");
      image.src = property.photoUrl;
      image.alt = `${property.name} property photo`;
      photo.append(image);
    } else {
      photo.classList.add("apt-photo-placeholder");
      photo.setAttribute("aria-label", "No property photo added");
      photo.innerHTML = '<i class="bi bi-buildings" aria-hidden="true"></i>';
    }
    card.append(photo);
    const body = document.createElement("div");
    body.className = "apt-body";
    const heading = document.createElement("h2");
    heading.className = "apt-name";
    heading.textContent = property.name;
    const location = document.createElement("p");
    location.className = "apt-meta";
    location.textContent = property.address;
    body.append(heading, location);
    const table = document.createElement("table");
    table.className = "types";
    table.innerHTML = "<thead><tr><th scope=\"col\">House type</th><th scope=\"col\">House names</th><th scope=\"col\" class=\"num\">Houses</th><th scope=\"col\" class=\"num\">Price / month</th></tr></thead>";
    const tbody = document.createElement("tbody");
    const houseTypes = property.houseTypes?.length ? property.houseTypes : [{ name: property.type === "house" ? "House" : "Apartment unit", count: property.unitCount, rent: null }];
    for (const type of houseTypes) {
      const tr = document.createElement("tr");
      const label = document.createElement("td");
      label.className = "type";
      label.textContent = type.name;
      const names = document.createElement("td");
      names.textContent = property.units?.filter((unit) => unit.type === type.name).map((unit) => unit.name).join(", ") || "Names not set";
      const count = document.createElement("td");
      count.className = "num";
      count.textContent = type.count;
      const rent = document.createElement("td");
      rent.className = "num price";
      rent.textContent = type.rent !== null && type.rent !== undefined && Number.isFinite(Number(type.rent)) ? currency.format(type.rent) : "Not set";
      tr.append(label, names, count, rent);
      tbody.append(tr);
    }
    const foot = document.createElement("tfoot");
    const totalRow = document.createElement("tr");
    const totalLabel = document.createElement("td");
    totalLabel.textContent = "Total";
    const totalCount = document.createElement("td");
    totalCount.className = "num";
    totalCount.textContent = property.unitCount;
    totalRow.append(totalLabel, document.createElement("td"), totalCount, document.createElement("td"));
    foot.append(totalRow);
    table.append(tbody, foot);
    body.append(table);
    const edit = document.createElement("a");
    edit.className = "card-link mt-3";
    edit.href = `apartments.html?edit=${encodeURIComponent(property.id)}#addModal`;
    edit.innerHTML = 'Edit details <i class="bi bi-pencil" aria-hidden="true"></i>';
    body.append(edit);
    card.append(body);
    list.append(card);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "add-card";
  add.dataset.bsToggle = "modal";
  add.dataset.bsTarget = "#addModal";
  add.innerHTML = '<span class="add-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span><span><b>Add another apartment</b><small>Name it, then list its house types and prices</small></span>';
  list.append(add);
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
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
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
  form.innerHTML = '<label>Name <input class="form-control" name="name" required></label><label>Email <input class="form-control" name="email" type="email" required></label><label>Phone <input class="form-control" name="phone" type="tel" required></label><label>Property <select class="form-select" name="propertyId" required></select></label><label>House number <select class="form-select" name="unitId" required disabled><option value="">Choose a property first</option></select></label><label>Monthly rent (KES) <input class="form-control" name="rent" type="number" min="1" step="1" required readonly></label><label>Lease start date <input class="form-control" name="occupiedSince" type="date" required></label><label>Rent due day <input class="form-control" name="rentDueDay" type="number" min="1" max="28" value="1" required></label><button class="btn btn-sage" type="submit">Add tenant</button>';
  records.append(form);
  let properties = [];
  api("/api/properties").then(({ items }) => {
    properties = items;
    const select = form.elements.propertyId;
    select.add(new Option("Choose a property", ""));
    for (const property of items) select.add(new Option(property.name, property.id));
    const unitPicker = form.elements.unitId;
    select.addEventListener("change", () => {
      const property = properties.find((entry) => entry.id === select.value);
      const available = property?.units?.filter((unit) => unit.status !== "occupied") || [];
      unitPicker.replaceChildren(new Option(available.length ? "Choose a house" : "No vacant houses", ""));
      unitPicker.disabled = !available.length;
      for (const unit of available) unitPicker.add(new Option(`${unit.name} · ${unit.type}`, unit.id));
      form.elements.rent.value = "";
    });
    unitPicker.addEventListener("change", () => {
      const property = properties.find((entry) => entry.id === select.value);
      const unit = property?.units?.find((entry) => entry.id === unitPicker.value);
      form.elements.rent.value = unit?.rent || "";
    });
  }).catch((error) => showMessage(error.message, form));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const property = properties.find((entry) => entry.id === values.propertyId);
    const selectedUnit = property?.units?.find((entry) => entry.id === values.unitId);
    if (!selectedUnit) { showMessage("Choose a vacant house before adding the tenant.", form); return; }
    try {
      const result = await api("/api/tenants", { method: "POST", body: JSON.stringify({ ...values, unit: selectedUnit.name, rent: Number(values.rent) }) });
      const delivery = result.notifications;
      const statusText = delivery ? ` Email: ${delivery.email.status.replaceAll("_", " ")}; SMS: ${delivery.sms.status.replaceAll("_", " ")}.` : "";
      showMessage(`${result.item.name} was added.${statusText}`, form, "success");
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

async function bindManagerInvite() {
  const form = document.querySelector("#onboardModal form");
  if (!form) return;
  const propertyPicker = form.querySelector(".prop-select-box");
  if (propertyPicker) {
    const { items } = await api("/api/properties");
    propertyPicker.replaceChildren();
    for (const property of items) {
      const wrapper = document.createElement("div");
      wrapper.className = "form-check";
      const checkbox = document.createElement("input");
      checkbox.className = "form-check-input";
      checkbox.type = "checkbox";
      checkbox.name = "assigned_prop";
      checkbox.value = property.id;
      checkbox.id = `assigned-${property.id}`;
      checkbox.checked = true;
      const label = document.createElement("label");
      label.className = "form-check-label";
      label.htmlFor = checkbox.id;
      label.textContent = property.name;
      wrapper.append(checkbox, label);
      propertyPicker.append(wrapper);
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const propertyIds = [...form.querySelectorAll('[name="assigned_prop"]:checked')].map((input) => input.value);
    try {
      const result = await api("/api/managers/invitations", { method: "POST", body: JSON.stringify({
        name: document.querySelector("#mgrName").value,
        email: document.querySelector("#mgrEmail").value,
        phone: document.querySelector("#mgrPhone").value,
        propertyIds,
      }) });
      const delivery = result.notifications;
      showMessage(`Invitation created. Email: ${delivery.email.status.replaceAll("_", " ")}; SMS: ${delivery.sms.status.replaceAll("_", " ")}. Setup link: `, form, "success");
      const message = form.querySelector(":scope > .app-message");
      const link = document.createElement("a");
      link.href = result.acceptanceUrl;
      link.textContent = result.acceptanceUrl;
      link.className = "d-block text-break mt-2";
      message.append(link);
    } catch (error) { showMessage(error.message, form); }
  });
}

function bindPropertyForm(properties = []) {
  const form = document.querySelector("#addModal form");
  if (!form) return;
  if (form.dataset.bound) return;
  form.dataset.bound = "true";
  const editId = new URLSearchParams(location.search).get("edit");
  let editing = properties.find((property) => property.id === editId);
  const modalTitle = document.querySelector("#addTitle");
  const submitLabel = document.querySelector("#savePropertyButton span");
  const removePhotoWrap = document.querySelector("#removePhotoWrap");
  for (const row of form.querySelectorAll(".type-row")) {
    if (row.querySelector("[name='unit_names']")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "mt-2";
    wrapper.innerHTML = '<label class="mini-label">House names <span class="text-muted">(optional; separate each name with a comma)</span></label><input class="form-control" name="unit_names" placeholder="e.g. A1, A2, A3">';
    row.append(wrapper);
  }
  if (editing) {
    form.dataset.propertyId = editing.id;
    if (modalTitle) modalTitle.textContent = "Edit property details";
    if (submitLabel) submitLabel.textContent = "Save changes";
    form.elements.apartment_name.value = editing.name || "";
    form.elements.location.value = editing.address || "";
    const category = document.querySelector("#propertyCategory");
    if (category) category.value = ["house", "houses", "home", "homes"].includes(String(editing.type).toLowerCase()) ? "house" : "apartment";
    for (const [index, row] of [...form.querySelectorAll(".type-row")].entries()) {
      const houseType = editing.houseTypes?.[index];
      if (!houseType) continue;
      row.querySelector("select").value = houseType.name;
      row.querySelector('input[type="number"]').value = houseType.count;
      row.querySelectorAll('input[type="number"]')[1].value = houseType.rent;
      const names = houseType.unitNames?.length ? houseType.unitNames : editing.units?.filter((unit) => unit.type === houseType.name).map((unit) => unit.name);
      row.querySelector('[name="unit_names"]').value = names?.join(", ") || "";
      if (index > 0) row.closest("details")?.setAttribute("open", "");
    }
    const photoUrl = document.querySelector("#aptPhotoUrl");
    if (photoUrl && /^https?:\/\//i.test(editing.photoUrl || "")) photoUrl.value = editing.photoUrl;
    if (removePhotoWrap && editing.photoUrl) removePhotoWrap.hidden = false;
  } else {
    if (modalTitle) modalTitle.textContent = "Add an apartment";
    if (submitLabel) submitLabel.textContent = "Add apartment";
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const name = document.querySelector("#aptName").value;
      const address = document.querySelector("#aptLocation").value;
      const type = document.querySelector("#propertyCategory")?.value || "apartment";
      const houseTypes = [];
      for (const [index, row] of [...form.querySelectorAll(".type-row")].entries()) {
        const name = row.querySelector("select")?.value.trim() || "";
        const countValue = row.querySelector('input[type="number"]')?.value.trim() || "";
        const rentValue = row.querySelectorAll('input[type="number"]')[1]?.value.trim() || "";
        const unitNamesValue = row.querySelector('[name="unit_names"]')?.value.trim() || "";
        if (!name && !countValue && !rentValue) continue;
        if (!name || !countValue || !rentValue) {
          throw new Error(`Complete the house type, unit count, and monthly rent for type ${index + 1}, or leave that row blank.`);
        }
        const count = Number(countValue);
        const rent = Number(rentValue);
        if (!Number.isInteger(count) || count < 1 || count > 500) {
          throw new Error(`House type ${index + 1} needs a whole unit count between 1 and 500.`);
        }
        if (!Number.isFinite(rent) || rent < 0) {
          throw new Error(`Enter a valid monthly rent for house type ${index + 1}.`);
        }
        const unitNames = unitNamesValue ? unitNamesValue.split(",").map((unitName) => unitName.trim()).filter(Boolean) : [];
        if (unitNames.length && unitNames.length !== count) throw new Error(`Enter exactly ${count} house names for ${name}, separated by commas.`);
        houseTypes.push({ name, count, rent, unitNames });
      }
      if (!houseTypes.length) throw new Error("Add at least one house type, with its unit count and monthly rent.");
      const preservedTypes = editing?.houseTypes?.slice(3) || [];
      const allHouseTypes = [...houseTypes, ...preservedTypes];
      const unitCount = allHouseTypes.reduce((total, houseType) => total + houseType.count, 0);
      const photoFile = document.querySelector("#aptPhotoFile")?.files[0];
      if (photoFile && photoFile.size > 3 * 1024 * 1024) throw new Error("Property photos must be 3 MB or smaller.");
      const uploadedPhoto = photoFile ? await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the selected photo."));
        reader.readAsDataURL(photoFile);
      }) : "";
      const payload = { name, address, type, unitCount, houseTypes: allHouseTypes };
      const photoUrl = uploadedPhoto || document.querySelector("#aptPhotoUrl")?.value.trim();
      if (photoUrl) payload.photoUrl = photoUrl;
      if (editing && !photoUrl && document.querySelector("#removePropertyPhoto")?.checked) payload.removePhoto = true;
      const wasEditing = Boolean(editing);
      const result = await api(editing ? `/api/properties/${encodeURIComponent(editing.id)}` : "/api/properties", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      const data = await api("/api/properties");
      renderProperties(data.items);
      delete form.dataset.propertyId;
      editing = null;
      if (modalTitle) modalTitle.textContent = "Add an apartment";
      if (submitLabel) submitLabel.textContent = "Add apartment";
      if (removePhotoWrap) removePhotoWrap.hidden = true;
      history.replaceState(history.state, "", "apartments.html");
      window.bootstrap?.Modal.getOrCreateInstance(document.querySelector("#addModal"))?.hide();
      showMessage(wasEditing ? `${result.item.name} details updated.` : `${result.item.name} was added.`, document.querySelector("main"), "success");
    } catch (error) { showMessage(error.message, form); }
    finally { if (submit) submit.disabled = false; }
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
  bindManagerAccountForm();
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
  document.body.dataset.role = user.role;
  renderRoleNavigation(user);
  addLogout(user);
  bindTenantForms();
  try {
    await loadPageData(user);
    if (page === "manager-profile") await bindManagerProfile();
    if (["tenantslist", "tenanthomepage", "landlordhomepage"].includes(page)) document.querySelector("main")?.removeAttribute("hidden");
  }
  catch (error) {
    document.querySelector("#adminStats")?.setAttribute("aria-busy", "false");
    document.querySelector("#adminLandlordRecords")?.setAttribute("aria-busy", "false");
    if (page === "apartments") {
      const properties = document.querySelector(".apartments");
      properties?.setAttribute("aria-busy", "false");
      properties?.replaceChildren();
    }
    const main = document.querySelector("main");
    if (["tenantslist", "tenanthomepage", "landlordhomepage"].includes(page)) main?.removeAttribute("hidden");
    showMessage(error.message, main);
  }
}

boot().catch((error) => showMessage(error.message));
