// Workday calendar: plan time is a number of workdays counted from `start`
// (index 0 = first workday on or after it; negative = workdays before it).

export const parseDay = (s) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

/** @param {{ start: Date, weekend: number[], locale: string }} opts  weekend = getDay() numbers */
export function createCalendar({ start, weekend, locale }) {
  const START = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const isOff = (d) => weekend.includes(d.getDay());

  const WD = [];
  for (const d = new Date(START); WD.length < 800; d.setDate(d.getDate() + 1)) if (!isOff(d)) WD.push(new Date(d));
  // workdays before START, nearest first
  const WDP = [];
  for (const d = new Date(START); WDP.length < 600;) {
    d.setDate(d.getDate() - 1);
    if (!isOff(d)) WDP.push(new Date(d));
  }

  const wdDate = (n) => (n >= 0 ? WD[Math.min(WD.length - 1, n)] : WDP[Math.min(WDP.length - 1, -n - 1)]);
  const dateAt = (x) => wdDate(Math.floor(x + 1e-6));
  const endDate = (e) => wdDate(Math.ceil(e - 1e-6) - 1);

  /** Workday index of the first workday on or after a date (negative in the past). */
  function wdIndex(d) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let i = 0;
    if (day >= START) {
      while (i < WD.length && WD[i] < day) i++;
      return i;
    }
    while (i < WDP.length && WDP[i] >= day) i++;
    return -i;
  }

  const fmt = (o) => new Intl.DateTimeFormat(locale, o);
  return {
    START, WD, WDP, wdDate, dateAt, endDate, wdIndex, parseDay,
    fmtD: fmt({ day: 'numeric', month: 'long' }),
    fmtDY: fmt({ day: 'numeric', month: 'long', year: 'numeric' }),
    fmtW: fmt({ day: 'numeric', month: 'short' }),
    fmtMon: fmt({ month: 'long' }),
    fmtYr: fmt({ year: 'numeric' }),
    fmtAt: fmt({ day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  };
}
