import { Request, Response } from "express";
import {
  getOutletById,
  getOutletCustomerAndFetchToRedis,
} from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { redis } from "../../../services/redis";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";

export const getCustomersForTable = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.customerRestaurantAccess.count({
    where: {
      restaurantId: outletId,
      OR: [{ customer: { name: { contains: search, mode: "insensitive" } } }],
      AND: filterConditions,
    },
  });

  const getCustomers = await prismaDB.customerRestaurantAccess.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ customer: { name: { contains: search, mode: "insensitive" } } }],
      AND: filterConditions,
    },
    include: {
      customer: true,
      orderSession: true,
    },
    orderBy,
  });

  const formattedCustomers = getCustomers?.map((staff) => ({
    id: staff?.id,
    name: staff?.customer?.name,
    email: staff?.customer?.email,
    phoneNo: staff?.customer?.phoneNo,
    orders: staff?.orderSession?.length,
    createdAt: staff?.createdAt,
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      customers: formattedCustomers,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getAllCustomer = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisCustomers = await redis.get(`customers-${outletId}`);

  if (redisCustomers) {
    return res.json({
      success: true,
      customers: JSON.parse(redisCustomers),
      message: "Powered In",
    });
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const customers = await getOutletCustomerAndFetchToRedis(getOutlet?.id);

  return res.json({
    success: true,
    customers: customers,
  });
};
