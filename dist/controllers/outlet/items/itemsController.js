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
exports.deleteItems = exports.disablePosStatus = exports.enablePosStatus = exports.disableInStockStatus = exports.enableInStockStatus = exports.disableFeaturedStatus = exports.enableFeaturedStatus = exports.getSingleAddons = exports.addItemToUserFav = exports.getMenuVariants = exports.getShortCodeStatus = exports.deleteItem = exports.duplicateItem = exports.postItem = exports.updateItembyId = exports.getAddONById = exports.getVariantById = exports.getItemById = exports.getAllItem = exports.getAddonsForTable = exports.getVariantsForTable = exports.getCategoriesForTable = exports.getItemForTable = exports.getItemsBySearch = exports.getItemsByCategory = exports.getItemsBySearchForOnlineAndDelivery = exports.getItemsByCategoryForOnlineAndDelivery = exports.getVegItemsForOnlineAndDelivery = exports.getItemsForOnlineAndDelivery = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const client_1 = require("@prisma/client");
const bad_request_1 = require("../../../exceptions/bad-request");
const redis_1 = require("../../../services/redis");
const get_items_1 = require("../../../lib/outlet/get-items");
const zod_1 = require("zod");
const get_users_1 = require("../../../lib/get-users");
const date_fns_1 = require("date-fns");
const algorithms_1 = require("../../../lib/algorithms");
const utils_1 = require("../../../lib/utils");
const getItemsForOnlineAndDelivery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const allItems = yield redis_1.redis.get(`${outletId}-all-items-online-and-delivery`);
    if (allItems) {
        return res.json({
            success: true,
            items: JSON.parse(allItems),
            message: "Fetched Items By Redis ✅",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const items = yield (0, get_items_1.getOAllItemsForOnlineAndDelivery)(outletId);
    return res.json({
        success: true,
        items: items,
    });
});
exports.getItemsForOnlineAndDelivery = getItemsForOnlineAndDelivery;
const getVegItemsForOnlineAndDelivery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const redisItems = yield redis_1.redis.get(`${outletId}-all-items-online-and-delivery`);
    if (redisItems) {
        const items = JSON.parse(redisItems);
        return res.json({
            success: true,
            data: items.filter((item) => item.type === "VEG" ||
                item.type === "MILK" ||
                item.type === "SOFTDRINKS"),
        });
    }
    else {
        const items = yield (0, get_items_1.getOAllItemsForOnlineAndDelivery)(outletId);
        return res.json({
            success: true,
            data: items.filter((item) => item.type === "VEG" ||
                item.type === "MILK" ||
                item.type === "SOFTDRINKS"),
        });
    }
});
exports.getVegItemsForOnlineAndDelivery = getVegItemsForOnlineAndDelivery;
const getItemsByCategoryForOnlineAndDelivery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const categoryId = req.query.categoryId;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const redisItems = yield redis_1.redis.get(`${outletId}-all-items-online-and-delivery`);
    if (redisItems) {
        const items = JSON.parse(redisItems);
        let sendItems = [];
        if (categoryId) {
            if (categoryId === "all") {
                sendItems = items;
            }
            else if (categoryId === "mostloved") {
                // get most loved items for online and delivery where more than 100 orders
                const getItems = yield __1.prismaDB.orderItem.findMany({
                    where: {
                        menuId: { in: items.map((item) => item.id) },
                    },
                });
                sendItems = items.filter((item) => getItems.filter((i) => i.menuId === item.id).length > 40);
            }
            else {
                sendItems = items.filter((item) => item.categoryId === categoryId);
            }
        }
        return res.json({
            success: true,
            data: sendItems,
        });
    }
    else {
        const items = yield (0, get_items_1.getOAllItemsForOnlineAndDelivery)(outletId);
        let sendItems = [];
        if (categoryId) {
            if (categoryId === "all") {
                sendItems = items;
            }
            else if (categoryId === "mostloved") {
                // get most loved items for online and delivery where more than 100 orders
                const getItems = yield __1.prismaDB.orderItem.findMany({
                    where: {
                        menuId: { in: items.map((item) => item.id) },
                    },
                });
                sendItems = items.filter((item) => getItems.filter((i) => i.menuId === item.id).length > 40);
            }
            else {
                sendItems = items.filter((item) => item.categoryId === categoryId);
            }
        }
        return res.json({
            success: true,
            data: sendItems,
        });
    }
});
exports.getItemsByCategoryForOnlineAndDelivery = getItemsByCategoryForOnlineAndDelivery;
const getItemsBySearchForOnlineAndDelivery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const search = req.query.search;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const redisItems = yield redis_1.redis.get(`${outletId}-all-items-online-and-delivery`);
    if (redisItems) {
        const items = JSON.parse(redisItems);
        let sendItems = [];
        if (search) {
            sendItems = items.filter((item) => {
                return (
                // Fuzzy search on name
                (0, algorithms_1.fuzzySearch)(item.name, search) ||
                    // Fuzzy search on shortCode
                    (item.shortCode && (0, algorithms_1.fuzzySearch)(item.shortCode, search)) ||
                    // Fuzzy search on description
                    (item.description && (0, algorithms_1.fuzzySearch)(item.description, search)) ||
                    // Search in category name
                    (item.categoryName && (0, algorithms_1.fuzzySearch)(item.categoryName, search)) ||
                    // Match price range (if search term is a number)
                    (!isNaN(Number(search)) &&
                        Math.abs(Number(item.price) - Number(search)) <= 50) // Within ₹50 range
                );
            });
        }
        // Sort results by relevance
        sendItems.sort((a, b) => {
            const aScore = (0, algorithms_1.fuzzySearch)(a.name, search)
                ? 2
                : a.shortCode && (0, algorithms_1.fuzzySearch)(a.shortCode, search)
                    ? 1.5
                    : 1;
            const bScore = (0, algorithms_1.fuzzySearch)(b.name, search)
                ? 2
                : b.shortCode && (0, algorithms_1.fuzzySearch)(b.shortCode, search)
                    ? 1.5
                    : 1;
            return bScore - aScore;
        });
        return res.json({
            success: true,
            data: sendItems,
        });
    }
    else {
        const items = yield (0, get_items_1.getOAllItemsForOnlineAndDelivery)(outletId);
        let sendItems = [];
        if (search) {
            sendItems = items.filter((item) => {
                return ((0, algorithms_1.fuzzySearch)(item.name, search) ||
                    (item.shortCode && (0, algorithms_1.fuzzySearch)(item.shortCode, search)) ||
                    (item.description && (0, algorithms_1.fuzzySearch)(item.description, search)) ||
                    (item.categoryName && (0, algorithms_1.fuzzySearch)(item.categoryName, search)) ||
                    (!isNaN(Number(search)) &&
                        Math.abs(Number(item.price) - Number(search)) <= 50));
            });
            // Sort results by relevance
            sendItems.sort((a, b) => {
                const aScore = (0, algorithms_1.fuzzySearch)(a.name, search)
                    ? 2
                    : a.shortCode && (0, algorithms_1.fuzzySearch)(a.shortCode, search)
                        ? 1.5
                        : 1;
                const bScore = (0, algorithms_1.fuzzySearch)(b.name, search)
                    ? 2
                    : b.shortCode && (0, algorithms_1.fuzzySearch)(b.shortCode, search)
                        ? 1.5
                        : 1;
                return bScore - aScore;
            });
        }
        return res.json({
            success: true,
            data: sendItems,
        });
    }
});
exports.getItemsBySearchForOnlineAndDelivery = getItemsBySearchForOnlineAndDelivery;
const getItemsByCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const categoryId = req.query.categoryId;
    // Use Promise.all to parallelize independent operations
    const [outlet, redisItems] = yield Promise.all([
        (0, outlet_1.getOutletById)(outletId),
        redis_1.redis.get(`${outletId}-all-items`),
    ]);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    let items;
    // Get items either from Redis or DB
    if (redisItems) {
        console.log("Fetching items from Redis");
        items = JSON.parse(redisItems);
    }
    else {
        console.log("Fetching items from Database");
        items = yield (0, get_items_1.getOAllItems)(outletId);
        // Cache items in Redis with 5 minutes TTL
        yield redis_1.redis.set(`${outletId}-all-items`, JSON.stringify(items), "EX", 300);
    }
    // Handle different category scenarios
    let sendItems = [];
    if (!categoryId || categoryId === "all") {
        sendItems = items;
    }
    else if (categoryId === "favourites") {
        // Get user's favorite items
        const userCacheKey = `user-favitems-${outlet.adminId}`;
        let favItemIds = yield redis_1.redis.get(userCacheKey);
        if (!favItemIds) {
            const user = yield __1.prismaDB.user.findUnique({
                where: { id: outlet.adminId },
                select: { favItems: true },
            });
            favItemIds = JSON.stringify((user === null || user === void 0 ? void 0 : user.favItems) || []);
            yield redis_1.redis.set(userCacheKey, favItemIds, "EX", 300);
        }
        const userFavItems = JSON.parse(favItemIds);
        sendItems = items.filter((item) => userFavItems.includes(item.id));
    }
    else {
        // Get items for specific category
        const categoryKey = `${outletId}-category-${categoryId}`;
        const cachedCategoryItems = yield redis_1.redis.get(categoryKey);
        if (cachedCategoryItems) {
            sendItems = JSON.parse(cachedCategoryItems);
        }
        else {
            sendItems = items.filter((item) => item.categoryId === categoryId);
            yield redis_1.redis.set(categoryKey, JSON.stringify(sendItems), "EX", 300);
        }
    }
    return res.json({
        success: true,
        data: sendItems,
    });
});
exports.getItemsByCategory = getItemsByCategory;
const getItemsBySearch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const search = req.query.search;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const redisItems = yield redis_1.redis.get(`${outletId}-all-items`);
    if (redisItems) {
        const items = JSON.parse(redisItems);
        let sendItems = [];
        if (search) {
            sendItems = items.filter((item) => {
                return (
                // Fuzzy search on name
                (0, algorithms_1.fuzzySearch)(item.name, search) ||
                    // Fuzzy search on shortCode
                    (item.shortCode && (0, algorithms_1.fuzzySearch)(item.shortCode, search)) ||
                    // Fuzzy search on description
                    (item.description && (0, algorithms_1.fuzzySearch)(item.description, search)) ||
                    // Search in category name
                    (item.categoryName && (0, algorithms_1.fuzzySearch)(item.categoryName, search)) ||
                    // Match price range (if search term is a number)
                    (!isNaN(Number(search)) &&
                        Math.abs(Number(item.price) - Number(search)) <= 50) // Within ₹50 range
                );
            });
        }
        // Sort results by relevance
        sendItems.sort((a, b) => {
            const aScore = (0, algorithms_1.fuzzySearch)(a.name, search)
                ? 2
                : a.shortCode && (0, algorithms_1.fuzzySearch)(a.shortCode, search)
                    ? 1.5
                    : 1;
            const bScore = (0, algorithms_1.fuzzySearch)(b.name, search)
                ? 2
                : b.shortCode && (0, algorithms_1.fuzzySearch)(b.shortCode, search)
                    ? 1.5
                    : 1;
            return bScore - aScore;
        });
        return res.json({
            success: true,
            data: sendItems,
        });
    }
    else {
        const items = yield (0, get_items_1.getOAllItems)(outletId);
        let sendItems = [];
        if (search) {
            sendItems = items.filter((item) => {
                return ((0, algorithms_1.fuzzySearch)(item.name, search) ||
                    (item.shortCode && (0, algorithms_1.fuzzySearch)(item.shortCode, search)) ||
                    (item.description && (0, algorithms_1.fuzzySearch)(item.description, search)) ||
                    (item.categoryName && (0, algorithms_1.fuzzySearch)(item.categoryName, search)) ||
                    (!isNaN(Number(search)) &&
                        Math.abs(Number(item.price) - Number(search)) <= 50));
            });
            // Sort results by relevance
            sendItems.sort((a, b) => {
                const aScore = (0, algorithms_1.fuzzySearch)(a.name, search)
                    ? 2
                    : a.shortCode && (0, algorithms_1.fuzzySearch)(a.shortCode, search)
                        ? 1.5
                        : 1;
                const bScore = (0, algorithms_1.fuzzySearch)(b.name, search)
                    ? 2
                    : b.shortCode && (0, algorithms_1.fuzzySearch)(b.shortCode, search)
                        ? 1.5
                        : 1;
                return bScore - aScore;
            });
        }
        return res.json({
            success: true,
            data: sendItems,
        });
    }
});
exports.getItemsBySearch = getItemsBySearch;
const getItemForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const totalCount = yield __1.prismaDB.menuItem.count({
        where: {
            restaurantId: outletId,
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { shortCode: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { category: { name: { contains: search, mode: "insensitive" } } },
            ],
            AND: filterConditions,
        },
    });
    const getItems = yield __1.prismaDB.menuItem.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { shortCode: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { category: { name: { contains: search, mode: "insensitive" } } },
            ],
            AND: filterConditions,
        },
        include: {
            category: true,
            images: true,
            menuItemVariants: {
                include: {
                    variant: true,
                },
            },
            menuGroupAddOns: {
                include: {
                    addOnGroups: {
                        include: {
                            addOnVariants: true,
                        },
                    },
                },
            },
            itemRecipe: {
                include: {
                    menuItem: true,
                    menuItemVariant: true,
                    addOnItemVariant: true,
                },
            },
        },
        orderBy,
    });
    console.log(`Get Items: ${getItems.length}`);
    const formattedMenuItems = getItems === null || getItems === void 0 ? void 0 : getItems.map((item) => {
        var _a, _b, _c;
        return ({
            id: item === null || item === void 0 ? void 0 : item.id,
            name: item === null || item === void 0 ? void 0 : item.name,
            shortCode: item === null || item === void 0 ? void 0 : item.shortCode,
            category: (_a = item === null || item === void 0 ? void 0 : item.category) === null || _a === void 0 ? void 0 : _a.name,
            categoryId: (_b = item === null || item === void 0 ? void 0 : item.category) === null || _b === void 0 ? void 0 : _b.id,
            isPos: item === null || item === void 0 ? void 0 : item.isDineIn,
            isOnline: item === null || item === void 0 ? void 0 : item.isOnline,
            isVariants: item === null || item === void 0 ? void 0 : item.isVariants,
            isFeatured: item === null || item === void 0 ? void 0 : item.isFeatured,
            isInStock: item === null || item === void 0 ? void 0 : item.isInStock,
            variants: (_c = item === null || item === void 0 ? void 0 : item.menuItemVariants) === null || _c === void 0 ? void 0 : _c.map((variant) => {
                var _a;
                return ({
                    name: (_a = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _a === void 0 ? void 0 : _a.name,
                    price: variant === null || variant === void 0 ? void 0 : variant.price,
                });
            }),
            createdAt: item === null || item === void 0 ? void 0 : item.createdAt,
            createdBy: "Admin",
            type: item === null || item === void 0 ? void 0 : item.type,
            price: item === null || item === void 0 ? void 0 : item.price,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            items: formattedMenuItems,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getItemForTable = getItemForTable;
const getCategoriesForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const totalCount = yield __1.prismaDB.category.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getCategories = yield __1.prismaDB.category.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        orderBy,
    });
    const formattedCategories = getCategories === null || getCategories === void 0 ? void 0 : getCategories.map((category) => ({
        id: category === null || category === void 0 ? void 0 : category.id,
        name: category === null || category === void 0 ? void 0 : category.name,
        printLocationId: category === null || category === void 0 ? void 0 : category.printLocationId,
        createdAt: (0, date_fns_1.format)(category.createdAt, "MMMM do, yyyy"),
        updatedAt: (0, date_fns_1.format)(category.updatedAt, "MMMM do, yyyy"),
    }));
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            categories: formattedCategories,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getCategoriesForTable = getCategoriesForTable;
const getVariantsForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const totalCount = yield __1.prismaDB.variants.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getVariants = yield __1.prismaDB.variants.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        orderBy,
    });
    const formattedVariants = getVariants === null || getVariants === void 0 ? void 0 : getVariants.map((item) => ({
        id: item.id,
        name: item.name,
        variantCategory: item.variantCategory,
        createdAt: (0, date_fns_1.format)(item.createdAt, "MMMM do, yyyy"),
        updatedAt: (0, date_fns_1.format)(item.updatedAt, "MMMM do, yyyy"),
    }));
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            variants: formattedVariants,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getVariantsForTable = getVariantsForTable;
const getAddonsForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const totalCount = yield __1.prismaDB.addOns.count({
        where: {
            restaurantId: outletId,
            OR: [{ title: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getAddons = yield __1.prismaDB.addOns.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ title: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            addOnVariants: true,
        },
        orderBy,
    });
    const formattedAddOns = getAddons === null || getAddons === void 0 ? void 0 : getAddons.map((addOn) => ({
        id: addOn.id,
        title: addOn.title,
        description: addOn.description,
        minSelect: addOn.minSelect,
        maxSelect: addOn.maxSelect,
        addOnVariants: addOn.addOnVariants,
        status: addOn.status,
        createdAt: (0, date_fns_1.format)(addOn.createdAt, "MMMM do, yyyy"),
        updatedAt: (0, date_fns_1.format)(addOn.updatedAt, "MMMM do, yyyy"),
    }));
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            addons: formattedAddOns,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getAddonsForTable = getAddonsForTable;
const getAllItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const allItems = yield redis_1.redis.get(`${outletId}-all-items`);
    if (allItems) {
        return res.json({
            success: true,
            items: JSON.parse(allItems),
            message: "Fetched Items By Redis ✅",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const items = yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        items: items,
        message: "Fetched Items by database ✅",
    });
});
exports.getAllItem = getAllItem;
const getItemById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const menuItem = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(menuItem === null || menuItem === void 0 ? void 0 : menuItem.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        item: menuItem,
        message: "Fetched Item Success ✅",
    });
});
exports.getItemById = getItemById;
const getVariantById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { variantId, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const variant = yield (0, outlet_1.getVariantByOutletId)(outlet.id, variantId);
    if (!(variant === null || variant === void 0 ? void 0 : variant.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        item: variant,
        message: "Fetched Variant Success ✅",
    });
});
exports.getVariantById = getVariantById;
const getAddONById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { addOnId, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const addOn = yield (0, outlet_1.getAddOnByOutletId)(outlet.id, addOnId);
    if (!(addOn === null || addOn === void 0 ? void 0 : addOn.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        item: addOn,
        message: "Fetched Variant Success ✅",
    });
});
exports.getAddONById = getAddONById;
const menuSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    shortCode: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    images: zod_1.z.object({ url: zod_1.z.string() }).array(),
    price: zod_1.z.string().optional(),
    netPrice: zod_1.z.string().optional(),
    gstType: zod_1.z.nativeEnum(client_1.GstType, {
        required_error: "You need to select a gst type.",
    }),
    gst: zod_1.z.coerce.number().optional(),
    chooseProfit: zod_1.z
        .enum(["manualProfit", "itemRecipe"], {
        required_error: "You need to select a gross profit type.",
    })
        .optional(),
    grossProfit: zod_1.z.coerce.number().optional(),
    grossProfitType: zod_1.z
        .enum(["INR", "PER"], {
        required_error: "You need to select a gross profit type.",
    })
        .optional(),
    grossProfitPer: zod_1.z.string().optional(),
    type: zod_1.z.enum([
        "VEG",
        "NONVEG",
        "EGG",
        "SOFTDRINKS",
        "ALCOHOL",
        "NONALCOHOLIC",
        "MILK",
        "FISH",
        "NOTAPPLICABLE",
    ], {
        required_error: "You need to select a food type.",
    }),
    menuItemVariants: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        variantId: zod_1.z.string(),
        price: zod_1.z.string(),
        netPrice: zod_1.z.string(),
        gst: zod_1.z.coerce.number().min(0, { message: "Gst Required" }),
        gstType: zod_1.z.nativeEnum(client_1.GstType, {
            required_error: "You need to select a gst type.",
        }),
        chooseProfit: zod_1.z.enum(["manualProfit", "itemRecipe"], {
            required_error: "You need to select a gross profit type.",
        }),
        grossProfit: zod_1.z.coerce.number().optional(),
        grossProfitType: zod_1.z.enum(["INR", "PER"], {
            required_error: "You need to select a gross profit type.",
        }),
        grossProfitPer: zod_1.z.string().optional(),
        foodType: zod_1.z.enum([
            "VEG",
            "NONVEG",
            "EGG",
            "SOFTDRINKS",
            "ALCOHOL",
            "NONALCOHOLIC",
            "MILK",
        ], {
            required_error: "You need to select a food type.",
        }),
    })),
    menuGroupAddOns: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        addOnGroupId: zod_1.z.string(),
    })),
    isVariants: zod_1.z.boolean().default(false),
    isAddons: zod_1.z.boolean().default(false),
    categoryId: zod_1.z.string().min(1),
    isDelivery: zod_1.z.boolean().optional(),
    isPickUp: zod_1.z.boolean().optional(),
    isDineIn: zod_1.z.boolean().optional(),
    isOnline: zod_1.z.boolean().optional(),
});
const updateItembyId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { itemId, outletId } = req.params;
    const validateFields = menuSchema.parse(req.body);
    const validFoodTypes = Object.values(client_1.FoodRole);
    if (!validateFields.name) {
        throw new bad_request_1.BadRequestsException("Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isVariants === false) {
        if (!validateFields.price) {
            throw new bad_request_1.BadRequestsException("Price is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        if (!validateFields.menuItemVariants ||
            !validateFields.menuItemVariants.length)
            throw new bad_request_1.BadRequestsException("Variants is Required if this food has Multiples", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
        throw new bad_request_1.BadRequestsException("If Add-Ons Selected, Assign required Group AddOn to it", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validateFields.categoryId) {
        throw new bad_request_1.BadRequestsException("CategoryId is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validFoodTypes.includes(validateFields.type)) {
        throw new bad_request_1.BadRequestsException("Meal Type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // if (!images || !images.length) {
    //   throw new BadRequestsException(
    //     "Images are Required",
    //     ErrorCode.UNPROCESSABLE_ENTITY
    //   );
    // }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const slug = (0, utils_1.generateSlug)(validateFields === null || validateFields === void 0 ? void 0 : validateFields.name);
    const menuItem = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(menuItem === null || menuItem === void 0 ? void 0 : menuItem.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const category = yield (0, outlet_1.getCategoryByOutletId)(outlet.id, validateFields === null || validateFields === void 0 ? void 0 : validateFields.categoryId);
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Prepare updates for variants
    const variantUpdates = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants.map((variant) => {
            console.log("Variant", variant);
            const existingVariant = menuItem.menuItemVariants.find((ev) => ev.id === variant.id);
            if (existingVariant) {
                return __1.prismaDB.menuItemVariant.update({
                    where: { id: existingVariant.id },
                    data: {
                        foodType: variant.foodType,
                        netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                        gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                        gstType: variant === null || variant === void 0 ? void 0 : variant.gstType,
                        price: variant.price,
                        chooseProfit: variant === null || variant === void 0 ? void 0 : variant.chooseProfit,
                        grossProfitType: variant === null || variant === void 0 ? void 0 : variant.grossProfitType,
                        grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER"
                            ? variant === null || variant === void 0 ? void 0 : variant.grossProfitPer
                            : null,
                        grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                        variantId: variant.variantId,
                    },
                });
            }
            else {
                return __1.prismaDB.menuItemVariant.create({
                    data: {
                        restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                        foodType: variant.foodType,
                        netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                        gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                        gstType: variant === null || variant === void 0 ? void 0 : variant.gstType,
                        price: variant.price,
                        chooseProfit: variant === null || variant === void 0 ? void 0 : variant.chooseProfit,
                        grossProfitType: variant === null || variant === void 0 ? void 0 : variant.grossProfitType,
                        grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER"
                            ? variant === null || variant === void 0 ? void 0 : variant.grossProfitPer
                            : null,
                        grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                        variantId: variant === null || variant === void 0 ? void 0 : variant.variantId,
                        menuItemId: menuItem.id,
                    },
                });
            }
        })
        : [];
    const variantIdsToKeep = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants.map((v) => v.id).filter(Boolean)
        : [];
    const variantsToDelete = menuItem.menuItemVariants.filter((ev) => !variantIdsToKeep.includes(ev.id));
    // Prepare updates for addons
    const addonUpdates = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns.map((addon) => {
            const existingAddon = menuItem.menuGroupAddOns.find((ea) => ea.id === addon.id);
            if (existingAddon) {
                return __1.prismaDB.menuGroupAddOns.update({
                    where: { id: existingAddon.id },
                    data: {
                        addOnGroupId: addon.addOnGroupId,
                    },
                });
            }
            else {
                return __1.prismaDB.menuGroupAddOns.create({
                    data: { addOnGroupId: addon.addOnGroupId, menuItemId: menuItem.id },
                });
            }
        })
        : [];
    const addonIdsToKeep = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns.map((a) => a.id).filter(Boolean)
        : [];
    const addonsToDelete = menuItem.menuGroupAddOns.filter((ea) => !addonIdsToKeep.includes(ea.id));
    // Prepare updates for images
    const imageUpdates = (_a = validateFields === null || validateFields === void 0 ? void 0 : validateFields.images) === null || _a === void 0 ? void 0 : _a.map((image) => {
        const existingImage = menuItem.images.find((ei) => ei.url === (image === null || image === void 0 ? void 0 : image.url));
        if (existingImage) {
            return __1.prismaDB.image.update({
                where: { id: existingImage.id },
                data: {
                    url: image.url,
                },
            });
        }
        else {
            return __1.prismaDB.image.create({
                data: Object.assign(Object.assign({}, image), { menuId: menuItem.id }),
            });
        }
    });
    const imageUrlsToKeep = validateFields === null || validateFields === void 0 ? void 0 : validateFields.images.map((i) => i.url);
    const imagesToDelete = menuItem.images.filter((ei) => !imageUrlsToKeep.includes(ei.url));
    // Perform all updates in a transaction
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        // Update main menu item
        yield prisma.menuItem.update({
            where: {
                id: menuItem.id,
            },
            data: {
                name: validateFields === null || validateFields === void 0 ? void 0 : validateFields.name,
                slug,
                shortCode: validateFields === null || validateFields === void 0 ? void 0 : validateFields.shortCode,
                description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
                categoryId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.categoryId,
                isVariants: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants,
                isAddons: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons,
                isDelivery: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDelivery,
                isPickUp: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPickUp,
                isDineIn: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDineIn,
                isOnline: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isOnline,
                type: validateFields === null || validateFields === void 0 ? void 0 : validateFields.type,
                price: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? "0" : validateFields === null || validateFields === void 0 ? void 0 : validateFields.price,
                gst: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.gst,
                gstType: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? undefined
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.gstType,
                netPrice: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.netPrice,
                chooseProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseProfit,
                grossProfitType: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType,
                grossProfitPer: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : (validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType) === "PER"
                        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitPer
                        : null,
                grossProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            },
        });
        // Handle variants
        yield Promise.all(variantUpdates);
        if (variantsToDelete.length > 0) {
            yield prisma.menuItemVariant.deleteMany({
                where: { id: { in: variantsToDelete.map((v) => v.id) } },
            });
        }
        // Handle addons
        yield Promise.all(addonUpdates);
        if (addonsToDelete.length > 0) {
            yield prisma.menuGroupAddOns.deleteMany({
                where: { id: { in: addonsToDelete.map((a) => a.id) } },
            });
        }
        // Handle images
        yield Promise.all(imageUpdates);
        if (imagesToDelete.length > 0) {
            yield prisma.image.deleteMany({
                where: { id: { in: imagesToDelete.map((i) => i.id) } },
            });
        }
    }));
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
        redis_1.redis.del(`o-d-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Update Success ✅",
    });
});
exports.updateItembyId = updateItembyId;
const postItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = menuSchema.parse(req.body);
    const validFoodTypes = Object.values(client_1.FoodRole);
    if (!validateFields.name) {
        throw new bad_request_1.BadRequestsException("Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isVariants === false) {
        if (!validateFields.price) {
            throw new bad_request_1.BadRequestsException("Price is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        if (!validateFields.menuItemVariants ||
            !validateFields.menuItemVariants.length)
            throw new bad_request_1.BadRequestsException("Variants is Required if this food has Multiples", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
        throw new bad_request_1.BadRequestsException("If Add-Ons Selected, Assign required Group AddOn to it", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validateFields.categoryId) {
        throw new bad_request_1.BadRequestsException("CategoryId is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validFoodTypes.includes(validateFields.type)) {
        throw new bad_request_1.BadRequestsException("Meal Type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // if (!images || !images.length) {
    //   throw new BadRequestsException(
    //     "Images are Required",
    //     ErrorCode.UNPROCESSABLE_ENTITY
    //   );
    // }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const slug = (0, utils_1.generateSlug)(validateFields === null || validateFields === void 0 ? void 0 : validateFields.name);
    const checkSlug = yield __1.prismaDB.menuItem.findFirst({
        where: {
            restaurantId: outlet.id,
            slug,
        },
    });
    if (checkSlug) {
        throw new bad_request_1.BadRequestsException("Item already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const validVariants = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) && (validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants.length) > 0
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants
        : [];
    const validAddons = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons) && (validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns.length) > 0
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns
        : [];
    const menuItem = yield __1.prismaDB.menuItem.create({
        data: {
            name: validateFields === null || validateFields === void 0 ? void 0 : validateFields.name,
            slug,
            shortCode: validateFields === null || validateFields === void 0 ? void 0 : validateFields.shortCode,
            description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
            categoryId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.categoryId,
            isVariants: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants,
            isAddons: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons,
            isDelivery: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDelivery,
            isPickUp: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPickUp,
            isDineIn: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDineIn,
            isOnline: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isOnline,
            price: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? "0" : validateFields === null || validateFields === void 0 ? void 0 : validateFields.price,
            gst: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.gst,
            gstType: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? undefined : validateFields === null || validateFields === void 0 ? void 0 : validateFields.gstType,
            netPrice: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.netPrice,
            chooseProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseProfit,
            grossProfitType: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType,
            grossProfitPer: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : (validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType) === "PER"
                    ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitPer
                    : null,
            grossProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            type: validateFields === null || validateFields === void 0 ? void 0 : validateFields.type,
            menuItemVariants: {
                create: validVariants.map((variant) => ({
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    variantId: variant === null || variant === void 0 ? void 0 : variant.variantId,
                    foodType: variant === null || variant === void 0 ? void 0 : variant.foodType,
                    netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                    gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                    gstType: variant === null || variant === void 0 ? void 0 : variant.gstType,
                    price: variant === null || variant === void 0 ? void 0 : variant.price,
                    chooseProfit: variant === null || variant === void 0 ? void 0 : variant.chooseProfit,
                    grossProfitType: variant === null || variant === void 0 ? void 0 : variant.grossProfitType,
                    grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER" ? variant === null || variant === void 0 ? void 0 : variant.grossProfitPer : null,
                    grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                })),
            },
            menuGroupAddOns: {
                create: validAddons,
            },
            images: {
                createMany: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.images.length) > 0
                    ? {
                        data: [
                            ...validateFields === null || validateFields === void 0 ? void 0 : validateFields.images.map((image) => image),
                        ],
                    }
                    : undefined,
            },
            restaurantId: outlet.id,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
        redis_1.redis.del(`o-d-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        item: menuItem,
        message: "Creattion of Item Success ✅",
    });
});
exports.postItem = postItem;
const duplicateItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Get the item to duplicate
    const sourceItem = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(sourceItem === null || sourceItem === void 0 ? void 0 : sourceItem.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    try {
        // Create the duplicate item with all related data in a transaction
        const duplicatedItem = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Create new menu item with modified name
            const newMenuItem = yield prisma.menuItem.create({
                data: {
                    restaurantId: outlet.id,
                    name: `${sourceItem.name} (Copy)`,
                    slug: (0, utils_1.generateSlug)(`${sourceItem.name} Copy`),
                    shortCode: sourceItem.shortCode
                        ? `${sourceItem.shortCode}_copy`
                        : null,
                    description: sourceItem.description,
                    price: sourceItem.price,
                    netPrice: sourceItem.netPrice,
                    gst: sourceItem.gst,
                    gstType: sourceItem.gstType,
                    chooseProfit: sourceItem.chooseProfit,
                    grossProfit: sourceItem.grossProfit,
                    grossProfitType: sourceItem.grossProfitType,
                    grossProfitPer: sourceItem.grossProfitPer,
                    isVariants: sourceItem.isVariants,
                    isAddons: sourceItem.isAddons,
                    isDineIn: sourceItem.isDineIn,
                    isOnline: sourceItem.isOnline,
                    isPickUp: sourceItem.isPickUp,
                    isDelivery: sourceItem.isDelivery,
                    type: sourceItem.type,
                    categoryId: sourceItem.categoryId,
                },
                include: {
                    menuItemVariants: true,
                    menuGroupAddOns: true,
                    images: true,
                },
            });
            // 2. Duplicate all variants if they exist
            if (sourceItem.isVariants && sourceItem.menuItemVariants.length > 0) {
                yield Promise.all(sourceItem.menuItemVariants.map((variant) => __awaiter(void 0, void 0, void 0, function* () {
                    yield prisma.menuItemVariant.create({
                        data: {
                            restaurantId: outlet.id,
                            menuItemId: newMenuItem.id,
                            variantId: variant.variantId,
                            foodType: variant.foodType,
                            price: variant.price,
                            netPrice: variant.netPrice,
                            gst: variant.gst,
                            gstType: variant.gstType,
                            chooseProfit: variant.chooseProfit,
                            grossProfit: variant.grossProfit,
                            grossProfitType: variant.grossProfitType,
                            grossProfitPer: variant.grossProfitPer,
                        },
                    });
                })));
            }
            // 3. Duplicate all add-on groups if they exist
            if (sourceItem.isAddons && sourceItem.menuGroupAddOns.length > 0) {
                yield Promise.all(sourceItem.menuGroupAddOns.map((addon) => __awaiter(void 0, void 0, void 0, function* () {
                    yield prisma.menuGroupAddOns.create({
                        data: {
                            menuItemId: newMenuItem.id,
                            addOnGroupId: addon.addOnGroupId,
                        },
                    });
                })));
            }
            // 4. Duplicate all images
            if (sourceItem.images.length > 0) {
                yield Promise.all(sourceItem.images.map((image) => __awaiter(void 0, void 0, void 0, function* () {
                    yield prisma.image.create({
                        data: {
                            url: image.url,
                            menuId: newMenuItem.id,
                        },
                    });
                })));
            }
            // 5. Duplicate item recipe if it exists
            // if (sourceItem.itemRecipeId) {
            //   // Get the original recipe details
            //   const originalRecipe = await prisma.itemRecipe.findUnique({
            //     where: { id: sourceItem.itemRecipeId },
            //   });
            //   if (originalRecipe) {
            //     const newRecipe = await prisma.itemRecipe.create({
            //       data: {
            //         menuId: newMenuItem.id,
            //         menuVariantId: originalRecipe.menuVariantId,
            //         addonItemVariantId: originalRecipe.addonItemVariantId,
            //         recipeFor: originalRecipe.recipeFor,
            //         recipeType: originalRecipe.recipeType,
            //         ingredients: originalRecipe.ingredients,
            //       },
            //     });
            //     // Update the menu item with the new recipe ID
            //     await prisma.menuItem.update({
            //       where: { id: newMenuItem.id },
            //       data: { itemRecipeId: newRecipe.id },
            //     });
            //   }
            // }
            return newMenuItem;
        }));
        // Clear Redis cache for this outlet
        const categories = yield __1.prismaDB.category.findMany({
            where: {
                restaurantId: outletId,
            },
            select: {
                id: true,
            },
        });
        yield Promise.all([
            redis_1.redis.del(`${outletId}-all-items`),
            redis_1.redis.del(`${outletId}-all-items-online-and-delivery`),
            redis_1.redis.del(`o-${outletId}-categories`),
            redis_1.redis.del(`o-d-${outletId}-categories`),
        ]);
        categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
            yield redis_1.redis.del(`${outletId}-category-${c.id}`);
        }));
        return res.json({
            success: true,
            item: duplicatedItem,
            message: "Item duplicated successfully ✅",
        });
    }
    catch (error) {
        console.error("Error duplicating item:", error);
        throw new bad_request_1.BadRequestsException("Failed to duplicate item", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
});
exports.duplicateItem = duplicateItem;
const deleteItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    // Use transaction to delete both MenuItem and ItemRecipe
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        if (item.itemRecipeId) {
            yield prisma.itemRecipe.delete({
                where: {
                    id: item.itemRecipeId,
                },
            });
        }
        yield prisma.menuItem.delete({
            where: {
                restaurantId: outlet.id,
                id: item === null || item === void 0 ? void 0 : item.id,
            },
        });
    }));
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
        redis_1.redis.del(`o-d-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Deleted ",
    });
});
exports.deleteItem = deleteItem;
const getShortCodeStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { shortCode } = req.body;
    console.log("Short Code", shortCode);
    const findShortCode = yield __1.prismaDB.menuItem.findFirst({
        where: {
            restaurantId: outletId,
            shortCode: shortCode,
        },
    });
    if (findShortCode === null || findShortCode === void 0 ? void 0 : findShortCode.id) {
        return res.json({
            success: true,
        });
    }
    else {
        return res.json({
            success: false,
        });
    }
});
exports.getShortCodeStatus = getShortCodeStatus;
const getMenuVariants = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getVariants = yield __1.prismaDB.menuItemVariant.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            menuItem: true,
            variant: true,
        },
    });
    const formattedVariants = getVariants === null || getVariants === void 0 ? void 0 : getVariants.map((variant) => {
        var _a, _b;
        return ({
            id: variant === null || variant === void 0 ? void 0 : variant.id,
            name: `${(_a = variant === null || variant === void 0 ? void 0 : variant.menuItem) === null || _a === void 0 ? void 0 : _a.name}-${(_b = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _b === void 0 ? void 0 : _b.name}`,
            price: variant === null || variant === void 0 ? void 0 : variant.price,
        });
    });
    return res.json({
        success: true,
        menuVariants: formattedVariants,
    });
});
exports.getMenuVariants = getMenuVariants;
const addItemToUserFav = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { id } = req.body;
    const { outletId } = req.params;
    // @ts-ignore
    const userId = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.id;
    yield redis_1.redis.del(`user-favitems-${userId}`);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!user) {
        throw new bad_request_1.BadRequestsException("Admin Not found", root_1.ErrorCode.UNAUTHORIZED);
    }
    // Ensure favItems is an array
    const favItems = Array.isArray(user.favItems) ? user.favItems : [];
    // Check if the menu ID exists in favItems
    const updatedFavItems = favItems.includes(id)
        ? favItems.filter((favId) => favId !== id) // Remove the ID if present
        : [...favItems, id]; // Add the ID if not present
    // Update the favItems field
    yield __1.prismaDB.user.update({
        where: {
            id: user.id,
        },
        data: {
            favItems: updatedFavItems, // Directly set the updated array
        },
    });
    yield (0, get_users_1.getFormatUserAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
    return res.json({
        success: true,
        message: "Added to favourites",
    });
});
exports.addItemToUserFav = addItemToUserFav;
const getSingleAddons = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getAddons = yield __1.prismaDB.addOnVariants.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            addon: true,
        },
    });
    const formattedAddOns = getAddons === null || getAddons === void 0 ? void 0 : getAddons.map((addOn) => ({
        id: addOn === null || addOn === void 0 ? void 0 : addOn.id,
        name: addOn === null || addOn === void 0 ? void 0 : addOn.name,
        price: addOn === null || addOn === void 0 ? void 0 : addOn.price,
    }));
    return res.json({
        success: true,
        addOnItems: formattedAddOns,
    });
});
exports.getSingleAddons = getSingleAddons;
const enableFeaturedStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const { enabled } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.update({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
        data: {
            isFeatured: true,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Updated",
    });
});
exports.enableFeaturedStatus = enableFeaturedStatus;
const disableFeaturedStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const { enabled } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.update({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
        data: {
            isFeatured: false,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Updated",
    });
});
exports.disableFeaturedStatus = disableFeaturedStatus;
const enableInStockStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const { enabled } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.update({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
        data: {
            isInStock: true,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Updated",
    });
});
exports.enableInStockStatus = enableInStockStatus;
const disableInStockStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const { enabled } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.update({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
        data: {
            isInStock: false,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Updated",
    });
});
exports.disableInStockStatus = disableInStockStatus;
const enablePosStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const { enabled } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.update({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
        data: {
            isDineIn: true,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Updated",
    });
});
exports.enablePosStatus = enablePosStatus;
const disablePosStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const { enabled } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.update({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
        data: {
            isDineIn: false,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Updated",
    });
});
exports.disablePosStatus = disablePosStatus;
const deleteItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.delete({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
    });
    const categories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    categories === null || categories === void 0 ? void 0 : categories.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        yield redis_1.redis.del(`${outletId}-category-${c.id}`);
    }));
    return res.json({
        success: true,
        message: "Item Deleted",
    });
});
exports.deleteItems = deleteItems;
