const state = {
  profiles: [],
  activeProfileId: null,
  settings: { weights: { cost: 40, area: 20, location: 20, safety: 20 } },
  properties: [],
  computed: null,
  editingPropertyId: null,
  compareIds: []
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const selectors = {
  tabButtons: [...document.querySelectorAll('.tab-button')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  heroBudget: document.getElementById('heroBudget'),
  heroProfileName: document.getElementById('heroProfileName'),
  exportCsvButton: document.getElementById('exportCsvButton'),
  profileForm: document.getElementById('profileForm'),
  propertyForm: document.getElementById('propertyForm'),
  settingsForm: document.getElementById('settingsForm'),
  newProfileForm: document.getElementById('newProfileForm'),
  newProfileName: document.getElementById('newProfileName'),
  profilesList: document.getElementById('profilesList'),
  resultCards: document.getElementById('resultCards'),
  analyticsCards: document.getElementById('analyticsCards'),
  budgetChart: document.getElementById('budgetChart'),
  propertiesChart: document.getElementById('propertiesChart'),
  propertyList: document.getElementById('propertyList'),
  propertyCounter: document.getElementById('propertyCounter'),
  propertySubmitButton: document.getElementById('propertySubmitButton'),
  rankingList: document.getElementById('rankingList'),
  rankingSummary: document.getElementById('rankingSummary'),
  rankingFilter: document.getElementById('rankingFilter'),
  clearPropertyForm: document.getElementById('clearPropertyForm'),
  propertySearch: document.getElementById('propertySearch'),
  propertyStatusFilter: document.getElementById('propertyStatusFilter'),
  propertyMinCost: document.getElementById('propertyMinCost'),
  propertyMaxCost: document.getElementById('propertyMaxCost'),
  propertyFavoritesOnly: document.getElementById('propertyFavoritesOnly'),
  compareCounter: document.getElementById('compareCounter'),
  clearCompareButton: document.getElementById('clearCompareButton'),
  compareEmpty: document.getElementById('compareEmpty'),
  compareCards: document.getElementById('compareCards'),
  compareTableWrap: document.getElementById('compareTableWrap')
};

selectors.tabButtons.forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.tab)));
selectors.exportCsvButton.addEventListener('click', exportActiveProfileCsv);
selectors.rankingFilter.addEventListener('change', renderRanking);
selectors.clearPropertyForm.addEventListener('click', resetPropertyForm);
selectors.clearCompareButton.addEventListener('click', () => {
  state.compareIds = [];
  renderCompareSection();
  renderPropertyList();
});
['input', 'change'].forEach((eventName) => {
  selectors.propertySearch.addEventListener(eventName, renderPropertyList);
  selectors.propertyStatusFilter.addEventListener(eventName, renderPropertyList);
  selectors.propertyMinCost.addEventListener(eventName, renderPropertyList);
  selectors.propertyMaxCost.addEventListener(eventName, renderPropertyList);
  selectors.propertyFavoritesOnly.addEventListener(eventName, renderPropertyList);
});

selectors.newProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const name = selectors.newProfileName.value.trim();
    if (!name) return alert('Informe um nome para o novo perfil.');
    const response = await api('/api/profiles', 'POST', { name });
    state.profiles.push(response.profile);
    selectors.newProfileName.value = '';
    await setActiveProfile(response.profile.id, true);
  } catch (error) {
    handleError(error);
  }
});

selectors.profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const active = getActiveProfile();
    if (!active) return alert('Selecione um perfil antes de editar o orçamento.');
    const payload = getProfileFormValue(active.id);
    const response = await api(`/api/profiles/${active.id}`, 'PUT', payload);
    state.profiles = state.profiles.map((item) => item.id === response.profile.id ? response.profile : item);
    recomputeAndRender();
    alert('Perfil financeiro salvo com sucesso.');
  } catch (error) {
    handleError(error);
  }
});

selectors.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = getSettingsFormValue();
    validateWeights(payload.weights);
    const response = await api('/api/settings', 'PUT', payload);
    state.settings = response.settings;
    recomputeAndRender();
    alert('Pesos do ranking salvos com sucesso.');
  } catch (error) {
    handleError(error);
  }
});

