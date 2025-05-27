"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomer = exports.searchCustomers = exports.getAllCustomer = exports.getCustomersForTable = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const redis_1 = require("../../../services/redis");
const zod_1 = require("zod");
const getCustomersForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
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
    const totalCount = yield __1.prismaDB.customerRestaurantAccess.count({
        where: {
            restaurantId: outletId,
            OR: [{ customer: { name: { contains: search, mode: "insensitive" } } }],
            AND: filterConditions,
        },
    });
    const getCustomers = yield __1.prismaDB.customerRestaurantAccess.findMany({
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
    const formattedCustomers = getCustomers === null || getCustomers === void 0 ? void 0 : getCustomers.map((staff) => {
        var _a, _b, _c, _d;
        return ({
            id: staff === null || staff === void 0 ? void 0 : staff.id,
            name: (_a = staff === null || staff === void 0 ? void 0 : staff.customer) === null || _a === void 0 ? void 0 : _a.name,
            email: (_b = staff === null || staff === void 0 ? void 0 : staff.customer) === null || _b === void 0 ? void 0 : _b.email,
            phoneNo: (_c = staff === null || staff === void 0 ? void 0 : staff.customer) === null || _c === void 0 ? void 0 : _c.phoneNo,
            orders: (_d = staff === null || staff === void 0 ? void 0 : staff.orderSession) === null || _d === void 0 ? void 0 : _d.length,
            createdAt: staff === null || staff === void 0 ? void 0 : staff.createdAt,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            customers: formattedCustomers,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getCustomersForTable = getCustomersForTable;
const getAllCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisCustomers = yield redis_1.redis.get(`customers-${outletId}`);
    if (redisCustomers) {
        return res.json({
            success: true,
            customers: JSON.parse(redisCustomers),
            message: "Powered In",
        });
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const customers = yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    return res.json({
        success: true,
        customers: customers,
    });
});
exports.getAllCustomer = getAllCustomer;
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
};
const searchCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { phone, name } = req.query;
    // Validate outlet exists
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Fetch customers with their loyalty program details
    const customers = yield __1.prismaDB.customerRestaurantAccess.findMany(Object.assign(Object.assign({ where: {
            restaurantId: outletId,
            customer: {
                phoneNo: {
                    contains: phone,
                    mode: "default",
                },
            },
        } }, customerSearchQuery), { orderBy: {
            customer: {
                name: "asc",
            },
        }, take: 10 }));
    // Format the response
    const formattedCustomers = customers.map((access) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const loyalty = (_a = access.loyaltyPrograms) === null || _a === void 0 ? void 0 : _a[0];
        const orders = access.orderSession;
        const tier = (_c = (_b = loyalty === null || loyalty === void 0 ? void 0 : loyalty.loyaltyProgram) === null || _b === void 0 ? void 0 : _b.tiers) === null || _c === void 0 ? void 0 : _c[0];
        return {
            id: access.customerId,
            name: ((_d = access.customer) === null || _d === void 0 ? void 0 : _d.name) || "",
            phone: ((_e = access.customer) === null || _e === void 0 ? void 0 : _e.phoneNo) || "",
            email: ((_f = access.customer) === null || _f === void 0 ? void 0 : _f.email) || "",
            comingSince: access.customer.createdAt || "N/A",
            loyaltyProgram: loyalty === null || loyalty === void 0 ? void 0 : loyalty.loyaltyProgram.pogramName,
            points: (loyalty === null || loyalty === void 0 ? void 0 : loyalty.points) || 0,
            tier: (tier === null || tier === void 0 ? void 0 : tier.name) || "N/A",
            // tierType: tier?.type || "REGULAR",
            orders: orders,
            lastOrder: (_g = orders === null || orders === void 0 ? void 0 : orders[0]) === null || _g === void 0 ? void 0 : _g.createdAt,
            totalOrders: (orders === null || orders === void 0 ? void 0 : orders.length) || 0,
            totalSpent: (orders === null || orders === void 0 ? void 0 : orders.reduce((sum, order) => sum + (order.subTotal || 0), 0)) || 0,
        };
    });
    return res.json({
        success: true,
        data: formattedCustomers,
        message: "Customers fetched successfully",
    });
});
exports.searchCustomers = searchCustomers;
const customerForm = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: "Name is required" })
        .min(2, "Name must be at least 2 characters"),
    phoneNo: zod_1.z
        .string({ required_error: "Phone number is required" })
        .regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
    email: zod_1.z.string().email("Invalid email format").optional().or(zod_1.z.literal("")),
    dob: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
        .optional()
        .or(zod_1.z.literal("")),
    programId: zod_1.z.string().optional(),
});
const createLoyaltyProgram = (restaurantCustomerId, programId, existingPoints) => __awaiter(void 0, void 0, void 0, function* () {
    const findLoyaltyProgram = yield __1.prismaDB.loyaltyProgram.findFirst({
        where: {
            id: programId,
        },
    });
    if (!findLoyaltyProgram) {
        throw new not_found_1.NotFoundException("Selected loyalty Program not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    return __1.prismaDB.customerLoyalty.create({
        data: {
            restaurantCustomerId,
            loyaltyProgramId: programId,
            points: existingPoints !== null && existingPoints !== void 0 ? existingPoints : 0,
            visits: 0,
            walletBalance: 0,
            lifeTimePoints: 0,
            lifeTimeSpend: 0,
            enrollmentDate: new Date(),
        },
    });
});
const createCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    // Validate request body
    const { data, error } = customerForm.safeParse(req.body);
    if (error) {
        throw new not_found_1.NotFoundException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Validate outlet exists
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Format phone number
    const formattedPhoneNo = data.phoneNo.startsWith("+91")
        ? data.phoneNo
        : `+91${data.phoneNo}`;
    // Check for existing customer
    const existingCustomer = yield __1.prismaDB.customer.findFirst({
        where: {
            phoneNo: formattedPhoneNo,
        },
    });
    try {
        let customer;
        let customerAccess;
        if (!existingCustomer) {
            // Create new customer
            customer = yield __1.prismaDB.customer.create({
                data: {
                    name: data.name,
                    phoneNo: formattedPhoneNo,
                    email: data.email || null,
                    dob: data.dob ? new Date(data.dob) : null,
                },
            });
            // Create restaurant access
            customerAccess = yield __1.prismaDB.customerRestaurantAccess.create({
                data: {
                    customerId: customer.id,
                    restaurantId: outletId,
                },
            });
        }
        else {
            // Update existing customer
            customer = yield __1.prismaDB.customer.update({
                where: { id: existingCustomer.id },
                data: {
                    name: data.name,
                    email: data.email || null,
                    dob: data.dob ? new Date(data.dob) : null,
                },
            });
            // Check for existing restaurant access
            customerAccess = yield __1.prismaDB.customerRestaurantAccess.findFirst({
                where: {
                    restaurantId: outletId,
                    customerId: existingCustomer.id,
                },
            });
            if (!customerAccess) {
                customerAccess = yield __1.prismaDB.customerRestaurantAccess.create({
                    data: {
                        customerId: existingCustomer.id,
                        restaurantId: outletId,
                    },
                });
            }
        }
        // Handle loyalty program if provided
        if (data.programId && customerAccess) {
            const existingLoyalty = yield __1.prismaDB.customerLoyalty.findFirst({
                where: {
                    restaurantCustomerId: customerAccess.id,
                    loyaltyProgramId: data.programId,
                },
            });
            if (!existingLoyalty) {
                const existingPoints = yield __1.prismaDB.customerLoyalty.findFirst({
                    where: {
                        restaurantCustomerId: customerAccess.id,
                    },
                    select: {
                        points: true,
                    },
                });
                yield createLoyaltyProgram(customerAccess.id, data.programId, existingPoints === null || existingPoints === void 0 ? void 0 : existingPoints.points);
            }
        }
        // Invalidate Redis cache
        yield redis_1.redis.del(`customers-${outletId}`);
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
    }
    catch (error) {
        console.error("Error in createCustomer:", error);
        throw new not_found_1.NotFoundException("Failed to process customer data", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
});
exports.createCustomer = createCustomer;
