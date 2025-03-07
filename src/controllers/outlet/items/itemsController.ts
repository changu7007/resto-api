import { Request, Response } from "express";
import {
  getAddOnByOutletId,
  getCategoryByOutletId,
  getItemByOutletId,
  getOutletById,
  getVariantByOutletId,
} from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import {
  Category,
  ChooseProfit,
  FoodRole,
  GstType,
  MenuItem,
} from "@prisma/client";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { redis } from "../../../services/redis";
import {
  getOAllItems,
  getOAllItemsForOnlineAndDelivery,
} from "../../../lib/outlet/get-items";
import { z } from "zod";
import { getFormatUserAndSendToRedis } from "../../../lib/get-users";
import { format } from "date-fns";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";
import { fuzzySearch } from "../../../lib/algorithms";
import { generateSlug } from "../../../lib/utils";

export interface FoodMenu {
  id: string;
  name: string;
  shortCode?: string | null;
  description?: string | null;
  images: {
    id: string;
    url: string;
  }[];
  categoryId: string;
  categoryName: string;
  price: string;
  netPrice: string;
  chooseProfit: ChooseProfit;
  gst: number;
  itemRecipe: {
    id: string;
    menuId: string | null;
    menuVariantId: string | null;
    addonItemVariantId: string | null;
  };
  grossProfit: number;
  isVariants: boolean;
  isAddOns?: boolean;
  menuItemVariants: {
    id: string;
    variantName: string;
    price: string;
    netPrice: string;
    gst: number;
    grossProfit: number;
    type: string;
  }[];
  menuGroupAddOns: {
    id: string;
    addOnGroupName: string;
    description: string | null;
    addonVariants: {
      id: string;
      name: string;
      netPrice: string;
      gst: number;
      price: string;
      type: string;
    }[];
  }[];
  favourite?: boolean;
  type: FoodRole;
}

export const getItemsForOnlineAndDelivery = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const allItems = await redis.get(`${outletId}-all-items-online-and-delivery`);

  if (allItems) {
    return res.json({
      success: true,
      items: JSON.parse(allItems),
      message: "Fetched Items By Redis ✅",
    });
  }
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const items = await getOAllItemsForOnlineAndDelivery(outletId);
  return res.json({
    success: true,
    items: items,
  });
};

export const getItemsByCategoryForOnlineAndDelivery = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  const categoryId: string = req.query.categoryId as string;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const redisItems = await redis.get(
    `${outletId}-all-items-online-and-delivery`
  );

  if (redisItems) {
    const items: FoodMenu[] = JSON.parse(redisItems);
    let sendItems: FoodMenu[] = [];

    if (categoryId) {
      if (categoryId === "all") {
        sendItems = items;
      } else if (categoryId === "mostloved") {
        // get most loved items for online and delivery where more than 100 orders
        const getItems = await prismaDB.orderItem.findMany({
          where: {
            menuId: { in: items.map((item) => item.id) },
          },
        });
        sendItems = items.filter(
          (item) => getItems.filter((i) => i.menuId === item.id).length > 40
        );
      } else {
        sendItems = items.filter((item) => item.categoryId === categoryId);
      }
    }
    return res.json({
      success: true,
      data: sendItems,
    });
  } else {
    const items = await getOAllItemsForOnlineAndDelivery(outletId);
    let sendItems: FoodMenu[] = [];
    if (categoryId) {
      if (categoryId === "all") {
        sendItems = items;
      } else if (categoryId === "mostloved") {
        // get most loved items for online and delivery where more than 100 orders
        const getItems = await prismaDB.orderItem.findMany({
          where: {
            menuId: { in: items.map((item) => item.id) },
          },
        });
        sendItems = items.filter(
          (item) => getItems.filter((i) => i.menuId === item.id).length > 40
        );
      } else {
        sendItems = items.filter((item) => item.categoryId === categoryId);
      }
    }

    return res.json({
      success: true,
      data: sendItems,
    });
  }
};

