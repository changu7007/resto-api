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
exports.generateMenuFromImage = void 0;
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const client_1 = require("@prisma/client");
const generative_ai_1 = require("@google/generative-ai");
const __1 = require("../../..");
const secrets_1 = require("../../../secrets");
const utils_1 = require("../../../lib/utils");
const redis_1 = require("../../../services/redis");
// Initialize Google Gemini AI
const genAI = new generative_ai_1.GoogleGenerativeAI(secrets_1.GEMINI_API_KEY);
// Function to call Gemini API for image analysis
function analyzeMenuImage(imageUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!secrets_1.GEMINI_API_KEY) {
                throw new Error("Google Gemini API key is not configured");
            }
            // Get the Gemini 1.5 Flash model
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            // Fetch the image
            const imageData = yield fetchImageAsBase64(imageUrl);
            // Call Gemini API for image analysis
            const result = yield model.generateContent([
                "Analyze this restaurant menu image and extract all menu items. For each item, provide: name, description (if visible), price, category (if visible), and food type (VEG, NONVEG, EGG, etc.). Format the response as a JSON array of menu items.",
                {
                    inlineData: {
                        data: imageData,
                        mimeType: "image/jpeg",
                    },
                },
            ]);
            const response = yield result.response;
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
            }
            catch (error) {
                console.error("Failed to parse JSON from Gemini response:", error);
                throw new Error("Failed to parse menu items from AI response");
            }
        }
        catch (error) {
            console.error("Error analyzing menu image:", error);
            throw error;
        }
    });
}
// Helper function to fetch image and convert to base64
function fetchImageAsBase64(imageUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(imageUrl);
            const arrayBuffer = yield response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            return buffer.toString("base64");
        }
        catch (error) {
            console.error("Error fetching image:", error);
            throw new Error("Failed to fetch image for analysis");
        }
    });
}
// Helper function to map food types
function mapFoodType(foodType) {
    // Return default if foodType is undefined or null
    if (!foodType) {
        return client_1.FoodRole.NOTAPPLICABLE;
    }
    // Normalize the food type by converting to lowercase and removing spaces
    const normalizedType = foodType.toLowerCase().replace(/\s+/g, "");
    // Map of normalized food types to FoodRole enum values
    const typeMap = {
        veg: client_1.FoodRole.VEG,
        nonveg: client_1.FoodRole.NONVEG,
        egg: client_1.FoodRole.EGG,
        fish: client_1.FoodRole.FISH,
        softdrinks: client_1.FoodRole.SOFTDRINKS,
        alcohol: client_1.FoodRole.ALCOHOL,
        nonalcoholic: client_1.FoodRole.NONALCOHOLIC,
        milk: client_1.FoodRole.MILK,
        notapplicable: client_1.FoodRole.NOTAPPLICABLE,
    };
    // Check if the normalized type exists in our map
    if (typeMap[normalizedType]) {
        return typeMap[normalizedType];
    }
    // Handle special cases for uppercase values that might come from the AI
    if (foodType === "VEG")
        return client_1.FoodRole.VEG;
    if (foodType === "NONVEG")
        return client_1.FoodRole.NONVEG;
    if (foodType === "EGG")
        return client_1.FoodRole.EGG;
    if (foodType === "FISH")
        return client_1.FoodRole.FISH;
    if (foodType === "SOFTDRINKS")
        return client_1.FoodRole.SOFTDRINKS;
    if (foodType === "ALCOHOL")
        return client_1.FoodRole.ALCOHOL;
    if (foodType === "NONALCOHOLIC")
        return client_1.FoodRole.NONALCOHOLIC;
    if (foodType === "MILK")
        return client_1.FoodRole.MILK;
    if (foodType === "NOTAPPLICABLE")
        return client_1.FoodRole.NOTAPPLICABLE;
    // Default case
    return client_1.FoodRole.NOTAPPLICABLE;
}
// Helper function to calculate gross profit based on food name
function calculateGrossProfit(foodName) {
    // Simple logic to estimate gross profit based on food type
    const lowerName = foodName.toLowerCase();
    // Higher profit margins for beverages and desserts
    if (lowerName.includes("drink") ||
        lowerName.includes("beverage") ||
        lowerName.includes("juice") ||
        lowerName.includes("soda") ||
        lowerName.includes("dessert") ||
        lowerName.includes("ice cream")) {
        return 70; // 70% gross profit
    }
    // Medium profit margins for main courses
    if (lowerName.includes("curry") ||
        lowerName.includes("rice") ||
        lowerName.includes("noodle") ||
        lowerName.includes("pasta") ||
        lowerName.includes("pizza") ||
        lowerName.includes("burger")) {
        return 50; // 50% gross profit
    }
    // Lower profit margins for appetizers and sides
    if (lowerName.includes("appetizer") ||
        lowerName.includes("starter") ||
        lowerName.includes("side") ||
        lowerName.includes("salad")) {
        return 40; // 40% gross profit
    }
    // Default profit margin
    return 45; // 45% gross profit
}
// Helper function to generate a unique shortCode
function generateUniqueShortCode(restaurantId, name) {
    return __awaiter(this, void 0, void 0, function* () {
        // Create a base shortCode from the first 3 characters of each word
        const words = name.split(/\s+/);
        const baseShortCode = words
            .map((word) => word.substring(0, 3).toUpperCase())
            .join("");
        // Check if this shortCode already exists
        const existingItem = yield __1.prismaDB.menuItem.findFirst({
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
            const item = yield __1.prismaDB.menuItem.findFirst({
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
    });
}
// Function to create or get category
function getOrCreateCategory(restaurantId, categoryName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Normalize category name
            const normalizedName = categoryName.trim();
            const slug = (0, utils_1.generateSlug)(normalizedName);
            // Check if category already exists
            const existingCategory = yield __1.prismaDB.category.findFirst({
                where: {
                    restaurantId,
                    slug,
                },
            });
            if (existingCategory) {
                return existingCategory.id;
            }
            // Create new category
            const newCategory = yield __1.prismaDB.category.create({
                data: {
                    name: normalizedName,
                    slug,
                    restaurantId,
                },
            });
            return newCategory.id;
        }
        catch (error) {
            console.error(`Error creating category: ${categoryName}`, error);
            throw error;
        }
    });
}
// Function to create menu items from AI analysis
function createMenuItemsFromAI(restaurantId, menuItems) {
    return __awaiter(this, void 0, void 0, function* () {
        const createdItems = [];
        // Group menu items by category
        const itemsByCategory = {};
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
                const categoryId = yield getOrCreateCategory(restaurantId, categoryName);
                // Create menu items for this category
                for (const item of items) {
                    try {
                        // Generate slug for the item
                        const itemSlug = (0, utils_1.generateSlug)(item.name);
                        // Check if an item with this slug already exists for this restaurant
                        const existingItem = yield __1.prismaDB.menuItem.findFirst({
                            where: {
                                restaurantId,
                                slug: itemSlug,
                            },
                        });
                        // Skip if item already exists
                        if (existingItem) {
                            console.log(`Skipping duplicate item: ${item.name} (slug: ${itemSlug})`);
                            continue;
                        }
                        // Generate a unique shortCode
                        const shortCode = yield generateUniqueShortCode(restaurantId, item.name);
                        // Calculate gross profit based on food name
                        const grossProfit = calculateGrossProfit(item.name);
                        // Determine if item has variants
                        const hasVariants = item.variants && item.variants.length > 0;
                        // Base menu item data
                        const menuItemData = {
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
                                chooseProfit: client_1.ChooseProfit.manualProfit,
                                gst: 0,
                                gstType: client_1.GstType.GST_0,
                                grossProfit,
                                grossProfitType: client_1.GrossProfitType.INR,
                                grossProfitPer: "",
                            });
                        }
                        // Create the menu item
                        const createdItem = yield __1.prismaDB.menuItem.create({
                            data: menuItemData,
                        });
                        // Create images if they exist
                        if (item.imageUrl) {
                            yield __1.prismaDB.image.create({
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
                                const variantSlug = (0, utils_1.generateSlug)(variant.name);
                                // Note: We're not checking for duplicate variants due to schema limitations
                                // If you need this functionality, consider updating your Prisma schema
                                // Ensure price is a string
                                const variantPrice = variant.price ? String(variant.price) : "0";
                                // Create variant
                                const variantData = {
                                    name: variant.name,
                                    slug: variantSlug,
                                    price: variantPrice,
                                    netPrice: variantPrice, // Same as price for GST_0
                                    gst: 0,
                                    gstType: client_1.GstType.GST_0,
                                    grossProfit: calculateGrossProfit(variant.name),
                                    grossProfitType: client_1.GrossProfitType.INR,
                                    grossProfitPer: "",
                                    chooseProfit: client_1.ChooseProfit.manualProfit,
                                    foodType: mapFoodType(variant.foodType || item.foodType),
                                    menuItemId: createdItem.id,
                                    restaurantId,
                                    variantId: variant.variantId || "", // This should be a valid variant ID
                                };
                                yield __1.prismaDB.menuItemVariant.create({
                                    data: variantData,
                                });
                            }
                        }
                        createdItems.push(createdItem);
                    }
                    catch (error) {
                        console.error(`Failed to create menu item: ${item.name}`, error);
                    }
                }
            }
            catch (error) {
                console.error(`Failed to process category: ${categoryName}`, error);
            }
        }
        return createdItems;
    });
}
// Controller function to handle AI menu generation
const generateMenuFromImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { imageUrl } = req.body;
    if (!imageUrl) {
        throw new bad_request_1.BadRequestsException("Image URL is required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    try {
        // Analyze the menu image using AI
        const menuItems = yield analyzeMenuImage(imageUrl);
        console.log(`MenuItems-stringify${JSON.stringify(menuItems)}`);
        if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
            throw new bad_request_1.BadRequestsException("No menu items could be extracted from the image", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        // Create menu items in the database
        const createdItems = yield createMenuItemsFromAI(outletId, menuItems);
        yield Promise.all([
            redis_1.redis.del(`${outletId}-all-items`),
            redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
            redis_1.redis.del(`o-${outletId}-categories`),
        ]);
        return res.status(200).json({
            success: true,
            message: `Successfully created ${createdItems.length} menu items`,
            data: createdItems,
        });
    }
    catch (error) {
        console.error("Error generating menu from image:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to generate menu from image",
        });
    }
});
exports.generateMenuFromImage = generateMenuFromImage;
