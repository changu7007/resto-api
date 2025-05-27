import { CashTransaction } from "@prisma/client";
import { prismaDB } from "..";
import { v4 as uuidv4 } from "uuid";
import { ENCRYPT_KEY } from "../secrets";
import CryptoJS from "crypto-js";

export function generateSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function getPeriodDates(period: string): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now; // Default to now as the end date

  switch (period) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      endDate = new Date(now.setHours(23, 59, 59, 999)); // End of today
      break;
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.setHours(0, 0, 0, 0)); // Start of yesterday
      endDate = new Date(yesterday.setHours(23, 59, 59, 999)); // End of yesterday
      break;
    case "week":
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      startDate = new Date(lastWeek.setHours(0, 0, 0, 0)); // Start of last week
      endDate = now; // Now is the end date
      break;
    case "month":
      const lastMonth = new Date(now);
      lastMonth.setMonth(now.getMonth() - 1);
      startDate = new Date(lastMonth.setHours(0, 0, 0, 0)); // Start of last month
      endDate = now; // Now is the end date
      break;
    case "year":
      const lastYear = new Date(now);
      lastYear.setFullYear(now.getFullYear() - 1);
      startDate = new Date(lastYear.setHours(0, 0, 0, 0)); // Start of last year
      endDate = now; // Now is the end date
      break;
    default:
      startDate = new Date(0); // Beginning of time for "all"
      endDate = now;
      break;
  }

  return { startDate, endDate };
}

export const generateVerificationToken = async (email: string) => {
  const token = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000);

  const existingToken = await getVerificationTokenByEmail(email);

  if (existingToken) {
    await prismaDB.verificationToken.delete({
      where: {
        id: existingToken.id,
      },
    });
  }

  const verificationToken = await prismaDB.verificationToken.create({
    data: {
      email,
      token,
      expires,
    },
  });

  return verificationToken;
};

export const getVerificationTokenByEmail = async (email: string) => {
  try {
    const token = await prismaDB.verificationToken.findFirst({
      where: { email },
    });
    return token;
  } catch (error) {
    return null;
  }
};

export const getVerificationTokenByToken = async (token: string) => {
  try {
    const verificationToken = await prismaDB.verificationToken.findFirst({
      where: { token },
    });
    return verificationToken;
  } catch (error) {
    return null;
  }
};

export function getDaysRemaining(subscribedDate: Date) {
  // Parse the subscribed date
  const subscribed = new Date(subscribedDate);

  // Get today's date
  const today = new Date();

  // Calculate the difference in time (in milliseconds)
  const timeDiff = subscribed.getTime() - today.getTime();

  // Calculate the difference in days
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return daysRemaining;
}

export const calculateInOut = (transactions: CashTransaction[]) => {
  return transactions.reduce((balance, tx) => {
    return balance + tx.amount;
  }, 0);
};

export const encryptData = (data: string) => {
  return CryptoJS.AES.encrypt(data, ENCRYPT_KEY).toString();
};

export const decryptData = (ciphertext: string) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPT_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
