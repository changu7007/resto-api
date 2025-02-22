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
exports.getStaffIds = exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.getStaffId = exports.getAllStaffs = exports.getStaffAttendance = exports.getStaffsForTable = void 0;
const redis_1 = require("../../../services/redis");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const outlet_1 = require("../../../lib/outlet");
const get_staffs_1 = require("../../../lib/outlet/get-staffs");
const get_users_1 = require("../../../lib/get-users");
const date_fns_1 = require("date-fns");
const getStaffsForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const totalCount = yield __1.prismaDB.staff.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getStaffs = yield __1.prismaDB.staff.findMany({
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
    const formattedStaffs = getStaffs === null || getStaffs === void 0 ? void 0 : getStaffs.map((staff) => {
        var _a;
        return ({
            id: staff === null || staff === void 0 ? void 0 : staff.id,
            name: staff === null || staff === void 0 ? void 0 : staff.name,
            email: staff === null || staff === void 0 ? void 0 : staff.email,
            role: staff === null || staff === void 0 ? void 0 : staff.role,
            salary: staff === null || staff === void 0 ? void 0 : staff.salary,
            orders: (_a = staff === null || staff === void 0 ? void 0 : staff.orders) === null || _a === void 0 ? void 0 : _a.length,
            phoneNo: staff === null || staff === void 0 ? void 0 : staff.phoneNo,
            joinedDate: staff === null || staff === void 0 ? void 0 : staff.joinedDate,
            createdAt: staff === null || staff === void 0 ? void 0 : staff.createdAt,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            staffs: formattedStaffs,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getStaffsForTable = getStaffsForTable;
const getStaffAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    console.log(`Search: ${search}`);
    console.log(`Sorting: ${JSON.stringify(sorting)}`);
    console.log(`Filters: ${JSON.stringify(filters)}`);
    console.log(`Pagination: ${JSON.stringify(pagination)}`);
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    // Build where conditions for staff query
    const whereConditions = Object.assign(Object.assign({ restaurantId: outletId }, (search &&
        search.length > 0 && {
        OR: [{ name: { contains: search, mode: "insensitive" } }],
    })), (filters.length > 0 && {
        AND: filters.map((filter) => ({
            [filter.id]: { in: filter.value },
        })),
    }));
    console.log("Where Conditions:", JSON.stringify(whereConditions, null, 2));
    // Get total count first
    const totalCount = yield __1.prismaDB.staff.count({
        where: whereConditions,
    });
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = (pagination.pageIndex || 0) * take;
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Fetch paginated staff list
    const getStaffs = yield __1.prismaDB.staff.findMany({
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
    const checkInRecords = yield Promise.all(getStaffs.map((staff) => __awaiter(void 0, void 0, void 0, function* () {
        const todayRecords = yield __1.prismaDB.checkInRecord.findMany({
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
            const existingDefaultRecord = yield __1.prismaDB.checkInRecord.findFirst({
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
                const defaultRecord = yield __1.prismaDB.checkInRecord.create({
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
            }
            else {
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
                totalWorkingMinutes += (0, date_fns_1.differenceInMinutes)(record.checkOutTime, record.checkInTime);
            }
        });
        console.log(`Today Records: ${todayRecords.length}`);
        return {
            staff,
            records: todayRecords,
            totalWorkingHours: Math.round((totalWorkingMinutes / 60) * 100) / 100,
        };
    })));
    // Format attendance data
    const formattedAttendance = checkInRecords.map(({ staff, records, totalWorkingHours }) => {
        var _a, _b;
        const checkInHistory = records.map((record) => ({
            checkIn: record.checkInTime,
            checkOut: record.checkOutTime,
        }));
        // Determine status based on check-in history
        let status = "Absent";
        if (checkInHistory.some((record) => record.checkIn)) {
            status = "Present";
        }
        else if (checkInHistory.length > 0) {
            status = "Not Logged";
        }
        return {
            id: staff.id,
            name: staff.name,
            role: staff.role,
            image: staff.image || undefined,
            checkIn: ((_a = checkInHistory[0]) === null || _a === void 0 ? void 0 : _a.checkIn) || undefined,
            checkOut: ((_b = checkInHistory[checkInHistory.length - 1]) === null || _b === void 0 ? void 0 : _b.checkOut) || undefined,
            status,
            totalEntries: checkInHistory.filter((record) => record.checkIn).length,
            workingHours: totalWorkingHours,
            checkInHistory,
        };
    });
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
});
exports.getStaffAttendance = getStaffAttendance;
const getAllStaffs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisStaff = yield redis_1.redis.get(`staffs-${outletId}`);
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (redisStaff) {
        return res.json({
            success: true,
            staffs: JSON.parse(redisStaff),
            message: "Powered In",
        });
    }
    const staffs = yield __1.prismaDB.staff.findMany({
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
    yield redis_1.redis.set(`staffs-${getOutlet.id}`, JSON.stringify(staffs));
    return res.json({
        success: true,
        staffs: staffs,
        message: "Powered Up",
    });
});
exports.getAllStaffs = getAllStaffs;
const getStaffId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, staffId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const staff = yield (0, get_users_1.getStaffById)(getOutlet.id, staffId);
    if (!(staff === null || staff === void 0 ? void 0 : staff.id)) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        staff: staff,
        message: "Staff Fetched",
    });
});
exports.getStaffId = getStaffId;
const createStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const { name, email, phoneNo, role, salary, joinedDate } = req.body;
    yield __1.prismaDB.staff.create({
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
    yield (0, get_staffs_1.getAllStaff)(getOutlet.id);
    return res.json({
        success: true,
        message: "Staff Created Success ✅",
    });
});
exports.createStaff = createStaff;
const updateStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, staffId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
            restaurantId: getOutlet.id,
        },
    });
    if (!staff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { name, email, phoneNo, role, salary, joinedDate } = req.body;
    yield __1.prismaDB.staff.update({
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
    yield (0, get_staffs_1.getAllStaff)(getOutlet.id);
    return res.json({
        success: true,
        message: "Staff Updated Success ✅",
    });
});
exports.updateStaff = updateStaff;
const deleteStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, staffId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
            restaurantId: getOutlet.id,
        },
    });
    if (!staff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.staff.delete({
        where: {
            id: staff.id,
            restaurantId: getOutlet.id,
        },
    });
    yield (0, get_staffs_1.getAllStaff)(getOutlet.id);
    return res.json({
        success: true,
        message: "Staff Delleted Success ✅",
    });
});
exports.deleteStaff = deleteStaff;
const getStaffIds = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, staffId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const staff = yield __1.prismaDB.staff.findMany({
        where: {
            restaurantId: getOutlet.id,
        },
        select: {
            id: true,
            name: true,
        },
    });
    return res.json({
        success: true,
        staffs: staff,
        message: "Staffs Fetched",
    });
});
exports.getStaffIds = getStaffIds;
