import { Request, Response } from "express";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import {
  FoodRole,
  ChooseProfit,
  GrossProfitType,
  GstType,
} from "@prisma/client";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import { prismaDB } from "../../..";
import { GEMINI_API_KEY } from "../../../secrets";
import { generateSlug } from "../../../lib/utils";
import { redis } from "../../../services/redis";

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Function to call Gemini API for image analysis
async function analyzeMenuImage(imageUrl: string) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("Google Gemini API key is not configured");
    }

    // Get the Gemini 1.5 Flash model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Fetch the image
    const imageData = await fetchImageAsBase64(imageUrl);

    // Call Gemini API for image analysis
    const result = await model.generateContent([
      "Analyze this restaurant menu image and extract all menu items. For each item, provide: name, description (if visible), price, category (if visible), and food type (VEG, NONVEG, EGG, etc.). Format the response as a JSON array of menu items.",
      {
        inlineData: {
          data: imageData,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const content = response.text();

    if (!content) {
      throw new Error("No content returned from Gemini API");
    }

    console.log(`Content ${content}`);

    // Try to parse the JSON from the response
    try {
      // Find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse JSON from Gemini response:", error);
      throw new Error("Failed to parse menu items from AI response");
    }
  } catch (error) {
    console.error("Error analyzing menu image:", error);
    throw error;
  }
}

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    console.error("Error fetching image:", error);
    throw new Error("Failed to fetch image for analysis");
  }
}

// Helper function to map food types
function mapFoodType(foodType: string | undefined | null): FoodRole {
  // Return default if foodType is undefined or null
  if (!foodType) {
    return FoodRole.NOTAPPLICABLE;
  }

  // Normalize the food type by converting to lowercase and removing spaces
  const normalizedType = foodType.toLowerCase().replace(/\s+/g, "");

  // Map of normalized food types to FoodRole enum values
  const typeMap: Record<string, FoodRole> = {
    veg: FoodRole.VEG,
    nonveg: FoodRole.NONVEG,
    egg: FoodRole.EGG,
    fish: FoodRole.FISH,
    softdrinks: FoodRole.SOFTDRINKS,
    alcohol: FoodRole.ALCOHOL,
    nonalcoholic: FoodRole.NONALCOHOLIC,
    milk: FoodRole.MILK,
    notapplicable: FoodRole.NOTAPPLICABLE,
  };

  // Check if the normalized type exists in our map
  if (typeMap[normalizedType]) {
    return typeMap[normalizedType];
  }

  // Handle special cases for uppercase values that might come from the AI
  if (foodType === "VEG") return FoodRole.VEG;
  if (foodType === "NONVEG") return FoodRole.NONVEG;
  if (foodType === "EGG") return FoodRole.EGG;
  if (foodType === "FISH") return FoodRole.FISH;
  if (foodType === "SOFTDRINKS") return FoodRole.SOFTDRINKS;
  if (foodType === "ALCOHOL") return FoodRole.ALCOHOL;
  if (foodType === "NONALCOHOLIC") return FoodRole.NONALCOHOLIC;
  if (foodType === "MILK") return FoodRole.MILK;
  if (foodType === "NOTAPPLICABLE") return FoodRole.NOTAPPLICABLE;

  // Default case
  return FoodRole.NOTAPPLICABLE;
}

// Helper function to calculate gross profit based on food name
function calculateGrossProfit(foodName: string): number {
  // Simple logic to estimate gross profit based on food type
  const lowerName = foodName.toLowerCase();

  // Higher profit margins for beverages and desserts
  if (
    lowerName.includes("drink") ||
    lowerName.includes("beverage") ||
    lowerName.includes("juice") ||
    lowerName.includes("soda") ||
    lowerName.includes("dessert") ||
    lowerName.includes("ice cream")
  ) {
    return 70; // 70% gross profit
  }

  // Medium profit margins for main courses
  if (
    lowerName.includes("curry") ||
    lowerName.includes("rice") ||
    lowerName.includes("noodle") ||
    lowerName.includes("pasta") ||
    lowerName.includes("pizza") ||
    lowerName.includes("burger")
  ) {
    return 50; // 50% gross profit
  }

  // Lower profit margins for appetizers and sides
  if (
    lowerName.includes("appetizer") ||
    lowerName.includes("starter") ||
    lowerName.includes("side") ||
    lowerName.includes("salad")
  ) {
    return 40; // 40% gross profit
  }

  // Default profit margin
  return 45; // 45% gross profit
}

// Helper function to generate a unique shortCode
async function generateUniqueShortCode(
  restaurantId: string,
  name: string
): Promise<string> {
  // Create a base shortCode from the first 3 characters of each word
  const words = name.split(/\s+/);
  const baseShortCode = words
    .map((word) => word.substring(0, 3).toUpperCase())
    .join("");

  // Check if this shortCode already exists
  const existingItem = await prismaDB.menuItem.findFirst({
    where: {
      restaurantId,
      shortCode: baseShortCode,
    },
  });

  if (!existingItem) {
    return baseShortCode;
  }

  // If it exists, append a number and try again
  let counter = 1;
  let shortCode = `${baseShortCode}${counter}`;

  while (true) {
    const item = await prismaDB.menuItem.findFirst({
      where: {
        restaurantId,
        shortCode,
      },
    });

    if (!item) {
      return shortCode;
    }

    counter++;
    shortCode = `${baseShortCode}${counter}`;
  }
}

