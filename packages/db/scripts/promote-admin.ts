/**
 * Promote a Supabase user to ADMIN role in our mirror users table.
 *
 * Usage:
 *   pnpm admin:promote <email>
 *
 * The user must already exist in public.users (which happens automatically on
 * first authenticated API call after signup). If they signed up but never made
 * an authenticated request, run this AFTER they visit any page logged in.
 */
import { prisma } from '../src/index.js';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: pnpm admin:promote <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email "${email}" in public.users.`);
    console.error('Make sure they have signed up AND made at least one authenticated');
    console.error('request (e.g. visited /account once after logging in).');
    process.exit(1);
  }

  if (user.role === 'ADMIN') {
    console.info(`${email} is already an ADMIN. Nothing to do.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, role: true },
  });

  console.info(`Promoted ${updated.email} → ${updated.role} (id: ${updated.id})`);
  console.info('Open http://localhost:3000/admin/login and sign in.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
