// "Team members" panel: one row per developer with a name (picked from the Jira
// people of the project) and the sub-tasks that person closes per workday.
// Rows follow the BE / FE counters; an empty pace means "use the scenario pace".
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** @returns {string} inner HTML of #team */
export function renderTeam(R) {
  const { ctx, state, PACE, fa, personName, roleName } = R;
  const scenario = PACE[state.pace] || PACE.avg;
  const column = (r) => {
    const n = state[r.toLowerCase()];
    const rows = Array.from({ length: n }, (_, i) => {
      const d = state.devs?.[r]?.[i] || {};
      return `<div class="dev">
        <span class="dev-n">${fa(i + 1, 0)}</span>
        <input class="dev-name" data-r="${r}" data-i="${i}" list="jr-people" value="${esc(d.name || '')}" placeholder="${esc(personName(r, i))}" aria-label="نام نفر ${fa(i + 1, 0)} ${roleName(r)}" autocomplete="off">
        <label class="dev-pace"><input class="dev-pace-in" data-r="${r}" data-i="${i}" type="number" min="0.5" max="200" step="0.5" inputmode="decimal" value="${d.pace ?? ''}" placeholder="${fa(scenario[r], 1)}" aria-label="سرعت روزانه نفر ${fa(i + 1, 0)} ${roleName(r)}"> <span>sub-task در روز</span></label>
      </div>`;
    }).join('');
    return `<div class="team-col"><h3><span class="role-dot ${r.toLowerCase()}" aria-hidden="true"></span>نفرات ${roleName(r)}</h3>${rows}</div>`;
  };
  return `<p class="lead" style="font-size:13px">برای هر نفر نام را از افراد Jira انتخاب کنید و بنویسید روزی چند sub-task می‌بندد. خالی بماند، سرعت سناریوی انتخاب‌شده (بک‌اند ${fa(scenario.BE, 1)}، فرانت ${fa(scenario.FE, 1)} در روز) برای او حساب می‌شود. نام انتخابی کارهای باز او در Jira را هم به همین نفر وصل می‌کند.</p>
  <div class="team-grid">${column('BE')}${column('FE')}</div>
  <datalist id="jr-people">${(ctx.assignees || []).map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
}