selectors.propertyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const active = getActiveProfile();
    if (!active) return alert('Selecione um perfil antes de cadastrar imóveis.');
    const payload = getPropertyFormValue(active.id);
    if (!payload.title) return alert('Informe um título para o imóvel.');
    if (!payload.neighborhood) return alert('Informe o bairro para calcular a segurança automaticamente.');

    if (state.editingPropertyId) {
      const response = await api(`/api/properties/${state.editingPropertyId}`, 'PUT', payload);
      state.properties = state.properties.map((item) => item.id === response.property.id ? response.property : item);
      alert('Imóvel atualizado com sucesso.');
    } else {
      const response = await api('/api/properties', 'POST', payload);
      state.properties.push(response.property);
      alert('Imóvel adicionado com sucesso.');
    }

    resetPropertyForm();
    recomputeAndRender();
    setActiveTab('imoveis');
  } catch (error) {
    handleError(error);
  }
});

async function init() {
  const response = await api('/api/state');
  state.profiles = response.profiles || [];
  state.activeProfileId = response.activeProfile?.profileId || state.profiles[0]?.id || null;
  state.settings = response.settings || state.settings;
  state.properties = response.properties || [];
  fillSettingsForm();
  recomputeAndRender();
}

function setActiveTab(tabName) {
  selectors.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tabName));
  selectors.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tabName}`));
}

async function api(url, method = 'GET', payload) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (payload !== undefined) options.body = JSON.stringify(payload);
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error((data && data.message) || 'Falha na comunicação com o servidor.');
  return data;
}

function getNumberFromInput(id) {
  const value = document.getElementById(id).value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getActiveProfile() {
  return state.profiles.find((item) => item.id === state.activeProfileId) || null;
}

function getActiveProperties() {
  return (state.properties || []).filter((item) => item.profileId === state.activeProfileId);
}

function fillActiveProfileForm() {
  const profile = getActiveProfile();
  if (!profile) return;
  const expenses = profile.expenses || {};
  document.getElementById('profileName').value = profile.name || '';
  document.getElementById('salaryGross').value = profile.salaryGross ?? 0;
  document.getElementById('otherIncome').value = profile.otherIncome ?? 0;
  document.getElementById('payrollDiscounts').value = profile.payrollDiscounts ?? 0;
  document.getElementById('reserveMonthly').value = profile.reserveMonthly ?? 0;
  document.getElementById('housingPercent').value = profile.housingPercent ?? 30;
  document.getElementById('food').value = expenses.food ?? 0;
  document.getElementById('transport').value = expenses.transport ?? 0;
  document.getElementById('health').value = expenses.health ?? 0;
  document.getElementById('internetPhone').value = expenses.internetPhone ?? 0;
  document.getElementById('leisure').value = expenses.leisure ?? 0;
  document.getElementById('debts').value = expenses.debts ?? 0;
  document.getElementById('education').value = expenses.education ?? 0;
  document.getElementById('others').value = expenses.others ?? 0;
}

function getProfileFormValue(profileId) {
  return {
    id: profileId,
    name: document.getElementById('profileName').value.trim(),
    salaryGross: getNumberFromInput('salaryGross'),
    otherIncome: getNumberFromInput('otherIncome'),
    payrollDiscounts: getNumberFromInput('payrollDiscounts'),
    reserveMonthly: getNumberFromInput('reserveMonthly'),
    housingPercent: getNumberFromInput('housingPercent'),
    expenses: {
      food: getNumberFromInput('food'),
      transport: getNumberFromInput('transport'),
      health: getNumberFromInput('health'),
      internetPhone: getNumberFromInput('internetPhone'),
      leisure: getNumberFromInput('leisure'),
      debts: getNumberFromInput('debts'),
      education: getNumberFromInput('education'),
      others: getNumberFromInput('others')
    }
  };
}

function fillSettingsForm() {
  const weights = state.settings?.weights || {};
  document.getElementById('weightCost').value = weights.cost ?? 40;
  document.getElementById('weightArea').value = weights.area ?? 20;
  document.getElementById('weightLocation').value = weights.location ?? 20;
  document.getElementById('weightSafety').value = weights.safety ?? 20;
}

function getSettingsFormValue() {
  return {
    weights: {
      cost: getNumberFromInput('weightCost'),
      area: getNumberFromInput('weightArea'),
      location: getNumberFromInput('weightLocation'),
      safety: getNumberFromInput('weightSafety')
    }
  };
}

function validateWeights(weights) {
  const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
  if (sum <= 0) throw new Error('A soma dos pesos precisa ser maior que zero.');
}

function getPropertyFormValue(profileId) {
  return {
    profileId,
    title: document.getElementById('title').value.trim(),
    url: document.getElementById('url').value.trim(),
    rent: getNumberFromInput('rent'),
    condo: getNumberFromInput('condo'),
    iptu: getNumberFromInput('iptu'),
    insurance: getNumberFromInput('insurance'),
    fireInsurance: getNumberFromInput('fireInsurance'),
    otherFees: getNumberFromInput('otherFees'),
    area: getNumberFromInput('area'),
    neighborhood: document.getElementById('neighborhood').value.trim(),
    localityScore: clamp(getNumberFromInput('localityScore'), 0, 10),
    notes: document.getElementById('notes').value.trim(),
    favorite: false
  };
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function round1(value) { return Math.round((value + Number.EPSILON) * 10) / 10; }

function resetPropertyForm() {
  selectors.propertyForm.reset();
  document.getElementById('propertyId').value = '';
  state.editingPropertyId = null;
  selectors.propertySubmitButton.textContent = 'Adicionar imóvel';
}

function startEditProperty(property) {
  state.editingPropertyId = property.id;
  document.getElementById('propertyId').value = property.id;
  document.getElementById('title').value = property.title || '';
  document.getElementById('url').value = property.url || '';
  document.getElementById('rent').value = property.rent ?? 0;
  document.getElementById('condo').value = property.condo ?? 0;
  document.getElementById('iptu').value = property.iptu ?? 0;
  document.getElementById('insurance').value = property.insurance ?? 0;
  document.getElementById('fireInsurance').value = property.fireInsurance ?? 0;
  document.getElementById('otherFees').value = property.otherFees ?? 0;
  document.getElementById('area').value = property.area ?? 0;
  document.getElementById('neighborhood').value = property.neighborhood || '';
  document.getElementById('localityScore').value = property.localityScore ?? 0;
  document.getElementById('notes').value = property.notes || '';
  selectors.propertySubmitButton.textContent = 'Salvar alterações';
  setActiveTab('imoveis');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function setActiveProfile(profileId, notify = false) {
  const response = await api('/api/active-profile', 'PUT', { profileId });
  state.activeProfileId = response.activeProfile.profileId;
  state.compareIds = [];
  recomputeAndRender();
  if (notify) alert('Perfil ativo alterado com sucesso.');
}

async function deleteProfile(profileId) {
  const confirmed = confirm('Tem certeza de que deseja excluir este perfil e todos os imóveis vinculados a ele?');
  if (!confirmed) return;
  const response = await api(`/api/profiles/${profileId}`, 'DELETE');
  state.profiles = state.profiles.filter((item) => item.id !== response.profile.id);
  state.properties = state.properties.filter((item) => item.profileId !== response.profile.id);
  if (state.activeProfileId === response.profile.id) state.activeProfileId = 'perfil_principal';
  state.compareIds = [];
  recomputeAndRender();
}

async function toggleFavorite(property) {
  const response = await api(`/api/properties/${property.id}`, 'PUT', { ...property, favorite: !property.favorite });
  state.properties = state.properties.map((item) => item.id === response.property.id ? response.property : item);
  recomputeAndRender();
}

async function deleteProperty(propertyId) {
  const confirmed = confirm('Tem certeza de que deseja excluir este imóvel?');
  if (!confirmed) return;
  const response = await api(`/api/properties/${propertyId}`, 'DELETE');
  state.properties = state.properties.filter((item) => item.id !== response.property.id);
  state.compareIds = state.compareIds.filter((id) => id !== propertyId);
  if (state.editingPropertyId === propertyId) resetPropertyForm();
  recomputeAndRender();
}

function toggleCompare(propertyId) {
  const exists = state.compareIds.includes(propertyId);
  if (exists) {
    state.compareIds = state.compareIds.filter((id) => id !== propertyId);
  } else {
    if (state.compareIds.length >= 3) return alert('Selecione no máximo 3 imóveis para comparar.');
    state.compareIds.push(propertyId);
  }
  renderCompareSection();
  renderPropertyList();
}

function computeFinancials(profile) {
  const expenses = profile?.expenses || {};
  const totalExpenses = Object.values(expenses).reduce((acc, value) => acc + (Number(value) || 0), 0);
  const incomeGross = (Number(profile?.salaryGross) || 0) + (Number(profile?.otherIncome) || 0);
  const payrollDiscounts = Number(profile?.payrollDiscounts) || 0;
  const incomeNet = incomeGross - payrollDiscounts;
  const reserve = Number(profile?.reserveMonthly) || 0;
  const availableAfterEssentials = incomeNet - totalExpenses - reserve;
  const housingPercent = Number(profile?.housingPercent) || 0;
  const percentBasedLimit = incomeNet * (housingPercent / 100);
  const housingBudget = Math.max(0, Math.min(percentBasedLimit, availableAfterEssentials));
  return { incomeGross, payrollDiscounts, incomeNet, totalExpenses, reserve, availableAfterEssentials, percentBasedLimit, housingBudget, housingPercent };
}

function computePropertyTotals(property, housingBudget) {
  const monthlyCost = (Number(property.rent) || 0) + (Number(property.condo) || 0) + (Number(property.iptu) || 0) + (Number(property.insurance) || 0) + (Number(property.fireInsurance) || 0) + (Number(property.otherFees) || 0);
  const budgetDifference = housingBudget - monthlyCost;
  const costRatio = housingBudget > 0 ? monthlyCost / housingBudget : Infinity;
  let budgetStatus = 'over';
  let budgetLabel = 'Acima do limite';
  if (housingBudget <= 0) { budgetStatus = 'over'; budgetLabel = 'Sem teto disponível'; }
  else if (costRatio <= 0.9) { budgetStatus = 'fit'; budgetLabel = 'Confortável'; }
  else if (costRatio <= 1) { budgetStatus = 'limit'; budgetLabel = 'No limite'; }
  const safetyScore = Number.isFinite(property.autoSafetyScore) ? property.autoSafetyScore : 0;
  const costBenefit = monthlyCost > 0 ? ((property.area || 0) * ((property.localityScore || 0) + safetyScore + 1)) / monthlyCost : 0;
  return { ...property, monthlyCost, budgetDifference, costRatio, budgetStatus, budgetLabel, costBenefit, effectiveSafetyScore: safetyScore };
}

function normalizeProperties(properties, weights) {
  if (!properties.length) return [];
  const costs = properties.map((item) => item.monthlyCost);
  const areas = properties.map((item) => item.area || 0);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minArea = Math.min(...areas);
  const maxArea = Math.max(...areas);
  const totalWeight = Object.values(weights).reduce((acc, value) => acc + value, 0) || 1;

  return properties.map((property) => {
    const costScoreRaw = maxCost === minCost ? 10 : ((maxCost - property.monthlyCost) / (maxCost - minCost)) * 10;
    const areaScoreRaw = maxArea === minArea ? 10 : (((property.area || 0) - minArea) / (maxArea - minArea)) * 10;
    const locationScoreRaw = clamp(Number(property.localityScore) || 0, 0, 10);
    const safetyScoreRaw = clamp(Number(property.effectiveSafetyScore) || 0, 0, 10);
    const weighted = (costScoreRaw * weights.cost + areaScoreRaw * weights.area + locationScoreRaw * weights.location + safetyScoreRaw * weights.safety) / totalWeight;
    const affordabilityMultiplier = property.budgetStatus === 'over' ? Math.max(0.2, property.costRatio > 0 ? 1 / property.costRatio : 0.2) : 1;
    const favoriteBonus = property.favorite ? 0.25 : 0;
    const finalScore = clamp(weighted * affordabilityMultiplier + favoriteBonus, 0, 10);
    return {
      ...property,
      scores: {
        cost: round1(costScoreRaw),
        area: round1(areaScoreRaw),
        location: round1(locationScoreRaw),
        safety: round1(safetyScoreRaw),
        final: round1(finalScore)
      }
    };
  }).sort((a, b) => b.scores.final - a.scores.final || a.monthlyCost - b.monthlyCost);
}

function getFilteredProperties(list) {
  const search = selectors.propertySearch.value.trim().toLowerCase();
  const status = selectors.propertyStatusFilter.value;
  const minCost = Number(selectors.propertyMinCost.value) || 0;
  const maxCost = Number(selectors.propertyMaxCost.value) || Infinity;
  const favoritesOnly = selectors.propertyFavoritesOnly.checked;
  return list.filter((property) => {
    const matchesSearch = !search || `${property.title} ${property.neighborhood}`.toLowerCase().includes(search);
    const matchesStatus = status === 'all' || property.budgetStatus === status;
    const matchesMin = property.monthlyCost >= minCost;
    const matchesMax = property.monthlyCost <= maxCost;
    const matchesFavorite = !favoritesOnly || property.favorite;
    return matchesSearch && matchesStatus && matchesMin && matchesMax && matchesFavorite;
  });
}

function recomputeAndRender() {
  const active = getActiveProfile();
  state.computed = computeFinancials(active || {});
  state.properties = (state.properties || []).map((item) => {
    if (item.profileId !== state.activeProfileId) return item;
    return computePropertyTotals(item, state.computed.housingBudget);
  });
  selectors.heroBudget.textContent = formatCurrency(state.computed.housingBudget);
  selectors.heroProfileName.textContent = active ? `Perfil ativo: ${active.name}` : 'Perfil ativo: —';
  fillActiveProfileForm();
  renderProfilesList();
  renderResultCards();
  renderAnalyticsCards();
  renderBudgetChart();
  renderPropertiesChart();
  renderPropertyList();
  renderCompareSection();
  renderRanking();
}

function renderProfilesList() {
  const active = getActiveProfile();
  selectors.profilesList.innerHTML = '';
  for (const profile of state.profiles) {
    const card = document.createElement('article');
    card.className = `profile-card ${active && active.id === profile.id ? 'active' : ''}`;
    const linkedProperties = state.properties.filter((item) => item.profileId === profile.id).length;
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(profile.name)}</h3>
          <div class="property-meta">
            ${active && active.id === profile.id ? '<span class="pill gold">Perfil ativo</span>' : '<span class="pill neutral">Perfil</span>'}
            <span class="pill neutral">${linkedProperties} imóvel(is)</span>
            <span class="pill neutral">Limite ${percentFormatter.format(profile.housingPercent || 0)}%</span>
          </div>
        </div>
      </header>
      <p class="small-muted">Renda bruta: ${formatCurrency((profile.salaryGross || 0) + (profile.otherIncome || 0))}</p>
      <div class="profile-actions">
        ${active && active.id === profile.id ? '' : '<button class="secondary" data-action="activate">Ativar</button>'}
        ${profile.id !== 'perfil_principal' ? '<button class="secondary" data-action="delete">Excluir</button>' : ''}
      </div>
    `;
    const activateBtn = card.querySelector('[data-action="activate"]');
    if (activateBtn) activateBtn.addEventListener('click', () => setActiveProfile(profile.id, true).catch(handleError));
    const deleteBtn = card.querySelector('[data-action="delete"]');
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteProfile(profile.id).catch(handleError));
    selectors.profilesList.appendChild(card);
  }
}

