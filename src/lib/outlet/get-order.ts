import { format, formatDistanceToNow } from "date-fns";
import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getFetchLiveOrderToRedis = async (outletId: string) => {
  const liveOrders = await prismaDB.order.findMany({
    where: {
      restaurantId: outletId,
      orderStatus: {
        in: ["INCOMMING", "PREPARING", "FOODREADY"],
      },
      active: true,
      orderItems: {
        some: {
          strike: false,
        },
      },
    },
    include: {
      orderSession: {
        include: {
          table: true,
        },
      },
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
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedOrderData = liveOrders?.map((order) => ({
    id: order.id,
    generatedOrderId: order.generatedOrderId,
    name: order?.orderSession?.username,
    mode: order.orderType,
    table: order.orderSession.table?.name,
    orderItems: order.orderItems.map((item) => ({
      id: item.id,
      menuItem: {
        id: item.menuItem.id,
        name: item.menuItem.name,
        shortCode: item.menuItem.shortCode,
        categoryId: item.menuItem.category.id,
        categoryName: item.menuItem.category.name,
        type: item.menuItem.type,
        price: item.menuItem.price,
        isVariants: item.menuItem.isVariants,
        isAddOns: item.menuItem.isAddons,
        images: item.menuItem.images.map((image) => ({
          id: image.id,
          url: image.url,
        })),
        menuItemVariants: item.menuItem.menuItemVariants.map((variant) => ({
          id: variant.id,
          variantName: variant.variant.name,
          gst: variant?.gst,
          netPrice: variant?.netPrice,
          grossProfit: variant?.grossProfit,
          price: variant.price,
          type: variant.price,
        })),
        menuGroupAddOns: item.menuItem.menuGroupAddOns.map((groupAddOn) => ({
          id: groupAddOn.id,
          addOnGroupName: groupAddOn.addOnGroups.title,
          description: groupAddOn.addOnGroups.description,
          addonVariants: groupAddOn.addOnGroups.addOnVariants.map(
            (addOnVariant) => ({
              id: addOnVariant.id,
              name: addOnVariant.name,
              price: addOnVariant.price,
              type: addOnVariant.type,
            })
          ),
        })),
      },
      name: item.name,
      quantity: item.quantity,
      netPrice: item.netPrice,
      gst: item.gst,
      gstPrice:
        (Number(item.originalRate) - Number(item.netPrice)) *
        Number(item.quantity),
      grossProfit: item.grossProfit,
      originalRate: item.originalRate,
      isVariants: item.isVariants,
      totalPrice: item.totalPrice,
      selectedVariant: item.selectedVariant,

      addOnSelected: item.addOnSelected,
    })),
    createdBy: order?.createdBy,
    orderStatus: order.orderStatus,
    paid: order.isPaid,
    total: order.totalAmount,
    createdAt: order?.createdAt,
    date: format(order.createdAt, "PP"),
  }));

  await redis.set(`liv-o-${outletId}`, JSON.stringify(formattedOrderData));

  return formattedOrderData;
};

export const getFetchAllOrderByStaffToRedis = async (
  outletId: string,
  staffId: string
) => {
  const liveOrders = await prismaDB.order.findMany({
    where: {
      restaurantId: outletId,
      staffId: staffId,
    },
    include: {
      orderSession: {
        include: {
          table: true,
        },
      },
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
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedLiveOrders = liveOrders?.map((order) => ({
    id: order.id,
    generatedOrderId: order.generatedOrderId,
    name: order?.orderSession?.username,
    mode: order.orderType,
    table: order.orderSession.table?.name,
    orderItems: order.orderItems.map((item: any) => ({
      id: item.id,
      menuItem: {
        id: item.menuItem.id,
        name: item.menuItem.name,
        shortCode: item.menuItem.shortCode,
        categoryId: item.menuItem.category.id,
        categoryName: item.menuItem.category.name,
        type: item.menuItem.type,
        price: item.menuItem.price,
        isVariants: item.menuItem.isVariants,
        isAddOns: item.menuItem.isAddons,
        images: item.menuItem.images.map((image: any) => ({
          id: image.id,
          url: image.url,
        })),
        menuItemVariants: item.menuItem.menuItemVariants.map(
          (variant: any) => ({
            id: variant.id,
            variantName: variant.variant.name,
            gst: variant?.gst,
            netPrice: variant?.netPrice,
            grossProfit: variant?.grossProfit,
            price: variant.price,
            type: variant.price,
          })
        ),
        menuGroupAddOns: item.menuItem.menuGroupAddOns.map(
          (groupAddOn: any) => ({
            id: groupAddOn.id,
            addOnGroupName: groupAddOn.addOnGroups.title,
            description: groupAddOn.addOnGroups.description,
            addonVariants: groupAddOn.addOnGroups.addOnVariants.map(
              (addOnVariant: any) => ({
                id: addOnVariant.id,
                name: addOnVariant.name,
                price: addOnVariant.price,
                type: addOnVariant.type,
              })
            ),
          })
        ),
      },
      name: item.name,
      quantity: item.quantity,
      netPrice: item.netPrice,
      gst: item.gst,
      gstPrice:
        (item.originalRate - parseFloat(item.netPrice)) * Number(item.quantity),
      grossProfit: item.grossProfit,
      originalRate: item.originalRate,
      isVariants: item.isVariants,
      totalPrice: item.totalPrice,
      selectedVariant: item.selectedVariant,
      addOnSelected: item.addOnSelected,
    })),
    createdBy: order?.createdBy,
    orderStatus: order.orderStatus,
    paid: order.isPaid,
    totalAmount: Number(order.totalAmount),
    createdAt: formatDistanceToNow(new Date(order.createdAt), {
      addSuffix: true,
    }),
    date: format(order.createdAt, "PP"),
  }));

  await redis.set(
    `all-staff-orders-${outletId}-${staffId}`,
    JSON.stringify(formattedLiveOrders)
  );

  return formattedLiveOrders;
};

export const getFetchLiveOrderByStaffToRedis = async (
  outletId: string,
  staffId: string
) => {
  const liveOrders = await prismaDB.order.findMany({
    where: {
      restaurantId: outletId,
      orderStatus: {
        in: ["INCOMMING", "PREPARING", "FOODREADY"],
      },
      staffId: staffId,
      active: true,
      orderItems: {
        some: {
          strike: false,
        },
      },
    },
    include: {
      orderSession: {
        include: {
          table: true,
        },
      },
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
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedLiveOrders = liveOrders?.map((order) => ({
    id: order.id,
    generatedOrderId: order.generatedOrderId,
    name: order?.orderSession?.username,
    mode: order.orderType,
    table: order.orderSession.table?.name,
    orderItems: order.orderItems.map((item: any) => ({
      id: item.id,
      menuItem: {
        id: item.menuItem.id,
        name: item.menuItem.name,
        shortCode: item.menuItem.shortCode,
        categoryId: item.menuItem.category.id,
        categoryName: item.menuItem.category.name,
        type: item.menuItem.type,
        price: item.menuItem.price,
        isVariants: item.menuItem.isVariants,
        isAddOns: item.menuItem.isAddons,
        images: item.menuItem.images.map((image: any) => ({
          id: image.id,
          url: image.url,
        })),
        menuItemVariants: item.menuItem.menuItemVariants.map(
          (variant: any) => ({
            id: variant.id,
            variantName: variant.variant.name,
            gst: variant?.gst,
            netPrice: variant?.netPrice,
            grossProfit: variant?.grossProfit,
            price: variant.price,
            type: variant.price,
          })
        ),
        menuGroupAddOns: item.menuItem.menuGroupAddOns.map(
          (groupAddOn: any) => ({
            id: groupAddOn.id,
            addOnGroupName: groupAddOn.addOnGroups.title,
            description: groupAddOn.addOnGroups.description,
            addonVariants: groupAddOn.addOnGroups.addOnVariants.map(
              (addOnVariant: any) => ({
                id: addOnVariant.id,
                name: addOnVariant.name,
                price: addOnVariant.price,
                type: addOnVariant.type,
              })
            ),
          })
        ),
      },
      name: item.name,
      quantity: item.quantity,
      netPrice: item.netPrice,
      gst: item.gst,
      gstPrice:
        (item.originalRate - parseFloat(item.netPrice)) * Number(item.quantity),
      grossProfit: item.grossProfit,
      originalRate: item.originalRate,
      isVariants: item.isVariants,
      totalPrice: item.totalPrice,
      selectedVariant: item.selectedVariant,
      addOnSelected: item.addOnSelected,
    })),
    createdBy: order?.createdBy,
    orderStatus: order.orderStatus,
    paid: order.isPaid,
    totalAmount: Number(order.totalAmount),
    createdAt: formatDistanceToNow(new Date(order.createdAt), {
      addSuffix: true,
    }),
    date: format(order.createdAt, "PP"),
  }));

  await redis.set(
    `liv-o-${outletId}-${staffId}`,
    JSON.stringify(formattedLiveOrders)
  );

  return formattedLiveOrders;
};

export const getFetchActiveOrderSessionToRedis = async (outletId: string) => {
  const activeOrders = await prismaDB.orderSession.findMany({
    where: {
      restaurantId: outletId,
      active: true,
    },
    include: {
      table: true,
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
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedAllOrderData = activeOrders?.map((order) => ({
    id: order.id,
    billNo: order.billId,
    phoneNo: order.phoneNo,
    active: order.active,
    sessionStatus: order.sessionStatus,
    userName: order.username,
    isPaid: order.isPaid,
    paymentmethod: order.paymentMethod,
    orderMode: order.orderType,
    table: order.table?.name,
    subTotal: order.subTotal,
    orders: order.orders.map((order) => ({
      id: order.id,
      generatedOrderId: order.generatedOrderId,
      mode: order.orderType,
      orderStatus: order.orderStatus,
      paid: order.isPaid,
      totalNetPrice: order?.totalNetPrice,
      gstPrice: order?.gstPrice,
      totalGrossProfit: order?.totalGrossProfit,
      totalAmount: order.totalAmount,
      createdAt: formatDistanceToNow(new Date(order.createdAt), {
        addSuffix: true,
      }),
      date: format(order.createdAt, "PP"),
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        menuItem: {
          id: item.menuItem.id,
          name: item.menuItem.name,
          shortCode: item.menuItem.shortCode,
          categoryId: item.menuItem.category.id,
          categoryName: item.menuItem.category.name,
          type: item.menuItem.type,
          price: item.menuItem.price,
          isVariants: item.menuItem.isVariants,
          isAddOns: item.menuItem.isAddons,
          images: item.menuItem.images.map((image) => ({
            id: image.id,
            url: image.url,
          })),
          menuItemVariants: item.menuItem.menuItemVariants.map((variant) => ({
            id: variant.id,
            variantName: variant.variant.name,
            price: variant.price,
            type: variant.price,
          })),
          menuGroupAddOns: item.menuItem.menuGroupAddOns.map((groupAddOn) => ({
            id: groupAddOn.id,
            addOnGroupName: groupAddOn.addOnGroups.title,
            description: groupAddOn.addOnGroups.description,
            addonVariants: groupAddOn.addOnGroups.addOnVariants.map(
              (addOnVariant) => ({
                id: addOnVariant.id,
                name: addOnVariant.name,
                price: addOnVariant.price,
                type: addOnVariant.type,
              })
            ),
          })),
        },
        name: item.name,
        quantity: item.quantity,
        netPrice: item.netPrice,
        gst: item.gst,
        grossProfit: item.grossProfit,
        originalRate: item.originalRate,
        isVariants: item.isVariants,
        totalPrice: item.totalPrice,
        selectedVariant: item.selectedVariant,
        addOnSelected: item.addOnSelected,
      })),
    })),
    date: order.createdAt,
  }));

  await redis.set(
    `active-os-${outletId}`,
    JSON.stringify(formattedAllOrderData)
  );

  return formattedAllOrderData;
};

export const getFetchAllStaffOrderSessionToRedis = async (
  outletId: string,
  staffId: string
) => {
  const getAllOrders = await prismaDB.orderSession.findMany({
    where: {
      restaurantId: outletId,
      staffId: staffId,
    },
    include: {
      table: true,
      orders: {
        include: {
          orderItems: {
            include: {
              addOnSelected: {
                include: {
                  selectedAddOnVariantsId: true,
                },
              },
              menuItem: {
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
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return getAllOrders;
};
