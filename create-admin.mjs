import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = "reyhandy05@gmail.com";
  const plainPassword = "Syncup4/4";
  const passwordHash = await argon2.hash(plainPassword);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "ADMIN",
      mfaEnabled: false,
    },
    create: {
      email,
      name: "Ariel Reyhandy",
      passwordHash,
      role: "ADMIN",
      mfaEnabled: false,
    },
  });

  console.log(`\n✅ Akun admin berhasil diperbarui (MFA Bypass Aktif)!`);
  console.log(`Email: ${user.email}`);
  console.log(`MFA Enabled: ${user.mfaEnabled}\n`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());