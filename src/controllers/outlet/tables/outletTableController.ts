import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { redis } from "../../../services/redis";
import { BadRequestsException } from "../../../exceptions/bad-request";
import {
  getFetchAllAreastoRedis,
  getFetchAllTablesToRedis,
} from "../../../lib/outlet/get-tables";
import { inviteCode } from "../order/orderOutletController";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";

export const getAllTablesForTable = async (req: Request, res: Response) => {
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
  const totalCount = await prismaDB.table.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const tables = await prismaDB.table.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
      name: true,
      areaId: true,
      qrcode: true,
      uniqueId: true,
      shortCode: true,
      areas: {
        select: {
          name: true,
        },
      },
      capacity: true,
      occupied: true,
    },
    orderBy,
  });

  const formattedTable = tables?.map((table) => ({
    id: table?.id,
    name: table?.name,
    areaId: table?.areaId,
    qrcode: table?.qrcode,
    uniqueId: table?.uniqueId,
    shortCode: table?.shortCode,
    area: table?.areas?.name,
    capacity: table?.capacity,
    occupied: table?.occupied,
  }));
  return res.json({
    success: true,
    data: {
      totalCount,
      tables: formattedTable,
    },
    message: "Fetched ✅",
  });
};

export const getAllAreasForTable = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
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
  const totalCount = await prismaDB.areas.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const areas = await prismaDB?.areas?.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy,
  });

  return res.json({
    success: true,
    data: { totalCount, areas: areas },
    message: "Powered Up ",
  });
};

