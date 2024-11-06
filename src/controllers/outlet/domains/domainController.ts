import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { getOutletById } from "../../../lib/outlet";
import { redis } from "../../../services/redis";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";

export const getDomain = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const rDomains = await redis.get(`o-domain-${outletId}`);

  if (rDomains) {
    return res.json({
      success: true,
      domain: JSON.parse(rDomains),
      message: "Fetched Items By Redis ✅",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getDomain = await prismaDB.site.findFirst({
    where: {
      restaurantId: outlet?.id,
      // @ts-ignore
      adminId: req.user?.id,
    },
  });

  await redis.set(`o-domain-${outletId}`, JSON.stringify(getDomain));

  return res.json({
    success: true,
    domain: getDomain,
    message: "Fetched Items by database ✅",
  });
};

export const getPrimeDomain = async (req: Request, res: Response) => {
  const { subdomain } = req.params;

  const site = await redis.get(`app-domain-${subdomain}`);

  if (site) {
    return res.json({
      success: true,
      message: "Boosted",
      site: JSON.parse(site),
    });
  }

  const getSite = await prismaDB.site.findUnique({
    where: subdomain ? { subdomain } : { customDomain: subdomain },
    include: { user: true, restaurant: true },
  });

  await redis.set(`app-domain-${getSite?.subdomain}`, JSON.stringify(getSite));

  return res.json({
    success: true,
    site: getSite,
  });
};
