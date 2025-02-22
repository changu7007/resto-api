import { Request, Response } from "express";
import { redis } from "../../../services/redis";
import { MenuItem } from "@prisma/client";
import { prismaDB } from "../../..";
import { ErrorCode } from "../../../exceptions/root";
import { NotFoundException } from "../../../exceptions/not-found";
import { BadRequestsException } from "../../../exceptions/bad-request";

const getStaffFavoriteMenu = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const staffId = req.user?.id;
  const redisItems = await redis.get(`${outletId}-all-items`);

  const staff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
  });

  if (!staff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  const favoriteMenu = staff?.favoriteMenu || [];

  const items: MenuItem[] = JSON.parse(redisItems || "[]");

  const favoriteItems = items.filter((item) => favoriteMenu.includes(item.id));

  res.json({ success: true, data: favoriteItems });
};

const addStaffFavoriteMenu = async (req: Request, res: Response) => {
  // @ts-ignore
  const staffId = req.user?.id;

  const staff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
  });

  if (!staff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  const { itemId } = req.body;

  if (!itemId) {
    throw new BadRequestsException(
      "Item ID is required",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  // Ensure favItems is an array
  const favItems = Array.isArray(staff?.favoriteMenu)
    ? staff?.favoriteMenu
    : [];

  // Check if the menu ID exists in favItems
  const updatedFavItems = favItems.includes(itemId)
    ? favItems.filter((favId) => favId !== itemId) // Remove the ID if present
    : [...favItems, itemId]; // Add the ID if not present

  await prismaDB.staff.update({
    where: { id: staffId },
    data: { favoriteMenu: updatedFavItems },
  });

  res.json({ success: true, message: "Item added to favorite menu" });
};

const removeStaffFavoriteMenu = async (req: Request, res: Response) => {
  // @ts-ignore
  const staffId = req.user?.id;

  const { itemId } = req.params;

  const staff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
  });

  if (!staff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  const favoriteMenu = staff?.favoriteMenu || [];

  const updatedFavoriteMenu = favoriteMenu.filter((id) => id !== itemId);

  await prismaDB.staff.update({
    where: { id: staffId },
    data: { favoriteMenu: updatedFavoriteMenu },
  });

  res.json({ success: true, message: "Item removed from favorite menu" });
};

export { getStaffFavoriteMenu, addStaffFavoriteMenu, removeStaffFavoriteMenu };
