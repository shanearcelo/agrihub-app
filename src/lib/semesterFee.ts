export function getCurrentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8
    ? `1st Sem AY ${year}-${year + 1}`
    : `2nd Sem AY ${year - 1}-${year}`;
}

export function getSemesterPaymentStatus(paid: number): "unpaid" | "partial" | "paid" {
  if (paid >= 50) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}
