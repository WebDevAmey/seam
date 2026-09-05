import { prisma } from "../prisma.js";

export async function isOptedOut(merchantId: string, phone: string): Promise<boolean> {
  const row = await prisma.optOut.findUnique({
    where: { merchantId_phone: { merchantId, phone } },
  });
  return row !== null;
}
