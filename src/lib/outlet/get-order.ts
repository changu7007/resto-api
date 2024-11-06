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

  await redis.set(`liv-o-${outletId}`, JSON.stringify(liveOrders));

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

  await redis.set(`active-os-${outletId}`, JSON.stringify(activeOrders));
  return activeOrders;
};

export const getFetchAllOrderSessionToRedis = async (outletId: string) => {
  const activeOrders = await prismaDB.orderSession.findMany({
    where: {
      restaurantId: outletId,
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

  await redis.set(`all-os-${outletId}`, JSON.stringify(activeOrders));
  return activeOrders;
};

export const getFetchAllOrdersToRedis = async (outletId: string) => {
  const getOrders = await prismaDB.order.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      orderSession: true,
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
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(`all-orders-${outletId}`, JSON.stringify(getOrders));

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

  await redis.set(`all-order-staff-${outletId}`, JSON.stringify(getAllOrders));

  return getAllOrders;
};
