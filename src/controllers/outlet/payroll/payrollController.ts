import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { prismaDB } from "../../..";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";
import { websocketManager } from "../../../services/ws";
import { redis } from "../../../services/redis";

export const getThisMonthPayroll = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { month } = req.query;

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
      : [{ date: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  let startDate;
  let endDate;

  if (month === "last") {
    startDate = startOfMonth(subMonths(new Date(), 1));
    endDate = endOfMonth(subMonths(new Date(), 1));
  } else if (month === "previous") {
    startDate = startOfMonth(subMonths(new Date(), 2));
    endDate = endOfMonth(subMonths(new Date(), 2));
  } else {
    startDate = startOfMonth(new Date());
    endDate = endOfMonth(new Date());
  }

  // Fetch total count for the given query
  const totalCount = await prismaDB.payroll.count({
    where: {
      staff: {
        restaurantId: outlet?.id,
      },
      payDate: {
        gte: startDate,
        lte: endDate,
      },
      OR: [{ staff: { name: { contains: search, mode: "insensitive" } } }],
      AND: filterConditions,
    },
  });

  // Fetch all payrolls for the specified restaurant within the current month
  const payrolls = await prismaDB.payroll.findMany({
    where: {
      staff: {
        restaurantId: outlet.id,
      },
      payDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      staff: true, // Include staff information for display
    },
  });

  // Fetch all payrolls for the specified restaurant within the current month
  const tablepayrolls = await prismaDB.payroll.findMany({
    skip,
    take,
    where: {
      staff: {
        restaurantId: outlet?.id,
      },
      payDate: {
        gte: startDate,
        lte: endDate,
      },
      OR: [{ staff: { name: { contains: search, mode: "insensitive" } } }],
      AND: filterConditions,
    },
    include: {
      staff: true, // Include staff information for display
    },
  });

  const formattedPayRoll = tablepayrolls?.map((table, i) => ({
    id: table?.id,
    slNo: i + 1,
    name: table?.staff?.name,
    email: table?.staff?.email,
    role: table?.staff?.role,
    salary: table?.staff?.salary,
    status: table?.status,
    date: format(table?.payDate, "PP"),
  }));

  if (payrolls.length > 0) {
    const totalPayout = payrolls.reduce(
      (total, payroll) => total + parseFloat(payroll.staff.salary),
      0
    );
    const totalSuccessPayouts = payrolls.filter(
      (payroll) => payroll.status === "COMPLETED"
    ).length;
    const totalPendingPayouts = payrolls.filter(
      (payroll) => payroll.status === "PENDING"
    ).length;
    return res.json({
      success: true,
      totalCount,
      payrolls: formattedPayRoll,
      totalPayout,
      totalPayouts: payrolls.length,
      totalSuccessPayouts,
      totalPendingPayouts,
    });
  }

  // Fetch all staff for the outlet
  const staffList = await prismaDB.staff.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });

  if (staffList.length === 0) {
    return res.json({
      success: true,
      payrolls: [],
      totalPayout: 0,
      totalPayouts: 0,
      totalSuccessPayouts: 0,
      totalPendingPayouts: 0,
    });
  }

  // Create payroll for each staff member for the selected month
  const newPayrolls = [];
  for (const staff of staffList) {
    const baseSalary = parseFloat(staff.salary);
    const allowances = staff.allowances ? Number(staff.allowances) : 0;
    const deductions = staff.deductions ? Number(staff.deductions) : 0;
    const netPay = baseSalary + allowances - deductions;

    const newPayroll = await prismaDB.payroll.create({
      data: {
        staffId: staff.id,
        amountPaid: netPay,
        payDate: new Date(startDate.getFullYear(), startDate.getMonth(), 27),
        payFrequency: staff.payFrequency,
      },
      include: {
        staff: true,
      },
    });
    newPayrolls.push(newPayroll);
  }

  const formattedNewPayRoll = newPayrolls?.map((table, i) => ({
    id: table?.id,
    slNo: i + 1,
    name: table?.staff?.name,
    email: table?.staff?.email,
    role: table?.staff?.role,
    salary: table?.staff?.salary,
    status: table?.status,
    date: format(table?.payDate, "PP"),
  }));

  // Return the newly created payrolls
  return res.json({
    success: true,
    payrolls: formattedNewPayRoll,
    totalPayout: newPayrolls.reduce(
      (total, payroll) => total + parseFloat(payroll.staff.salary),
      0
    ),
    totalPayouts: newPayrolls.length,
    totalSuccessPayouts: 0, // No successful payouts initially
    totalPendingPayouts: newPayrolls.length,
  });
};

export const updatePayrollStatus = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const { status } = req.body;
  const outlet = await getOutletById(outletId);

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const findPayroll = await prismaDB.payroll.findFirst({
    where: {
      id: id,
    },
    include: {
      staff: true,
    },
  });

  if (findPayroll == null || !findPayroll.id) {
    throw new NotFoundException(
      "Payroll Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  await prismaDB.payroll.update({
    where: {
      id: findPayroll.id,
    },
    data: {
      amountPaid: parseFloat(findPayroll?.staff?.salary),
      status: status,
    },
  });
  // Update related alerts to resolved
  await prismaDB.alert.deleteMany({
    where: {
      restaurantId: outlet.id,
      payrollId: id,
      status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
    },
  });
  const alerts = await prismaDB.alert.findMany({
    where: {
      restaurantId: outletId,
      status: {
        in: ["PENDING"],
      },
    },
    select: {
      id: true,
      type: true,
      status: true,
      priority: true,
      href: true,
      message: true,
      createdAt: true,
    },
  });

  websocketManager.notifyClients(outletId, "NEW_ALERT");
  await redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
  return res.json({
    success: true,
    message: "Updated Payroll Status",
  });
};

export const bulkUpdatePayrollStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { selectedId } = req.body;
  const outlet = await getOutletById(outletId);

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Validate input
  if (!Array.isArray(selectedId) || selectedId?.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No payroll IDs provided for update.",
    });
  }

  await prismaDB.payroll.updateMany({
    where: {
      id: {
        in: selectedId,
      },
    },
    data: {
      status: "COMPLETED",
    },
  });

  // Update related alerts to resolved
  await prismaDB.alert.deleteMany({
    where: {
      restaurantId: outlet.id,
      payrollId: {
        in: selectedId,
      },
      status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
    },
  });
  const alerts = await prismaDB.alert.findMany({
    where: {
      restaurantId: outletId,
      status: {
        in: ["PENDING"],
      },
    },
    select: {
      id: true,
      type: true,
      status: true,
      priority: true,
      href: true,
      message: true,
      createdAt: true,
    },
  });

  websocketManager.notifyClients(outletId, "NEW_ALERT");
  await redis.set(`alerts-${outletId}`, JSON.stringify(alerts));

  return res.json({
    success: true,
    message: "Updated Payroll Status",
  });
};