function renderResultCards() {
  const metrics = [
    { label: 'Renda bruta total', value: formatCurrency(state.computed.incomeGross), help: 'Salário bruto + outros rendimentos do perfil ativo.' },
    { label: 'Descontos em folha', value: formatCurrency(state.computed.payrollDiscounts), help: 'INSS, IR e outros descontos.' },
    { label: 'Renda líquida', value: formatCurrency(state.computed.incomeNet), help: 'Base do planejamento mensal.' },
    { label: 'Despesas fixas', value: formatCurrency(state.computed.totalExpenses), help: 'Soma das despesas mensais.' },
    { label: 'Reserva mensal', value: formatCurrency(state.computed.reserve), help: 'Margem de segurança antes da moradia.' },
    { label: 'Saldo disponível', value: formatCurrency(state.computed.availableAfterEssentials), help: 'Renda líquida - despesas - reserva.' },
    { label: 'Teto pelo percentual', value: formatCurrency(state.computed.percentBasedLimit), help: `${percentFormatter.format(state.computed.housingPercent)}% da renda líquida.` },
    { label: 'Teto final de moradia', value: formatCurrency(state.computed.housingBudget), help: 'Menor valor entre percentual e saldo disponível.' }
  ];
  selectors.resultCards.innerHTML = '';
  const template = document.getElementById('metricCardTemplate');
  metrics.forEach((metric) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.metric-label').textContent = metric.label;
    node.querySelector('.metric-value').textContent = metric.value;
    node.querySelector('.metric-help').textContent = metric.help;
    selectors.resultCards.appendChild(node);
  });
}

