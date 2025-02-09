import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { getOutletById } from "../../../lib/outlet";
import { redis } from "../../../services/redis";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { UnauthorizedException } from "../../../exceptions/unauthorized";

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
    where: {
      subdomain: subdomain,
    },
    include: { user: true, restaurant: true },
  });

  if (getSite?.id) {
    await redis.set(
      `app-domain-${getSite?.subdomain}`,
      JSON.stringify(getSite)
    );
  }

  return res.json({
    success: true,
    site: getSite,
  });
};

export const createSubDomain = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { subdomain } = req.body;

  if (!subdomain) {
    throw new BadRequestsException(
      "Subdomain is required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.site.create({
    data: {
      // @ts-ignore
      adminId: req?.user?.id,
      restaurantId: outlet?.id,
      subdomain: subdomain,
    },
  });

  const getDomain = await prismaDB.site.findFirst({
    where: {
      restaurantId: outlet?.id,
      // @ts-ignore
      adminId: req.user?.id,
    },
  });

  if (getDomain?.id) {
    await redis.set(`o-domain-${outletId}`, JSON.stringify(getDomain));
  }

  return res.json({
    success: true,
    message: "SubDomain Created Successfully",
  });
};

export const deleteSite = async (req: Request, res: Response) => {
  const { outletId, siteId } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  const userId = req?.user?.id;

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (outlet.adminId !== userId) {
    throw new UnauthorizedException(
      "Your Unauthorized To delete this Settings",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findDomain = await prismaDB.site.findFirst({
    where: {
      id: siteId,
    },
  });

  if (!findDomain?.id) {
    throw new BadRequestsException(
      "Domain settings not Found",
      ErrorCode.UNAUTHORIZED
    );
  }

  await prismaDB.site.delete({
    where: {
      id: findDomain?.id,
      restaurantId: outletId,
      adminId: userId,
    },
  });

  await redis.del(`app-domain-${findDomain?.subdomain}`);
  await redis.del(`o-domain-${outletId}`);

  return res.json({
    success: true,
    message: "Domain Settings Deleted Success",
  });
};

export const checkDomain = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { subdomain } = req.query as { subdomain: string };

  if (subdomain === undefined || subdomain === "") {
    return res.json({ success: false, message: "Subdomain is required" });
  }

  if (subdomain.match(/[^a-zA-Z0-9-]/)) {
    return res.json({
      success: false,
      message: "Subdomain cannot contain spaces, dashes, or underscores",
    });
  }

  const outlet = await getOutletById(outletId);

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const site = await prismaDB.site.findFirst({
    where: {
      subdomain: subdomain,
    },
  });

  if (site?.id) {
    return res.json({
      success: false,
      message: "This subdomain is already taken",
    });
  }

  return res.json({
    success: true,
    message: "Domain is available",
  });
};
