// EVENT-409-1 — mag "Tickets (opnieuw) mailen" voor deze bestelling?
// Niet bij een geannuleerde of volledig terugbetaalde bestelling: die tickets gelden
// niet meer. Een gedeeltelijke terugbetaling mag wel. De server weigert hetzelfde
// geval (send-ticket-confirmation, foutcode ORDER_CLOSED).

export interface ResendOrderState {
  status: string | null | undefined;
  payment_status: string | null | undefined;
}

export function ticketOrderClosed(order: ResendOrderState): boolean {
  return order.status === 'cancelled' || order.payment_status === 'refunded';
}

export function canResendTickets(order: ResendOrderState): boolean {
  const paid = order.payment_status === 'paid' || order.payment_status === 'partially_refunded';
  return paid && !ticketOrderClosed(order);
}
