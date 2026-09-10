// Payload formats expected for BevForge integration.

export interface WebhookEvent<T> {
  eventId: string; // Stable UUID for idempotency
  eventType: string; // e.g., 'order.created', 'payment.succeeded'
  createdAt: string; // ISO-8601 string
  idempotencyKey?: string; // Optional idempotency key
  data: T;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderPayload {
  orderId: string;
  source: 'website' | 'admin' | 'wholesale';
  customerId: string; // Unique customer identifier
  customerName?: string;
  businessName?: string;
  customerEmail: string;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  shippingAddress?: Address;
  billingAddress?: Address;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string; // e.g. 'USD'
  notes?: string;
  tipCents?: number;
  isComp?: boolean;
}

export interface ClubSignupPayload {
  subscriptionId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  phone?: string;
  tierId: string; // e.g. 'core', 'reserve'
  status: 'active' | 'pending' | 'inactive';
  signUpDate: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  preferences?: Record<string, any>;
}

export interface PaymentEventPayload {
  stripeEventId?: string; // e.g. 'evt_...'
  paymentIntentId: string; // e.g. 'pi_...'
  orderId?: string; // If tied to a specific order
  subscriptionId?: string; // If tied to a club signup
  customerId: string;
  amountCents: number;
  currency: string;
  status: 'authorized' | 'captured' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
  receiptUrl?: string;
  errorMessage?: string;
}

// Outbound events queue from Website to BevForge
export type QueuedEvent = 
  | WebhookEvent<OrderPayload>
  | WebhookEvent<ClubSignupPayload>
  | WebhookEvent<PaymentEventPayload>;
