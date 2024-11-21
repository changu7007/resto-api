import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { prismaDB } from "../../..";

export const getThisMonthPayroll = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { month } = req.query;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const currentDate = new Date();
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
      payrolls,
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
    const allowances = staff.allowances ? parseFloat(staff.allowances) : 0;
    const deductions = staff.deductions ? parseFloat(staff.deductions) : 0;
    const netPay = baseSalary + allowances - deductions;

    const newPayroll = await prismaDB.payroll.create({
      data: {
        staffId: staff.id,
        amountPaid: "0",
        payDate: new Date(startDate.getFullYear(), startDate.getMonth(), 27),
        payFrequency: staff.payFrequency,
      },
      include: {
        staff: true,
      },
    });
    newPayrolls.push(newPayroll);
  }

  // Return the newly created payrolls
  return res.json({
    success: true,
    payrolls: newPayrolls,
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
      status: status,
    },
  });
  return res.json({
    success: true,
    message: "Updated Payroll Status",
  });
};