export const getItemsBySearchForOnlineAndDelivery = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  const search: string = req.query.search as string;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const redisItems = await redis.get(
    `${outletId}-all-items-online-and-delivery`
  );

  if (redisItems) {
    const items: FoodMenu[] = JSON.parse(redisItems);
    let sendItems: FoodMenu[] = [];

    if (search) {
      sendItems = items.filter((item) => {
        return (
          // Fuzzy search on name
          fuzzySearch(item.name, search) ||
          // Fuzzy search on shortCode
          (item.shortCode && fuzzySearch(item.shortCode, search)) ||
          // Fuzzy search on description
          (item.description && fuzzySearch(item.description, search)) ||
          // Search in category name
          (item.categoryName && fuzzySearch(item.categoryName, search)) ||
          // Match price range (if search term is a number)
          (!isNaN(Number(search)) &&
            Math.abs(Number(item.price) - Number(search)) <= 50) // Within ₹50 range
        );
      });
    }

    // Sort results by relevance
    sendItems.sort((a, b) => {
      const aScore = fuzzySearch(a.name, search)
        ? 2
        : a.shortCode && fuzzySearch(a.shortCode, search)
        ? 1.5
        : 1;
      const bScore = fuzzySearch(b.name, search)
        ? 2
        : b.shortCode && fuzzySearch(b.shortCode, search)
        ? 1.5
        : 1;
      return bScore - aScore;
    });

    return res.json({
      success: true,
      data: sendItems,
    });
  } else {
    const items = await getOAllItemsForOnlineAndDelivery(outletId);
    let sendItems: FoodMenu[] = [];

    if (search) {
      sendItems = items.filter((item) => {
        return (
          fuzzySearch(item.name, search) ||
          (item.shortCode && fuzzySearch(item.shortCode, search)) ||
          (item.description && fuzzySearch(item.description, search)) ||
          (item.categoryName && fuzzySearch(item.categoryName, search)) ||
          (!isNaN(Number(search)) &&
            Math.abs(Number(item.price) - Number(search)) <= 50)
        );
      });

      // Sort results by relevance
      sendItems.sort((a, b) => {
        const aScore = fuzzySearch(a.name, search)
          ? 2
          : a.shortCode && fuzzySearch(a.shortCode, search)
          ? 1.5
          : 1;
        const bScore = fuzzySearch(b.name, search)
          ? 2
          : b.shortCode && fuzzySearch(b.shortCode, search)
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
};

export const getItemsByCategory = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const categoryId: string = req.query.categoryId as string;

  // Use Promise.all to parallelize independent operations
  const [outlet, redisItems] = await Promise.all([
    getOutletById(outletId),
    redis.get(`${outletId}-all-items`),
  ]);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  let items: FoodMenu[];

  // Get items either from Redis or DB
  if (redisItems) {
    console.log("Fetching items from Redis");
    items = JSON.parse(redisItems);
  } else {
    console.log("Fetching items from Database");
    items = await getOAllItems(outletId);
    // Cache items in Redis with 5 minutes TTL
    await redis.set(`${outletId}-all-items`, JSON.stringify(items), "EX", 300);
  }

  // Handle different category scenarios
  let sendItems: FoodMenu[] = [];

  if (!categoryId || categoryId === "all") {
    sendItems = items;
  } else if (categoryId === "favourites") {
    // Get user's favorite items
    const userCacheKey = `user-favitems-${outlet.adminId}`;
    let favItemIds = await redis.get(userCacheKey);

    if (!favItemIds) {
      const user = await prismaDB.user.findUnique({
        where: { id: outlet.adminId },
        select: { favItems: true },
      });
      favItemIds = JSON.stringify(user?.favItems || []);
      await redis.set(userCacheKey, favItemIds, "EX", 300);
    }

    const userFavItems = JSON.parse(favItemIds);
    sendItems = items.filter((item) => userFavItems.includes(item.id));
  } else {
    // Get items for specific category
    const categoryKey = `${outletId}-category-${categoryId}`;
    const cachedCategoryItems = await redis.get(categoryKey);

    if (cachedCategoryItems) {
      sendItems = JSON.parse(cachedCategoryItems);
    } else {
      sendItems = items.filter((item) => item.categoryId === categoryId);
      await redis.set(categoryKey, JSON.stringify(sendItems), "EX", 300);
    }
  }

  return res.json({
    success: true,
    data: sendItems,
  });
};

export const getItemsBySearch = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const search: string = req.query.search as string;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const redisItems = await redis.get(`${outletId}-all-items`);

  if (redisItems) {
    const items: FoodMenu[] = JSON.parse(redisItems);
    let sendItems: FoodMenu[] = [];

    if (search) {
      sendItems = items.filter((item) => {
        return (
          // Fuzzy search on name
          fuzzySearch(item.name, search) ||
          // Fuzzy search on shortCode
          (item.shortCode && fuzzySearch(item.shortCode, search)) ||
          // Fuzzy search on description
          (item.description && fuzzySearch(item.description, search)) ||
          // Search in category name
          (item.categoryName && fuzzySearch(item.categoryName, search)) ||
          // Match price range (if search term is a number)
          (!isNaN(Number(search)) &&
            Math.abs(Number(item.price) - Number(search)) <= 50) // Within ₹50 range
        );
      });
    }

    // Sort results by relevance
    sendItems.sort((a, b) => {
      const aScore = fuzzySearch(a.name, search)
        ? 2
        : a.shortCode && fuzzySearch(a.shortCode, search)
        ? 1.5
        : 1;
      const bScore = fuzzySearch(b.name, search)
        ? 2
        : b.shortCode && fuzzySearch(b.shortCode, search)
        ? 1.5
        : 1;
      return bScore - aScore;
    });

    return res.json({
      success: true,
      data: sendItems,
    });
  } else {
    const items = await getOAllItems(outletId);
    let sendItems: FoodMenu[] = [];

    if (search) {
      sendItems = items.filter((item) => {
        return (
          fuzzySearch(item.name, search) ||
          (item.shortCode && fuzzySearch(item.shortCode, search)) ||
          (item.description && fuzzySearch(item.description, search)) ||
          (item.categoryName && fuzzySearch(item.categoryName, search)) ||
          (!isNaN(Number(search)) &&
            Math.abs(Number(item.price) - Number(search)) <= 50)
        );
      });

      // Sort results by relevance
      sendItems.sort((a, b) => {
        const aScore = fuzzySearch(a.name, search)
          ? 2
          : a.shortCode && fuzzySearch(a.shortCode, search)
          ? 1.5
          : 1;
        const bScore = fuzzySearch(b.name, search)
          ? 2
          : b.shortCode && fuzzySearch(b.shortCode, search)
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
};

export const getItemForTable = async (req: Request, res: Response) => {
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

  const totalCount = await prismaDB.menuItem.count({
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

  const getItems = await prismaDB.menuItem.findMany({
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

  const formattedMenuItems = getItems?.map((item) => ({
    id: item?.id,
    name: item?.name,
    shortCode: item?.shortCode,
    category: item?.category?.name,
    categoryId: item?.category?.id,
    isPos: item?.isDineIn,
    isOnline: item?.isOnline,
    isVariants: item?.isVariants,
    variants: item?.menuItemVariants?.map((variant) => ({
      name: variant?.variant?.name,
      price: variant?.price,
    })),
    createdAt: item?.createdAt,
    createdBy: "Admin",
    type: item?.type,
    price: item?.price,
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      items: formattedMenuItems,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getCategoriesForTable = async (req: Request, res: Response) => {
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
  const totalCount = await prismaDB.category.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getCategories = await prismaDB.category.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    orderBy,
  });

  const formattedCategories = getCategories?.map((category) => ({
    id: category?.id,
    name: category?.name,
    createdAt: format(category.createdAt, "MMMM do, yyyy"),
    updatedAt: format(category.updatedAt, "MMMM do, yyyy"),
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      categories: formattedCategories,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getVariantsForTable = async (req: Request, res: Response) => {
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
  const totalCount = await prismaDB.variants.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getVariants = await prismaDB.variants.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    orderBy,
  });

  const formattedVariants = getVariants?.map((item) => ({
    id: item.id,
    name: item.name,
    variantCategory: item.variantCategory,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
    updatedAt: format(item.updatedAt, "MMMM do, yyyy"),
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      variants: formattedVariants,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getAddonsForTable = async (req: Request, res: Response) => {
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
  const totalCount = await prismaDB.addOns.count({
    where: {
      restaurantId: outletId,
      OR: [{ title: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getAddons = await prismaDB.addOns.findMany({
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

  const formattedAddOns = getAddons?.map((addOn) => ({
    id: addOn.id,
    title: addOn.title,
    description: addOn.description,
    minSelect: addOn.minSelect,
    maxSelect: addOn.maxSelect,
    addOnVariants: addOn.addOnVariants,
    status: addOn.status,
    createdAt: format(addOn.createdAt, "MMMM do, yyyy"),
    updatedAt: format(addOn.updatedAt, "MMMM do, yyyy"),
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      addons: formattedAddOns,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getAllItem = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const allItems = await redis.get(`${outletId}-all-items`);

  if (allItems) {
    return res.json({
      success: true,
      items: JSON.parse(allItems),
      message: "Fetched Items By Redis ✅",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const items = await getOAllItems(outlet.id);

  return res.json({
    success: true,
    items: items,
    message: "Fetched Items by database ✅",
  });
};

export const getItemById = async (req: Request, res: Response) => {
  const { itemId, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const menuItem = await getItemByOutletId(outlet.id, itemId);

  if (!menuItem?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    item: menuItem,
    message: "Fetched Item Success ✅",
  });
};

export const getVariantById = async (req: Request, res: Response) => {
  const { variantId, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const variant = await getVariantByOutletId(outlet.id, variantId);

  if (!variant?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    item: variant,
    message: "Fetched Variant Success ✅",
  });
};

export const getAddONById = async (req: Request, res: Response) => {
  const { addOnId, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const addOn = await getAddOnByOutletId(outlet.id, addOnId);

  if (!addOn?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    item: addOn,
    message: "Fetched Variant Success ✅",
  });
};

const menuSchema = z.object({
  name: z.string().min(1),
  shortCode: z.string().optional(),
  description: z.string().min(1),
  images: z.object({ url: z.string() }).array(),
  price: z.string().optional(),
  netPrice: z.string().optional(),
  gstType: z.nativeEnum(GstType, {
    required_error: "You need to select a gst type.",
  }),
  gst: z.coerce.number().optional(),
  chooseProfit: z
    .enum(["manualProfit", "itemRecipe"], {
      required_error: "You need to select a gross profit type.",
    })
    .optional(),
  grossProfit: z.coerce.number().optional(),
  grossProfitType: z
    .enum(["INR", "PER"], {
      required_error: "You need to select a gross profit type.",
    })
    .optional(),
  grossProfitPer: z.string().optional(),
  type: z.enum(
    ["VEG", "NONVEG", "EGG", "SOFTDRINKS", "ALCOHOL", "NONALCOHOLIC", "MILK"],
    {
      required_error: "You need to select a food type.",
    }
  ),
  menuItemVariants: z.array(
    z.object({
      id: z.string().optional(),
      variantId: z.string(),
      price: z.string(),
      netPrice: z.string(),
      gst: z.coerce.number().min(0, { message: "Gst Required" }),
      gstType: z.nativeEnum(GstType, {
        required_error: "You need to select a gst type.",
      }),
      chooseProfit: z.enum(["manualProfit", "itemRecipe"], {
        required_error: "You need to select a gross profit type.",
      }),
      grossProfit: z.coerce.number().optional(),
      grossProfitType: z.enum(["INR", "PER"], {
        required_error: "You need to select a gross profit type.",
      }),
      grossProfitPer: z.string().optional(),
      foodType: z.enum(
        [
          "VEG",
          "NONVEG",
          "EGG",
          "SOFTDRINKS",
          "ALCOHOL",
          "NONALCOHOLIC",
          "MILK",
        ],
        {
          required_error: "You need to select a food type.",
        }
      ),
    })
  ),
  menuGroupAddOns: z.array(
    z.object({
      id: z.string().optional(),
      addOnGroupId: z.string(),
    })
  ),
  isVariants: z.boolean().default(false),
  isAddons: z.boolean().default(false),
  categoryId: z.string().min(1),
  isDelivery: z.boolean().optional(),
  isPickUp: z.boolean().optional(),
  isDineIn: z.boolean().optional(),
  isOnline: z.boolean().optional(),
});

export const updateItembyId = async (req: Request, res: Response) => {
  const { itemId, outletId } = req.params;
  const validateFields = menuSchema.parse(req.body);

  const validFoodTypes = Object.values(FoodRole);

  if (!validateFields.name) {
    throw new BadRequestsException(
      "Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields.isVariants === false) {
    if (!validateFields.price) {
      throw new BadRequestsException(
        "Price is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    if (
      !validateFields.menuItemVariants ||
      !validateFields.menuItemVariants.length
    )
      throw new BadRequestsException(
        "Variants is Required if this food has Multiples",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
  }

  if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
    throw new BadRequestsException(
      "If Add-Ons Selected, Assign required Group AddOn to it",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validateFields.description) {
    throw new BadRequestsException(
      "Description is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validateFields.categoryId) {
    throw new BadRequestsException(
      "CategoryId is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validFoodTypes.includes(validateFields.type)) {
    throw new BadRequestsException(
      "Meal Type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // if (!images || !images.length) {
  //   throw new BadRequestsException(
  //     "Images are Required",
  //     ErrorCode.UNPROCESSABLE_ENTITY
  //   );
  // }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const menuItem = await getItemByOutletId(outlet.id, itemId);

  if (!menuItem?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }
  const category = await getCategoryByOutletId(
    outlet.id,
    validateFields?.categoryId
  );

  if (!category?.id) {
    throw new NotFoundException(
      "Category Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  // Prepare updates for variants
  const variantUpdates = validateFields?.isVariants
    ? validateFields?.menuItemVariants.map((variant) => {
        console.log("Variant", variant);
        const existingVariant = menuItem.menuItemVariants.find(
          (ev) => ev.id === variant.id
        );
        if (existingVariant) {
          return prismaDB.menuItemVariant.update({
            where: { id: existingVariant.id },
            data: {
              foodType: variant.foodType,
              netPrice: variant?.netPrice,
              gst: variant?.gst,
              gstType: variant?.gstType,
              price: variant.price,
              chooseProfit: variant?.chooseProfit,
              grossProfitType: variant?.grossProfitType,
              grossProfitPer:
                variant?.grossProfitType === "PER"
                  ? variant?.grossProfitPer
                  : null,
              grossProfit: variant?.grossProfit,
              variantId: variant.variantId,
            },
          });
        } else {
          return prismaDB.menuItemVariant.create({
            data: {
              restaurantId: outlet?.id,
              foodType: variant.foodType,
              netPrice: variant?.netPrice,
              gst: variant?.gst,
              gstType: variant?.gstType,
              price: variant.price,
              chooseProfit: variant?.chooseProfit,
              grossProfitType: variant?.grossProfitType,
              grossProfitPer:
                variant?.grossProfitType === "PER"
                  ? variant?.grossProfitPer
                  : null,
              grossProfit: variant?.grossProfit,
              variantId: variant?.variantId,
              menuItemId: menuItem.id,
            },
          });
        }
      })
    : [];

  const variantIdsToKeep = validateFields?.isVariants
    ? validateFields?.menuItemVariants.map((v: any) => v.id).filter(Boolean)
    : [];
  const variantsToDelete = menuItem.menuItemVariants.filter(
    (ev) => !variantIdsToKeep.includes(ev.id)
  );

  // Prepare updates for addons
  const addonUpdates = validateFields?.isAddons
    ? validateFields?.menuGroupAddOns.map((addon) => {
        const existingAddon = menuItem.menuGroupAddOns.find(
          (ea) => ea.id === addon.id
        );
        if (existingAddon) {
          return prismaDB.menuGroupAddOns.update({
            where: { id: existingAddon.id },
            data: {
              addOnGroupId: addon.addOnGroupId,
            },
          });
        } else {
          return prismaDB.menuGroupAddOns.create({
            data: { addOnGroupId: addon.addOnGroupId, menuItemId: menuItem.id },
          });
        }
      })
    : [];

  const addonIdsToKeep = validateFields?.isAddons
    ? validateFields?.menuGroupAddOns.map((a) => a.id).filter(Boolean)
    : [];

  const addonsToDelete = menuItem.menuGroupAddOns.filter(
    (ea) => !addonIdsToKeep.includes(ea.id)
  );

  // Prepare updates for images
  const imageUpdates = validateFields?.images?.map((image) => {
    const existingImage = menuItem.images.find((ei) => ei.url === image?.url);
    if (existingImage) {
      return prismaDB.image.update({
        where: { id: existingImage.id },
        data: {
          url: image.url,
        },
      });
    } else {
      return prismaDB.image.create({
        data: { ...image, menuId: menuItem.id },
      });
    }
  });

  const imageUrlsToKeep = validateFields?.images.map((i) => i.url);
  const imagesToDelete = menuItem.images.filter(
    (ei) => !imageUrlsToKeep.includes(ei.url)
  );

  // Perform all updates in a transaction
  await prismaDB.$transaction(async (prisma) => {
    // Update main menu item

    await prisma.menuItem.update({
      where: {
        id: menuItem.id,
      },
      data: {
        name: validateFields?.name,
        shortCode: validateFields?.shortCode,
        description: validateFields?.description,
        categoryId: validateFields?.categoryId,
        isVariants: validateFields?.isVariants,
        isAddons: validateFields?.isAddons,
        isDelivery: validateFields?.isDelivery,
        isPickUp: validateFields?.isPickUp,
        isDineIn: validateFields?.isDineIn,
        isOnline: validateFields?.isOnline,
        type: validateFields?.type,
        price: validateFields?.isVariants ? "0" : validateFields?.price,
        gst: validateFields?.isVariants ? null : validateFields?.gst,
        gstType: validateFields?.isVariants
          ? undefined
          : validateFields?.gstType,
        netPrice: validateFields?.isVariants ? null : validateFields?.netPrice,
        chooseProfit: validateFields?.isVariants
          ? null
          : validateFields?.chooseProfit,
        grossProfitType: validateFields?.isVariants
          ? null
          : validateFields?.grossProfitType,
        grossProfitPer: validateFields?.isVariants
          ? null
          : validateFields?.grossProfitType === "PER"
          ? validateFields?.grossProfitPer
          : null,
        grossProfit: validateFields?.isVariants
          ? null
          : validateFields?.grossProfit,
      },
    });

    // Handle variants
    await Promise.all(variantUpdates);
    if (variantsToDelete.length > 0) {
      await prisma.menuItemVariant.deleteMany({
        where: { id: { in: variantsToDelete.map((v) => v.id) } },
      });
    }

    // Handle addons
    await Promise.all(addonUpdates);
    if (addonsToDelete.length > 0) {
      await prisma.menuGroupAddOns.deleteMany({
        where: { id: { in: addonsToDelete.map((a) => a.id) } },
      });
    }

    // Handle images
    await Promise.all(imageUpdates);
    if (imagesToDelete.length > 0) {
      await prisma.image.deleteMany({
        where: { id: { in: imagesToDelete.map((i) => i.id) } },
      });
    }
  });

  const categories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
    },
  });

  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);

  categories?.map(async (c) => {
    await redis.del(`${outletId}-category-${c.id}`);
  });

  return res.json({
    success: true,
    message: "Update Success ✅",
  });
};

export const postItem = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validateFields = menuSchema.parse(req.body);

  const validFoodTypes = Object.values(FoodRole);

  if (!validateFields.name) {
    throw new BadRequestsException(
      "Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields.isVariants === false) {
    if (!validateFields.price) {
      throw new BadRequestsException(
        "Price is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    if (
      !validateFields.menuItemVariants ||
      !validateFields.menuItemVariants.length
    )
      throw new BadRequestsException(
        "Variants is Required if this food has Multiples",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
  }

  if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
    throw new BadRequestsException(
      "If Add-Ons Selected, Assign required Group AddOn to it",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validateFields.description) {
    throw new BadRequestsException(
      "Description is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validateFields.categoryId) {
    throw new BadRequestsException(
      "CategoryId is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validFoodTypes.includes(validateFields.type)) {
    throw new BadRequestsException(
      "Meal Type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // if (!images || !images.length) {
  //   throw new BadRequestsException(
  //     "Images are Required",
  //     ErrorCode.UNPROCESSABLE_ENTITY
  //   );
  // }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validVariants =
    validateFields?.isVariants && validateFields?.menuItemVariants.length > 0
      ? validateFields?.menuItemVariants
      : [];
  const validAddons =
    validateFields?.isAddons && validateFields?.menuGroupAddOns.length > 0
      ? validateFields?.menuGroupAddOns
      : [];

  const menuItem = await prismaDB.menuItem.create({
    data: {
      name: validateFields?.name,
      slug: generateSlug(validateFields?.name),
      shortCode: validateFields?.shortCode,
      description: validateFields?.description,
      categoryId: validateFields?.categoryId,
      isVariants: validateFields?.isVariants,
      isAddons: validateFields?.isAddons,
      isDelivery: validateFields?.isDelivery,
      isPickUp: validateFields?.isPickUp,
      isDineIn: validateFields?.isDineIn,
      isOnline: validateFields?.isOnline,
      price: validateFields?.isVariants ? "0" : validateFields?.price,
      gst: validateFields?.isVariants ? null : validateFields?.gst,
      gstType: validateFields?.isVariants ? undefined : validateFields?.gstType,
      netPrice: validateFields?.isVariants ? null : validateFields?.netPrice,
      chooseProfit: validateFields?.isVariants
        ? null
        : validateFields?.chooseProfit,
      grossProfitType: validateFields?.isVariants
        ? null
        : validateFields?.grossProfitType,
      grossProfitPer: validateFields?.isVariants
        ? null
        : validateFields?.grossProfitType === "PER"
        ? validateFields?.grossProfitPer
        : null,
      grossProfit: validateFields?.isVariants
        ? null
        : validateFields?.grossProfit,
      type: validateFields?.type,
      menuItemVariants: {
        create: validVariants.map((variant) => ({
          restaurantId: outlet?.id,
          variantId: variant?.variantId,
          foodType: variant?.foodType,
          netPrice: variant?.netPrice,
          gst: variant?.gst,
          gstType: variant?.gstType,
          price: variant?.price,
          chooseProfit: variant?.chooseProfit,
          grossProfitType: variant?.grossProfitType,
          grossProfitPer:
            variant?.grossProfitType === "PER" ? variant?.grossProfitPer : null,
          grossProfit: variant?.grossProfit,
        })),
      },
      menuGroupAddOns: {
        create: validAddons,
      },
      images: {
        createMany:
          validateFields?.images.length > 0
            ? {
                data: [
                  ...validateFields?.images.map(
                    (image: { url: string }) => image
                  ),
                ],
              }
            : undefined,
      },
      restaurantId: outlet.id,
    },
  });

  const categories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
    },
  });

  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);

  categories?.map(async (c) => {
    await redis.del(`${outletId}-category-${c.id}`);
  });

  return res.json({
    success: true,
    item: menuItem,
    message: "Creattion of Item Success ✅",
  });
};

export const deleteItem = async (req: Request, res: Response) => {
  const { outletId, itemId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const item = await getItemByOutletId(outlet.id, itemId);

  if (!item?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  // Use transaction to delete both MenuItem and ItemRecipe
  await prismaDB.$transaction(async (prisma) => {
    if (item.itemRecipeId) {
      await prisma.itemRecipe.delete({
        where: {
          id: item.itemRecipeId,
        },
      });
    }

    await prisma.menuItem.delete({
      where: {
        restaurantId: outlet.id,
        id: item?.id,
      },
    });
  });

  const categories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
    },
  });

  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);

  categories?.map(async (c) => {
    await redis.del(`${outletId}-category-${c.id}`);
  });

  return res.json({
    success: true,
    message: "Item Deleted ",
  });
};

export const getShortCodeStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { shortCode } = req.body;
  console.log("Short Code", shortCode);
  const findShortCode = await prismaDB.menuItem.findFirst({
    where: {
      restaurantId: outletId,
      shortCode: shortCode,
    },
  });

  if (findShortCode?.id) {
    return res.json({
      success: true,
    });
  } else {
    return res.json({
      success: false,
    });
  }
};

export const getMenuVariants = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getVariants = await prismaDB.menuItemVariant.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      menuItem: true,
      variant: true,
    },
  });

  const formattedVariants = getVariants?.map((variant) => ({
    id: variant?.id,
    name: `${variant?.menuItem?.name}-${variant?.variant?.name}`,
    price: variant?.price,
  }));

  return res.json({
    success: true,
    menuVariants: formattedVariants,
  });
};

export const addItemToUserFav = async (req: Request, res: Response) => {
  const { id } = req.body;
  const { outletId } = req.params;
  // @ts-ignore
  const userId = req?.user?.id;

  await redis.del(`user-favitems-${userId}`);

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const user = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new BadRequestsException("Admin Not found", ErrorCode.UNAUTHORIZED);
  }

  // Ensure favItems is an array
  const favItems = Array.isArray(user.favItems) ? user.favItems : [];

  // Check if the menu ID exists in favItems
  const updatedFavItems = favItems.includes(id)
    ? favItems.filter((favId) => favId !== id) // Remove the ID if present
    : [...favItems, id]; // Add the ID if not present

  // Update the favItems field
  await prismaDB.user.update({
    where: {
      id: user.id,
    },
    data: {
      favItems: updatedFavItems, // Directly set the updated array
    },
  });

  await getFormatUserAndSendToRedis(user?.id);

  return res.json({
    success: true,
    message: "Added to favourites",
  });
};

export const getSingleAddons = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getAddons = await prismaDB.addOnVariants.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      addon: true,
    },
  });

  const formattedAddOns = getAddons?.map((addOn) => ({
    id: addOn?.id,
    name: addOn?.name,
    price: addOn?.price,
  }));

  return res.json({
    success: true,
    addOnItems: formattedAddOns,
  });
};

export const enablePosStatus = async (req: Request, res: Response) => {
  const { outletId, itemId } = req.params;
  const { enabled } = req.body;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const item = await getItemByOutletId(outlet.id, itemId);

  if (!item?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.menuItem.update({
    where: {
      restaurantId: outlet.id,
      id: item?.id,
    },
    data: {
      isDineIn: true,
    },
  });

  const categories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
    },
  });

  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);

  categories?.map(async (c) => {
    await redis.del(`${outletId}-category-${c.id}`);
  });

  return res.json({
    success: true,
    message: "Item Updated",
  });
};

export const disablePosStatus = async (req: Request, res: Response) => {
  const { outletId, itemId } = req.params;
  const { enabled } = req.body;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const item = await getItemByOutletId(outlet.id, itemId);

  if (!item?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.menuItem.update({
    where: {
      restaurantId: outlet.id,
      id: item?.id,
    },
    data: {
      isDineIn: false,
    },
  });

  const categories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
    },
  });

  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);

  categories?.map(async (c) => {
    await redis.del(`${outletId}-category-${c.id}`);
  });

  return res.json({
    success: true,
    message: "Item Updated",
  });
};

export const deleteItems = async (req: Request, res: Response) => {
  const { outletId, itemId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const item = await getItemByOutletId(outlet.id, itemId);

  if (!item?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.menuItem.delete({
    where: {
      restaurantId: outlet.id,
      id: item?.id,
    },
  });

  const categories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
    },
  });

  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);

  categories?.map(async (c) => {
    await redis.del(`${outletId}-category-${c.id}`);
  });

  return res.json({
    success: true,
    message: "Item Deleted",
  });
};
