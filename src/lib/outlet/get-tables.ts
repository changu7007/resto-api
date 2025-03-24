import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getFetchAllTablesToRedis = async (outletId: string) => {
  const tables = await prismaDB.table.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      orderSession: {
        include: {
          orders: {
            include: { orderItems: true },
          },
        },
      },
      areas: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  await redis.set(`tables-${outletId}`, JSON.stringify(tables), "EX", 60 * 60); // 1 hour

  return tables;
};

export const getFetchAllAreastoRedis = async (outletId: string) => {
  const allAreas = await prismaDB.areas.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      table: {
        include: {
          orderSession: {
            include: {
              orders: {
                include: {
                  orderItems: {
                    include: {
                      selectedVariant: true,
                      addOnSelected: {
                        include: {
                          selectedAddOnVariantsId: true,
                        },
                      },
                      menuItem: {
                        include: {
                          images: true,
                          category: true,
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
                          itemRecipe: true,
                        },
                      },
                    },
                  },
                },
              },
              table: true,
            },
          },
        },
      },
    },
  });

  const filteredAreas = allAreas.map((area) => ({
    id: area.id,
    restaurantId: area.restaurantId,
    name: area.name,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
    table: area.table.map((tab) => ({
      id: tab.id,
      restaurantId: tab.restaurantId,
      name: tab.name,
      shortCode: tab.shortCode,
      capacity: tab.capacity,
      uniqueId: tab.uniqueId,
      inviteCode: tab.inviteCode,
      qrcode: tab.qrcode,
      areaId: tab.areaId,
      currentOrderSessionId: tab.currentOrderSessionId,
      staffId: tab.staffId,
      customerId: tab.customerId,
      createdAt: tab.createdAt,
      occupied: tab.occupied,
      orderSession: tab.orderSession.map((orderSess) => ({
        id: orderSess.id,
        userName: orderSess.username,
        billNo: orderSess.billId,
        phoneNo: orderSess.phoneNo,
        sessionStatus: orderSess.sessionStatus,
        isPaid: orderSess.isPaid,
        paymentmethod: orderSess.paymentMethod,
        active: orderSess.active,
        orderBy: orderSess.createdBy,
        orderMode: orderSess.orderType,
        table: orderSess.table?.name,
        subTotal: orderSess.subTotal,
        orders: orderSess.orders.map((order) => ({
          id: order.id,
          generatedOrderId: order.generatedOrderId,
          mode: order.orderType,
          orderStatus: order.orderStatus,
          paid: order.isPaid,
          totalNetPrice: order?.totalNetPrice,
          gstPrice: order?.gstPrice,
          totalGrossProfit: order?.totalGrossProfit,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          date: order.createdAt,
          orderItems: order.orderItems.map((item) => ({
            id: item.id,
            menuItem: {
              id: item.menuItem.id,
              name: item.menuItem.name,
              shortCode: item.menuItem.shortCode,
              description: item.menuItem.description,
              images: item.menuItem.images,
              categoryId: item.menuItem.categoryId,
              categoryName: item.menuItem.category?.name,
              price: item.menuItem.price,
              netPrice: item.menuItem.netPrice,
              chooseProfit: item.menuItem.chooseProfit,
              gst: item.menuItem.gst,
              itemRecipe: item.menuItem.itemRecipe,
              grossProfit: item.menuItem.grossProfit,
              isVariants: item.menuItem.isVariants,
              menuItemVariants: item?.menuItem?.menuItemVariants?.map(
                (variant) => ({
                  id: variant.id,
                  variantName: variant.variant?.name,
                  price: variant.price,
                  netPrice: variant.netPrice,
                  gst: variant.gst,
                  grossProfit: variant.grossProfit,
                  type: variant.variant.variantCategory,
                })
              ),
              menuGroupAddOns: item.menuItem.menuGroupAddOns.map((addOn) => ({
                id: addOn.id,
                addOnGroupName: addOn.addOnGroups.title,
                description: addOn.addOnGroups.description,
                addonVariants: addOn.addOnGroups.addOnVariants.map(
                  (variant) => ({
                    id: variant.id,
                    name: variant.name,
                    price: variant.price,
                    type: variant.type,
                  })
                ),
              })),
            },
            name: item.name,
            quantity: item.quantity,
            originalRate: item.originalRate,
            isVariants: item.isVariants,
            totalPrice: item.totalPrice,
            selectedVariant: {
              id: item.selectedVariant?.id,
              sizeVariantId: item.selectedVariant?.sizeVariantId,
              name: item.selectedVariant?.name,
              type: item.selectedVariant?.type,
              price: item.selectedVariant?.price,
              gst: item.selectedVariant?.gst,
              netPrice: item.selectedVariant?.netPrice,
              grossProfit: item.selectedVariant?.grossProfit,
            },
            addOnSelected: item.addOnSelected.map((addOn) => ({
              id: addOn.id,
              name: addOn.name,
              addOnId: addOn.addOnId,
              selectedAddOnVariantsId: addOn.selectedAddOnVariantsId.map(
                (variant) => ({
                  id: variant.id,
                  selectedAddOnVariantId: variant.selectedAddOnVariantId,
                  name: variant.name,
                  type: variant.type,
                  price: variant.price,
                })
              ),
            })),
          })),
          updatedAt: order.updatedAt,
        })),
        date: orderSess.createdAt,
      })),
    })),
  }));

  await redis.set(
    `a-${outletId}`,
    JSON.stringify(filteredAreas),
    "EX",
    60 * 60
  ); // 1 hour

  return filteredAreas;
};