export const getAllTables = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const rTables = await redis.get(`tables-${outletId}`);

  if (rTables) {
    return res.json({
      success: true,
      tables: JSON.parse(rTables),
      message: "Powered In ",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const tables = await getFetchAllTablesToRedis(outlet.id);

  return res.json({
    success: true,
    tables,
    message: "Fetched ✅",
  });
};

export const getAllAreas = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const rAreas = await redis.get(`a-${outletId}`);

  if (rAreas) {
    return res.json({
      success: true,
      areas: JSON.parse(rAreas),
      message: "Powered In ",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const allAreas = await getFetchAllAreastoRedis(outlet?.id);

  return res.json({
    success: true,
    areas: allAreas,
    message: "Powered Up ",
  });
};

export const createTable = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { name, shortCode, capacity, qrcode, uniqueId, areaId } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Table Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!capacity) {
    throw new BadRequestsException(
      "Capacity is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!shortCode) {
    throw new BadRequestsException(
      "ShortCode for Table Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!areaId) {
    throw new BadRequestsException(
      "Area type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.table.create({
    data: {
      name,
      capacity,
      uniqueId,
      shortCode,
      areaId,
      qrcode,
      restaurantId: getOutlet.id,
    },
  });

  await getFetchAllTablesToRedis(getOutlet.id);

  return res.json({
    success: true,
    message: "Table Created ✅",
  });
};

export const updateTable = async (req: Request, res: Response) => {
  const { outletId, tableId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const table = await prismaDB.table.findFirst({
    where: {
      id: tableId,
      restaurantId: getOutlet.id,
    },
  });

  if (!table?.id) {
    throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
  }

  const { name, shortCode, capacity, qrcode, uniqueId, areaId } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Table Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!capacity) {
    throw new BadRequestsException(
      "Capacity is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!shortCode) {
    throw new BadRequestsException(
      "ShortCode for Table Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!areaId) {
    throw new BadRequestsException(
      "Area type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.table.updateMany({
    where: {
      id: table.id,
    },
    data: {
      name,
      capacity,
      shortCode,
      areaId,
      qrcode,
    },
  });

  await getFetchAllTablesToRedis(getOutlet.id);

  return res.json({
    success: true,
    message: "Table Updated Success ✅",
  });
};

export const deleteTable = async (req: Request, res: Response) => {
  const { outletId, tableId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const table = await prismaDB.table.findFirst({
    where: {
      id: tableId,
      restaurantId: getOutlet.id,
    },
  });

  if (!table?.id) {
    throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.table.delete({
    where: {
      id: table.id,
      restaurantId: getOutlet.id,
    },
  });

  await getFetchAllTablesToRedis(getOutlet.id);

  return res.json({
    success: true,
    message: "Table Delleted Success ✅",
  });
};

export const createArea = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { name } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Area Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.areas.create({
    data: {
      name,
      restaurantId: getOutlet.id,
    },
  });

  await getFetchAllAreastoRedis(getOutlet.id);

  return res.json({
    success: true,
    message: "Area Created ✅",
  });
};

export const updateArea = async (req: Request, res: Response) => {
  const { outletId, areaId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const area = await prismaDB.areas.findFirst({
    where: {
      id: areaId,
      restaurantId: getOutlet.id,
    },
  });

  if (!area?.id) {
    throw new NotFoundException("Area Not Found", ErrorCode.NOT_FOUND);
  }

  const { name } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Area Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.areas.updateMany({
    where: {
      id: area.id,
    },
    data: {
      name,
    },
  });

  await getFetchAllAreastoRedis(getOutlet.id);

  return res.json({
    success: true,
    message: "Area Updated Success ✅",
  });
};

export const deleteArea = async (req: Request, res: Response) => {
  const { outletId, areaId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const area = await prismaDB.areas.findFirst({
    where: {
      id: areaId,
      restaurantId: getOutlet.id,
    },
  });

  if (!area?.id) {
    throw new NotFoundException("Area Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.areas.delete({
    where: {
      id: area.id,
      restaurantId: getOutlet.id,
    },
  });

  await getFetchAllAreastoRedis(getOutlet.id);

  return res.json({
    success: true,
    message: "Area Delleted Success ✅",
  });
};

export const connectTable = async (req: Request, res: Response) => {
  const { outletId, tableId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const _table = await prismaDB.table.findFirst({
    where: {
      id: tableId,
      restaurantId: getOutlet.id,
    },
  });

  if (!_table?.id) {
    throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
  }

  const table = await prismaDB.table.updateMany({
    where: {
      id: _table.id,
      restaurantId: getOutlet.id,
    },
    data: {
      inviteCode: inviteCode(),
    },
  });
  await getFetchAllAreastoRedis(getOutlet.id);
  await getFetchAllTablesToRedis(getOutlet.id);

  return res.json({ success: true, table });
};

export const verifyTable = async (req: Request, res: Response) => {
  const { outletId, tableId } = req.params;

  const { uniqueCode } = req.body;

  if (!uniqueCode) {
    throw new BadRequestsException(
      "Code Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const table = await prismaDB.table.findFirst({
    where: {
      id: tableId,
      restaurantId: getOutlet.id,
    },
  });

  if (!table?.id) {
    throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
  }

  if (!table.customerId) {
    throw new NotFoundException(
      "No Table user found, Scan QR again Please",
      ErrorCode.NOT_FOUND
    );
  }

  if (table.inviteCode === null || table.inviteCode === undefined) {
    console.log("Table has no inviteCode");
    throw new NotFoundException(
      "Table has no invite code set",
      ErrorCode.NOT_FOUND
    );

    // Decide how to handle this case. For example:
  }
  const trimmedTableCode = table.inviteCode.trim();
  const trimmedUniqueCode = uniqueCode.trim();
  console.log(trimmedTableCode, trimmedUniqueCode);
  if (trimmedTableCode === trimmedUniqueCode) {
    await getFetchAllAreastoRedis(getOutlet.id);
    await getFetchAllTablesToRedis(getOutlet.id);
    return res.json({
      success: true,
      message: "verified",
      customerId: table.customerId,
    });
  }
  throw new NotFoundException("Invalid Code", ErrorCode.NOT_FOUND);
};

export const getTableByUniqueId = async (req: Request, res: Response) => {
  const { outletId, uniqueId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const table = await prismaDB.table.findFirst({
    where: {
      restaurantId: getOutlet.id,
      uniqueId: uniqueId,
    },
  });

  return res.json({ success: true, table });
};

export const getTableCurrentOrders = async (req: Request, res: Response) => {
  const { outletId, tableId, customerId } = req.params;

  // @ts-ignore
  if (customerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const validCustomer = await prismaDB.customer.findFirst({
    where: {
      id: customerId,
    },
  });

  if (!validCustomer?.id) {
    throw new BadRequestsException(
      "You Need to login again",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const table = await prismaDB.table.findFirst({
    where: {
      id: tableId,
      restaurantId: getOutlet.id,
    },
  });

  if (!table?.id) {
    throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
  }

  const getTableOrders = await prismaDB.table.findFirst({
    where: {
      id: table.id,
      restaurantId: getOutlet.id,
      customerId: validCustomer.id,
    },
    include: {
      orderSession: {
        where: {
          id: table.currentOrderSessionId!,
        },
        include: {
          orders: {
            include: {
              orderItems: {
                include: {
                  menuItem: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const formattedOrders = {
    id: getTableOrders?.orderSession[0].id,
    tableId: getTableOrders?.orderSession[0].tableId,
    orders: getTableOrders?.orderSession[0].orders.map((orderItem) => ({
      id: orderItem.id,
      dineType: orderItem.orderType,
      orderStatus: orderItem.orderStatus,
      orderItems: orderItem.orderItems.map((foodItem) => ({
        id: foodItem.id,
        name: foodItem.name,
        type: foodItem.menuItem.type,
        quantity: foodItem.quantity,
        basePrice: foodItem.originalRate,
        price: foodItem.totalPrice,
      })),
      totalAmount: orderItem.totalAmount,
    })),
  };

  return res.json({
    success: true,
    orders: formattedOrders,
  });
};
