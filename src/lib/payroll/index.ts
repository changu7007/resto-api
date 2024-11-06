import { prismaDB } from "../..";
import { BadRequestsException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import { ErrorCode } from "../../exceptions/root";

// Calculate payroll for a specific staff and store a record
export const createPayrollForStaff = async (staffId: string) => {
  if (!staffId) {
    throw new BadRequestsException(
      "Staff Id is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  try {
    // Fetch staff details from the database
    const staff = await prismaDB.staff.findUnique({
      where: {
        id: staffId,
      },
    });

    if (!staff?.id) {
      throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
    }

    // Payroll calculation logic
    const baseSalary = parseFloat(staff.salary);
    const allowances = staff.allowances ? parseFloat(staff.allowances) : 0;
    const deductions = staff.deductions ? parseFloat(staff.deductions) : 0;
    const netPay = baseSalary + allowances - deductions;

    // Create a payroll record
    const staffPayrolll = await prismaDB.payroll.create({
      data: {
        staffId: staff.id,
        amountPaid: netPay.toString(),
        payFrequency: staff.payFrequency,
      },
    });

    return staffPayrolll;
  } catch (error) {
    console.error("Error calculating payroll:", error);
  }
};
