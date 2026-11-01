// Data-quality notes: what is missing in Jira and what the plan will assume instead.

export function qualityNotes(s) {
  const notes = [];
  if (s.open > 0 && s.withBlockers === 0) notes.push('هیچ استوری بازی لینک «Blocks» ندارد؛ وابستگی‌ها در نقشه دیده نمی‌شوند و همه‌ی کارها هم‌زمان قابل شروع حساب می‌شوند.');
  if (s.noSubtasks > 0) notes.push(`${s.noSubtasks} استوری باز ساب‌تسک ندارد؛ برای آن‌ها برآورد پیش‌فرض گرفته می‌شود.`);
  if (s.noEpic > 0) notes.push(`${s.noEpic} استوری باز اپیک ندارد؛ در ردیف «سایر / بدون اپیک» می‌آیند.`);
  if (s.externalOpen > 0) notes.push(`${s.externalOpen} استوری باز منتظر کاری بیرون از این پروژه است (وابستگی بیرونی).`);
  return notes;
}
