import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { getOutletById } from "../../../lib/outlet";
import { redis } from "../../../services/redis";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { inviteCode } from "../order/orderOutletController";

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
      restaurants: {
        some: {
          id: outlet?.id,
        },
      },
    },
  });

  if (getDomain?.code === null) {
    await prismaDB.site.update({
      where: {
        id: getDomain?.id,
      },
      data: { code: inviteCode() },
    });
  }

  await redis.set(
    `o-domain-${outletId}`,
    JSON.stringify({ ...getDomain, franchiseModel: outlet?.franchiseModel }),
    "EX",
    60 * 60 // 1 hour
  );

  return res.json({
    success: true,
    domain: { ...getDomain, franchiseModel: outlet?.franchiseModel },
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
    select: {
      id: true,
      subdomain: true,
      customDomain: true,
      restaurants: {
        select: {
          id: true,
          name: true,
          phoneNo: true,
          address: true,
          pincode: true,
          city: true,
          outletType: true,
          email: true,
          restaurantName: true,
          imageUrl: true,
          siteId: true,
          areaLat: true,
          onlinePortal: true,
          areaLong: true,
          orderRadius: true,
          openTime: true,
          closeTime: true,
          isDineIn: true,
          isDelivery: true,
          isPickUp: true,
          fssai: true,
          deliveryFee: true,
          googlePlaceId: true,
          description: true,
          packagingFee: true,
        },
      },
    },
  });

  const formattedSite = {
    name: getSite?.restaurants[0]?.name,
    imageUrl: getSite?.restaurants[0]?.imageUrl,
    outletType: getSite?.restaurants[0]?.outletType,
    ...getSite,
  };

  if (getSite?.id) {
    await redis.set(
      `app-domain-${getSite?.subdomain}`,
      JSON.stringify(formattedSite),
      "EX",
      60 * 60 // 1 hour
    );
  }

  return res.json({
    success: true,
    site: formattedSite,
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

  const findSubDomain = await prismaDB.site.findFirst({
    where: {
      subdomain: subdomain,
    },
  });

  if (findSubDomain?.id) {
    throw new BadRequestsException(
      "Subdomain already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (subdomain.match(/[^a-zA-Z0-9-]/)) {
    throw new BadRequestsException(
      "Subdomain cannot contain spaces, dashes, or underscores",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (subdomain.length < 3) {
    throw new BadRequestsException(
      "Subdomain must be at least 3 characters long",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (subdomain.length > 30) {
    throw new BadRequestsException(
      "Subdomain must be less than 30 characters long",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (subdomain.startsWith("-") || subdomain.endsWith("-")) {
    throw new BadRequestsException(
      "Subdomain cannot start or end with a dash",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (subdomain.includes(" ")) {
    throw new BadRequestsException(
      "Subdomain cannot contain spaces",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (subdomain.includes("..")) {
    throw new BadRequestsException(
      "Subdomain cannot contain multiple dots",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const restaurantHasDomain = await prismaDB.site.findFirst({
    where: {
      restaurants: {
        some: {
          id: outletId,
        },
      },
    },
  });

  if (restaurantHasDomain?.id) {
    throw new BadRequestsException(
      "Restaurant already has a domain",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getDomain = await prismaDB.site.create({
    data: {
      // @ts-ignore
      adminId: req?.user?.id,
      subdomain: subdomain,
      code: inviteCode(),
      restaurants: {
        connect: {
          id: outletId,
        },
      },
    },
  });

  await prismaDB.restaurant.update({
    where: {
      id: outletId,
    },
    data: {
      siteId: getDomain?.id,
      franchiseModel: "MASTER",
    },
  });

  await Promise.all([
    redis.del(`O-${outlet?.id}`),
    redis.del(`app-domain-${getDomain?.subdomain}`),
    redis.del(`o-domain-${outletId}`),
  ]);

  return res.json({
    success: true,
    id: getDomain?.id,
    subdomain: getDomain?.subdomain,
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
      adminId: userId,
    },
  });

  await Promise.all([
    redis.del(`O-${outlet?.id}`),
    redis.del(`app-domain-${findDomain?.subdomain}`),
    redis.del(`o-domain-${outletId}`),
  ]);

  return res.json({
    success: true,
    message: "Domain Settings Deleted Success",
  });
};

export const unlinkDomainForRestaurant = async (
  req: Request,
  res: Response
) => {
  const { outletId, siteId } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  const userId = req?.user?.id;

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const findDomain = await prismaDB.site.findFirst({
    where: {
      id: siteId,
      restaurants: {
        some: {
          id: outletId,
        },
      },
    },
  });

  if (!findDomain?.id) {
    throw new BadRequestsException(
      "Franchise Domain not Found",
      ErrorCode.UNAUTHORIZED
    );
  }

  if (findDomain?.adminId === userId) {
    throw new UnauthorizedException(
      "Your Unauthorized To Unlink this Domain, this feature is only available for Franchise Domain",
      ErrorCode.UNAUTHORIZED
    );
  }

  await prismaDB.site.update({
    where: {
      id: findDomain?.id,
      restaurants: {
        some: {
          id: outletId,
        },
      },
    },
    data: {
      restaurants: {
        disconnect: {
          id: outletId,
        },
      },
    },
  });

  await prismaDB.restaurant.update({
    where: {
      id: outletId,
    },
    data: {
      siteId: null,
      franchiseModel: "MASTER",
    },
  });

  await Promise.all([
    redis.del(`O-${outlet?.id}`),
    redis.del(`app-domain-${findDomain?.subdomain}`),
    redis.del(`o-domain-${outletId}`),
  ]);

  return res.json({
    success: true,
    message: "Domain Unlinked Successfully",
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

export const verifyFranchiseCode = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { code, franchiseModel } = req.body;

  if (!code || !franchiseModel) {
    throw new BadRequestsException(
      "Code and Franchise Model are required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (franchiseModel === "MASTER") {
    throw new BadRequestsException(
      "Master Cannot be linked for Franchise Domain",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const findMaster = await prismaDB.site.findFirst({
    where: {
      code: code,
    },
  });

  if (!findMaster?.id) {
    throw new BadRequestsException(
      "Invalid Franchise Code",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  console.log(findMaster);

  // await prismaDB.site.update({
  //   where: {
  //     id: findMaster?.id,
  //   },
  //   data: {
  //     restaurants: {
  //       connect: {
  //         id: outletId,
  //       },
  //     },
  //   },
  // });
  // await redis.del(`app-domain-${findMaster?.subdomain}`);
  // await redis.del(`o-domain-${outletId}`);

  return res.json({
    success: true,
    message: "Franchise Domain Fetched",
    data: {
      id: findMaster?.id,
      subDomain: findMaster?.subdomain,
    },
  });
};

export const linkFranchiseDomain = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { siteId, franchiseModel } = req.body;

  if (!siteId || !franchiseModel) {
    throw new BadRequestsException(
      "Verify Franchise Code and try again ",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (franchiseModel === "MASTER") {
    throw new BadRequestsException(
      "Master Cannot be linked for Franchise Domain",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const findMaster = await prismaDB.site.findFirst({
    where: {
      id: siteId,
    },
  });

  if (!findMaster?.id) {
    throw new BadRequestsException(
      "Franchise Domain Not Found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.site.update({
    where: {
      id: findMaster?.id,
    },
    data: {
      restaurants: {
        connect: {
          id: outletId,
        },
      },
    },
  });

  await prismaDB.restaurant.update({
    where: {
      id: outletId,
    },
    data: {
      siteId: findMaster?.id,
      franchiseModel: franchiseModel,
    },
  });

  await Promise.all([
    redis.del(`O-${outlet?.id}`),
    redis.del(`app-domain-${findMaster?.subdomain}`),
    redis.del(`o-domain-${outletId}`),
  ]);

  return res.json({
    success: true,
    message: "Franchise Domain Linked Successfully",
  });
};