function renderAnalyticsCards() {
  const list = getActiveProperties();
  const fit = list.filter((p) => p.budgetStatus === 'fit');
  const favorites = list.filter((p) => p.favorite);
  const bestCostBenefit = [...list].sort((a, b) => b.costBenefit - a.costBenefit)[0];
  const safest = [...list].filter((p) => Number.isFinite(p.effectiveSafetyScore)).sort((a, b) => b.effectiveSafetyScore - a.effectiveSafetyScore)[0];
  const analytics = [
    { label: 'Imóveis confortáveis', value: String(fit.length), help: fit.length ? `${Math.round((fit.length / Math.max(1, list.length)) * 100)}% dos imóveis do perfil cabem com folga.` : 'Nenhum imóvel confortável ainda.' },
    { label: 'Favoritos do perfil', value: String(favorites.length), help: favorites.length ? 'Há opções promissoras salvas.' : 'Marque favoritos para revisar depois.' },
    { label: 'Melhor custo-benefício', value: bestCostBenefit ? bestCostBenefit.title : '—', help: bestCostBenefit ? `${formatCurrency(bestCostBenefit.monthlyCost)} · índice ${round1(bestCostBenefit.costBenefit)}` : 'Cadastre imóveis para comparar.' },
    { label: 'Melhor segurança', value: safest ? safest.title : '—', help: safest ? `${round1(safest.effectiveSafetyScore)}/10 · ${safest.securityDisplayName}` : 'Cadastre imóveis com bairro válido.' }
  ];
  selectors.analyticsCards.innerHTML = '';
  const template = document.getElementById('analyticsCardTemplate');
  analytics.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.analytics-label').textContent = item.label;
    node.querySelector('.analytics-value').textContent = item.value;
    node.querySelector('.analytics-help').textContent = item.help;
    selectors.analyticsCards.appendChild(node);
  });
}

