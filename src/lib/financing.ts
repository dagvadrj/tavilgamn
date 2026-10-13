export type FinancingRow = {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
};

/** Whole-tugrik estimate: interest on the remaining balance, fee paid upfront. */
export function financingEstimate(
  total: number,
  downPercent: number,
  periods: number,
  monthlyRate: number,
  feePercent = 0,
) {
  if (
    ![total, downPercent, periods, monthlyRate, feePercent].every(
      Number.isFinite,
    ) ||
    total < 0 ||
    total > 1e12 ||
    downPercent < 0 ||
    downPercent > 100 ||
    !Number.isInteger(periods) ||
    periods < 1 ||
    periods > 60 ||
    monthlyRate < 0 ||
    monthlyRate > 10 ||
    feePercent < 0 ||
    feePercent > 10
  )
    return null;
  const price = Math.round(total);
  const downPayment = Math.round((price * downPercent) / 100);
  const principal = price - downPayment;
  const fee = Math.round((principal * feePercent) / 100);
  const rate = monthlyRate / 100;
  const payment =
    rate === 0
      ? principal / periods
      : (principal * rate) / -Math.expm1(-periods * Math.log1p(rate));
  let balance = principal;
  const rows: FinancingRow[] = [];
  for (let period = 1; period <= periods; period++) {
    const interest = Math.round(balance * rate);
    const paidPrincipal =
      period === periods
        ? balance
        : Math.min(
            balance,
            rate === 0
              ? Math.floor(principal / periods) +
                  (period <= principal % periods ? 1 : 0)
              : Math.max(0, Math.round(payment) - interest),
          );
    balance -= paidPrincipal;
    rows.push({
      period,
      payment: paidPrincipal + interest,
      principal: paidPrincipal,
      interest,
      balance,
    });
  }
  const totalInterest = rows.reduce((sum, row) => sum + row.interest, 0);
  return {
    price,
    downPayment,
    principal,
    fee,
    rows,
    totalInterest,
    totalPayment: price + fee + totalInterest,
  };
}
