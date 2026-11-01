// "Before you start" notes cards (DOM id: notes). Pure: (R, P) => HTML string.
import { GATE } from '../engine.js';

export function renderNotes(R, P) {
  const { fa, esc, kb, JIRA, DEP_INFO, state } = R;
  const dec = P.list.filter((s) => s.f.includes('d'));
  const link = (k) => `<a href="${JIRA + k}" target="_blank" rel="noopener">${kb(k)}</a>`;
  const list = (ks, max = 14) =>
    ks.length ? ks.slice(0, max).map(link).join('، ') + (ks.length > max ? ` و ${fa(ks.length - max)} مورد دیگر` : '') : 'هیچ';
  // dependency bottlenecks: open stories with the most open stories waiting on them (transitively)
  const open = P.list.filter((s) => !s.done && !s.f.includes('x'));
  const succ = {};
  P.list.forEach((s) => s.deps.forEach((d) => (succ[d] = succ[d] || []).push(s.k)));
  const reach = (k) => {
    const seen = new Set();
    const walk = (x) => (succ[x] || []).forEach((y) => { if (!seen.has(y)) { seen.add(y); walk(y); } });
    walk(k);
    return seen.size;
  };
  const hubs = open.map((s) => ({ s, n: reach(s.k) })).filter((x) => x.n > 1).sort((a, b) => b.n - a.n).slice(0, 8);
  const ext = open.filter((s) => s.f.includes('ext'));
  const rcs = P.list.filter((s) => s.rc);
  const ready = open.filter((s) => (DEP_INFO[s.k] || {}).v === 'ready');
  const decOpen = dec.filter((s) => !s.done);
  const hasSprints = (R.SPRINTS || []).length > 0;
  return `
      <div class="note"><h3><span class="pill info">گلوگاه</span>استوری‌هایی که بیشترین کار منتظرشان است</h3>
        <ul>${hubs.map((x) => `<li>${link(x.s.k)} ${esc(x.s.title)} — <b>${fa(x.n)}</b> استوری باز پشت آن</li>`).join('') || '<li>هیچ</li>'}</ul>
        <p class="lead" style="font-size:12.5px">بر اساس پیش‌نیازهای قطعی (لینک‌های Blocks در Jira). تأخیر در هر کدام، همهٔ استوری‌های پشتش را عقب می‌برد، پس باید اول شروع شوند.</p></div>
      <div class="note"><h3><span class="pill good">شروع فوری</span>بدون هیچ مانعی آماده‌اند</h3>
        <ul>${ready.map((s) => `<li>${link(s.k)} ${esc(s.title)}</li>`).join('') || '<li>هیچ</li>'}</ul></div>
      <div class="note"><h3><span class="pill warn">بیرونی</span>منتظر سرویسی که در Jira استوری ندارد</h3>
        <ul>${ext.map((s) => `<li>${link(s.k)} ${esc(s.title)}${(DEP_INFO[s.k] || {}).x && DEP_INFO[s.k].x.length ? ` — ${esc(DEP_INFO[s.k].x.join('؛ '))}` : ''}</li>`).join('') || '<li>هیچ</li>'}</ul>
        <p class="lead" style="font-size:12.5px">برنامه فرض کرده این سرویس‌ها به‌موقع آماده می‌شوند. تا وقتی برایشان استوری ساخته نشود، تاریخ این کارها قطعی نیست.</p></div>
      <div class="note"><h3><span class="pill warn">تصمیم</span>${fa(decOpen.length)} استوری تصمیم باز دارند</h3>
        <p class="lead" style="font-size:12.5px">در برنامه فرض شده PO تا روز ${fa(GATE)} تصمیم بگیرد و کارت این استوری‌ها با کادر خط‌چین مشخص است. متن هر تصمیم با کلیک روی کارت در فلوچارت نمایش داده می‌شود.</p>
        <p style="font-size:12.5px">${list(decOpen.map((s) => s.k), 40)}</p></div>
      <div class="note"><h3><span class="pill good">آماده بستن</span>همهٔ sub-taskها Done، استوری هنوز باز</h3>
        <ul>${rcs.map((s) => `<li>${link(s.k)} ${esc(s.title)}</li>`).join('') || '<li>هیچ</li>'}</ul>
        <p class="lead" style="font-size:12.5px">کافی است QA انجام شود و استوری بسته شود.</p></div>
      <div class="note"><h3><span class="pill warn">فرض</span>محدودیت‌های این برنامه</h3>
        <ul>
          <li>وابستگی‌ها از لینک‌های Blocks در Jira آمده‌اند.</li>
          <li>${hasSprints ? 'سرعت تیم از اسپرینت‌های بسته‌شده اندازه‌گیری شده است' : 'سرعت تیم فرضی است، چون اسپرینت بسته‌شده‌ای وجود ندارد'}، ولی تعداد sub-taskهای استوری‌های بدون تجزیه برآورد است. اگر بعد از تجزیه، تعداد واقعی بیشتر شود، زمان‌ها هم به همان نسبت بیشتر می‌شوند.</li>
          <li>تعداد نفرات (${fa(state.be, 0)} بک‌اند و ${fa(state.fe, 0)} فرانت) را می‌توانید بالای صفحه تغییر دهید. تعطیلات رسمی، مرخصی، باگ‌ها و بازبینی کد در برنامه دیده نشده‌اند.</li>
        </ul></div>`;
}