function drawBarChart(canvas, labels, values, colors, title) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = '#122238';
  ctx.font = '600 14px Segoe UI';
  ctx.fillText(title, 16, 22);
  const chartTop = 36;
  const chartBottom = h - 36;
  const chartHeight = chartBottom - chartTop;
  const maxValue = Math.max(...values, 1);
  const barAreaWidth = w - 32;
  const step = barAreaWidth / Math.max(values.length, 1);
  values.forEach((value, index) => {
    const x = 16 + (step * index) + step * 0.14;
    const barWidth = step * 0.72;
    const barHeight = (value / maxValue) * (chartHeight - 20);
    const y = chartBottom - barHeight;
    ctx.fillStyle = colors[index] || '#0057b8';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#122238';
    ctx.font = '12px Segoe UI';
    ctx.fillText(labels[index], x, chartBottom + 16);
    ctx.fillText(formatShortCurrency(value), x, Math.max(y - 6, chartTop + 12));
  });
}

function renderBudgetChart() {
  drawBarChart(
    selectors.budgetChart,
    ['Renda líquida', 'Despesas', 'Reserva', 'Teto'],
    [state.computed.incomeNet, state.computed.totalExpenses, state.computed.reserve, state.computed.housingBudget],
    ['#0057b8', '#f28c28', '#8a53ff', '#157347'],
    'Orçamento do perfil ativo'
  );
}

