import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getDomainDataAndFetchToRedis = async (domain: string) => {
  const getSite = await prismaDB.site.findUnique({
    where: {
      subdomain: domain,
    },
    include: { user: true, restaurants: true },
  });

  if (getSite?.id) {
    await redis.set(
      `app-domain-${getSite?.subdomain}`,
      JSON.stringify(getSite)
    );
  }

  return getSite;
};
