import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getDomainDataAndFetchToRedis = async (domain: string) => {
  const getSite = await prismaDB.site.findUnique({
    where: {
      subdomain: domain,
    },
    include: { user: true, restaurant: true },
  });

  if (getSite?.id) {
    await redis.set(
      `app-domain-${getSite?.subdomain}`,
      JSON.stringify(getSite)
    );
  }

  return getSite;
};
