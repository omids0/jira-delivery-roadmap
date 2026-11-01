// Settings of the proposed sprint: when it starts, how long it is, how many
// stories it should take, how many people work in it. Empty field = default
// (shown as the placeholder). The values live in state.sprint.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** @returns {string} inner HTML of #sp-cfg */
export function renderSprintSettings(R) {
  const { state, fa } = R;
  const o = state.sprint || {};
  const base = R.NEXT_SPRINT; // already merged with the user's values
  const ctxBase = R.ctx.NEXT_SPRINT;
  const field = (k, label, type, value, placeholder, extra = '') =>
    `<label class="fld"><span>${label}</span><input class="sp-in" data-k="${k}" type="${type}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}" ${extra}></label>`;
  const num = (k, label, value, placeholder, min, max) => field(k, label, 'number', value, placeholder, `min="${min}" max="${max}" step="1" inputmode="numeric"`);

  return `<p class="lead" style="font-size:13px">اسپرینت پیشنهادی را با این مقدارها بسازید. خالی بماند، مقدار پیش‌فرض (نوشته‌شده در کادر) استفاده می‌شود. تغییر نفرات و ذخیره‌ی ظرفیت فقط روی همین بخش اثر دارد و بقیه‌ی صفحه با تیم بالای صفحه می‌ماند.</p>
  <div class="set-grid">
    ${field('start', 'شروع اسپرینت', 'date', o.start, ctxBase.start)}
    ${num('len', 'طول اسپرینت (روز کاری)', o.len, ctxBase.len, 1, 30)}
    ${num('n', 'شماره‌ی اسپرینت', o.n, ctxBase.n, 1, 9999)}
    ${num('target', 'تعداد استوری هدف', o.target, 'همه‌ی استوری‌های قابل‌اجرا', 1, 500)}
    ${num('be', 'نفرات بک‌اند', o.be, state.be, 1, 6)}
    ${num('fe', 'نفرات فرانت', o.fe, state.fe, 1, 6)}
    ${num('par', 'استوری هم‌زمان هر نفر', o.par, state.par, 1, 6)}
    ${num('reserve', 'ذخیره برای باگ و کار دیگر (٪)', o.reserve || '', '۰', 0, 80)}
  </div>
  <div><button type="button" class="btn ghost" id="sp-reset">بازنشانی به پیش‌فرض</button>
  <span class="fq-status">اسپرینت ${esc(fa(base.n, 0))}، ${esc(fa(base.len, 0))} روز کاری، از ${esc(base.start)}${base.target ? `، هدف ${esc(fa(base.target, 0))} استوری` : ''}.</span></div>`;
}
