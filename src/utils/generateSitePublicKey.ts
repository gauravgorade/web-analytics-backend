import { randomBytes } from "crypto";

export const generateSitePublicKey = (domain: string): string => {
  const cleanedDomain = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domainPart = (cleanedDomain.slice(0, 3) || "XXX").toUpperCase();
  const randomPart = randomBytes(2).toString("hex").toUpperCase();

  return `WA-${domainPart}${randomPart}`;
};
