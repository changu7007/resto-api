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
import { Prisma } from "@prisma/client";
import { z } from "zod";

type CustomerWithDetails = Prisma.CustomerRestaurantAccessGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        name: true;
        phoneNo: true;
        email: true;
      };
    };
    customerLoyalty: {
      include: {
        loyaltyProgram: {
          include: {
            tier: true;
          };
        };
      };
    };
    orderSessions: {
      select: {
        id: true;
        totalAmount: true;
        createdAt: true;
      };
    };
  };
}>;

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

const customerSearchQuery = {
  include: {
    customer: {
      select: {
        id: true,
        name: true,
        phoneNo: true,
        email: true,
        createdAt: true,
      },
    },
    loyaltyPrograms: {
      select: {
        points: true,
        loyaltyProgram: {
          select: {
            pogramName: true,
            tiers: {
              select: {
                name: true,
                // type: true,
              },
            },
          },
        },
      },
    },
    orderSession: {
      select: {
        id: true,
        billId: true,
        subTotal: true,
        createdAt: true,
        sessionStatus: true,
        orders: {
          select: {
            orderItems: {
              select: {
                menuId: true,
                name: true,
                quantity: true,
                totalPrice: true,
              },
            },
            totalAmount: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    },
  },
} as const;

type CustomerSearchResult = Prisma.CustomerRestaurantAccessGetPayload<
  typeof customerSearchQuery
>;

export const searchCustomers = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { phone, name } = req.query;

  // Validate outlet exists
  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Fetch customers with their loyalty program details
  const customers = await prismaDB.customerRestaurantAccess.findMany({
    where: {
      restaurantId: outletId,
      customer: {
        phoneNo: {
          contains: phone as string,
          mode: "default",
        },
      },
    },
    ...customerSearchQuery,

    orderBy: {
      customer: {
        name: "asc",
      },
    },
    take: 10,
  });

  // Format the response
  const formattedCustomers = customers.map((access: CustomerSearchResult) => {
    const loyalty = access.loyaltyPrograms?.[0];

    const orders = access.orderSession;
    const tier = loyalty?.loyaltyProgram?.tiers?.[0];
    return {
      id: access.customerId,
      name: access.customer?.name || "",
      phone: access.customer?.phoneNo || "",
      email: access.customer?.email || "",
      comingSince: access.customer.createdAt || "N/A",
      loyaltyProgram: loyalty?.loyaltyProgram.pogramName,
      points: loyalty?.points || 0,
      tier: tier?.name || "N/A",
      // tierType: tier?.type || "REGULAR",
      orders: orders,
      lastOrder: orders?.[0]?.createdAt,
      totalOrders: orders?.length || 0,
      totalSpent:
        orders?.reduce((sum, order) => sum + (order.subTotal || 0), 0) || 0,
    };
  });

  return res.json({
    success: true,
    data: formattedCustomers,
    message: "Customers fetched successfully",
  });
};

const customerForm = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters"),
  phoneNo: z
    .string({ required_error: "Phone number is required" })
    .regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional()
    .or(z.literal("")),
  programId: z.string().optional(),
});

const createLoyaltyProgram = async (
  restaurantCustomerId: string,
  programId: string,
  existingPoints?: number
) => {
  const findLoyaltyProgram = await prismaDB.loyaltyProgram.findFirst({
    where: {
      id: programId,
    },
  });

  if (!findLoyaltyProgram) {
    throw new NotFoundException(
      "Selected loyalty Program not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  return prismaDB.customerLoyalty.create({
    data: {
      restaurantCustomerId,
      loyaltyProgramId: programId,
      points: existingPoints ?? 0,
      visits: 0,
      walletBalance: 0,
      lifeTimePoints: 0,
      lifeTimeSpend: 0,
      enrollmentDate: new Date(),
    },
  });
};

export const createCustomer = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  // Validate request body

  const { data, error } = customerForm.safeParse(req.body);

  if (error) {
    throw new NotFoundException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Validate outlet exists
  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Format phone number
  const formattedPhoneNo = data.phoneNo.startsWith("+91")
    ? data.phoneNo
    : `+91${data.phoneNo}`;

  // Check for existing customer
  const existingCustomer = await prismaDB.customer.findFirst({
    where: {
      phoneNo: formattedPhoneNo,
    },
  });

  try {
    let customer;
    let customerAccess;

    if (!existingCustomer) {
      // Create new customer
      customer = await prismaDB.customer.create({
        data: {
          name: data.name,
          phoneNo: formattedPhoneNo,
          email: data.email || null,
          dob: data.dob ? new Date(data.dob) : null,
        },
      });

      // Create restaurant access
      customerAccess = await prismaDB.customerRestaurantAccess.create({
        data: {
          customerId: customer.id,
          restaurantId: outletId,
        },
      });
    } else {
      // Update existing customer
      customer = await prismaDB.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name: data.name,
          email: data.email || null,
          dob: data.dob ? new Date(data.dob) : null,
        },
      });

      // Check for existing restaurant access
      customerAccess = await prismaDB.customerRestaurantAccess.findFirst({
        where: {
          restaurantId: outletId,
          customerId: existingCustomer.id,
        },
      });

      if (!customerAccess) {
        customerAccess = await prismaDB.customerRestaurantAccess.create({
          data: {
            customerId: existingCustomer.id,
            restaurantId: outletId,
          },
        });
      }
    }

    // Handle loyalty program if provided
    if (data.programId && customerAccess) {
      const existingLoyalty = await prismaDB.customerLoyalty.findFirst({
        where: {
          restaurantCustomerId: customerAccess.id,
          loyaltyProgramId: data.programId,
        },
      });

      if (!existingLoyalty) {
        const existingPoints = await prismaDB.customerLoyalty.findFirst({
          where: {
            restaurantCustomerId: customerAccess.id,
          },
          select: {
            points: true,
          },
        });
        await createLoyaltyProgram(
          customerAccess.id,
          data.programId,
          existingPoints?.points
        );
      }
    }

    // Invalidate Redis cache
    await redis.del(`customers-${outletId}`);

    return res.json({
      success: true,
      data: {
        customer,
        customerAccess,
      },
      message: existingCustomer
        ? "Customer updated successfully"
        : "Customer created successfully",
    });
  } catch (error) {
    console.error("Error in createCustomer:", error);
    throw new NotFoundException(
      "Failed to process customer data",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
};
