import { randomBytes } from 'node:crypto';

export type PaymentMethod = 'upi' | 'card' | 'cod';

export interface PaymentResult {
  status: 'paid' | 'pending';
  ref: string | null;
}

/**
 * Payment gateway contract. Wire Razorpay (UPI-first) here: createPayment would
 * create a Razorpay order and the client would complete checkout, with a
 * webhook flipping payment_status to 'paid'.
 */
export interface PaymentGateway {
  methods(): { id: PaymentMethod; label: string; hint: string }[];
  createPayment(input: { orderCode: string; amount: number; method: PaymentMethod }): Promise<PaymentResult>;
  refund(input: { ref: string; amount: number }): Promise<void>;
}

/** Mock: UPI and card payments succeed instantly; COD stays pending until delivery. */
export class MockPaymentGateway implements PaymentGateway {
  methods() {
    return [
      { id: 'upi' as const, label: 'UPI', hint: 'GPay, PhonePe, Paytm' },
      { id: 'card' as const, label: 'Card', hint: 'Debit or credit' },
      { id: 'cod' as const, label: 'Cash on delivery', hint: 'Pay the driver' },
    ];
  }
  async createPayment({ method }: { orderCode: string; amount: number; method: PaymentMethod }): Promise<PaymentResult> {
    if (method === 'cod') return { status: 'pending', ref: null };
    return { status: 'paid', ref: `mockpay_${randomBytes(6).toString('hex')}` };
  }
  async refund({ ref, amount }: { ref: string; amount: number }) {
    console.log(`[payment] mock refund ₹${amount} for ${ref}`);
  }
}

export const paymentGateway: PaymentGateway = new MockPaymentGateway();
