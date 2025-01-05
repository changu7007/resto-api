import { Request, Response } from "express";
import { redis } from "../../../services/redis";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { getOutletById } from "../../../lib/outlet";
import { getAllStaff } from "../../../lib/outlet/get-staffs";
import { getStaffById } from "../../../lib/get-users";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";

export const getStaffsForTable = async (req: Request, res: Response) => {
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
  const totalCount = await prismaDB.staff.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getStaffs = await prismaDB.staff.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      orders: true,
    },
    orderBy,
  });

  const formattedStaffs = getStaffs?.map((staff) => ({
    id: staff?.id,
    name: staff?.name,
    email: staff?.email,
    role: staff?.role,
    salary: staff?.salary,
    orders: staff?.orders?.length,
    phoneNo: staff?.phoneNo,
    joinedDate: staff?.joinedDate,
    createdAt: staff?.createdAt,
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      staffs: formattedStaffs,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getAllStaffs = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisStaff = await redis.get(`staffs-${outletId}`);

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (redisStaff) {
    return res.json({
      success: true,
      staffs: JSON.parse(redisStaff),
      message: "Powered In",
    });
  }

  const staffs = await prismaDB.staff.findMany({
    where: {
      restaurantId: getOutlet.id,
    },
    include: {
      orderSession: {
        include: {
          orders: true,
        },
      },
    },
  });

  await redis.set(`staffs-${getOutlet.id}`, JSON.stringify(staffs));

  return res.json({
    success: true,
    staffs: staffs,
    message: "Powered Up",
  });
};

export const getStaffId = async (req: Request, res: Response) => {
  const { outletId, staffId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const staff = await getStaffById(getOutlet.id, staffId);

  if (!staff?.id) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    staff: staff,
    message: "Staff Fetched",
  });
};

export const createStaff = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { name, email, phoneNo, role, salary, joinedDate } = req.body;

  await prismaDB.staff.create({
    data: {
      restaurantId: getOutlet.id,
      name,
      email,
      salary,
      password: "password",
      joinedDate,
      phoneNo,
      role,
    },
  });

  await getAllStaff(getOutlet.id);

  return res.json({
    success: true,
    message: "Staff Created Success ✅",
  });
};

export const updateStaff = async (req: Request, res: Response) => {
  const { outletId, staffId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const staff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
      restaurantId: getOutlet.id,
    },
  });

  if (!staff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  const { name, email, phoneNo, role, salary, joinedDate } = req.body;

  await prismaDB.staff.update({
    where: {
      id: staff.id,
      restaurantId: getOutlet.id,
    },
    data: {
      name,
      email,
      salary,
      joinedDate,
      phoneNo,
      role,
    },
  });

  await getAllStaff(getOutlet.id);

  return res.json({
    success: true,
    message: "Staff Updated Success ✅",
  });
};

export const deleteStaff = async (req: Request, res: Response) => {
  const { outletId, staffId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const staff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
      restaurantId: getOutlet.id,
    },
  });

  if (!staff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.staff.delete({
    where: {
      id: staff.id,
      restaurantId: getOutlet.id,
    },
  });

  await getAllStaff(getOutlet.id);

  return res.json({
    success: true,
    message: "Staff Delleted Success ✅",
  });
};
