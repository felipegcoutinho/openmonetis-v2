export type InvoicePersonMovement = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  personRole: "admin" | "external";
  amount: number;
};

export type InvoicePersonPayment = { personId: string; amount: number };

export type InvoicePersonBalance = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  personRole: "admin" | "external";
  amount: number;
  paidAmount: number;
  remainingAmount: number;
};

export type InvoiceAdjustmentDraft = {
  amount: string;
  type: "income" | "expense";
};

export function calculateInvoicePersonBalances(
  movements: InvoicePersonMovement[],
  payments: InvoicePersonPayment[],
): InvoicePersonBalance[] {
  const people = new Map<string, InvoicePersonBalance>();
  for (const movement of movements) {
    const current = people.get(movement.personId) ?? {
      personId: movement.personId,
      personName: movement.personName,
      personAvatarUrl: movement.personAvatarUrl,
      personRole: movement.personRole,
      amount: 0,
      paidAmount: 0,
      remainingAmount: 0,
    };
    current.amount -= toCents(movement.amount);
    people.set(movement.personId, current);
  }
  const paidByPerson = new Map<string, number>();
  for (const payment of payments) {
    paidByPerson.set(
      payment.personId,
      (paidByPerson.get(payment.personId) ?? 0) + toCents(payment.amount),
    );
  }
  return [...people.values()]
    .map((person) => {
      const amount = Math.max(0, person.amount);
      const paidAmount = Math.min(amount, paidByPerson.get(person.personId) ?? 0);
      return {
        ...person,
        amount: fromCents(amount),
        paidAmount: fromCents(paidAmount),
        remainingAmount: fromCents(amount - paidAmount),
      };
    })
    .filter((person) => person.amount > 0)
    .sort(
      (a, b) => b.remainingAmount - a.remainingAmount || a.personName.localeCompare(b.personName),
    );
}

export function validateInvoicePaymentAllocations(
  balances: InvoicePersonBalance[],
  allocations: InvoicePersonPayment[],
) {
  const remainingByPerson = new Map(
    balances.map((item) => [item.personId, toCents(item.remainingAmount)]),
  );
  const allocated = new Set<string>();
  let totalCents = 0;
  for (const allocation of allocations) {
    if (allocated.has(allocation.personId)) throw new RangeError("duplicate_person");
    allocated.add(allocation.personId);
    const amount = toCents(allocation.amount);
    if (amount <= 0 || amount > (remainingByPerson.get(allocation.personId) ?? 0)) {
      throw new RangeError("amount_exceeds_person_balance");
    }
    totalCents += amount;
  }
  if (!totalCents) throw new RangeError("payment_amount_required");
  return { totalAmount: fromCents(totalCents) };
}

export function createInvoiceAdjustmentDraft(
  currentAmount: number,
  desiredAmount: number,
): InvoiceAdjustmentDraft | null {
  const adjustmentCents = toCents(desiredAmount) - toCents(currentAmount);
  if (adjustmentCents === 0) return null;

  return {
    amount: fromCents(-adjustmentCents).toFixed(2),
    type: adjustmentCents > 0 ? "expense" : "income",
  };
}

export function allocateInvoiceReduction(
  reductionAmount: number,
  people: Array<{ personId: string; amount: number }>,
): InvoicePersonPayment[] {
  const reductionCents = toCents(reductionAmount);
  const totalCents = people.reduce((sum, person) => sum + toCents(person.amount), 0);
  if (reductionCents <= 0 || reductionCents > totalCents) {
    throw new RangeError("invalid_invoice_reduction");
  }

  const allocations = people.map((person, index) => {
    const weightCents = toCents(person.amount);
    const weightedReduction = BigInt(reductionCents) * BigInt(weightCents);
    return {
      index,
      personId: person.personId,
      amountCents: Number(weightedReduction / BigInt(totalCents)),
      remainder: weightedReduction % BigInt(totalCents),
    };
  });
  let unallocatedCents =
    reductionCents - allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  for (const allocation of [...allocations].sort((left, right) =>
    left.remainder === right.remainder
      ? left.index - right.index
      : left.remainder > right.remainder
        ? -1
        : 1,
  )) {
    if (unallocatedCents === 0) break;
    allocation.amountCents += 1;
    unallocatedCents -= 1;
  }

  return allocations
    .map((allocation) => ({
      personId: allocation.personId,
      amount: fromCents(allocation.amountCents),
    }))
    .filter((allocation) => allocation.amount > 0);
}

function toCents(value: number) {
  return Math.round(value * 100);
}
function fromCents(value: number) {
  return value / 100;
}