// Function to create or get category
async function getOrCreateCategory(restaurantId: string, categoryName: string) {
  try {
    // Normalize category name
    const normalizedName = categoryName.trim();
    const slug = generateSlug(normalizedName);

    // Check if category already exists
    const existingCategory = await prismaDB.category.findFirst({
      where: {
        restaurantId,
        slug,
      },
    });

    if (existingCategory) {
      return existingCategory.id;
    }

    // Create new category
    const newCategory = await prismaDB.category.create({
      data: {
        name: normalizedName,
        slug,
        restaurantId,
      },
    });

    return newCategory.id;
  } catch (error) {
    console.error(`Error creating category: ${categoryName}`, error);
    throw error;
  }
}

// Function to create menu items from AI analysis
async function createMenuItemsFromAI(restaurantId: string, menuItems: any[]) {
  const createdItems = [];

  // Group menu items by category
  const itemsByCategory: Record<string, any[]> = {};

  // First pass: group items by category
  for (const item of menuItems) {
    const categoryName = item.category || "Uncategorized";
    if (!itemsByCategory[categoryName]) {
      itemsByCategory[categoryName] = [];
    }
    itemsByCategory[categoryName].push(item);
  }

  // Second pass: create categories and menu items
  for (const [categoryName, items] of Object.entries(itemsByCategory)) {
    try {
      // Create or get category
      const categoryId = await getOrCreateCategory(restaurantId, categoryName);

      // Create menu items for this category
      for (const item of items) {
        try {
          // Generate slug for the item
          const itemSlug = generateSlug(item.name);

          // Check if an item with this slug already exists for this restaurant
          const existingItem = await prismaDB.menuItem.findFirst({
            where: {
              restaurantId,
              slug: itemSlug,
            },
          });

          // Skip if item already exists
          if (existingItem) {
            console.log(
              `Skipping duplicate item: ${item.name} (slug: ${itemSlug})`
            );
            continue;
          }

          // Generate a unique shortCode
          const shortCode = await generateUniqueShortCode(
            restaurantId,
            item.name
          );

          // Calculate gross profit based on food name
          const grossProfit = calculateGrossProfit(item.name);

          // Determine if item has variants
          const hasVariants = item.variants && item.variants.length > 0;

          // Base menu item data
          const menuItemData: any = {
            name: item.name,
            shortCode,
            description: item.description || "",
            categoryId,
            isVariants: hasVariants,
            isAddons: false,
            type: mapFoodType(item.foodType),
            isDelivery: true,
            isPickUp: true,
            isDineIn: true,
            isOnline: true,
            restaurantId,
            slug: itemSlug,
          };

          // Add pricing information only if no variants
          if (!hasVariants) {
            // Ensure price is a string
            const price = item.price ? String(item.price) : "0";
            Object.assign(menuItemData, {
              price,
              netPrice: price, // Same as price for GST_0
              chooseProfit: ChooseProfit.manualProfit,
              gst: 0,
              gstType: GstType.GST_0,
              grossProfit,
              grossProfitType: GrossProfitType.INR,
              grossProfitPer: "",
            });
          }

          // Create the menu item
          const createdItem = await prismaDB.menuItem.create({
            data: menuItemData,
          });

          // Create images if they exist
          if (item.imageUrl) {
            await prismaDB.image.create({
              data: {
                menuId: createdItem.id,
                url: item.imageUrl,
              },
            });
          }

          // Handle variants if they exist
          if (hasVariants) {
            for (const variant of item.variants) {
              // Generate slug for the variant
              const variantSlug = generateSlug(variant.name);

              // Note: We're not checking for duplicate variants due to schema limitations
              // If you need this functionality, consider updating your Prisma schema

              // Ensure price is a string
              const variantPrice = variant.price ? String(variant.price) : "0";

              // Create variant
              const variantData: any = {
                name: variant.name,
                slug: variantSlug,
                price: variantPrice,
                netPrice: variantPrice, // Same as price for GST_0
                gst: 0,
                gstType: GstType.GST_0,
                grossProfit: calculateGrossProfit(variant.name),
                grossProfitType: GrossProfitType.INR,
                grossProfitPer: "",
                chooseProfit: ChooseProfit.manualProfit,
                foodType: mapFoodType(variant.foodType || item.foodType),
                menuItemId: createdItem.id,
                restaurantId,
                variantId: variant.variantId || "", // This should be a valid variant ID
              };

              await prismaDB.menuItemVariant.create({
                data: variantData,
              });
            }
          }

          createdItems.push(createdItem);
        } catch (error) {
          console.error(`Failed to create menu item: ${item.name}`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to process category: ${categoryName}`, error);
    }
  }

  return createdItems;
}

// Controller function to handle AI menu generation
export const generateMenuFromImage = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { imageUrl } = req.body;

  if (!imageUrl) {
    throw new BadRequestsException(
      "Image URL is required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  try {
    // Analyze the menu image using AI
    const menuItems = await analyzeMenuImage(imageUrl);

    console.log(`MenuItems-stringify${JSON.stringify(menuItems)}`);

    if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
      throw new BadRequestsException(
        "No menu items could be extracted from the image",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    // Create menu items in the database
    const createdItems = await createMenuItemsFromAI(outletId, menuItems);

    await Promise.all([
      redis.del(`${outletId}-all-items`),
      redis.del(`${outletId}-all-items-for-online-and-delivery`),
      redis.del(`o-${outletId}-categories`),
    ]);

    return res.status(200).json({
      success: true,
      message: `Successfully created ${createdItems.length} menu items`,
      data: createdItems,
    });
  } catch (error: any) {
    console.error("Error generating menu from image:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate menu from image",
    });
  }
};
