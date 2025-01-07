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

  if (liveOrders?.length > 0) {
    await redis.set(`liv-o-${outletId}`, JSON.stringify(liveOrders));
  } else {
    await redis.del(`liv-o-${outletId}`);
  }

  return liveOrders;
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

  if (activeOrders?.length > 0) {
    await redis.set(`active-os-${outletId}`, JSON.stringify(activeOrders));
  } else {
    await redis.del(`active-os-${outletId}`);
  }
  return activeOrders;
};

export const getFetchAllOrderSessionToRedis = async (outletId: string) => {
  const activeOrders = await prismaDB.orderSession.findMany({
    take: 150,
    where: {
      restaurantId: outletId,
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

  if (activeOrders?.length > 0) {
    await redis.set(`all-os-${outletId}`, JSON.stringify(activeOrders));
  } else {
    await redis.del(`all-os-${outletId}`);
  }
  return activeOrders;
};

export const getFetchAllOrdersToRedis = async (outletId: string) => {
  const getOrders = await prismaDB.order.findMany({
    take: 150,
    where: {
      restaurantId: outletId,
    },
    include: {
      orderSession: true,
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

  if (getOrders?.length > 0) {
    await redis.set(`all-orders-${outletId}`, JSON.stringify(getOrders));
  } else {
    await redis.del(`all-orders-${outletId}`);
  }

  return getOrders;
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

  if (getAllOrders?.length > 0) {
    await redis.set(
      `all-order-staff-${outletId}`,
      JSON.stringify(getAllOrders)
    );
  } else {
    await redis.del(`all-order-staff-${outletId}`);
  }

  return getAllOrders;
};
