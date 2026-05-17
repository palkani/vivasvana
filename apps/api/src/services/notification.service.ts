import type { PrismaClient } from '@vivasvana/db';
import { sendEmail } from '../integrations/email.js';
import { renderOrderConfirmation, renderWelcome } from '../emails/templates.js';

/**
 * Fire-and-forget notification dispatcher. Failures should never block the
 * primary request — we log and move on. A Phase 3 outbox table can pick up
 * retries if reliability becomes a concern.
 */
export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async sendWelcome(args: { name?: string | null; email: string }) {
    try {
      const msg = renderWelcome(args);
      await sendEmail({ to: args.email, ...msg });
    } catch (err) {
      console.error('welcome email failed', err);
    }
  }

  async sendOrderConfirmation(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, shippingAddress: true },
      });
      if (!order) return;
      const msg = renderOrderConfirmation(order);
      await sendEmail({ to: order.email, ...msg });
    } catch (err) {
      console.error('order confirmation email failed', err);
    }
  }
}
