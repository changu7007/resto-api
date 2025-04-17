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
import { generateSlug } from "../../../lib/utils";
import { z } from "zod";

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

  const slug = generateSlug(name);

  // Check if table with same slug already exists
  const existingTable = await prismaDB.table.findFirst({
    where: {
      restaurantId: getOutlet.id,
      slug: slug,
    },
  });

  if (existingTable) {
    throw new BadRequestsException(
      "A table with this name already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.table.create({
    data: {
      name,
      slug: slug,
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

const generateFileName = (bytes = 32) => {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const slug = generateSlug(name);

  // Check if another table has the same slug (excluding current table)
  const existingTable = await prismaDB.table.findFirst({
    where: {
      restaurantId: getOutlet.id,
      slug: slug,
      id: {
        not: tableId,
      },
    },
  });

  if (existingTable) {
    throw new BadRequestsException(
      "A table with this name already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.table.updateMany({
    where: {
      id: table.id,
    },
    data: {
      name,
      slug: slug,
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
      slug: generateSlug(name),
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

  const inviteCodes = inviteCode();

  const table = await prismaDB.table.updateMany({
    where: {
      id: _table.id,
      restaurantId: getOutlet.id,
    },
    data: {
      inviteCode: inviteCodes,
    },
  });

  await getFetchAllAreastoRedis(getOutlet.id);
  await getFetchAllTablesToRedis(getOutlet.id);

  return res.json({ success: true, inviteCode: inviteCodes });
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
      inviteCode: table.inviteCode,
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

  const validCustomer = await prismaDB.customerRestaurantAccess.findFirst({
    where: {
      customerId: customerId,
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

export const markTableAsUnoccupied = async (req: Request, res: Response) => {
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

  if (table.currentOrderSessionId !== null) {
    throw new BadRequestsException(
      "Table has an active order session",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.table.updateMany({
    where: {
      id: table.id,
    },
    data: {
      occupied: false,
      currentOrderSessionId: null,
      inviteCode: null,
    },
  });

  await Promise.all([
    redis.del(`tables-${getOutlet.id}`),
    redis.del(`a-${getOutlet.id}`),
  ]);

  return res.json({ success: true, message: "Table marked as unoccupied" });
};

const tableTransferSchema = z.object({
  transferTableId: z.string({
    required_error: "Transfer Table ID is required",
  }),
});

export const transferTableOrder = async (req: Request, res: Response) => {
  const { outletId, tableId } = req.params;

  const { data, error } = tableTransferSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const table = await prismaDB.table.findFirst({
    where: { id: tableId, restaurantId: getOutlet.id },
  });

  if (!table?.id) {
    throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
  }

  const transferTable = await prismaDB.table.findFirst({
    where: {
      id: data.transferTableId,
      restaurantId: getOutlet.id,
      occupied: false,
    },
  });

  if (!transferTable?.id) {
    throw new NotFoundException(
      "Transfer Table Not Found / Table is Occupied",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.$transaction(async (tx) => {
    await tx.table.updateMany({
      where: { id: transferTable.id },
      data: {
        currentOrderSessionId: table.currentOrderSessionId,
        occupied: true,
        inviteCode: inviteCode(),
      },
    });

    await tx.table.updateMany({
      where: { id: table.id },
      data: {
        occupied: false,
        currentOrderSessionId: null,
        inviteCode: null,
      },
    });

    const findOrderSession = await tx.orderSession.findFirst({
      where: { id: table.currentOrderSessionId! },
    });

    if (!findOrderSession?.id) {
      throw new NotFoundException(
        "No Order Session Found, you can mark table as unoccupied",
        ErrorCode.NOT_FOUND
      );
    }

    // updateOrdersession
    await tx.orderSession.update({
      where: { id: findOrderSession.id },
      data: {
        tableId: transferTable.id,
      },
    });
  });

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
  ]);

  return res.json({ success: true, message: "Table Order Transferred" });
};

export const createBulkTables = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { tables } = req.body;

  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    throw new BadRequestsException(
      "Tables array is required and must not be empty",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Validate each table in the array
  for (const table of tables) {
    if (!table.name) {
      throw new BadRequestsException(
        "Table Name is Required for all tables",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    if (!table.capacity) {
      throw new BadRequestsException(
        "Capacity is Required for all tables",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    if (!table.shortCode) {
      throw new BadRequestsException(
        "ShortCode for Table Name is Required for all tables",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    if (!table.areaId) {
      throw new BadRequestsException(
        "Area type is Required for all tables",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  // Generate slugs and check for duplicates
  const slugs = new Set<string>();
  const tablesWithSlugs = tables.map((table) => {
    const slug = generateSlug(table.name);
    if (slugs.has(slug)) {
      throw new BadRequestsException(
        "Duplicate table names are not allowed",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
    slugs.add(slug);
    return { ...table, slug };
  });

  // Check if any of the slugs already exist in the database
  const existingTables = await prismaDB.table.findMany({
    where: {
      restaurantId: getOutlet.id,
      slug: {
        in: Array.from(slugs) as string[],
      },
    },
  });

  if (existingTables.length > 0) {
    throw new BadRequestsException(
      "Some table names already exist",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Create all tables in a transaction
  await prismaDB.$transaction(async (tx) => {
    for (const table of tablesWithSlugs) {
      await tx.table.create({
        data: {
          name: table.name,
          slug: table.slug,
          capacity: table.capacity,
          uniqueId: generateFileName(),
          shortCode: table.shortCode,
          areaId: table.areaId,
          qrcode: table.qrcode || null,
          restaurantId: getOutlet.id,
        },
      });
    }
  });

  // Update Redis cache
  await redis.del(`tables-${outletId}`);

  return res.json({
    success: true,
    message: `${tables.length} Tables Created Successfully ✅`,
  });
};
