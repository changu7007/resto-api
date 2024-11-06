import express from "express";
import { Staff } from "@prisma/client";

declare global {
  namespace Express {
    export interface Request {
      user: {
        id: string;
        name: string;
        email: string;
        role: $Enums.UserRole;
        restaurantId: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}
