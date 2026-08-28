import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function checkCredentials() {
  const email = "reyhandy05@gmail.com";
  const testPassword = "Syncup4/4";

  console.log(`\n🔍 Memeriksa user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("❌ ERROR: Email TIDAK DITEMUKAN di database!");
    return;
  }

  console.log("✅ User ditemukan!");
  console.log(`- ID: ${user.id}`);
  console.log(`- Role: ${user.role}`);
  console.log(`- MFA Enabled: ${user.mfaEnabled}`);
  console.log(`- Hash di DB: ${user.passwordHash?.substring(0, 20)}...`);

  // Tes verifikasi password
  try {
    const isMatch = await argon2.verify(user.passwordHash, testPassword);
    if (isMatch) {
      console.log(`\n🎉 HASIL: Password "${testPassword}" COCOK dan VALID 100%!`);
    } else {
      console.log(`\n❌ HASIL: Password "${testPassword}" SALAH (tidak cocok dengan hash)!`);
    }
  } catch (err) {
    console.log("\n⚠️ Gagal memverifikasi hash (mungkin format hash bukan Argon2):", err.message);
  }
}

checkCredentials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());