function renderPropertiesChart() {
  const list = getActiveProperties().slice().sort((a, b) => a.monthlyCost - b.monthlyCost).slice(0, 6);
  drawBarChart(
    selectors.propertiesChart,
    list.length ? list.map((item) => truncate(item.title, 12)) : ['Sem dados'],
    list.length ? list.map((item) => item.monthlyCost) : [0],
    list.length ? list.map((_, index) => ['#2b8cff', '#3a9d5d', '#f28c28', '#8a53ff', '#d49a00', '#0057b8'][index % 6]) : ['#d8e2ed'],
    'Custo total dos imóveis do perfil'
  );
}

function truncate(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

function formatShortCurrency(value) {
  const abs = Math.abs(Number(value) || 0);
  if (abs >= 1000) return `R$ ${(abs / 1000).toFixed(1)}k`;
  return `R$ ${abs.toFixed(0)}`;
}

function renderPropertyList() {
  const filtered = getFilteredProperties(getActiveProperties());
  selectors.propertyCounter.textContent = `${filtered.length} ${filtered.length === 1 ? 'imóvel' : 'imóveis'}`;
  selectors.compareCounter.textContent = `${state.compareIds.length} selecionado(s) para comparar`;
  if (!filtered.length) {
    selectors.propertyList.className = 'property-list empty-state';
    selectors.propertyList.textContent = 'Nenhum imóvel atende aos filtros atuais.';
    return;
  }
  selectors.propertyList.className = 'property-list';
  selectors.propertyList.innerHTML = '';
  const sorted = [...filtered].sort((a, b) => a.monthlyCost - b.monthlyCost || (b.favorite - a.favorite));
  sorted.forEach((property) => {
    const card = document.createElement('article');
    card.className = `property-card ${property.favorite ? 'favorite' : ''}`;
    const statusClass = property.budgetStatus === 'fit' ? 'good' : property.budgetStatus === 'limit' ? 'warn' : 'bad';
    const budgetDiffText = `${property.budgetDifference >= 0 ? 'Folga' : 'Excesso'}: ${formatCurrency(Math.abs(property.budgetDifference))}`;
    const safetyLabel = Number.isFinite(property.effectiveSafetyScore) ? `${round1(property.effectiveSafetyScore)}/10` : 'Sem base';
    const isSelected = state.compareIds.includes(property.id);
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(property.title)}</h3>
          <div class="property-meta">
            <span class="pill ${statusClass}">${property.budgetLabel}</span>
            <span class="pill neutral">${formatCurrency(property.monthlyCost)}/mês</span>
            <span class="pill neutral">${property.area || 0} m²</span>
            <span class="pill neutral">Segurança ${safetyLabel}</span>
            ${property.favorite ? '<span class="pill gold">★ Favorito</span>' : ''}
            ${isSelected ? '<span class="pill gold">Comparando</span>' : ''}
          </div>
        </div>
        <div class="score-ring" style="--score:${property.favorite ? 95 : Math.max(10, 100 - ((Number.isFinite(property.costRatio) ? property.costRatio : 2) * 45))}">${property.favorite ? '★' : Math.max(0, Math.round(100 - ((Number.isFinite(property.costRatio) ? property.costRatio : 2) * 45)))}</div>
      </header>
      <p><strong>Bairro:</strong> ${escapeHtml(property.neighborhood || 'Não informado')}</p>
      <p><strong>Localidade:</strong> ${property.localityScore || 0}/10 &nbsp;•&nbsp; <strong>Segurança automática:</strong> ${safetyLabel} &nbsp;•&nbsp; <strong>Custo-benefício:</strong> ${round1(property.costBenefit)}</p>
      <p class="status-text ${statusClass}">${budgetDiffText}</p>
      <div class="security-box"><strong>Explicação da segurança:</strong><br><span class="small-muted">${escapeHtml(property.securityExplanation || 'Sem explicação disponível.')}</span></div>
      ${property.url ? `<p><a class="link-inline" href="${escapeAttribute(property.url)}" target="_blank" rel="noopener noreferrer">Abrir anúncio</a></p>` : ''}
      ${property.notes ? `<p class="small-muted">${escapeHtml(property.notes)}</p>` : ''}
      <div class="property-actions">
        <button class="secondary icon-button" type="button" data-action="favorite">${property.favorite ? '★ Desfavoritar' : '☆ Favoritar'}</button>
        <button class="secondary" type="button" data-action="compare">${isSelected ? 'Remover comparação' : 'Comparar'}</button>
        <button class="secondary" type="button" data-action="edit">Editar</button>
        <button class="secondary" type="button" data-action="delete">Excluir</button>
      </div>
    `;
    card.querySelector('[data-action="favorite"]').addEventListener('click', () => toggleFavorite(property).catch(handleError));
    card.querySelector('[data-action="compare"]').addEventListener('click', () => toggleCompare(property.id));
    card.querySelector('[data-action="edit"]').addEventListener('click', () => startEditProperty(property));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProperty(property.id).catch(handleError));
    selectors.propertyList.appendChild(card);
  });
}

function renderCompareSection() {
  const selected = getActiveProperties().filter((item) => state.compareIds.includes(item.id));
  selectors.compareCounter.textContent = `${selected.length} selecionado(s) para comparar`;
  if (!selected.length) {
    selectors.compareEmpty.style.display = 'grid';
    selectors.compareCards.innerHTML = '';
    selectors.compareTableWrap.innerHTML = '';
    return;
  }
  selectors.compareEmpty.style.display = 'none';
  selectors.compareCards.innerHTML = selected.map((property) => `
    <article class="compare-card">
      <header>
        <div>
          <h3>${escapeHtml(property.title)}</h3>
          <div class="compare-meta">
            <span class="pill neutral">${formatCurrency(property.monthlyCost)}/mês</span>
            <span class="pill neutral">${property.area || 0} m²</span>
            <span class="pill neutral">Segurança ${Number.isFinite(property.effectiveSafetyScore) ? round1(property.effectiveSafetyScore) + '/10' : 'Sem base'}</span>
          </div>
        </div>
      </header>
      <p class="small-muted">${escapeHtml(property.neighborhood || 'Não informado')}</p>
    </article>
  `).join('');

  const rows = [
    ['Título', ...selected.map((p) => escapeHtml(p.title))],
    ['Custo total mensal', ...selected.map((p) => formatCurrency(p.monthlyCost))],
    ['Aluguel', ...selected.map((p) => formatCurrency(p.rent || 0))],
    ['Condomínio', ...selected.map((p) => formatCurrency(p.condo || 0))],
    ['IPTU', ...selected.map((p) => formatCurrency(p.iptu || 0))],
    ['Seguro + incêndio', ...selected.map((p) => formatCurrency((p.insurance || 0) + (p.fireInsurance || 0)))],
    ['Área', ...selected.map((p) => `${p.area || 0} m²`)],
    ['Bairro', ...selected.map((p) => escapeHtml(p.neighborhood || ''))],
    ['Localidade', ...selected.map((p) => `${p.localityScore || 0}/10`)],
    ['Segurança automática', ...selected.map((p) => Number.isFinite(p.effectiveSafetyScore) ? `${round1(p.effectiveSafetyScore)}/10` : 'Sem base')],
    ['Status orçamento', ...selected.map((p) => escapeHtml(p.budgetLabel))],
    ['Folga / excesso', ...selected.map((p) => formatSignedCurrency(p.budgetDifference))],
    ['Observações', ...selected.map((p) => escapeHtml(p.notes || '—'))]
  ];

  selectors.compareTableWrap.innerHTML = `<table class="compare-table">${rows.map((row, rowIndex) => `<tr>${row.map((cell, cellIndex) => rowIndex === 0 || cellIndex === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`;
}

function renderRanking() {
  const weights = state.settings?.weights || { cost: 40, area: 20, location: 20, safety: 20 };
  const ranked = normalizeProperties(getActiveProperties(), weights);
  const filter = selectors.rankingFilter.value;
  const filtered = ranked.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'favorite') return item.favorite;
    return item.budgetStatus === filter;
  });
  const fitCount = ranked.filter((item) => item.budgetStatus === 'fit').length;
  const limitCount = ranked.filter((item) => item.budgetStatus === 'limit').length;
  const overCount = ranked.filter((item) => item.budgetStatus === 'over').length;
  const favoriteCount = ranked.filter((item) => item.favorite).length;
  selectors.rankingSummary.innerHTML = `<strong>${ranked.length}</strong> imóvel(is) analisado(s) · <strong>${fitCount}</strong> confortável(is) · <strong>${limitCount}</strong> no limite · <strong>${overCount}</strong> acima do limite · <strong>${favoriteCount}</strong> favorito(s)`;

  if (!filtered.length) {
    selectors.rankingList.className = 'ranking-list empty-state';
    selectors.rankingList.textContent = 'Nenhum imóvel atende ao filtro do ranking.';
    return;
  }

  selectors.rankingList.className = 'ranking-list';
  selectors.rankingList.innerHTML = '';
  filtered.forEach((property, index) => {
    const card = document.createElement('article');
    card.className = 'ranking-card';
    const statusClass = property.budgetStatus === 'fit' ? 'good' : property.budgetStatus === 'limit' ? 'warn' : 'bad';
    card.innerHTML = `
      <header>
        <div>
          <h3>#${index + 1} · ${escapeHtml(property.title)}</h3>
          <div class="ranking-meta">
            <span class="pill ${statusClass}">${property.budgetLabel}</span>
            <span class="pill neutral">${formatCurrency(property.monthlyCost)}</span>
            <span class="pill neutral">${property.area || 0} m²</span>
            <span class="pill neutral">Segurança ${Number.isFinite(property.effectiveSafetyScore) ? round1(property.effectiveSafetyScore) + '/10' : 'Sem base'}</span>
            ${property.favorite ? '<span class="pill gold">★ Favorito</span>' : ''}
          </div>
        </div>
        <div class="score-ring" style="--score:${property.scores.final * 10}">${property.scores.final.toFixed(1)}</div>
      </header>
      <p><strong>Bairro:</strong> ${escapeHtml(property.neighborhood || 'Não informado')}</p>
      <p><strong>Folga / excesso:</strong> ${formatSignedCurrency(property.budgetDifference)}</p>
      <div class="ranking-meta">
        <span class="pill neutral">Custo: ${property.scores.cost}/10</span>
        <span class="pill neutral">Tamanho: ${property.scores.area}/10</span>
        <span class="pill neutral">Localidade: ${property.scores.location}/10</span>
        <span class="pill neutral">Segurança: ${property.scores.safety}/10</span>
      </div>
      <div class="security-box"><strong>Explicação da segurança:</strong><br><span class="small-muted">${escapeHtml(property.securityExplanation || 'Sem explicação disponível.')}</span></div>
      ${property.url ? `<p><a class="link-inline" href="${escapeAttribute(property.url)}" target="_blank" rel="noopener noreferrer">Abrir anúncio</a></p>` : ''}
    `;
    selectors.rankingList.appendChild(card);
  });
}

async function exportActiveProfileCsv() {
  const profileId = state.activeProfileId || '';
  const url = `/api/export/properties.csv?profileId=${encodeURIComponent(profileId)}`;
  window.open(url, '_blank');
}

function formatCurrency(value) { return currencyFormatter.format(Number(value) || 0); }
function formatSignedCurrency(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? '+' : '-'} ${formatCurrency(Math.abs(n))}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function escapeAttribute(value) { return escapeHtml(value); }
function handleError(error) { console.error(error); alert(error.message || 'Ocorreu um erro inesperado.'); }
window.addEventListener('unhandledrejection', (event) => handleError(event.reason));
init().catch(handleError);
