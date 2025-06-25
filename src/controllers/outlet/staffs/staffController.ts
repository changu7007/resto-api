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
import { differenceInMinutes } from "date-fns";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { UnauthorizedException } from "../../../exceptions/unauthorized";

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
    posAccess: staff?.posAccess,
    primeAccess: staff?.primeAccess,
    orders: staff?.orders?.length,
    payFrequency: staff?.payFrequency,
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

export const getStaffAttendance = async (req: Request, res: Response) => {
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

  console.log(`Search: ${search}`);
  console.log(`Sorting: ${JSON.stringify(sorting)}`);
  console.log(`Filters: ${JSON.stringify(filters)}`);
  console.log(`Pagination: ${JSON.stringify(pagination)}`);

  // Get today's date range
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Build where conditions for staff query
  const whereConditions = {
    restaurantId: outletId,
    ...(search &&
      search.length > 0 && {
        OR: [{ name: { contains: search, mode: "insensitive" as const } }],
      }),
    ...(filters.length > 0 && {
      AND: filters.map((filter) => ({
        [filter.id]: { in: filter.value },
      })),
    }),
  };
  console.log("Where Conditions:", JSON.stringify(whereConditions, null, 2));
  // Get total count first
  const totalCount = await prismaDB.staff.count({
    where: whereConditions,
  });

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = (pagination.pageIndex || 0) * take;

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Fetch paginated staff list
  const getStaffs = await prismaDB.staff.findMany({
    where: whereConditions,
    include: {
      orders: true,
    },
    orderBy,
    skip,
    take,
  });

  console.log(`Outlet Staffs: ${getStaffs.length}`);

  // Get or create check-in records for today
  const checkInRecords = await Promise.all(
    getStaffs.map(async (staff) => {
      const todayRecords = await prismaDB.checkInRecord.findMany({
        where: {
          staffId: staff.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          checkInTime: "asc",
        },
      });

      console.log(`Today Records: ${todayRecords.length}`);

      if (todayRecords.length === 0) {
        // Check if a default record already exists
        const existingDefaultRecord = await prismaDB.checkInRecord.findFirst({
          where: {
            staffId: staff.id,
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
            checkInTime: null,
            checkOutTime: null,
          },
        });

        if (!existingDefaultRecord) {
          // Create a default record only if no record exists
          const defaultRecord = await prismaDB.checkInRecord.create({
            data: {
              staffId: staff.id,
              date: startOfDay,
              checkInTime: null,
              checkOutTime: null,
            },
          });

          return {
            staff,
            records: [defaultRecord],
            totalWorkingHours: 0,
          };
        } else {
          return {
            staff,
            records: [existingDefaultRecord],
            totalWorkingHours: 0,
          };
        }
      }
      console.log("Total Workinh hour calculate INitiated");
      // Calculate total working hours from multiple check-ins
      let totalWorkingMinutes = 0;
      todayRecords.forEach((record) => {
        if (record.checkInTime && record.checkOutTime) {
          totalWorkingMinutes += differenceInMinutes(
            record.checkOutTime,
            record.checkInTime
          );
        }
      });
      console.log(`Today Records: ${todayRecords.length}`);

      return {
        staff,
        records: todayRecords,
        totalWorkingHours: Math.round((totalWorkingMinutes / 60) * 100) / 100,
      };
    })
  );

  // Format attendance data
  const formattedAttendance = checkInRecords.map(
    ({ staff, records, totalWorkingHours }) => {
      const checkInHistory = records.map((record) => ({
        checkIn: record.checkInTime,
        checkOut: record.checkOutTime,
      }));

      // Determine status based on check-in history
      let status: "Present" | "Not Logged" | "Absent" = "Absent";

      if (checkInHistory.some((record) => record.checkIn)) {
        status = "Present";
      } else if (checkInHistory.length > 0) {
        status = "Not Logged";
      }

      return {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        image: staff.image || undefined,
        checkIn: checkInHistory[0]?.checkIn || undefined,
        checkOut:
          checkInHistory[checkInHistory.length - 1]?.checkOut || undefined,
        status,
        totalEntries: checkInHistory.filter((record) => record.checkIn).length,
        workingHours: totalWorkingHours,
        checkInHistory,
      };
    }
  );

  console.log({
    totalRecords: totalCount,
    pageSize: take,
    pageIndex: pagination.pageIndex,
    skip,
    fetchedRecords: getStaffs.length,
    formattedRecords: formattedAttendance.length,
  });

  console.log(`Paginated Records: ${formattedAttendance.length}`);

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      attendance: formattedAttendance,
    },
    message: "Staff attendance fetched successfully ✅",
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

  const { name, email, phoneNo, role, salary, joinedDate, payFrequency } =
    req.body;

  const checkEmail = await prismaDB.staff.findFirst({
    where: {
      email,
    },
  });

  if (checkEmail) {
    throw new BadRequestsException(
      "This Email is already Registered with another Staff",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const checkPhoneNo = await prismaDB.staff.findFirst({
    where: {
      phoneNo,
    },
  });

  if (checkPhoneNo) {
    throw new BadRequestsException(
      "This Phone Number is already Registered with another Staff",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

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
      payFrequency,
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

  const { name, email, phoneNo, role, salary, joinedDate, payFrequency } =
    req.body;

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
      payFrequency,
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

export const getStaffIds = async (req: Request, res: Response) => {
  const { outletId, staffId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const staff = await prismaDB.staff.findMany({
    where: {
      restaurantId: getOutlet.id,
    },
    select: {
      id: true,
      name: true,
      role: true,
      assignedTables: true,
    },
  });

  return res.json({
    success: true,
    staffs: staff,
    message: "Staffs Fetched",
  });
};

export const bulkPosAccessEnable = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { selectedId } = req.body;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  // Validate input
  if (!Array.isArray(selectedId) || selectedId?.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please select neccessarry staff",
    });
  }

  // Perform status update within a transaction
  await prismaDB.$transaction(async (tx) => {
    // Update related orders' statuses to "CANCELLED"
    await tx.staff.updateMany({
      where: {
        id: {
          in: selectedId,
        },
        restaurantId: outlet.id,
      },
      data: {
        posAccess: true,
      },
    });
  });

  return res.json({
    success: true,
    message: "Selected Staff Pos Access Updated ✅",
  });
};

export const bulkPosAccessDisable = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { selectedId } = req.body;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  // Validate input
  if (!Array.isArray(selectedId) || selectedId?.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please select neccessarry staff",
    });
  }

  // Perform status update within a transaction
  await prismaDB.$transaction(async (tx) => {
    // Update related orders' statuses to "CANCELLED"
    await tx.staff.updateMany({
      where: {
        id: {
          in: selectedId,
        },
        restaurantId: outlet.id,
      },
      data: {
        posAccess: false,
      },
    });
  });

  return res.json({
    success: true,
    message: "Selected Staff Pos Access Disabled ✅",
  });
};

