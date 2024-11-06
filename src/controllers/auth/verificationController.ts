import { Request, Response } from "express";
import { prismaDB } from "../..";
import { NotFoundException } from "../../exceptions/not-found";
import { ErrorCode } from "../../exceptions/root";

export const getVerificationTokenByEmail = async (
  req: Request,
  res: Response
) => {
  const { email } = req.params;

  const token = await prismaDB.verificationToken.findFirst({
    where: { email },
  });
  return res.json({ success: true, token });
};

export const getVerificationTokenByToken = async (
  req: Request,
  res: Response
) => {
  const { token } = req.params;

  const verificationToken = await prismaDB.verificationToken.findFirst({
    where: { token },
  });
  return res.json({ success: true, verificationToken });
};

export const updateUserEmailVerification = async (
  req: Request,
  res: Response
) => {
  const { userId, email } = req.body;

  const findUser = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!findUser) {
    throw new NotFoundException("User Not FOund", ErrorCode.NOT_FOUND);
  }

  await prismaDB.user.update({
    where: {
      id: findUser.id,
    },
    data: {
      emailVerified: new Date(),
      email: email,
    },
  });

  return res.json({
    success: true,
    message: "User email has Verified",
  });
};

export const deleteVerificationToken = async (req: Request, res: Response) => {
  const { id } = req.params;

  const findVerificationToken = await prismaDB.verificationToken.findFirst({
    where: {
      id,
    },
  });

  if (findVerificationToken?.id) {
    await prismaDB.verificationToken.delete({
      where: { id: findVerificationToken?.id },
    });

    return res.json({
      success: true,
      message: "Verifcation Token Deleted",
    });
  }
};
