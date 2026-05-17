import type { PrismaClient, Prisma } from '@vivasvana/db';

export interface AddressInput {
  name: string;
  phone: string;
  addressLine: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

export class AddressService {
  constructor(private readonly prisma: PrismaClient) {}

  async listForUser(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getForUser(userId: string, id: string) {
    return this.prisma.address.findFirst({ where: { id, userId } });
  }

  async create(userId: string, input: AddressInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      // If this is the user's first address, mark default automatically.
      const count = await tx.address.count({ where: { userId } });
      return tx.address.create({
        data: {
          userId,
          name: input.name,
          phone: input.phone,
          addressLine: input.addressLine,
          landmark: input.landmark,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          country: input.country ?? 'IN',
          isDefault: input.isDefault ?? count === 0,
        },
      });
    });
  }

  async update(userId: string, id: string, input: Partial<AddressInput>) {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.address.findFirst({ where: { id, userId } });
      if (!owned) throw new Error('ADDRESS_NOT_FOUND');
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId, NOT: { id } }, data: { isDefault: false } });
      }
      const data: Prisma.AddressUpdateInput = { ...input };
      return tx.address.update({ where: { id }, data });
    });
  }

  async delete(userId: string, id: string) {
    const owned = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!owned) throw new Error('ADDRESS_NOT_FOUND');
    await this.prisma.address.delete({ where: { id } });
    // If the deleted address was the default, promote the most-recent one.
    if (owned.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  }
}