export const assignTablesForWaiters = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { staffId, assignedTables } = req.body;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Validate input format
  if (!staffId || !Array.isArray(assignedTables)) {
    throw new BadRequestsException(
      "Invalid staff assignment format. Expecting { staffId: string, assignedTables: string[] }",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.$transaction(async (tx) => {
    // Verify staff exists and is a waiter
    const staff = await tx.staff.findFirst({
      where: {
        id: staffId,
        restaurantId: getOutlet.id,
      },
    });

    if (!staff) {
      throw new NotFoundException(
        `Staff with ID ${staffId} not found`,
        ErrorCode.NOT_FOUND
      );
    }

    if (staff.role !== "WAITER") {
      throw new BadRequestsException(
        `Staff ${staff.name} is not a WAITER`,
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    // Verify all tables exist
    if (assignedTables.length > 0) {
      const tables = await tx.table.findMany({
        where: {
          id: { in: assignedTables },
          restaurantId: getOutlet.id,
        },
        select: { id: true },
      });

      if (tables.length !== assignedTables.length) {
        throw new BadRequestsException(
          `Some tables assigned to staff ${staff.name} were not found`,
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }
    }

    // Unassign tables from other waiters if they are in the new assignment
    const otherWaiters = await tx.staff.findMany({
      where: {
        restaurantId: getOutlet.id,
        role: "WAITER",
        id: { not: staffId },
        assignedTables: {
          hasSome: assignedTables,
        },
      },
    });

    for (const waiter of otherWaiters) {
      const newAssignedTables = waiter.assignedTables.filter(
        (tableId) => !assignedTables.includes(tableId)
      );
      await tx.staff.update({
        where: { id: waiter.id },
        data: { assignedTables: newAssignedTables },
      });
    }

    // Assign the new set of tables to the target waiter
    await tx.staff.update({
      where: {
        id: staffId,
        restaurantId: getOutlet.id,
      },
      data: {
        assignedTables: assignedTables,
      },
    });
  });

  // Invalidate cache for staff data
  await redis.del(`staffs-${getOutlet.id}`);

  return res.json({
    success: true,
    message: "Table assignments saved successfully ✅",
  });
};

export const getTablesAssignedToWaiters = async (
  req: Request,
  res: Response
) => {
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
    select: {
      id: true,
      name: true,
      restaurantId: true,
      role: true,
      assignedTables: true,
    },
  });

  if (!staff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    data: staff,
    message: "Staff Tables Fetched",
  });
};
